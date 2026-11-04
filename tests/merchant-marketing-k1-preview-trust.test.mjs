import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {merchantMarketingPublishingEnabled,verifiedMarketingStats} from "../src/services/merchantMarketingTrust.ts";

const marketing=readFileSync(new URL("../src/components/Marketing.tsx",import.meta.url),"utf8");
const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");

test("merchant marketing cannot claim publishing or enable campaign tools in pickup Preview",()=>{
 assert.equal(merchantMarketingPublishingEnabled(),false);
 assert.match(marketing,/const publishingEnabled = merchantMarketingPublishingEnabled\(\)/);
 assert.match(marketing,/if\(!publishingEnabled\) return;/);
 assert.match(marketing,/disabled=\{!publishingEnabled\}/);
 assert.match(marketing,/publishingEnabled && mainSegment === "campaign_builder"/);
 assert.match(marketing,/publishingEnabled && mainSegment === "tool_library"/);
 assert.match(marketing,/Marketing Preview only/);
 assert.match(marketing,/QR Preview Only — Not for Distribution/);
 assert.match(marketing,/title="QR export is unavailable before launch"/);
 assert.doesNotMatch(marketing,/● Live & Accepting Orders|Your Live Online Storefront|Instant Scan to Order/);
 // The tool-library export path is inaccessible while publishing remains locked.
});

test("no phantom 75%-of-orders diner estimates or unsafe name-based merges",()=>{
 const rows=[
  {shop_id:"s1",user_id:"c1",total_price:30},
  {shop_id:"s1",user_id:"c1",total_price:20},
  {shop_id:"s2",user_id:"c2",total_price:999},
  {shop_id:"s1",user_id:"c3",total_price:50},
 ];
 assert.deepEqual(verifiedMarketingStats(rows,"s1","confirmed"),{
  totalOrders:3,uniqueDiners:2,repeatDiners:1,repeatRate:50,averageOrderValue:33.33
 });
 assert.deepEqual(verifiedMarketingStats(rows,"s2","confirmed"),{
  totalOrders:1,uniqueDiners:1,repeatDiners:0,repeatRate:0,averageOrderValue:999
 });
 assert.deepEqual(verifiedMarketingStats([],"s1","confirmed"),{
  totalOrders:0,uniqueDiners:0,repeatDiners:0,repeatRate:0,averageOrderValue:0
 });
 assert.doesNotMatch(marketing,/Math.ceil\(shopOrders.length \* 0.75\)/);
 assert.doesNotMatch(marketing,/customer_phone \|\| ord.phone|customer_name \|\| ord.customer/);
});

test("unverified orders and missing shop identity show unavailable, not verified zero",()=>{
 const records=[{shop_id:1,user_id:"a",total_price:14}];
 assert.equal(verifiedMarketingStats(records,1,"checking"),null);
 assert.equal(verifiedMarketingStats(records,1,"unavailable"),null);
 assert.equal(verifiedMarketingStats(records,null,"confirmed"),null);
 assert.equal(verifiedMarketingStats(records,undefined,"confirmed"),null);
 assert.match(app,/<Marketing[\s\S]*?orders=\{orders\}\s*ordersReadState=\{ordersReadState\}/);
 assert.match(marketing,/ordersReadState = "checking"/);
 assert.match(marketing,/verifiedMarketingStats\(orders, activeShop\?\.id, ordersReadState\)/);
 assert.match(marketing,/dinerStats\?\.totalOrders \?\? "—"/);
});

test("missing customer uid does not pretend to be a unique diner",()=>{
 const m=verifiedMarketingStats([
  {shop_id:"owned",user_id:"c1",total_price:15},
  {shop_id:"owned",user_id:"",total_price:20}
 ],"owned","confirmed");
 assert.equal(m?.totalOrders,2);
 assert.equal(m?.uniqueDiners,null);
 assert.equal(m?.repeatDiners,null);
 assert.equal(m?.repeatRate,null);
 assert.equal(m?.averageOrderValue,17.5);
 const bad=verifiedMarketingStats([{shop_id:"owned",user_id:"c1",total_price:NaN}],"owned","confirmed");
 assert.equal(bad?.averageOrderValue,null);
 assert.equal(bad?.uniqueDiners,1);
 assert.equal(verifiedMarketingStats([{shop_id:"owned",user_id:"a",total_price:-1}],"owned","confirmed")?.averageOrderValue,null);
});

test("page preserves cards and navigation, without a false live claim or external marketing write",()=>{
 assert.match(marketing,/grid grid-cols-2 lg:grid-cols-4 gap-4/);
 assert.match(marketing,/Marketing & Customer Growth Studio/);
 assert.match(marketing,/Dashboard Summary/);
 assert.match(marketing,/Campaign Builder/);
 assert.match(marketing,/Tool Library \(8\)/);
 assert.match(marketing,/Storefront Link Preview/);
 assert.match(marketing,/Ordering Not Activated/);
 assert.match(marketing,/Confirmed API order records/);
 assert.match(marketing,/Per order, not confirmed revenue/);
 assert.match(marketing,/disabled=\{!publishingEnabled\}/);
 assert.match(marketing,/disabled:cursor-not-allowed/);
});
