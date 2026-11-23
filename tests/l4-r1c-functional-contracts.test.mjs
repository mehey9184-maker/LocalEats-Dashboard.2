import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (name) => readFileSync(new URL("../" + name, import.meta.url), "utf8");
const app = read("src/App.tsx");
const orders = read("src/components/OrdersManagement.tsx");
const bridge = read("src/lib/supabase.ts");
const monitor = read("src/components/ConnectivityMonitor.tsx");
const marketing = read("src/components/Marketing.tsx");

test("L4-R1C queued printer retry receives actual queued receipt bytes", () => {
  assert.match(orders, /retryQueuedPrintDirect\\?: \\(job: QueuedPrintJob\\) => Promise<void>/);
  assert.match(orders, /onClick=\\{\\(\\) => retryQueuedPrintDirect\\?\\.\\(job\\)\\}/);
  assert.doesNotMatch(orders, /retryQueuedPrintDirect\\?\\.\\(job\\.id\\)/);
  assert.match(app, /const bytes = new Uint8Array\\(job\\.binaryData\\)/);
});

test("L4-R1C bulk delete cannot call unaudited direct-database order deletion", () => {
  assert.match(app, /Bulk order deletion is unavailable during the pickup pilot/);
  assert.doesNotMatch(app, /OrderService\\.deleteAllOrdersForShops/);
  assert.doesNotMatch(app, /Confirm Delete All/);
});

test("L4-R1C legacy profile updates fail closed rather than falsely report saved", () => {
  assert.match(bridge, /async updateUser\\(attributes\\?: Record<string, unknown>\\)/);
  assert.match(bridge, /data: \\{ user: null \\}/);
  assert.match(bridge, /No changes were saved/);
  assert.doesNotMatch(bridge, /data: \\{ user: auth\\.currentUser, \\.\\.\\.attributes \\}, error: null/);
});

test("L4-R1C availability uses API authority, not injected Firestore writes", () => {
  assert.doesNotMatch(app, /getFirestoreShopById/);
  assert.match(app, /syncShopAvailability\\(\\{/);
  const availability = read("src/utils/availabilityChecker.ts");
  assert.match(availability, /MerchantApi\\.setAvailability\\(/);
});

test("L4-R1C source interfaces are typed to their actual adapters", () => {
  assert.match(monitor, /typeof import\\('\\.\\.\\/lib\\/supabase'\\)\\.supabase/);
  assert.match(monitor, /ReturnType<typeof getFreshChannel>/);
  assert.doesNotMatch(monitor, /supabase: SupabaseClient;/);
  assert.match(marketing, /import \\{ Shop, MenuItem, Order, type User \\} from "\\.\\.\\/types"/);
  assert.doesNotMatch(marketing, /import type \\{ User \\} from "@supabase\\/supabase-js"/);
});
