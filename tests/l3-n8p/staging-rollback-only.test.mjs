import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql=readFileSync(new URL("./STAGING_TRANSACTION_ROLLBACK_ONLY.sql",import.meta.url),"utf8");
const source=readFileSync(new URL("../../supabase/staging-only/L3_N8O_PICKUP_ORDERS_HARD_OFF.sql",import.meta.url),"utf8");

test("N8P staging rehearsal refuses Production, drops, persistent writes and deployed credential access",()=>{
 assert.match(sql,/rgpbdajhlrwfmhopzgzk/);
 assert.ok(!sql.includes("phdjumtqkooyppxozqsi"));
 assert.match(sql,/\nbegin;\n/i);
 assert.match(sql,/\nrollback;\s*$/i);
 assert.doesNotMatch(sql,/\b(?:alter|drop|create|truncate|grant|revoke)\s+(?:table|trigger|policy|role|function|schema)/i);
 assert.doesNotMatch(sql,/firebase deploy|vercel deploy|sendEachForMulticast|auth\.createUser/i);
});
test("N8P two owner-only synthetic stage shops/menu isolated entirely within rollback",()=>{
 for(const value of ["stg-test-shop-n8p-rollback-a","stg-test-shop-n8p-rollback-b",
 "stg-test-owner-n8p-rollback-a","stg-test-owner-n8p-rollback-b",
 "stg-test-item-n8p-rollback-a"])assert.ok(sql.includes(value),value);
 assert.match(sql,/insert into public.shops/);
 assert.match(sql,/insert into public.menu_items/);
 assert.match(sql,/s\.owner_id=owner_b/);
 assert.match(sql,/L3_N8P_FOREIGN_OWNER_UPDATE/);
 assert.match(sql,/L3_N8P_OWNER_SCOPE_UNAVAILABLE/);
 assert.match(sql,/L3_N8P_CATALOG_PRICE_MISMATCH/);
});
test("N8P exact real staging order write must fail closed; no trigger disable or fake order success",()=>{
 assert.match(source,/L3_N8O_STAGING_PICKUP_WRITES_DISABLED/);
 assert.match(sql,/L3_N8O_STAGING_PICKUP_WRITES_DISABLED/);
 assert.match(sql,/L3_N8P_ORDER_HARD_OFF_BYPASSED/);
 assert.match(sql,/insert into public.orders/);
 assert.match(sql,/transient_orders/);
 assert.doesNotMatch(sql,/disable trigger|enable trigger|pickup_create_order/i);
});
