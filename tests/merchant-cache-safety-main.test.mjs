import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const cleanup = readFileSync(new URL("../src/utils/storageCleanup.ts", import.meta.url), "utf8");

test("Merchant orders stay memory-only after authenticated reads", () => {
  assert.match(app,/setOrders\(combinedOrders\)/);
  assert.doesNotMatch(app,/localStorage\.setItem\(["']localeats_cached_orders/);
  assert.doesNotMatch(app,/localStorage\.getItem\(["']localeats_cached_orders/);
  assert.match(app,/const data = await MerchantApi\.getOrders\(\)/);
});

test("offline screen never promises automatic replay or confirmed orders from cache", () => {
  assert.match(app,/Safe Connection Recovery/);
  assert.match(app,/business changes need online server confirmation/);
  assert.match(app,/Offline actions are not automatically submitted/);
  assert.doesNotMatch(app,/Your cached updates will transparently merge/);
});

test("cleanup removes unscoped old orders but preserves owned preferences and login", () => {
  const output = ts.transpileModule(cleanup,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const data = new Map([
    ["localeats_cached_orders", JSON.stringify([{id:"private",phone:"+2712345"}])],
    ["sb-auth-token", "signed-in-session"],
    ["localeats_shop_settings_123", JSON.stringify({theme:"light"})],
    ["localeats_manual_status_override_123","false"],
    ["localeats_preferred_theme","dark"],
  ]);
  const storage = { get length(){return data.size;},
    key:i=>[...data.keys()][i]??null, getItem:k=>data.get(k)??null,
    removeItem:k=>data.delete(k), setItem:(k,v)=>data.set(k,v)};
  const exports = {};
  vm.runInNewContext(output,{exports,localStorage:storage,
    window:{localStorage:storage},console:{log(){},warn(){}},Date});
  const result = exports.cleanLocalStorageCache();
  assert.deepEqual([...result.clearedKeys],["localeats_cached_orders"]);
  assert.equal(data.has("localeats_cached_orders"),false);
  assert.equal(data.get("sb-auth-token"),"signed-in-session");
  assert.equal(data.get("localeats_shop_settings_123"),JSON.stringify({theme:"light"}));
  assert.equal(data.get("localeats_manual_status_override_123"),"false");
});
