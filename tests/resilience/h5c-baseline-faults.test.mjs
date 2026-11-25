// Baseline observations only. Actual read coordinator and API with isolated Firebase/fetch.
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {createMerchantOrderReadCoordinator} from '../../src/services/merchantOrderRecovery.ts';
const A='merchant-a',B='merchant-b',scope=A+':shop-a';
const row={id:'fixture-order',shop_id:'shop-a',delivery_type:'collection',status:'pending',revision:0,payment_status:'unpaid',total_price:25,items:[{name:'Fixture',quantity:1,unit_price:25,line_total:25}]};
const owned={id:'shop-a',owner_id:A};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=()=>new Promise(r=>setImmediate(r));
const report=(id,data)=>console.log('H5C_BASELINE '+JSON.stringify({id,...data}));
const json=(data,status=200)=>Response.json(data,{status});
const orders=(rows=[row])=>json({success:true,orders:rows});
function setUser(uid,token=async()=>uid){globalThis.h5cUser={uid,getIdToken:token};}
async function service(transport){
 const requests=[];setUser(A);
 globalThis.fetch=async(url,init)=>{requests.push({path:new URL(url).pathname,method:init.method,signal:!!init.signal,auth:init.headers.Authorization});return transport(url,init);};
 const result=await build({entryPoints:['src/services/MerchantApi.ts'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',define:{'import.meta.env':JSON.stringify({VITE_LOCALEATS_API_URL:'http://127.0.0.1:1',VITE_PICKUP_ORDERING_ENABLED:'false'})},plugins:[{name:'isolated-auth',setup(b){b.onLoad({filter:/[\\/]lib[\\/]firebase\.ts$/},()=>({contents:'export const auth={get currentUser(){return globalThis.h5cUser}};',loader:'js'}));}}]});
 const mod={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),mod,mod.exports);return {api:mod.exports.MerchantApi,requests};
}
test('R05 hung read retains single-flight across 15s and 30s polling windows',async t=>{
 const d=deferred(),{api,requests}=await service(()=>d.promise),reader=createMerchantOrderReadCoordinator();reader.activate(scope);
 t.mock.timers.enable({apis:['setTimeout']});
 let settled=false;const p=reader.refresh(scope,()=>api.getOrders());p.then(()=>{settled=true;});
 await tick();assert.equal(requests.length,1);
 t.mock.timers.tick(15000);const second=reader.refresh(scope,()=>api.getOrders());await tick();
 t.mock.timers.tick(15000);const third=reader.refresh(scope,()=>api.getOrders());await tick();
 report('R05_HUNG',{elapsedVirtualMs:30000,settled,transmitted:requests.length,signal:requests[0].signal,coalesced:p===second&&second===third});
 d.resolve(orders());await Promise.all([p,second,third]);
});
test('R05 delayed token also holds read coordinator',async t=>{
 const d=deferred(),{api,requests}=await service(()=>orders()),reader=createMerchantOrderReadCoordinator();reader.activate(scope);setUser(A,()=>d.promise);
 t.mock.timers.enable({apis:['setTimeout']});let settled=false;const p=reader.refresh(scope,()=>api.getOrders());p.then(()=>{settled=true;});
 await tick();t.mock.timers.tick(30000);await tick();
 report('R05_TOKEN',{elapsedVirtualMs:30000,settled,transmittedBeforeToken:requests.length});
 d.resolve(A);await p;
});
test('R07 push-style wake during old snapshot coalesces without follow-up',async()=>{
 const d=deferred(),{api,requests}=await service(()=>requests.length===1?d.promise:orders([{...row,id:'new-order'}])),reader=createMerchantOrderReadCoordinator();reader.activate(scope);
 const first=reader.refresh(scope,()=>api.getOrders());await tick();
 const wake=reader.refresh(scope,()=>api.getOrders());d.resolve(orders([]));
 const result=await wake;await first;await tick();
 report('R07_WAKE',{coalesced:first===wake,transmitted:requests.length,wakeRows:result.rows?.length,followup:requests.length>1});
});
test('R08 existing App ownership deadline does not abort underlying transport',async t=>{
 const d=deferred(),{api,requests}=await service(()=>d.promise.then(()=>json({success:true,shop:owned})));
 const app=readFileSync(new URL('../../src/App.tsx',import.meta.url),'utf8');
 assert.match(app,/Promise\.race\(\[MerchantApi\.getMerchantShop\(\),new Promise<never>/);
 assert.match(app,/deadline=setTimeout\(\(\)=>reject\(Error\("Shop verification timed out\. Retry verification\."\)\),15000\)/);
 t.mock.timers.enable({apis:['setTimeout']});
 // Mirror the exact observed App deadline at the API boundary, not a mounted React test.
 let timer;const outer=Promise.race([api.getMerchantShop(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Shop verification timed out. Retry verification.')),15000);})]).finally(()=>clearTimeout(timer));
 const rejected=assert.rejects(outer,/timed out/);await tick();assert.equal(requests.length,1);t.mock.timers.tick(15000);await rejected;
 const retry=api.getMerchantShop();await tick();report('R08_DEADLINE',{elapsedVirtualMs:15000,transmitted:requests.length,firstSignal:requests[0].signal,overlap:requests.length===2});
 d.resolve();await retry;
});
test('R08/R07 raw API response after account change, same-scope and switched-scope behavior',async()=>{
 for(const roundTrip of [false,true]){
  const d=deferred(),{api,requests}=await service(()=>d.promise),reader=createMerchantOrderReadCoordinator();reader.activate(scope);
  const p=reader.refresh(scope,()=>api.getOrders());await tick();setUser(B);
  if(roundTrip)setUser(A);
  d.resolve(orders());const result=await p;report(roundTrip?'R07_ABA_UNACTIVATED':'R07_AB_UNACTIVATED',{kind:result.kind,rows:result.rows?.length,transmitted:requests.length,note:'scope activation deliberately delayed; not mounted UI proof'});
 }
 const d=deferred(),{api}=await service(()=>d.promise),reader=createMerchantOrderReadCoordinator();reader.activate(scope);
 const p=reader.refresh(scope,()=>api.getOrders());await tick();setUser(B);reader.activate(B+':shop-b');setUser(A);reader.activate(scope);d.resolve(orders());
 const result=await p;assert.equal(result.kind,'stale');report('R07_GENERATION_CONTROL',{kind:result.kind});
});
test('R08 shop response checks current owner but not original generation',async()=>{
 for(const roundTrip of [false,true]){
  const d=deferred(),{api,requests}=await service(()=>d.promise);const p=api.getMerchantShop().then(()=>true,()=>false);
  await tick();setUser(B);if(roundTrip)setUser(A);d.resolve(json({success:true,shop:owned}));const accepted=await p;
  report(roundTrip?'R08_SHOP_ABA':'R08_SHOP_AB',{accepted,transmitted:requests.length});
 }
});
test('R08 non-owner and transient failure fail closed, retry can recover',async()=>{
 let attempt=0;const {api,requests}=await service(()=>{attempt++;return attempt===1?json({success:true,shop:{...owned,owner_id:B}}):attempt===2?json({success:false,error:'Unavailable'},503):json({success:true,shop:owned});});
 await assert.rejects(api.getMerchantShop(),/Firebase identity/);await assert.rejects(api.getMerchantShop(),/Unavailable/);assert.equal((await api.getMerchantShop()).id,owned.id);assert.equal(requests.length,3);
 report('R08_CONTROLS',{foreignRejected:true,transientRejected:true,recovered:true,requests:3});
});
