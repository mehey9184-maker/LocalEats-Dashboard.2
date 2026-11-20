import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express,{type RequestHandler} from "express";
import {
  makeCustomerCommunityReadOnlyRouter,customerCommunityWritesEnabled,
  type CommunityReadOnlyStore,
} from "./customerCommunityReadOnlyContract.js";

const fixture={
 shop:{id:"shop-A",approved:true,archived:false},
 reviews:[{id:"r1",shop_id:"shop-A",published:true,rating:5,comment:"Great kota",created_at:"2026-11-20T10:00:00Z",
          user_id:"customer-A",user_email:"private@example.invalid",phone:"SYNTHETIC_PRIVATE_PHONE"}],
 follows:[{user_id:"customer-A",shop_id:"shop-A",approved:true,private_note:"not for client"}],
 order:{id:"order-A",delivery_type:"collection" as const,customer_uid:"customer-A",verified_merchant_uid:"owner-A"},
 messages:[{id:"m1",order_id:"order-A",sender_role:"merchant",sender_uid:"owner-A",message:"Ready",created_at:"2026-11-20T10:01:00Z",
           user_email:"private@example.invalid",phone:"SYNTHETIC_PRIVATE_PHONE"}],
};
type StoreOverrides=Partial<{
 approvedShop:CommunityReadOnlyStore["approvedShop"];
 publishedReviews:CommunityReadOnlyStore["publishedReviews"];
 followedApprovedShops:CommunityReadOnlyStore["followedApprovedShops"];
 verifiedPickupParticipants:CommunityReadOnlyStore["verifiedPickupParticipants"];
 messagesForVerifiedOrder:CommunityReadOnlyStore["messagesForVerifiedOrder"];
}>;
const store=(overrides:StoreOverrides={}):CommunityReadOnlyStore=>({
 approvedShop:async id=>id==="shop-A"?fixture.shop:null,
 publishedReviews:async()=>fixture.reviews,
 followedApprovedShops:async()=>fixture.follows,
 verifiedPickupParticipants:async id=>id==="order-A"?fixture.order:null,
 messagesForVerifiedOrder:async()=>fixture.messages,
 ...overrides,
});
const syntheticAuth:RequestHandler=(req,res,next)=>{
 const who=req.headers.authorization;
 if(who==="Bearer fake-customer-a"){
   (req as typeof req&{authUser:unknown}).authUser={uid:"customer-A",email:null};
   next();return;
 }
 if(who==="Bearer fake-owner-a"){
   (req as typeof req&{authUser:unknown}).authUser={uid:"owner-A",email:null};
   next();return;
 }
 if(who==="Bearer fake-customer-b"){
   (req as typeof req&{authUser:unknown}).authUser={uid:"customer-B",email:null};
   next();return;
 }
 if(who==="Bearer fake-anonymous"){
   (req as typeof req&{authUser:unknown}).authUser={uid:"guest",email:null,isAnonymous:true};
   next();return;
 }
 res.status(401).json({success:false,code:"UNAUTHORIZED"});
};
async function withApp(fn:(base:string)=>Promise<void>,overrides:StoreOverrides={}){
 const app=express();
 app.use(express.json());
 app.use("/api/v1/community",makeCustomerCommunityReadOnlyRouter(store(overrides),syntheticAuth));
 const server=http.createServer(app);
 await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
 try{
  const a=server.address();if(!a||typeof a==="string")throw Error("NO_LOCAL_PORT");
  await fn("http://127.0.0.1:"+a.port+"/api/v1/community");
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
}
const req=(base:string,path:string,who="fake-customer-a",method="GET")=>
  fetch(base+path,{method,headers:{"Authorization":"Bearer "+who}});
test("N8M router requires Firebase identity and rejects anonymous accounts",async()=>{
 await withApp(async base=>{
  let r=await fetch(base+"/shops/shop-A/reviews");
  assert.equal(r.status,401);
  r=await req(base,"/shops/shop-A/reviews","fake-anonymous");
  assert.equal(r.status,401);
  r=await req(base,"/shops/shop-A/reviews","fake-customer-b");
  assert.equal(r.status,200);
 });
});
test("N8M reviews: only published, approved-shop reviews; no customer PII",async()=>{
 await withApp(async base=>{
  const r=await req(base,"/shops/shop-A/reviews");
  assert.equal(r.status,200);
  assert.equal(r.headers.get("cache-control"),"no-store");
  const j=await r.json();
  assert.deepEqual(j.reviews,[{
   id:"r1",shop_id:"shop-A",rating:5,comment:"Great kota",created_at:"2026-11-20T10:00:00Z",
  }]);
  assert.ok(!JSON.stringify(j).includes("private@example.invalid"));
  assert.ok(!JSON.stringify(j).includes("SYNTHETIC_PRIVATE_PHONE"));
 });
});
test("N8M unapproved/archived shops and unknown shop IDs do not leak reviews",async()=>{
 for(const entry of [{id:"shop-A",approved:false,archived:false},{id:"shop-A",approved:true,archived:true}]){
  await withApp(async base=>{assert.equal((await req(base,"/shops/shop-A/reviews")).status,404);},
   {approvedShop:async()=>entry});
 }
 await withApp(async base=>{
  assert.equal((await req(base,"/shops/unknown/reviews")).status,404);
  assert.equal((await req(base,"/shops/bad%20id/reviews")).status,404);
 });
});
test("N8M malformed or mixed review rows fail closed, never leak wrong-shop data",async()=>{
 for(const bad of [
  {...fixture.reviews[0],shop_id:"shop-B"},
  {...fixture.reviews[0],published:false},
  {...fixture.reviews[0],rating:99},
  {...fixture.reviews[0],comment:"x".repeat(1500)},
 ]){
  await withApp(async base=>{
   const r=await req(base,"/shops/shop-A/reviews");
   assert.equal(r.status,503);
   assert.equal((await r.json()).code,"COMMUNITY_STORE_UNAVAILABLE");
  },{publishedReviews:async()=>[bad]});
 }
});
test("N8M follows are authenticated-user scoped, not caller-supplied UID",async()=>{
 await withApp(async base=>{
  const a=await req(base,"/me/follows?uid=customer-B");
  assert.equal(a.status,200);
  assert.deepEqual((await a.json()).shop_ids,["shop-A"]);
  const b=await req(base,"/me/follows","fake-customer-b");
  assert.equal(b.status,503);
 },{});
});
test("N8M mixed-UID or unapproved follows cannot escape read gate",async()=>{
 for(const row of [
  {user_id:"customer-B",shop_id:"shop-A",approved:true},
  {user_id:"customer-A",shop_id:"shop-A",approved:false},
  {user_id:"customer-A",shop_id:"bad shop",approved:true},
 ]){
  await withApp(async base=>{
   assert.equal((await req(base,"/me/follows")).status,503);
  },{followedApprovedShops:async()=>[row]});
 }
});
test("N8M pickup order messages readable only by actual verified participants",async()=>{
 await withApp(async base=>{
  const a=await req(base,"/orders/order-A/messages");
  assert.equal(a.status,200);
  assert.deepEqual((await a.json()).messages,[{
   id:"m1",order_id:"order-A",sender_role:"merchant",
   message:"Ready",created_at:"2026-11-20T10:01:00Z",
  }]);
  assert.equal((await req(base,"/orders/order-A/messages","fake-owner-a")).status,200);
  const b=await req(base,"/orders/order-A/messages","fake-customer-b");
  assert.equal(b.status,404,"foreign order existence must not be revealed");
  assert.equal((await req(base,"/orders/unknown/messages")).status,404);
 });
});
test("N8M delivery/Rider orders, spoofed merchant owners and foreign messages fail closed",async()=>{
 await withApp(async base=>{
  assert.equal((await req(base,"/orders/order-A/messages")).status,404);
 },{verifiedPickupParticipants:async()=>({...fixture.order,delivery_type:"delivery"})});
 for(const row of [
  {...fixture.messages[0],sender_uid:"customer-B"},
  {...fixture.messages[0],order_id:"order-B"},
  {...fixture.messages[0],sender_role:"rider"},
 ]){
  await withApp(async base=>{
   assert.equal((await req(base,"/orders/order-A/messages")).status,503);
  },{messagesForVerifiedOrder:async()=>[row]});
 }
});
test("N8M all intended community mutations remain disabled without a write-store interface",async()=>{
 assert.equal(customerCommunityWritesEnabled(),false);
 await withApp(async base=>{
  for(const [method,path] of [
   ["POST","/shops/shop-A/reviews"],["POST","/me/follows"],
   ["DELETE","/me/follows/shop-A"],["POST","/orders/order-A/messages"],
   ["PATCH","/orders/order-A/messages/read"],
  ]){
   const r=await req(base,path,"fake-customer-a",method);
   assert.equal(r.status,503,path);
   const data=await r.json();
   assert.equal(data.code,"COMMUNITY_WRITES_DISABLED");
   assert.match(data.error,/No review, follow or message was saved/);
  }
 });
});
test("N8M repository failures and unbounded returned rows cannot masquerade as empty success",async()=>{
 await withApp(async base=>{
  assert.equal((await req(base,"/shops/shop-A/reviews")).status,503);
 },{publishedReviews:async()=>{throw Error("PRIVATE_BACKEND_FAILURE");}});
 await withApp(async base=>{
  assert.equal((await req(base,"/me/follows")).status,503);
 },{followedApprovedShops:async()=>Array.from({length:51},()=>fixture.follows[0])});
 await withApp(async base=>{
  assert.equal((await req(base,"/orders/order-A/messages")).status,503);
 },{messagesForVerifiedOrder:async()=>Array.from({length:51},()=>fixture.messages[0])});
});
test("N8M no hosted router mount or DB writes: source-level review release gate",async()=>{
 const {readFileSync}=await import("node:fs");
 const s=readFileSync(new URL("../../src/server.ts",import.meta.url),"utf8");
 const contract=readFileSync(new URL("../../src/routes/customerCommunityReadOnlyContract.ts",import.meta.url),"utf8");
 assert.ok(!s.includes("customerCommunityReadOnlyContract"));
 assert.ok(!s.includes("/api/v1/community"));
 assert.ok(!contract.includes(".insert(") && !contract.includes(".update(") &&
            !contract.includes(".upsert(") && !contract.includes(".delete("));
 assert.match(contract,/authenticate:RequestHandler=authenticateFirebase/);
});
