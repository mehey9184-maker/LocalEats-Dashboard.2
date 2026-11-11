import test from "node:test";
import assert from "node:assert/strict";
import {tryMerchantPickupPush, type MerchantPushLookup} from "./merchantPush.js";

const order={id:"00000000-0000-4000-8000-000000003301",shop_id:"shop-a",status:"pending",delivery_type:"collection"};
const lookup:MerchantPushLookup={
  findOwner:async shopId=>shopId==="shop-a" ? "owner-a" : null,
  findTokens:async owner=>owner==="owner-a" ? ["synthetic-token-"+("x".repeat(25))] : [],
};

test("new committed pickup sends exactly one merchant wake-up, no token leaks",async()=>{
 const sent:string[]=[];
 const r=await tryMerchantPickupPush(lookup,order,false,async(token,id)=>{
   assert.equal(id,order.id);sent.push(token);
 });
 assert.deepEqual(r,{attempted:1,accepted:1});
 assert.equal(sent.length,1);
});
test("idempotent replay, delivery or wrong status never send new-order push",async()=>{
 let sends=0;const send=async()=>{sends++;};
 assert.deepEqual(await tryMerchantPickupPush(lookup,order,true,send),{attempted:0,accepted:0});
 await tryMerchantPickupPush(lookup,{...order,delivery_type:"delivery"},false,send);
 await tryMerchantPickupPush(lookup,{...order,status:"collected"},false,send);
 assert.equal(sends,0);
});
test("merchant devices are scoped to the persisted shop owner",async()=>{
 let sends=0;
 const unknown=await tryMerchantPickupPush(lookup,{...order,shop_id:"not-owned"},false,async()=>{sends++;});
 assert.deepEqual(unknown,{attempted:0,accepted:0});
 assert.equal(sends,0);
});
test("FCM failure does not reject the committed order or report delivery",async()=>{
 const r=await tryMerchantPickupPush(lookup,order,false,async()=>{throw Error("synthetic push outage");});
 assert.deepEqual(r,{attempted:1,accepted:0});
});
test("multiple active devices are capped and delivery is best-effort",async()=>{
 const many:MerchantPushLookup={
  findOwner:async()=> "owner",
  findTokens:async()=> Array.from({length:10},(_,i)=>"fake-token-"+i+"x".repeat(25))
 };
 let sends=0;
 const r=await tryMerchantPickupPush(many,order,false,async()=>{sends++;});
 assert.deepEqual(r,{attempted:5,accepted:5});
 assert.equal(sends,5);
});
