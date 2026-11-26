import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import {once} from "node:events";
import type {AddressInfo} from "node:net";
import {authAdmin} from "../lib/firebaseAdmin.js";
import {supabaseAdmin} from "../lib/supabaseAdmin.js";
import merchantRouter from "./merchant.js";

const valid={
 name:"Vendor Kota",category:"Kota / Street Food",description:"Fresh food",
 phone:"0821234567",location:"Ivory Park, Tembisa",latitude:-26.006,longitude:28.223,
 opening_time:"08:00",closing_time:"22:00",
 logo_url:"https://res.cloudinary.com/localeats-demo/image/upload/v1/synthetic.png",
 story:"Neighbourhood food",
};
type Mode="normal"|"existing"|"corrupt"|"missing"|"blank"|"archived";
test("merchant signup is server-owned, pending and inactive; invalid, duplicate and anonymous submissions fail closed",async()=>{
 const originalVerify=authAdmin.verifyIdToken, originalFrom=supabaseAdmin.from;
 let mode:Mode="normal";
 const inserts:Array<Record<string,unknown>>=[];
 const lookupFields:Array<[string,unknown]>=[];
 Object.assign(authAdmin,{verifyIdToken:async (token:string,revoked:boolean)=>{assert.equal(revoked,true);return ({
  uid:token,email:token+"@example.test",
  firebase:{sign_in_provider:token==="anonymous"?"anonymous":"password"},
 });}});
 Object.assign(supabaseAdmin,{from:(table:string)=>{
  assert.equal(table,"shops");
  let inserted:Record<string,unknown>|null=null;
  const q={
   select:()=>q,
   eq:(field:string,value:unknown)=>{lookupFields.push([field,value]);return q;},
   is:()=>q,
   limit:()=>q,
   insert:(record:Record<string,unknown>)=>{inserted=record;inserts.push(record);return q;},
   single:async()=>{
    assert.ok(inserted);
    const row:Record<string,unknown>={id:"synthetic-created-shop",...inserted};
    if(mode==="corrupt"){row.owner_id="another-merchant";row.approval_status="approved";row.is_active=true;}
    if(mode==="missing")return {data:null,error:null};
    if(mode==="blank")row.id="   ";
    if(mode==="archived")row.archived_at="2026-11-25T00:00:00Z";
    return {data:row,error:null};
   },
   then:(resolve:(value:{data:{id:string}[];error:null})=>unknown,reject:(error:unknown)=>unknown)=>
    Promise.resolve({data:mode==="existing"?[{id:"already-owned"}]:[],error:null}).then(resolve,reject)
  };
  return q;
 }});
 const app=express();app.use(express.json());app.use("/api/v1/merchant",merchantRouter);
 const server=app.listen(0,"127.0.0.1");await once(server,"listening");
 const url="http://127.0.0.1:"+(server.address() as AddressInfo).port+"/api/v1/merchant/shop";
 const call=async(uid:string|null,body:unknown)=>{
  const response=await fetch(url,{method:"POST",headers:{
   "content-type":"application/json",
   ...(uid?{authorization:"Bearer fb-"+uid}:{})
  },body:JSON.stringify(body)});
  return {status:response.status,body:await response.json() as Record<string,unknown>};
 };
 try{
  const created=await call("vendor-uid",valid);
  assert.equal(created.status,201);
  assert.equal(created.body.success,true);
  const shop=created.body.shop as Record<string,unknown>;
  assert.equal(shop.id,"synthetic-created-shop");
  assert.equal(shop.owner_id,"vendor-uid");
  assert.equal(shop.approval_status,"pending");
  assert.equal(shop.is_active,false);
  assert.equal(shop.archived_at,null);
  assert.equal(shop.latitude,valid.latitude);
  assert.equal(shop.longitude,valid.longitude);
  assert.equal(shop.lat,valid.latitude);
  assert.equal(shop.lng,valid.longitude);
  assert.ok(lookupFields.some(([field,value])=>field==="owner_id"&&value==="vendor-uid"));
  assert.equal(inserts.length,1);

  for(const injection of [
   {owner_id:"attacker"},{approval_status:"approved"},{is_active:true},
   {role:"merchant_admin"},{shop_id:"foreign"},
   {latitude:Infinity},{longitude:181},{opening_time:"25:70"},
   {logo_url:"http://res.cloudinary.com/unsecured.png"},
   {logo_url:"https://evil.example/path"},
  ]){
   const invalid=await call("vendor-uid",{...valid,...injection});
   assert.equal(invalid.status,400,JSON.stringify(injection));
  }
  assert.equal(inserts.length,1);

  const noAuth=await call(null,valid);
  assert.equal(noAuth.status,401);
  assert.equal((await call("anonymous",valid)).status,401);
  assert.equal(inserts.length,1);

  mode="existing";
  assert.equal((await call("vendor-uid",valid)).status,409);
  assert.equal(inserts.length,1);

  mode="corrupt";
  const tampered=await call("vendor-uid",valid);
  assert.equal(tampered.status,503);
  assert.equal(tampered.body.code,"MERCHANT_SHOP_CREATE_UNCONFIRMED");
  assert.notEqual(tampered.body.success,true);
  for(const fault of ["missing","blank","archived"] as const){mode=fault;const result=await call("vendor-uid",valid);assert.equal(result.status,503);assert.equal(result.body.code,"MERCHANT_SHOP_CREATE_UNCONFIRMED");assert.notEqual(result.body.success,true);}
  assert.equal(inserts.length,5,"one attempt per explicit request; no automatic replay");
 }finally{
  Object.assign(authAdmin,{verifyIdToken:originalVerify});
  Object.assign(supabaseAdmin,{from:originalFrom});
  server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));
 }
});
