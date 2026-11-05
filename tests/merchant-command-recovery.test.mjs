import test from 'node:test';
import assert from 'node:assert/strict';
import {createMerchantPickupRecovery} from '../src/services/merchantPickupRecovery.ts';
import {mapApiOrder} from '../src/services/merchantPickupPolicy.ts';
const id='11111111-1111-4111-8111-111111111111';
const order={id:'order',shop_id:'shop',delivery_type:'collection',status:'pending',payment_status:'unpaid',revision:0,total_price:25,items:[{name:'Meal',quantity:1,unit_price:25,line_total:25}]};
const command={path:'accept',body:{command_id:id,expected_revision:0}};
const reply=(extra={})=>({status:200,data:{success:true,replayed:false,order:{...order,status:'preparing',revision:1},command_receipt:{command_id:id,order_id:order.id,actor_uid:'merchant',kind:'accepted',revision:1},...extra}});
function setup(transport=async()=>reply()){
 const saved=new Map();let uid='merchant';
 const api=createMerchantPickupRecovery({identity:()=>uid,enabled:()=>true,storage:{getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)},transport,mapOrder:mapApiOrder,timeoutMs:20});
 return {api,saved,account:value=>uid=value};
}
test('confirmed command clears recovery only with matching authenticated receipt',async()=>{
 const f=setup();assert.equal((await f.api.send(order,command)).status,'preparing');assert.equal(f.saved.size,0);
 for(const extra of [{command_receipt:undefined},{command_receipt:{command_id:id,order_id:'other',actor_uid:'merchant',kind:'accepted',revision:1}},{order:{...order,revision:0}}]){
  const g=setup(async()=>reply(extra));await assert.rejects(g.api.send(order,command),/confirm/);assert.equal(g.saved.size,1);
 }
});
test('timeout aborts work, releases the lock and retries the original command after refresh',async()=>{
 let lose=true,signal;const requests=[];
 const f=setup(async(_order,body,abort)=>{requests.push(body);signal=abort;return lose ? new Promise(()=>{}) : reply();});
 await assert.rejects(f.api.send(order,command),/too long/);assert.equal(signal.aborted,true);assert.equal(f.saved.size,1);
 lose=false;await f.api.retry({...order,status:'preparing',revision:1});assert.deepEqual(requests[0],requests[1]);assert.equal(f.saved.size,0);
});
test('late replies cannot clear retained recovery or overwrite a later retry',async()=>{
 let resolve;const f=setup(()=>new Promise(done=>resolve=done));
 await assert.rejects(f.api.send(order,command),/too long/);resolve(reply());await new Promise(done=>setTimeout(done,5));assert.equal(f.saved.size,1);
});
test('replayed command receipt can confirm an order which has since advanced',async()=>{
 const f=setup(async()=>reply({replayed:true,order:{...order,status:'collected',payment_status:'paid',revision:4}}));
 assert.equal((await f.api.send(order,command)).pickup_status,'collected');
});
test('duplicates share a request, and account changes retain recovery without applying success',async()=>{
 let resolve,calls=0;const f=setup(()=>{calls++;return new Promise(done=>resolve=done);});
 const first=f.api.send(order,command),second=f.api.retry(order);f.account('other');resolve(reply());
 await assert.rejects(first,/session/);await assert.rejects(second,/session/);assert.equal(calls,1);assert.equal(f.saved.size,1);
});
test('malformed saved routes never reach transport; definitive refusal clears the command',async()=>{
 let calls=0;const f=setup(async()=>{calls++;return {status:409,data:{success:false,error:'Order changed'}};});
 await assert.rejects(f.api.send(order,command),/Order changed/);assert.equal(f.saved.size,0);
 f.saved.set('pickup-command:merchant:order',JSON.stringify({...command,path:'../../anything'}));await assert.rejects(f.api.retry(order),/saved/);assert.equal(calls,1);
});
test('unavailable retry storage stops before transport',async()=>{
 let calls=0;
 const api=createMerchantPickupRecovery({identity:()=> 'merchant',enabled:()=>true,mapOrder:mapApiOrder,storage:{getItem:()=>null,setItem:()=>{throw Error('quota');},removeItem:()=>{}},transport:async()=>{calls++;return reply();}});
 await assert.rejects(api.send(order,command),/storage/);assert.equal(calls,0);
});
