import test from "node:test";
import assert from "node:assert/strict";
import {
  isVerifiedMerchantStagingOrigin,MERCHANT_STAGING_ORIGIN,
} from "./merchantStageCors.js";
import {isAllowedOrigin} from "../corsOrigins.js";
import {readFileSync} from "node:fs";

const matching=():NodeJS.ProcessEnv=>({
  VERCEL_ENV:"preview",
  LOCALEATS_STAGING_ONLY:"true",
  FIREBASE_PROJECT_ID:"localeats-staging",
  SUPABASE_URL:"https://rgpbdajhlrwfmhopzgzk.supabase.co",
  PICKUP_WRITES_ENABLED:"false",
  PROFILE_WRITES_ENABLED:"false",
  MERCHANT_AVAILABILITY_WRITES_ENABLED:"false",
  MERCHANT_ACCOUNT_WRITES_ENABLED:"false",
  MERCHANT_STAGING_ORIGIN,
});
test("L3-N8G only one pinned Merchant staging Origin is admitted",()=>{
  const env=matching();
  assert.equal(isVerifiedMerchantStagingOrigin(MERCHANT_STAGING_ORIGIN,env),true);
  assert.equal(isAllowedOrigin(MERCHANT_STAGING_ORIGIN,env),true);
  for(const origin of [
    "https://local-eats-dashboard-2-6m8o.vercel.app",
    "https://evil-localeats-merchant-staging-r52d-mehey9184-makers-projects.vercel.app",
    "https://localeats-merchant-staging-r52d-mehey9184-makers-projects.vercel.app.evil.test",
    MERCHANT_STAGING_ORIGIN+"/other",
    "http://localeats-merchant-staging-r52d-mehey9184-makers-projects.vercel.app",
    "null",
    undefined,
  ])assert.equal(isVerifiedMerchantStagingOrigin(origin,env),false,String(origin));
});
test("L3-N8G CORS never permits a new staging Origin in Production",()=>{
  for(const value of ["production","development",undefined]){
    const env=matching();env.VERCEL_ENV=value;
    assert.equal(isVerifiedMerchantStagingOrigin(MERCHANT_STAGING_ORIGIN,env),false);
  }
});
test("L3-N8G no Production Firebase/Supabase or flag activation may borrow staging CORS",()=>{
  const mutations:Array<[string,string|undefined]>=[
    ["FIREBASE_PROJECT_ID","gen-lang-client-0863469023"],
    ["SUPABASE_URL","https://phdjumtqkooyppxozqsi.supabase.co"],
    ["LOCALEATS_STAGING_ONLY","false"],
    ["PICKUP_WRITES_ENABLED","true"],
    ["PROFILE_WRITES_ENABLED","true"],
    ["MERCHANT_AVAILABILITY_WRITES_ENABLED","true"],
    ["MERCHANT_ACCOUNT_WRITES_ENABLED","true"],
    ["MERCHANT_STAGING_ORIGIN",undefined],
    ["MERCHANT_STAGING_ORIGIN","https://wrong.example.invalid"],
  ];
  for(const [key,value] of mutations){
    const env=matching();env[key]=value;
    assert.equal(isVerifiedMerchantStagingOrigin(MERCHANT_STAGING_ORIGIN,env),false,key);
  }
});
test("L3-N8G exact staging Origin remains constrained by live read-only middleware",()=>{
  const source=readFileSync(new URL("../server.ts",import.meta.url),"utf8");
  const middleware=readFileSync(new URL("../middleware/previewReadOnlyGate.ts",import.meta.url),"utf8");
  const auth=readFileSync(new URL("../middleware/authenticateFirebase.ts",import.meta.url),"utf8");
  assert.match(source,/app\.use\(previewReadOnlyGate\)/);
  assert.match(middleware,/PREVIEW_READ_ONLY/);
  assert.match(middleware,/\["POST","PUT","PATCH","DELETE"\]/);
  assert.match(auth,/authAdmin\.verifyIdToken\(token, checkRevoked\)/);
  assert.match(auth,/verify\(token, true\)/);
  assert.equal(source.includes('app.use("/api/v1/merchant/account"'),false);
  assert.equal(source.includes("merchantAccountDormantApi"),false);
});
