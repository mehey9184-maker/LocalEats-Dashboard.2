/**
 * L3-N8N — metadata-only, no-credential paired Customer↔API Preview gate.
 *
 * This is deliberately NOT a Vercel deploy script or Firebase Auth client.
 * Synthetic results are NOT evidence of a real hosted browser or A/B test.
 * Keep both writes disabled and require exact reviewed Git SHAs.
 */
const required={
  customerProject:"prj_F4szeGF8BxmYpdUVA2yLYrjAmMUN",
  apiProject:"prj_eroDrVcFOPlvRJzjCU7vbwGnleFT",
  firebaseProject:"localeats-staging",
  firestoreDatabase:"(default)",
  apiOrigin:"https://localeats-api-staging-r52d-mehey9184-makers-projects.vercel.app",
  customerRepo:"mehey9184-maker/LocalEats-app",
  apiRepo:"mehey9184-maker/LocalEats-Dashboard.2",
};
const flag=(v)=>v===false||v==="false";
const isSha=(v)=>typeof v==="string"&&/^[a-f0-9]{40}$/.test(v);
const nonempty=(v)=>typeof v==="string"&&v.trim()===v&&v.length>0;

export function assessPairedPreviewReadiness(state={}){
  const blockers=[];
  const customer=state.customer??{},api=state.api??{},prod=state.production??{};
  const check=(okay,message)=>{if(!okay)blockers.push(message);};
  check(customer.projectId===required.customerProject&&api.projectId===required.apiProject,
    "Dedicated Customer and API Vercel project identities are not both verified.");
  check(customer.repository===required.customerRepo&&api.repository===required.apiRepo,
    "A Preview is linked to the wrong GitHub repository.");
  check(customer.target==="preview"&&api.target==="preview"&&
    customer.state==="READY"&&api.state==="READY",
    "Both exact reviewed builds must be READY Preview deployments (not Production/queued).");
  check(isSha(customer.reviewedSha)&&isSha(api.reviewedSha)&&
    customer.deployedSha===customer.reviewedSha&&api.deployedSha===api.reviewedSha,
    "Deployed Customer/API commits do not BOTH match the exact independently reviewed candidate SHAs.");
  check(customer.reviewedBranch===customer.deployedBranch&&
    api.reviewedBranch===api.deployedBranch&&
    nonempty(customer.reviewedBranch)&&nonempty(api.reviewedBranch),
    "The branch identity is missing or differs from its reviewed deployment.");
  check(customer.latestMainChangesReconciled===true,
    "New Customer main checkout/history/receipt changes have not been reconciled with older draft branches.");
  check(customer.firebaseConfigSource==="environment"&&
    customer.firebaseProjectId===required.firebaseProject&&
    customer.firestoreDatabaseId===required.firestoreDatabase&&
    api.firebaseProjectId===required.firebaseProject&&
    api.firestoreDatabaseId===required.firestoreDatabase,
    "The Customer/API Firebase project and selected Firestore database were not verified as staging.");
  check(api.adminServiceAccountProjectId===required.firebaseProject &&
    api.adminCredentialProjectAttested===true,
    "Staging API Firebase Admin service account scope has not been independently attested.");
  check(nonempty(prod.firebaseProjectId)&&prod.firebaseProjectId!==required.firebaseProject &&
    nonempty(api.supabaseProjectId)&&nonempty(prod.supabaseProjectId)&&
    api.supabaseProjectId!==prod.supabaseProjectId,
    "Staging credentials could target a Production Firebase or Supabase project.");
  check(customer.apiOrigin===required.apiOrigin &&
    api.deploymentOrigin===required.apiOrigin &&
    customer.apiOrigin!==prod.apiOrigin,
    "The Customer must use its exact separate staging API canonical origin, never a Production/other alias.");
  check(api.customerOriginCorsVerified===true&&api.corsOnlyPermitsExpectedOrigins===true,
    "The exact Customer Preview origin lacks independent read-only CORS acceptance evidence.");
  check(customer.stagingOnly===true&&api.stagingOnly===true&&
    customer.stagingDirectWritesGuardVerified===true&&
    customer.communityMounted===false&&api.communityMounted===false,
    "The staging-only Customer mutation guard and dormant community routes must be proven.");
  check(flag(customer.pickupOrderingEnabled)&&
    flag(api.pickupWritesEnabled)&&flag(api.profileWritesEnabled)&&
    flag(api.availabilityWritesEnabled)&&flag(api.merchantAccountWritesEnabled)&&
    flag(api.communityWritesEnabled)&&api.previewReadOnly===true,
    "Pickup, profiles, shop availability, community and other API writes must stay hard-OFF.");
  check(state.verifiedNoProductionDeployment===true &&
    state.ownerApprovedReadOnlyPreviewSmoke===true,
    "Production isolation and separate owner-approved read-only Preview smoke are not both verified.");
  return Object.freeze({
    eligibleForPairedReadOnlySmoke:blockers.length===0,
    blockers:Object.freeze(blockers),
    evidence:"metadata-only-no-network",
    realFirebaseTwoAccountVerified:false,
    productionDeploymentAuthorized:false,
    profileOrOrderWritesAuthorized:false,
    firebaseRulesPublishAuthorized:false,
    shopFixtureCreationAuthorized:false,
  });
}
export const pairedPreviewRequirements=Object.freeze(required);
