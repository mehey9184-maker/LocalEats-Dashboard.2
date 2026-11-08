// R4.2: Static safety gates. No hosted connections or data.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"../../../..");
const read=path=>readFileSync(resolve(root,path),"utf8");

test("R4.2 uses recovered recorded pickup SQL without generating active migrations",()=>{
 const sh=read("localeats-api/tests/pickup/r42/run-integrated-staging-r42.sh");
 for(const name of [
  "20261030111305_pickup_launch_foundation.sql.txt",
  "20261031073608_pickup_zero_fee.sql.txt",
  "20261031073645_merchant_availability.sql.txt",
  "20261101160331_pickup_payment_methods.sql.txt",
 ])assert.match(sh,new RegExp(name.replaceAll(".","\\.")));
 assert.match(sh,/r34\/checkout-e2e\.SYNTHETIC_ONLY\.sql/);
 assert.match(sh,/r35\/payment-pre-e2e\.SYNTHETIC_ONLY\.sql/);
 assert.match(sh,/r35\/payment-post-e2e\.SYNTHETIC_ONLY\.sql/);
 assert.match(sh,/postgres:17-alpine/);
 assert.match(sh,/--schema-only/);
 const migrationNames=readdirSync(resolve(root,"supabase/migrations"));
 assert.deepEqual(migrationNames.filter(x=>/r42|payment.*harden|r39/i.test(x)),[]);
});

test("R4.2 candidate is R3.9's unchanged REVIEW_ONLY template, not deployable SQL",()=>{
 const sh=read("localeats-api/tests/pickup/r42/run-integrated-staging-r42.sh");
 const candidate=read("localeats-api/tests/pickup/r39/payments-access-hardening.REVIEW_ONLY.sql.txt");
 assert.match(sh,/payments-access-hardening\.REVIEW_ONLY\.sql\.txt/);
 assert.match(sh,/s\/__SCHEMA__\/public\/g/);
 assert.match(sh,/s\/__CLIENT_ROLE__\/authenticated\/g/);
 assert.match(candidate,/NEVER EXECUTE ON CONNECTED SUPABASE/);
 assert.match(candidate,/R39_LEGACY_PAYMENT_POLICY_NOT_AS_REVIEWED/);
 assert.match(candidate,/R39_CLIENT_GRANTS_STILL_PRESENT/);
 assert.doesNotMatch(sh,/(supabase\.co|DATABASE_URL|SUPABASE_SERVICE_ROLE_KEY|db push|apply_migration|--remote|--publish|-p\s+[0-9]+:)/i);
});

test("R4.2 fake legacy shop/payment IDs, privileges, and post-policy pickup checks exist",()=>{
 const fake=read("localeats-api/tests/pickup/r42/legacy-payment-fixture.SYNTHETIC_ONLY.sql");
 const sh=read("localeats-api/tests/pickup/r42/run-integrated-staging-r42.sh");
 assert.match(fake,/shop_id bigint\s*,/);
 assert.match(fake,/public\.payments/);
 assert.match(fake,/USING \(true\) WITH CHECK \(true\)/);
 assert.match(fake,/R42_FAKE_MERCHANT_A/);
 assert.match(fake,/R42_FAKE_MERCHANT_B/);
 assert.match(sh,/SET SESSION AUTHORIZATION authenticated/);
 assert.match(sh,/SET SESSION AUTHORIZATION service_role/);
 assert.match(sh,/SET ROLE service_role/);
 assert.match(sh,/R42_POLICY_DRIFT_NOT_REJECTED/);
 assert.match(sh,/public\.pickup_create_order/);
 assert.match(sh,/R42_INTEGRATED_HISTORICAL_PICKUP_AND_PAYMENT_POLICY_RESTORE_PASS/);
});

test("R4.2 does not claim complete hosted staging or real Firebase acceptance",()=>{
 const plan=read("docs/R42_INTEGRATED_PICKUP_SECURITY_REHEARSAL.md");
 assert.match(plan,/NOT the full effective Production schema/i);
 assert.match(plan,/NOT a hosted staging deployment/i);
 assert.match(plan,/real FCM delivery remains unverified/i);
 assert.match(plan,/No Production or hosted database writes/i);
});
