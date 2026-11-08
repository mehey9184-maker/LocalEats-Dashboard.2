// R3.8: regression of factual, READ-ONLY diagnosis; no live credentials.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const evidence=JSON.parse(readFileSync(new URL("./preview-security-evidence.json",import.meta.url),"utf8"));
const paymentHistory=readFileSync(new URL("../../../../src/components/PaymentHistory.tsx",import.meta.url),"utf8");
const facade=readFileSync(new URL("../../../../src/lib/supabase.ts",import.meta.url),"utf8");
const merchantApi=readFileSync(new URL("../../../../src/services/MerchantApi.ts",import.meta.url),"utf8");
const app=readFileSync(new URL("../../../../src/App.tsx",import.meta.url),"utf8");

test("R3.8: merchant verification still requires authoritative owned-shop API",()=>{
 assert.match(merchantApi,/api\/v1\/merchant\/shop/);
 assert.match(merchantApi,/getApiAuthHeaders/);
 assert.match(merchantApi,/requireOwnedShop\(shop,auth\.currentUser/);
 assert.match(app,/acceptAuthoritativeMerchantShop/);
 assert.match(app,/shop\.owner_id\s*!==\s*firebaseUid/);
});

test("R3.8: corrected Preview does not point at stale API or activate writes",()=>{
 const x=evidence.investigation;
 assert.equal(x.replacement_api_health_get,200);
 assert.equal(x.new_preview_get_status,200);
 assert.equal(x.new_preview_is_production,false);
 assert.equal(x.bundle_contains_replacement_api_origin,true);
 assert.equal(x.bundle_contains_stale_api_origin,false);
 assert.equal(x.branch_specific_variables.VITE_MERCHANT_PREVIEW_READ_ONLY,"true");
 assert.equal(x.branch_specific_variables.VITE_PICKUP_ORDERING_ENABLED,"false");
 assert.equal(x.branch_specific_variables.VITE_PICKUP_PAYMENT_SETTINGS_ENABLED,"false");
 assert.match(x.branch_specific_variables.VITE_LOCALEATS_API_URL,/^https:\/\/localeats-[a-z0-9-]+\.vercel\.app$/);
 assert.equal(x.authenticated_real_merchant_shop_verification_passed,false);
 assert.equal(evidence.owner_acceptance.pending,true);
});

test("R3.8: legacy dashboard payment history uses Firestore facade, not a direct Supabase DB client",()=>{
 assert.match(paymentHistory,/from\s*\(\s*["']payments["']\s*\)/);
 assert.match(paymentHistory,/from\s+["']\.\.\/lib\/supabase["']/);
 assert.match(facade,/getDocs/);
 assert.match(facade,/getFirestore|from\s+["']\.\/firebase["']/);
 assert.doesNotMatch(facade,/@supabase\/supabase-js/);
 assert.equal(evidence.financial_security.caller_inventory.external_consumers_proven_absent,false);
});

test("R3.8: broad connected payments RLS is not falsely claimed fixed",()=>{
 const x=evidence.financial_security;
 assert.equal(x.connected_supabase_mutated,false);
 assert.equal(x.mitigation_applied_to_production,false);
 assert.equal(x.payments_policy,"Payments access");
 assert.equal(x.authenticated_policy_command,"ALL");
 assert.equal(x.using_expression,"true");
 assert.equal(x.with_check_expression,"true");
 assert.deepEqual(x.authenticated_role_permissions,["SELECT","INSERT","UPDATE","DELETE"]);
});
