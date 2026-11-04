import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createMerchantOrderReadCoordinator} from "../src/services/merchantOrderRecovery.ts";

const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
const api=readFileSync(new URL("../src/services/MerchantApi.ts",import.meta.url),"utf8");
const policy=readFileSync(new URL("../src/services/merchantPickupPolicy.ts",import.meta.url),"utf8");
const makeDeferred=()=>{
 let resolve,reject;
 const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
 return {promise,resolve,reject};
};

test("merchant order reads are single-flight for overlapping polling and manual refresh",async()=>{
 const reader=createMerchantOrderReadCoordinator();
 reader.activate("merchant-1:shop-a");
 const gate=makeDeferred();
 let calls=0;
 const read=()=>{calls++;return gate.promise;};
 const first=reader.refresh("merchant-1:shop-a",read);
 const second=reader.refresh("merchant-1:shop-a",read);
 const third=reader.refresh("merchant-1:shop-a",read);
 assert.strictEqual(first,second);
 assert.strictEqual(second,third);
 await Promise.resolve();
 assert.equal(calls,1);
 gate.resolve([{id:"order-1",shop_id:"shop-a"}]);
 for(const pending of [first,second,third])
  assert.deepEqual(await pending,{kind:"fresh",rows:[{id:"order-1",shop_id:"shop-a"}]});
 assert.equal(calls,1);
 const after=await reader.refresh("merchant-1:shop-a",async()=>[{id:"order-2"}]);
 assert.equal(after.kind,"fresh");
 assert.equal(calls,1,"separate reader after completion is allowed without calling the old loader");
});

test("old shop responses are rejected even if a request completes after shop switch",async()=>{
 const reader=createMerchantOrderReadCoordinator();
 reader.activate("merchant-1:shop-a");
 const delayed=makeDeferred();
 const old=reader.refresh("merchant-1:shop-a",()=>delayed.promise);
 reader.activate("merchant-1:shop-b");
 const active=await reader.refresh("merchant-1:shop-b",async()=>[{id:"current",shop_id:"shop-b"}]);
 assert.equal(active.kind,"fresh");
 delayed.resolve([{id:"private-old-order",shop_id:"shop-a"}]);
 assert.equal((await old).kind,"stale");
 assert.equal((await reader.refresh("merchant-1:shop-a",async()=>[])).kind,"stale");
 reader.activate(null);
 assert.equal((await reader.refresh("merchant-1:shop-b",async()=>[])).kind,"stale");
});

test("old account errors are ignored after logout and are not shown as current failures",async()=>{
 const reader=createMerchantOrderReadCoordinator();
 reader.activate("merchant-1:shop-a");
 const delayed=makeDeferred();
 const old=reader.refresh("merchant-1:shop-a",()=>delayed.promise);
 await Promise.resolve();
 reader.activate(null);
 delayed.reject(new Error("Old merchant network error"));
 assert.equal((await old).kind,"stale");
});

test("a failed request can retry without fabricated success or offline writes",async()=>{
 const reader=createMerchantOrderReadCoordinator();
 reader.activate("merchant-1:shop-a");
 const failed=await reader.refresh("merchant-1:shop-a",async()=>{throw Error("Synthetic 503");});
 assert.equal(failed.kind,"failed");
 assert.match(String(failed.error),/Synthetic 503/);
 const invalid=await reader.refresh("merchant-1:shop-a",async()=>({orders:[]})); // wrong payload
 assert.equal(invalid.kind,"failed");
 const success=await reader.refresh("merchant-1:shop-a",async()=>[]);
 assert.deepEqual(success,{kind:"fresh",rows:[]});
});

test("the Merchant app recovers on visibility, focus and reconnect, without background polling",()=>{
 assert.match(app,/const orderReadCoordinator = useRef\(createMerchantOrderReadCoordinator/);
 assert.match(app,/orderReadCoordinator\.current\.activate\(orderReadScope\)/);
 assert.match(app,/orderReadCoordinator\.current\.activate\(null\)/);
 assert.match(app,/const data = await MerchantApi\.getOrders\(\)/);
 assert.match(app,/String\(d\.shop_id\)===orderReadShopId/);
 assert.match(app,/if \(result\.kind === "stale"\) return/);
 assert.match(app,/if \(result\.kind === "failed"\)/);
 assert.match(app,/document\.visibilityState === "visible" && navigator\.onLine/);
 assert.match(app,/setInterval\(refreshVisibleOrders, 15000\)/);
 assert.match(app,/window\.addEventListener\("focus", refreshVisibleOrders\)/);
 assert.match(app,/document\.addEventListener\("visibilitychange", refreshVisibleOrders\)/);
 assert.match(app,/window\.addEventListener\("online", refreshVisibleOrders\)/);
 for(const name of ["focus","visibilitychange","online"])
  assert.match(app,new RegExp("removeEventListener\\(\\\""+name+"\\\", refreshVisibleOrders\\)"));
 assert.match(api,/\/api\/v1\/merchant\/orders/);
 assert.match(policy,/VITE_PICKUP_ORDERING_ENABLED === "true"/);
});

test("a failed authoritative read shows an explicit warning and manual Retry, not a fake empty inbox",()=>{
 assert.match(app,/orderReadStatus\.state === "failed"/);
 assert.match(app,/role="alert"/);
 assert.match(app,/Order list could not be verified/);
 assert.match(app,/do not assume there are no new orders/);
 assert.match(app,/Last confirmed sync/);
 assert.match(app,/Retry order sync/);
 assert.match(app,/onClick=\{\(\) => void fetchOrders\(\)\}/);
 assert.doesNotMatch(app,/localStorage\.setItem\(["']localeats_cached_orders/);
 assert.match(app,/setOrders\(combinedOrders\)/);
});


test("changing verified shop clears prior orders before paint, including failed refresh",()=>{
 assert.match(app,/useLayoutEffect\(\(\)=>\{/);
 assert.match(app,/orderReadCoordinator\.current\.activate\(orderReadScope\);\s*setOrders\(\[\]\);/);
 assert.match(app,/\},\[orderReadScope\]\);/);
});
