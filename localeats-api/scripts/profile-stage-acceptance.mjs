// Local canonical-handler harness with real staging Firebase and Supabase.
// No account creation, schema changes, production writes or automatic cleanup.
import {readFileSync} from 'node:fs';
import {once} from 'node:events';
import {validateStageConfig} from './profile-stage-config.mjs';
const check=(condition,label)=>{if(!condition)throw Error(label);};
async function main(){
 const config=validateStageConfig(process.env,JSON.parse(readFileSync(process.env.PROFILE_STAGE_SERVICE_ACCOUNT_FILE,'utf8')),JSON.parse(readFileSync(process.env.PROFILE_STAGE_ACCOUNTS_FILE,'utf8')));
 if(process.argv.includes('--check')){console.log('Staging preflight passed; no network requests or writes performed.');return;}
 if(!process.argv.includes('--run'))throw Error('Choose --check or --run');
 // Establish a genuine public credential on the pinned staging host before
 // any sign-in or mutation. An invalid-key 401 is never access-control proof.
 const publicCheck=await fetch(config.url+'/auth/v1/settings',{headers:{apikey:config.publicKey},redirect:'error',signal:AbortSignal.timeout(15000)});
 check(publicCheck.status===200&&publicCheck.headers.get('content-type')?.includes('application/json'),'Staging public key validation failed');
 Object.assign(process.env,{FIREBASE_PROJECT_ID:config.project,FIREBASE_CLIENT_EMAIL:config.credential.client_email,FIREBASE_PRIVATE_KEY:config.credential.private_key,SUPABASE_URL:config.url,SUPABASE_SERVICE_ROLE_KEY:config.secret});
 const [{default:express},{createClient},{authAdmin},{makeCustomerProfileRouter},{SupabaseRevisionProfileRepository}]=await Promise.all([import('express'),import('@supabase/supabase-js'),import('../dist/lib/firebaseAdmin.js'),import('../dist/routes/customerProfile.js'),import('../dist/profiles/supabaseProfileRepository.js')]);
 const db=createClient(config.url,config.secret,{auth:{persistSession:false,autoRefreshToken:false}}),repository=new SupabaseRevisionProfileRepository(db,config.url);
 const signIn=async user=>{const response=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+encodeURIComponent(config.firebaseKey),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:user.email,password:user.password,returnSecureToken:true}),signal:AbortSignal.timeout(15000)});check(response.ok(),'Staging sign-in failed');const data=await response.json();check(data.localId===user.uid,'Unexpected synthetic account');const claims=await authAdmin.verifyIdToken(data.idToken,true);check(claims.aud===config.project&&claims.uid===user.uid,'Wrong Firebase project/identity');return data.idToken;};
 const tokens=await Promise.all(config.users.map(signIn));
 // Refuse to touch preexisting rows, even if they appear to be test accounts.
 for(const user of config.users)check(await repository.read(user.uid,AbortSignal.timeout(15000))===null,'Use fresh synthetic accounts without profile rows');
 const app=express();app.use('/api/v1/profiles/me',makeCustomerProfileRouter({enabled:()=>true,writesEnabled:()=>true,repository:()=>repository,verifyIdToken:(token,revoked)=>authAdmin.verifyIdToken(token,revoked)}));
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');const url='http://127.0.0.1:'+server.address().port+'/api/v1/profiles/me';let passed=0;
 const pass=label=>{passed++;console.log('PASS '+label);};
 const request=async(index,method='GET',body)=>{const response=await fetch(url,{method,headers:{...(index===null?{}:{Authorization:'Bearer fb-'+tokens[index]}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});return{status:response.status,data:await response.json()};};
 const read=async i=>{const result=await request(i);check(result.status===200&&result.data.profile?.user_id===config.users[i].uid,'Owner read not confirmed');return result.data;};
 const save=async(i,profile,expectedRevision)=>request(i,'PATCH',{profile,expectedRevision});
 try{
  check((await request(null)).status===401,'Unauthenticated request accepted');pass('unauthenticated access refused');
  for(let i=0;i<2;i++){const result=await save(i,{fullName:'Synthetic acceptance '+i,phone:'0712345678'},null);check(result.status===200&&result.data.profile.user_id===config.users[i].uid,'Create not confirmed');}pass('two isolated synthetic profiles created');
  const original=await read(0),other=await read(1);
  const first=await save(0,{address:'Synthetic pickup test',latitude:0,longitude:0},original.revision);check(first.status===200&&first.data.profile.latitude===0&&first.data.profile.phone==='0712345678','Partial persistence failed');pass('partial fields and zero coordinates persisted');
  const retry=await save(0,{address:'Synthetic pickup test',latitude:0,longitude:0},original.revision);check(retry.status===200&&retry.data.revision===first.data.revision,'Retry mutated or failed');pass('uncertain retry confirmed without another mutation');
  check((await save(0,{fullName:'Stale overwrite'},original.revision)).status===409,'Stale write accepted');pass('stale overwrite refused');
  const parallel=await Promise.all([save(0,{fullName:'Synthetic concurrent A'},first.data.revision),save(0,{fullName:'Synthetic concurrent B'},first.data.revision)]);check(parallel.filter(x=>x.status===200).length===1&&parallel.filter(x=>x.status===409).length===1,'Concurrent writes were not exclusive');pass('one concurrent revision winner');
  const current=await read(0);check(parallel.find(x=>x.status===200).data.revision===current.revision,'Concurrent winner not durable');
  check((await save(0,{user_id:config.users[1].uid,role:'admin'},current.revision)).status===400,'Caller-selected ownership/role accepted');check((await read(1)).revision===other.revision,'Other account changed');pass('foreign ownership and role injection refused');
  tokens[0]=await signIn(config.users[0]);const relogged=await read(0);check(relogged.revision===current.revision&&relogged.profile.fullName===current.profile.fullName,'Fresh sign-in lost saved state');pass('fresh sign-in reads durable profile');
  for(const bearer of [null,tokens[0]])for(const method of ['GET','PATCH']){
   const response=await fetch(config.url+'/rest/v1/profiles?user_id=eq.'+encodeURIComponent(config.users[0].uid),{method,headers:{apikey:config.publicKey,...(bearer?{Authorization:'Bearer '+bearer}:{}),'Content-Type':'application/json',Prefer:'return=representation'},...(method==='PATCH'?{body:JSON.stringify({fullName:'Synthetic forbidden direct write'})}:{}),signal:AbortSignal.timeout(15000)});
   let denied=[401,403].includes(response.status);if(response.status===200)denied=JSON.stringify(await response.json())==='[]';check(denied,'Direct database access unexpectedly available');
  }
  check((await read(0)).profile.fullName===current.profile.fullName,'Direct database write bypassed API');pass('anonymous and Firebase direct database bypass refused');
  console.log(JSON.stringify({passed,environment:'isolated cloud staging via localhost canonical handler',previewVerified:false,cleanup:'Synthetic rows retained; no deletion attempted'}));
 }finally{await new Promise(resolve=>server.close(resolve));server.closeAllConnections();}
}
main().catch(()=>{console.error('Staging acceptance failed. No secrets or server diagnostics are printed; inspect the last completed check. Synthetic rows may remain.');process.exitCode=1;});
