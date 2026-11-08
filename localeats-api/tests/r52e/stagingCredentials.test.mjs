import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {r52eStagingCredentialIssues,assertR52EStagingSafety} from "../../src/lib/r52eStagingSafety.ts";

const fakeReady = () => ({
  LOCALEATS_STAGING_ONLY:"true",
  VERCEL_ENV:"preview",
  FIREBASE_PROJECT_ID:"localeats-staging",
  FIREBASE_CLIENT_EMAIL:"firebase-adminsdk-fake@localeats-staging.iam.gserviceaccount.com",
  FIREBASE_PRIVATE_KEY:"-----BEGIN PRIVATE KEY-----\\nSYNTHETIC-INVALID-CRYPTO\\n-----END PRIVATE KEY-----",
  SUPABASE_URL:"https://rgpbdajhlrwfmhopzgzk.supabase.co",
  SUPABASE_SECRET_KEY:"sb_secret_"+"x".repeat(32),
  CUSTOMER_APP_ORIGIN:"https://localeats-customer-stage-example.vercel.app",
  PICKUP_WRITES_ENABLED:"false",
  PROFILE_WRITES_ENABLED:"false",
  RIDER_ACTIVATION_ENABLED:"false",
  REWARDS_ACTIVATION_ENABLED:"false",
  LOCALPAY_LIVE_WALLET_ENABLED:"false",
});

test("R5.2E default/live API is unmodified when staging gate is not opted in",()=>{
 assert.deepEqual(r52eStagingCredentialIssues({}),[]);
 assert.deepEqual(r52eStagingCredentialIssues({LOCALEATS_STAGING_ONLY:"false",FIREBASE_PROJECT_ID:"localeats-5e26e"}),[]);
});

test("R5.2E synthetic-only complete stage shape passes pure policy but is not cloud proof",()=>{
 const fake=fakeReady();
 assert.deepEqual(r52eStagingCredentialIssues(fake),[]);
 assert.doesNotThrow(()=>assertR52EStagingSafety(fake));
});

test("R5.2E current real staging shell refuses missing API Admin and Supabase secrets",()=>{
 const incomplete=fakeReady();
 delete incomplete.FIREBASE_CLIENT_EMAIL;
 delete incomplete.FIREBASE_PRIVATE_KEY;
 delete incomplete.SUPABASE_SECRET_KEY;
 delete incomplete.CUSTOMER_APP_ORIGIN;
 const failures=r52eStagingCredentialIssues(incomplete);
 for(const reason of [
  "FIREBASE_STAGING_SERVICE_IDENTITY_REQUIRED",
  "FIREBASE_STAGING_PRIVATE_KEY_REQUIRED",
  "STAGING_SUPABASE_SECRET_KEY_REQUIRED",
  "CUSTOMER_STAGING_HTTPS_ORIGIN_REQUIRED"
 ])assert.ok(failures.includes(reason),reason);
 assert.throws(()=>assertR52EStagingSafety(incomplete),/R52E_STAGING_NOT_READY/);
});

test("R5.2E never allows old Production Firebase project or foreign Admin identity",()=>{
 const a=fakeReady(); a.FIREBASE_PROJECT_ID="localeats-5e26e";
 assert.ok(r52eStagingCredentialIssues(a).includes("FIREBASE_PROJECT_MISMATCH"));
 const b=fakeReady(); b.FIREBASE_CLIENT_EMAIL="firebase-adminsdk-prod@localeats-5e26e.iam.gserviceaccount.com";
 assert.ok(r52eStagingCredentialIssues(b).includes("FIREBASE_STAGING_SERVICE_IDENTITY_REQUIRED"));
});

test("R5.2E rejects prod Supabase URL, legacy keys, and invalid/absent modern secret keys",()=>{
 const a=fakeReady();a.SUPABASE_URL="https://phdjumtqkooyppxozqsi.supabase.co";
 assert.ok(r52eStagingCredentialIssues(a).includes("STAGING_SUPABASE_PROJECT_REQUIRED"));
 const b=fakeReady();b.SUPABASE_SERVICE_ROLE_KEY="eyJFAKE-DO-NOT-USE";
 assert.ok(r52eStagingCredentialIssues(b).includes("LEGACY_SERVICE_ROLE_MUST_BE_UNSET_IN_STAGING"));
 const c=fakeReady();c.SUPABASE_SECRET_KEY="eyJFAKE-DO-NOT-USE";
 assert.ok(r52eStagingCredentialIssues(c).includes("STAGING_SUPABASE_SECRET_KEY_REQUIRED"));
});

test("R5.2E refuses Auth emulator override and missing/malformed Admin private key",()=>{
 const a=fakeReady();a.FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9099";
 assert.ok(r52eStagingCredentialIssues(a).includes("HOSTED_FIREBASE_EMULATOR_FORBIDDEN"));
 const b=fakeReady();b.FIREBASE_PRIVATE_KEY="bad-placeholder";
 assert.ok(r52eStagingCredentialIssues(b).includes("FIREBASE_STAGING_PRIVATE_KEY_REQUIRED"));
});

test("R5.2E forbids staging API under Vercel Production target",()=>{
 const a=fakeReady();a.VERCEL_ENV="production";
 assert.ok(r52eStagingCredentialIssues(a).includes("PREVIEW_ENV_REQUIRED"));
 const b=fakeReady();delete b.VERCEL_ENV;
 assert.ok(r52eStagingCredentialIssues(b).includes("PREVIEW_ENV_REQUIRED"));
});

test("R5.2E every pickup, profile, rider and wallet write flag must be literally false",()=>{
 for(const flag of ["PICKUP_WRITES_ENABLED","PROFILE_WRITES_ENABLED","RIDER_ACTIVATION_ENABLED","REWARDS_ACTIVATION_ENABLED","LOCALPAY_LIVE_WALLET_ENABLED"]){
  for(const bad of ["true",undefined]){
   const a=fakeReady(); a[flag]=bad;
   assert.ok(r52eStagingCredentialIssues(a).includes("WRITE_GATE_MUST_BE_FALSE_"+flag),flag+" "+String(bad));
  }
 }
});

test("R5.2E requires HTTPS Vercel Customer origin, not Production/custom origin",()=>{
 for(const origin of ["https://localeatssa.co.za","http://customer-staging.vercel.app",
  "https://customer-staging.vercel.app/path","https://customer-staging.vercel.app?token=unsafe",""]){
  const a=fakeReady();a.CUSTOMER_APP_ORIGIN=origin;
  assert.ok(r52eStagingCredentialIssues(a).includes("CUSTOMER_STAGING_HTTPS_ORIGIN_REQUIRED"),origin);
 }
});

test("R5.2E no secret values are included in thrown error",()=>{
 const a=fakeReady();
 const marker="TOP-SECRET-DO-NOT-PRINT";
 a.FIREBASE_PRIVATE_KEY=marker;
 a.SUPABASE_SECRET_KEY=marker;
 try{assertR52EStagingSafety(a);assert.fail("expected fail");}
 catch(e){const text=String(e);assert.match(text,/R52E_STAGING_NOT_READY/);assert.doesNotMatch(text,/TOP-SECRET/);}
});

test("R5.2E source enables modern secret key only in opted-in staging API, retaining legacy non-stage",()=>{
 const supa=readFileSync(new URL("../../src/lib/supabaseAdmin.ts",import.meta.url),"utf8");
 const firebase=readFileSync(new URL("../../src/lib/firebaseAdmin.ts",import.meta.url),"utf8");
 assert.match(supa,/assertR52EStagingSafety\(process\.env\)/);
 assert.match(firebase,/assertR52EStagingSafety\(process\.env\)/);
 assert.match(supa,/process\.env\.LOCALEATS_STAGING_ONLY === "true"/);
 assert.match(supa,/process\.env\.SUPABASE_SECRET_KEY/);
 assert.match(supa,/process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
});
