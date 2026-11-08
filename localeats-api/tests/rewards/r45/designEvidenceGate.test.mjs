import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectR45ProposedEvidence} from './designEvidenceGate.mjs';

const orderId='550e8400-e29b-41d4-a716-000000000551';
const cmd=['550e8400-e29b-41d4-a716-000000000552','550e8400-e29b-41d4-a716-000000000553',
 '550e8400-e29b-41d4-a716-000000000554','550e8400-e29b-41d4-a716-000000000555'];
const shop='shop-my-kota-ivory-park', owner='merchant-1', customer='customer-1';
const hash='a'.repeat(64);
const fixture=()=>({
 source:'synthetic-r45-private-snapshot',
 programme:{version:'bronze-only-v1',active:true,pilotCustomers:12,budgetMinor:50000,
  freeFoodCapMinor:2500,goldActive:false,platinumActive:false,termsHash:hash,
  startsAt:'2026-11-01T00:00:00Z',endsAt:'2027-01-01T00:00:00Z'},
 funding:{source:'synthetic-finance-review',reconciled:true,bankEvidenceReference:'FAKE-BANK-123',
  backingMinor:50000,reservedMinor:30000,bufferMinor:20000,
  reviewerUid:'independent-finance-1',reviewedAt:'2026-11-01T01:00:00Z'},
 customer:{uid:customer,registered:true,anonymous:false,testAccount:false,consent:true,
  admissionId:'pilot-admission-1',acceptedTermsHash:hash,enrolledAt:'2026-11-07T09:00:00Z'},
 shop:{id:shop,ownerUid:owner,approved:true,participating:true,archived:false,
  programmeVersion:'bronze-only-v1',optedInAt:'2026-11-02T00:00:00Z'},
 order:{id:orderId,customerUid:customer,shopId:shop,status:'collected',paymentStatus:'paid',
  deliveryType:'collection',testOrder:false,simulated:false,intentHash:'b'.repeat(64),
  revision:4,paymentMethod:'cash',totalMinor:11000,createdAt:'2026-11-07T10:00:00Z'},
 lines:[
  {lineId:'line-0',index:0,orderId,shopId:shop,menuItemId:'my-kota',
   unitMinor:2500,quantity:4,lineTotalMinor:10000,source:'synthetic-order-create-transaction',
   immutable:true,programmeVersion:'bronze-only-v1',rewardFunded:false,
   qualifyingKota:true,capturedAt:'2026-11-07T10:00:00Z'},
  {lineId:'line-1',index:1,orderId,shopId:shop,menuItemId:'soda',
   unitMinor:1000,quantity:1,lineTotalMinor:1000,source:'synthetic-order-create-transaction',
   immutable:true,programmeVersion:'bronze-only-v1',rewardFunded:false,
   qualifyingKota:false,capturedAt:'2026-11-07T10:00:00Z'}
 ],
 events:['accepted','ready','payment_confirmed','collected'].map((kind,i)=>({
   orderId,shopId:shop,actorUid:owner,actorSource:'synthetic-revocation-checked-merchant',
   commandId:cmd[i],revision:i+1,kind,
   occurredAt:['2026-11-07T10:01:00Z','2026-11-07T10:02:00Z',
               '2026-11-07T10:05:00Z','2026-11-07T10:10:00Z'][i]
 })),
 merchantTill:{source:'synthetic-shop-till-attestation',orderId,commandId:cmd[2],shopId:shop,
  merchantUid:owner,method:'cash',amountMinor:11000,receiptReference:'FAKE-SLIP-1',
  disputed:false,attestedAt:'2026-11-07T10:06:00Z'},
 customerHandover:{source:'synthetic-server-consumed-challenge',orderId,customerUid:customer,
  shopId:shop,collectedCommandId:cmd[3],challengeId:'fake-one-use-1',consumed:true,
  issuedAt:'2026-11-07T10:03:00Z',consumedAt:'2026-11-07T10:09:00Z',
  expiresAt:'2026-11-07T10:13:00Z',attempts:1,maxAttempts:5,
  consumptionReceiptId:'fake-challenge-consumed-receipt'},
 refundReview:{source:'synthetic-private-refund-review',orderId,complete:true,events:[]}
});
const invalidCases=[
 ['untrusted browser source',x=>{x.source='request.body'},'PRIVATE_SOURCE_UNVERIFIED'],
 ['future Gold active in pilot',x=>{x.programme.goldActive=true},'PUBLISHED_BRONZE_ONLY_PROGRAMME_MISSING'],
 ['future Platinum active in pilot',x=>{x.programme.platinumActive=true},'PUBLISHED_BRONZE_ONLY_PROGRAMME_MISSING'],
 ['inactive programme',x=>{x.programme.active=false},'PUBLISHED_BRONZE_ONLY_PROGRAMME_MISSING'],
 ['admission cap raised to 13',x=>{x.programme.pilotCustomers=13},'PUBLISHED_BRONZE_ONLY_PROGRAMME_MISSING'],
 ['increased free gift cap',x=>{x.programme.freeFoodCapMinor=5000},'PUBLISHED_BRONZE_ONLY_PROGRAMME_MISSING'],
 ['R500 funding unverified',x=>{x.funding.reconciled=false},'ACTUAL_BACKED_FUNDING_MISSING'],
 ['no bank reference',x=>{delete x.funding.bankEvidenceReference},'ACTUAL_BACKED_FUNDING_MISSING'],
 ['insufficient owner money',x=>{x.funding.backingMinor=30000},'ACTUAL_BACKED_FUNDING_MISSING'],
 ['over-reserved budget',x=>{x.funding.reservedMinor=31000},'ACTUAL_BACKED_FUNDING_MISSING'],
 ['R200 buffer spent in advance',x=>{x.funding.bufferMinor=0},'ACTUAL_BACKED_FUNDING_MISSING'],
 ['merchant self-reviews fund',x=>{x.funding.reviewerUid=owner},'FUNDING_INDEPENDENT_REVIEW_MISSING'],
 ['unregistered buyer',x=>{x.customer.registered=false},'REGISTERED_ENROLLED_CUSTOMER_MISSING'],
 ['anonymous buyer',x=>{x.customer.anonymous=true},'REGISTERED_ENROLLED_CUSTOMER_MISSING'],
 ['test buyer',x=>{x.customer.testAccount=true},'REGISTERED_ENROLLED_CUSTOMER_MISSING'],
 ['customer refused consent',x=>{x.customer.consent=false},'REGISTERED_ENROLLED_CUSTOMER_MISSING'],
 ['enrolment after purchase',x=>{x.customer.enrolledAt='2026-11-08T11:00:00Z'},'RETROACTIVE_OR_UNCONSENTED_PURCHASE'],
 ['shop opted-in after purchase',x=>{x.shop.optedInAt='2026-11-08T11:00:00Z'},'RETROACTIVE_OR_UNCONSENTED_PURCHASE'],
 ['programme started after purchase',x=>{x.programme.startsAt='2026-11-08T11:00:00Z'},'RETROACTIVE_OR_UNCONSENTED_PURCHASE'],
 ['shop is unapproved',x=>{x.shop.approved=false},'ELIGIBLE_PARTICIPATING_SHOP_MISSING'],
 ['shop changed owner',x=>{x.shop.ownerUid='merchant-2'},'PAYMENT_AND_COLLECTION_EVENTS_UNTRUSTED'],
 ['shop archived',x=>{x.shop.archived=true},'ELIGIBLE_PARTICIPATING_SHOP_MISSING'],
 ['order unpaid',x=>{x.order.paymentStatus='unpaid'},'AUTHORITATIVE_PICKUP_ORDER_MISSING'],
 ['order uncollected',x=>{x.order.status='ready_for_pickup'},'AUTHORITATIVE_PICKUP_ORDER_MISSING'],
 ['simulated order',x=>{x.order.simulated=true},'AUTHORITATIVE_PICKUP_ORDER_MISSING'],
 ['delivery instead of pickup',x=>{x.order.deliveryType='delivery'},'AUTHORITATIVE_PICKUP_ORDER_MISSING'],
 ['missing persisted hash',x=>{delete x.order.intentHash},'AUTHORITATIVE_PICKUP_ORDER_MISSING'],
 ['mutable current menu',x=>{x.lines[0].source='current-menu'},'IMMUTABLE_PURCHASE_LINES_MISSING'],
 ['eligibility snapshot after purchase',x=>{x.lines[0].capturedAt='2026-11-07T10:11:00Z'},'IMMUTABLE_PURCHASE_LINES_MISSING'],
 ['reward-funded purchased line',x=>{x.lines[0].rewardFunded=true},'IMMUTABLE_PURCHASE_LINES_MISSING'],
 ['invalid kota quantity',x=>{x.lines[0].quantity=-4},'IMMUTABLE_PURCHASE_LINES_MISSING'],
 ['duplicated checkout line ID',x=>{x.lines[1].lineId='line-0'},'IMMUTABLE_PURCHASE_LINES_MISSING'],
 ['no actual kota item',x=>{x.lines[0].qualifyingKota=false},'NO_ELIGIBLE_KOTA_UNITS'],
 ['missing payment event',x=>{x.events=x.events.filter(e=>e.kind!=='payment_confirmed')},'PAYMENT_AND_COLLECTION_SEQUENCE_INVALID'],
 ['missing collected event',x=>{x.events=x.events.filter(e=>e.kind!=='collected')},'PAYMENT_AND_COLLECTION_SEQUENCE_INVALID'],
 ['forged merchant actor',x=>{x.events[2].actorUid='shop-b'},'PAYMENT_AND_COLLECTION_EVENTS_UNTRUSTED'],
 ['client supplied actor role',x=>{x.events[3].actorSource='request.body'},'PAYMENT_AND_COLLECTION_EVENTS_UNTRUSTED'],
 ['duplicate command revision',x=>{x.events[3].revision=3},'PAYMENT_AND_COLLECTION_EVENTS_UNTRUSTED'],
 ['collected before payment',x=>{x.events[3].occurredAt='2026-11-07T10:04:00Z'},'PAYMENT_AND_COLLECTION_SEQUENCE_INVALID'],
 ['amount differs from till payment',x=>{x.merchantTill.amountMinor=10000},'PHYSICAL_TILL_ATTESTATION_UNVERIFIED'],
 ['merchant cash statement disputed',x=>{x.merchantTill.disputed=true},'PHYSICAL_TILL_ATTESTATION_UNVERIFIED'],
 ['client claimed payment',x=>{x.merchantTill.source='request.body'},'PHYSICAL_TILL_ATTESTATION_UNVERIFIED'],
 ['merchant said handover confirmed but no customer proof',x=>{x.customerHandover.source='handover_confirmed:true'},'INDEPENDENT_CUSTOMER_HANDOVER_UNVERIFIED'],
 ['customer challenge not consumed',x=>{x.customerHandover.consumed=false},'INDEPENDENT_CUSTOMER_HANDOVER_UNVERIFIED'],
 ['expired customer challenge',x=>{x.customerHandover.expiresAt='2026-11-07T10:07:00Z'},'INDEPENDENT_CUSTOMER_HANDOVER_UNVERIFIED'],
 ['PIN guessing beyond cap',x=>{x.customerHandover.attempts=6},'INDEPENDENT_CUSTOMER_HANDOVER_UNVERIFIED'],
 ['plaintext PIN exposed in record',x=>{x.customerHandover.pin='1234'},'INDEPENDENT_CUSTOMER_HANDOVER_UNVERIFIED'],
 ['wrong customer claimed handover',x=>{x.customerHandover.customerUid='someone-else'},'INDEPENDENT_CUSTOMER_HANDOVER_UNVERIFIED'],
 ['unknown refund history',x=>{x.refundReview.complete=false},'REFUND_OR_DISPUTE_REVIEW_REQUIRED'],
 ['pending refund reported',x=>{x.refundReview.events=[{kind:'pending'}]},'REFUND_OR_DISPUTE_REVIEW_REQUIRED'],
 ['browser cached refund list',x=>{x.refundReview.source='browser-cache'},'REFUND_OR_DISPUTE_REVIEW_REQUIRED'],
 ['contradicting checkout totals',x=>{x.order.totalMinor=10000},'AUTHORITATIVE_TOTAL_MISMATCH'],
];
test('R4.5 fully populated FUTURE synthetic source is only a REVIEW candidate with 4 kota units',()=>{
 const r=inspectR45ProposedEvidence(fixture());
 assert.equal(r.mode,'r45-design-fixture-only');
 assert.equal(r.decision,'PASS_CANDIDATE_FOR_FUTURE_REVIEW');
 assert.deepEqual(r.blockers,[]);
 assert.equal(r.qualifyingUnits,4);
 assert.deepEqual([r.canGrant,r.canReserve,r.canReimburse,r.canActivate],[false,false,false,false]);
});
test('R4.5 cannot mutate a source bundle or generate any financial side-effect',()=>{
 const x=fixture(),copy=structuredClone(x);
 const a=inspectR45ProposedEvidence(x),b=inspectR45ProposedEvidence(x);
 assert.deepEqual(a,b);assert.deepEqual(x,copy);assert.equal(Object.isFrozen(a),true);
});
for(const [label,change,expected] of invalidCases) {
 test('R4.5 rejects '+label,()=>{
  const x=fixture();change(x);
  const r=inspectR45ProposedEvidence(x);
  assert.equal(r.decision,'BLOCKED_MISSING_OR_INVALID_EVIDENCE');
  assert.ok(r.blockers.includes(expected),label+' blockers: '+JSON.stringify(r.blockers));
  assert.equal(r.qualifyingUnits,0);
  assert.deepEqual([r.canGrant,r.canReserve,r.canReimburse,r.canActivate],[false,false,false,false]);
 });
}
test('R4.5 missing any complete evidence group is blocked and never earns credit',()=>{
 for(const key of ['programme','funding','customer','shop','order','lines','events','merchantTill','customerHandover','refundReview']){
  const x=fixture();delete x[key];const r=inspectR45ProposedEvidence(x);
  assert.equal(r.decision,'BLOCKED_MISSING_OR_INVALID_EVIDENCE',key);
  assert.equal(r.canGrant,false,key);
 }
});
test('R4.5 bare customer JSON saying paid and collected is not private evidence',()=>{
 const r=inspectR45ProposedEvidence({paid:true,collected:true,eligibleKota:true,rewardMinor:2500});
 assert.ok(r.blockers.includes('PRIVATE_SOURCE_UNVERIFIED'));
 assert.equal(r.canGrant,false);
});
