import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import express, { type RequestHandler } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createMerchantMenuRouter, MERCHANT_MENU_FIELDS } from "./merchantMenu.js";
import { authenticateFirebase, type AuthenticatedRequest } from "../middleware/authenticateFirebase.js";

type Row = Record<string, unknown>;
type Call = { table: string; select?: string; operation: string; filters: [string, unknown][]; input?: Row };
function fixture(failure?: string) {
  const calls: Call[] = [];
  const shops: Row[] = [
    { id: "owned", owner_id: "merchant", archived_at: null, approval_status: "approved", is_active: true },
    { id: "pending", owner_id: "merchant", archived_at: null, approval_status: "pending", is_active: false },
    { id: "offline", owner_id: "merchant", archived_at: null, approval_status: "approved", is_active: false },
    { id: "archived", owner_id: "merchant", archived_at: "2026-01-01" },
    { id: "foreign", owner_id: "other", archived_at: null },
  ];
  const menus: Row[] = shops.map((shop) => ({
    id: shop.id + "-item", shop_id: shop.id, name: "Meal", price: 25, is_available: true,
    description: null, image_url: null, category: "Mains", created_at: "2026-01-01",
    owner_id: "private", approval_reason: "private", internal: "private",
  }));
  const db = { from(table: string) {
    const call: Call = { table, operation: "read", filters: [] };
    calls.push(call);
    const rows = table === "shops" ? shops : menus;
    const result = (single = false) => {
      if (failure === table + ":throw") throw new Error("private database detail");
      if (failure === table || failure === call.operation) return { data: null, error: { message: "private database detail" } };
      let selected = rows.filter((row) => call.filters.every(([key, value]) => row[key] === value));
      if (call.operation === "insert") {
        selected = [{ ...call.input, id: "database-id", created_at: "database-time", owner_id: "private" }];
      }
      if (call.operation === "update") selected = selected.map((row) => ({ ...row, ...call.input }));
      return { data: single ? selected[0] ?? null : selected, error: null };
    };
    const query = {
      select(fields: string) { call.select = fields; return query; },
      eq(key: string, value: unknown) { call.filters.push([key, value]); return query; },
      is(key: string, value: unknown) { call.filters.push([key, value]); return query; },
      insert(input: Row) { call.operation = "insert"; call.input = input; return query; },
      update(input: Row) { call.operation = "update"; call.input = input; return query; },
      returns() { return query; },
      single() { return Promise.resolve().then(() => result(true)); },
      maybeSingle() { return Promise.resolve().then(() => result(true)); },
      then(resolve: (value: ReturnType<typeof result>) => unknown, reject: (error: unknown) => unknown) {
        return Promise.resolve().then(() => result()).then(resolve, reject);
      },
    };
    return query;
  }};
  return { db: db as unknown as Pick<SupabaseClient, "from">, calls };
}

const fakeAuth: RequestHandler = (req: AuthenticatedRequest, _res, next) => {
  req.authUser = { uid: "merchant", email: null }; next();
};
async function request(method: string, path = "", body?: unknown, failure?: string, auth: RequestHandler = fakeAuth) {
  const { db, calls } = fixture(failure);
  const app = express();
  app.use(express.json());
  app.use("/api/v1/merchant/menu", createMerchantMenuRouter(db, auth));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/merchant/menu${path}`, {
      method, headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json(), calls };
  } finally {
    const closed = once(server, "close"); server.close(); await closed;
  }
}
const create = { shop_id: "owned", name: " Meal ", price: 20 };

for (const method of ["GET", "POST", "PATCH"]) {
  test(`${method} rejects unauthenticated caller without database calls`, async () => {
    const r = await request(method, method === "PATCH" ? "/owned-item" : "", undefined, undefined, authenticateFirebase);
    assert.equal(r.status, 401); assert.deepEqual(r.calls, []);
  });
}
for (const shop of ["owned", "pending", "offline"]) {
  test(`${shop} current shop can read and create menu`, async () => {
    const r = await request("GET", "?shop_id=" + shop);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.menu.map((item: Row) => item.shop_id), [shop]);
    assert.equal((await request("POST", "", { ...create, shop_id: shop })).status, 201);
    assert.equal((await request("PATCH", "/" + shop + "-item", { price: 12 })).status, 200);
  });
}
for (const shop of ["archived", "foreign", "missing"]) {
  test(`${shop} shop blocked with generic 404 before menu read/insert`, async () => {
    for (const method of ["GET", "POST"]) {
      const r = await request(method, method === "GET" ? "?shop_id=" + shop : "", method === "POST" ? { ...create, shop_id: shop } : undefined);
      assert.equal(r.status, 404);
      assert.deepEqual(r.body, { success: false, error: "Shop not found" });
      assert.deepEqual(r.calls.map((call) => call.table), ["shops"]);
    }
  });
}
test("GET uses exact ownership and shop filters, explicit selects and response allowlist", async () => {
  const r = await request("GET", "?shop_id=owned");
  assert.deepEqual(r.calls[0].filters, [["id", "owned"], ["owner_id", "merchant"], ["archived_at", null]]);
  assert.deepEqual(r.calls[1].filters, [["shop_id", "owned"]]);
  assert.equal(r.calls[0].select, "id");
  assert.equal(r.calls[1].select, MERCHANT_MENU_FIELDS.join(","));
  assert.ok(Object.keys(r.body.menu[0]).every((key) => (MERCHANT_MENU_FIELDS as readonly string[]).includes(key)));
});
test("create checks ownership first and returns real database id/time, not client data", async () => {
  const r = await request("POST", "", create);
  assert.equal(r.status, 201);
  assert.deepEqual(r.calls.map((call) => [call.table, call.operation]), [["shops", "read"], ["menu_items", "insert"]]);
  assert.equal(r.calls[1].input?.name, "Meal");
  assert.equal(r.body.item.id, "database-id");
  assert.equal(r.body.item.created_at, "database-time");
  assert.equal(r.body.item.owner_id, undefined);
  assert.equal(r.calls[1].select, MERCHANT_MENU_FIELDS.join(","));
});
for (const field of ["id", "owner_id", "popularity_score", "created_at", "stock_quantity", "dietary_tags", "updated_at", "approval_status", "firebase_uid", "customizations", "unknown"]) {
  test(`create and PATCH reject authority/unsupported field ${field}`, async () => {
    for (const method of ["POST", "PATCH"]) {
      const r = await request(method, method === "PATCH" ? "/owned-item" : "", { ...(method === "POST" ? create : { price: 20 }), [field]: "forbidden" });
      assert.equal(r.status, 400); assert.deepEqual(r.calls, []);
    }
  });
}
for (const price of [-1, "20", null, Infinity, -Infinity, NaN]) {
  test(`reject invalid price ${String(price)}`, async () => {
    for (const method of ["POST", "PATCH"]) {
      const r = await request(method, method === "PATCH" ? "/owned-item" : "", { ...(method === "POST" ? create : {}), price });
      assert.equal(r.status, 400); assert.deepEqual(r.calls, []);
    }
  });
}
test("PATCH resolves actual item, then ownership, then constrained update", async () => {
  const r = await request("PATCH", "/owned-item", { price: 0 });
  assert.equal(r.status, 200);
  assert.deepEqual(r.calls.map((call) => [call.table, call.operation]), [["menu_items", "read"], ["shops", "read"], ["menu_items", "update"]]);
  assert.equal(r.calls[0].select, "id,shop_id");
  assert.deepEqual(r.calls[1].filters, [["id", "owned"], ["owner_id", "merchant"], ["archived_at", null]]);
  assert.deepEqual(r.calls[2].filters, [["id", "owned-item"], ["shop_id", "owned"]]);
  assert.equal(r.calls[2].select, MERCHANT_MENU_FIELDS.join(","));
  assert.equal(r.body.item.price, 0);
  assert.equal(r.body.item.owner_id, undefined);
});
for (const id of ["foreign-item", "archived-item", "missing-item"]) {
  test(`${id} update returns same safe 404 with no mutation`, async () => {
    const r = await request("PATCH", "/" + id, { price: 10 });
    assert.equal(r.status, 404);
    assert.deepEqual(r.body, { success: false, error: "Menu item not found" });
    assert.ok(r.calls.every((call) => call.operation === "read"));
  });
}
test("PATCH cannot reassign shop", async () => {
  assert.equal((await request("PATCH", "/owned-item", { shop_id: "foreign" })).status, 400);
});
test("availability PATCH returns confirmed false value", async () => {
  const r = await request("PATCH", "/owned-item", { is_available: false });
  assert.equal(r.status, 200); assert.equal(r.body.item.is_available, false);
});
for (const failure of ["shops", "menu_items", "shops:throw", "menu_items:throw", "insert", "update"]) {
  test(`safe generic 500 on ${failure} failure`, async () => {
    const method = failure === "insert" ? "POST" : failure === "update" ? "PATCH" : "GET";
    const r = await request(method, method === "PATCH" ? "/owned-item" : method === "GET" ? "?shop_id=owned" : "", method === "GET" ? undefined : method === "POST" ? create : { price: 1 }, failure);
    assert.equal(r.status, 500);
    assert.deepEqual(r.body, { success: false, error: "Internal Server Error" });
  });
}
for (const input of [{}, { name: " " }, { category: 1 }, { category: "" }, { description: {} }, { is_available: "false" }, { image_url: "http://example.com/a.png" }, { image_url: "javascript:alert(1)" }, { image_url: "https://user:pass@example.com/a" }]) {
  test(`PATCH rejects invalid body ${JSON.stringify(input)}`, async () => {
    assert.equal((await request("PATCH", "/owned-item", input)).status, 400);
  });
}
test("Cloudinary HTTPS and nullable description/image accepted", async () => {
  assert.equal((await request("POST", "", { ...create, image_url: "https://res.cloudinary.com/example/image/upload/meal.jpg", description: null })).status, 201);
  assert.equal((await request("PATCH", "/owned-item", { image_url: null, description: null })).status, 200);
});
test("missing or ambiguous GET shop id rejected", async () => {
  for (const path of ["", "?shop_id=", "?shop_id=owned&shop_id=foreign"]) assert.equal((await request("GET", path)).status, 400);
});
test("router has no Firestore dependency", () => {
  const source = readFileSync(new URL("../../src/routes/merchantMenu.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /firestore|select\(["']\*["']\)/i);
});
test("merchant router is mounted separately from unchanged public catalog", () => {
  const source = readFileSync(new URL("../../src/server.ts", import.meta.url), "utf8");
  assert.ok(source.includes('app.use("/api/v1/merchant/menu", merchantMenuRoutes)'));
  assert.ok(source.includes('app.use("/api/v1/catalog", catalogRoutes)'));
});
const sourceRoot = new URL("../../../src/", import.meta.url);
for (const file of ["components/MenuManagement.tsx", "components/AIMenuScannerModal.tsx", "App.tsx"]) {
  test(`${file} uses MerchantApi and has no competing menu authority`, () => {
    const source = readFileSync(new URL(file, sourceRoot), "utf8");
    assert.match(source, /MerchantApi\.getMenu/);
    assert.doesNotMatch(source, /\.from\(\s*["']menu_items["']\s*\)/);
    assert.doesNotMatch(source, /(?:get|create|update|delete)FirestoreMenuItem|subscribeToMenuItemsFirestore/);
  });
}
test("editor quick mutations and scanner imports use API, no unsupported persisted fields", () => {
  const editor = readFileSync(new URL("components/MenuManagement.tsx", sourceRoot), "utf8");
  const scanner = readFileSync(new URL("components/AIMenuScannerModal.tsx", sourceRoot), "utf8");
  assert.match(editor, /MerchantApi\.updateMenuItem\(item.id, \{ is_available:/);
  assert.match(editor, /MerchantApi\.updateMenuItem\(itemId, \{ price \}/);
  assert.match(scanner, /MerchantApi\.createMenuItem/);
  assert.doesNotMatch(editor + scanner, /stock_quantity|dietary_tags|updated_at|localeats_offline_menu_items/);
});
test("legacy offline menu replay retired, never counted as synced", () => {
  const source = readFileSync(new URL("utils/offlineSyncQueue.ts", sourceRoot), "utf8");
  assert.doesNotMatch(source, /updateFirestoreMenuItem/);
  const menuBranch = source.slice(source.indexOf('else if (item.type === "UPDATE_MENU"'), source.indexOf("} catch (err)", source.indexOf('else if (item.type === "UPDATE_MENU"')));
  assert.match(menuBranch, /removeQueuedMutation/);
  assert.doesNotMatch(menuBranch, /syncedCount\+\+/);
});
test("App and editor replace empty API menus and cannot restore a stale menu cache", () => {
  const app = readFileSync(new URL("App.tsx", sourceRoot), "utf8");
  const loader = app.slice(app.indexOf("const fetchAllMenuItems ="), app.indexOf("const fetchShops =", app.indexOf("const fetchAllMenuItems =")));
  const editor = readFileSync(new URL("components/MenuManagement.tsx", sourceRoot), "utf8");
  assert.match(loader, /setMenuItems\(menus\.flat\(\)/);
  assert.doesNotMatch(loader, /localStorage|restoreVerifiedCachedMenuItems|finalItems.length/);
  assert.doesNotMatch(editor, /localeats_cached_menu_items|localeats_menu_/);
  assert.match(loader, /version === menuLoadVersion.current/);
  assert.match(editor, /version === requestVersion.current/);
});
