import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import {once} from "node:events";
import type {AddressInfo} from "node:net";
import app from "../server.js";
import {createApiAdmission,DEFAULT_LIMITS} from "./apiAdmission.js";
import {authenticateFirebase} from "./authenticateFirebase.js";
import {authAdmin} from "../lib/firebaseAdmin.js";

test("actual server exposes only Retry-After for admitted browser origin, retains denied-origin gate",async()=>{
 const server=app.listen(0,"127.0.0.1");await once(server,"listening");
 const url="http://127.0.0.1:"+(server.address() as AddressInfo).port;
 try{
  const origin="https://www.localeatssa.co.za";
  const allowed=await fetch(url+"/health",{headers:{Origin:origin}});
  assert.equal(allowed.status,200);
  assert.equal(allowed.headers.get("access-control-allow-origin"),origin);
  assert.equal(allowed.headers.get("access-control-expose-headers"),"Retry-After");
  const denied=await fetch(url+"/health",{headers:{Origin:"https://untrusted.example.invalid"}});
  assert.equal(denied.status,403);assert.equal(denied.headers.get("access-control-allow-origin"),null);
  const preflight=await fetch(url+"/api/v1/orders",{method:"OPTIONS",headers:{Origin:origin,"Access-Control-Request-Method":"POST","Access-Control-Request-Headers":"authorization,content-type"}});
  assert.equal(preflight.status,204);
  assert.equal(preflight.headers.get("access-control-allow-origin"),origin);
 }finally{server.close();await once(server,"close");}
});
test("provisional defaults admit a conservative single-window synthetic pilot schedule, not a capacity benchmark",async()=>{
 let verified=0,handled=0,time=0;const original=authAdmin.verifyIdToken;
 Object.assign(authAdmin,{verifyIdToken:async(token:string,revoked:boolean)=>{assert.equal(revoked,true);verified++;return {uid:token};}});
 const fixture=express();
 fixture.use(createApiAdmission({...DEFAULT_LIMITS},()=>time));
 const ok=(_req:express.Request,res:express.Response)=>{handled++;res.json({success:true});};
 fixture.get("/api/v1/catalog/shops",ok);fixture.get("/api/v1/catalog/shops/:id/menu",ok);
 for(const path of ["/api/v1/orders","/api/v1/notifications","/api/v1/merchant/orders","/api/v1/merchant/shop"])fixture.get(path,authenticateFirebase,ok);
 for(const path of ["/api/v1/orders","/api/v1/orders/quote","/api/v1/merchant/orders/:id/accept"])fixture.post(path,authenticateFirebase,ok);
 const server=fixture.listen(0,"127.0.0.1");await once(server,"listening");
 const url="http://127.0.0.1:"+(server.address() as AddressInfo).port;
 const call=async(path:string,uid?:string,method="GET")=>{
  const response=await fetch(url+path,{method,headers:uid?{Authorization:"Bearer fb-"+uid}:{}});
  assert.equal(response.status,200,path);await response.json();
 };
 try{
  // 25 customer + 25 merchant identities, four published shops, two simulated
  // minute windows. Calls are synthetic sequential HTTP; no real provider/data.
  for(let minute=0;minute<2;minute++){
   time=minute*60000;
   for(let i=0;i<25;i++){
    const c="customer-"+i,m="merchant-"+i;
    await call("/api/v1/catalog/shops");
    for(let shop=0;shop<4;shop++)await call("/api/v1/catalog/shops/"+shop+"/menu");
    for(let n=0;n<2;n++){await call("/api/v1/orders",c);await call("/api/v1/notifications",c);await call("/api/v1/merchant/shop",m);}
    for(let n=0;n<4;n++)await call("/api/v1/merchant/orders",m);
    await call("/api/v1/orders/quote",c,"POST");await call("/api/v1/orders",c,"POST");await call("/api/v1/merchant/orders/synthetic/accept",m,"POST");
   }
  }
  assert.equal(handled,900);assert.equal(verified,650);
  console.log("H3E_SYNTHETIC_ADMISSION_PASS requests=900 provider_mocks=650 windows=2");
 }finally{Object.assign(authAdmin,{verifyIdToken:original});server.close();await once(server,"close");}
});
