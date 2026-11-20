/**
 * L3-N8I — metadata-only two-owner staging preflight. No Firebase/SQL access.
 * This cannot approve or perform account creation, shop writes or authentication.
 */
export function assessMerchantABReadiness(input={}){
  const blockers=[];
  const n=key=>Number.isInteger(input[key])&&input[key]>=0?input[key]:null;
  if(n("approvedActiveOwnerCount")===null||input.approvedActiveOwnerCount<2)
    blockers.push("Two distinct owners with approved, nonarchived staging shops have not been verified.");
  if(n("maxApprovedActiveShopsPerOwner")===null||input.maxApprovedActiveShopsPerOwner>1)
    blockers.push("Current N8C owner predicate rejects an owner with multiple approved shops; policy review required.");
  if(input.stagingFirebaseAccountPairVerified!==true)
    blockers.push("Distinct Firebase staging-only A/B identities and UID/owner bindings are unverified.");
  if(input.deployedFirestoreRulesVerified!==true)
    blockers.push("Actual staging Firestore rules and mutation denial have not been verified.");
  if(input.stageApiRevocationVerified!==true)
    blockers.push("Real staging revoked/disabled-token checks have not been observed.");
  return Object.freeze({eligibleForReadOnlyABTest:blockers.length===0,
    blockers:Object.freeze(blockers),evidence:"metadata-preflight-only",
    realFirebaseAuthenticationVerified:false,profileWritesEnabled:false});
}
