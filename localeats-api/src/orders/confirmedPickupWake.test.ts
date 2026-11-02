import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {sendConfirmedPickupWake} from "./confirmedPickupWake.js";

const order={id:"123e4567-e89b-42d3-a456-426614174000",shop_id:"shop-A",user_id:"customer-A",delivery_type:"collection",create_intent_hash:"a".repeat(64)};
function db(owner="merchant-A",tokens=["valid-device-token-123456789"]){
 const lookups:{table:string;filters:[string,string][]}[]=[];
 const api={
  from(table:string){
   const entry={table,filters:[] as [string,string][]};lookups.push(entry);
   const chain:any={
    select(){return chain;},
    eq(k:string,v:string){entry.filters.push([k,v]);return chain;},
    is(){return chain;},not(){return chain;},
    async maybeSingle(){return {data:{owner_id:owner},error:null};},
    async limit(){return {data:tokens.map(fcm_token=>({fcm_token})),error:null};},
   };
   return chain;
  },
 };
 return {api,lookups};
}
test("New order sends only to authenticated, verified shop owner's token",async()=>{
 const {api,lookups}=db();
 let request:any;
 assert.equal(await sendConfirmedPickupWake(api,order,"merchant_new_order",async(tokens,data)=>{request={tokens,data};}),true);
 assert.deepEqual(request,{tokens:["valid-device-token-123456789"],data:{type:"merchant_new_order",order_id:order.id}});
 assert.equal(lookups[0].table,"shops");
 assert.deepEqual(lookups[0].filters,[["id","shop-A"]]);
 assert.equal(lookups[1].table,"pickup_push_subscriptions");
 assert.deepEqual(lookups[1].filters,[["user_id","merchant-A"]]);
});
test("Customer status notifications never choose merchant as recipient",async()=>{
 const {api,lookups}=db();
 const payloads:any[]=[];
 for(const [purpose,status] of [["pickup_accepted","preparing"],["pickup_collected","completed"],["pickup_rejected","cancelled"]] as const){
  await sendConfirmedPickupWake(api,order,purpose,async(tokens,data)=>{payloads.push(data);});
  assert.equal(payloads.at(-1).status,status);
  assert.equal(payloads.at(-1).type,"pickup_status");
 }
 assert.equal(lookups.every(item=>item.table==="pickup_push_subscriptions"),true);
 assert.equal(lookups.every(item=>item.filters[0][1]==="customer-A"),true);
});
test("Invalid, legacy or unconfirmed order facts never attempt push",async()=>{
 for(const bad of [{...order,create_intent_hash:null},{...order,delivery_type:"delivery"},{...order,id:""},{...order,user_id:""}]){
  let called=false;const r=await sendConfirmedPickupWake(db().api,bad as any,"merchant_new_order",async()=>{called=true;});
  assert.equal(r,false);assert.equal(called,false);
 }
});
test("Revoked/no devices, provider failures and missing merchant never fail confirmed order",async()=>{
 assert.equal(await sendConfirmedPickupWake(db("merchant",[]).api,order,"merchant_new_order",async()=>{}),false);
 assert.equal(await sendConfirmedPickupWake(db("",["token12345678901234567890"]).api,order,"merchant_new_order",async()=>{}),false);
 assert.equal(await sendConfirmedPickupWake(db().api,order,"pickup_accepted",async()=>{throw Error("offline");}),false);
});
test("API only sends from persisted non-replayed events and keeps Ready on durable outbox",()=>{
 const source=readFileSync(new URL("../routes/orders.js",import.meta.url),"utf8");
 assert.match(source,/if\s*\(!result\.replayed\)\s*await\s+sendConfirmedPickupWake\(supabaseAdmin,\s*result\.order,\s*"merchant_new_order"\)/);
 assert.match(source,/if\s*\(action\s*===\s*"ready"\s*&&\s*result\.order\.user_id\)\s*await\s+drainPickupPush\(supabaseAdmin,\s*result\.order\.user_id\)/);
 for(const name of ["pickup_accepted","pickup_collected","pickup_rejected"]){
  assert.ok(source.includes(`"${name}"`));
 }
 assert.match(source,/!result\.replayed\s*&&\s*action\s*===\s*"accept"/);
 assert.match(source,/!result\.replayed\s*&&\s*action\s*===\s*"collect"/);
 assert.match(source,/!result\.replayed\s*&&\s*action\s*===\s*"reject"/);
 const server=readFileSync(new URL("../server.js",import.meta.url),"utf8");
 assert.match(server,/['"]PUT['"]/);
 const merchant=readFileSync(new URL("../routes/merchant.js",import.meta.url),"utf8");
 assert.match(merchant,/router\.put\("\/push-subscriptions\/\:installationId",\s*authenticateFirebase/);
 assert.match(merchant,/\.eq\("owner_id",\s*uid\)/);
 assert.match(merchant,/\.eq\("user_id",\s*uid\)\.eq\("installation_id",\s*installation\)/);
});
