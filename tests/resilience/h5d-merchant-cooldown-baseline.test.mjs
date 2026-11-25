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
const report=(id,data)=>console.log('H5D_MERCHANT_BASELINE '+JSON.stringify({id,...data}));
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
test('R12 actual Merchant route cooldown shared across accounts, expires without mutations',async t=>{
 t.mock.timers.enable({apis:['Date'],now:0});
 const {api,requests}=await service(()=>requests.length===1?json({success:false,error:'Rate limited'},429):orders());
 // supply Retry-After on the first actual transport response
 const fetch0=globalThis.fetch;globalThis.fetch=async(...args)=>{const r=await fetch0(...args);if(r.status===429)r.headers.set('Retry-After','90');return r;};
 await assert.rejects(api.getOrders(),e=>e.status===429);switchUser(B);t.mock.timers.setTime(30000);
 await assert.rejects(api.getOrders(),e=>e.status===429);assert.equal(requests.length,1);
 t.mock.timers.setTime(90000);await api.getOrders();assert.equal(requests.length,2);assert.ok(requests.every(x=>x.method==='GET'));
 report('R12_MERCHANT_SHARED',{secondAccountBlocked:true,requestsBeforeExpiry:1,recoveredAtMs:90000,mutations:0});
});
test('R12 stale Merchant response cannot impose cooldown after account switch',async()=>{
 const d=deferred(),{api,requests}=await service(()=>requests.length===1?d.promise:orders());
 const old=api.getOrders();const rejected=assert.rejects(old,/session changed/);await tick();switchUser(B);
 d.resolve(Response.json({success:false,error:'Unavailable'},{status:503,headers:{'Retry-After':'60'}}));await rejected;
 await api.getOrders();assert.equal(requests.length,2);report('R12_MERCHANT_LATE',{newAccountBlocked:false,requests:2});
});
