import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {summarizeKitchenQueue,recentKitchenOrders,lowStockMenuItems} from "../src/services/merchantDashboardLayout.ts";
const overview=readFileSync(new URL("../src/components/DashboardOverview.tsx",import.meta.url),"utf8");
const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
const at=(needle)=>overview.indexOf(needle);

test("queue is read-only, accurately classifies pending/preparing/ready pickup and never invents delivery pickup",()=>{
 const queue=summarizeKitchenQueue([
  {status:"pending",delivery_type:"collection"},
  {status:"preparing",delivery_type:"collection"},
  {status:"preparing",delivery_type:"delivery"},
  {status:"ready",delivery_type:"collection"},
  {status:"ready",delivery_type:"delivery"},
  {status:"accepted",pickup_status:"ready_for_pickup",order_type:"pickup"},
  {status:"completed",pickup_status:"ready_for_pickup",delivery_type:"collection"},
  {status:"cancelled",pickup_status:"ready_for_pickup",delivery_type:"collection"},
 ]);
 assert.deepEqual(queue,{pending:1,preparing:2,readyForPickup:2,completed:1});
 assert.deepEqual(summarizeKitchenQueue([]),{pending:0,preparing:0,readyForPickup:0,completed:0});
 assert.match(overview,/const kitchenQueue=useMemo\(\(\)=>summarizeKitchenQueue\(orders\),\[orders\]\)/);
 assert.match(overview,/Kitchen Queue/);
 assert.match(overview,/New \/ Pending/);
 assert.match(overview,/Ready for Pickup/);
 assert.match(overview,/Completed in list/);
 assert.match(overview,/onClick=\{\(\)=>onNavigate\("orders"\)\}/);
 assert.doesNotMatch(overview,/createOrder\(|generateTestOrder|setShowTestCheckout|terminal_masked_card/);
});

test("recent orders are newest-first regardless of API response order and do not mutate props",()=>{
 const data=[
  {id:"old",created_at:"2026-11-01T10:00:00Z"},
  {id:"broken",created_at:"invalid"},
  {id:"new",created_at:"2026-11-03T09:00:00Z"},
  {id:"mid",created_at:"2026-11-02T10:00:00Z"}
 ];
 assert.deepEqual(recentKitchenOrders(data,3).map(x=>x.id),["new","mid","old"]);
 assert.deepEqual(data.map(x=>x.id),["old","broken","new","mid"]);
 assert.deepEqual(recentKitchenOrders(data,0),[]);
 assert.match(overview,/latestKitchenOrders=useMemo\(\(\)=>recentKitchenOrders\(orders,5\),\[orders\]\)/);
 assert.match(overview,/latestKitchenOrders\.map\(/);
 assert.match(overview,/Number\.isFinite\(Date\.parse\(order\.created_at\)\)/);
 assert.match(overview,/Total unavailable/);
 assert.match(overview,/<button\s+key=\{order\.id\}/);
});

test("low-stock alerts use only available finite nonnegative tracked quantities",()=>{
 const data=[
  {name:"valid",is_available:true,stock_quantity:2},
  {name:"zero",is_available:true,stock_quantity:0},
  {name:"unlimited",is_available:true,stock_quantity:-1},
  {name:"not tracked",is_available:true,stock_quantity:null},
  {name:"closed",is_available:false,stock_quantity:3},
  {name:"nan",is_available:true,stock_quantity:NaN},
  {name:"plenty",is_available:true,stock_quantity:5},
 ];
 assert.deepEqual(lowStockMenuItems(data).map(x=>x.name),["valid","zero"]);
 assert.match(overview,/lowStockItems=useMemo\(\(\)=>lowStockMenuItems\(menuItems\),\[menuItems\]\)/);
 assert.match(overview,/lowStockItems\.map\(/);
 assert.match(overview,/Review Menu/);
 assert.doesNotMatch(overview,/Restock Now/);
});

test("Dashboard prioritizes original shop status and verified kitchen work above reports and admin",()=>{
 const ordered=[
  'Good Morning',
  '{currentShop && (',
  'Kitchen Queue',
  'Today\x27s Orders',
  'Low Stock Alerts Section',
  'Recent Activity Feed',
  '<OnboardingChecklist',
  'Storefront Ownership Sync & Repair Card',
  'Bulk Storefront Status Switch',
  'Completed delivery order values grouped by recorded city',
 ];
 // The greeting is rendered with a computed value, so check JSX heading placement.
 ordered[0]='{greeting}, Chef!';
 const positions=ordered.map(at);
 assert.ok(positions.every(p=>p>=0),JSON.stringify(ordered.map((x,i)=>[x,positions[i]])));
 assert.ok(positions.every((p,i)=>i===0 || p>positions[i-1]),JSON.stringify(positions));
 assert.match(overview,/layoutMode\s*===\s*"advanced"\s*&&\s*<DeliveryDispatchSuburbTrends/);
 assert.doesNotMatch(overview,/Compact View Active|Unlock Full Analytics|full telemetries/);
 assert.match(overview,/layoutMode==="advanced" && \(\s*<section aria-label="Advanced shop data tools"/);
 assert.match(overview,/shops\.length > 1/);
});

test("existing UI remains and page navigation is clear, operable and mobile-friendly",()=>{
 assert.match(overview,/rounded-\[2\.5rem\]/);
 assert.match(overview,/onNavigate\(action\.id\)/);
 assert.match(overview,/title: "Orders & Kitchen"/);
 assert.match(overview,/sub: "Review incoming and active orders"/);
 assert.match(overview,/title: "View Menu"/);
 assert.match(overview,/aria-pressed=\{layoutMode==="compact"\}/);
 assert.match(overview,/aria-pressed=\{layoutMode==="advanced"\}/);
 assert.match(overview,/min-h-11/);
 assert.match(overview,/aria-label=\{isManualRefreshing \? "Refreshing dashboard" : "Refresh dashboard data"\}/);
 assert.match(overview,/aria-label="Download weekly orders CSV"/);
 assert.match(overview,/onNavigate\("orders"\)/);
 assert.match(app,/MerchantApi\.getOrders\(\)/);
});

test("H1 trust protections still hold for bank, POS, paid status, location and payment",()=>{
 for(const text of [
  "Bank account verified","localeats_account_number","handleLinkBank",
  "generateTestOrder","cardNumber","R 55.00","Pending Payout",
  "riders online","avgPrepTime","Zone Profitability","Tembisa East",
 ])assert.equal(overview.includes(text),false,text);
 assert.match(overview,/Completed Order Value/);
 assert.match(overview,/Linked riders · availability not confirmed/);
 assert.match(overview,/Order eligibility is confirmed separately/);
 assert.match(overview,/showing.*?Checkout|pickupOrderingEnabled\(\)/s);
 assert.match(app,/Shop marked available\. Pickup checkout eligibility is confirmed separately/);
});
