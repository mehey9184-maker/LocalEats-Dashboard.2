import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import {once} from "node:events";
import {authAdmin} from "../lib/firebaseAdmin.js";
import {supabaseAdmin} from "../lib/supabaseAdmin.js";
import merchant from "./merchant.js";
import {effectiveShop} from "../orders/shopAvailability.js";
test("availability requires Firebase, server activation, ownership, revision and confirmed persistence",async()=>{
 const verify=authAdmin.verifyIdToken,rpc=supabaseAdmin.rpc,old=process.env.MERCHANT_AVAILABILITY_WRITES_ENABLED;
 let calls=0,mode="ok";
 (authAdmin as any).verifyIdToken=async(token:string)=>{if(token==="expired")throw Error("expired");return {uid:token};};
 (supabaseAdmin as any).rpc=async(name:string,args:any)=>{calls++;assert.equal(name,"merchant_set_availability");assert.equal(args.p_uid,"merchant");
  if(args.p_shop_id!=="owned")return {error:{message:"FORBIDDEN"}};
  if(mode==="failure")return {error:{message:"offline"}};
  if(mode==="null")return {data:null,error:null};
  if(mode==="conflict")return {error:{message:"AVAILABILITY_CHANGED"}};
  if(mode==="confirm")return {error:{message:"OUTSIDE_HOURS_CONFIRMATION_REQUIRED"}};
  if(mode==="stale")return {data:{id:"owned",owner_id:"merchant",is_active:args.p_open,effective_is_active:args.p_open,availability_revision:args.p_expected_revision},error:null};
  return {data:{id:"owned",owner_id:"merchant",is_active:args.p_open,effective_is_active:args.p_open,availability_revision:1},error:null};};
 const app=express();app.use(express.json());app.use("/merchant",merchant);
 const server=app.listen(0,"127.0.0.1");await once(server,"listening");const base=`http://127.0.0.1:${(server.address() as any).port}/merchant/shop/availability`;
 const call=async(uid:string|undefined,body:any={shop_id:"owned",open:false,confirm_outside_hours:false,expected_revision:0})=>{const r=await fetch(base,{method:"PATCH",headers:{"content-type":"application/json",...(uid?{authorization:`Bearer fb-${uid}`}:{})},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
 try{
  process.env.MERCHANT_AVAILABILITY_WRITES_ENABLED="false";
  assert.equal((await call(undefined)).status,401);assert.equal((await call("expired")).status,401);
  assert.equal((await call("merchant")).body.code,"AVAILABILITY_WRITES_DISABLED");assert.equal(calls,0);
  process.env.MERCHANT_AVAILABILITY_WRITES_ENABLED="true";
  assert.equal((await call("merchant",{shop_id:"owned",open:true,confirm_outside_hours:false,expected_revision:-1})).status,400);assert.equal(calls,0);
  assert.equal((await call("merchant",{shop_id:"other",open:true,confirm_outside_hours:true,expected_revision:0})).status,403);
  mode="conflict";assert.equal((await call("merchant")).body.code,"AVAILABILITY_CHANGED");
  mode="confirm";assert.equal((await call("merchant")).body.code,"OUTSIDE_HOURS_CONFIRMATION_REQUIRED");
  mode="failure";const failed=await call("merchant");assert.equal(failed.status,503);assert.equal(failed.body.shop,undefined);
  mode="null";assert.equal((await call("merchant")).body.code,"AVAILABILITY_PERSISTENCE_UNCONFIRMED");
  mode="stale";assert.equal((await call("merchant")).body.code,"AVAILABILITY_PERSISTENCE_UNCONFIRMED");
  mode="ok";assert.equal((await call("merchant")).body.shop.is_active,false);
 }finally{authAdmin.verifyIdToken=verify;supabaseAdmin.rpc=rpc;if(old===undefined)delete process.env.MERCHANT_AVAILABILITY_WRITES_ENABLED;else process.env.MERCHANT_AVAILABILITY_WRITES_ENABLED=old;server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
test("all read paths trust the database calculation and fail closed on incomplete data",()=>{
 assert.equal(effectiveShop({is_active:true,effective_is_active:false,availability_revision:1}).is_active,false);
 assert.equal(effectiveShop({is_active:true,effective_is_active:true,availability_revision:1}).is_active,true);
 assert.throws(()=>effectiveShop({is_active:true}),/SCHEMA_UNAVAILABLE/);
 assert.throws(()=>effectiveShop({is_active:true,effective_is_active:true,availability_revision:null}),/SCHEMA_UNAVAILABLE/);
});

test("pickup payment settings require owner authentication, the write gate, and confirmed atomic persistence",async()=>{
 const authMock=authAdmin as unknown as {verifyIdToken:(token:string)=>Promise<{uid:string}>};
 const supabaseMock=supabaseAdmin as unknown as {rpc:(name:string,args:Record<string,unknown>)=>Promise<{data:unknown,error:{message:string}|null}>};
 const verify=authMock.verifyIdToken,rpc=supabaseMock.rpc,old=process.env.PICKUP_PAYMENT_SETTINGS_WRITES_ENABLED,oldOrderGate=process.env.PICKUP_WRITES_ENABLED;
 let calls=0,mode="ok";
 authMock.verifyIdToken=async(token:string)=>({uid:token});
 supabaseMock.rpc=async(name,args)=>{
  calls++;assert.equal(name,"merchant_set_pickup_payment_methods");
  if(args.p_uid!=="merchant")return {data:null,error:{message:"FORBIDDEN"}};
    if(mode==="conflict")return {data:null,error:{message:"PAYMENT_METHODS_CHANGED"}};
    if(mode==="failure")return {data:null,error:{message:"offline"}};
  return {data:{id:"owned",owner_id:"merchant",pickup_payment_methods:args.p_payment_methods},error:null};
 };
 const app=express();app.use(express.json());app.use("/merchant",merchant);
 const server=app.listen(0,"127.0.0.1");await once(server,"listening");
 const address=server.address();if(!address || typeof address==="string")throw Error("Server did not bind a TCP port.");
 const base=`http://127.0.0.1:${address.port}/merchant/shop/pickup-payment-methods`;
 const call=async(uid:string|undefined,body:unknown)=>{const response=await fetch(base,{method:"PATCH",headers:{"content-type":"application/json",...(uid?{authorization:`Bearer fb-${uid}`}:{})},body:JSON.stringify(body)});return {status:response.status,body:await response.json()};};
 try{
  const body={shop_id:"owned",pickup_payment_methods:["cash"],expected_payment_methods:null};
  process.env.PICKUP_WRITES_ENABLED="false";process.env.PICKUP_PAYMENT_SETTINGS_WRITES_ENABLED="false";
  assert.equal((await call(undefined,body)).status,401);
  assert.equal((await call("merchant",body)).body.code,"PICKUP_PAYMENT_SETTINGS_DISABLED");assert.equal(calls,0);
  process.env.PICKUP_PAYMENT_SETTINGS_WRITES_ENABLED="true";
  assert.equal((await call("merchant",{...body,pickup_payment_methods:["online"]})).status,400);assert.equal(calls,0);
  assert.equal((await call("other",body)).status,403);
  mode="conflict";assert.equal((await call("merchant",body)).status,409);
  mode="failure";assert.equal((await call("merchant",body)).status,503);
  mode="ok";
  for(const methods of [["cash"],["card_machine"],["cash","card_machine"]]){
   const saved=await call("merchant",{...body,pickup_payment_methods:methods});assert.equal(saved.status,200);assert.deepEqual(saved.body.shop.pickup_payment_methods,methods);
  }
 }finally{authMock.verifyIdToken=verify;supabaseMock.rpc=rpc;if(old===undefined)delete process.env.PICKUP_PAYMENT_SETTINGS_WRITES_ENABLED;else process.env.PICKUP_PAYMENT_SETTINGS_WRITES_ENABLED=old;if(oldOrderGate===undefined)delete process.env.PICKUP_WRITES_ENABLED;else process.env.PICKUP_WRITES_ENABLED=oldOrderGate;server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
