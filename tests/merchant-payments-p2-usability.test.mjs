import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  verifiedShopPickupPaymentRecords,
  merchantPaymentRecordTimestamp,
  merchantPaymentDateLabel,
  merchantPaymentFilteredRecords,
  merchantPaymentNextVisibleCount,
  MERCHANT_PAYMENT_BATCH_SIZE,
  merchantPaymentWritesUnavailable,
} from "../src/services/merchantPaymentsTrust.ts";

const page=readFileSync(new URL("../src/components/PaymentHistory.tsx",import.meta.url),"utf8");
const orders=[
  {id:"shop-A-01",shop_id:10,delivery_type:"collection",customer_name:"Thabo",payment_status:"unpaid",created_at:"2026-11-02T13:30:00Z"},
  {id:"shop-A-02",shop_id:10,delivery_type:"collection",customer_name:"Zola",payment_status:"paid",created_at:"2026-11-04T10:00:00Z"},
  {id:"shop-A-03",shop_id:10,delivery_type:"collection",customer_name:"Amahle",payment_status:null,created_at:"2026-11-03T13:00:00+02:00"},
  {id:"shop-A-04",shop_id:10,delivery_type:"collection",customer_name:"Zola",payment_status:"paid",created_at:"no date"},
  {id:"shop-B-01",shop_id:20,delivery_type:"collection",customer_name:"Foreign",payment_status:"paid",created_at:"2026-11-04T11:00:00Z"},
  {id:"delivery",shop_id:10,delivery_type:"delivery",customer_name:"Courier",payment_status:"paid",created_at:"2026-11-05T11:00:00Z"},
];

test("P2 only searches the confirmed shop collection records, never the raw cross-shop list",()=>{
  const scoped=verifiedShopPickupPaymentRecords(orders,10,"confirmed");
  assert.deepEqual(scoped?.map(x=>x.id),["shop-A-01","shop-A-02","shop-A-03","shop-A-04"]);
  assert.equal(verifiedShopPickupPaymentRecords(orders,10,"unavailable"),null);
  assert.deepEqual(merchantPaymentFilteredRecords(scoped||[],"zola","all").map(x=>x.id),["shop-A-02","shop-A-04"]);
  assert.deepEqual(merchantPaymentFilteredRecords(scoped||[],"SHOP-A-03","all").map(x=>x.id),["shop-A-03"]);
  assert.deepEqual(merchantPaymentFilteredRecords(scoped||[],"  thabo  ","all").map(x=>x.id),["shop-A-01"]);
  assert.deepEqual(merchantPaymentFilteredRecords(scoped||[],"foreign","all"),[]);
  assert.deepEqual(merchantPaymentFilteredRecords(scoped||[],"courier","all"),[]);
  assert.deepEqual(merchantPaymentFilteredRecords(scoped||[],"nothing","all"),[]);
});

test("recorded paid/unpaid/unknown filters match only exact API payment statuses",()=>{
  const scoped=verifiedShopPickupPaymentRecords(orders,10,"confirmed")||[];
  assert.deepEqual(merchantPaymentFilteredRecords(scoped,"","paid").map(x=>x.id),["shop-A-02","shop-A-04"]);
  assert.deepEqual(merchantPaymentFilteredRecords(scoped,"","unpaid").map(x=>x.id),["shop-A-01"]);
  assert.deepEqual(merchantPaymentFilteredRecords(scoped,"","unknown").map(x=>x.id),["shop-A-03"]);
  assert.deepEqual(merchantPaymentFilteredRecords(scoped,"Zola","unpaid"),[]);
  assert.deepEqual(merchantPaymentFilteredRecords(scoped,"zola","paid").map(x=>x.id),["shop-A-02","shop-A-04"]);
  assert.deepEqual(merchantPaymentFilteredRecords(scoped,"","all").map(x=>x.id),["shop-A-02","shop-A-03","shop-A-01","shop-A-04"]);
});

test("dated records are sorted newest first; missing or ambiguous timestamps are unavailable",()=>{
  assert.equal(merchantPaymentRecordTimestamp("2026-11-04T10:00:00Z"),Date.parse("2026-11-04T10:00:00Z"));
  assert.equal(merchantPaymentRecordTimestamp("2026-11-04T12:00:00+02:00"),Date.parse("2026-11-04T10:00:00Z"));
  assert.equal(merchantPaymentRecordTimestamp("2026-11-04T10:00:00.123456Z"),Date.parse("2026-11-04T10:00:00.123Z"));
  for(const raw of [undefined,null,5,"","2026-11-04T11:00:00","2026-02-30T12:00:00Z","2026-11-04T25:00:00Z","2026-11-04T12:99:00Z","2026-11-04T12:00:00+15:00"]){
    assert.equal(merchantPaymentRecordTimestamp(raw),null);
    assert.equal(merchantPaymentDateLabel(raw),"Order date unavailable");
  }
  assert.match(merchantPaymentDateLabel("2026-11-04T10:00:00Z"),/2026/);
  assert.match(merchantPaymentDateLabel("2026-11-04T10:00:00Z"),/12:00/);
});

test("24-item batch is bounded and resets are wired to shop, search and filter",()=>{
  assert.equal(MERCHANT_PAYMENT_BATCH_SIZE,24);
  assert.equal(merchantPaymentNextVisibleCount(24,25),25);
  assert.equal(merchantPaymentNextVisibleCount(24,73),48);
  assert.equal(merchantPaymentNextVisibleCount(48,73),72);
  assert.equal(merchantPaymentNextVisibleCount(72,73),73);
  assert.equal(merchantPaymentNextVisibleCount(73,73),73);
  assert.equal(merchantPaymentNextVisibleCount(NaN,24),24);
  assert.equal(merchantPaymentNextVisibleCount(24,0),0);
  assert.match(page,/useEffect\(\(\) => \{\s*setSearchQuery\(""\);\s*setStatusFilter\("all"\);\s*setVisibleCount\(MERCHANT_PAYMENT_BATCH_SIZE\);\s*\}, \[shopId\]\)/);
  assert.match(page,/setSearchQuery\(value\);\s*setVisibleCount\(MERCHANT_PAYMENT_BATCH_SIZE\)/);
  assert.match(page,/setStatusFilter\(value\);\s*setVisibleCount\(MERCHANT_PAYMENT_BATCH_SIZE\)/);
  assert.match(page,/filteredPayments\.slice\(0,visibleCount\)\.map/);
  assert.match(page,/Show more records/);
});

test("search, status filters, honest empty state and unknown status accessibility",()=>{
  assert.match(page,/Find a collection order/);
  assert.match(page,/type="search"/);
  assert.match(page,/Search order ID or customer name/);
  assert.match(page,/Filter recorded order payment status/);
  assert.match(page,/aria-pressed=\{statusFilter===value\}/);
  assert.match(page,/Recorded paid/);
  assert.match(page,/Not confirmed/);
  assert.match(page,/Status unavailable/);
  assert.match(page,/No collection order records match the current search or status filter/);
  assert.match(page,/Clear search and filters/);
  assert.match(page,/merchantPaymentDateLabel\(order\.created_at\)/);
  assert.match(page,/order\.payment_status==="unpaid" \? "bg-amber-500/);
  assert.match(page,/"bg-surface-container-high text-on-surface-variant"/);
  assert.match(page,/New.*dated orders first/);
});

test("P2 preserves P1 read-only safety and original payment shell",()=>{
  assert.equal(merchantPaymentWritesUnavailable(),true);
  assert.match(page,/w-full space-y-6 bg-surface-container-lowest p-6 rounded-3xl border/);
  assert.match(page,/Subscription & Billing History/);
  assert.match(page,/Collection Payment Records/);
  assert.match(page,/Order total \(not settlement\)/);
  assert.match(page,/disabled=\{merchantPaymentWritesUnavailable\(\)\}/);
  assert.match(page,/pickupOrders === null \?/);
  assert.doesNotMatch(page,/localStorage|setItem\(|toggleCodSettlement|Mark Settled|Settled & Cleared/);
  assert.doesNotMatch(page,/supabase|\.from\("payments"\)|jsPDF|autoTable|doc\.save|toast\.success/);
});
