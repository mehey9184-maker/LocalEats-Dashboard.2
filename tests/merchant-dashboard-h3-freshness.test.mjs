import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {merchantOrderReadScope,shouldPollMerchantOrders,merchantDisplayOrderAmount,newMerchantPendingOrders} from "../src/services/merchantDashboardFreshness.ts";
const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
const dash=readFileSync(new URL("../src/components/DashboardOverview.tsx",import.meta.url),"utf8");
const merchantApi=readFileSync(new URL("../src/services/MerchantApi.ts",import.meta.url),"utf8");
const block=(a,b)=>app.slice(app.indexOf(a),app.indexOf(b,app.indexOf(a)));

test("verified order scope never comes from a cached or unauthenticated shop",()=>{
 assert.equal(merchantOrderReadScope("merchant-1",18,"ready"),'["merchant-1","18"]');
 assert.equal(merchantOrderReadScope("merchant-2",18,"ready"),'["merchant-2","18"]');
 assert.equal(merchantOrderReadScope("merchant-1",19,"ready"),'["merchant-1","19"]');
 for(const gate of ["checking","error","no-shop"])assert.equal(merchantOrderReadScope("u",18,gate),null);
 assert.equal(merchantOrderReadScope(null,18,"ready"),null);
 assert.equal(merchantOrderReadScope("u",null,"ready"),null);
 assert.equal(merchantOrderReadScope("u","","ready"),null);
});

test("order polling runs in foreground and wakes on browser return",()=>{
 const scope=merchantOrderReadScope("merchant-1",18,"ready");
 assert.equal(shouldPollMerchantOrders("visible",scope),true);
 assert.equal(shouldPollMerchantOrders("hidden",scope),false);
 assert.equal(shouldPollMerchantOrders("visible",null),false);
 const p=block("// Poll while the Dashboard is visible","const deleteAllOrders = async");
 for(const s of [
 "shouldPollMerchantOrders(document.visibilityState,verifiedOrderScope)",
 "setInterval(refresh,15000)",'addEventListener("focus",refresh)',
 'addEventListener("visibilitychange",refresh)','removeEventListener("focus",refresh)',
 'removeEventListener("visibilitychange",refresh)',
 ])assert.ok(p.includes(s),s);
 assert.doesNotMatch(p,/setInterval\(\(\) => void fetchOrders\(\), 15000\)/);
});

test("overlapping API reads deduplicate and cannot overwrite a different merchant's data",()=>{
 const p=block("const fetchOrders=useCallback(", "const menuReadRequest = useRef(0)");
 for(const s of ["orderReadInFlightRef.current?.scope===scope",
 "orderReadSerialRef.current!==requestSerial","orderReadScopeRef.current!==scope",
 "firebaseAuth.currentUser?.uid!==uid","processAndSetOrders([],apiOrders)",
 "MerchantApi.getOrders()","setOrdersReadState(\"unavailable\")",
 "warnedOrderScopeRef.current!==scope"])assert.ok(p.includes(s),s);
 assert.doesNotMatch(p,/OrderService\.createOrder|\.from\("orders"\)|updateOrderStatus\(/);
 assert.match(app,/observedPendingIdsRef\.current=null/);
 assert.match(app,/setOrders\(\[\]\);\s*setOrdersReadState\("checking"\)/);
});

test("invalid and missing order prices never become R0",()=>{
 assert.equal(merchantDisplayOrderAmount(35),35);
 assert.equal(merchantDisplayOrderAmount("42.50"),42.50);
 assert.equal(merchantDisplayOrderAmount(0),0);
 for(const v of [null,undefined,"","abc",Infinity,-1])assert.ok(Number.isNaN(merchantDisplayOrderAmount(v)));
 assert.match(app,/total_price:merchantDisplayOrderAmount\(d\.total_price \?\? d\.price\)/);
});

test("new-order alerts ignore initial hydration and changes not involving new pending IDs",()=>{
 const a=newMerchantPendingOrders([{id:"a",status:"pending"}],null);
 assert.deepEqual(a.newIds,[]);
 const b=newMerchantPendingOrders([{id:"a",status:"preparing"},{id:"c",status:"pending"}],a.current);
 assert.deepEqual(b.newIds,["c"]);
 const c=newMerchantPendingOrders([{id:"c",status:"pending"},{id:"c",status:"pending"}],b.current);
 assert.deepEqual(c.newIds,[]);
 assert.deepEqual(newMerchantPendingOrders([{id:"d",status:"cancelled"}],c.current).newIds,[]);
 assert.match(app,/newMerchantPendingOrders\(orders,previous\)/);
 assert.match(app,/ordersReadState!=="confirmed"/);
 assert.match(app,/newIds\.length===0 \|\| !soundAlerts/);
 assert.match(app,/label:"OPEN ORDERS"/);
 assert.doesNotMatch(app,/currentPendingCount > prevPendingCount\.current/);
});

test("Dashboard shows pending/failed API status rather than false zero and doesn't animate every order",()=>{
 for(const s of [
 'ordersReadState==="checking"','ordersReadState==="unavailable"',
 "Orders API unavailable · showing last confirmed list",
 "Orders API unavailable · counts not verified",
 'role="status" aria-live="polite"',
 'hasVerifiedOrders?item.count:"—"',
 'hasVerifiedOrders?todayOrdersCount:"—"',
 'hasVerifiedOrders ?',
 "No Orders in Current List","Waiting for Confirmed Orders",
 "disabled={isManualRefreshing}","aria-busy={isManualRefreshing}",
 "refreshDashboard()",
 ])assert.ok(dash.includes(s),s);
 assert.doesNotMatch(dash,/whileHover=\{\{ y: -4 \}\}/);
 assert.doesNotMatch(dash,/whileInView=\{\{ opacity: 1, x: 0 \}\}/);
});

test("H1/H2 payment, rider and order authority guards remain",()=>{
 for(const s of ["Kitchen Queue",'onNavigate("orders")',"Completed Order Value",
 "not a payout balance","Linked riders · availability not confirmed",
 "Order eligibility is confirmed separately"])assert.ok(dash.includes(s),s);
 assert.doesNotMatch(dash,/Bank account verified|New POS Order|R 55\.00|OrderService\.createOrder/);
 assert.match(merchantApi,/pickupMutationsDisabled/);
});
