import test from "node:test";
import assert from "node:assert/strict";
import {pickupUnpaidWaitingMinutes,pickupNeedsUncollectedAttention} from "../src/services/pickupNoShow.ts";
import {readFileSync} from "node:fs";
const now=Date.parse("2026-11-11T16:00:00Z");
const readyAt=minutes=>new Date(now-minutes*60_000).toISOString();
const order=(minutes,extra={})=>({status:"ready_for_pickup",payment_status:"unpaid",updated_at:readyAt(minutes),...extra});

test("30 minute late unpaid-Ready warning is advisory, not an automatic cancellation",()=>{
 assert.equal(pickupUnpaidWaitingMinutes(order(0),now),0);
 assert.equal(pickupUnpaidWaitingMinutes(order(29),now),29);
 assert.equal(pickupNeedsUncollectedAttention(order(29),now),false);
 assert.equal(pickupNeedsUncollectedAttention(order(30),now),true);
 assert.equal(pickupUnpaidWaitingMinutes(order(90),now),90);
 const source=readFileSync("src/services/pickupNoShow.ts","utf8");
 assert.doesNotMatch(source,/fetch\(|supabase|update\(|delete\(|payment_status\s*=/);
});

test("do not mislabel paid, collected, rejected or missing-timestamp orders",()=>{
 for(const fixture of [
  order(90,{payment_status:"paid"}),
  order(90,{status:"collected"}),
  order(90,{status:"pending"}),
  order(90,{status:"rejected"}),
  order(90,{updated_at:undefined}),
  order(90,{updated_at:"not a date"})
 ]) {
  assert.equal(pickupUnpaidWaitingMinutes(fixture,now),null);
  assert.equal(pickupNeedsUncollectedAttention(fixture,now),false);
 }
});
test("future or malicious clock timestamps do not invent payment facts",()=>{
 assert.equal(pickupUnpaidWaitingMinutes(order(-60),now),null);
 assert.equal(pickupNeedsUncollectedAttention(order(-60),now),false);
});
test("existing merchant actions keep separate actual payment and food-handover confirmations",()=>{
 const source=readFileSync("src/components/PickupOrderActions.tsx","utf8");
 assert.match(source,/pickupNeedsUncollectedAttention\(order\)/);
 assert.match(source,/confirm you have actually received payment|Confirm you have actually received payment/i);
 assert.match(source,/Confirm the food has actually been handed to the customer/);
 assert.match(source,/merchant-pickup-order-confirmed/);
});
