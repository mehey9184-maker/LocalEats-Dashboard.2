import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {completedOrderValue,completedOrderTotal,completedDeliveryArea,safeOrderCsvCell} from "../src/services/merchantDashboardTrust.ts";

const overview=readFileSync(new URL("../src/components/DashboardOverview.tsx",import.meta.url),"utf8");
const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
const order=(status,price,extra={})=>({status,total_price:price,order_type:"collection",city:"Tembisa",...extra});

test("financial values use completed valid orders only",()=>{
 assert.equal(completedOrderValue(order("completed",45)),45);
 assert.equal(completedOrderValue(order("completed",0)),0);
 assert.equal(completedOrderValue(order("cancelled",90)),null);
 assert.equal(completedOrderValue(order("pending",65)),null);
 assert.equal(completedOrderValue(order("completed",-10)),null);
 assert.equal(completedOrderValue(order("completed",Infinity)),null);
 assert.equal(completedOrderValue(order("completed",NaN)),null);
 assert.equal(completedOrderTotal([order("completed",50),order("cancelled",99),order("pending",75),order("completed",20)]),70);
 assert.match(overview,/weeklySales=completedOrderTotal\(completedWeeklyOrders\)/);
 assert.match(overview,/totalSales=completedOrderTotal\(completedOrders\)/);
 assert.doesNotMatch(overview,/Pending Payout|Next payout: Wednesday/);
 assert.match(overview,/Completed Order Value/);
 assert.match(overview,/not a payout balance/);
});

test("delivery-area values exclude pickup and cancelled orders, fake areas and bad prices",()=>{
 assert.deepEqual(completedDeliveryArea(order("completed",55,{order_type:"delivery",city:"Ivory Park"})),{city:"Ivory Park",value:55});
 assert.equal(completedDeliveryArea(order("completed",55,{order_type:"pickup"})),null);
 assert.equal(completedDeliveryArea(order("cancelled",55,{order_type:"delivery"})),null);
 assert.equal(completedDeliveryArea(order("completed",-1,{order_type:"delivery"})),null);
 assert.equal(completedDeliveryArea(order("completed",55,{order_type:"delivery",city:""})),null);
 assert.match(overview,/completedDeliveryArea\(o\)/);
 assert.match(overview,/Completed Delivery Orders by Area/);
 assert.doesNotMatch(overview,/Tembisa East|Zone Profitability|profitable delivery zones/);
});

test("dashboard never captures bank or card details, or creates artificial POS orders",()=>{
 for(const forbidden of [
   "localeats_bank_name","localeats_account_number","localeats_payout_linked",
   "handleLinkBank","Link Payouts & Bank","Bank account verified",
   "generateTestOrder","terminal_masked_card","showTestCheckout","cardNumber",
   "R 55.00","OrderService.createOrder","NEW WALK-IN ORDER","New POS Order",
 ])assert.equal(overview.includes(forbidden),false,forbidden);
 assert.match(overview,/Create Shop Profile/);
 assert.match(overview,/Set Hours/);
 assert.match(overview,/Upload Menu/);
 assert.match(overview,/if \(hasShop && hasOperatingHours && hasMenu\) return null/);
 assert.match(overview,/onNavigate\("orders"\)/);
});

test("operational badges no longer invent online riders, prep speed, autoaccept or paid plans",()=>{
 assert.match(overview,/Rider Connections/);
 assert.match(overview,/Linked riders · availability not confirmed/);
 assert.doesNotMatch(overview,/riders online|driverAvailability\.status|avgPrepTime|title="Avg\. Prep"/);
 assert.match(overview,/title="Preparing Orders"/);
 assert.match(overview,/preparingOrdersCount/);
 assert.match(overview,/No orders yet today/);
 assert.match(overview,/Not confirmed/);
 assert.doesNotMatch(overview,/const ConnectionsSlider =|handleToggleAutoAccept/);
 assert.match(overview,/shops\.length > 1/);
});

test("shop status and refresh text do not equate availability with checkout",()=>{
 assert.match(overview,/Mark Available/);
 assert.match(overview,/Mark Unavailable/);
 assert.match(overview,/Order eligibility is confirmed separately/);
 assert.match(overview,/Refresh Shop Data/);
 assert.doesNotMatch(overview,/Sync & Verify Store Ownership|Store Status: Synced & Saved/);
 assert.match(app,/Shop marked available\. Pickup checkout eligibility is confirmed separately/);
 assert.doesNotMatch(app,/Shop is now Open and accepting customer orders!/);
});

test("diagnostics use authenticated API reads, and offline copy is truthful",()=>{
 const at=app.indexOf("const handleTestConnection = async () =>");
 const segment=app.slice(at,app.indexOf("const [isOffline",at));
 assert.ok(at>0);
 assert.match(segment,/await MerchantApi\.getOrders\(\)/);
 assert.doesNotMatch(segment,/setTimeout/);
 assert.match(app,/Cached information may be stale/);
 assert.match(app,/Some previously loaded information may be cached/);
 assert.doesNotMatch(app,/Your cached updates will transparently merge back/);
 assert.doesNotMatch(app,/Go Online & Initialize Dashboard/);
});

test("weekly CSV uses separate rows and blocks spreadsheet formula injection",()=>{
 assert.equal(safeOrderCsvCell("=1+1"),"\"'=1+1\"");
 assert.equal(safeOrderCsvCell(" \t=HYPERLINK('bad')"),"\"' \t=HYPERLINK('bad')\"");
 assert.equal(safeOrderCsvCell("+2"),"\"'+2\"");
 assert.equal(safeOrderCsvCell("@bad"),"\"'@bad\"");
 assert.equal(safeOrderCsvCell('Kota "Special"'),'"Kota ""Special"""');
 assert.equal(safeOrderCsvCell("normal"),'"normal"');
 assert.match(overview,/map\(safeOrderCsvCell\)\.join\(","\)/);
 assert.match(overview,/\.join\("\\r\\n"\)/);
});
