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
  mode="ok";assert.equal((await call("merchant")).body.shop.is_active,false);
 }finally{authAdmin.verifyIdToken=verify;supabaseAdmin.rpc=rpc;if(old===undefined)delete process.env.MERCHANT_AVAILABILITY_WRITES_ENABLED;else process.env.MERCHANT_AVAILABILITY_WRITES_ENABLED=old;server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
test("all read paths trust the database calculation and fail closed on incomplete data",()=>{
 assert.equal(effectiveShop({is_active:true,effective_is_active:false,availability_revision:1}).is_active,false);
 assert.equal(effectiveShop({is_active:true,effective_is_active:true,availability_revision:1}).is_active,true);
 assert.throws(()=>effectiveShop({is_active:true}),/SCHEMA_UNAVAILABLE/);
 assert.throws(()=>effectiveShop({is_active:true,effective_is_active:true,availability_revision:null}),/SCHEMA_UNAVAILABLE/);
});
