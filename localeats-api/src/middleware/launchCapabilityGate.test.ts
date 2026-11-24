import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import {once} from "node:events";
import type {AddressInfo} from "node:net";
import {readFileSync} from "node:fs";
import {previewReadOnlyGate} from "./previewReadOnlyGate.js";
import {pickupWriteGate} from "./pickupWriteGate.js";
import {legacyOrderGuard} from "../legacyOrderGuard.js";
import {launchCapabilityGate,assertDeliveryWritesEnabled} from "./launchCapabilityGate.js";
import app from "../server.js";
import {supabaseAdmin} from "../lib/supabaseAdmin.js";
import {authAdmin} from "../lib/firebaseAdmin.js";
const id="550e8400-e29b-41d4-a716-446655440000";
type Entry={method:string;path:string;cap:string;role:string};
const matrix:Entry[]=[];
function add(prefix:string,role:string,cap:string,method:string,...suffixes:string[]){
 for(const suffix of suffixes)matrix.push({method,path:prefix+suffix,cap,role});
}
add("/health","public","read","GET","","/launch-readiness");
add("/api/v1/catalog","public","read","GET","/pickup-shops","/shops","/shops/shop","/shops/shop/menu");
add("/api/v1/profiles","registered","read","GET","/me");
add("/api/v1/profiles","registered","profile","POST","/me");
add("/api/v1/merchant","owner","read","GET","/shop");
add("/api/v1/merchant","authenticated","onboard","POST","/shop");
add("/api/v1/merchant","owner","availability","PATCH","/shop/availability");
add("/api/v1/orders","customer","quote","POST","/quote");
add("/api/v1/orders","customer","pickup","POST","");
add("/api/v1/orders","customer","read","GET","","/history","/"+id);
add("/api/v1/orders","customer","shared","POST","/"+id+"/cancel");
add("/api/v1/merchant/orders","owner","read","GET","");
add("/api/v1/merchant/orders","owner","shared","POST","/"+id+"/accept","/"+id+"/ready");
add("/api/v1/merchant/orders","owner","pickup","POST","/"+id+"/reject","/"+id+"/payment-confirmation","/"+id+"/collect");
add("/api/v1","authenticated","side-effect-read","GET","/notifications");
add("/api/v1","authenticated","push","PUT","/push-subscriptions/"+id);
add("/api/v1","authenticated","push","DELETE","/push-subscriptions/"+id);
add("/api/v1","owner","push","POST","/push-subscriptions/"+id+"/test");
add("/api/v1/admin","super-admin","read","GET","/me","/shops","/shops/shop");
add("/api/v1/admin","super-admin","approval","POST","/shops/shop/approval");
add("/api/v1/admin/riders","super-admin","read","GET","","/"+id);
add("/api/v1/admin/riders","super-admin","verification","PATCH","/"+id+"/verification");
add("/api/v1/rider/orders","rider","read","GET","/mine","/available","/"+id);
add("/api/v1/rider/orders","rider","delivery","POST","/"+id+"/claim","/"+id+"/picked-up","/"+id+"/delivering","/"+id+"/delivered");
add("/api/v1/rider","rider","delivery","POST","/profile","/connections/request");
add("/api/v1/rider","rider","read","GET","/profile","/connections");
add("/api/v1/rider","rider","delivery","PATCH","/availability");
add("/api/v1/merchant/riders","owner","delivery","POST","/pairing-code");
add("/api/v1/merchant/riders","owner","read","GET","/pairing-code","/connections");
add("/api/v1/merchant/riders","owner","delivery","PATCH","/connections/"+id);
const envKeys=["PICKUP_WRITES_ENABLED","DELIVERY_WRITES_ENABLED","VERCEL_ENV","LOCALEATS_PREVIEW_READ_ONLY","PICKUP_TEST_CUSTOMER_UID"];
function withEnv(){
 const saved=Object.fromEntries(envKeys.map(k=>[k,process.env[k]]));
 return ()=>{for(const k of envKeys){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}};
}
async function listen(target:express.Express){
 const server=target.listen(0,"127.0.0.1");await once(server,"listening");
 return {base:"http://127.0.0.1:"+(server.address() as AddressInfo).port,close:async()=>{server.close();server.closeAllConnections();await once(server,"close");}};
}
const mut=(m:string)=>["POST","PUT","PATCH","DELETE"].includes(m);
test("50 explicit route operations: four capability modes, no permission granted by policy alone",async()=>{
 assert.equal(matrix.length,50);
 assert.equal(new Set(matrix.map(x=>x.method+" "+x.path)).size,50);
 const restore=withEnv(),fixture=express();let reached=0;
 fixture.use(previewReadOnlyGate);fixture.use(legacyOrderGuard);fixture.use(pickupWriteGate);fixture.use(launchCapabilityGate);
 fixture.use((_req,res)=>{reached++;res.status(204).end();});
 const local=await listen(fixture);
 try{
  for(const mode of ["off","pickup","preview","delivery"]){
   process.env.PICKUP_WRITES_ENABLED=mode==="pickup"||mode==="preview"?"true":"false";
   process.env.DELIVERY_WRITES_ENABLED=mode==="delivery"||mode==="preview"?"true":"false";
   process.env.VERCEL_ENV=mode==="preview"?"preview":"production";
   delete process.env.LOCALEATS_PREVIEW_READ_ONLY;
   for(const entry of matrix){
    const blocked=mode==="preview"?(mut(entry.method)||entry.cap==="side-effect-read"):
     entry.cap==="delivery"?mode!=="delivery":
     entry.cap==="pickup"?mode!=="pickup":
     entry.cap==="shared"?mode==="off":false;
    const before=reached;
    const response=await fetch(local.base+entry.path,{method:entry.method});
    assert.equal(response.status,blocked?503:204,mode+" "+entry.method+" "+entry.path+" "+entry.role);
    assert.equal(reached-before,blocked?0:1);
    if(blocked)assert.equal(response.headers.get("cache-control"),"no-store");
    await response.arrayBuffer();
   }
  }
  console.log("H2B_MATRIX operations=50 modes=4 decisions=200");
 }finally{restore();await local.close();}
});
test("actual mounted app denies deferred mutations and preview side effects before auth, DB, RPC",async()=>{
 const restore=withEnv(),oldFrom=supabaseAdmin.from,oldRpc=supabaseAdmin.rpc,oldVerify=authAdmin.verifyIdToken;
 let calls=0;
 const forbidden=()=>{calls++;throw Error("Forbidden provider access");};
 Object.assign(supabaseAdmin,{from:forbidden,rpc:forbidden});Object.assign(authAdmin,{verifyIdToken:forbidden});
 const local=await listen(app);
 try{
  process.env.VERCEL_ENV="production";delete process.env.LOCALEATS_PREVIEW_READ_ONLY;
  for(const flag of [undefined,"false","TRUE","1"]){
   if(flag===undefined)delete process.env.DELIVERY_WRITES_ENABLED;else process.env.DELIVERY_WRITES_ENABLED=flag;
   assert.throws(assertDeliveryWritesEnabled);
   for(const pickup of ["false","true"]){
    process.env.PICKUP_WRITES_ENABLED=pickup;
    for(const e of matrix.filter(x=>x.cap==="delivery"||(pickup==="false"&&["shared","pickup"].includes(x.cap)))){
     for(const path of [e.path,e.path.toUpperCase()+"/"]){
      const response=await fetch(local.base+path+"?fixture=1",{method:e.method,headers:{authorization:"Bearer fb-synthetic"}});
      assert.equal(response.status,503,e.method+" "+path);
      assert.equal(response.headers.get("cache-control"),"no-store");
      await response.arrayBuffer();
     }
    }
   }
  }
  process.env.LOCALEATS_PREVIEW_READ_ONLY="true";process.env.DELIVERY_WRITES_ENABLED="true";process.env.PICKUP_WRITES_ENABLED="true";
  for(const e of matrix.filter(x=>mut(x.method)||x.cap==="side-effect-read")){
   const r=await fetch(local.base+e.path,{method:e.method,headers:{authorization:"Bearer fb-synthetic"}});
   assert.equal(r.status,503,e.path);assert.equal((await r.json()).code,"PREVIEW_READ_ONLY");
  }
  for(const method of ["GET","HEAD"])for(const path of ["/api/v1/NOTIFICATIONS/","/API/V1/Notifications"]){
   const r=await fetch(local.base+path,{method,headers:{authorization:"Bearer fb-synthetic"}});
   assert.equal(r.status,503);await r.arrayBuffer();
  }
  assert.equal(calls,0);
  console.log("H2B_MOUNTED_DENIALS provider_calls=0");
 }finally{restore();supabaseAdmin.from=oldFrom;supabaseAdmin.rpc=oldRpc;authAdmin.verifyIdToken=oldVerify;await local.close();}
});
test("pickup enabled does not permit legacy nonpickup transitions; anonymous create denied before DB",async()=>{
 const restore=withEnv(),oldFrom=supabaseAdmin.from,oldRpc=supabaseAdmin.rpc,oldVerify=authAdmin.verifyIdToken;
 let reads=0,writes=0;
 Object.assign(authAdmin,{verifyIdToken:async(token:string)=>({uid:token,firebase:{sign_in_provider:token==="anonymous"?"anonymous":"password"}})});
 Object.assign(supabaseAdmin,{rpc:()=>{writes++;throw Error("Unexpected RPC");},from:(table:string)=>{
  reads++;
  const result={data:table==="shops"?{id:"shop",owner_id:"merchant"}:{id,shop_id:"shop",user_id:"customer",delivery_type:"delivery",status:"pending",delivery_status:"none",rider_id:null},error:null};
  const q={select(){return this;},eq(){return this;},maybeSingle:async()=>result,update(){writes++;throw Error("Unexpected update");}};
  return q;
 }});
 const local=await listen(app);
 try{
  process.env.VERCEL_ENV="production";delete process.env.LOCALEATS_PREVIEW_READ_ONLY;process.env.PICKUP_WRITES_ENABLED="true";process.env.DELIVERY_WRITES_ENABLED="false";process.env.PICKUP_TEST_CUSTOMER_UID="anonymous";
  const anon=await fetch(local.base+"/api/v1/orders",{method:"POST",headers:{authorization:"Bearer fb-anonymous","content-type":"application/json"},body:"{}"});
  assert.equal(anon.status,403);assert.equal((await anon.json()).code,"REGISTERED_ACCOUNT_REQUIRED");assert.equal(reads,0);
  for(const [path,uid] of [["/api/v1/orders/"+id+"/cancel","customer"],["/api/v1/merchant/orders/"+id+"/accept","merchant"],["/api/v1/merchant/orders/"+id+"/ready","merchant"]]){
   const r=await fetch(local.base+path,{method:"POST",headers:{authorization:"Bearer fb-"+uid,"content-type":"application/json"},body:"{}"});
   assert.equal(r.status,503);assert.equal((await r.json()).code,"DELIVERY_WRITES_DISABLED");
  }
  assert.equal(reads,5);assert.equal(writes,0);
  console.log("H2B_LEGACY_DENIALS scoped_reads=5 mutation_calls=0");
 }finally{restore();supabaseAdmin.from=oldFrom;supabaseAdmin.rpc=oldRpc;authAdmin.verifyIdToken=oldVerify;await local.close();}
});
test("capability gate mounted before body parser and all routes; role gates remain",()=>{
 const src=readFileSync("src/server.ts","utf8");
 assert.ok(src.indexOf("app.use(launchCapabilityGate);")>src.indexOf("app.use(pickupWriteGate);"));
 assert.ok(src.indexOf("app.use(launchCapabilityGate);")<src.indexOf("app.use(express.json("));
 assert.match(src,/app\.use\(previewReadOnlyGate\);/);
 assert.match(readFileSync("src/routes/admin.ts","utf8"),/authenticateAdminFirebase,\s*authorizeSuperAdmin/);
 assert.match(readFileSync("src/routes/customerProfiles.ts","utf8"),/REGISTERED_ACCOUNT_REQUIRED/);
});
