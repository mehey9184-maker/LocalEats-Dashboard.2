/**
 * L3-N8K - pure release-gate model. It makes no network calls and can never
 * publish rules. A passing emulator suite is NOT live compatibility evidence.
 */
export function assessSharedStagingRulesRelease(evidence={}){
  const blockers=[];
  if(evidence.firebaseProject!=="localeats-staging" ||
     evidence.firestoreDatabase!=="(default)")
    blockers.push("Shared Customer/Merchant staging project and (default) DB not independently verified.");
  if(evidence.activeRulesetReadOnlySnapshotVerified!==true ||
     typeof evidence.activeRulesetName!=="string" ||
     !evidence.activeRulesetName.startsWith("projects/localeats-staging/rulesets/") ||
     !/^[0-9a-f]{64}$/.test(evidence.activeRulesSha256??""))
    blockers.push("Currently DEPLOYED staging Rules release/source fingerprint and private rollback snapshot are missing.");
  if(evidence.stageCustomerDirectFirestoreCompatibilityPassed!==true)
    blockers.push("Customer direct Firestore discovery, menu, review, follow, profile and messaging compatibility has not passed.");
  if(evidence.merchantClientReadOnlyIsolationPassed!==true)
    blockers.push("Merchant client and server read-only isolation acceptance is incomplete.");
  if(evidence.noPublicPrivateDocumentExposureProved!==true)
    blockers.push("Public Firestore catalog exposure of full shop/menu documents is unreviewed.");
  if(evidence.emulatorCustomerAndMerchantPassed!==true)
    blockers.push("Candidate shared-stage emulator checks are not both verified.");
  if(evidence.rollbackReleaseVerified!==true)
    blockers.push("Rollback release ID, private exact rules source and restore runbook unverified.");
  if(evidence.ownerApprovedStageRulesPublish!==true)
    blockers.push("Separate owner approval for shared-stage Firebase Rules deployment is missing.");
  return Object.freeze({eligibleForStageRulesPublish:blockers.length===0,
    blockers:Object.freeze(blockers),productionPublishAllowed:false,
    customerAccountWritesActivated:false,merchantProfileWritesActivated:false,
    liveStagingRulesVerified:evidence.activeRulesetReadOnlySnapshotVerified===true &&
      blockers.every(b=>!b.includes("Currently DEPLOYED"))});
}
