import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import {once} from "node:events";
import type {AddressInfo} from "node:net";
import {gzipSync} from "node:zlib";
import {createApiAdmission,createWindowBudget,DEFAULT_LIMITS,safeApiError} from "./apiAdmission.js";
import {authenticateFirebase,getFirebaseBearerToken} from "./authenticateFirebase.js";
import {authenticateAdminFirebase} from "./authenticateAdminFirebase.js";
import {authAdmin} from "../lib/firebaseAdmin.js";
test("bounded budget never evicts active actors; expires and recovers",()=>{
 let time=0;const budget=createWindowBudget(2,60000,()=>time);
 assert.equal(budget.take("a",1).allowed,true);assert.equal(budget.take("b",1).allowed,true);
 assert.equal(budget.take("c",1).allowed,false);assert.equal(budget.size(),2);
 assert.deepEqual(budget.take("a",1),{allowed:false,retryAfter:60});
 time=59999;assert.equal(budget.take("a",1).retryAfter,1);
 time=60000;assert.equal(budget.take("c",1).allowed,true);assert.equal(budget.size(),1);
});
test("mounted admission limits verified identities and expensive routes, not caller headers or paths",async()=>{
 let time=0,verifications=0,downstream=0;
 const original=authAdmin.verifyIdToken;
 Object.assign(authAdmin,{verifyIdToken:async(token:string,revoked:boolean)=>{
  verifications++;assert.equal(revoked,true);
  if(token==="bad")throw Error("SYNTHETIC_SECRET_PROVIDER");
  return {uid:token==="alias"?"alice":token};
 }});
 const app=express();
 app.use(createApiAdmission({...DEFAULT_LIMITS,all:100,auth:16,read:2,write:2,quote:2,notifications:1,pushTest:1},()=>time));
 app.use(express.json({limit:"100kb",inflate:false}));
 const ok=(_req:express.Request,res:express.Response)=>{downstream++;res.json({success:true});};
 app.get("/api/v1/merchant/orders",authenticateFirebase,ok);
 app.post("/api/v1/orders/quote",authenticateFirebase,ok);
 app.get("/api/v1/notifications",authenticateFirebase,ok);
 app.post("/api/v1/push-subscriptions/:id/test",authenticateFirebase,ok);
 app.post("/api/v1/orders",authenticateFirebase,ok);
 app.get("/api/v1/admin/shops",authenticateAdminFirebase,ok);
 app.use(safeApiError);
 const server=app.listen(0,"127.0.0.1");await once(server,"listening");
 const base="http://127.0.0.1:"+(server.address() as AddressInfo).port;
 const call=(p:string,token:string,method="GET",ip="1.2.3.4")=>fetch(base+p,{method,headers:{Authorization:"Bearer fb-"+token,"X-Forwarded-For":ip,...(method==="POST"?{"Content-Type":"application/json"}:{})},...(method==="POST"?{body:"{}"}:{})});
 try{
  assert.equal((await call("/api/v1/merchant/orders","alice")).status,200);
  assert.equal((await call("/api/v1/admin/shops","alias")).status,200);
  const denial=await call("/api/v1/merchant/orders?x=2","alice","GET","5.6.7.8");
  assert.equal(denial.status,429);assert.equal(denial.headers.get("retry-after"),"60");assert.equal(denial.headers.get("cache-control"),"no-store");
  assert.equal((await denial.json()).code,"RATE_LIMITED");assert.equal(downstream,2);
  assert.equal((await call("/api/v1/merchant/orders","bob")).status,200);
  assert.equal((await call("/api/v1/notifications","alice")).status,200);
  assert.equal((await call("/API/V1/NOTIFICATIONS/?x=1","alias","HEAD")).status,429);
  for(const id of ["a","b"])assert.equal((await call("/api/v1/push-subscriptions/"+id+"/test","alice","POST")).status,id==="a"?200:429);
  for(let i=0;i<3;i++)assert.equal((await call("/api/v1/orders/quote","alice","POST")).status,i<2?200:429);
  for(let i=0;i<3;i++)assert.equal((await call("/api/v1/orders","alice","POST")).status,i<2?200:429);
  for(let i=0;i<2;i++)assert.equal((await call("/api/v1/merchant/orders","bad")).status,401);
  assert.equal(verifications,16);
  assert.equal((await call("/api/v1/merchant/orders","charlie")).status,429);assert.equal(verifications,16);
  time=60000;assert.equal((await call("/api/v1/merchant/orders","alice")).status,200);
 }finally{Object.assign(authAdmin,{verifyIdToken:original});server.close();await once(server,"close");}
});
test("global request budget applies before provider/body; no parser or secret echoes",async()=>{
 const app=express();app.use(createApiAdmission({...DEFAULT_LIMITS,all:5}));app.use(express.json({limit:"100kb",inflate:false}));
 app.post("/echo",(_req,res)=>res.json({ok:true}));app.get("/fail",(_req,_res,next)=>next(Error("SYNTHETIC_PRIVATE_KEY")));
 app.use(safeApiError);
 const server=app.listen(0,"127.0.0.1");await once(server,"listening");const base="http://127.0.0.1:"+(server.address() as AddressInfo).port;
 try{
  const bad=await fetch(base+"/echo",{method:"POST",headers:{"Content-Type":"application/json"},body:"SYNTHETIC_SECRET"});
  assert.equal(bad.status,400);assert.doesNotMatch(await bad.text(),/SYNTHETIC_SECRET/);
  assert.equal((await fetch(base+"/echo",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({x:"x".repeat(103000)})})).status,413);
  assert.equal((await fetch(base+"/echo",{method:"POST",headers:{"Content-Type":"application/json","Content-Encoding":"gzip"},body:new Uint8Array(gzipSync("{}"))})).status,415);
  const fail=await fetch(base+"/fail");assert.equal(fail.status,500);assert.doesNotMatch(await fail.text(),/SYNTHETIC_PRIVATE_KEY/);
  assert.equal((await fetch(base+"/echo",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"})).status,200);
  assert.equal((await fetch(base+"/echo",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"})).status,429);
  assert.equal(getFirebaseBearerToken("Bearer fb-"+"x".repeat(8193)),null);
 }finally{server.close();await once(server,"close");}
});
