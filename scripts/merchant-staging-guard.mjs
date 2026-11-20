/**
 * L3-N8G/N8T Merchant-staging build guard. Pure, offline and credential-free.
 *
 * Only invoked by Vite when --mode merchant-staging. Does not authorize
 * deployment, Firebase sign-in, write requests or a production build.
 * The staging Firebase public web values are required but NEVER logged.
 * Dedicated Merchant staging Vercel project was created for N8H Preview; this code never permits Production.
 */
export const MERCHANT_STAGING_API_ORIGIN =
  "https://localeats-api-n8o-r52d-mehey9184-makers-projects.vercel.app";
export const MERCHANT_STAGING_FIREBASE_PROJECT = "localeats-staging";
export const MERCHANT_STAGING_FIRESTORE_DATABASE = "(default)";

const requiredFirebaseWebKeys=[
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_APP_ID",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
];
const safeValue=value=>typeof value==="string"&&value.trim()===value&&value.length>0;
const isFalse=value=>value==="false";

export function inspectMerchantStagingBuild(mode,env,systemEnv={}){
  const blockers=[];
  if(mode!=="merchant-staging")
    return Object.freeze({applies:false,ready:false,
      blockers:Object.freeze(["Merchant staging build must use --mode merchant-staging."])});
  if(systemEnv.VERCEL_ENV!=="preview")
    blockers.push("Staging build is permitted only by Vercel Preview.");
  if(env.LOCALEATS_STAGING_ONLY!=="true")
    blockers.push("Dedicated project must confirm LOCALEATS_STAGING_ONLY=true.");
  if(env.VITE_MERCHANT_STAGING_ONLY!=="true")
    blockers.push("Merchant client must explicitly opt into staging-only mode.");
  if(env.VITE_FIREBASE_CONFIG_SOURCE!=="environment")
    blockers.push("Merchant must select the complete environment Firebase config.");
  if(env.VITE_FIREBASE_PROJECT_ID!==MERCHANT_STAGING_FIREBASE_PROJECT)
    blockers.push("Merchant Firebase project must be the isolated localeats-staging project.");
  if(env.VITE_FIREBASE_FIRESTORE_DATABASE_ID!==MERCHANT_STAGING_FIRESTORE_DATABASE)
    blockers.push("Merchant Firestore database must be explicitly (default) in localeats-staging.");
  // N8T: the exact reviewed N8O Customer/API staging alias replaces the
  // original N8G Merchant-specific alias. Never match a suffix/wildcard.
  if(env.VITE_LOCALEATS_API_URL!==MERCHANT_STAGING_API_ORIGIN)
    blockers.push("Merchant must use the exact reviewed N8O staging API domain.");
  for(const key of requiredFirebaseWebKeys){
    if(!safeValue(env[key]))blockers.push("Missing complete staging Firebase web setting: "+key);
  }
  if(safeValue(env.VITE_FIREBASE_AUTH_DOMAIN) &&
     !/^[a-z0-9-]+\.firebaseapp\.com$/.test(env.VITE_FIREBASE_AUTH_DOMAIN))
    blockers.push("Firebase Auth domain is not a valid staging Firebase app domain.");
  if(safeValue(env.VITE_FIREBASE_MESSAGING_SENDER_ID) &&
     !/^[0-9]+$/.test(env.VITE_FIREBASE_MESSAGING_SENDER_ID))
    blockers.push("Firebase messaging sender ID has an invalid format.");
  for(const key of [
    "VITE_PICKUP_ORDERING_ENABLED",
    "VITE_PICKUP_PAYMENT_SETTINGS_ENABLED",
    "VITE_PAYMENTS_PLAN_DEMO_ENABLED",
    "VITE_MERCHANT_FAKE_ORDERS_ENABLED",
    "VITE_REWARDS_ENABLED",
    "VITE_LOCALPAY_ENABLED",
  ]){
    // All explicit, OFF; omission must never silently activate features.
    if(!isFalse(env[key]))blockers.push("Staging must explicitly disable "+key+".");
  }
  if(env.VITE_MERCHANT_PREVIEW_READ_ONLY!=="true")
    blockers.push("Staging Merchant UI must suppress the legacy heartbeat write.");
  if(safeValue(env.VITE_SUPABASE_URL) &&
      env.VITE_SUPABASE_URL!=="https://rgpbdajhlrwfmhopzgzk.supabase.co")
    blockers.push("The Merchant browser cannot receive a Production Supabase URL.");
  // No service-role, Firebase Admin key or database URL belongs in a Vite
  // client bundle, even when a developer accidentally gives it VITE_ prefix.
  if(Object.keys(env).some(key=>
    key.startsWith("VITE_") &&
    /(?:SERVICE_ROLE|PRIVATE_KEY|SECRET_KEY|DATABASE_URL)/.test(key)))
    blockers.push("Secret-bearing VITE_ environment variables must not be bundled.");
  if(systemEnv.VERCEL_TARGET_ENV==="production")
    blockers.push("Merchant staging must never target Production.");
  return Object.freeze({applies:true,ready:blockers.length===0,
    blockers:Object.freeze(blockers)});
}

export function assertMerchantStagingBuild(mode,env,systemEnv={}){
  const report=inspectMerchantStagingBuild(mode,env,systemEnv);
  if(!report.ready)throw Error(
    "L3-N8G MERCHANT_STAGING_BUILD_BLOCKED: "+report.blockers.join(" | ")
  );
  return report;
}
