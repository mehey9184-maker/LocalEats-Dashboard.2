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
const report=(id,data)=>console.log('H5F_CORRECTED '+JSON.stringify({id,...data}));
const json=(data,status=200)=>Response.json(data,{status});
const orders=(rows=[row])=>json({success:true,orders:rows});
function setUser(uid,token=async()=>uid){globalThis.h5cUser={uid,getIdToken:token};}
async function service(transport){
 const requests=[],store=new Map();setUser(A);
 globalThis.sessionStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
 globalThis.fetch=async(url,init)=>{requests.push({path:new URL(url).pathname,method:init.method,signal:init.signal,auth:init.headers.Authorization,body:init.body?JSON.parse(init.body):null});return transport(url,init);};
 const result=await build({entryPoints:['src/services/MerchantApi.ts'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',define:{'import.meta.env':JSON.stringify({VITE_LOCALEATS_API_URL:'http://127.0.0.1:1',VITE_PICKUP_ORDERING_ENABLED:'true'})},plugins:[{name:'isolated-auth',setup(b){b.onLoad({filter:/[\\/]lib[\\/]firebase\.ts$/},()=>({contents:'export const auth={get currentUser(){return globalThis.h5cUser},beforeAuthStateChanged(fn){globalThis.h5cBefore=fn;return ()=>{}},onAuthStateChanged(fn){globalThis.h5cObserver=fn;return ()=>{}}};',loader:'js'}));}}]});
 const mod={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),mod,mod.exports);return {api:mod.exports.MerchantApi,requests,store};
}
function switchUser(uid){const next={uid,getIdToken:async()=>uid};globalThis.h5cBefore?.(next);globalThis.h5cUser=next;globalThis.h5cObserver?.(next);}

const key='pickup-command:'+A+':'+row.id;
const receipt=body=>json({success:true,replayed:true,order:{...row,status:'preparing',revision:1},command_receipt:{command_id:body.command_id,order_id:row.id,actor_uid:A,kind:'accepted',revision:1}});
const result=p=>p.then(()=>true,()=>false);
test('late mutation receipt across account change and return',async()=>{
 for(const roundTrip of [false,true]){
  const d=deferred(),{api,requests,store}=await service(()=>d.promise);
  const pending=result(api.transitionPickupOrder(row,'accept'));await tick();
  assert.equal(requests.length,1);assert.ok(store.has(key));switchUser(B);if(roundTrip)switchUser(A);
  d.resolve(receipt(requests[0].body));const accepted=await pending;
  assert.equal(accepted,false);assert.ok(store.has(key));
  report(roundTrip?'MUTATION_ABA_RESPONSE':'MUTATION_AB_RESPONSE',{accepted,pendingRetained:store.has(key),requests:requests.length});
 }
});
test('delayed token across account return cannot transmit old consent',async()=>{
 const d=deferred(),{api,requests,store}=await service((_u,init)=>receipt(JSON.parse(init.body)));
 setUser(A,()=>d.promise);const pending=result(api.transitionPickupOrder(row,'accept'));await tick();assert.equal(requests.length,0);
 switchUser(B);switchUser(A);d.resolve(A);const accepted=await pending;
 assert.equal(accepted,false);assert.equal(requests.length,0);assert.ok(store.has(key));
 report('MUTATION_ABA_TOKEN',{accepted,transmissions:requests.length,pendingRetained:store.has(key)});
});
test('existing timeout blocks late token without replay',async t=>{
 const d=deferred(),{api,requests,store}=await service((_u,init)=>receipt(JSON.parse(init.body)));
 setUser(A,()=>d.promise);t.mock.timers.enable({apis:['setTimeout']});
 const p=result(api.transitionPickupOrder(row,'accept'));await tick();t.mock.timers.tick(15000);assert.equal(await p,false);d.resolve(A);await tick();
 assert.equal(requests.length,0);assert.ok(store.has(key));report('MUTATION_TOKEN_TIMEOUT',{transmissions:0,pendingRetained:true});
});
test('storage replacement during delayed token acquisition',async()=>{
 const d=deferred(),{api,requests,store}=await service((_u,init)=>receipt(JSON.parse(init.body)));
 setUser(A,()=>d.promise);const p=result(api.transitionPickupOrder(row,'accept'));await tick();store.set(key,'replaced');d.resolve(A);
 const accepted=await p;assert.equal(accepted,false);assert.equal(requests.length,0);assert.equal(store.get(key),'replaced');
 report('MUTATION_STORAGE_CHANGED',{accepted,transmissions:requests.length,replacementRetained:true});
});

test('explicit retry after ABA receipt preserves command and only verified receipt clears',async()=>{
 const d=deferred(),{api,requests,store}=await service((_u,init)=>requests.length===1?d.promise:receipt(JSON.parse(init.body)));
 const first=result(api.transitionPickupOrder(row,'accept'));await tick();const original=store.get(key);
 switchUser(B);switchUser(A);d.resolve(receipt(requests[0].body));assert.equal(await first,false);
 assert.equal(store.get(key),original);assert.equal(requests.length,1);await tick();assert.equal(requests.length,1);
 assert.equal(await result(api.retryPendingPickupOrder(row)),true);assert.deepEqual(requests[0].body,requests[1].body);
 assert.equal(store.has(key),false);report('MUTATION_EXPLICIT_RETRY',{exactCommand:true,requests:2,automaticMutations:0});
});
test('payment and collection delayed token use same generation guard',async()=>{
 for(const action of ['confirm_payment','collect']){
  const d=deferred(),{api,requests,store}=await service(()=>{throw Error('unexpected transmission');});
  const snapshot={...row,status:'ready_for_pickup',revision:2,payment_status:action==='collect'?'paid':'unpaid'};
  setUser(A,()=>d.promise);const p=result(api.transitionPickupOrder(snapshot,action,action==='collect'?{handover_confirmed:true}:{payment_method:'cash'}));
  await tick();assert.ok(store.has(key));switchUser(B);switchUser(A);d.resolve(A);assert.equal(await p,false);
  assert.equal(requests.length,0);assert.ok(store.has(key));report('MUTATION_FINANCIAL_TOKEN',{action,transmissions:0,pendingRetained:true});
 }
});
