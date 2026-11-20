/** One exact configured Customer Preview; does not bypass Firebase authorization. */
export function isPairedCustomerOrigin(origin:string|undefined,env:NodeJS.ProcessEnv=process.env):boolean {
 if(!origin || origin!==env.PAIRED_CUSTOMER_ORIGIN)return false;
 try {
  const url=new URL(origin);
  if(url.origin!==origin || url.protocol!=='https:' || url.username || url.password ||
     !/^localeats-customer-staging-r52d-[a-z0-9]{9}\.vercel\.app$/.test(url.hostname))return false;
 }catch{return false;}
 return env.VERCEL_ENV==='preview' && env.LOCALEATS_STAGING_ONLY==='true' &&
  env.FIREBASE_PROJECT_ID==='localeats-staging' &&
  env.SUPABASE_URL==='https://rgpbdajhlrwfmhopzgzk.supabase.co' &&
  ['PICKUP_WRITES_ENABLED','PROFILE_WRITES_ENABLED','MERCHANT_AVAILABILITY_WRITES_ENABLED','MERCHANT_ACCOUNT_WRITES_ENABLED']
   .every(key=>env[key]==='false');
}
