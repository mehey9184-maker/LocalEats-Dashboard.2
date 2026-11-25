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
const report=(id,data)=>console.log('H5C_CORRECTED '+JSON.stringify({id,...data}));
const json=(data,status=200)=>Response.json(data,{status});
const orders=(rows=[row])=>json({success:true,orders:rows});
function setUser(uid,token=async()=>uid){globalThis.h5cUser={uid,getIdToken:token};}
async function service(transport){
 const requests=[];setUser(A);
 globalThis.fetch=async(url,init)=>{requests.push({path:new URL(url).pathname,method:init.method,signal:init.signal,auth:init.headers.Authorization});return transport(url,init);};
 const result=await build({entryPoints:['src/services/MerchantApi.ts'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',define:{'import.meta.env':JSON.stringify({VITE_LOCALEATS_API_URL:'http://127.0.0.1:1',VITE_PICKUP_ORDERING_ENABLED:'false'})},plugins:[{name:'isolated-auth',setup(b){b.onLoad({filter:/[\\/]lib[\\/]firebase\.ts$/},()=>({contents:'export const auth={get currentUser(){return globalThis.h5cUser},beforeAuthStateChanged(fn){globalThis.h5cBefore=fn;return ()=>{}},onAuthStateChanged(fn){globalThis.h5cObserver=fn;return ()=>{}}};',loader:'js'}));}}]});
 const mod={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),mod,mod.exports);return {api:mod.exports.MerchantApi,requests};
}
function switchUser(uid){const next={uid,getIdToken:async()=>uid};globalThis.h5cBefore?.(next);globalThis.h5cUser=next;globalThis.h5cObserver?.(next);}
test('R05 hung transport releases coalesced read and permits next read at deadline',async t=>{
 const d=deferred(),{api,requests}=await service(()=>requests.length===1?d.promise:orders()),reader=createMerchantOrderReadCoordinator();reader.activate(scope);
 t.mock.timers.enable({apis:['setTimeout']});const p=reader.refresh(scope,signal=>api.getOrders(signal));await tick();
 assert.equal(requests.length,1);assert.strictEqual(reader.refresh(scope,signal=>api.getOrders(signal)),p);
 t.mock.timers.tick(15000);assert.equal((await p).kind,'failed');assert.ok(requests[0].signal.aborted);
 const next=await reader.refresh(scope,signal=>api.getOrders(signal));assert.equal(next.kind,'fresh');assert.equal(requests.length,2);
 d.resolve(orders([]));await tick();report('R05_DEADLINE',{deadlineMs:15000,aborted:true,recovered:true,requests:2});
});
test('R05 delayed token cannot transmit after timeout',async t=>{
 const d=deferred(),{api,requests}=await service(()=>orders());setUser(A,()=>d.promise);t.mock.timers.enable({apis:['setTimeout']});
 const p=api.getOrders();const rejected=assert.rejects(p,/timed out/);await tick();t.mock.timers.tick(15000);await rejected;d.resolve(A);await tick();
 assert.equal(requests.length,0);report('R05_TOKEN',{transmitted:0});
});
test('R07 burst of wake events reserves exactly one trailing read; ordinary callers coalesce',async()=>{
 const d=deferred(),tail=deferred(),{api,requests}=await service(()=>requests.length===1?d.promise:tail.promise),reader=createMerchantOrderReadCoordinator();reader.activate(scope);
 const read=signal=>api.getOrders(signal);const first=reader.refresh(scope,read);await tick();
 const wakes=Array.from({length:50},()=>reader.refresh(scope,read,{wake:true,canFollowup:()=>true}));assert.ok(wakes.every(p=>p===wakes[0]));assert.strictEqual(reader.refresh(scope,read),first);
 d.resolve(orders([]));assert.equal((await first).rows.length,0);await tick();assert.equal(requests.length,2);
 const during=Array.from({length:50},()=>reader.refresh(scope,read,{wake:true,canFollowup:()=>true}));tail.resolve(orders());for(const p of [...wakes,...during])assert.equal((await p).rows[0].id,row.id);
 await tick();assert.equal(requests.length,2);assert.ok(requests.every(r=>r.method==='GET'));report('R07_WAKE',{wakeEvents:100,requests:2,followup:true,mutations:0});
});
test('R07 offline or hidden follow-up policy prevents extra transmission',async()=>{
 const d=deferred(),{api,requests}=await service(()=>d.promise),reader=createMerchantOrderReadCoordinator();reader.activate(scope);
 const first=reader.refresh(scope,s=>api.getOrders(s));await tick();const wake=reader.refresh(scope,s=>api.getOrders(s),{wake:true,canFollowup:()=>false});
 d.resolve(orders());assert.equal((await first).kind,'fresh');assert.equal((await wake).kind,'stale');assert.equal(requests.length,1);report('R07_HIDDEN',{requests:1});
});
test('R07 scope invalidation aborts old transport and queued wake, A-B-A cannot revive',async()=>{
 const d=deferred(),{api,requests}=await service(()=>d.promise),reader=createMerchantOrderReadCoordinator();reader.activate(scope);
 const first=reader.refresh(scope,s=>api.getOrders(s));await tick();const wake=reader.refresh(scope,s=>api.getOrders(s),{wake:true});
 reader.activate(B+':shop-b');reader.activate(scope);assert.equal((await first).kind,'stale');assert.equal((await wake).kind,'stale');assert.ok(requests[0].signal.aborted);d.resolve(orders());await tick();assert.equal(requests.length,1);
 report('R07_SCOPE',{aborted:true,queuedDiscarded:true,requests:1});
});
test('R07 account generation rejects raw order response even before scope activation',async()=>{
 for(const roundTrip of [false,true]){
  const d=deferred(),{api,requests}=await service(()=>d.promise);const p=api.getOrders();const rejected=assert.rejects(p,/session changed/);
  await tick();switchUser(B);if(roundTrip)switchUser(A);d.resolve(orders());await rejected;assert.equal(requests.length,1);
  report(roundTrip?'R07_ABA':'R07_AB',{accepted:false});
 }
});
test('R08 shop read deadline aborts and later valid ownership retry succeeds',async t=>{
 const d=deferred(),{api,requests}=await service(()=>requests.length===1?d.promise:json({success:true,shop:owned}));t.mock.timers.enable({apis:['setTimeout']});
 const p=api.getMerchantShop();const rejected=assert.rejects(p,/timed out/);await tick();t.mock.timers.tick(15000);await rejected;assert.ok(requests[0].signal.aborted);
 assert.equal((await api.getMerchantShop()).id,owned.id);d.resolve(json({success:true,shop:owned}));await tick();assert.equal(requests.length,2);report('R08_DEADLINE',{aborted:true,recovered:true,requests:2});
});
test('R08 old ownership response after A-B or A-B-A rejected',async()=>{
 for(const roundTrip of [false,true]){
  const d=deferred(),{api}=await service(()=>d.promise);const p=api.getMerchantShop();const rejected=assert.rejects(p,/session changed/);
  await tick();switchUser(B);if(roundTrip)switchUser(A);d.resolve(json({success:true,shop:owned}));await rejected;
  report(roundTrip?'R08_SHOP_ABA':'R08_SHOP_AB',{accepted:false});
 }
});
test('R08 account switch during token acquisition blocks GET; superseded read aborts',async()=>{
 const d=deferred(),{api,requests}=await service(()=>json({success:true,shop:owned}));setUser(A,()=>d.promise);
 const p=api.getMerchantShop();const rejected=assert.rejects(p,/session changed/);await tick();switchUser(B);d.resolve(A);await rejected;assert.equal(requests.length,0);
 switchUser(A);const c=new AbortController();c.abort(Error('superseded'));await assert.rejects(api.getMerchantShop(c.signal),/superseded/);assert.equal(requests.length,0);report('R08_TOKEN',{transmitted:0});
});
test('R08 foreign owner, provider outage fail closed and recovery succeeds',async()=>{
 let attempt=0;const {api,requests}=await service(()=>{attempt++;return attempt===1?json({success:true,shop:{...owned,owner_id:B}}):attempt===2?json({success:false,error:'Unavailable'},503):json({success:true,shop:owned});});
 await assert.rejects(api.getMerchantShop(),/Firebase identity/);await assert.rejects(api.getMerchantShop(),/Unavailable/);assert.equal((await api.getMerchantShop()).id,owned.id);assert.equal(requests.length,3);report('R08_CONTROLS',{foreignRejected:true,transientRejected:true,recovered:true});
});
