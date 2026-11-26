import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import {once} from "node:events";
import type {AddressInfo} from "node:net";
import {authAdmin} from "../lib/firebaseAdmin.js";
import {supabaseAdmin} from "../lib/supabaseAdmin.js";
import merchantRouter from "./merchant.js";

test("owned shop GET uses base-table owner proof, not the staging public view's absent owner_id",async()=>{
 const originalVerify=authAdmin.verifyIdToken,originalFrom=supabaseAdmin.from;
 let ownedMode:"one"|"none"|"many"="one",wrongView=false,transfer=false,revoked=false,reads=0;
 const checks:Array<{table:string;filter:string;value:unknown}>=[];
 Object.assign(authAdmin,{verifyIdToken:async(token:string,checkRevoked:boolean)=>{assert.equal(checkRevoked,true);if(revoked)throw Error("revoked");return {uid:token,firebase:{sign_in_provider:token==="anonymous"?"anonymous":"password"}};}});
 Object.assign(supabaseAdmin,{from:(table:string)=>{
  const filters:Array<[string,unknown]>=[];
  const result=()=>{
   if(table==="shops"){
    reads++;
    const uid=filters.find(x=>x[0]==="owner_id")?.[1];
    if(uid!=="merchant"||ownedMode==="none"||(transfer&&reads===2))return {data:[],error:null};
    if(ownedMode==="many")return {data:[{id:"shop-A"},{id:"shop-B"}],error:null};
    return {data:[{id:"shop-A",owner_id:"merchant",archived_at:null,approval_status:"approved",availability_revision:1,is_active:false,phone:"fixture-private"}],error:null};
   }
   return {data:wrongView?{id:"another-shop",is_active:true,effective_is_active:true,availability_revision:1}:
    {id:"shop-A",name:"Shop A",archived_at:null,approval_status:"approved",is_active:false,effective_is_active:false,availability_revision:1,private_secret:"not-returned"},error:null};
  };
  const query={
   select:()=>query,
   eq:(field:string,value:unknown)=>{
    if(table==="shops_with_availability"&&field==="owner_id")throw Error("Staging view does not expose owner_id");
    filters.push([field,value]);checks.push({table,filter:field,value});return query;
   },
   is:(field:string,value:unknown)=>{filters.push([field,value]);return query;},
   limit:()=>query,
   maybeSingle:async()=>result(),
   then:(resolve:(value:ReturnType<typeof result>)=>unknown)=>Promise.resolve(result()).then(resolve),
  };
  return query;
 }});
 const app=express();app.use("/merchant",merchantRouter);
 const server=app.listen(0,"127.0.0.1");await once(server,"listening");
 const base="http://127.0.0.1:"+(server.address() as AddressInfo).port+"/merchant/shop";
 const call=async(uid:string)=>{const r=await fetch(base,{headers:{authorization:"Bearer fb-"+uid}});return {status:r.status,cache:r.headers.get("cache-control"),body:await r.json() as Record<string,unknown>};};
 try{
  const ok=await call("merchant");
  assert.equal(ok.status,200);assert.equal(ok.cache,"no-store");
  assert.equal((ok.body.shop as Record<string,unknown>).owner_id,"merchant");
  assert.equal((ok.body.shop as Record<string,unknown>).is_active,false);
  assert.ok(checks.some(x=>x.table==="shops"&&x.filter==="owner_id"&&x.value==="merchant"));
  assert.ok(checks.some(x=>x.table==="shops_with_availability"&&x.filter==="id"&&x.value==="shop-A"));
  assert.equal(checks.some(x=>x.table==="shops_with_availability"&&x.filter==="owner_id"),false);
  assert.equal((await call("another-user")).status,404);
  ownedMode="many";assert.equal((await call("merchant")).status,409);
  ownedMode="none";assert.equal((await call("merchant")).status,404);
  ownedMode="one";wrongView=true;assert.equal((await call("merchant")).status,503);
  wrongView=false;reads=0;transfer=true;const changed=await call("merchant");assert.equal(changed.status,503);assert.equal(changed.body.shop,undefined);assert.equal(reads,2);
  transfer=false;revoked=true;reads=0;assert.equal((await call("merchant")).status,401);assert.equal(reads,0);
  revoked=false;assert.equal((await call("anonymous")).status,401);assert.equal(reads,0);
  assert.equal((ok.body.shop as Record<string,unknown>).private_secret,undefined);
  assert.equal((ok.body.shop as Record<string,unknown>).phone,"fixture-private");
 }finally{
  Object.assign(authAdmin,{verifyIdToken:originalVerify});
  Object.assign(supabaseAdmin,{from:originalFrom});
  server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));
 }
});
