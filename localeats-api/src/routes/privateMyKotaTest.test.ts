import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import {makePrivateMyKotaRouter,privateMyKotaConfig,privateMyKotaCorsAllowed,
  PRIVATE_MY_KOTA_SHOP_ID} from "./privateMyKotaTest.js";
import {isAllowedOrigin} from "../corsOrigins.js";

const now=Date.UTC(2026,10,18,12);
const origin="https://localeats-customer-staging-r52d-fixture.vercel.app";
const uid="test_uid_private_mykota_0123456789";
const good={
 VERCEL_ENV:"preview",LOCALEATS_STAGING_ONLY:"true",PICKUP_WRITES_ENABLED:"false",
 SUPABASE_URL:"https://rgpbdajhlrwfmhopzgzk.supabase.co",
 FIREBASE_PROJECT_ID:"localeats-staging",PRIVATE_MYKOTA_TEST_ENABLED:"true",
 PRIVATE_MYKOTA_TEST_UID:uid,PRIVATE_MYKOTA_TEST_ORIGIN:origin,
 PRIVATE_MYKOTA_TEST_EXPIRES_AT:"2026-11-28T00:00:00.000Z"
};
type FixtureEnv=typeof good;
async function serve(env:FixtureEnv,fn:(base:string)=>Promise<void>){
 const app=express();
 const mockVerify=async(token:string)=>({
   uid:token==="owner"?uid:"wrong_customer_uid_0123456789",
   firebase:{sign_in_provider:token==="anonymous"?"anonymous":"password"}
 });
 app.use("/api/v1/private-test/my-kota",makePrivateMyKotaRouter(mockVerify,env,()=>now));
 const server=http.createServer(app);
 await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
 try {
   const address=server.address();
   if(!address||typeof address==="string")throw Error("No server address");
   await fn("http://127.0.0.1:"+address.port);
 }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
}
const request=(base:string,path:string,token="owner",reqOrigin=origin,method="GET")=>
  fetch(base+"/api/v1/private-test/my-kota"+path,{method,headers:{
    Origin:reqOrigin,Authorization:"Bearer fb-"+token
  }});

test("disabled by default and fails closed on Firebase, DB, Vercel and expiry mismatch",()=>{
 assert.equal(privateMyKotaConfig({}).enabled,false);
 assert.equal(privateMyKotaConfig(good,now).enabled,true);
 const bad=[
  {VERCEL_ENV:"production"},{LOCALEATS_STAGING_ONLY:"false"},
  {PICKUP_WRITES_ENABLED:"true"},{SUPABASE_URL:"https://phdjumtqkooyppxozqsi.supabase.co"},
  {FIREBASE_PROJECT_ID:"localeats-5e26e"},{PRIVATE_MYKOTA_TEST_ENABLED:"false"},
  {PRIVATE_MYKOTA_TEST_UID:""},{PRIVATE_MYKOTA_TEST_UID:"not_enough"},
  {PRIVATE_MYKOTA_TEST_ORIGIN:"https://localeatssa.co.za"},
  {PRIVATE_MYKOTA_TEST_ORIGIN:"https://arbitrary-test.vercel.app"},
  {PRIVATE_MYKOTA_TEST_ORIGIN:"https://localeats-customer-staging-r52d-fixture.vercel.app.evil.example"},
  {PRIVATE_MYKOTA_TEST_EXPIRES_AT:"2026-11-01T00:00:00Z"},
  {PRIVATE_MYKOTA_TEST_EXPIRES_AT:"2027-01-01T00:00:00Z"}
 ];
 for(const override of bad)assert.equal(privateMyKotaConfig({...good,...override},now).enabled,false,JSON.stringify(override));
});
test("only configured private Customer origin qualifies; no wildcard and no general CORS change",()=>{
 assert.equal(privateMyKotaCorsAllowed(origin,good),true);
 assert.equal(privateMyKotaCorsAllowed("https://other.vercel.app",good),false);
 assert.equal(privateMyKotaCorsAllowed(origin,{...good,PRIVATE_MYKOTA_TEST_ENABLED:"false"}),false);
 // isAllowedOrigin uses Date.now; test with a future expiry relative to this test run.
 const live={...good,CUSTOMER_APP_ORIGIN:"",PRIVATE_MYKOTA_TEST_EXPIRES_AT:new Date(Date.now()+24*3600000).toISOString()};
 assert.equal(isAllowedOrigin(origin,live),true);
 assert.equal(isAllowedOrigin("https://other-private-preview.vercel.app",live),false);
});
test("approved Firebase UID sees only sample shop and sample menu in private no-store response",async()=>{
 await serve(good,async base=>{
  const status=await request(base,"/status");
  assert.equal(status.status,200);
  assert.equal((await status.json()).eligible,true);
  const res=await request(base,"/shop?mode=simulated");
  assert.equal(res.status,200);
  assert.match(res.headers.get("cache-control")||"",/no-store/);
  assert.match(res.headers.get("vary")||"",/Authorization/);
  const payload=await res.json();
  assert.equal(payload.shop.id,PRIVATE_MY_KOTA_SHOP_ID);
  assert.match(payload.shop.name,/TEST/);
  assert.ok(payload.shop.distance_km<=4);
  assert.equal(payload.simulated_location,true);
  assert.equal(payload.can_submit,false);
  assert.equal(payload.preview_only,true);
  assert.equal(payload.menu_items.length,2);
  assert.ok(payload.menu_items.every((x:any)=>/SAMPLE/.test(x.name)&&x.test_only===true));
 });
});
test("unknown, anonymous, unsigned, wrong-origin accounts never receive fixture or menu",async()=>{
 await serve(good,async base=>{
  const attempts=[
    await request(base,"/status","different-user"),
    await request(base,"/shop?mode=simulated","different-user"),
    await request(base,"/shop?mode=simulated","anonymous"),
    await request(base,"/shop?mode=simulated","owner","https://other-preview.vercel.app"),
    await fetch(base+"/api/v1/private-test/my-kota/shop?mode=simulated",{headers:{Origin:origin}})
  ];
  for(const res of attempts){
   assert.equal(res.status,404);
   const raw=await res.text();
   assert.doesNotMatch(raw,/My-Kota|TEST|menu_items|shop-my-kota-ivory-park/);
  }
 });
});
test("4 km is server-enforced for real coords, even approved UID; no order writes",async()=>{
 await serve(good,async base=>{
  const inside=await request(base,"/shop?mode=real&lat=-25.9482&lng=28.2074831464466");
  assert.equal(inside.status,200);
  const insideBody=await inside.json();
  assert.ok(insideBody.shop.distance_km<4);
  assert.equal(insideBody.simulated_location,false);
  const outside=await request(base,"/shop?mode=real&lat=-25.945&lng=28.2074831464466");
  assert.equal(outside.status,422);
  assert.equal((await outside.json()).code,"OUTSIDE_PICKUP_RADIUS");
  for(const path of ["/shop?mode=real&lat=200&lng=28","/shop?mode=real&lat=notreal&lng=28","/shop"]){
    const invalid=await request(base,path);
    assert.equal(invalid.status,400);
  }
  const post=await request(base,"/shop?mode=simulated","owner",origin,"POST");
  assert.equal(post.status,404);
 });
});
test("private fixture disabled produces identical not-found response for all accounts",async()=>{
 await serve({...good,PRIVATE_MYKOTA_TEST_ENABLED:"false"},async base=>{
  const x=await request(base,"/shop?mode=simulated","owner"),y=await request(base,"/shop?mode=simulated","wrong");
  assert.equal(x.status,404);assert.equal(y.status,404);
  assert.deepEqual(await x.json(),await y.json());
 });
});
