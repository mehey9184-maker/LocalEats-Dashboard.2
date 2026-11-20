/**
 * L3-N8E — offline, metadata-only eligibility check for a genuinely isolated
 * Merchant Firebase staging authentication rehearsal.
 *
 * This is NOT authentication evidence. It takes identifiers/boolean flags
 * only, never Firebase private keys, refresh tokens, passwords, ID tokens,
 * service-role keys or production user data. No network or environment reads.
 *
 * A Vercel Preview is not a staging identity boundary by itself. A positive
 * verdict means only that read-only staging authentication can be considered,
 * not that a real token, shop or Firestore database was independently tested.
 */
const nonempty=(value)=>typeof value==="string" && value.length>0 &&
  value.trim()===value;
const falseFlag=(value)=>value===false || value==="false";
const trueFlag=(value)=>value===true || value==="true";

export function assessMerchantStagingIsolation(staging,production){
  const blockers=[];
  if(!staging || !production || typeof staging!=="object" ||
      typeof production!=="object"){
    return Object.freeze({eligibleForReadOnlyAuthTest:false,
      blockers:["Staging and production identity inventories must both exist."],
      evidence:"configuration-only",realFirebaseAuthenticationVerified:false});
  }
  const api=staging.api??{};
  const merchant=staging.merchant??{};
  const prod=production??{};
  const id=api.firebaseProjectId;
  if(merchant.firebaseConfigSource!=="environment")
    blockers.push("Merchant staging must opt into complete environment-based Firebase configuration.");
  if(!nonempty(id)||!nonempty(merchant.firebaseProjectId)||!nonempty(api.serviceAccountProjectId))
    blockers.push("Staging API, Merchant client and Admin service-account project IDs must all be verified.");
  else if(id!==merchant.firebaseProjectId || id!==api.serviceAccountProjectId)
    blockers.push("Staging API, Merchant client and Admin service account target different Firebase projects.");
  if(!nonempty(prod.firebaseProjectId))
    blockers.push("Production Firebase project ID is unknown, so isolation cannot be proven.");
  else if(nonempty(id) && id===prod.firebaseProjectId)
    blockers.push("Staging Firebase project is the Production Firebase project.");
  if(!nonempty(api.firestoreDatabaseId) ||
      !nonempty(merchant.firestoreDatabaseId) ||
      api.firestoreDatabaseId!==merchant.firestoreDatabaseId)
    blockers.push("The explicitly selected Firestore database IDs do not match.");
  // An explicitly selected (default) database is safe inside a *different*
  // staging Firebase project. Never silently fall back to Production's DB.
  // Production/staging project separation and complete client config are
  // mandatory independent checks above.
  if(!nonempty(api.supabaseUrl)||!nonempty(prod.supabaseUrl))
    blockers.push("Staging and Production Supabase identity is missing.");
  else if(api.supabaseUrl===prod.supabaseUrl)
    blockers.push("Staging uses the Production Supabase project.");
  if(!trueFlag(api.previewReadOnly))
    blockers.push("Staging API must enforce its read-only HTTP gate.");
  if(!falseFlag(api.profileWritesEnabled) || !falseFlag(api.pickupWritesEnabled) ||
      !falseFlag(api.availabilityWritesEnabled))
    blockers.push("Staging profile, pickup and shop-availability writes must all remain disabled.");
  if(!falseFlag(merchant.pickupOrderingEnabled))
    blockers.push("Staging Merchant pickup ordering must remain disabled.");
  if(staging.accounts?.createdInVerifiedStaging!==true ||
      !Array.isArray(staging.accounts?.uids) ||
      staging.accounts.uids.length!==2 ||
      staging.accounts.uids.some(x=>!nonempty(x)) ||
      staging.accounts.uids[0]===staging.accounts.uids[1])
    blockers.push("Two distinct nonproduction accounts are not attested for the verified staging project.");
  // Not an actual sign-in. Next tests need short-lived token checks and API
  // ownership reads in the isolated environment with user's authorization.
  return Object.freeze({eligibleForReadOnlyAuthTest:blockers.length===0,
    blockers:Object.freeze(blockers),evidence:"configuration-only",
    realFirebaseAuthenticationVerified:false});
}

/**
 * Vercel's metadata returns "target": ["production","preview"] for a
 * shared value. We must not mistake that as a Preview-specific credential.
 * Inputs are metadata only (key/target/gitBranch), NEVER secret values.
 */
export function auditHostedEnvironmentMetadata(apiEnv,merchantEnv,customEnvironments){
  const a=Array.isArray(apiEnv)?apiEnv:[];
  const m=Array.isArray(merchantEnv)?merchantEnv:[];
  const has=(env,key)=>env.some(v=>v.key===key && !v.gitBranch);
  const shared=(env,key)=>env.some(v=>v.key===key &&
    !v.gitBranch && v.target?.includes("production") &&
    v.target?.includes("preview"));
  return Object.freeze({
    apiHasFirebaseProject:has(a,"FIREBASE_PROJECT_ID"),
    apiHasAdminServiceAccount:has(a,"FIREBASE_CLIENT_EMAIL") &&
      has(a,"FIREBASE_PRIVATE_KEY"),
    apiHasExplicitFirestoreDatabase:has(a,"MERCHANT_FIRESTORE_DATABASE_ID") ||
      has(a,"FIREBASE_FIRESTORE_DATABASE_ID"),
    merchantHasExplicitFirestoreDatabase:has(m,"VITE_FIREBASE_FIRESTORE_DATABASE_ID"),
    merchantHasEnvironmentConfigOptIn:has(m,"VITE_FIREBASE_CONFIG_SOURCE"),
    apiSharesFirebaseCredentialsAcrossProductionPreview:
      shared(a,"FIREBASE_PROJECT_ID") ||
      shared(a,"FIREBASE_PRIVATE_KEY"),
    apiSharesSupabaseCredentialsAcrossProductionPreview:
      shared(a,"SUPABASE_SERVICE_ROLE_KEY") ||
      shared(a,"SUPABASE_URL"),
    hasCustomStagingEnvironment:Array.isArray(customEnvironments) &&
      customEnvironments.some(e=>/stag/i.test(String(e.name??e.slug??""))),
    // This audit NEVER declares staging safe based on metadata alone.
    isolatedStagingVerified:false,
  });
}
