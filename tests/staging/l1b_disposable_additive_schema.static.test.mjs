// L1B static acceptance: no remote database, no credentials, no SQL execution.
// A disposable Postgres 17 integration test and actual backup recovery remain required.
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const sql=readFileSync(new URL("../../security/drafts/l1b_pickup_additive_DISPOSABLE_REHEARSAL_ONLY.sql",import.meta.url),"utf8");
const normalized=sql.replace(/--[^\n]*/g,"").replace(/\s+/g," ").toLowerCase();

test("L1B refuses to execute outside isolated disposable database",()=>{
  assert.match(sql,/current_database\(\) <> 'localeats_l1b_disposable'/);
  assert.match(sql,/current_user <> 'postgres'/);
  assert.match(sql,/RAISE EXCEPTION 'L1B_DISPOSABLE_DATABASE_ONLY'/);
  assert.match(sql,/SET LOCAL lock_timeout='5s'/);
  assert.match(sql,/SET LOCAL statement_timeout='30s'/);
});
test("L1B only adds orders and pickup_order_events, preserves existing P5/catalogue",()=>{
  const tables=[...normalized.matchAll(/create\s+table\s+public\.([a-z_]+)/g)].map(x=>x[1]);
  assert.deepEqual(tables,["orders","pickup_order_events"]);
  assert.doesNotMatch(normalized,/\b(drop|truncate)\s+(?:table|schema)\b/);
  assert.doesNotMatch(normalized,/\balter\s+table\s+public\.(?:profiles|shops|menu_items)\b/);
  assert.doesNotMatch(normalized,/\bcreate\s+(?:or\s+replace\s+)?view\s+public\.shops_with_availability\b/);
  assert.match(normalized,/public\.shops\(id\) on delete restrict/);
  assert.match(normalized,/public\.orders\(id\) on delete restrict/);
  assert.match(normalized,/public\.shops\)<>5/);
  assert.match(normalized,/public\.menu_items\)<>3/);
});
test("L1B stores UUID order/events, text shop and Firebase UIDs with unique idempotency and revisions",()=>{
  assert.match(normalized,/id uuid primary key default gen_random_uuid\(\)/);
  assert.match(normalized,/shop_id text not null references public\.shops\(id\)/);
  assert.match(normalized,/user_id text not null/);
  assert.match(normalized,/idempotency_key text not null unique/);
  assert.match(normalized,/create_intent_hash text not null/);
  assert.match(normalized,/revision bigint not null default 0 check \(revision >= 0\)/);
  assert.match(normalized,/unique \(order_id, command_id\)/);
  assert.match(normalized,/unique \(order_id, revision\)/);
});
test("L1B rejects delivery, rider, credit, money surprises and unsupported payment methods",()=>{
  assert.match(normalized,/check \(delivery_type='collection'\)/);
  assert.match(normalized,/rider_id uuid check \(rider_id is null\)/);
  assert.match(normalized,/payment_method in \('cash','card_machine'\)/);
  assert.match(normalized,/delivery_fee=0/);
  assert.match(normalized,/discount_amount=0/);
  assert.match(normalized,/tip_amount=0/);
  assert.match(normalized,/total_price=price\+service_fee\+delivery_fee-discount_amount\+tip_amount/);
  assert.match(normalized,/jsonb_array_length\(items\) between 1 and 50/);
});
test("L1B fail-closed privileges: RLS FORCE; service_role SELECT only, no browser access or RPC",()=>{
  assert.match(normalized,/alter table public\.orders force row level security/);
  assert.match(normalized,/alter table public\.pickup_order_events force row level security/);
  assert.match(normalized,/revoke all on public\.orders,public\.pickup_order_events from public,anon,authenticated,service_role/);
  assert.match(normalized,/grant select on public\.orders,public\.pickup_order_events to service_role/);
  assert.doesNotMatch(normalized,/\bgrant\s+(insert|update|delete|all|execute)\b/);
  assert.doesNotMatch(normalized,/\bcreate\s+(?:or replace\s+)?function\b/);
  assert.doesNotMatch(normalized,/\bsecurity\s+definer\b/);
  assert.match(normalized,/has_table_privilege\('service_role','public.orders','insert'\)/);
});
