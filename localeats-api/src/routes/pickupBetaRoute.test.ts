/**
 * L3-N8U-R: Local-only loopback acceptance harness.
 * All Firebase/Supabase SDK calls are mocked; no external identity, hosted
 * database, Production order, FCM token, or real payment is used.
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import {request as httpRequest} from "node:http";
import {once} from "node:events";
import type {AddressInfo} from "node:net";
import {authAdmin} from "../lib/firebaseAdmin.js";
import {supabaseAdmin} from "../lib/supabaseAdmin.js";
import {customerOrderRoutes,merchantOrderRoutes} from "./orders.js";
import {pickupWriteGate} from "../middleware/pickupWriteGate.js";
import {configureApiCacheSafety} from "../middleware/apiCacheSafety.js";

const customer="synthetic-cust-a",owner="synthetic-owner-a",wrongOwner="synthetic-owner-b";
const shopId="shop-my-kota-ivory-park",itemId="synthetic-item";
const id="550e8400-e29b-41d4-a716-446655440001";
const orderId="550e8400-e29b-41d4-a716-446655440002";
const shop={
  id:shopId, owner_id:owner, name:"Synthetic Kota Shop",
  approval_status:"approved", is_active:true,effective_is_active:true,
  archived_at:null,location:"Ivory Park",lat:-26.0,lng:28.0,latitude:-26.0,longitude:28.0
};
const item={id:itemId,shop_id:shopId,name:"Synthetic meal",price:25,is_available:true};

test("mounted pickup beta accepts only invited customer, enforces owner, and fulfills saved order after pause",async()=>{
  const originalEnv=Object.fromEntries([
    "PICKUP_WRITES_ENABLED","PICKUP_BETA_ENABLED","PICKUP_BETA_ADMISSION_ENABLED",
    "PICKUP_BETA_SHOP_IDS","PICKUP_BETA_CUSTOMER_UIDS","PICKUP_BETA_EXPIRES_AT",
    "PICKUP_TEST_CUSTOMER_UID"
  ].map(k=>[k,process.env[k]]));
  const oldFrom=supabaseAdmin.from,oldRpc=supabaseAdmin.rpc,oldVerify=authAdmin.verifyIdToken;
  process.env.PICKUP_WRITES_ENABLED="true";
  process.env.PICKUP_BETA_ENABLED="true";
  process.env.PICKUP_BETA_ADMISSION_ENABLED="true";
  process.env.PICKUP_BETA_SHOP_IDS=shopId;
  process.env.PICKUP_BETA_CUSTOMER_UIDS=customer;
  process.env.PICKUP_BETA_EXPIRES_AT=new Date(Date.now()+7*24*60*60*1000).toISOString().replace(".000Z","Z");
  let stored:Record<string,any>|null=null;
  const events:Array<{kind:string;revision:number;actor_uid:string}>=[];
  const rpcCalls:Array<{name:string;uid:unknown;action?:unknown}>=[];
  const checks:boolean[]=[];
  (authAdmin as any).verifyIdToken=async (token:string, checkRevoked:boolean)=>{
    checks.push(checkRevoked);
    if(token==="invalid")throw Error("identity rejected");
    return {uid:token,email:null,firebase:{sign_in_provider:"password"}};
  };
  (supabaseAdmin as any).rpc=async(name:string,args:Record<string,any>)=>{
    rpcCalls.push({name,uid:args.p_uid,action:args.p_action});
    if(name==="pickup_create_order"){
      stored={id:orderId,shop_id:shopId,user_id:args.p_uid,status:"pending",payment_status:"unpaid",
        delivery_type:"collection",revision:0,create_intent_hash:args.p_intent_hash,
        idempotency_key:args.p_record.idempotency_key,delivery_status:"none"};
      return {data:{order:stored,replayed:false},error:null};
    }
    if(name==="pickup_order_command"){
      const action=String(args.p_action);
      const kinds:{[action:string]:string}={
        accept:"accepted",ready:"ready",confirm_payment:"payment_confirmed",collect:"collected"
      };
      assert.equal(args.p_order_id,orderId);
      assert.equal(args.p_expected_revision,stored?.revision);
      assert.ok(stored);
      if(!kinds[action])return {data:null,error:{message:"INVALID_ORDER_TRANSITION"}};
      stored={...stored!,revision:stored!.revision+1,
        status:action==="accept"?"preparing":action==="ready"?"ready_for_pickup":
          action==="collect"?"collected":stored!.status,
        payment_status:action==="confirm_payment"?"paid":stored!.payment_status};
      const event={id,order_id:orderId,command_id:args.p_command_id,actor_uid:args.p_uid,
        kind:kinds[action],revision:stored.revision};
      events.push(event);
      return {data:{order:stored,event,replayed:false},error:null};
    }
    if(name==="pickup_claim_push")return {data:null,error:null};
    return {data:null,error:{message:"UNEXPECTED_RPC"}};
  };
  (supabaseAdmin as any).from=(table:string)=>{
    const filters:Array<[string,unknown]>=[];
    const query:any={select:()=>query,eq:(key:string,value:unknown)=>{filters.push([key,value]);return query;},
      in:()=>query,is:()=>query,order:()=>query,limit:()=>query,range:()=>query,or:()=>query,neq:()=>query};
    const result=()=>{
      let data:any=null;
      if(table==="shops"||table==="shops_with_availability")data=shop;
      else if(table==="menu_items")data=[item];
      else if(table==="orders"){
        data=stored;
        if(filters.some(([k,v])=>k==="idempotency_key"&&stored?.idempotency_key!==v))data=null;
        if(filters.some(([k,v])=>k==="id"&&stored?.id!==v))data=null;
        if(filters.some(([k,v])=>k==="user_id"&&stored?.user_id!==v))data=null;
      } else if(table==="pickup_push_subscriptions")data=[];
      else if(table==="pickup_order_events")data=events;
      return {data,error:null};
    };
    query.maybeSingle=async()=>result();
    query.then=(resolve:any,reject:any)=>Promise.resolve(result()).then(resolve,reject);
    return query;
  };

  const app=express();
  configureApiCacheSafety(app);
  app.use(pickupWriteGate);
  app.use(express.json());
  app.use("/api/v1/orders",customerOrderRoutes);
  app.use("/api/v1/merchant/orders",merchantOrderRoutes);
  const server=app.listen(0,"127.0.0.1");
  await once(server,"listening");
  async function call(path:string,uid:string|undefined,body:unknown,method="POST"):
      Promise<{status:number;body:any}>{
    return new Promise((resolve,reject)=>{
      const req=httpRequest({host:"127.0.0.1",port:(server.address() as AddressInfo).port,
        path,method,headers:{"Content-Type":"application/json",
          ...(uid?{Authorization:`Bearer fb-${uid}`}:{})}},res=>{
          let out="";res.on("data",chunk=>{out+=chunk});
          res.on("end",()=>resolve({status:res.statusCode!,body:JSON.parse(out)}));
        });
      req.on("error",reject);req.end(body?JSON.stringify(body):undefined);
    });
  }
  const input={contract_version:"pickup-v1",idempotency_key:id,shop_id:shopId,
    items:[{menu_item_id:itemId,quantity:1}],delivery_type:"collection",
    delivery_schedule_mode:"standard",payment_method:"cash",
    customer_details:{name:"Synthetic customer",phone:"+27712345678"},
    launch_location:{lat:-26.0,lng:28.0}};
  try{
    assert.equal((await call("/api/v1/orders/quote",undefined,input)).status,401);
    assert.equal((await call("/api/v1/orders/quote","invalid",input)).status,401);
    const quote=await call("/api/v1/orders/quote",customer,input);
    assert.equal(quote.status,200);
    assert.equal(quote.body.quote.total_minor,2500);
    assert.equal(quote.body.quote.can_submit,true);

    for(const candidate of ["synthetic-cust-uninvited",wrongOwner]){
      const disallowed=await call("/api/v1/orders/quote",candidate,input);
      assert.equal(disallowed.status,200);
      assert.equal(disallowed.body.quote.can_submit,false);
    }
    const consent={currency:"ZAR",total_minor:quote.body.quote.total_minor,
      pricing_fingerprint:quote.body.quote.pricing_fingerprint};
    const before=rpcCalls.length;
    const wrong=await call("/api/v1/orders","synthetic-cust-uninvited",{...input,consent});
    assert.equal(wrong.status,403);
    assert.equal(rpcCalls.length,before);
    const priceTamper=await call("/api/v1/orders",customer,{
      ...input,consent:{...consent,total_minor:1}
    });
    assert.equal(priceTamper.status,409,"Edited R0.01 consent must not be accepted");
    assert.equal(rpcCalls.filter(x=>x.name==="pickup_create_order").length,0);

    const created=await call("/api/v1/orders",customer,{...input,consent});
    assert.equal(created.status,201);
    assert.equal(created.body.order.id,orderId);
    assert.equal(rpcCalls.filter(x=>x.name==="pickup_create_order").length,1);
    assert.equal(rpcCalls.find(x=>x.name==="pickup_create_order")?.uid,customer);
    const replay=await call("/api/v1/orders",customer,{...input,consent});
    assert.equal(replay.status,200,"Same intent retry must return existing order");
    assert.equal(replay.body.replayed,true);
    assert.equal(rpcCalls.filter(x=>x.name==="pickup_create_order").length,1,
      "Idempotent replay must not invoke a second order insert");

    const rejected=await call(`/api/v1/merchant/orders/${orderId}/accept`,wrongOwner,
      {command_id:id,expected_revision:0});
    assert.equal(rejected.status,403);
    assert.equal(rpcCalls.filter(x=>x.name==="pickup_order_command").length,0);

    const accepted=await call(`/api/v1/merchant/orders/${orderId}/accept`,owner,
      {command_id:id,expected_revision:0});
    assert.equal(accepted.status,200);
    assert.equal(accepted.body.command_receipt.kind,"accepted");

    // Pause NEW admissions: pre-existing pickup remains a contractual duty.
    process.env.PICKUP_BETA_ADMISSION_ENABLED="false";
    const pausedQuote=await call("/api/v1/orders/quote",customer,input);
    assert.equal(pausedQuote.body.quote.can_submit,false);
    const pausedOrder=await call("/api/v1/orders",customer,
      {...input,idempotency_key:"550e8400-e29b-41d4-a716-446655440003",consent});
    assert.equal(pausedOrder.status,503);

    for(const [path,action,revision,extra,kind] of [
      ["ready","ready",1,{},"ready"],
      ["payment-confirmation","confirm_payment",2,{payment_method:"cash"},"payment_confirmed"],
      ["collect","collect",3,{handover_confirmed:true},"collected"],
    ] as const){
      const response=await call(`/api/v1/merchant/orders/${orderId}/${path}`,owner,
        {command_id:`550e8400-e29b-41d4-a716-44665544000${revision+3}`,expected_revision:revision,...extra});
      assert.equal(response.status,200,`${action}: ${JSON.stringify(response.body)}`);
      assert.equal(response.body.command_receipt.kind,kind);
    }
    assert.equal(stored?.status,"collected");
    assert.equal(stored?.payment_status,"paid");
    assert.equal(events.map(e=>e.kind).join(","),"accepted,ready,payment_confirmed,collected");
    assert.ok(checks.length>=10);
    assert.ok(checks.every(Boolean),"Auth must enforce revoked-token verification on every tested route");
  }finally{
    supabaseAdmin.from=oldFrom;supabaseAdmin.rpc=oldRpc;authAdmin.verifyIdToken=oldVerify;
    for(const [name,value] of Object.entries(originalEnv)){
      if(value===undefined)delete process.env[name];else process.env[name]=value;
    }
    server.close();await once(server,"close");
  }
});
