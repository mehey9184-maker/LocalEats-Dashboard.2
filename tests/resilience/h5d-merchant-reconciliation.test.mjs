// Baseline observations only. Actual read coordinator and API with isolated Firebase/fetch.
import test from 'node:test';
import assert from 'node:assert/strict';
import {build,transformSync} from 'esbuild';
import ts from 'typescript';
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

test('R06 actual Merchant polling and fetch callbacks recover missed order push and stale failure',async()=>{
 const src=readFileSync('src/App.tsx','utf8'),tree=ts.createSourceFile('App.tsx',src,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 let fetchDeclaration,pollEffect;
 function visit(n){
  if(ts.isVariableDeclaration(n)&&n.name.getText(tree)==='fetchOrders')fetchDeclaration=n.parent.parent.getText(tree);
  if(ts.isCallExpression(n)&&n.expression.getText(tree)==='useEffect'&&n.arguments[0]?.getText(tree).includes('setInterval(refreshVisibleOrders, 15000)'))pollEffect=n.arguments[0].getText(tree);
  ts.forEachChild(n,visit);
 }
 visit(tree);assert.ok(fetchDeclaration);assert.ok(pollEffect);
 const code=transformSync(fetchDeclaration+';export const effect='+pollEffect,{loader:'tsx',format:'cjs',target:'es2022'}).code;
 let available=false,fail=false,visible=[],status={state:'unverified',lastSuccessAt:null},interval,delay;
 const {api,requests}=await service(()=>fail?json({success:false,error:'Unavailable'},503):orders(available?[row,{...row,id:'foreign-order',shop_id:'foreign-shop'}]:[]));
 const coordinator=createMerchantOrderReadCoordinator();coordinator.activate(scope);
 const listeners=new Map(),target={addEventListener:(key,fn)=>listeners.set(key,fn),removeEventListener:key=>listeners.delete(key)};
 const document={...target,visibilityState:'visible'},navigator={onLine:true};
 const dependencies={useCallback:fn=>fn,orderReadScope:scope,orderReadShopId:'shop-a',user:{id:A},
  captureMerchantReadSession:()=>({uid:A,current:()=>globalThis.h5cUser?.uid===A}),
  orderReadCoordinator:{current:coordinator},MerchantApi:api,document,navigator,window:target,
  setOrders:rows=>visible=rows,processAndSetOrders:(_,rows)=>visible=rows,
  setOrderReadStatus:v=>status=typeof v==='function'?v(status):v,
  setInterval:(fn,ms)=>{interval=fn;delay=ms;return 1},clearInterval:()=>{interval=null;},console:{warn(){}},Date};
 const mod={exports:{}};new Function('module','exports',...Object.keys(dependencies),code)(mod,mod.exports,...Object.values(dependencies));
 const cleanup=mod.exports.effect();try{
 await tick();assert.equal(delay,15000);assert.equal(visible.length,0);assert.equal(status.state,'fresh');
 available=true;interval();await tick();assert.equal(visible.length,1);assert.equal(visible[0].id,row.id);
 const before=requests.length;navigator.onLine=false;interval();await tick();assert.equal(requests.length,before);
 navigator.onLine=true;fail=true;listeners.get('online')();await tick();assert.equal(status.state,'failed');assert.equal(visible[0].id,row.id);
 fail=false;listeners.get('focus')();await tick();assert.equal(status.state,'fresh');assert.equal(visible.length,1);assert.ok(requests.every(r=>r.method==='GET'));
 console.log('H5D_RECONCILE '+JSON.stringify({app:'Merchant',pollMs:15000,missedPushRecovered:true,foreignRowsExcluded:true,offlineSuppressed:true,staleErrorPreserved:true,mutations:0}));
 }finally{cleanup();}
});
