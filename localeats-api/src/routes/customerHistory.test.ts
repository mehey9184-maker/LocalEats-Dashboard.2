import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { authAdmin } from "../lib/firebaseAdmin.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { customerOrderRoutes } from "./orders.js";
import { customerHistoryBefore } from "../orders/customerHistory.js";
import { configureApiCacheSafety } from "../middleware/apiCacheSafety.js";

test("history cursor accepts precise server timestamps and rejects query injection", () => {
  assert.equal(customerHistoryBefore({}), null);
  const valid = { before_id: "550e8400-e29b-41d4-a716-446655440000", before_created_at: "2026-11-18T10:00:00.123456+00:00" };
  assert.match(customerHistoryBefore(valid)!, /123456\+00:00/);
  for (const value of [
    { ...valid, before_id: "x),user_id.eq.other" },
    { ...valid, before_created_at: "2026-11-18),user_id.eq.other" },
    { before_id: valid.before_id }, { before_created_at: valid.before_created_at },
    { ...valid, before_id: [valid.before_id] }, { ...valid, before_created_at: "invalid" },
  ]) assert.throws(() => customerHistoryBefore(value));
});

test("authenticated history reads 101 owned orders without gaps, including tied timestamps and new arrivals", async () => {
  const originalFrom = supabaseAdmin.from;
  const originalVerify = authAdmin.verifyIdToken;
  const id = (n: number) => `550e8400-e29b-41d4-a716-${String(n).padStart(12, "0")}`;
  const rows = Array.from({ length: 101 }, (_, i) => ({
    id: id(i + 1), user_id: "customer", delivery_type: "collection",
    created_at: "2026-11-18T10:00:00.123456+00:00", create_intent_hash: "private",
  }));
  rows.push({ ...rows[0]!, id: id(999), user_id: "other" });
  rows.push({ ...rows[0]!, id: id(998), delivery_type: "delivery" });
  let unavailable = false;
  const reads: string[] = [];
  Object.assign(authAdmin,{verifyIdToken:async (token: string) => ({ uid: token })});
  Object.assign(supabaseAdmin,{from:(table: string) => {
    assert.equal(table, "orders");
    let owner = "", before = "", limit = 0, collectionOnly = false;
    const ordering: string[] = [];
    type Query = {
      select:()=>Query;
      eq:(key:string,value:string)=>Query;
      or:(value:string)=>Query;
      order:(key:string,options:{ascending:boolean})=>Query;
      limit:(value:number)=>Query;
      then:(resolve:(value:{data:typeof rows;error:{message:string}|null})=>unknown)=>Promise<unknown>;
    };
    const q: Query = {
      select: () => q,
      eq: (key: string, value: string) => {
        if (key === "user_id") { owner = value; reads.push(value); }
        else { assert.equal(key, "delivery_type"); assert.equal(value, "collection"); collectionOnly = true; }
        return q;
      },
      or: (value: string) => { before = value; return q; },
      order: (key: string, options: { ascending: boolean }) => {
        assert.equal(options.ascending, false); ordering.push(key); return q;
      },
      limit: (value: number) => { limit = value; return q; },
      then: (resolve: (result: unknown) => void) => {
        assert.deepEqual(ordering, ["created_at", "id"]);
        assert.equal(limit, 51);
        assert.equal(collectionOnly, true);
        const cursor = before.match(/id\.lt\.([0-9a-f-]+)/)?.[1];
        const data = rows.filter(row => row.user_id === owner && row.delivery_type === "collection" && (!cursor || row.id < cursor))
          .sort((a, b) => b.id.localeCompare(a.id)).slice(0, limit);
        return Promise.resolve({ data, error: unavailable ? { message: "offline" } : null }).then(resolve);
      },
    };
    return q;
  }});
  const app = express();
  configureApiCacheSafety(app);
  app.use("/api/v1/orders", customerOrderRoutes);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/orders/history`;
  const read = (query = "", owner = "customer") => fetch(base + query, {
    headers: owner ? { Authorization: "Bearer fb-" + owner } : {},
  });
  try {
    assert.equal((await read("", "")).status, 401);
    const firstResponse = await read();
    assert.equal(firstResponse.headers.get("cache-control"), "no-store");
    const first = await firstResponse.json();
    assert.equal(first.orders.length, 50);
    assert.equal(first.has_more, true);
    assert.equal(first.orders[0].create_intent_hash, undefined);
    rows.push({ ...rows[0]!, id: id(102) });
    const before = (row: { id: string; created_at: string }) =>
      "?" + new URLSearchParams({ before_id: row.id, before_created_at: row.created_at });
    const second = await (await read(before(first.orders.at(-1)))).json();
    const third = await (await read(before(second.orders.at(-1)))).json();
    assert.equal(second.orders.length, 50);
    assert.equal(third.orders.length, 1);
    assert.equal(third.has_more, false);
    const all = [...first.orders, ...second.orders, ...third.orders];
    assert.equal(new Set(all.map(row => row.id)).size, 101);
    assert.ok(all.every(row => row.user_id === "customer"));
    assert.ok(all.every(row => row.delivery_type === "collection"));
    assert.equal((await (await read("", "other")).json()).orders.length, 1);
    const beforeInvalid = reads.length;
    assert.equal((await read("?before_id=bad&before_created_at=bad")).status, 400);
    assert.equal(reads.length, beforeInvalid);
    unavailable = true;
    assert.equal((await read()).status, 503);
  } finally {
    supabaseAdmin.from = originalFrom;
    authAdmin.verifyIdToken = originalVerify;
    server.closeAllConnections();
    server.close();
  }
});
