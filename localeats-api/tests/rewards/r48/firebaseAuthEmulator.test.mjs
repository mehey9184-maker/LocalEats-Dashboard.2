/**
 * R4.8 TRUE LOCAL FIREBASE AUTH EMULATOR REHEARSAL.
 * Demo project, unsigned emulator-only tokens, no real service credentials.
 * NEVER run against production Firebase or Supabase.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {authAdmin} from '../../../dist/lib/firebaseAdmin.js';
import {authenticateFirebase} from '../../../dist/middleware/authenticateFirebase.js';

const project='demo-localeats-r48';
if(process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099' ||
   !['',project].includes(process.env.GCLOUD_PROJECT||'') ||
   process.env.FIREBASE_PROJECT_ID ||
   process.env.FIREBASE_PRIVATE_KEY ||
   process.env.GOOGLE_APPLICATION_CREDENTIALS ||
   process.env.SUPABASE_URL ||
   process.env.DATABASE_URL) {
 throw Error('R48_REFUSE_NON_ISOLATED_FIREBASE_ENVIRONMENT');
}
const app=initializeApp({projectId:project},'localpay-r48-emulator-test');
const auth=getAuth(app);
const base='http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=synthetic-api-key';
let index=0;
const createUser=async function(name,anonymous=false){
 index++;
 const body=anonymous?{returnSecureToken:true}:{
  email:name+'-'+index+'@example.invalid',password:'Synthetic-Only-Passcode-123!',
  returnSecureToken:true
 };
 const res=await fetch(base,{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify(body)});
 const data=await res.json();
 assert.equal(res.status,200,'Auth emulator signup failed: '+JSON.stringify(data));
 assert.equal(typeof data.idToken,'string');
 assert.equal(typeof data.localId,'string');
 return {uid:data.localId,token:data.idToken};
};
const invoke=async token=>{
 const req={headers:{authorization:'Bearer fb-'+token}};
 let called=0,status=200,body;
 const res={status(n){status=n;return this},json(v){body=v;return this}};
 const previous=console.error;console.error=()=>{};
 try{await authenticateFirebase(req,res,()=>{called++});}
 finally{console.error=previous}
 return {called,status,body,user:req.authUser};
};
test('R4.8 emulator creates signed-looking but emulator-only token and Admin checks it',async()=>{
 const user=await createUser('valid');
 const prev=authAdmin.verifyIdToken;
 authAdmin.verifyIdToken=auth.verifyIdToken.bind(auth);
 try{
  const verified=await auth.verifyIdToken(user.token,true);
  assert.equal(verified.uid,user.uid);
  const r=await invoke(user.token);
  assert.equal(r.called,1);assert.equal(r.status,200);
  assert.equal(r.user.uid,user.uid);assert.equal(r.user.isAnonymous,false);
 }finally{authAdmin.verifyIdToken=prev}
});
test('R4.8 actual emulator disabled account fails Firebase Admin check and middleware rejects it',async()=>{
 const user=await createUser('disabled');
 const prev=authAdmin.verifyIdToken;authAdmin.verifyIdToken=auth.verifyIdToken.bind(auth);
 try{
  assert.equal((await invoke(user.token)).status,200);
  await auth.updateUser(user.uid,{disabled:true});
  await assert.rejects(()=>auth.verifyIdToken(user.token,true),
    error=>error?.code==='auth/user-disabled');
  const rejected=await invoke(user.token);
  assert.equal(rejected.status,401);
  assert.equal(rejected.called,0);
  assert.equal(rejected.user,undefined);
 }finally{authAdmin.verifyIdToken=prev}
});
test('R4.8 emulator revocation invalidates previous ID token before private middleware runs',async()=>{
 const user=await createUser('revoked');
 const prev=authAdmin.verifyIdToken;authAdmin.verifyIdToken=auth.verifyIdToken.bind(auth);
 try{
  const before=await invoke(user.token);
  assert.equal(before.status,200);
  // Firebase Auth comparisons are second-resolution; advance beyond login.
  await new Promise(resolve=>setTimeout(resolve,1800));
  await auth.revokeRefreshTokens(user.uid);
  await assert.rejects(()=>auth.verifyIdToken(user.token,true),
    error=>error?.code==='auth/id-token-revoked');
  const denied=await invoke(user.token);
  assert.equal(denied.status,401);
  assert.equal(denied.called,0);
 }finally{authAdmin.verifyIdToken=prev}
});
test('R4.8 emulator anonymous authentication is still labelled anonymous for quote-only flows',async()=>{
 const user=await createUser('anonymous',true);
 const prev=authAdmin.verifyIdToken;authAdmin.verifyIdToken=auth.verifyIdToken.bind(auth);
 try{
  const checked=await invoke(user.token);
  assert.equal(checked.status,200);assert.equal(checked.called,1);
  assert.equal(checked.user.isAnonymous,true);
 }finally{authAdmin.verifyIdToken=prev}
});
test('R4.8 invalid/non-emulator token is not accepted as signed Firebase identity',async()=>{
 const prev=authAdmin.verifyIdToken;authAdmin.verifyIdToken=auth.verifyIdToken.bind(auth);
 try{
  const r=await invoke('unsigned-browser-token-replacement-123');
  assert.equal(r.status,401);assert.equal(r.called,0);
 }finally{authAdmin.verifyIdToken=prev}
});
test.after(async()=>{await deleteApp(app)});
