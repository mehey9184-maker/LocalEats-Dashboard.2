import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (name) => readFileSync(new URL("../" + name, import.meta.url), "utf8");
const app = read("src/App.tsx");
const orders = read("src/components/OrdersManagement.tsx");
const bridge = read("src/lib/supabase.ts");
const monitor = read("src/components/ConnectivityMonitor.tsx");
const marketing = read("src/components/Marketing.tsx");

test("L4-R1C queued printer retry receives the queued receipt bytes", () => {
  assert.ok(orders.includes("retryQueuedPrintDirect?: (job: QueuedPrintJob) => Promise<void>"));
  assert.ok(orders.includes("onClick={() => retryQueuedPrintDirect?.(job)}"));
  assert.ok(!orders.includes("retryQueuedPrintDirect?.(job.id)"));
  assert.ok(app.includes("const bytes = new Uint8Array(job.binaryData)"));
});

test("L4-R1C bulk delete is unavailable without an approved retention API", () => {
  assert.ok(app.includes("Bulk order deletion is unavailable during the pickup pilot"));
  assert.ok(!app.includes("OrderService.deleteAllOrdersForShops"));
  assert.ok(!app.includes("Confirm Delete All"));
});

test("L4-R1C legacy profile updates fail closed instead of falsely saving", () => {
  assert.ok(bridge.includes("async updateUser(attributes?: Record<string, unknown>)"));
  assert.ok(bridge.includes("data: { user: null }"));
  assert.ok(bridge.includes("No changes were saved."));
  assert.ok(!bridge.includes("data: { user: auth.currentUser, ...attributes }, error: null"));
});

test("L4-R1C availability only invokes the server-authoritative API", () => {
  assert.ok(!app.includes("getFirestoreShopById"));
  assert.ok(app.includes("syncShopAvailability({"));
  const availability = read("src/utils/availabilityChecker.ts");
  assert.ok(availability.includes("MerchantApi.setAvailability("));
});

test("L4-R1C type interfaces reflect actual Firebase and merchant adapters", () => {
  assert.ok(monitor.includes("typeof import('../lib/supabase').supabase"));
  assert.ok(monitor.includes("ReturnType<typeof getFreshChannel>"));
  assert.ok(!monitor.includes("supabase: SupabaseClient;"));
  assert.ok(marketing.includes('import { Shop, MenuItem, Order, type User } from "../types"'));
  assert.ok(!marketing.includes('import type { User } from "@supabase/supabase-js"'));
});
