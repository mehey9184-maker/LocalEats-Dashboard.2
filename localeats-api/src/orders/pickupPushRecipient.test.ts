import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {drainPickupPush} from "./pickupPush.js";

test("Ready action drains the actual customer's push outbox, never the merchant's",()=>{
 const orders=readFileSync(new URL("../routes/orders.js",import.meta.url),"utf8");
 assert.match(orders,/if \(action === "ready" && result\.order\.user_id\)\s*await drainPickupPush\(supabaseAdmin,\s*result\.order\.user_id\)/);
 assert.doesNotMatch(orders,/drainPickupPush\(supabaseAdmin,uid\)/);
});

test("FCM outbox claim and sendability are bound to provided recipient UID",async()=>{
 const customer="customer-verified-uid", merchant="merchant-uid";
 const job={id:"job",attempts:1,lease_until:"2026-11-03T12:00:00Z",event_id:"event-id",order_id:"order-id",token:"real-fcm-token"};
 const calls:{name:string;args:Record<string,unknown>}[]=[];
 const db={
  rpc:async(name:string,args:Record<string,unknown>)=>{
    calls.push({name,args});
    if(name==="pickup_claim_push")return {data:args.p_uid===customer?job:null,error:null};
    if(name==="pickup_push_sendable")return {data:args.p_uid===customer,error:null};
    return {data:true,error:null};
  }
 };
 let sent=0;
 await drainPickupPush(db as any,merchant,async()=>{sent++});
 assert.equal(sent,0);
 await drainPickupPush(db as any,customer,async outbox=>{
  assert.equal(outbox.event_id,"event-id");
  sent++;
 });
 assert.equal(sent,1);
 assert.deepEqual(calls.filter(c=>c.name==="pickup_claim_push").map(c=>c.args.p_uid),[merchant,customer]);
 assert.equal(calls.at(-1)?.name,"pickup_finish_push");
 assert.equal(calls.at(-1)?.args.p_sent,true);
});
