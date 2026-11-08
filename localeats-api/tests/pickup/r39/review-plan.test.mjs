import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,"../../../..");
const sql=readFileSync(resolve(here,"payments-access-hardening.REVIEW_ONLY.sql.txt"),"utf8");
const run=readFileSync(resolve(here,"run-payment-policy-review-r39.sh"),"utf8");
const plan=readFileSync(resolve(here,"R39_REVIEW_ONLY_PAYMENT_SECURITY_PLAN.md"),"utf8");
const merchant=readFileSync(resolve(root,"src/components/PaymentHistory.tsx"),"utf8");
const facade=readFileSync(resolve(root,"src/lib/supabase.ts"),"utf8");

test("R3.9: cannot be mistaken for an executable migration",()=>{
 assert.match(sql,/NEVER EXECUTE ON CONNECTED SUPABASE/);
 assert.match(sql,/__SCHEMA__\.payments/);
 assert.match(sql,/__CLIENT_ROLE__/);
 assert.match(sql,/__BACKEND_ROLE__/);
 assert.match(sql,/__ANON_ROLE__/);
 assert.doesNotMatch(sql,/ALTER\s+TABLE\s+public\.payments/i);
 const active=readdirSync(resolve(root,"supabase/migrations")).filter(x=>/r39|payments.*harden/i.test(x));
 assert.deepEqual(active,[]);
 assert.match(plan,/NOT an approved or deployable Production migration/);
});

test("R3.9: migration refuses unexpected legacy policy and preserves backend reads",()=>{
 assert.match(sql,/R39_LEGACY_PAYMENT_POLICY_NOT_AS_REVIEWED/);
 assert.match(sql,/R39_ADDITIONAL_PUBLIC_POLICY_REQUIRES_REVIEW/);
 assert.match(sql,/R39_BACKEND_READER_LOST/);
 assert.match(sql,/R39_CLIENT_GRANTS_STILL_PRESENT/);
 assert.match(sql,/SET LOCAL lock_timeout/);
 assert.match(sql,/REVOKE ALL ON TABLE/);
 assert.match(sql,/DROP POLICY "Payments access"/);
 assert.doesNotMatch(sql,/\b(?:UPDATE|DELETE FROM|TRUNCATE)\s+__SCHEMA__\.payments/i);
});

test("R3.9: disposable runner has no hosted API or exposed Docker ports",()=>{
 assert.match(run,/postgres:17-alpine/);
 assert.match(run,/SET SESSION AUTHORIZATION r38_authenticated/);
 assert.match(run,/R39_DRIFT_GUARD_DID_NOT_ABORT/);
 assert.match(run,/R39_REPEAT_MIGRATION_NOT_BLOCKED/);
 assert.match(run,/pg_dump -U postgres -d r39_test --schema-only/);
 assert.doesNotMatch(run,/(supabase\.co|SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL|db push|apply_migration|--remote|--publish|-p\s+[0-9]+:)/i);
});

test("R3.9: Merchant payment reader is a Firestore facade, never proof of a safe Supabase direct caller",()=>{
 assert.match(merchant,/from\s*\(\s*["']payments["']\s*\)/);
 assert.match(merchant,/from ["']\.\.\/lib\/supabase["']/);
 assert.match(facade,/firebase\/firestore/);
 assert.doesNotMatch(facade,/@supabase\/supabase-js/);
 assert.match(plan,/External\/legacy consumers have not been proven absent/);
});
