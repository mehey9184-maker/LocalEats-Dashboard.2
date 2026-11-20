import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {assessPairedPreviewReadiness,pairedPreviewRequirements} from "./paired-preview-readiness.mjs";

const reviewCustomer="ad4f523dd6ea3251cbe154864050255f4be48616";
const reviewApi="2b377ee1408516d3df6d2a33e18590b2d3209f09";
const stage=()=>({
 customer:{
  projectId:pairedPreviewRequirements.customerProject,
  repository:"mehey9184-maker/LocalEats-app",
  target:"preview",state:"READY",
  reviewedSha:reviewCustomer,deployedSha:reviewCustomer,
  reviewedBranch:"review/l3-n8m-customer-community-read-contract",
  deployedBranch:"review/l3-n8m-customer-community-read-contract",
  latestMainChangesReconciled:true,
  firebaseConfigSource:"environment",firebaseProjectId:"localeats-staging",
  firestoreDatabaseId:"(default)",
  apiOrigin:pairedPreviewRequirements.apiOrigin,stagingOnly:true,
  stagingDirectWritesGuardVerified:true,
  communityMounted:false,pickupOrderingEnabled:false,
 },
 api:{
  projectId:pairedPreviewRequirements.apiProject,
  repository:"mehey9184-maker/LocalEats-Dashboard.2",
  target:"preview",state:"READY",
  reviewedSha:reviewApi,deployedSha:reviewApi,
  reviewedBranch:"review/l3-n8m-dormant-customer-community-contract",
  deployedBranch:"review/l3-n8m-dormant-customer-community-contract",
  firebaseProjectId:"localeats-staging",firestoreDatabaseId:"(default)",
  adminServiceAccountProjectId:"localeats-staging",adminCredentialProjectAttested:true,
  supabaseProjectId:"staging-separate",
  deploymentOrigin:pairedPreviewRequirements.apiOrigin,
  customerOriginCorsVerified:true,corsOnlyPermitsExpectedOrigins:true,
  stagingOnly:true,communityMounted:false,
  pickupWritesEnabled:false,profileWritesEnabled:false,
  availabilityWritesEnabled:false,merchantAccountWritesEnabled:false,
  communityWritesEnabled:false,previewReadOnly:true,
 },
 production:{
  firebaseProjectId:"different-production-firebase",supabaseProjectId:"different-production-supabase",
  apiOrigin:"https://production.example.invalid",
 },
 verifiedNoProductionDeployment:true,
 ownerApprovedReadOnlyPreviewSmoke:true,
});
test("N8N current verified N8M status is blocked: neither dedicated stage deployment serves those revisions",()=>{
 const current=stage();
 current.customer.deployedSha="c77736e7b4878965baa31ec2ada8138f554d6a7f";
 current.customer.deployedBranch="review/l3-my-kota-private-test-customer";
 current.customer.latestMainChangesReconciled=false;
 current.api.deployedSha="ac4563cbe7e293c27d27152f533a724f831af794";
 current.api.deployedBranch="review/l3-n8g-merchant-staging-cutover";
 current.api.adminCredentialProjectAttested=false;
 current.api.customerOriginCorsVerified=false;
 current.ownerApprovedReadOnlyPreviewSmoke=false;
 const result=assessPairedPreviewReadiness(current);
 assert.equal(result.eligibleForPairedReadOnlySmoke,false);
 assert.match(result.blockers.join(" "),/commits|branch identity|older draft branches/);
 assert.equal(result.realFirebaseTwoAccountVerified,false);
 assert.equal(result.firebaseRulesPublishAuthorized,false);
});
test("N8N perfect synthetic metadata still never proves real Firebase tokens or authorizes data writes",()=>{
 const result=assessPairedPreviewReadiness(stage());
 assert.equal(result.eligibleForPairedReadOnlySmoke,true);
 assert.equal(result.realFirebaseTwoAccountVerified,false);
 assert.equal(result.shopFixtureCreationAuthorized,false);
 assert.equal(result.profileOrOrderWritesAuthorized,false);
 assert.equal(result.productionDeploymentAuthorized,false);
});
test("N8N require both independently reviewed commit SHAs, no stale main branch",()=>{
 for(const change of [
  x=>x.customer.deployedSha="a".repeat(40),
  x=>x.api.deployedSha="b".repeat(40),
  x=>x.customer.reviewedSha="not-a-sha",
  x=>x.api.reviewedBranch="main",
  x=>x.customer.latestMainChangesReconciled=false,
  x=>x.api.target="production",
  x=>x.customer.state="BUILDING",
 ]){
  const x=stage();change(x);
  assert.equal(assessPairedPreviewReadiness(x).eligibleForPairedReadOnlySmoke,false);
 }
});
test("N8N wrong Firebase/Firestore scope, missing Admin attestation, production overlap fail closed",()=>{
 for(const change of [
  x=>x.api.adminCredentialProjectAttested=false,
  x=>x.api.adminServiceAccountProjectId="production-firebase",
  x=>x.customer.firebaseProjectId="production-firebase",
  x=>x.api.firestoreDatabaseId="ai-studio-production-database",
  x=>x.customer.firestoreDatabaseId="ai-studio-production-database",
  x=>x.production.firebaseProjectId="localeats-staging",
  x=>x.api.supabaseProjectId=x.production.supabaseProjectId,
  x=>x.customer.firebaseConfigSource="bundled",
 ]){
  const x=stage();change(x);
  assert.equal(assessPairedPreviewReadiness(x).eligibleForPairedReadOnlySmoke,false);
 }
});
test("N8N API origin, CORS and separate staging project identity must be exact",()=>{
 for(const change of [
  x=>x.customer.apiOrigin="https://localeats-api-production.vercel.app",
  x=>x.api.deploymentOrigin="https://localeats-merchant-api-stage-r52d-mehey9184-makers-projects.vercel.app",
  x=>x.api.customerOriginCorsVerified=false,
  x=>x.api.corsOnlyPermitsExpectedOrigins=false,
  x=>x.customer.projectId=x.api.projectId,
  x=>x.api.repository="some-other-repo",
 ]){
  const x=stage();change(x);
  assert.equal(assessPairedPreviewReadiness(x).eligibleForPairedReadOnlySmoke,false);
 }
});
test("N8N every write gate, dormant UI/router and owner approval independently required",()=>{
 for(const change of [
  x=>x.api.previewReadOnly=false,
  x=>x.api.pickupWritesEnabled=true,
  x=>x.api.profileWritesEnabled=true,
  x=>x.api.availabilityWritesEnabled=true,
  x=>x.api.merchantAccountWritesEnabled=true,
  x=>x.api.communityWritesEnabled=true,
  x=>x.customer.pickupOrderingEnabled=true,
  x=>x.customer.stagingDirectWritesGuardVerified=false,
  x=>x.api.communityMounted=true,
  x=>x.customer.communityMounted=true,
  x=>x.ownerApprovedReadOnlyPreviewSmoke=false,
  x=>x.verifiedNoProductionDeployment=false,
 ]){
  const x=stage();change(x);
  assert.equal(assessPairedPreviewReadiness(x).eligibleForPairedReadOnlySmoke,false);
 }
});
test("N8N no network in readiness helper and active community route remains unmounted",()=>{
 const helper=readFileSync(new URL("./paired-preview-readiness.mjs",import.meta.url),"utf8");
 const server=readFileSync(new URL("../../localeats-api/src/server.ts",import.meta.url),"utf8");
 assert.equal(helper.includes("fetch("),false);
 assert.equal(helper.includes("firebase deploy"),false);
 assert.equal(helper.includes("createClient("),false);
 assert.ok(!server.includes('app.use("/api/v1/community"'));
 assert.ok(!server.includes("customerCommunityReadOnlyContract"));
});
