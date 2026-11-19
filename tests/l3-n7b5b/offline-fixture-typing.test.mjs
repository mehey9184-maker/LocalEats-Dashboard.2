import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");

test("Offline Supabase fixture stays typed and cannot send hosted requests", () => {
  const source=read("tests/l3-n6b/fixture-supabase.ts");
  assert.match(source,/interface OfflineChain/);
  assert.match(source,/Promise<EmptyResult>/);
  assert.match(source,/data:\[\],error:null/);
  assert.doesNotMatch(source,/\bany\b|\bfetch\s*\(|createClient\s*\(|https?:\/\//);
});

test("Original Orders fixture retains exact merchant ownership, isolation and mutation rejection", () => {
  const source=read("tests/l3-n6b/fixture-entry.tsx");
  assert.doesNotMatch(source,/\bany\b/);
  assert.match(source,/MerchantApi\.getMerchantShop\(\)/);
  assert.match(source,/verified\.owner_id!==uid/);
  assert.match(source,/actualOrders\.some\(o=>String\(o\.shop_id\)!==String\(verified\.id\)\)/);
  assert.match(source,/setFixtureUid\(next\)/);
  assert.match(source,/L3-N6B no mutations/);
  assert.match(source,/OrdersManagement/);
});

test("Legacy pickup fixture retains no-write synthetic account switching", () => {
  const source=read("tests/l3-n6/fixture-entry.tsx");
  assert.doesNotMatch(source,/\bany\b/);
  assert.match(source,/setFixtureUid\(next\)/);
  assert.match(source,/MerchantApi\.getOrders\(\)/);
  assert.match(source,/No actual orders, customers, payments, or notification sends/);
  assert.match(source,/PickupOrderActions/);
});
