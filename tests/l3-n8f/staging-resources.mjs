/**
 * L3-N8F — offline inventory for existing staging resources.
 *
 * Inputs are nonsecret project identifiers, deployment metadata and schema
 * flags recorded via READ-ONLY provider inspection. No tokens, credentials,
 * Firebase user records, network requests or real app writes.
 *
 * Distinguish existing Customer/API staging resources from the *missing*
 * Merchant-specific staging and real authenticated owner A/B acceptance.
 */
const valid=(x)=>typeof x==="string" && x.trim().length>0 && x.trim()===x;
const isOff=(x)=>x===false||x==="false";
const isOn=(x)=>x===true||x==="true";
const contains=(value,entry)=>Array.isArray(value)&&value.includes(entry);

export function assessExistingLocalEatsStaging(resources){
  const blockers=[];
  const production=resources?.production??{};
  const supabase=resources?.supabase??{};
  const api=resources?.api??{};
  const customer=resources?.customer??{};
  const merchant=resources?.merchant??{};
  const view=supabase?.shopAvailability??{};

  if(!valid(supabase.stagingRef)||!valid(supabase.productionRef)||
    supabase.stagingRef===supabase.productionRef)
    blockers.push("Separate staging and Production Supabase projects not verified.");
  if(!valid(api.supabaseProjectRef)||api.supabaseProjectRef!==supabase.stagingRef)
    blockers.push("Dedicated staging API does not point to verified staging Supabase project.");
  if(!isOn(api.previewOnly)||!isOn(api.stagingOnly)||!isOn(api.readOnlyMiddleware))
    blockers.push("API lacks a verified Preview-only, staging-only, read-only boundary.");
  if(!isOff(api.pickupWrites)||!isOff(api.profileWrites))
    blockers.push("Staging API pickup/profile writes are not proven disabled.");
  if(!valid(api.firebaseProject)||!valid(customer.firebaseProject)||
    api.firebaseProject!==customer.firebaseProject ||
    api.firebaseProject===production.firebaseProject)
    blockers.push("Customer and API do not share a distinct staging Firebase project.");
  if(!valid(customer.configSource)||customer.configSource!=="environment")
    blockers.push("Customer staging must explicitly select complete Firebase environment config.");
  if(!isOn(customer.previewOnly)||!isOn(customer.stagingOnly))
    blockers.push("Customer staging lacks Preview-only project isolation.");
  if(!isOff(customer.profileWrites))
    blockers.push("Customer staging profile writes are not disabled.");
  if(!isOn(customer.apiOriginBelongsToStageApi))
    blockers.push("Customer staging API origin is not verified as the stage API project.");
  // Explicit default DB is fine because the staging project is independent.
  if(!valid(customer.firestoreDatabaseId))
    blockers.push("Staging Firestore database ID must be explicit, even for (default).");
  if(!isOn(api.hasAdminCredentialEntries)||!isOn(api.hasStagingServiceRoleEntry))
    blockers.push("Stage API credential entries for Firebase Admin and Supabase are absent.");
  if(!isOn(view.exists)||!contains(view.columns,"id")||
    !contains(view.columns,"owner_id")||!contains(view.columns,"approval_status")||
    !contains(view.columns,"archived_at")||!isOn(view.securityInvoker)||
    !isOff(view.anonSelect)||!isOff(view.authenticatedSelect))
    blockers.push("Stage API owner view or its direct-access safeguards are unverified.");

  const existingBackendReady=blockers.length===0;
  const merchantBlockers=[];
  if(!existingBackendReady)
    merchantBlockers.push("Existing Customer/API staging identity is not verified.");
  if(!isOn(merchant.separateStagingTarget))
    merchantBlockers.push("No distinct Merchant staging app/branch with complete Firebase configuration verified.");
  if(merchant.firebaseProject!==api.firebaseProject ||
    merchant.firebaseConfigSource!=="environment")
    merchantBlockers.push("Merchant staging Firebase project/config source not verified.");
  if(!valid(merchant.firestoreDatabaseId)||
    merchant.firestoreDatabaseId!==customer.firestoreDatabaseId ||
    merchant.firestoreDatabaseId!==api.merchantFirestoreDatabaseId)
    merchantBlockers.push("Merchant/API explicitly selected staging Firestore database IDs must match.");
  if(!isOff(merchant.pickupOrdering))
    merchantBlockers.push("Merchant staged pickup ordering is not proven disabled.");
  if(!isOn(api.revocationAwareDeployed))
    merchantBlockers.push("Stage API does not yet deploy revoked-token checking.");
  if(!isOn(api.adminServiceAccountVerified))
    merchantBlockers.push("Firebase Admin service-account scope has not been independently verified.");
  if(!isOn(merchant.twoStageOnlyOwnersVerified))
    merchantBlockers.push("Two Merchant staging identities and shop ownership have not been authenticated.");
  return Object.freeze({
    existingBackendReady,
    existingBackendBlockers:Object.freeze(blockers),
    merchantReadOnlyAcceptanceReady:existingBackendReady&&merchantBlockers.length===0,
    merchantBlockers:Object.freeze(merchantBlockers),
    evidence:"read-only inventory plus offline synthetic tests",
    realFirebaseAuthenticatedTwoMerchantTest:false,
    merchantProfileWritesActivated:false,
  });
}
