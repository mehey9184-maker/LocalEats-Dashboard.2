import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import express from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createCatalogRouter, PUBLIC_SHOP_FIELDS, PUBLIC_MENU_FIELDS } from "./catalog.js";

type Row = Record<string, unknown>;
const shops: Row[] = [
  { id: "open", approval_status: "approved", archived_at: null, is_active: true },
  { id: "offline", approval_status: "approved", archived_at: null, is_active: false },
  ...["pending", "rejected", "suspended"].map((status) => ({ id: status, approval_status: status, archived_at: null, is_active: true })),
  { id: "archived", approval_status: "approved", archived_at: "2026-01-01", is_active: true },
].map((row) => ({ ...row, name: row.id, latitude: null, longitude: null, owner_id: "private-owner", approval_reason: "private-reason", firebase_uid: "private-uid" }));

function fixture(failTable?: string, throws = false) {
  const calls: Array<{ table: string; select?: string }> = [];
  const db = {
    from(table: string) {
      const call = { table, select: undefined as string | undefined };
      calls.push(call);
      let rows = table === "shops" ? [...shops] : [
        { id: "menu-original", shop_id: "open", name: "Meal", price: 25, is_available: false, owner_id: "private-owner" },
        { id: "foreign", shop_id: "pending", name: "Other", price: 9 },
      ];
      const result = (single = false) => {
        if (table === failTable && throws) throw new Error("private database detail");
        return { data: table === failTable ? null : single ? rows[0] ?? null : rows, error: table === failTable ? { message: "private database detail" } : null };
      };
      const query = {
        select(fields: string) { call.select = fields; return query; },
        returns() { return query; },
        eq(field: string, value: unknown) { rows = rows.filter((row) => row[field] === value); return query; },
        is(field: string, value: unknown) { rows = rows.filter((row) => row[field] === value); return query; },
        maybeSingle() { return Promise.resolve().then(() => result(true)); },
        then(resolve: (value: ReturnType<typeof result>) => unknown, reject: (reason: unknown) => unknown) {
          return Promise.resolve().then(() => result()).then(resolve, reject);
        },
      };
      return query;
    },
  };
  const app = express();
  app.use("/api/v1/catalog", createCatalogRouter(db as unknown as Pick<SupabaseClient, "from">));
  return { app, calls };
}

async function request(path: string, failTable?: string, throws = false) {
  const { app, calls } = fixture(failTable, throws);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/catalog${path}`);
    return { status: response.status, body: await response.json(), calls };
  } finally {
    const closed = once(server, "close");
    server.close();
    await closed;
  }
}

test("approved unarchived shop is public without authentication", async () => {
  const r = await request("/shops");
  assert.equal(r.status, 200);
  assert.ok(r.body.shops.some((s: Row) => s.id === "open"));
});
test("approved inactive shop remains visible and inactive", async () => {
  const r = await request("/shops");
  assert.equal(r.body.shops.find((s: Row) => s.id === "offline").is_active, false);
});
for (const id of ["pending", "rejected", "suspended", "archived"]) {
  test(`${id} shop excluded from listing`, async () => {
    const r = await request("/shops");
    assert.equal(r.body.shops.some((s: Row) => s.id === id), false);
  });
}
test("individual approved shop preserves null coordinates", async () => {
  const r = await request("/shops/open");
  assert.equal(r.status, 200);
  assert.equal(r.body.shop.id, "open");
  assert.equal(r.body.shop.latitude, null);
});
for (const id of ["pending", "rejected", "suspended", "archived", "missing"]) {
  for (const suffix of ["", "/menu"]) {
    test(`${id}${suffix} returns identical generic 404 before any menu query`, async () => {
      const r = await request(`/shops/${id}${suffix}`);
      assert.equal(r.status, 404);
      assert.deepEqual(r.body, { success: false, error: "Shop not found" });
      assert.equal(r.calls.some((call) => call.table === "menu_items"), false);
    });
  }
}
test("approved shop menu preserves IDs, prices and availability and excludes foreign items", async () => {
  const r = await request("/shops/open/menu");
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.menu, [{ id: "menu-original", shop_id: "open", name: "Meal", price: 25, is_available: false }]);
  assert.deepEqual(r.calls.map((call) => call.table), ["shops", "menu_items"]);
});
for (const field of ["owner_id", "approval_reason", "firebase_uid", "approval_status", "archived_at"]) {
  test(`${field} never exposed even if database returns excess columns`, async () => {
    for (const path of ["/shops", "/shops/open", "/shops/open/menu"]) {
      const r = await request(path);
      assert.equal(JSON.stringify(r.body).includes(field), false);
    }
  });
}
test("explicit public shop select on every endpoint", async () => {
  assert.deepEqual([...PUBLIC_SHOP_FIELDS], ["id", "name", "description", "location", "category", "logo_url", "rating", "opening_time", "closing_time", "is_active", "latitude", "longitude", "lat", "lng", "story"]);
  for (const path of ["/shops", "/shops/open", "/shops/open/menu"]) {
    const r = await request(path);
    assert.equal(r.calls[0].select, PUBLIC_SHOP_FIELDS.join(","));
    assert.equal(r.calls[0].select?.includes("*"), false);
  }
});
test("explicit public menu select", async () => {
  assert.deepEqual([...PUBLIC_MENU_FIELDS], ["id", "shop_id", "name", "price", "description", "image_url", "category", "is_available", "popularity_score", "customizations", "created_at"]);
  const r = await request("/shops/open/menu");
  assert.equal(r.calls[1].select, PUBLIC_MENU_FIELDS.join(","));
});
test("catalog has no Firestore dependency and is mounted", () => {
  const source = readFileSync("src/routes/catalog.ts", "utf8");
  assert.doesNotMatch(source, /firestore|firebase|fake|mock/i);
  assert.match(readFileSync("src/server.ts", "utf8"), /app\.use\("\/api\/v1\/catalog", catalogRoutes\)/);
});
for (const [path, table] of [["/shops", "shops"], ["/shops/open", "shops"], ["/shops/open/menu", "shops"], ["/shops/open/menu", "menu_items"]]) {
  for (const throws of [false, true]) {
    test(`safe 500 for ${path} ${table} ${throws ? "exception" : "database error"}`, async () => {
      const r = await request(path, table, throws);
      assert.equal(r.status, 500);
      assert.deepEqual(r.body, { success: false, error: "Internal Server Error" });
    });
  }
}
