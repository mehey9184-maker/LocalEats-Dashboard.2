import test from 'node:test';
import assert from 'node:assert/strict';
import {createR44InertPickupInspector} from './contractReadOnlyAdapter.mjs';
import {pickupQuote,merchantCommandReceipt} from '../../../dist/orders/pickupService.js';

const orderId='550e8400-e29b-41d4-a716-000000000441';
const acceptedId='550e8400-e29b-41d4-a716-000000000442';
const paymentId='550e8400-e29b-41d4-a716-000000000443';
const collectedId='550e8400-e29b-41d4-a716-000000000444';
const auth='Bearer fb-synthetic-token-000000';
const clone=x=>structuredClone(x);

const fixture=()=>({
  source:'synthetic-server-readonly-snapshot',
  order:{
    id:orderId,shop_id:'shop-my-kota-ivory-park',user_id:'customer-1',
    status:'collected',delivery_status:'none',delivery_type:'collection',
    payment_status:'paid',payment_method:'cash',revision:3,
    create_intent_hash:'a'.repeat(64),test_record:false,simulated_checkout:false,
    created_at:'2026-11-07T10:00:00Z',idempotency_key:'550e8400-e29b-41d4-a716-000000000445',
    service_fee:0,delivery_fee:0,total_price:110,
    items:[
      {menu_item_id:'kota',name:'Kota',unit_price:25,quantity:4,line_total:100,notes:''},
      {menu_item_id:'soda',name:'Soda',unit_price:10,quantity:1,line_total:10,notes:''}
    ]
  },
  shop:{id:'shop-my-kota-ivory-park',owner_id:'merchant-1',approval_status:'approved',archived_at:null},
  programmeShop:{
    shop_id:'shop-my-kota-ivory-park',approval_status:'approved',
    participating_at_purchase:true,programme_version:'bronze-only-v1',
    rewards_started_at:'2026-11-01T00:00:00Z',shop_approved_at:'2026-10-20T00:00:00Z'
  },
  registeredCustomer:{uid:'customer-1',registered:true,anonymous:false,test_account:false},
  pickupEvents:[
    {order_id:orderId,command_id:acceptedId,actor_uid:'merchant-1',kind:'accepted',revision:1,occurred_at:'2026-11-07T10:01:00Z'},
    {order_id:orderId,command_id:paymentId,actor_uid:'merchant-1',kind:'payment_confirmed',revision:2,occurred_at:'2026-11-07T10:02:00Z'},
    {order_id:orderId,command_id:collectedId,actor_uid:'merchant-1',kind:'collected',revision:3,occurred_at:'2026-11-07T10:10:00Z'}
  ],
  customerHandoverProof:{
    order_id:orderId,customer_uid:'customer-1',shop_id:'shop-my-kota-ivory-park',
    collected_command_id:collectedId,
    verified:true,source:'server-consumed-single-use-customer-code',verified_at:'2026-11-07T10:05:00Z'
  },
  eligibilitySnapshots:[
    {line_index:0,order_id:orderId,shop_id:'shop-my-kota-ivory-park',menu_item_id:'kota',
      programme_version:'bronze-only-v1',qualifying_kota:true,reward_funded:false,immutable:true,
      proof_source:'server-persisted-at-purchase',snapshot_at:'2026-11-07T09:59:59Z'},
    {line_index:1,order_id:orderId,shop_id:'shop-my-kota-ivory-park',menu_item_id:'soda',
      programme_version:'bronze-only-v1',qualifying_kota:false,reward_funded:false,immutable:true,
      proof_source:'server-persisted-at-purchase',snapshot_at:'2026-11-07T09:59:59Z'}
  ],
  verifiedRefunds:[]
});

const harness=(mutate=x=>x, options={})=>{
  let reads=0, transactions=0, verifierCalls=0, writes=0;
  const input=fixture();
  const store=Object.freeze({
    async readOnlySnapshot(callback){
      transactions++;
      return callback(Object.freeze({
        async readRewardEvidenceBundle(id){
          reads++;
          assert.equal(id,orderId);
          return clone(mutate(clone(input)));
        },
        async insert(){writes++;throw Error('R44_FORBIDDEN_MUTATION')},
        async rpc(){writes++;throw Error('R44_FORBIDDEN_RPC')},
      }));
    }
  });
  const inspector=createR44InertPickupInspector({
    verifyIdToken:async(token,checkRevoked)=>{
      verifierCalls++;
      assert.equal(checkRevoked,true,'real Firebase Admin verifier must check revocation');
      assert.equal(token,'synthetic-token-000000');
      if(options.rejectToken)throw Error('revoked/disabled');
      return {uid:options.uid??'merchant-1',firebase:{sign_in_provider:options.provider??'password'}};
    },
    store
  });
  return {inspector,counts:()=>({reads,transactions,verifierCalls,writes}),input};
};
const bad=async(edit,pattern)=>assert.rejects(
  ()=>harness(edit).inspector.inspect(auth,orderId),pattern??/R44_|REWARDS_/);

test('R4.4 real pickup service quote emits the same menu line units as stored pickup JSONB',()=>{
  const saved=fixture().order;
  const quote=pickupQuote({
    lines:saved.items,subtotal:110,service_fee:0,delivery_fee:0,discount_amount:0,
    tip_amount:0,total_price:110
  });
  assert.equal(quote.total_minor,11000);
  assert.equal(quote.service_fee_minor,0);
  assert.equal(quote.delivery_fee_minor,0);
  assert.equal(quote.lines[0].quantity,4);
  assert.equal(quote.lines[0].unit_minor,2500);
  assert.match(quote.pricing_fingerprint,/^[a-f0-9]{64}$/);
});
test('R4.4 real merchantCommandReceipt derives command UUID, owner and revision',()=>{
  const b=fixture();
  assert.deepEqual(merchantCommandReceipt({order:b.order,event:b.pickupEvents[2]}),{
    command_id:collectedId,order_id:orderId,actor_uid:'merchant-1',kind:'collected',revision:3
  });
  assert.throws(()=>merchantCommandReceipt({order:b.order,event:{...b.pickupEvents[2],command_id:null}}));
});
test('R4.4 isolated private complete snapshot inspects without authorizing money or creating debt',async()=>{
  const h=harness();
  const r=await h.inspector.inspect(auth,orderId);
  assert.deepEqual(r,{
    mode:'r44-readonly-contract-fixture',orderId,
    shopId:'shop-my-kota-ivory-park',programmeVersion:'bronze-only-v1',
    eligibleUnits:4,canGrant:false,canReserve:false,canReimburse:false,canActivate:false
  });
  assert.equal(Object.isFrozen(r),true);
  assert.deepEqual(h.counts(),{reads:1,transactions:1,verifierCalls:1,writes:0});
  assert.deepEqual(h.input,fixture(),'inspector cannot mutate source records');
});
test('R4.4 repeat inspection never increments purchase count or creates a reward',async()=>{
  const h=harness();
  const results=await Promise.all(Array.from({length:8},()=>h.inspector.inspect(auth,orderId)));
  assert.deepEqual(new Set(results.map(x=>x.eligibleUnits)),new Set([4]));
  assert.deepEqual(h.counts(),{reads:8,transactions:8,verifierCalls:8,writes:0});
});
test('R4.4 reject unauthenticated/revoked/anonymous token and invalid UUID before reading',async()=>{
  const h=harness();
  await assert.rejects(()=>h.inspector.inspect(undefined,orderId),/REWARDS_FINANCIAL_AUTH_REQUIRED/);
  await assert.rejects(()=>h.inspector.inspect(auth,'client-supplied-order'),/R44_INVALID_ORDER_UUID/);
  await assert.rejects(()=>harness(x=>x,{rejectToken:true}).inspector.inspect(auth,orderId),/REWARDS_FINANCIAL_AUTH_REQUIRED/);
  await assert.rejects(()=>harness(x=>x,{provider:'anonymous'}).inspector.inspect(auth,orderId),/REWARDS_FINANCIAL_AUTH_REQUIRED/);
  assert.deepEqual(h.counts(),{reads:0,transactions:0,verifierCalls:0,writes:0});
});
test('R4.4 reject anonymous request body posing as a stored order',async()=>{
  const h=harness();
  await assert.rejects(()=>h.inspector.inspect(auth,{id:orderId,paid:true,collected:true,shop_id:'shop-my-kota-ivory-park'}),/R44_INVALID_ORDER_UUID/);
  assert.equal(h.counts().reads,0);
});
test('R4.4 wrong merchant cannot read another approved shop order evidence',async()=>{
  await assert.rejects(()=>harness(x=>x,{uid:'merchant-other'}).inspector.inspect(auth,orderId),/R44_MERCHANT_SHOP_OWNERSHIP_MISMATCH/);
  await bad(x=>{x.shop.owner_id='merchant-other';return x},/R44_MERCHANT_SHOP_OWNERSHIP_MISMATCH/);
  await bad(x=>{x.shop.archived_at='2026-11-04T00:00:00Z';return x},/R44_MERCHANT_SHOP_OWNERSHIP_MISMATCH/);
  await bad(x=>{x.shop.approval_status='pending';return x},/R44_MERCHANT_SHOP_OWNERSHIP_MISMATCH/);
});
test('R4.4 never treat public Customer GET order response as private Rewards evidence',async()=>{
  await bad(x=>{delete x.order.create_intent_hash;return x},/R44_PICKUP_ORDER_NOT_TRUSTWORTHY/);
  // Public /api/v1/orders/:id history omits command_id and actor_uid.
  await bad(x=>{x.pickupEvents=x.pickupEvents.map(({kind,revision,occurred_at})=>({kind,revision,occurred_at}));return x},/R44_COMMAND_RECEIPT_SCHEMA_INCOMPLETE/);
  await bad(x=>{delete x.order.test_record;return x},/R44_PICKUP_ORDER_NOT_TRUSTWORTHY/);
  await bad(x=>{delete x.order.simulated_checkout;return x},/R44_PICKUP_ORDER_NOT_TRUSTWORTHY/);
});
test('R4.4 paid and collected booleans alone never substitute actual two merchant command receipts',async()=>{
  await bad(x=>{x.pickupEvents=x.pickupEvents.filter(e=>e.kind!=='payment_confirmed');return x},/R44_COLLECTION_AND_PAYMENT_COMMAND_MISMATCH/);
  await bad(x=>{x.pickupEvents=x.pickupEvents.filter(e=>e.kind!=='collected');return x},/R44_COLLECTION_AND_PAYMENT_COMMAND_MISMATCH/);
  await bad(x=>{x.pickupEvents[2].revision=2;return x},/R44_COMMAND_RECEIPT_SCHEMA_INCOMPLETE/);
  await bad(x=>{x.pickupEvents[2].actor_uid='merchant-other';return x},/R44_COLLECTION_AND_PAYMENT_COMMAND_MISMATCH/);
  await bad(x=>{x.order.payment_status='unpaid';return x},/R44_PICKUP_ORDER_NOT_TRUSTWORTHY/);
  await bad(x=>{x.order.status='ready_for_pickup';return x},/R44_PICKUP_ORDER_NOT_TRUSTWORTHY/);
});
test('R4.4 reject missing or unverified independent customer pickup code',async()=>{
  await bad(x=>{delete x.customerHandoverProof;return x},/R44_INDEPENDENT_PICKUP_PROOF_MISSING/);
  await bad(x=>{x.customerHandoverProof.source='handover_confirmed:true';return x},/R44_INDEPENDENT_PICKUP_PROOF_UNVERIFIED/);
  await bad(x=>{x.customerHandoverProof.verified=false;return x},/R44_INDEPENDENT_PICKUP_PROOF_UNVERIFIED/);
  await bad(x=>{x.customerHandoverProof.customer_uid='other';return x},/R44_INDEPENDENT_PICKUP_PROOF_UNVERIFIED/);
  await bad(x=>{x.customerHandoverProof.collected_command_id=paymentId;return x},/R44_INDEPENDENT_PICKUP_PROOF_UNVERIFIED/);
});
test('R4.4 zero eligibility snapshot, mutable menu, reward-funded kota or missing source fail closed',async()=>{
  await bad(x=>{delete x.eligibilitySnapshots;return x},/R44_ELIGIBILITY_SNAPSHOT_NOT_PERSISTED/);
  await bad(x=>{x.eligibilitySnapshots[0].immutable=false;return x},/R44_IMMUTABLE_REWARDS_ITEM_NOT_CONFIRMED/);
  await bad(x=>{x.eligibilitySnapshots[0].proof_source='current-menu';return x},/R44_IMMUTABLE_REWARDS_ITEM_NOT_CONFIRMED/);
  await bad(x=>{x.eligibilitySnapshots[0].reward_funded=true;return x},/R44_IMMUTABLE_REWARDS_ITEM_NOT_CONFIRMED/);
  await bad(x=>{delete x.eligibilitySnapshots[0].reward_funded;return x},/R44_IMMUTABLE_REWARDS_ITEM_NOT_CONFIRMED/);
  await bad(x=>{x.eligibilitySnapshots[0].shop_id='shop-b';return x},/R44_IMMUTABLE_REWARDS_ITEM_NOT_CONFIRMED/);
  await bad(x=>{x.order.items[0].quantity=999;return x},/R44_IMMUTABLE_REWARDS_ITEM_NOT_CONFIRMED/);
});
test('R4.4 cross-order or cross-customer programme attribution is not reward evidence',async()=>{
  await bad(x=>{x.registeredCustomer.uid='customer-other';return x},/R44_PURCHASE_OWNER_PROGRAMME_MISMATCH/);
  await bad(x=>{x.programmeShop.shop_id='shop-b';return x},/R44_PURCHASE_OWNER_PROGRAMME_MISMATCH/);
  await bad(x=>{x.programmeShop.participating_at_purchase=false;return x},/REWARDS_PROGRAMME_NOT_ELIGIBLE_AT_PURCHASE/);
  await bad(x=>{x.programmeShop.rewards_started_at='2026-11-09T00:00:00Z';return x},/REWARDS_PROGRAMME_NOT_ELIGIBLE_AT_PURCHASE/);
  await bad(x=>{x.order.user_id='fake-buyer';return x},/R44_PURCHASE_OWNER_PROGRAMME_MISMATCH/);
});
test('R4.4 incomplete or nonempty refund history never permits credit',async()=>{
  await bad(x=>{delete x.verifiedRefunds;return x},/R44_REFUND_HISTORY_NOT_READ/);
  await bad(x=>{x.verifiedRefunds=[{id:'refund-1',status:'pending'}];return x},/REWARDS_REFUNDED_ORDER_REQUIRES_REVIEW/);
  await bad(x=>{x.verifiedRefunds=null;return x},/R44_REFUND_HISTORY_NOT_READ/);
});
test('R4.4 failed isolated read/verification never assumes credit or external money exists',async()=>{
  const h=createR44InertPickupInspector({
    verifyIdToken:async()=>({uid:'merchant-1',firebase:{sign_in_provider:'password'}}),
    store:{readOnlySnapshot:async cb=>cb({readRewardEvidenceBundle:async()=>null})}
  });
  await assert.rejects(()=>h.inspect(auth,orderId),/R44_PRIVATE_SNAPSHOT_UNAVAILABLE/);
  assert.throws(()=>createR44InertPickupInspector({}),/R44_MISSING_READ_ONLY_DEPENDENCIES/);
});
test('R4.4 the private reader is required; a source label never establishes auth by itself',async()=>{
  await bad(x=>{x.source='customer-body';return x},/R44_SOURCE_NOT_INDEPENDENT/);
  const h=createR44InertPickupInspector({
    verifyIdToken:async()=>({uid:'merchant-1',firebase:{sign_in_provider:'password'}}),
    store:{readOnlySnapshot:async cb=>cb({})}
  });
  await assert.rejects(()=>h.inspect(auth,orderId),/R44_READER_MISSING/);
});
