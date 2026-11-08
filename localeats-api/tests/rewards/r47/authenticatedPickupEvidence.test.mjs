import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createR47TestOnlyAuthAdapter} from './authenticatedPickupEvidence.mjs';

const id='550e8400-e29b-41d4-a716-000000000771';
const pay='550e8400-e29b-41d4-a716-000000000772';
const collect='550e8400-e29b-41d4-a716-000000000773';
const merchantHeader='Bearer fb-merchant-token-mock';
const customerHeader='Bearer fb-customer-token-mock';
const args={merchantAuthorization:merchantHeader,customerAuthorization:customerHeader,orderId:id};
const sample=()=>({
 origin:'synthetic-r47-private-snapshot',
 order:{
  id,user_id:'customer-1',shop_id:'my-kota',delivery_type:'collection',
  status:'collected',payment_status:'paid',test_record:false,
  simulated_checkout:false,create_intent_hash:'b'.repeat(64),
  revision:2,created_at:'2026-11-07T10:00:00Z',
  items:[{menu_item_id:'kota',quantity:4,unit_price:25,
   line_total:100,name:'Kota',notes:''}]
 },
 shop:{id:'my-kota',owner_id:'merchant-1',approval_status:'approved',archived_at:null},
 programmeShop:{shop_id:'my-kota',approval_status:'approved',
  participating_at_purchase:true,programme_version:'bronze-only-v1',
  rewards_started_at:'2026-11-01T00:00:00Z',
  shop_approved_at:'2026-10-01T00:00:00Z'},
 registeredCustomer:{uid:'customer-1',registered:true,anonymous:false,test_account:false},
 pickupEvents:[
  {order_id:id,command_id:pay,actor_uid:'merchant-1',kind:'payment_confirmed',
   revision:1,occurred_at:'2026-11-07T10:02:00Z'},
  {order_id:id,command_id:collect,actor_uid:'merchant-1',kind:'collected',
   revision:2,occurred_at:'2026-11-07T10:10:00Z'}
 ],
 customerHandoverProof:{
  order_id:id,customer_uid:'customer-1',shop_id:'my-kota',
  collected_command_id:collect,source:'synthetic-server-consumed-authenticated-customer-code',
  authenticated_consumer_uid:'customer-1',used_once:true,revoked:false,
  consumption_receipt:'synthetic-consumption-receipt-001',
  issued_at:'2026-11-07T10:01:00Z',
  expires_at:'2026-11-07T10:12:00Z',
  consumed_at:'2026-11-07T10:05:00Z'
 },
 eligibilitySnapshots:[{
  line_index:0,order_id:id,shop_id:'my-kota',menu_item_id:'kota',
  programme_version:'bronze-only-v1',proof_source:'server-persisted-at-purchase',
  immutable:true,reward_funded:false,qualifying_kota:true,
  snapshot_at:'2026-11-07T09:59:59Z'
 }],
 verifiedRefunds:[]
});
const clone=x=>structuredClone(x);
const harness=(modify=x=>x,options={})=>{
 const evidence=sample();
 const calls=[],stats={snapshots:0,reads:0,writes:0};
 const store={
  async readOnlySnapshot(fn){
   stats.snapshots++;
   return fn(Object.freeze({
    async readBundle(orderId){assert.equal(orderId,id);stats.reads++;const trial=clone(evidence);const changed=modify(trial);return clone(changed===undefined?trial:changed)},
    async insert(){stats.writes++;throw Error('R47_NEVER_WRITE')},
    async rpc(){stats.writes++;throw Error('R47_NEVER_RPC')}
   }));
  }
 };
 const verifyIdToken=async(token,checkRevoked)=>{
  calls.push({token,checkRevoked});
  if(checkRevoked!==true)throw Error('R47_MISSING_REVOCATION_MODE');
  if(options.outage)throw Error('test verifier is unavailable');
  if((options.revoked??[]).includes(token))throw Error('mock revoked');
  if(token==='merchant-token-mock')
    return {uid:options.merchantUid??'merchant-1',
      firebase:{sign_in_provider:options.merchantProvider??'password'}};
  if(token==='customer-token-mock')
    return {uid:options.customerUid??'customer-1',
      firebase:{sign_in_provider:options.customerProvider??'password'}};
  throw Error('fake token rejected');
 };
 return {adapter:createR47TestOnlyAuthAdapter({verifyIdToken,store}),calls,stats,
         original:evidence};
};
const reject=async(change,match,options={})=>{
 const h=harness(change,options);
 await assert.rejects(()=>h.adapter.inspectSimulatedEvents(args),match);
 assert.equal(h.stats.writes,0);
 return h;
};
test('R4.7 merchant and customer independently pass the real Rewards strict token gate, review ONLY',async()=>{
 const h=harness();
 const result=await h.adapter.inspectSimulatedEvents(args);
 assert.deepEqual(result,{
  mode:'r47-double-identity-synthetic-review-only',
  orderId:id,merchantUid:'merchant-1',customerUid:'customer-1',
  shopId:'my-kota',qualifyingBoughtKotas:4,
  canGrant:false,canReserve:false,canReimburse:false,
  canActivate:false,canReadProduction:false
 });
 assert.deepEqual(h.calls.map(c=>c.token).sort(),['customer-token-mock','merchant-token-mock']);
 assert.deepEqual(h.calls.map(c=>c.checkRevoked),[true,true]);
 assert.deepEqual(h.stats,{snapshots:1,reads:1,writes:0});
 assert.deepEqual(h.original,sample());
 assert.ok(Object.isFrozen(result));
});
test('R4.7 eight overlapping inspections never mint rewards or create merchant payable',async()=>{
 const h=harness();
 const vals=await Promise.all(Array.from({length:8},()=>h.adapter.inspectSimulatedEvents(args)));
 assert.deepEqual(vals.map(v=>v.qualifyingBoughtKotas),Array(8).fill(4));
 assert.equal(h.stats.writes,0);
 assert.equal(h.stats.reads,8);
 assert.equal(h.calls.length,16);
 assert.ok(h.calls.every(c=>c.checkRevoked===true));
});
test('R4.7 known gap: current pickup middleware omits Firebase revocation=true',()=>{
 const source=readFileSync(new URL('../../../src/middleware/authenticateFirebase.ts',import.meta.url),'utf8');
 // This deliberate detection is a RELEASE BLOCKER, not a simulated pass
 // for the live middleware. The strict financeActor gate is NOT mounted.
 assert.match(source,/authAdmin\.verifyIdToken\(token\s*\)/);
 assert.doesNotMatch(source,/authAdmin\.verifyIdToken\(token\s*,\s*true\s*\)/);
});
test('R4.7 auth rejects missing, malformed, unknown, revoked or unavailable Firebase token BEFORE DB read',async()=>{
 for(const change of [
  {merchantAuthorization:undefined},
  {customerAuthorization:undefined},
  {merchantAuthorization:'Bearer invalid'},
  {customerAuthorization:'Bearer fb-unknown-but-long-token'},
  {merchantAuthorization:'Bearer fb-a'},
 ]) {
  const h=harness();
  await assert.rejects(()=>h.adapter.inspectSimulatedEvents({...args,...change}),
    /REWARDS_FINANCIAL_AUTH_REQUIRED/);
  assert.equal(h.stats.reads,0);
 }
 for(const options of [{outage:true},{revoked:['merchant-token-mock']},
   {revoked:['customer-token-mock']}]) {
  const h=harness(x=>x,options);
  await assert.rejects(()=>h.adapter.inspectSimulatedEvents(args),
    /REWARDS_FINANCIAL_AUTH_REQUIRED/);
  assert.equal(h.stats.reads,0);
 }
});
test('R4.7 client financial claims cannot be accepted alongside an order ID',async()=>{
 const h=harness();
 await assert.rejects(()=>h.adapter.inspectSimulatedEvents({...args,
  paid:true,shopId:'my-kota',rewardMinor:2500}),/R47_CLIENT_FINANCIAL_CLAIMS_FORBIDDEN/);
 await assert.rejects(()=>h.adapter.inspectSimulatedEvents({...args,orderId:{id,paid:true}}),
  /R47_INVALID_ORDER_ID/);
 assert.equal(h.stats.reads,0);
});
test('R4.7 simulated anonymous or identical merchant/customer identity cannot qualify',async()=>{
 for(const options of [{merchantProvider:'anonymous'},{customerProvider:'anonymous'},
   {customerUid:'merchant-1'}]) {
  const h=harness(x=>x,options);
  await assert.rejects(()=>h.adapter.inspectSimulatedEvents(args),
    /REWARDS_FINANCIAL_AUTH_REQUIRED|R47_SEPARATE_MERCHANT_CUSTOMER_REQUIRED/);
  assert.equal(h.stats.reads,0);
 }
});
test('R4.7 wrong merchant owner is forbidden even with a mock successfully verified token',async()=>{
 const h=harness(x=>x,{merchantUid:'merchant-other'});
 await assert.rejects(()=>h.adapter.inspectSimulatedEvents(args),
  /R47_APPROVED_SHOP_SCOPE_OR_PROGRAMME_MISSING/);
});
const invalid=[
 ['order belongs to another customer',x=>{x.order.user_id='customer-other'},'ORDER_CUSTOMER_IDENTITY_OR_PAYMENT_INVALID'],
 ['different order in private snapshot',x=>{x.order.id='550e8400-e29b-41d4-a716-000000000779'},'ORDER_CUSTOMER_IDENTITY_OR_PAYMENT_INVALID'],
 ['order not collected',x=>{x.order.status='ready_for_pickup'},'ORDER_CUSTOMER_IDENTITY_OR_PAYMENT_INVALID'],
 ['order unpaid',x=>{x.order.payment_status='unpaid'},'ORDER_CUSTOMER_IDENTITY_OR_PAYMENT_INVALID'],
 ['simulated checkout',x=>{x.order.simulated_checkout=true},'ORDER_CUSTOMER_IDENTITY_OR_PAYMENT_INVALID'],
 ['test order provenance missing',x=>{delete x.order.test_record},'ORDER_CUSTOMER_IDENTITY_OR_PAYMENT_INVALID'],
 ['delivery incorrectly claiming pickup',x=>{x.order.delivery_type='delivery'},'ORDER_CUSTOMER_IDENTITY_OR_PAYMENT_INVALID'],
 ['intent hash stripped from public order',x=>{delete x.order.create_intent_hash},'ORDER_CUSTOMER_IDENTITY_OR_PAYMENT_INVALID'],
 ['shop ownership transferred',x=>{x.shop.owner_id='other-merchant'},'APPROVED_SHOP_SCOPE_OR_PROGRAMME_MISSING'],
 ['shop archived',x=>{x.shop.archived_at='2026-11-01T00:00:00Z'},'APPROVED_SHOP_SCOPE_OR_PROGRAMME_MISSING'],
 ['shop approval revoked',x=>{x.shop.approval_status='suspended'},'APPROVED_SHOP_SCOPE_OR_PROGRAMME_MISSING'],
 ['shop programme opt-in missing',x=>{x.programmeShop.participating_at_purchase=false},'APPROVED_SHOP_SCOPE_OR_PROGRAMME_MISSING'],
 ['shop only opted in after purchase',x=>{x.programmeShop.rewards_started_at='2026-11-08T00:00:00Z'},'APPROVED_SHOP_SCOPE_OR_PROGRAMME_MISSING'],
 ['customer registration missing',x=>{x.registeredCustomer.registered=false},'REGISTERED_CUSTOMER_REQUIRED'],
 ['customer marked test account',x=>{x.registeredCustomer.test_account=true},'REGISTERED_CUSTOMER_REQUIRED'],
 ['missing payment command',x=>{x.pickupEvents=x.pickupEvents.filter(e=>e.kind!=='payment_confirmed')},'PRIVATE_COMMAND_HISTORY_MISSING'],
 ['missing collected command',x=>{x.pickupEvents=x.pickupEvents.filter(e=>e.kind!=='collected')},'PRIVATE_COMMAND_HISTORY_MISSING'],
 ['merchant command actor spoofed',x=>{x.pickupEvents[0].actor_uid='merchant-other'},'MERCHANT_COMMAND_ACTOR_OR_REVISION_MISMATCH'],
 ['collection signed by other merchant',x=>{x.pickupEvents[1].actor_uid='merchant-other'},'MERCHANT_COMMAND_ACTOR_OR_REVISION_MISMATCH'],
 ['duplicate command identifier',x=>{x.pickupEvents[1].command_id=pay},'MERCHANT_COMMAND_ACTOR_OR_REVISION_MISMATCH'],
 ['wrong collected revision',x=>{x.pickupEvents[1].revision=1},'MERCHANT_COMMAND_ACTOR_OR_REVISION_MISMATCH'],
 ['missing private command UUID',x=>{delete x.pickupEvents[0].command_id},'PICKUP_COMMAND_UNCONFIRMED'],
 ['collection timestamp before payment',x=>{x.pickupEvents[1].occurred_at='2026-11-07T10:01:00Z'},'MERCHANT_COMMAND_ACTOR_OR_REVISION_MISMATCH'],
 ['no independent customer handover',x=>{delete x.customerHandoverProof},'CUSTOMER_CONSUMPTION_PROOF_MISSING'],
 ['customer handover only a merchant boolean',x=>{x.customerHandoverProof.source='handover_confirmed:true'},'INDEPENDENT_CUSTOMER_AUTH_AND_HANDOVER_REQUIRED'],
 ['wrong customer handover UID',x=>{x.customerHandoverProof.authenticated_consumer_uid='customer-other'},'INDEPENDENT_CUSTOMER_AUTH_AND_HANDOVER_REQUIRED'],
 ['handover linked to payment rather than collection event',x=>{x.customerHandoverProof.collected_command_id=pay},'INDEPENDENT_CUSTOMER_AUTH_AND_HANDOVER_REQUIRED'],
 ['duplicate handover not single-use',x=>{x.customerHandoverProof.used_once=false},'INDEPENDENT_CUSTOMER_AUTH_AND_HANDOVER_REQUIRED'],
 ['expired handover',x=>{x.customerHandoverProof.expires_at='2026-11-07T10:04:00Z'},'INDEPENDENT_CUSTOMER_AUTH_AND_HANDOVER_REQUIRED'],
 ['revoked pickup challenge',x=>{x.customerHandoverProof.revoked=true},'INDEPENDENT_CUSTOMER_AUTH_AND_HANDOVER_REQUIRED'],
 ['plaintext PIN in private proof object',x=>{x.customerHandoverProof.pin='1234'},'INDEPENDENT_CUSTOMER_AUTH_AND_HANDOVER_REQUIRED'],
 ['missing checked refund history',x=>{delete x.verifiedRefunds},'FULL_REFUND_HISTORY_REQUIRED'],
 ['pending refund recorded',x=>{x.verifiedRefunds=[{status:'pending'}]},'REWARDS_REFUNDED_ORDER_REQUIRES_REVIEW'],
 ['missing eligibility snapshot',x=>{delete x.eligibilitySnapshots},'IMMUTABLE_CHECKOUT_ELIGIBILITY_REQUIRED'],
 ['false reward-funded line',x=>{x.eligibilitySnapshots[0].reward_funded=true},'IMMUTABLE_QUALIFYING_PURCHASE_PROOF_MISSING'],
 ['missing reward-funded negative proof',x=>{delete x.eligibilitySnapshots[0].reward_funded},'IMMUTABLE_QUALIFYING_PURCHASE_PROOF_MISSING'],
 ['mutable current menu instead of checkout snapshot',x=>{x.eligibilitySnapshots[0].proof_source='current-menu'},'IMMUTABLE_QUALIFYING_PURCHASE_PROOF_MISSING'],
 ['line is in another shop',x=>{x.eligibilitySnapshots[0].shop_id='shop-b'},'IMMUTABLE_QUALIFYING_PURCHASE_PROOF_MISSING'],
 ['missing immutable qualifying flag',x=>{delete x.eligibilitySnapshots[0].qualifying_kota},'IMMUTABLE_QUALIFYING_PURCHASE_PROOF_MISSING'],
 ['no eligible purchased kota',x=>{x.eligibilitySnapshots[0].qualifying_kota=false},'REWARDS_NO_QUALIFYING_KOTA'],
 ['bundle provenance is a browser claim',x=>{x.origin='request-body'},'NO_SERVER_OWNED_EVIDENCE'],
];
for(const [name,modify,expected] of invalid){
 test('R4.7 fails closed — '+name,async()=>{
  const h=await reject(modify,new RegExp(expected));
  assert.equal(h.stats.snapshots,1);
 });
}
test('R4.7 reader outage or missing private transaction adapter cannot make a balance',async()=>{
 const a=createR47TestOnlyAuthAdapter({
  verifyIdToken:async(token,revoked)=>({uid:token==='merchant-token-mock'?'merchant-1':'customer-1',
    firebase:{sign_in_provider:'password'}}),
  store:{readOnlySnapshot:async fn=>fn({readBundle:async()=>null})}
 });
 await assert.rejects(()=>a.inspectSimulatedEvents(args),/R47_BUNDLE_NOT_FOUND/);
 assert.throws(()=>createR47TestOnlyAuthAdapter({}),/R47_MISSING_VERIFIED_ADAPTER/);
});
