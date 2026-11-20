import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
const origin='https://localeats-customer-staging-r52d-abcdef123.vercel.app';
const env={PAIRED_CUSTOMER_ORIGIN:origin,VERCEL_ENV:'preview',LOCALEATS_STAGING_ONLY:'true',FIREBASE_PROJECT_ID:'localeats-staging',SUPABASE_URL:'https://rgpbdajhlrwfmhopzgzk.supabase.co',PICKUP_WRITES_ENABLED:'false',PROFILE_WRITES_ENABLED:'false',MERCHANT_AVAILABILITY_WRITES_ENABLED:'false',MERCHANT_ACCOUNT_WRITES_ENABLED:'false'};
async function load(){
 const context={URL,process:{env:{}},privateMyKotaCorsAllowed:()=>false,isVerifiedMerchantStagingOrigin:()=>false,isIsolatedCustomerPushCorsOrigin:()=>false};
 try{const code=stripTypeScriptTypes(readFileSync(new URL('../../localeats-api/src/middleware/pairedCustomerCors.ts',import.meta.url),'utf8')).replace(/\bexport /g,'');context.isPairedCustomerOrigin=vm.runInNewContext(code+'\nisPairedCustomerOrigin',context)}catch(e){if(e.code!=='ENOENT')throw e}
 const code=stripTypeScriptTypes(readFileSync(new URL('../../localeats-api/src/corsOrigins.ts',import.meta.url),'utf8')).replace(/^import .*?;\s*$/gm,'').replace(/\bexport /g,'');
 return vm.runInNewContext(code+'\nisAllowedOrigin',context);
}
test('configured immutable Customer preview is admitted on isolated read-only API',async()=>assert.equal((await load())(origin,env),true));
test('unrelated origins and deployment mismatches are rejected',async()=>{const allowed=await load();for(const change of [{VERCEL_ENV:'production'},{FIREBASE_PROJECT_ID:'localeats-5e26e'},{SUPABASE_URL:'https://production.example'},{PROFILE_WRITES_ENABLED:'true'},{MERCHANT_ACCOUNT_WRITES_ENABLED:undefined},{PAIRED_CUSTOMER_ORIGIN:origin+'/'},{PAIRED_CUSTOMER_ORIGIN:'https://attacker.example'}])assert.equal(allowed(origin,{...env,...change}),false);assert.equal(allowed(origin.replace('abcdef123','abcdef124'),env),false)});
