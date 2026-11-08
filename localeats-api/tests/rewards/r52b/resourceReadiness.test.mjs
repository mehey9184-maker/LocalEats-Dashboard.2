import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {assessR52BResources,requiredPickupTables} from "./resourceReadiness.mjs";

const observed=JSON.parse(readFileSync(new URL("./observedResources.snapshot.json",import.meta.url),"utf8"));
const full=()=>({
 supabase:{productionProjectExists:true,stagingProjectExists:true,
   distinctProjectsVerified:true,stagingPublicTables:requiredPickupTables.map(n=>"public."+n)},
 firebase:{independentStagingProjectVerified:true,hostedFirebaseProjectVerified:true,clientApiProjectMatchVerified:true},
 vercel:{customerDraftDeploymentVerified:true,apiDraftDeploymentVerified:true,
   customerBranchOnlyIsolationVerified:true,apiBranchOnlyIsolationVerified:true},
 data:{syntheticFixturesApproved:true,productionRecordsExcluded:true,
   billingAndProjectProvisioningReviewed:true}
});

test("R5.2B observed staging metadata is BLOCKED; only profiles exists in inspected public schema",()=>{
 const assessment=assessR52BResources(observed);
 assert.equal(assessment.assessment,"BLOCKED");
 assert.deepEqual(assessment.missingPickupTables,["shops","menu_items","orders","pickup_order_events"]);
 for(const reason of ["STAGING_PICKUP_SCHEMA_INCOMPLETE","FIREBASE_STAGING_PROJECT_NOT_VERIFIED",
   "FIREBASE_CLIENT_API_PROJECT_MATCH_UNVERIFIED","HOSTED_FIREBASE_PROJECT_NOT_VERIFIED","EXACT_DRAFT_DEPLOYMENTS_MISSING",
   "VERCEL_PREVIEW_CREDENTIAL_ISOLATION_UNVERIFIED","SYNTHETIC_DATA_ONLY_NOT_ESTABLISHED",
   "INFRASTRUCTURE_COST_REVIEW_OPEN"])
   assert.ok(assessment.reasons.includes(reason),reason);
});

test("R5.2B false missing-input snapshot cannot accidentally be accepted",()=>{
 assert.equal(assessR52BResources(null).assessment,"BLOCKED");
 assert.equal(assessR52BResources({}).assessment,"BLOCKED");
});

test("R5.2B separately existing Supabase staging project without pickup schema still blocked",()=>{
 const p=full();p.supabase.stagingPublicTables=["public.profiles"];
 assert.ok(assessR52BResources(p).reasons.includes("STAGING_PICKUP_SCHEMA_INCOMPLETE"));
});

test("R5.2B staging Firebase independence and client/API issuer match must both be proven",()=>{
 for(const key of ["independentStagingProjectVerified","hostedFirebaseProjectVerified","clientApiProjectMatchVerified"]){
  const p=full();p.firebase[key]=false;
  assert.equal(assessR52BResources(p).assessment,"BLOCKED",key);
 }
});

test("R5.2B missing exact draft deployments or isolated branch scopes block acceptance",()=>{
 for(const key of ["customerDraftDeploymentVerified","apiDraftDeploymentVerified",
                     "customerBranchOnlyIsolationVerified","apiBranchOnlyIsolationVerified"]){
  const p=full();p.vercel[key]=false;
  assert.equal(assessR52BResources(p).assessment,"BLOCKED",key);
 }
});

test("R5.2B no live data, synthetic test identities and billing review remain mandatory",()=>{
 for(const key of ["syntheticFixturesApproved","productionRecordsExcluded",
                     "billingAndProjectProvisioningReviewed"]){
  const p=full();p.data[key]=false;
  assert.equal(assessR52BResources(p).assessment,"BLOCKED",key);
 }
});

test("R5.2B hypothetical fully evidenced fixture is only ready for independent review, NOT permission to run tests",()=>{
 const r=assessR52BResources(full());
 assert.equal(r.assessment,"EVIDENCE_READY_FOR_INDEPENDENT_REVIEW");
 assert.deepEqual(r.reasons,[]);
 assert.deepEqual(r.missingPickupTables,[]);
 assert.notEqual(r.assessment,"HOSTED_TEST_APPROVED");
});
