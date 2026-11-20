import test from "node:test";
import assert from "node:assert/strict";
import {assessMerchantABReadiness} from "./merchant-ab-readiness.mjs";

test("N8I actual staging aggregate blocks A/B: 5 shops, 3 approved, 1 owner",()=>{
  // Only counts from a READ-ONLY staging Supabase query, no private UIDs.
  const result=assessMerchantABReadiness({
    approvedActiveOwnerCount:1,
    maxApprovedActiveShopsPerOwner:3,
    stagingFirebaseAccountPairVerified:false,
    deployedFirestoreRulesVerified:false,
    stageApiRevocationVerified:false,
  });
  assert.equal(result.eligibleForReadOnlyABTest,false);
  assert.equal(result.realFirebaseAuthenticationVerified,false);
  assert.equal(result.profileWritesEnabled,false);
  assert.match(result.blockers.join(" "),/Two distinct owners/);
  assert.match(result.blockers.join(" "),/multiple approved shops/);
});

test("N8I two shops but shared UID is never equivalent to two distinct owners",()=>{
  const result=assessMerchantABReadiness({
    approvedActiveOwnerCount:1,
    maxApprovedActiveShopsPerOwner:1,
    stagingFirebaseAccountPairVerified:true,
    deployedFirestoreRulesVerified:true,
    stageApiRevocationVerified:true,
  });
  assert.equal(result.eligibleForReadOnlyABTest,false);
});

test("N8I synthetic complete metadata is not real Firebase acceptance",()=>{
  const result=assessMerchantABReadiness({
    approvedActiveOwnerCount:2,
    maxApprovedActiveShopsPerOwner:1,
    stagingFirebaseAccountPairVerified:true,
    deployedFirestoreRulesVerified:true,
    stageApiRevocationVerified:true,
  });
  assert.equal(result.eligibleForReadOnlyABTest,true);
  assert.equal(result.realFirebaseAuthenticationVerified,false);
  assert.equal(result.profileWritesEnabled,false);
});

test("N8I unknown or invalid counts reject rather than guessing",()=>{
  for(const input of [{}, {approvedActiveOwnerCount:-1,maxApprovedActiveShopsPerOwner:1},
    {approvedActiveOwnerCount:2,maxApprovedActiveShopsPerOwner:undefined},
    {approvedActiveOwnerCount:"2",maxApprovedActiveShopsPerOwner:1}]){
    assert.equal(assessMerchantABReadiness(input).eligibleForReadOnlyABTest,false);
  }
});
