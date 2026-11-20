import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {assessSharedStagingRulesRelease} from "./shared-rules-release-gate.mjs";

const full=()=>({
  firebaseProject:"localeats-staging",
  firestoreDatabase:"(default)",
  activeRulesetReadOnlySnapshotVerified:true,
  activeRulesetName:"projects/localeats-staging/rulesets/synthetic-only",
  activeRulesSha256:"0".repeat(64),
  stageCustomerDirectFirestoreCompatibilityPassed:true,
  merchantClientReadOnlyIsolationPassed:true,
  noPublicPrivateDocumentExposureProved:true,
  emulatorCustomerAndMerchantPassed:true,
  rollbackReleaseVerified:true,
  ownerApprovedStageRulesPublish:true,
});

test("N8K actual status: no deployed rules snapshot, Customer flows blocked and no publish approval",()=>{
  const e={
    firebaseProject:"localeats-staging",
    firestoreDatabase:"(default)",
    activeRulesetReadOnlySnapshotVerified:false,
    stageCustomerDirectFirestoreCompatibilityPassed:false,
    merchantClientReadOnlyIsolationPassed:false,
    noPublicPrivateDocumentExposureProved:false,
    emulatorCustomerAndMerchantPassed:true,
    rollbackReleaseVerified:false,
    ownerApprovedStageRulesPublish:false,
  };
  const r=assessSharedStagingRulesRelease(e);
  assert.equal(r.eligibleForStageRulesPublish,false);
  assert.equal(r.productionPublishAllowed,false);
  assert.equal(r.liveStagingRulesVerified,false);
  assert.ok(r.blockers.length>=5);
});
test("N8K any missing condition blocks a shared-stage Firebase rules release",()=>{
  const keys=Object.keys(full());
  for(const key of keys){
    const e=full();delete e[key];
    const result=assessSharedStagingRulesRelease(e);
    assert.equal(result.eligibleForStageRulesPublish,false,key);
  }
});
test("N8K wrong Firebase project, database, rollback ID or SHA always blocks",()=>{
  for(const [field,value] of [
    ["firebaseProject","localeats-5e26e"],
    ["firebaseProject","gen-lang-client-0863469023"],
    ["firestoreDatabase","ai-studio-localeatsvendord-a61b068b-3029-4d93-ba41-626b03a23bbe"],
    ["activeRulesetName","projects/prod/rulesets/forged"],
    ["activeRulesSha256","garbage"],
  ]){
    const e=full();e[field]=value;
    assert.equal(assessSharedStagingRulesRelease(e).eligibleForStageRulesPublish,false,field);
  }
});
test("N8K even synthetic all-true release report never enables Production or account writes",()=>{
  const r=assessSharedStagingRulesRelease(full());
  assert.equal(r.eligibleForStageRulesPublish,true);
  assert.equal(r.productionPublishAllowed,false);
  assert.equal(r.customerAccountWritesActivated,false);
  assert.equal(r.merchantProfileWritesActivated,false);
});
test("N8K fingerprint tool cannot create or release or delete rules",()=>{
  const code=readFileSync(new URL("../../localeats-api/scripts/l3-n8k-read-staging-rules.mjs",import.meta.url),"utf8");
  assert.match(code,/getSecurityRules\(app\)\.getFirestoreRuleset\(\)/);
  for(const forbidden of [
    "releaseFirestoreRuleset(", "releaseFirestoreRulesetFromSource(",
    "createRuleset(", "deleteRuleset(",
    "firebase deploy", "projects.rulesets.create",
  ])assert.equal(code.includes(forbidden),false,forbidden);
  assert.match(code,/LOCALEATS_RULES_AUDIT_MODE:"read-only-approved"/);
  assert.match(code,/FIRESTORE_DATABASE_ID:"\(default\)"/);
  assert.match(code,/CI==="true"/);
});
