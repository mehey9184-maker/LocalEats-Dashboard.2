#!/usr/bin/env node
/**
 * L3-N8K — READ-ONLY rules fingerprint tool, for future *approved* use.
 *
 * NOT USED BY CI. This file never requests or changes rules releases.
 * Run only in an independently authorized, private staging-only environment
 * with read-only Rules API permissions. Never publish keys or rules content.
 *
 * getFirestoreRuleset() fetches only the active (default) Firestore ruleset.
 * The Merchant+Customer staging web apps explicitly use that database.
 */
import {createHash} from "node:crypto";
import {applicationDefault,initializeApp,deleteApp} from "firebase-admin/app";
import {getSecurityRules} from "firebase-admin/security-rules";

const expected="localeats-staging";
const required={
  LOCALEATS_RULES_AUDIT_MODE:"read-only-approved",
  FIREBASE_PROJECT_ID:expected,
  FIRESTORE_DATABASE_ID:"(default)",
  LOCALEATS_STAGING_ONLY:"true",
};

export function assertReadOnlyStagingRulesPreflight(env){
  for(const [name,value] of Object.entries(required)){
    if(env[name]!==value)throw Error("L3_N8K_STAGING_RULES_READ_BLOCKED:"+name);
  }
  if(env.VERCEL_ENV==="production" || env.CI==="true" ||
      env.GOOGLE_CLOUD_PROJECT && env.GOOGLE_CLOUD_PROJECT!==expected ||
      env.GCLOUD_PROJECT && env.GCLOUD_PROJECT!==expected)
    throw Error("L3_N8K_STAGING_RULES_READ_BLOCKED:UNSAFE_CONTEXT");
  return true;
}

async function main(){
  assertReadOnlyStagingRulesPreflight(process.env);
  const app=initializeApp({
    credential:applicationDefault(),projectId:expected,
  },"l3-n8k-verified-staging-rules-read");
  try {
    const ruleset=await getSecurityRules(app).getFirestoreRuleset();
    if(typeof ruleset?.name!=="string" ||
       !ruleset.name.startsWith("projects/"+expected+"/rulesets/"))
      throw Error("L3_N8K_STAGING_RULES_READ_BLOCKED:PROJECT_MISMATCH");
    const files=ruleset.source;
    if(!Array.isArray(files) || !files.length)
      throw Error("L3_N8K_STAGING_RULES_READ_BLOCKED:EMPTY_RULESET");
    const fingerprints=files.map(file=>{
      if(typeof file.name!=="string" || file.content==null)
        throw Error("L3_N8K_STAGING_RULES_READ_BLOCKED:INVALID_RULES_FILE");
      return {fileName:file.name,
        sha256:createHash("sha256").update(file.content).digest("hex")};
    });
    // Never print source, tokens, service-account identity, or private file.
    process.stdout.write(JSON.stringify({
      project:expected,database:"(default)",
      rulesetName:ruleset.name,
      fingerprints,
      audit:"READ_ONLY_RULESET_FINGERPRINT_NOT_RELEASE_OR_PUBLISH",
    })+"\n");
  }finally{
    await deleteApp(app);
  }
}

// Import for local synthetic preflight tests; do not trigger a cloud call.
if(process.argv[1] && import.meta.url===new URL("file://"+process.argv[1]).href)
  main().catch(err=>{
    const code=String(err?.message??"UNKNOWN")
      .replace(/[^A-Z0-9_:\-]/gi,"").slice(0,160);
    process.stderr.write("L3_N8K_RULES_FINGERPRINT_FAILED:"+code+"\n");
    process.exitCode=1;
  });
