import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import {makePrivateMyKotaRouter,privateMyKotaConfig} from "./privateMyKotaTest.js";
import {makeCatalogRouter,SupabaseCatalogRepository} from "./catalog.js";
import {previewReadOnlyGate} from "../middleware/previewReadOnlyGate.js";
import {pickupWriteGate} from "../middleware/pickupWriteGate.js";
import {parsePickupInput,pickupPricing,createPickup} from "../orders/pickupService.js";
import {PRIVATE_MY_KOTA_SHOP_ID} from "../orders/privateMyKotaSafety.js";
import {draftTransition,type DraftPickupState,type DraftPickupCommand} from "../contracts/pickupDraft.js";
import type {OrderRepository} from "../orders/orderService.js";
import type {RpcClient} from "../orders/pickupService.js";

const origin="https://localeats-customer-staging-r52d-audit.vercel.app";
const uid="l3n4_private_allowed_uid_0123456789";
const now=Date.UTC(2026,10,19,13,0,0);
const expiry="2026-11-26T21:00:00.000Z";
const config={
 VERCEL_ENV:"preview",LOCALEATS_STAGING_ONLY:"true",PICKUP_WRITES_ENABLED:"false",
 SUPABASE_URL:"https://rgpbdajhlrwfmhopzgzk.supabase.co",
 FIREBASE_PROJECT_ID:"localeats-staging",PRIVATE_MYKOTA_TEST_ENABLED:"true",
 PRIVATE_MYKOTA_TEST_UID:uid,PRIVATE_MYKOTA_TEST_ORIGIN:origin,
 PRIVATE_MYKOTA_TEST_EXPIRES_AT:expiry
};
const radians=(km:number)=>km*180/(Math.PI*6371);
const point={lat:-25.9830322643032,lng:28.2074831464466};
const readJSON=async(res:Response)=>res.json() as Promise<any>;
const syntheticVerify=async(token:string)=>{
 if(token==="revoked")throw Error("revoked");
 return {uid:token==="owner"?uid:"wrong_uid_01234567890",
  firebase:{sign_in_provider:token==="anonymous"?"anonymous":"password"}};
};
async function serve(app:express.Express,fn:(base:string)=>Promise<void>) {
 const server=http.createServer(app);
 await new Promise<void>((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});
 try {
  const addr=server.address();
  if(!addr||typeof addr==="string")throw Error("No server address");
  await fn("http://127.0.0.1:"+addr.port);
 } finally {await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
}
const privateReq=(base:string,path:string,token="owner",requestOrigin=origin)=>
 fetch(base+"/api/v1/private-test/my-kota"+path,{headers:{Origin:requestOrigin,Authorization:"Bearer fb-"+token}});

test("L3-N4: simulated sample and real 3.9/4.1 km boundaries; access expiry fails closed",async()=>{
 let clock=now;
 const app=express();
 app.use("/api/v1/private-test/my-kota",makePrivateMyKotaRouter(syntheticVerify,config,()=>clock));
 await serve(app,async base=>{
  const status=await privateReq(base,"/status");
  assert.equal(status.status,200);
  assert.equal((await readJSON(status)).eligible,true);
  const simulated=await privateReq(base,"/shop?mode=simulated");
  assert.equal(simulated.status,200);
  const sample=await readJSON(simulated);
  assert.equal(sample.shop.id,PRIVATE_MY_KOTA_SHOP_ID);
  assert.equal(sample.simulated_location,true);
  assert.equal(sample.preview_only,true);
  assert.equal(sample.can_submit,false);
  assert.ok(sample.menu_items.every((x:any)=>x.test_only===true&&/SAMPLE/.test(x.name)));
  for(const [km,code] of [[3.9,200],[4.1,422]]){
   const lat=point.lat+radians(km);
   const res=await privateReq(base,`/shop?mode=real&lat=${lat}&lng=${point.lng}`);
   assert.equal(res.status,code,`at ${km} km`);
   const payload=await readJSON(res);
   if(code===200){assert.equal(payload.simulated_location,false);assert.ok(payload.shop.distance_km<4);}
   else assert.equal(payload.code,"OUTSIDE_PICKUP_RADIUS");
  }
  for(const token of ["not-owner","anonymous","revoked"]){
   const res=await privateReq(base,"/shop?mode=simulated",token);
   assert.equal(res.status,404);assert.deepEqual(await readJSON(res),{success:false,code:"NOT_FOUND"});
  }
  const badOrigin=await privateReq(base,"/shop?mode=simulated","owner","https://unapproved.vercel.app");
  assert.equal(badOrigin.status,404);
  clock=Date.parse(expiry);
  assert.equal(privateMyKotaConfig(config,clock).enabled,false);
  const expired=await privateReq(base,"/status");
  assert.equal(expired.status,404);
  assert.deepEqual(await readJSON(expired),{success:false,code:"NOT_FOUND"});
 });
});

test("L3-N4: reserved private shop cannot leak via public catalog, even if mistakenly present in repository",async()=>{
 const tables:string[]=[];
 const fakeDb:any={from(table:string){
  tables.push(table);
  const query:any={
   select:()=>query,eq:()=>query,is:()=>query,
   then:(resolve:(value:any)=>void,reject:(error:unknown)=>void)=>Promise.resolve({data:[
    {id:PRIVATE_MY_KOTA_SHOP_ID,name:"PRIVATE SAMPLE",is_active:true,approval_status:"approved",archived_at:null,lat:point.lat,lng:point.lng},
    {id:"approved-real-staging",name:"PUBLIC SHOP",is_active:true,approval_status:"approved",archived_at:null,lat:point.lat,lng:point.lng}
   ],error:null}).then(resolve,reject),
   maybeSingle:async()=>({data:{id:PRIVATE_MY_KOTA_SHOP_ID},error:null})
  };
  return query;
 }};
 const repo=new SupabaseCatalogRepository(fakeDb);
 const shops=await repo.getApprovedShops();
 assert.deepEqual(shops.map(s=>s.id),["approved-real-staging"]);
 const before=tables.length;
 assert.equal(await repo.getApprovedShopById(PRIVATE_MY_KOTA_SHOP_ID),null);
 assert.deepEqual(await repo.getMenuByShopId(PRIVATE_MY_KOTA_SHOP_ID),[]);
 assert.equal(tables.length,before,"No public DB query for reserved sample ID");
 const app=express();app.use("/api/v1/catalog",makeCatalogRouter(repo));
 await serve(app,async base=>{
  const publicList=await readJSON(await fetch(base+"/api/v1/catalog/shops"));
  assert.equal(publicList.shops.some((x:any)=>x.id===PRIVATE_MY_KOTA_SHOP_ID),false);
  for(const path of [`/shops/${PRIVATE_MY_KOTA_SHOP_ID}`,`/shops/${PRIVATE_MY_KOTA_SHOP_ID}/menu`]){
   const res=await fetch(base+"/api/v1/catalog"+path);
   assert.equal(res.status,404);
  }
 });
});

test("L3-N4: sample ID rejected before checkout price lookup, replay, DB or RPC",async()=>{
 const input={
  contract_version:"pickup-v1",idempotency_key:"550e8400-e29b-41d4-a716-446655440000",
  shop_id:PRIVATE_MY_KOTA_SHOP_ID,items:[{menu_item_id:"private-mykota-demo-kota",quantity:1}],
  delivery_type:"collection",delivery_schedule_mode:"standard",payment_method:"cash",
  customer_details:{name:"Test Customer",phone:"+27712345678"},launch_location:point
 };
 for(const creating of [false,true]){
  const payload=creating?{...input,consent:{currency:"ZAR",total_minor:2500,pricing_fingerprint:"a".repeat(64)}}:input;
  assert.throws(()=>parsePickupInput(payload,creating),(e:any)=>e.code==="PRIVATE_TEST_ONLY"&&e.status===422);
 }
 let reads=0,writes=0;
 const repository:any={
  findShop:async()=>{reads++;throw Error("must never read sample shop");},
  findOrderByIdempotencyKey:async()=>{reads++;throw Error("must not query sample replay");}
 } satisfies Partial<OrderRepository>;
 const rpc:any={rpc:async()=>{writes++;throw Error("must never reach RPC");}} satisfies Partial<RpcClient>;
 const guardedInput:any={input:{shop_id:PRIVATE_MY_KOTA_SHOP_ID},location:point};
 await assert.rejects(()=>pickupPricing(repository,"customer",guardedInput),(e:any)=>e.code==="PRIVATE_TEST_ONLY");
 await assert.rejects(()=>createPickup(rpc,repository,"customer",guardedInput),(e:any)=>e.code==="PRIVATE_TEST_ONLY");
 assert.equal(reads,0);assert.equal(writes,0);
});

test("L3-N4: Preview intercepts customer/merchant mutation verbs before handler or database",async()=>{
 const before={vercel:process.env.VERCEL_ENV,writes:process.env.PICKUP_WRITES_ENABLED};
 process.env.VERCEL_ENV="preview";process.env.PICKUP_WRITES_ENABLED="false";
 try{
  let reached=0;
  const app=express();
  app.use(previewReadOnlyGate);
  app.use(pickupWriteGate);
  app.use(express.json());
  const mutation=(req:express.Request,res:express.Response)=>{reached++;res.json({success:true});};
  for(const path of ["/api/v1/orders","/api/v1/orders/quote",
    "/api/v1/merchant/orders/order123/accept","/api/v1/merchant/orders/order123/ready",
    "/api/v1/merchant/orders/order123/payment-confirmation",
    "/api/v1/merchant/orders/order123/collect"]){
   app.post(path,mutation);
  }
  app.put("/api/v1/orders/order123",mutation);
  app.patch("/api/v1/orders/order123",mutation);
  app.delete("/api/v1/orders/order123",mutation);
  app.get("/api/v1/notifications",mutation);
  await serve(app,async base=>{
   for(const [method,path] of [
    ["POST","/api/v1/orders"],["POST","/api/v1/orders/quote"],
    ["POST","/api/v1/merchant/orders/order123/accept"],
    ["POST","/api/v1/merchant/orders/order123/ready"],
    ["POST","/api/v1/merchant/orders/order123/payment-confirmation"],
    ["POST","/api/v1/merchant/orders/order123/collect"],
    ["PUT","/api/v1/orders/order123"],["PATCH","/api/v1/orders/order123"],
    ["DELETE","/api/v1/orders/order123"],["GET","/api/v1/notifications"]
   ]){
    const res=await fetch(base+path,{method});
    assert.equal(res.status,503,`${method} ${path}`);
    const body=await readJSON(res);
    assert.equal(body.code,"PREVIEW_READ_ONLY");
    assert.match(res.headers.get("cache-control")||"",/no-store/);
   }
   assert.equal(reached,0);
  });
 }finally{
  if(before.vercel===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=before.vercel;
  if(before.writes===undefined)delete process.env.PICKUP_WRITES_ENABLED;else process.env.PICKUP_WRITES_ENABLED=before.writes;
 }
});

test("L3-N4: synthetic Merchant prepare→ready→payment→collection journey needs authorized actors",()=>{
 const orderId="synthetic-order-l3n4";
 let state:DraftPickupState={status:"pending",payment:"unpaid",revision:0};
 const cmd=(action:DraftPickupCommand["action"],revision:number):DraftPickupCommand=>({
  action,actor:"merchant",authorized:true,orderId,actorUid:"synthetic-merchant",
  expectedRevision:revision,commandId:`550e8400-e29b-41d4-a716-${String(revision+1).padStart(12,"0")}`,
  ...(action==="confirm_payment"?{paymentMethod:"cash" as const}:{}),
  ...(action==="collect"?{handoverConfirmed:true}:{})
 });
 assert.throws(()=>draftTransition(state,cmd("ready",0)),/INVALID_ORDER_TRANSITION/);
 assert.throws(()=>draftTransition(state,{...cmd("accept",0),authorized:false}),/FORBIDDEN/);
 const accepted=draftTransition(state,cmd("accept",0));state=accepted.state;
 assert.equal(state.status,"preparing");
 assert.throws(()=>draftTransition(state,cmd("accept",1)),/INVALID_ORDER_TRANSITION/);
 const ready=draftTransition(state,cmd("ready",1));state=ready.state;
 assert.equal(state.status,"ready_for_pickup");
 assert.equal(state.payment,"unpaid");
 assert.throws(()=>draftTransition(state,cmd("collect",2)),/PAYMENT_CONFIRMATION_REQUIRED/);
 const paid=draftTransition(state,cmd("confirm_payment",2));state=paid.state;
 assert.equal(state.payment,"paid");
 assert.throws(()=>draftTransition(state,{...cmd("collect",3),handoverConfirmed:false}),/HANDOVER_CONFIRMATION_REQUIRED/);
 state=draftTransition(state,cmd("collect",3)).state;
 assert.equal(state.status,"collected");
 assert.equal(state.payment,"paid");
 assert.equal(draftTransition(state,cmd("ready",1),ready.event).replayed,true);
 assert.throws(()=>draftTransition(state,cmd("accept",4)),/INVALID_ORDER_TRANSITION/);
});
