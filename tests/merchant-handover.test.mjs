import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const order={id:'fixture-order',shop_id:'fixture-shop',delivery_type:'collection',
 pickup_status:'ready_for_pickup',payment_status:'paid',revision:3,total_price:42,service_fee:0,
 items:[{name:'Fixture meal',quantity:1,unit_price:42,line_total:42}]};

async function loadActions(enabled='true'){
 const result=await build({
  stdin:{contents:'export {PickupOrderActions} from "./src/components/PickupOrderActions"; export {MerchantApi} from "./src/services/MerchantApi";',resolveDir:process.cwd()},
  bundle:true,write:false,platform:'node',format:'cjs',packages:'external',
  define:{'import.meta.env':JSON.stringify({VITE_PICKUP_ORDERING_ENABLED:enabled,VITE_LOCALEATS_API_URL:'https://fixture.invalid'})},
  plugins:[{name:'fixture-auth',setup(builder){
   builder.onLoad({filter:/[\\/]lib[\\/]firebase\.ts$/},()=>({contents:'export const auth={currentUser:{uid:"fixture-merchant",getIdToken:async()=>"fixture-token"}};',loader:'js'}));
  }}],
 });
 const mod={exports:{}};
 new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),mod,mod.exports);
 return mod.exports;
}
const render=(Component,data=order,compact=true,recoveryOnly=false)=>renderToStaticMarkup(React.createElement(Component,{order:data,compact,recoveryOnly}));

test('only a paid Ready pickup shows the handover step on both ticket densities',async()=>{
 const {PickupOrderActions}=await loadActions();
 for(const compact of [true,false]){
  const ready=render(PickupOrderActions,order,compact);
  assert.match(ready,/Paid · Awaiting handover/);
  assert.match(ready,/<button type="button" aria-label="Confirm handover"/);
  assert.doesNotMatch(ready,/Confirm cash received|Confirm card-machine payment/);
 }
 const unpaid=render(PickupOrderActions,{...order,payment_status:'unpaid'});
 assert.match(unpaid,/Confirm cash received/);
 assert.doesNotMatch(unpaid,/Confirm handover|Awaiting handover/);
 const collected=render(PickupOrderActions,{...order,pickup_status:'collected',revision:4},false);
 assert.match(collected,/Pickup · Collected/);
 assert.doesNotMatch(collected,/Confirm handover|Awaiting handover/);
});

test('handover stays disabled without the existing pickup write gate',async()=>{
 const {PickupOrderActions}=await loadActions('false');
 assert.match(render(PickupOrderActions),/<button type="button" disabled="" aria-label="Confirm handover"/);
});

test('after a lost handover response, the retry replays the exact saved command and requires its receipt',async(t)=>{
 const {PickupOrderActions,MerchantApi}=await loadActions();
 const saved=new Map();
 t.mock.method(globalThis,'fetch',async(url,init)=>{
  requests.push({url,body:JSON.parse(init.body)});
  if(requests.length===1)throw Error('fixture dropped response');
  return new Response(JSON.stringify({success:true,replayed:true,order:collected,
   ...(requests.length>2?{command_receipt:{command_id:requests[0].body.command_id,order_id:order.id,actor_uid:'fixture-merchant',kind:'collected',revision:4}}:{})
  }),{headers:{'content-type':'application/json'}});
 });
 const storage=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage');
 Object.defineProperty(globalThis,'sessionStorage',{value:{getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)},configurable:true});
 t.after(()=>{if(storage)Object.defineProperty(globalThis,'sessionStorage',storage);else delete globalThis.sessionStorage;});
 const collected={...order,pickup_status:'collected',revision:4};
 const requests=[];
 await assert.rejects(MerchantApi.transitionPickupOrder(order,'collect',{handover_confirmed:true}),/dropped response/);
 assert.match(render(PickupOrderActions),/Handover could not be confirmed/);
 assert.match(render(PickupOrderActions),/Retry handover confirmation/);
 assert.match(render(PickupOrderActions,collected),/Retry handover confirmation/);
 assert.match(render(PickupOrderActions,collected,true,true),/Retry handover confirmation/);
 assert.doesNotMatch(render(PickupOrderActions),/aria-label="Confirm handover"/);
 await assert.rejects(MerchantApi.retryPendingPickupOrder(collected),/did not confirm this action/);
 assert.match(render(PickupOrderActions,collected),/Retry handover confirmation/);
 assert.equal((await MerchantApi.retryPendingPickupOrder(collected)).pickup_status,'collected');
 assert.match(requests[0].url,/\/merchant\/orders\/fixture-order\/collect$/);
 assert.equal(requests[0].body.handover_confirmed,true);
 assert.equal(requests[0].body.expected_revision,3);
 assert.deepEqual(requests[0],requests[1]);
 assert.deepEqual(requests[1],requests[2]);
 assert.equal(saved.size,0);
 assert.doesNotMatch(render(PickupOrderActions,collected),/Retry handover confirmation/);
 assert.equal(render(PickupOrderActions,collected,true,true),'');
});

test('unpaid Ready follow-up stays visible in compact and expanded tickets without changing business state',async(t)=>{
 const {PickupOrderActions,MerchantApi}=await loadActions('false');
 t.mock.method(MerchantApi,'transitionPickupOrder',()=>{throw Error('follow-up must never write');});
 const unpaid={...order,payment_status:'unpaid',updated_at:new Date(Date.now()-45*60_000).toISOString(),phone:'+27 (82) 123-4567'};
 for(const compact of [true,false]){
  const markup=render(PickupOrderActions,unpaid,compact);
  assert.match(markup,/Ready · unpaid · 30\+ min since last status update/);
  assert.match(markup,/<details[^>]*><summary[^>]*>Follow up on unpaid pickup<\/summary>/);
  assert.doesNotMatch(markup,/<details[^>]*\sopen(?:=|>)/);
  assert.ok(markup.indexOf('Refresh the order and check the counter')<markup.indexOf('href="tel:+27821234567"'));
  assert.match(markup,/Call customer/);
  assert.match(markup,/Waiting for the customer keeps this order Ready and unpaid/);
  assert.match(markup,/timer measures time since the last status update/);
  assert.doesNotMatch(markup,/Paid · Awaiting handover|aria-label="Confirm handover"/);
 }
 assert.equal(MerchantApi.transitionPickupOrder.mock.calls.length,0);
 assert.equal(unpaid.payment_status,'unpaid');
 assert.equal(unpaid.pickup_status,'ready_for_pickup');
});

test('follow-up cannot offer calls for sample or invalid-phone orders and never invents an aging time',async()=>{
 const {PickupOrderActions}=await loadActions();
 const unpaid={...order,payment_status:'unpaid',updated_at:new Date(Date.now()-45*60_000).toISOString()};
 for(const phone of [undefined,'','++27821234567','customer@example.com','123','tel:+27821234567','+27 82 ext 3']){
  const markup=render(PickupOrderActions,{...unpaid,phone});
  assert.doesNotMatch(markup,/href="tel:/);
  assert.match(markup,/No valid customer phone is available/);
 }
 assert.doesNotMatch(render(PickupOrderActions,{...unpaid,id:'FAKE-L1C3-1',phone:'+27821234567'}),/href="tel:|Follow up on unpaid pickup/);
 for(const updated_at of [undefined,'invalid',new Date(Date.now()+60*60_000).toISOString(),new Date(Date.now()-5*60_000).toISOString()]){
  assert.doesNotMatch(render(PickupOrderActions,{...unpaid,updated_at}),/Follow up on unpaid pickup|30\+ min/);
 }
 for(const extra of [{payment_status:'paid'},{pickup_status:'collected'},{pickup_status:'preparing'}]){
  assert.doesNotMatch(render(PickupOrderActions,{...unpaid,...extra}),/Follow up on unpaid pickup|30\+ min/);
 }
});
