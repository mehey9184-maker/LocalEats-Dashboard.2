import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"../../../..");
const read=path=>readFileSync(resolve(root,path),"utf8");

test("R4.3: current Firebase middleware has no explicit revocation check; model requires it",()=>{
 const live=read("localeats-api/src/middleware/authenticateFirebase.ts");
 const future=read("localeats-api/tests/pickup/r43/payment-owner-scope.SYNTHETIC_ONLY.mjs");
 assert.match(live,/authAdmin\.verifyIdToken\(token\)/);
 assert.doesNotMatch(live,/authAdmin\.verifyIdToken\(token,\s*true\)/);
 assert.match(future,/verifyFirebase\(authorization\.slice\("Bearer fb-"\.length\),true\)/);
});

test("R4.3: corrected payment fixture matches observed nullable bigint/text schema relationship",()=>{
 const fake=read("localeats-api/tests/pickup/r42/legacy-payment-fixture.SYNTHETIC_ONLY.sql");
 const r42test=read("localeats-api/tests/pickup/r42/staging-contract.test.mjs");
 assert.match(fake,/shop_id bigint\s*,/);
 assert.doesNotMatch(fake,/shop_id bigint NOT NULL/);
 assert.match(r42test,/shop_id bigint/);
 const r34=read("localeats-api/tests/pickup/r34/baseline.SYNTHETIC_ONLY.sql");
 assert.match(r34,/id text PRIMARY KEY/);
});

test("R4.3: real PaymentHistory cannot be mistaken for server-authoritative settlement",()=>{
 const merchant=read("src/components/PaymentHistory.tsx");
 const facade=read("src/lib/supabase.ts");
 const doc=read("docs/R43_PAYMENT_OWNER_SCOPE_STAGING_REVIEW.md");
 assert.match(merchant,/localeats_settled_cod_orders/);
 assert.match(merchant,/\.from\("payments"\)/);
 assert.match(facade,/firebase\/firestore/);
 assert.match(doc,/does NOT establish a real Supabase payment-history read/i);
});

test("R4.3: existing R4.2 Docker runner includes optional rollback-only owner mapping negative drill",()=>{
 const sh=read("localeats-api/tests/pickup/r42/run-integrated-staging-r42.sh");
 const sql=read("localeats-api/tests/pickup/r43/owner-legacy-mapping.SYNTHETIC_ONLY.sql");
 assert.match(sh,/owner-legacy-mapping\.SYNTHETIC_ONLY\.sql/);
 assert.match(sh,/R43_SYNTHETIC_OWNER_MAPPING_NEGATIVES_PASS/);
 assert.match(sh,/postgres:17-alpine/);
 assert.match(sql,/ROLLBACK;/);
 assert.match(sql,/R43_LEGACY_OWNER_MAPPING_LEAK/);
 assert.match(sql,/p\.shop_id IS NULL/);
 for(const script of [sh,sql])assert.doesNotMatch(script,/(supabase\.co|DATABASE_URL|SUPABASE_SERVICE_ROLE_KEY|db push|apply_migration|--remote|--publish| -p [0-9]+:)/i);
});

test("R4.3: not a live endpoint, direct database policy change or hosted staging certification",()=>{
 const model=read("localeats-api/tests/pickup/r43/payment-owner-scope.SYNTHETIC_ONLY.mjs");
 const doc=read("docs/R43_PAYMENT_OWNER_SCOPE_STAGING_REVIEW.md");
 assert.match(model,/not a deployed API/);
 assert.match(doc,/NO Production or hosted database writes/);
 assert.match(doc,/only has a profiles table/);
 assert.match(doc,/not an independent merge to main/);
});
