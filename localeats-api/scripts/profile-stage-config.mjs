import {createHash} from 'node:crypto';
export const STAGE_PROJECT='localeats-pickup-stage-261105';
export const STAGE_URL='https://rgpbdajhlrwfmhopzgzk.supabase.co';
export const STAGE_FIREBASE_KEY_SHA256='638678153793d2a4fbe05928da64ad7f79a7064c9e74900bf61995ab762ecb35';
export function validateStageConfig(env,credential,accounts){
 const need=key=>{if(typeof env[key]!=="string"||!env[key].trim())throw Error('Missing staging setting: '+key);return env[key];};
 if(env.PROFILE_STAGE_WRITE_TESTS!=='approved'||env.PROFILE_STAGE_SUPABASE_URL!==STAGE_URL||env.VERCEL||env.VERCEL_ENV==='production'||env.FIREBASE_AUTH_EMULATOR_HOST)throw Error('Isolated local staging test approval/configuration required');
 if(credential?.type!=='service_account'||credential.project_id!==STAGE_PROJECT||!credential.client_email?.endsWith('@'+STAGE_PROJECT+'.iam.gserviceaccount.com')||!credential.private_key?.includes('BEGIN PRIVATE KEY'))throw Error('Dedicated staging service account required');
 const secret=need('PROFILE_STAGE_SERVICE_ROLE_KEY');
 if(secret.startsWith('sb_publishable_'))throw Error('Server credential required');
 if(secret.split('.').length===3){let claims;try{claims=JSON.parse(Buffer.from(secret.split('.')[1],'base64url').toString());}catch{throw Error('Invalid staging server credential');}if(claims.ref!=='rgpbdajhlrwfmhopzgzk'||claims.role!=='service_role')throw Error('Wrong staging server credential');}
 if(accounts?.syntheticOnly!==true||!Array.isArray(accounts.users)||accounts.users.length!==2||new Set(accounts.users.map(u=>u.uid)).size!==2||accounts.users.some(u=>!u.uid||!u.email||!u.password))throw Error('Two distinct explicitly synthetic staging accounts required');
 const firebaseKey=need('PROFILE_STAGE_FIREBASE_API_KEY');
 if(createHash('sha256').update(firebaseKey).digest('hex')!==STAGE_FIREBASE_KEY_SHA256)throw Error('Wrong staging Firebase API key');
 const publicKey=need('PROFILE_STAGE_SUPABASE_PUBLISHABLE_KEY');
 if(!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publicKey)){
  let claims;try{claims=JSON.parse(Buffer.from(publicKey.split('.')[1],'base64url').toString());}catch{throw Error('Invalid staging public credential');}
  if(publicKey.split('.').length!==3||claims.ref!=='rgpbdajhlrwfmhopzgzk'||claims.role!=='anon'||(claims.exp&&claims.exp<=Date.now()/1000))throw Error('Staging anon credential required');
 }
 return{project:STAGE_PROJECT,url:STAGE_URL,secret,publicKey,firebaseKey,credential,users:accounts.users};
}
