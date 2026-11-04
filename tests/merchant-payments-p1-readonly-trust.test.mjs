import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  verifiedShopPickupPaymentRecords,pickupPaymentAmount,pickupPaymentMethod,
  pickupPaymentRecordStatus,merchantPaymentWritesUnavailable
} from "../src/services/merchantPaymentsTrust.ts";

const payment=readFileSync(new URL("../src/components/PaymentHistory.tsx",import.meta.url),"utf8");
const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");

const orders=[
  {id:"a1",shop_id:1,delivery_type:"collection",payment_method:"cash",payment_status:"unpaid",total_price:30,customer_name:"A"},
  {id:"a2",shop_id:"1",delivery_type:"collection",payment_method:"card_machine",payment_status:"paid",total_price:42,customer_name:"B"},
  {id:"a2",shop_id:"1",delivery_type:"collection",payment_method:"card_machine",payment_status:"paid",total_price:42,customer_name:"B"},
  {id:"foreign",shop_id:2,delivery_type:"collection",payment_method:"cash",payment_status:"paid",total_price:99},
  {id:"delivery",shop_id:1,delivery_type:"delivery",payment_method:"cod",payment_status:"paid",total_price:88},
  {id:"legacy-pickup",shop_id:1,order_type:"pickup",payment_method:"cash",payment_status:"unpaid",total_price:12},
  {id:"bad-id",shop_id:null,delivery_type:"collection",payment_method:"cash",payment_status:"unpaid",total_price:0}
];

test("no collection payment rows from unverified, failed, or mismatched shop reads",()=>{
 assert.equal(verifiedShopPickupPaymentRecords(orders,1,"checking"),null);
 assert.equal(verifiedShopPickupPaymentRecords(orders,1,"unavailable"),null);
 assert.equal(verifiedShopPickupPaymentRecords(orders,null,"confirmed"),null);
 assert.equal(verifiedShopPickupPaymentRecords(orders,undefined,"confirmed"),null);
 assert.deepEqual(verifiedShopPickupPaymentRecords([],1,"confirmed"),[]);
 const r=verifiedShopPickupPaymentRecords(orders,1,"confirmed");
 assert.deepEqual(r?.map(o=>o.id),["a1","a2"]);
 assert.deepEqual(verifiedShopPickupPaymentRecords(orders,2,"confirmed")?.map(o=>o.id),["foreign"]);
});

test("order totals are displayed only when valid finite nonnegative numbers",()=>{
 assert.equal(pickupPaymentAmount(30),"R 30.00");
 assert.equal(pickupPaymentAmount(29.5),"R 29.50");
 assert.equal(pickupPaymentAmount(0),"R 0.00");
 for(const amount of [undefined,null,"0","42.5",Number.NaN,Number.POSITIVE_INFINITY,-1,Number.MAX_VALUE]){
   assert.equal(pickupPaymentAmount(amount),"Amount unavailable");
 }
});

test("card payments are at the physical shop; no COD or settled assumptions",()=>{
 assert.equal(pickupPaymentMethod("cash"),"Cash at shop");
 assert.equal(pickupPaymentMethod("card_machine"),"Physical card machine at shop");
 assert.equal(pickupPaymentMethod("cod"),"Payment method unavailable");
 assert.equal(pickupPaymentMethod(undefined),"Payment method unavailable");
 assert.equal(pickupPaymentRecordStatus("paid"),"Recorded paid in Orders");
 assert.equal(pickupPaymentRecordStatus("unpaid"),"Payment not confirmed");
 assert.equal(pickupPaymentRecordStatus("settled"),"Payment status unavailable");
 assert.equal(pickupPaymentRecordStatus(null),"Payment status unavailable");
});

test("Payments page has no settlement writes, fake finance export, or unverified payments read",()=>{
 assert.equal(merchantPaymentWritesUnavailable(),true);
 assert.doesNotMatch(payment,/localStorage|setItem\(|settledCodOrders|toggleCodSettlement|Mark Settled|Settled & Cleared/);
 assert.doesNotMatch(payment,/supabase|\.from\("payments"\)|jsPDF|autoTable|doc\.save|toast\.success/);
 assert.match(payment,/disabled=\{merchantPaymentWritesUnavailable\(\)\}/);
 assert.match(payment,/Export Unavailable/);
 assert.match(payment,/Financial exports require an authoritative billing and settlement API/);
 assert.match(payment,/No verified billing records are available/);
 assert.match(payment,/This does not mean that no transactions exist/);
});

test("Payments reads only the shop-confirmed Orders API response and separates unknown from zero",()=>{
 assert.match(app,/<PaymentHistory[\s\S]*?orders=\{orders\}\s*ordersReadState=\{ordersReadState\}/);
 assert.match(payment,/ordersReadState = "checking"/);
 assert.match(payment,/String\(currentShop.id\) === String\(shopId\)/);
 assert.match(payment,/verifiedShopPickupPaymentRecords\(orders, shopId, ordersReadState\)/);
 assert.match(payment,/pickupOrders === null \?/);
 assert.match(payment,/Collection payment records are unavailable until this shop's Orders API read is confirmed/);
 assert.match(payment,/No collection orders were found in the current verified Orders response/);
 assert.match(payment,/pickupOrders\?\.length \?\? "—"/);
});

test("original layout, two tabs, table and collection cards remain while all changes are read-only",()=>{
 assert.match(payment,/w-full space-y-6 bg-surface-container-lowest p-6 rounded-3xl border/);
 assert.match(payment,/Subscription & Billing History/);
 assert.match(payment,/Collection Payment Records/);
 assert.match(payment,/overflow-x-auto/);
 assert.match(payment,/<table className="w-full text-left text-xs text-on-surface">/);
 assert.match(payment,/flex items-center justify-between p-4 rounded-2xl bg-surface-container-low/);
 assert.match(payment,/aria-label="Read-only order payment status"/);
 assert.match(payment,/Order total \(not settlement\)/);
 assert.match(payment,/no funds, cash handovers, card-machine settlements, refunds or subscription charges are confirmed or changed/);
});
