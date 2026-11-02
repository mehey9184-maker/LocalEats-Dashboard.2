import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {merchantOrderArrivals} from "../src/services/merchantOrderAlertPolicy.ts";
const order=(id,status="pending",shop_id="shop-A")=>({id,status,shop_id});
test("first authenticated snapshot establishes a baseline, never announces stale pending orders",()=>{
 const first=merchantOrderArrivals([order("old")],"merchant-A","shop-A",null);
 assert.deepEqual(first.newPendingIds,[]);
 const next=merchantOrderArrivals([order("new"),order("old")],"merchant-A","shop-A",first.cursor);
 assert.deepEqual(next.newPendingIds,["new"]);
 const same=merchantOrderArrivals([order("new"),order("old")],"merchant-A","shop-A",next.cursor);
 assert.deepEqual(same.newPendingIds,[]);
});
test("new pending ID is detected even when pending count stays constant",()=>{
 const first=merchantOrderArrivals([order("one"),order("previous","preparing")],"merchant-A","shop-A",null);
 const result=merchantOrderArrivals([order("one","preparing"),order("next")],"merchant-A","shop-A",first.cursor);
 assert.deepEqual(result.newPendingIds,["next"]);
});
test("status regressions, nonowned shops, account and shop changes cannot fake new orders",()=>{
 const first=merchantOrderArrivals([order("old","preparing")],"merchant-A","shop-A",null);
 assert.deepEqual(merchantOrderArrivals([order("old","pending")],"merchant-A","shop-A",first.cursor).newPendingIds,[]);
 assert.deepEqual(merchantOrderArrivals([order("unknown","pending","shop-B")],"merchant-A","shop-A",first.cursor).newPendingIds,[]);
 assert.deepEqual(merchantOrderArrivals([order("new")],"merchant-B","shop-A",first.cursor).newPendingIds,[]);
 assert.deepEqual(merchantOrderArrivals([order("new")],"merchant-A","shop-B",first.cursor).newPendingIds,[]);
});
test("merchant listens only for confirmed API arrivals, no cached or count-based new orders",()=>{
 const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
 assert.match(app,/const data = await MerchantApi.getOrders\(\)/);
 assert.match(app,/merchantOrderArrivals\(apiOrders,ownerId,shopId,confirmedOrderCursorRef.current\)/);
 assert.match(app,/firebaseAuth.currentUser\?\.uid!==ownerId/);
 assert.match(app,/activeOrderOwnerScopeRef.current!==ownerId/);
 assert.match(app,/arrivals.newPendingIds.length/);
 assert.match(app,/window.setInterval\(refresh,8000\)/);
 assert.match(app,/document.visibilityState==="visible"/);
 assert.match(app,/window.addEventListener\("focus",refresh\)/);
 assert.doesNotMatch(app,/prevPendingCount/);
 assert.doesNotMatch(app,/usePushNotifications\(false\)/);
 assert.match(app,/onClick=\{\(\)=>\{void enableMerchantPush\(\);\}\}/);
});
