import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {merchantOrderTotal,merchantOrderMoney,safeReceiptHtml,safeOrderExportCsv,recordedDeliveryETA} from "../src/services/merchantOrdersTrust.ts";
import {summarizeKitchenQueue} from "../src/services/merchantDashboardLayout.ts";
const orders=readFileSync(new URL("../src/components/OrdersManagement.tsx",import.meta.url),"utf8");
const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");

test("missing or invalid totals are never shown as free orders",()=>{
 assert.equal(merchantOrderTotal(null),null);
 assert.equal(merchantOrderTotal(undefined),null);
 assert.equal(merchantOrderTotal(""),null);
 assert.equal(merchantOrderTotal(-1),null);
 assert.equal(merchantOrderTotal(Infinity),null);
 assert.equal(merchantOrderTotal(0),0);
 assert.equal(merchantOrderTotal("32.50"),32.5);
 assert.equal(merchantOrderMoney(null),"Total unavailable");
 assert.equal(merchantOrderMoney(20),"R 20.00");
 assert.match(orders,/merchantOrderMoney\(order\.total_price\)/);
 assert.doesNotMatch(orders,/TOTAL: R \{Number\(order\.total_price \|\| 0\)\.toFixed\(2\)\}/);
});

test("CSV rows are actually separated, quotes and formulas are neutralized, missing values stay unknown",()=>{
 const rows=[
 {id:"a",product_name:"Kota, XL",total_price:20,status:"completed",created_at:"2026-11-01T10:00:00Z",customer_name:'A "test"',address:"South",city:"Tembisa"},
 {id:"b",product_name:"=HYPERLINK(1)",total_price:null,status:"cancelled",created_at:"bad",customer_name:"+evil",address:"",city:""},
 ];
 const csv=safeOrderExportCsv(rows);
 const lines=csv.split("\r\n");
 assert.equal(lines.length,3);
 assert.match(lines[1],/Kota, XL/);
 assert.match(lines[1],/A ""test""/);
 assert.match(lines[2],/'=HYPERLINK/);
 assert.match(lines[2],/"Unavailable"/);
 assert.match(lines[2],/"Not-such-a-date"|"Unavailable"/);
 assert.match(lines[2],/"'\+evil"/);
 assert.match(orders,/safeOrderExportCsv\(displayedOrders\)/);
 assert.doesNotMatch(orders,/headers\.join\(","\)/);
});

test("untrusted fields in both HTML receipts are escaped, not executable markup",()=>{
 assert.equal(safeReceiptHtml('<img src=x onerror="alert(1)">'),'&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
 assert.equal(safeReceiptHtml("Tom & Jerry"),"Tom &amp; Jerry");
 assert.equal(safeReceiptHtml("'\""),"&#39;&quot;");
 const print=orders.slice(orders.indexOf('const handleIframePrint'),orders.indexOf('const copyReceiptToClipboard'));
 assert.ok(print.length>1000);
 for(const s of ["safeReceiptHtml(order.id)","safeReceiptHtml(order.product_name)",
 "safeReceiptHtml(order.customer_name","safeReceiptHtml(order.phone)",
 "safeReceiptHtml(order.address)","safeReceiptHtml(order.city)",
 "safeReceiptHtml(order.notes)","safeReceiptHtml(n)"])
  assert.ok(print.includes(s),s);
 assert.doesNotMatch(print,/\$\{order\.customer_name \|\| "Guest"\}/);
 assert.doesNotMatch(print,/\$\{order\.notes\}/);
 assert.doesNotMatch(print,/\$\{order\.product_name\}/);
});

test("delivery ETA and tracking never invent location/speed or a three-minute rider route",()=>{
 assert.equal(recordedDeliveryETA(undefined),null);
 assert.equal(recordedDeliveryETA(""),null);
 assert.equal(recordedDeliveryETA(" 20 mins "),"20 mins");
 assert.equal(recordedDeliveryETA("x".repeat(61)),null);
 assert.match(orders,/recordedDeliveryETA\(order\.estimated_delivery_time\)/);
 assert.match(orders,/ETA unavailable/);
 assert.match(orders,/Live rider tracking is not available on this screen/);
 assert.doesNotMatch(orders,/Live ETA: 3 min|Mock Map Route|timeMinutes \+ Number\(avgPrepTime\)/);
 assert.doesNotMatch(orders,/OrderService\.updateDeliveryStatus\(order\.id, status\)/);
 assert.doesNotMatch(orders,/localeats_order_overrides.*delivery_status/);
});

test("client-only order pause/capacity and unapproved bulk deletion cannot change order handling",()=>{
 for(const token of ["setOrdersPaused(","setAlertsEnabled(","Order Limit","maxConcurrentOrders",
 "onDeleteAllOrders","Clear All","deleteAllOrders","OrderService.deleteAllOrdersForShops"])
  assert.equal((orders+app).includes(token),false,token);
 assert.match(orders,/<PickupOrderActions order=\{order\} mode="actions" \/>/);
 assert.doesNotMatch(orders,/PickupOrderActions.*disabled=\{isLimitReached\}/);
 const summary=summarizeKitchenQueue([
  {status:"ready",delivery_type:"delivery"},
  {status:"ready",delivery_type:"collection"},
 ]);
 assert.equal(summary.readyForPickup,1);
 assert.match(orders,/summarizeKitchenQueue\(orders\)\.readyForPickup/);
 assert.doesNotMatch(orders,/Based on current load|Avg\. Prep Time/);
});

test("cancellation waits for workflow, rider nudge and ratings do not claim local success",()=>{
 assert.match(orders,/await Promise\.resolve\(onUpdateStatus\(cancellingOrder\.id, "cancelled", finalReason\)\)/);
 assert.doesNotMatch(orders,/toast\.success\("Order status updated to Cancelled"\)/);
 assert.match(orders,/await sendRiderNudge\(riderId,message\)/);
 assert.match(orders,/toast\.error\("Rider nudge was not confirmed/);
 assert.doesNotMatch(orders,/toast\.success\("Rider nudged successfully!"\)/);
 assert.match(app,/if\(error\)throw new Error\("The rider nudge could not be saved/);
 assert.doesNotMatch(app,/Silent push nudge dispatched to courier device/);
 assert.doesNotMatch(orders,/merchant_rating: rating, updated_at: new Date\(\)\.toISOString\(\)/);
 assert.match(orders,/await OrderService\.rateRider\(orderId,riderId,rating,avgRating\)/);
});


test("unsupported merchant delivery controls cannot advertise server-rejected actions",()=>{
 assert.doesNotMatch(orders,/REQUEST RIDER NOW|Mark as Completed|Invoke Rider Dispatch \\(R 5\\.00\\)/);
 assert.doesNotMatch(orders,/onClick=\\{\\(\\) => \\{\\s*setCancellingOrder\\(order\\)/);
 assert.match(orders,/<button disabled title="Rider assignment requires a server-authorized workflow"/);
 assert.match(orders,/Rider reassignment unavailable/);
});

test("plain-text copied receipts do not invent zero totals",()=>{
 const start=orders.indexOf("const copyReceiptToClipboard");
 const stop=orders.indexOf("// Do not invent GPS tracking",start);
 const clip=orders.slice(start,stop);
 assert.ok(clip.length>500);
 assert.match(clip,/TOTAL: \\$\\{merchantOrderMoney\\(order\\.total_price\\)\\}/);
 assert.match(clip,/Amount unavailable/);
 assert.doesNotMatch(clip,/Number\\(order\\.total_price \\|\\| 0\\)/);
});
