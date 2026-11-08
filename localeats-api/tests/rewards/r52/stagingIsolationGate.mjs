/**
 * R5.2 OFFLINE safety preflight policy. No network or secret access.
 *
 * A passing synthetic fixture does NOT certify any hosted project.
 * Real evidence must be independently checked in Firebase, Supabase, Vercel,
 * and against the exact draft commit BEFORE attempting a hosted auth test.
 */
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

function hasIsolatedBranchScope(scopes,branch,key){
 if(!branch || !Array.isArray(scopes))return false;
 const scoped=scopes.filter(item=>item.key===key && item.gitBranch===branch);
 if(scoped.length!==1)return false;
 const targets=scoped[0].target;
 return Array.isArray(targets) && targets.length===1 && targets[0]==="preview";
}
const good=(s)=>typeof s==="string" && Boolean(s.trim());
export function evaluateHostedR52Preflight(m){
 const reasons=[];
 if(!m || typeof m!=="object")return {ready:false,reasons:["EVIDENCE_REQUIRED"]};
 for(const label of ["customer","api"]){
  const p=m[label]||{};
  if(!good(p.branch)||!good(p.expectedSha)||
     !p.deployment||p.deployment.branch!==p.branch||
     p.deployment.sha!==p.expectedSha||
     p.deployment.target!=="preview"||p.deployment.state!=="READY"){
   reasons.push(label.toUpperCase()+"_EXACT_PREVIEW_DEPLOYMENT_UNVERIFIED");
  }
  const keys=label==="customer"?customerKeys:apiKeys;
  const missing=keys.filter(key=>!hasIsolatedBranchScope(p.envScopes,p.branch,key));
  if(missing.length) reasons.push(label.toUpperCase()+"_BRANCH_CREDENTIAL_SCOPES_UNVERIFIED");
 }
 const c=m.customer||{},a=m.api||{};
 if(c.firebaseConfigSource!=="environment")
  reasons.push("CUSTOMER_ENVIRONMENT_ONLY_FIREBASE_NOT_CONFIRMED");
 if(!good(c.firebaseProjectId)||!good(a.firebaseProjectId)||
    !good(m.productionFirebaseProjectId)||c.firebaseProjectId!==a.firebaseProjectId||
    c.firebaseProjectId===m.productionFirebaseProjectId)
  reasons.push("FIREBASE_PROJECT_ISOLATION_UNVERIFIED");
 if(!good(a.supabaseRef)||!good(m.productionSupabaseRef)||
    a.supabaseRef===m.productionSupabaseRef)
  reasons.push("SUPABASE_DATABASE_ISOLATION_UNVERIFIED");
 if(!good(c.stagingApiOrigin)||c.stagingApiOrigin!==a.stagingApiOrigin||
    !c.stagingApiOrigin.startsWith("https://"))
  reasons.push("STAGING_API_ORIGIN_UNVERIFIED");
 if(m.customerWritesEnabled!==false||m.apiWritesEnabled!==false||
    m.profileWritesEnabled!==false||m.rewardsActivationEnabled!==false||
    m.localPayEnabled!==false)
  reasons.push("STAGING_WRITE_OR_PAYMENT_GATES_UNVERIFIED");
 if(m.testAccountsVerifiedSyntheticOnly!==true||
    m.productionCredentialsNotUsed!==true)
  reasons.push("SYNTHETIC_IDENTITY_AND_CREDENTIAL_ISOLATION_UNVERIFIED");
 if(m.actualHostedVerificationApproved!==true)
  reasons.push("HOSTED_TEST_OWNER_APPROVAL_REQUIRED");
 return {ready:reasons.length===0,reasons};
}
