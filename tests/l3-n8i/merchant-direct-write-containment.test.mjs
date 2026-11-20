import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const read=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");
const helperSource=read("src/lib/merchantStagingNoWrite.ts");
const helperJS=ts.transpileModule(helperSource,{
  compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},
  fileName:"merchantStagingNoWrite.ts",
}).outputText;
const helper=await import("data:text/javascript;base64,"+Buffer.from(helperJS).toString("base64"));

test("N8I pure guard rejects either independent staging/preview marker",()=>{
  for(const env of [
    {VITE_MERCHANT_STAGING_ONLY:"true"},
    {VITE_MERCHANT_PREVIEW_READ_ONLY:"true"},
    {VITE_MERCHANT_STAGING_ONLY:"true",VITE_MERCHANT_PREVIEW_READ_ONLY:"true"},
  ]){
    assert.equal(helper.isMerchantClientMutationBlocked(env),true);
    assert.throws(()=>helper.assertMerchantClientMutationAllowed(env),
      /Merchant staging is read-only/);
  }
  assert.equal(helper.isMerchantClientMutationBlocked({}),false);
  assert.equal(helper.isMerchantClientMutationBlocked({
    VITE_MERCHANT_STAGING_ONLY:"false",VITE_MERCHANT_PREVIEW_READ_ONLY:"false",
  }),false);
});
test("N8I block cannot be disabled by a second false/absent flag",()=>{
  const combinations=[
    {VITE_MERCHANT_STAGING_ONLY:"true",VITE_MERCHANT_PREVIEW_READ_ONLY:"false"},
    {VITE_MERCHANT_STAGING_ONLY:"false",VITE_MERCHANT_PREVIEW_READ_ONLY:"true"},
    {VITE_MERCHANT_STAGING_ONLY:"true",VITE_MERCHANT_PREVIEW_READ_ONLY:undefined},
    {VITE_MERCHANT_STAGING_ONLY:undefined,VITE_MERCHANT_PREVIEW_READ_ONLY:"true"},
  ];
  for(const env of combinations)
    assert.equal(helper.isMerchantClientMutationBlocked(env),true);
});

test("N8I password login and logout do not depend on mutation guard",()=>{
  const source=read("src/lib/firebase.ts");
  const login=source.slice(source.indexOf("export async function firebaseSignIn("),
                           source.indexOf("export async function firebaseSignInWithGoogle("));
  const logout=source.slice(source.indexOf("export async function firebaseSignOutUser("),
                            source.indexOf("export async function firebaseResetPassword("));
  assert.match(login,/signInWithEmailAndPassword\(auth/);
  assert.ok(!login.includes("ensureMerchantClientMutationAllowed()"));
  assert.match(logout,/firebaseSignOut\(auth\)/);
  assert.ok(!logout.includes("ensureMerchantClientMutationAllowed()"));
});

test("N8I Firebase Auth account creation/Google provisioning/reset all fail before SDK mutation",()=>{
  const s=read("src/lib/firebase.ts");
  const rules=[
    ["firebaseSignInWithGoogle","signInWithPopup"],
    ["firebaseSignUp","createUserWithEmailAndPassword"],
    ["firebaseResetPassword","sendPasswordResetEmail"],
    ["updateFirebaseUserProfile","updateProfile"],
  ];
  for(const [func,sdk] of rules){
    const start=s.indexOf("export async function "+func+"(");
    assert.ok(start>=0,func+" missing");
    const body=s.slice(start,start+1700);
    const guard=body.indexOf("ensureMerchantClientMutationAllowed();");
    const write=body.indexOf(sdk+"(");
    assert.ok(guard>=0 && write>guard,func+" not guarded before SDK call");
  }
});
test("N8I direct Firebase storage/shops/menu/migration mutation entry points guarded",()=>{
  const s=read("src/lib/firebase.ts");
  for(const [method,expected] of [
    ["uploadImageToFirebaseStorage","ensureMerchantClientMutationAllowed();"],
    ["migrateDataToFirestore","ensureMerchantClientMutationAllowed();"],
    ["updateFirestoreShop","isMerchantClientMutationBlocked(import.meta.env)"],
    ["updateFirestoreMenuItem","isMerchantClientMutationBlocked(import.meta.env)"],
    ["createFirestoreMenuItem","isMerchantClientMutationBlocked(import.meta.env)"],
    ["deleteFirestoreMenuItem","isMerchantClientMutationBlocked(import.meta.env)"],
  ]){
    const start=s.indexOf("export async function "+method+"(");
    assert.ok(start>=0,method+" missing");
    const first=s.slice(start,start+900);
    const guard=first.indexOf(expected);
    assert.ok(guard>=0,method+" lacks early no-write gate");
    const firstSDK=Math.min(...["setDoc(","deleteDoc(","writeBatch(","uploadBytes("].map(x=>
      first.includes(x)?first.indexOf(x):Infinity));
    assert.ok(guard<firstSDK,method+" guard occurs after network write");
  }
});
test("N8I Supabase-compatible Firestore UPDATE/INSERT/UPSERT/DELETE fail before any collection call",()=>{
  const s=read("src/lib/supabase.ts");
  const begin=s.indexOf("private async execute()");
  const end=s.indexOf("      const collRef = collection(db, this.collectionName);",begin);
  assert.ok(begin>=0 && end>begin,"execute() or network start missing");
  const pre=s.slice(begin,end);
  assert.match(pre,/this.insertData !== undefined \|\| this.updateData !== undefined \|\| this.isDelete/);
  assert.match(pre,/isMerchantClientMutationBlocked\(import.meta.env\)/);
  assert.match(pre,/return \{data:null,error:new Error\(MERCHANT_STAGING_WRITE_DISABLED\)\}/);
  // Existing query/read-only logic remains after the guard.
  assert.match(s.slice(end,end+3400),/\/\/ SELECT \/ QUERY|\/\/ UPDATE/);
});
test("N8I original preview heartbeat and API write blocks remain",()=>{
  const app=read("src/App.tsx");
  const server=read("localeats-api/src/server.ts");
  const check=read("src/lib/supabase.ts");
  assert.match(app,/VITE_MERCHANT_PREVIEW_READ_ONLY === "true"/);
  assert.match(server,/app\.use\(previewReadOnlyGate\)/);
  assert.ok(!server.includes("merchantAccountDormantApi"));
  assert.ok(!server.includes('app.use("/api/v1/merchant/account"'));
  assert.match(check,/Merchant profile changes are unavailable until secure profile saving/);
});
test("N8I static rule findings are recorded without deploying new security rules",()=>{
  const rules=read("firestore.rules");
  assert.match(rules,/match \/users\/\{userId\}[\s\S]*?allow read, write: if isAuthenticated\(\) && request.auth.uid == userId/);
  assert.match(rules,/match \/shops\/\{shopId\}[\s\S]*?allow update, delete: if isAuthenticated\(\) && resource.data.owner_id == request.auth.uid/);
  assert.match(rules,/match \/rider_profiles\/\{riderId\}[\s\S]*?allow read: if isAuthenticated\(\)/);
  assert.match(rules,/resource.data.delivery_status == "finding_rider"/);
});
