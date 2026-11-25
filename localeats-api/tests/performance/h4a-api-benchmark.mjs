// Loopback-only benchmark, synthetic database adapter. No hosted service calls.
import assert from "node:assert/strict";
import express from "express";
import {once} from "node:events";
import {performance,monitorEventLoopDelay} from "node:perf_hooks";
import {makeCatalogRouter} from "../../dist/routes/catalog.js";
import {createApiAdmission} from "../../dist/middleware/apiAdmission.js";
import {authenticateFirebase} from "../../dist/middleware/authenticateFirebase.js";
import {authAdmin} from "../../dist/lib/firebaseAdmin.js";
const stats=(values)=>{const a=[...values].sort((x,y)=>x-y);return {count:a.length,p50_ms:+a[Math.ceil(a.length*.5)-1].toFixed(3),p95_ms:+a[Math.ceil(a.length*.95)-1].toFixed(3),max_ms:+a.at(-1).toFixed(3)};};
const shops=Array.from({length:100},(_,i)=>({id:"shop-"+i,name:"Synthetic shop "+i,is_active:true,lat:-26,lng:28,story:"Synthetic description"}));
const menus=Array.from({length:20},(_,i)=>({id:"menu-"+i,name:"Synthetic meal",price:25,is_available:true,description:"Synthetic item"}));
let dbCalls=0,authCalls=0;const original=authAdmin.verifyIdToken;
Object.assign(authAdmin,{verifyIdToken:async(token,checkRevoked)=>{assert.equal(checkRevoked,true);authCalls++;return {uid:token};}});
const app=express();app.use(createApiAdmission());
app.get("/health",(_req,res)=>res.json({status:"ok"}));
app.use("/api/v1/catalog",makeCatalogRouter({
 getApprovedShops:async()=>{dbCalls++;return shops;},
 getApprovedShopById:async id=>{dbCalls++;return shops.find(s=>s.id===id)||null;},
 getMenuByShopId:async id=>{dbCalls++;return menus.map(row=>({...row,shop_id:id}));}
},null));
app.get("/api/v1/protected-fixture",authenticateFirebase,(_req,res)=>res.json({success:true}));
const server=app.listen(0,"127.0.0.1");await once(server,"listening");
const base="http://127.0.0.1:"+server.address().port;
const delay=monitorEventLoopDelay({resolution:10});delay.enable();
try{
 const cases=[["health","/health"],["catalog_100","/api/v1/catalog/shops"],["menu_20","/api/v1/catalog/shops/shop-7/menu"],["auth_mock","/api/v1/protected-fixture"]];
 for(const [name,path] of cases){
  const times=[];let bytes=0;
  const one=async i=>{const start=performance.now();const res=await fetch(base+path,{headers:{"Authorization":"Bearer fb-bench-"+(i%10)}});assert.equal(res.status,200);const body=await res.arrayBuffer();bytes=body.byteLength;return performance.now()-start;};
  for(let i=0;i<10;i++)await one(i);
  const before=dbCalls,authBefore=authCalls,started=performance.now();
  for(let i=0;i<100;i+=5)times.push(...await Promise.all(Array.from({length:5},(_,j)=>one(i+j))));
  console.log("H4A_API "+JSON.stringify({name,...stats(times),concurrency:5,elapsed_ms:+(performance.now()-started).toFixed(1),response_bytes:bytes,repository_calls:dbCalls-before,auth_mocks:authCalls-authBefore}));
 }
 console.log("H4A_API_MEMORY "+JSON.stringify({rss_bytes:process.memoryUsage().rss,heap_used_bytes:process.memoryUsage().heapUsed,event_loop_p95_ms:+(delay.percentile(95)/1e6).toFixed(3)}));
}finally{delay.disable();Object.assign(authAdmin,{verifyIdToken:original});server.close();await once(server,"close");}
