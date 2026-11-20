import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync(new URL("../../supabase/staging-only/L3_N8O_PICKUP_ORDERS_HARD_OFF.sql",import.meta.url),"utf8");
const idx=readFileSync(new URL("../../supabase/staging-only/L3_N8O_PICKUP_OUTBOX_INDEX.sql",import.meta.url),"utf8");
test("N8O staging schema source hard-pins isolated project and never selects Production",()=>{
  assert.match(sql,/rgpbdajhlrwfmhopzgzk/);
  assert.match(sql,/L3_N8O_STAGING_PICKUP_WRITES_DISABLED/);
  assert.doesNotMatch(sql,/phdjumtqkooyppxozqsi/);
  assert.doesNotMatch(sql,/drop\s+(table|schema|database|trigger|policy)/i);
  assert.match(sql,/L3_N8O_STAGE_SCHEMA_ALREADY_PRESENT/);
});
test("N8O all three new private staging tables have RLS, revoked browser access, and hard-off triggers",()=>{
  for(const table of ["orders","pickup_order_events","pickup_push_outbox"]){
    assert.match(sql,new RegExp("create table public\\."+table+" \\(","i"));
    assert.match(sql,new RegExp("alter table public\\."+table+" enable row level security","i"));
  }
  assert.match(sql,/revoke all on table public.orders,public.pickup_order_events,public.pickup_push_outbox\s+from public,anon,authenticated/);
  assert.match(sql,/grant select on table public.orders,public.pickup_order_events,public.pickup_push_outbox to service_role/);
  for(const trigger of ["l3_n8o_orders_hard_off","l3_n8o_events_hard_off","l3_n8o_outbox_hard_off"]){
    assert.ok(sql.includes("create trigger "+trigger+" before insert or update or delete"));
  }
  assert.doesNotMatch(sql,/create\s+policy|security\s+definer/i);
});
test("N8O server-owned order details include financial precision, pickup and replay identity fields",()=>{
  const orderFields=["id uuid","shop_id text","user_id text","total_price numeric","price numeric","status text",
   "delivery_status text","payment_method text","customer_name text","phone text","items jsonb",
   "delivery_type text","payment_status text","idempotency_key text unique",
   "create_intent_hash text","revision bigint"];
  for(const token of orderFields)assert.ok(sql.includes(token),token);
  assert.match(sql,/unique\(order_id,revision\)/);
  assert.match(sql,/unique\(order_id,command_id\)/);
  assert.match(sql,/references public.shops\(id\) on delete restrict/);
  assert.match(sql,/l3_n8o_pickup_managed_shape/);
});
test("N8O followup index is isolated, additive, and requires write-blocking trigger before applying",()=>{
  assert.match(idx,/rgpbdajhlrwfmhopzgzk/);
  assert.match(idx,/l3_n8o_outbox_hard_off/);
  assert.match(idx,/create index l3_n8o_outbox_subscription_idx/);
  assert.match(idx,/public.pickup_push_outbox\(subscription_id\)/);
  assert.doesNotMatch(idx,/drop\s+(table|schema|index|trigger)/i);
});
