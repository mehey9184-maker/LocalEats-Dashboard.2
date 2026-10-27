import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import {once} from "node:events";
import type {AddressInfo} from "node:net";
import {request as httpRequest} from "node:http";
import {authAdmin} from "../lib/firebaseAdmin.js";
import {supabaseAdmin} from "../lib/supabaseAdmin.js";
import {customerOrderRoutes,merchantOrderRoutes} from "./orders.js";
import {pickupNotificationRoutes} from "./pickupNotifications.js";
import {configureApiCacheSafety} from "../middleware/apiCacheSafety.js";
const id="550e8400-e29b-41d4-a716-446655440000";
test("mounted pickup API authenticates, scopes inbox/subscriptions and uses atomic persistence",async()=>{
  const originalFrom=supabaseAdmin.from,originalRpc=supabaseAdmin.rpc,originalVerify=authAdmin.verifyIdToken;
  const reads:Array<{table:string;filters:Array<[string,unknown]>}>=[],rpcCalls:Array<[string,Record<string,unknown>]> = [];
  let persisted=false,unavailable=false,subscription:Record<string,unknown>|undefined;
  (authAdmin as any).verifyIdToken=async(token:string)=>{if(token==="expired") throw Error("expired");return {uid:token};};
  (supabaseAdmin as any).rpc=async(name:string,args:Record<string,unknown>)=>{
    rpcCalls.push([name,args]);
    if(unavailable) return {data:null,error:{message:"offline"}};
    if(args.p_uid==="other") return {data:null,error:{message:"FORBIDDEN"}};
    return {data:{order:{id,user_id:"customer",shop_id:"shop",status:"pending",payment_status:"unpaid",create_intent_hash:"a".repeat(64)},replayed:false},error:null};
  };
  (supabaseAdmin as any).from=(table:string)=>{
    const filters:Array<[string,unknown]>=[];reads.push({table,filters});
    const result=()=>({data:table==="shops" ? {id:"shop",owner_id:"merchant",name:"Shop",is_active:true,approval_status:"approved",archived_at:null,lat:-26,lng:28} :
      table==="menu_items" ? [{id:"item",shop_id:"shop",name:"Meal",price:25,is_available:true}] :
      table==="pickup_order_events" ? [] : persisted ? {id,shop_id:"shop",user_id:"customer",delivery_type:"collection",create_intent_hash:"a".repeat(64)} : null,error:null});
    const query:any={select:()=>query,eq:(key:string,value:unknown)=>{filters.push([key,value]);return query;},
      in:()=>query,order:()=>query,limit:()=>query,is:()=>query,
      maybeSingle:async()=>result(),then:(resolve:any,reject:any)=>Promise.resolve(result()).then(resolve,reject),
      upsert:(record:Record<string,unknown>)=>{subscription=record;return query;},update:()=>query};
    return query;
  };
  const app=express();configureApiCacheSafety(app);app.use(express.json());
  app.use("/api/v1",pickupNotificationRoutes);app.use("/api/v1/orders",customerOrderRoutes);app.use("/api/v1/merchant/orders",merchantOrderRoutes);
  const server=app.listen(0,"127.0.0.1");await once(server,"listening");
  const call=(path:string,uid?:string,body?:unknown,method="POST"):Promise<{status:number;body:any;cache:unknown}>=>new Promise((resolve,reject)=>{
    const req=httpRequest({host:"127.0.0.1",port:(server.address() as AddressInfo).port,path,method,headers:{"Content-Type":"application/json",...(uid ? {Authorization:`Bearer fb-${uid}`} : {})}},res=>{
      let text="";res.on("data",chunk=>{text+=chunk;});res.on("end",()=>resolve({status:res.statusCode!,body:JSON.parse(text),cache:res.headers["cache-control"]}));
    });req.on("error",reject);req.end(body ? JSON.stringify(body) : undefined);
  });
  const input={contract_version:"pickup-v1",idempotency_key:id,shop_id:"shop",items:[{menu_item_id:"item",quantity:1}],delivery_type:"collection",
    delivery_schedule_mode:"standard",payment_method:"cash",customer_details:{name:"Customer",phone:"+27712345678"},launch_location:{lat:-26,lng:28}};
  try {
    assert.equal((await call("/api/v1/orders/quote",undefined,input)).status,401);
    assert.equal((await call("/api/v1/orders/quote","expired",input)).status,401);
    assert.equal((await call("/api/v1/orders","customer",{})).status,426);
    const quote=await call("/api/v1/orders/quote","customer",input);
    assert.equal(quote.status,200);assert.equal(quote.body.quote.total_minor,2750);assert.equal(quote.cache,"no-store");
    const consent={currency:"ZAR",total_minor:quote.body.quote.total_minor,pricing_fingerprint:quote.body.quote.pricing_fingerprint};
    const created=await call("/api/v1/orders","customer",{...input,consent});
    assert.equal(created.status,201);assert.equal(created.body.order.create_intent_hash,undefined);
    assert.equal(rpcCalls[0]![0],"pickup_create_order");assert.equal(rpcCalls[0]![1].p_uid,"customer");
    persisted=true;
    assert.equal((await call(`/api/v1/merchant/orders/${id}/payment-confirmation`,"merchant",{command_id:id,expected_revision:2})).status,400);
    assert.equal((await call(`/api/v1/merchant/orders/${id}/payment-confirmation`,"other",{command_id:id,expected_revision:2,payment_method:"cash"})).status,403);
    unavailable=true;
    assert.equal((await call(`/api/v1/merchant/orders/${id}/collect`,"merchant",{command_id:id,expected_revision:3,handover_confirmed:true})).status,503);
    unavailable=false;
    assert.equal((await call("/api/v1/notifications","customer",undefined,"GET")).status,200);
    assert.deepEqual(reads.filter(r=>r.table==="pickup_order_events").at(-1)?.filters,[["recipient_uid","customer"],["kind","ready"]]);
    assert.equal((await call(`/api/v1/push-subscriptions/${id}`,"customer",{fcm_token:"synthetic-device-token-123",permission_granted:true,user_id:"other"},"PUT")).status,400);
    assert.equal((await call(`/api/v1/push-subscriptions/${id}`,"customer",{fcm_token:"synthetic-device-token-123",permission_granted:true},"PUT")).status,200);
    assert.equal(subscription?.user_id,"customer");
  } finally {
    supabaseAdmin.from=originalFrom;supabaseAdmin.rpc=originalRpc;authAdmin.verifyIdToken=originalVerify;
    server.close();await once(server,"close");
  }
});
