import test from "node:test";
import assert from "node:assert/strict";
import {evaluateHostedR52Preflight} from "./stagingIsolationGate.mjs";

const customerKeys=[
 "VITE_FIREBASE_API_KEY","VITE_FIREBASE_AUTH_DOMAIN","VITE_FIREBASE_PROJECT_ID",
 "VITE_FIREBASE_STORAGE_BUCKET","VITE_FIREBASE_MESSAGING_SENDER_ID",
 "VITE_FIREBASE_APP_ID","VITE_FIREBASE_FIRESTORE_DATABASE_ID",
 "VITE_FIREBASE_CONFIG_SOURCE","VITE_LOCALEATS_API_URL",
 "VITE_PICKUP_ORDERING_ENABLED"
];
const apiKeys=[
 "FIREBASE_PROJECT_ID","FIREBASE_PRIVATE_KEY","FIREBASE_CLIENT_EMAIL",
 "SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","PICKUP_WRITES_ENABLED"
];
const customerBranch="docs/rewards-master-handover-pointer-20261108";
const apiBranch="docs/rewards-master-plan-credit-20261108";
const makeScopes=(keys,branch)=>keys.map(key=>({key,target:["preview"],gitBranch:branch}));
function hypothetical(){
 return {
  customer:{
   branch:customerBranch,expectedSha:"synthetic-customer-commit",
   deployment:{branch:customerBranch,sha:"synthetic-customer-commit",target:"preview",state:"READY"},
   envScopes:makeScopes(customerKeys,customerBranch),
   firebaseConfigSource:"environment",
   firebaseProjectId:"demo-r52-isolated",
   stagingApiOrigin:"https://isolated-test-api.example.invalid"
  },
  api:{
   branch:apiBranch,expectedSha:"synthetic-api-commit",
   deployment:{branch:apiBranch,sha:"synthetic-api-commit",target:"preview",state:"READY"},
   envScopes:makeScopes(apiKeys,apiBranch),
   firebaseProjectId:"demo-r52-isolated",
   stagingApiOrigin:"https://isolated-test-api.example.invalid",
   supabaseRef:"synthetic-stage-db"
  },
  productionFirebaseProjectId:"synthetic-production-firebase",
  productionSupabaseRef:"synthetic-production-db",
  customerWritesEnabled:false,apiWritesEnabled:false,
  profileWritesEnabled:false,rewardsActivationEnabled:false,localPayEnabled:false,
  testAccountsVerifiedSyntheticOnly:true,
  productionCredentialsNotUsed:true,
  actualHostedVerificationApproved:true
 };
}
test("R5.2 policy rejects actual Vercel metadata observations: shared scopes and no exact draft deployments",()=>{
 const m=hypothetical();
 m.customer.deployment=null;
 m.api.deployment=null;
 m.customer.firebaseConfigSource="unconfigured";
 m.customer.envScopes=customerKeys.map(key=>({key,target:["production","preview"]}));
 m.api.envScopes=apiKeys.map(key=>({key,target:["production","preview"]}));
 m.customer.firebaseProjectId="";
 m.api.firebaseProjectId="";
 m.api.supabaseRef="";
 m.testAccountsVerifiedSyntheticOnly=false;
 m.productionCredentialsNotUsed=false;
 m.actualHostedVerificationApproved=false;
 const result=evaluateHostedR52Preflight(m);
 assert.equal(result.ready,false);
 for(const reason of [
 "CUSTOMER_EXACT_PREVIEW_DEPLOYMENT_UNVERIFIED",
 "API_EXACT_PREVIEW_DEPLOYMENT_UNVERIFIED",
 "CUSTOMER_BRANCH_CREDENTIAL_SCOPES_UNVERIFIED",
 "API_BRANCH_CREDENTIAL_SCOPES_UNVERIFIED",
 "CUSTOMER_ENVIRONMENT_ONLY_FIREBASE_NOT_CONFIRMED",
 "FIREBASE_PROJECT_ISOLATION_UNVERIFIED",
 "SUPABASE_DATABASE_ISOLATION_UNVERIFIED"
 ])assert.ok(result.reasons.includes(reason),reason);
});

test("R5.2 synthetic fully isolated evidence would satisfy policy; this does not verify any real cloud configuration",()=>{
 assert.deepEqual(evaluateHostedR52Preflight(hypothetical()),{ready:true,reasons:[]});
});
test("R5.2 same Firebase project as Production or mismatched API issuer is blocked",()=>{
 const m=hypothetical();m.api.firebaseProjectId="another-stage-project";
 assert.ok(evaluateHostedR52Preflight(m).reasons.includes("FIREBASE_PROJECT_ISOLATION_UNVERIFIED"));
 const n=hypothetical();n.productionFirebaseProjectId=n.customer.firebaseProjectId;
 assert.ok(evaluateHostedR52Preflight(n).reasons.includes("FIREBASE_PROJECT_ISOLATION_UNVERIFIED"));
});
test("R5.2 same Supabase DB as Production is blocked",()=>{
 const m=hypothetical();m.api.supabaseRef=m.productionSupabaseRef;
 assert.ok(evaluateHostedR52Preflight(m).reasons.includes("SUPABASE_DATABASE_ISOLATION_UNVERIFIED"));
});
test("R5.2 shared Vercel Preview/Production secret scopes and wrong branch overrides are blocked",()=>{
 const m=hypothetical();
 m.api.envScopes=m.api.envScopes.map(item=>item.key==="SUPABASE_SERVICE_ROLE_KEY"?{...item,target:["preview","production"]}:item);
 assert.ok(evaluateHostedR52Preflight(m).reasons.includes("API_BRANCH_CREDENTIAL_SCOPES_UNVERIFIED"));
 const n=hypothetical();n.customer.envScopes[0].gitBranch="some-other-branch";
 assert.ok(evaluateHostedR52Preflight(n).reasons.includes("CUSTOMER_BRANCH_CREDENTIAL_SCOPES_UNVERIFIED"));
});
test("R5.2 wrong commit, non-READY Preview or missing exact branch deployment is blocked",()=>{
 for(const field of ["sha","state","target","branch"]){
  const m=hypothetical();
  m.customer.deployment[field]="invalid";
  assert.ok(evaluateHostedR52Preflight(m).reasons.includes("CUSTOMER_EXACT_PREVIEW_DEPLOYMENT_UNVERIFIED"),field);
 }
});
test("R5.2 any write gate enabled or unverified prevents hosted authentication checks",()=>{
 for(const field of ["customerWritesEnabled","apiWritesEnabled","profileWritesEnabled","rewardsActivationEnabled","localPayEnabled"]){
  const m=hypothetical();m[field]=true;
  assert.ok(evaluateHostedR52Preflight(m).reasons.includes("STAGING_WRITE_OR_PAYMENT_GATES_UNVERIFIED"),field);
 }
});
test("R5.2 synthetic user, credential isolation, and owner test authorization cannot be assumed",()=>{
 const m=hypothetical();m.productionCredentialsNotUsed=false;
 assert.equal(evaluateHostedR52Preflight(m).ready,false);
 const n=hypothetical();n.actualHostedVerificationApproved=false;
 assert.ok(evaluateHostedR52Preflight(n).reasons.includes("HOSTED_TEST_OWNER_APPROVAL_REQUIRED"));
});


function dedicatedHypothetical(){
 const m=hypothetical();
 m.productionVercelProjectIds=["synthetic-prod-customer","synthetic-prod-api"];
 for(const label of ["customer","api"]){
  const p=m[label];
  p.mode="dedicated_staging";
  p.projectId="synthetic-"+label+"-stage-project";
  p.projectIdentityVerified=true;
  p.productionTargetEmptyVerified=true;
  p.inheritedEnvAbsentVerified=true;
  p.credentialProvenanceVerifiedNonproduction=true;
  p.envScopes=(label==="customer"?customerKeys:apiKeys)
    .map(key=>({key,target:["preview"]}));
 }
 return m;
}

test("R5.2D a fully evidenced dedicated staging fixture satisfies scope policy ONLY in synthetic evidence",()=>{
 const m=dedicatedHypothetical();
 assert.deepEqual(evaluateHostedR52Preflight(m),{ready:true,reasons:[]});
});

test("R5.2D dedicated project with live Vercel ID must never be accepted",()=>{
 const m=dedicatedHypothetical();
 m.customer.projectId=m.productionVercelProjectIds[0];
 assert.ok(evaluateHostedR52Preflight(m).reasons.includes("CUSTOMER_DEDICATED_PROJECT_ISOLATION_UNVERIFIED"));
});

test("R5.2D dedicated project collision, missing independent provenance or inherited vars are blocked",()=>{
 const shared=dedicatedHypothetical();
 shared.api.projectId=shared.customer.projectId;
 assert.ok(evaluateHostedR52Preflight(shared).reasons.includes("CUSTOMER_AND_API_STAGING_PROJECT_COLLISION"));
 for(const field of ["projectIdentityVerified","productionTargetEmptyVerified","inheritedEnvAbsentVerified","credentialProvenanceVerifiedNonproduction"]){
  const m=dedicatedHypothetical(); m.api[field]=false;
  assert.ok(evaluateHostedR52Preflight(m).reasons.includes("API_DEDICATED_PROJECT_ISOLATION_UNVERIFIED"),field);
 }
});

test("R5.2D dedicated Preview project must reject Production scope, duplicated keys and wrong branch",()=>{
 const a=dedicatedHypothetical();
 a.customer.envScopes[0].target=["production","preview"];
 assert.ok(evaluateHostedR52Preflight(a).reasons.includes("CUSTOMER_DEDICATED_PREVIEW_SCOPES_UNVERIFIED"));
 const b=dedicatedHypothetical();
 b.api.envScopes.push({...b.api.envScopes[0]});
 assert.ok(evaluateHostedR52Preflight(b).reasons.includes("API_DEDICATED_PREVIEW_SCOPES_UNVERIFIED"));
 const c=dedicatedHypothetical();
 c.customer.envScopes[1].gitBranch="main";
 assert.ok(evaluateHostedR52Preflight(c).reasons.includes("CUSTOMER_DEDICATED_PREVIEW_SCOPES_UNVERIFIED"));
});

test("R5.2D actual safe empty project shells remain blocked without API secrets, HTTPS origin and exact deployment",()=>{
 const m=dedicatedHypothetical();
 m.customer.deployment=null;
 m.api.deployment=null;
 m.customer.stagingApiOrigin="";
 m.api.stagingApiOrigin="";
 m.customer.envScopes=m.customer.envScopes.filter(v=>v.key!=="VITE_LOCALEATS_API_URL");
 m.api.envScopes=m.api.envScopes.filter(v=>!["FIREBASE_PRIVATE_KEY","FIREBASE_CLIENT_EMAIL","SUPABASE_SERVICE_ROLE_KEY"].includes(v.key));
 m.productionCredentialsNotUsed=false; // credentials not yet independently verified
 m.actualHostedVerificationApproved=false;
 const res=evaluateHostedR52Preflight(m);
 assert.equal(res.ready,false);
 for(const key of ["CUSTOMER_EXACT_PREVIEW_DEPLOYMENT_UNVERIFIED","API_EXACT_PREVIEW_DEPLOYMENT_UNVERIFIED",
   "CUSTOMER_DEDICATED_PREVIEW_SCOPES_UNVERIFIED","API_DEDICATED_PREVIEW_SCOPES_UNVERIFIED",
   "STAGING_API_ORIGIN_UNVERIFIED","HOSTED_TEST_OWNER_APPROVAL_REQUIRED"])
  assert.ok(res.reasons.includes(key),key);
});
