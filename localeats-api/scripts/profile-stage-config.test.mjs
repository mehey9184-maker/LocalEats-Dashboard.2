import test from 'node:test';
import assert from 'node:assert/strict';
import {validateStageConfig,STAGE_URL,STAGE_PROJECT} from './profile-stage-config.mjs';
const env=()=>({PROFILE_STAGE_WRITE_TESTS:'approved',PROFILE_STAGE_SUPABASE_URL:STAGE_URL,PROFILE_STAGE_SERVICE_ROLE_KEY:'sb_secret_synthetic',PROFILE_STAGE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_synthetic',PROFILE_STAGE_FIREBASE_API_KEY:"AIzaSyAB3pITZZc3_VD5OnSvMvnuqnbQfcRV2n4"});
const credential=()=>({type:'service_account',project_id:STAGE_PROJECT,client_email:'acceptance@'+STAGE_PROJECT+'.iam.gserviceaccount.com',private_key:'-----BEGIN PRIVATE KEY-----synthetic'});
const accounts=()=>({syntheticOnly:true,users:[{uid:'A',email:'a@example.invalid',password:'synthetic'},{uid:'B',email:'b@example.invalid',password:'synthetic'}]});
test('the exact isolated configuration passes without SDK imports or network',()=>{assert.equal(validateStageConfig(env(),credential(),accounts()).url,STAGE_URL);});
for(const [key,value] of [['PROFILE_STAGE_WRITE_TESTS',''],['PROFILE_STAGE_SUPABASE_URL','https://production.example.invalid'],['VERCEL','1'],['VERCEL_ENV','production'],['FIREBASE_AUTH_EMULATOR_HOST','localhost:9099'],['PROFILE_STAGE_SERVICE_ROLE_KEY','sb_publishable_wrong'],['PROFILE_STAGE_FIREBASE_API_KEY','']])test('preflight rejects unsafe or incomplete '+key,()=>{assert.throws(()=>validateStageConfig({...env(),[key]:value},credential(),accounts()));});
test('owner OAuth or a service account from another project is refused',()=>{for(const c of [{type:'authorized_user'},{...credential(),project_id:'production'},{...credential(),client_email:'service@production.iam.gserviceaccount.com'}])assert.throws(()=>validateStageConfig(env(),c,accounts()));});
test('legacy production service-role keys cannot be sent to staging',()=>{const key='x.'+Buffer.from(JSON.stringify({ref:'production',role:'service_role'})).toString('base64url')+'.x';assert.throws(()=>validateStageConfig({...env(),PROFILE_STAGE_SERVICE_ROLE_KEY:key},credential(),accounts()));});
test('accounts must be two distinct explicitly synthetic records',()=>{for(const a of [{...accounts(),syntheticOnly:false},{...accounts(),users:[accounts().users[0]]},{...accounts(),users:[accounts().users[0],accounts().users[0]]}])assert.throws(()=>validateStageConfig(env(),credential(),a));});

test('nonempty wrong-project Firebase keys are refused before any password request',()=>{assert.throws(()=>validateStageConfig({...env(),PROFILE_STAGE_FIREBASE_API_KEY:'wrong-project-public-key'},credential(),accounts()));});
test('server secrets and wrong-project legacy keys cannot be used as public credentials',()=>{
 const jwt=claims=>'x.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.x';
 for(const key of ['sb_secret_wrong','invalid',jwt({ref:'rgpbdajhlrwfmhopzgzk',role:'service_role'}),jwt({ref:'production',role:'anon'}),jwt({ref:'rgpbdajhlrwfmhopzgzk',role:'anon',exp:1})])assert.throws(()=>validateStageConfig({...env(),PROFILE_STAGE_SUPABASE_PUBLISHABLE_KEY:key},credential(),accounts()));
});
