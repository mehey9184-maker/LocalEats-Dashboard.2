import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
const env={VERCEL_ENV:'preview',LOCALEATS_STAGING_ONLY:'true',FIREBASE_PROJECT_ID:'localeats-staging',SUPABASE_URL:'https://rgpbdajhlrwfmhopzgzk.supabase.co',PICKUP_WRITES_ENABLED:'false',PROFILE_WRITES_ENABLED:'false',MERCHANT_AVAILABILITY_WRITES_ENABLED:'false',MERCHANT_ACCOUNT_WRITES_ENABLED:'false',MERCHANT_DESIGNATED_PILOT_ONLY:'true',MERCHANT_PILOT_DESIGNATIONS:'{"synthetic-A":"shop-2"}'};
async function inbox(change={}){
 const context={process:{env:{...env,...change}},console:{error(){}}};
 const helper=stripTypeScriptTypes(readFileSync(new URL('../../localeats-api/src/accounts/designatedPilotShop.ts',import.meta.url),'utf8')).replace(/\bexport /g,'');
 context.resolveDesignatedPilotShop=vm.runInNewContext(helper+'\nresolveDesignatedPilotShop',context);
 const shops=[{id:'shop-1',owner_id:'synthetic-A',approval_status:'approved',archived_at:null},{id:'shop-2',owner_id:'synthetic-A',approval_status:'approved',archived_at:null}];
 const orders=[{id:'order-1',shop_id:'shop-1'},{id:'order-2',shop_id:'shop-2'}];
 const routes=[];const Router=()=>({get(path,...handlers){routes.push({path,handlers})},post(){}});
 class OrderContractError extends Error{constructor(status,code,message){super(message);this.status=status;this.code=code}}
 const supabaseAdmin={from(table){let ids;const chain={select(){return this},eq(){return this},is(){return Promise.resolve({data:shops,error:null})},in(_column,value){ids=value;return this},order(){return this},or(){return this},range(){return this.limit()},limit(){return Promise.resolve({data:orders.filter(o=>!ids || ids.includes(o.shop_id)),error:null})}};return chain}};
 const code=stripTypeScriptTypes(readFileSync(new URL('../../localeats-api/src/routes/orders.ts',import.meta.url),'utf8')).replace(/^import [\s\S]*? from ["'][^"']+["'];\s*/gm,'').replace(/^import \{[^\n]*\} from ["'][^"']+["'];\s*/gm,'').replace(/export default router;?/g,'').replace(/\bexport /g,'');
 vm.runInNewContext(code,{...context,Router,OrderContractError,supabaseAdmin,authenticateFirebase(){},SupabaseOrderRepository:class{},MERCHANT_INBOX_RECENT_LIMIT:100,MERCHANT_UNFINISHED_FILTER:"synthetic-unfinished",readCompleteMerchantInbox:async source=>{const recent=await source.recent();const older=await source.unfinishedPage(0,9);return [...new Map([...recent,...older].map(row=>[row.id,row])).values()]}});
 const res={statusCode:200,status(n){this.statusCode=n;return this},json(body){this.body=body;return this}};
 await routes.filter(x=>x.path==='/').at(-1).handlers.at(-1)({authUser:{uid:'synthetic-A'}},res);return res;
}
test('pilot inbox contains only designated shop orders',async()=>{const r=await inbox();assert.equal(r.statusCode,200);assert.deepEqual(Array.from(r.body.orders,x=>x.id),['order-2'])});
test('missing designation denies inbox instead of exposing all owned shops',async()=>{const r=await inbox({MERCHANT_PILOT_DESIGNATIONS:'{}'});assert.equal(r.statusCode,403);assert.equal(r.body.orders,undefined)});
