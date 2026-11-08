/**
 * R5.2B OFFLINE resource assessment. Does not connect to Firebase, Supabase,
 * Vercel or customer data. Static metadata is only a dated snapshot, NOT a
 * signed attestation or permission to run hosted tests.
 */
export const requiredPickupTables=Object.freeze([
  "profiles","shops","menu_items","orders","pickup_order_events"
]);

const names = (input) => Array.isArray(input)
  ? new Set(input.filter(x=>typeof x==="string").map(x=>x.trim().split(".").pop()))
  : new Set();

/** Identifies missing evidence, never authorizes hosted actions. */
export function assessR52BResources(observed){
  const reasons=[];
  if(!observed || typeof observed!=="object")
    return {assessment:"BLOCKED",reasons:["NO_RESOURCE_EVIDENCE"]};
  const s=observed.supabase||{}, f=observed.firebase||{},
    v=observed.vercel||{}, d=observed.data||{};
  if(s.stagingProjectExists!==true || s.productionProjectExists!==true ||
     s.distinctProjectsVerified!==true)
    reasons.push("SEPARATE_SUPABASE_PROJECTS_NOT_VERIFIED");
  const have=names(s.stagingPublicTables);
  const missing=requiredPickupTables.filter(name=>!have.has(name));
  if(missing.length)reasons.push("STAGING_PICKUP_SCHEMA_INCOMPLETE");
  if(f.independentStagingProjectVerified!==true)
    reasons.push("FIREBASE_STAGING_PROJECT_NOT_VERIFIED");
  if(f.hostedFirebaseProjectVerified!==true)
    reasons.push("HOSTED_FIREBASE_PROJECT_NOT_VERIFIED");
  if(f.clientApiProjectMatchVerified!==true)
    reasons.push("FIREBASE_CLIENT_API_PROJECT_MATCH_UNVERIFIED");
  if(v.customerDraftDeploymentVerified!==true ||
     v.apiDraftDeploymentVerified!==true)
    reasons.push("EXACT_DRAFT_DEPLOYMENTS_MISSING");
  if(v.customerBranchOnlyIsolationVerified!==true ||
     v.apiBranchOnlyIsolationVerified!==true)
    reasons.push("VERCEL_PREVIEW_CREDENTIAL_ISOLATION_UNVERIFIED");
  if(d.syntheticFixturesApproved!==true || d.productionRecordsExcluded!==true)
    reasons.push("SYNTHETIC_DATA_ONLY_NOT_ESTABLISHED");
  if(d.billingAndProjectProvisioningReviewed!==true)
    reasons.push("INFRASTRUCTURE_COST_REVIEW_OPEN");
  return {
    // Even an empty set of reasons is not sufficient for authorization:
    // the earlier R5.2 gate additionally requires exact deploy SHA,
    // explicit disabled feature flags, owner approval and hosted review.
    assessment: reasons.length?"BLOCKED":"EVIDENCE_READY_FOR_INDEPENDENT_REVIEW",
    reasons,
    missingPickupTables:missing
  };
}
