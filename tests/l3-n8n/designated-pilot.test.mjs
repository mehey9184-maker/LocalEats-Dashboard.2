import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import {existsSync} from 'node:fs';
const sourceUrl=new URL('../../localeats-api/src/routes/merchant.ts',import.meta.url);
const helperUrl=new URL('../../localeats-api/src/accounts/designatedPilotShop.ts',import.meta.url);
const isolated={VERCEL_ENV:'preview',LOCALEATS_STAGING_ONLY:'true',FIREBASE_PROJECT_ID:'localeats-staging',SUPABASE_URL:'https://rgpbdajhlrwfmhopzgzk.supabase.co',PICKUP_WRITES_ENABLED:'false',PROFILE_WRITES_ENABLED:'false',MERCHANT_AVAILABILITY_WRITES_ENABLED:'false',MERCHANT_ACCOUNT_WRITES_ENABLED:'false',MERCHANT_DESIGNATED_PILOT_ONLY:'true',MERCHANT_PILOT_DESIGNATIONS:'{"synthetic-A":"shop-2"}'};
const shop=(id,owner='synthetic-A',approval='approved')=>({id,owner_id:owner,approval_status:approval,archived_at:null});
async function request(rows,env=isolated,uid='synthetic-A',error=null){
 const context={process:{env},console:{error(){}},URL};
 if(existsSync(helperUrl)){
  const helper=stripTypeScriptTypes(readFileSync(helperUrl,'utf8')).replace(/\bexport /g,'');
  context.resolveDesignatedPilotShop=vm.runInNewContext(helper+'\nresolveDesignatedPilotShop',context);
 }
 const chain={select(){return this},eq(column,value){assert.equal(column,'owner_id');assert.equal(value,uid);return this},is(){return Promise.resolve({data:rows,error})}};
 const routes=[];const router={get(path,...handlers){routes.push({path,handlers})},patch(){},post(){}};
 const source=stripTypeScriptTypes(readFileSync(sourceUrl,'utf8')).replace(/^import .*?;\s*$/gm,'').replace('export default router;','');
 vm.runInNewContext(source,{...context,Router:()=>router,supabaseAdmin:{from:()=>chain},authenticateFirebase(){},effectiveShop:x=>x});
 const response={statusCode:200,body:null,status(n){this.statusCode=n;return this},json(body){this.body=body;return this}};
 await routes.find(x=>x.path==='/shop').handlers.at(-1)({authUser:{uid}},response);
 return response;
}
test('designated second shop is returned rather than multi-shop 409',async()=>{const r=await request([shop('shop-1'),shop('shop-2')]);assert.equal(r.statusCode,200);assert.equal(r.body.shop.id,'shop-2')});
test('foreign designated shop cannot grant ownership',async()=>{const r=await request([shop('shop-2','synthetic-B')]);assert.equal(r.statusCode,403);assert.equal(r.body.shop,undefined)});
test('unapproved or archived designated shop cannot unlock dashboard',async()=>{for(const row of [shop('shop-2','synthetic-A','pending'),{...shop('shop-2'),archived_at:'2026-11-20'}])assert.equal((await request([row])).statusCode,403)});
test('missing designation blocks pilot even with a single owned shop',async()=>{assert.equal((await request([shop('shop-1')],{...isolated,MERCHANT_PILOT_DESIGNATIONS:'{}'})).statusCode,403)});
test('malformed designation and unsafe deployment fail closed',async()=>{for(const change of [{MERCHANT_PILOT_DESIGNATIONS:'{'},{MERCHANT_PILOT_DESIGNATIONS:'[]'},{VERCEL_ENV:'production'},{FIREBASE_PROJECT_ID:'localeats-5e26e'},{PICKUP_WRITES_ENABLED:'true'}])assert.equal((await request([shop('shop-2')],{...isolated,...change})).statusCode,503)});
test('pilot cannot return a duplicate or wrong designation',async()=>{assert.equal((await request([shop('shop-2'),shop('shop-2')])).statusCode,403);assert.equal((await request([shop('shop-1')])).statusCode,403)});
test('pilot-off retains original single-shop and multi-shop contract',async()=>{assert.equal((await request([shop('shop-1')],{})).statusCode,200);assert.equal((await request([shop('shop-1'),shop('shop-2')],{})).statusCode,409)});
test('database failure does not expose or select a shop',async()=>{assert.equal((await request(null,isolated,'synthetic-A',{message:'synthetic outage'})).statusCode,503)});
