import test from "node:test";
import assert from "node:assert/strict";
import {parsePickupInput,pickupPricing,pickupQuote,creationHash,createPickup,commandPickup,type RpcClient} from "./pickupService.js";
import {drainPickupPush} from "./pickupPush.js";
import {draftTransition} from "../contracts/pickupDraft.js";
import type {OrderRepository,StoredOrder} from "./orderService.js";
const id="550e8400-e29b-41d4-a716-446655440000";
const raw=()=>({contract_version:"pickup-v1",idempotency_key:id,shop_id:"shop",items:[{menu_item_id:"item",quantity:1}],
  delivery_type:"collection",delivery_schedule_mode:"standard",payment_method:"cash",customer_details:{name:"Customer",phone:"+27712345678"},
  launch_location:{lat:-26,lng:28}});
const repo=():OrderRepository=>({findOrderByIdempotencyKey:async()=>null,findShop:async()=>({id:"shop",name:"Shop",location:"Tembisa",is_active:true,
  approval_status:"approved",archived_at:null,latitude:-26,longitude:28,lat:-26,lng:28}),
  findMenuItems:async()=>[{id:"item",shop_id:"shop",name:"Meal",price:25,is_available:true}],insertOrder:async()=>{throw Error("not atomic");}});
const rpc=(call:(name:string,args:Record<string,unknown>)=>Promise<unknown>):RpcClient=>({rpc:call} as unknown as RpcClient);
async function request() {
  const quote=pickupQuote(await pickupPricing(repo(),"customer",parsePickupInput(raw(),false)));
  return parsePickupInput({...raw(),consent:{currency:"ZAR",total_minor:quote.total_minor,pricing_fingerprint:quote.pricing_fingerprint}},true);
}
test("pickup parser closes old contracts, delivery, tips, client prices, invalid consent and missing location",()=>{
  for(const input of [{...raw(),contract_version:undefined},{...raw(),delivery_type:"delivery"}, {...raw(),tip_amount:1},
    {...raw(),total_price:1},{...raw(),launch_location:undefined}]) assert.throws(()=>parsePickupInput(input,false));
  assert.throws(()=>parsePickupInput({...raw(),consent:{currency:"ZAR",total_minor:1.5,pricing_fingerprint:"a".repeat(64)}},true));
});
test("pickup uses real menu, shop eligibility and at most 4km",async()=>{
  const repository=repo(); const request=parsePickupInput(raw(),false);
  await assert.rejects(()=>pickupPricing(repository,"",request),/UNAUTHORIZED/);
  await assert.rejects(()=>pickupPricing(repository,"customer",{...request,location:{lat:-20,lng:28}}),/OUTSIDE_PICKUP_RADIUS/);
  repository.findShop=async()=>null;
  await assert.rejects(()=>pickupPricing(repository,"customer",request),/SHOP_NOT_FOUND/);
});
test("creation replay precedes repricing and retains original intent after actual cash/card change",async()=>{
  const input=await request(), repository=repo();
  const saved={id,user_id:"customer",payment_method:"card_machine",status:"collected",create_intent_hash:creationHash("customer",input)} as unknown as StoredOrder;
  repository.findOrderByIdempotencyKey=async()=>saved;
  repository.findShop=async()=>{throw Error("must not reprice");};
  const never=rpc(async()=>{throw Error("must not reinsert");});
  assert.equal((await createPickup(never,repository,"customer",input)).order,saved);
  await assert.rejects(()=>createPickup(never,repository,"other",input),/IDEMPOTENCY_CONFLICT/);
  await assert.rejects(()=>createPickup(never,repository,"customer",{...input,location:{lat:-26.01,lng:28}}),/IDEMPOTENCY_CONFLICT/);
});
test("consent mismatch prevents any write; pickup creation never includes absent delivery proof fields",async()=>{
  const input=await request(); let calls=0;
  const client=rpc(async(name,args)=>{calls++;assert.equal(name,"pickup_create_order");assert.equal(args.p_uid,"customer");
    const record=args.p_record as Record<string,unknown>;assert.equal("delivery_pin_hash" in record,false);assert.equal("delivery_qr_hash" in record,false);
    return {data:{order:{id},replayed:false},error:null};});
  await assert.rejects(()=>createPickup(client,repo(),"customer",{...input,consent:{...input.consent!,totalMinor:1}}),/PRICE_CHANGED/);
  assert.equal(calls,0);
  assert.equal((await createPickup(client,repo(),"customer",input)).order.id,id);
});
test("database failure and missing committed results never manufacture order success",async()=>{
  const input=await request();
  for(const response of [{data:null,error:{message:"database unavailable"}},{data:null,error:null},{data:{},error:null},{data:{order:{},replayed:false},error:null}]) {
    await assert.rejects(()=>createPickup(rpc(async()=>response),repo(),"customer",input),/PICKUP_PERSISTENCE/);
  }
});
test("command forwards only authenticated UID and requires actual method and handover confirmation",async()=>{
  const body={command_id:id,expected_revision:2}; let call:Record<string,unknown>|undefined;
  const client=rpc(async(name,args)=>{assert.equal(name,"pickup_order_command");call=args;return {data:{order:{id},replayed:false},error:null};});
  await assert.rejects(()=>commandPickup(client,"merchant",id,"confirm_payment",body),/INVALID_PAYMENT_METHOD/);
  await assert.rejects(()=>commandPickup(client,"merchant",id,"collect",body),/HANDOVER_CONFIRMATION_REQUIRED/);
  await assert.rejects(()=>commandPickup(client,"merchant",id,"accept",{...body,authorized:true}),/UNSUPPORTED_INPUT/);
  await commandPickup(client,"merchant",id,"confirm_payment",{...body,payment_method:"card_machine"});
  assert.equal(call?.p_uid,"merchant");assert.equal(call?.p_payment_method,"card_machine");
});
test("model rejects malformed paid pending/preparing pairs and replay from other order/actor",()=>{
  const command={orderId:id,actorUid:"merchant",action:"accept" as const,actor:"merchant" as const,authorized:true,commandId:id,expectedRevision:0};
  for(const status of ["pending","preparing"] as const) assert.throws(()=>draftTransition({status,payment:"paid",revision:0},command),/INVALID_ORDER_TRANSITION/);
  const result=draftTransition({status:"pending",payment:"unpaid",revision:0},command);
  for(const event of [{...result.event,orderId:"other"},{...result.event,actorUid:"other"}])
    assert.throws(()=>draftTransition(result.state,command,event),/IDEMPOTENCY_CONFLICT/);
});
test("push rechecks lease/token and awaits fenced completion; failure does not reverse Ready",async()=>{
  const job={id,attempts:1,lease_until:"2026-10-27T00:00:00Z",event_id:id,order_id:id,token:"synthetic-token"};
  let sent=0;const calls:Array<[string,Record<string,unknown>]> = [];
  const client=rpc(async(name,args)=>{calls.push([name,args]);return {data:name==="pickup_claim_push" ? job : true,error:null};});
  await drainPickupPush(client,"customer",async()=>{sent++;});
  assert.equal(sent,1);assert.deepEqual(calls.map(c=>c[0]),["pickup_claim_push","pickup_push_sendable","pickup_finish_push"]);
  assert.equal(calls[1]![1].p_token,job.token);assert.equal(calls[2]![1].p_attempt,1);assert.equal(calls[2]![1].p_sent,true);
  await drainPickupPush(client,"customer",async()=>{throw Error("FCM unavailable");});
  assert.equal(calls.at(-1)![1].p_sent,false);
  const denied=rpc(async(name)=>({data:name==="pickup_claim_push" ? job : false,error:null}));
  await drainPickupPush(denied,"customer",async()=>{throw Error("should not send");});
});

test("pickup quote rejects missing or outside-pilot shop metadata without classifying it",async()=>{
 const repository=repo(),shop=await repository.findShop("shop");assert.ok(shop);
 for(const location of [null,"","Elsewhere"]){
  repository.findShop=async()=>({...shop,location});
  await assert.rejects(()=>pickupPricing(repository,"customer",parsePickupInput(raw(),false)),/OUTSIDE_PICKUP_PILOT/);
 }
});


test("missing schema RPC or database legacy-write rejection never confirms creation",async()=>{
 const input=await request();
 for(const error of [{code:"PGRST202",message:"Could not find the function public.pickup_create_order"},
  {code:"42703",message:"column delivery_type does not exist"},
  {code:"P0001",message:"PICKUP_CONTRACT_REQUIRED"}]){
  await assert.rejects(()=>createPickup(rpc(async()=>({data:null,error})),repo(),"customer",input),
   (failure:unknown)=>failure instanceof Error && (failure as Error & {status:number}).status===(error.code==="P0001" ? 409 : 503));
 }
});
