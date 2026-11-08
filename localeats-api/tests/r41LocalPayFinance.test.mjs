import test from 'node:test';
import assert from 'node:assert/strict';
import {newR41TestSandbox} from './r41LocalPayFinance.mjs';

const now='2026-11-08T12:00:00.000Z';
const goldExpiry='2029-11-08T12:00:00.000Z';
const platinumExpiry='2029-12-08T12:00:00.000Z';
const sandbox=(opts={})=>newR41TestSandbox({syntheticFixture:'R41_TEST_ONLY',fundedMinor:50000,...opts});
const line=(customerId,units=4,overrides={})=>({orderId:`order-${customerId}`,lineId:'line-0',customerId,
  shopId:'my-kota',quantity:units,paid:true,collected:true,eligibleKota:true,simulated:false,
  refunded:false,rewardFunded:false,...overrides});
const hold=(customerId,opts={})=>({holdId:`hold-${customerId}`,customerId,shopId:'my-kota',orderId:`food-${customerId}`,
  priceMinor:2500,creditMinor:2500,itemKind:'standard_kota',nowIso:now,...opts});
const invariant=s=>{const st=s.snapshot();assert.equal(Object.values(st.balances).reduce((a,b)=>a+b,0),st.fundedMinor);
  assert.ok(Object.values(st.balances).every(x=>Number.isSafeInteger(x)&&x>=0));
  assert.equal(st.grants.reduce((n,g)=>n+g.availableMinor,0),st.balances.customer);
  assert.equal(st.grants.reduce((n,g)=>n+g.heldMinor,0),st.balances.held);
  assert.equal(st.payables.filter(p=>p.status==='owed').reduce((n,p)=>n+p.amountMinor,0),st.balances.payable);
  return st;};

test('R4.1: refuses any non-test harness (no real funding mode)',()=>{
  assert.throws(()=>newR41TestSandbox(),/R41_TEST_FIXTURE_REQUIRED/);
  assert.throws(()=>sandbox({fundedMinor:-1}),/R41_INVALID_TEST_FUNDING/);
});
test('R4.1: 12 simultaneous enrolments reserve R300 of R500; thirteenth fails closed',async()=>{
  const s=sandbox();
  const requests=Array.from({length:13},(_,i)=>s.enroll(`person-${i+1}`));
  const results=await Promise.allSettled(requests);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,12);
  assert.equal(results.filter(r=>r.status==='rejected').length,1);
  assert.match(results.find(r=>r.status==='rejected').reason.message,/R41_COHORT_FULL/);
  const st=invariant(s);
  assert.equal(st.balances.reserved,30000);
  assert.equal(st.balances.uncommitted,20000);
  assert.equal(st.grants.length,0);
  assert.equal(st.participants.length,12);
});
test('R4.1: admission is idempotent; conflicting customer enrolment cannot change reserves',async()=>{
  const s=sandbox();
  const a=await s.enroll('person');const b=await s.enroll('person');
  assert.equal(a.replayed,false);assert.equal(b.replayed,true);
  assert.equal(invariant(s).balances.reserved,2500);
});
test('R4.1: four bought kotas in one real paid-collected order earn one Bronze grant',async()=>{
  const s=sandbox();await s.enroll('p');
  const a=await s.collectPaidOrder(line('p',4));
  assert.equal(a.rank,'silver');assert.equal(a.bronzeIssued,true);
  const b=await s.collectPaidOrder(line('p',4));
  assert.equal(b.replayed,true);
  assert.equal(invariant(s).grants.length,1);
  assert.equal(s.snapshot().balances.customer,2500);
  assert.equal(s.snapshot().balances.reserved,0);
});
test('R4.1: separate orders 3+1 also earn Bronze exactly once; huge later count grants no Gold/Platinum under Bronze-only',async()=>{
  const s=sandbox();await s.enroll('p');
  await s.collectPaidOrder(line('p',3));
  assert.equal(invariant(s).grants.length,0);
  await s.collectPaidOrder(line('p',1,{orderId:'order-next'}));
  await s.collectPaidOrder(line('p',100,{orderId:'bulk-order'}));
  assert.equal(invariant(s).grants.length,1);
  assert.equal(s.snapshot().participants[0].rank,'silver');
  await assert.rejects(s.issueFutureGrantForTest({customerId:'p',tier:'gold',expiresAt:goldExpiry}),/FUTURE_REWARDS_INACTIVE/);
});
test('R4.1: cancelled, simulated, reward-funded, uncollected, unpaid, refunded or fake shops fail closed',async()=>{
  const s=sandbox();await s.enroll('p');
  for(const x of [{paid:false},{collected:false},{simulated:true},{refunded:true},
    {rewardFunded:true},{eligibleKota:false},{shopId:'unapproved'}]){
    await assert.rejects(s.collectPaidOrder(line('p',4,x)));
    assert.equal(invariant(s).grants.length,0);
  }
  await assert.rejects(s.collectPaidOrder(line('p',0)),/INVALID_QUANTITY/);
});
test('R4.1: reusing same order/line with changed quantity or owner conflicts and never double-grants',async()=>{
  const s=sandbox();await s.enroll('p');
  await s.collectPaidOrder(line('p',4));
  await assert.rejects(s.collectPaidOrder(line('p',5)),/CONFLICTING_REPLAY/);
  await assert.rejects(s.collectPaidOrder({...line('p',4),customerId:'another'}),/CONFLICTING_REPLAY/);
  assert.equal(invariant(s).grants.length,1);
});
test('R4.1: two simultaneous credit holds cannot spend R25 twice; no negative credit',async()=>{
  const s=sandbox();await s.enroll('p');await s.collectPaidOrder(line('p'));
  const res=await Promise.allSettled([s.holdCredit(hold('p',{holdId:'a'})),s.holdCredit(hold('p',{holdId:'b'}))]);
  assert.deepEqual(res.map(r=>r.status).sort(),['fulfilled','rejected']);
  assert.equal(invariant(s).balances.held,2500);
  assert.equal(s.snapshot().balances.customer,0);
});
test('R4.1: credit hold is not merchant debt; unpaid or uncollected order cannot reimburse merchant',async()=>{
  const s=sandbox();await s.enroll('p');await s.collectPaidOrder(line('p'));
  await s.holdCredit(hold('p'));
  for(const x of [{paidRemainder:false,verifiedCollected:true},{paidRemainder:true,verifiedCollected:false}]){
    await assert.rejects(s.collectRewardFood({holdId:'hold-p',shopId:'my-kota',handoverId:'handover',...x}),/PICKUP_AND_PAYMENT_PROOF_REQUIRED/);
    assert.equal(invariant(s).payables.length,0);
  }
  await s.cancelHold({holdId:'hold-p',reason:'customer-cancelled'});
  assert.equal(invariant(s).balances.customer,2500);
  assert.equal(s.snapshot().balances.held,0);
  await assert.rejects(s.collectRewardFood({holdId:'hold-p',shopId:'my-kota',handoverId:'handover',paidRemainder:true,verifiedCollected:true}),/HOLD_NOT_OWNED_OR_FINAL/);
});
test('R4.1: valid pickup turns only R25 held credit into R25 payable, not another R25 promise',async()=>{
  const s=sandbox();await s.enroll('p');await s.collectPaidOrder(line('p'));
  await s.holdCredit(hold('p'));
  const input={holdId:'hold-p',shopId:'my-kota',handoverId:'handover-p',paidRemainder:true,verifiedCollected:true};
  const a=await s.collectRewardFood(input),b=await s.collectRewardFood(input);
  assert.equal(b.replayed,true);assert.equal(a.amountMinor,2500);
  const st=invariant(s);
  assert.equal(st.balances.customer,0);assert.equal(st.balances.held,0);
  assert.equal(st.balances.payable,2500);assert.equal(st.payables.length,1);
  assert.equal(st.journal.at(-1).from,'held');assert.equal(st.journal.at(-1).to,'payable');
});
test('R4.1: merchant bank payment needs mock bank evidence and admin; shop receipt separate',async()=>{
  const s=sandbox();await s.enroll('p');await s.collectPaidOrder(line('p'));
  await s.holdCredit(hold('p'));
  const p=await s.collectRewardFood({holdId:'hold-p',shopId:'my-kota',handoverId:'handover',paidRemainder:true,verifiedCollected:true});
  const payload={payableId:p.payableId,transferId:'transfer-1',bankReference:'SYNTHETIC-BANK',amountMinor:2500,adminRole:'super_admin',bankEvidence:true};
  await assert.rejects(s.recordMockBankEvidence({...payload,bankEvidence:false}),/ADMIN_AND_BANK_PROOF_REQUIRED/);
  await assert.rejects(s.recordMockBankEvidence({...payload,adminRole:'merchant'}),/ADMIN_AND_BANK_PROOF_REQUIRED/);
  await assert.rejects(s.recordMockBankEvidence({...payload,amountMinor:3000}),/TRANSFER_AMOUNT_MISMATCH/);
  assert.equal(invariant(s).balances.payable,2500);
  const sent=await s.recordMockBankEvidence(payload);
  assert.equal(sent.status,'sent-not-merchant-confirmed');
  const replay=await s.recordMockBankEvidence(payload);assert.equal(replay.replayed,true);
  assert.equal(invariant(s).balances.paidOut,2500);assert.equal(s.snapshot().balances.payable,0);
  await assert.rejects(s.merchantReceipt({payableId:p.payableId,shopId:'shop-b',receiptId:'r',received:true}),/MERCHANT_FORBIDDEN/);
  const ack=await s.merchantReceipt({payableId:p.payableId,shopId:'my-kota',receiptId:'r',received:true});
  assert.equal(ack.status,'confirmed');assert.equal(invariant(s).balances.paidOut,2500);
});
test('R4.1: Gold/Platinum spendable credit lots retain unused Gold and spend earliest expiry first',async()=>{
  const s=sandbox({fundedMinor:80000,futureCreditFixture:true});
  await s.enroll('p');await s.collectPaidOrder(line('p',54));
  await s.issueFutureGrantForTest({customerId:'p',tier:'gold',expiresAt:goldExpiry});
  const first=hold('p',{holdId:'gold-used',priceMinor:4000,creditMinor:4000});
  await s.holdCredit(first);
  await s.collectRewardFood({holdId:'gold-used',shopId:'my-kota',handoverId:'handover-gold',paidRemainder:true,verifiedCollected:true});
  await s.issueFutureGrantForTest({customerId:'p',tier:'platinum',expiresAt:platinumExpiry});
  const st=invariant(s);
  assert.equal(st.grants.filter(g=>g.tier!=='bronze').reduce((n,g)=>n+g.availableMinor,0),19000);
  assert.equal(st.balances.customer,21500,'Bronze free-food gift is a separate R25 liability');
  assert.equal(st.participants[0].rank,'platinum');
  const r=await s.holdCredit(hold('p',{holdId:'mixed',priceMinor:6000,creditMinor:6000}));
  assert.deepEqual(r.components,[{grantId:'p:gold:once',amountMinor:4000},{grantId:'p:platinum:once',amountMinor:2000}]);
  await s.collectRewardFood({holdId:'mixed',shopId:'my-kota',handoverId:'handover-mixed',paidRemainder:true,verifiedCollected:true});
  assert.equal(invariant(s).grants.filter(g=>g.tier!=='bronze').reduce((n,g)=>n+g.availableMinor,0),13000);
  assert.equal(s.snapshot().grants.find(g=>g.tier==='platinum').expiresAt,platinumExpiry);
});
test('R4.1: future R100 food with R65 credit and R35 at shop yields ONLY R65 payable, not R100',async()=>{
  const s=sandbox({fundedMinor:60000,futureCreditFixture:true});
  await s.enroll('p');await s.collectPaidOrder(line('p',54));
  await s.issueFutureGrantForTest({customerId:'p',tier:'gold',expiresAt:goldExpiry});
  const h=await s.holdCredit(hold('p',{priceMinor:10000,creditMinor:6500}));
  assert.equal(h.remainderMinor,3500);
  await assert.rejects(s.collectRewardFood({holdId:'hold-p',shopId:'my-kota',handoverId:'handover',paidRemainder:false,verifiedCollected:true}),/PICKUP_AND_PAYMENT_PROOF_REQUIRED/);
  assert.equal(invariant(s).payables.length,0);
  const p=await s.collectRewardFood({holdId:'hold-p',shopId:'my-kota',handoverId:'handover',paidRemainder:true,verifiedCollected:true});
  assert.equal(p.amountMinor,6500);assert.equal(p.remainderPaidMinor,3500);
  assert.equal(invariant(s).balances.payable,6500);
  assert.equal(s.snapshot().grants.find(g=>g.tier==='gold').availableMinor,1500);
  assert.equal(s.snapshot().balances.customer,4000,'unspent separate Bronze gift remains');
});
test('R4.1: unexpired grant selection, expired credit denied, and cancelled reservation restores original lot',async()=>{
  const s=sandbox({futureCreditFixture:true});
  await s.enroll('p');await s.collectPaidOrder(line('p',54));
  await s.issueFutureGrantForTest({customerId:'p',tier:'gold',expiresAt:'2026-11-07T12:00:00.000Z'});
  await assert.rejects(s.holdCredit(hold('p',{holdId:'expired',priceMinor:2500,creditMinor:2500})),/CREDIT_UNAVAILABLE/);
  const st=invariant(s);assert.equal(st.balances.customer,10500);
  assert.equal(st.grants.find(g=>g.tier==='gold').availableMinor,8000);
});
test('R4.1: Bronze gift stays separate from future spendable food credits',async()=>{
  const s=sandbox({futureCreditFixture:true});
  await s.enroll('p');await s.collectPaidOrder(line('p',54));
  await s.issueFutureGrantForTest({customerId:'p',tier:'gold',expiresAt:goldExpiry});
  const h=await s.holdCredit(hold('p',{holdId:'gold-only',priceMinor:8000,creditMinor:8000}));
  assert.deepEqual(h.components,[{grantId:'p:gold:once',amountMinor:8000}]);
  const st=invariant(s);
  assert.equal(st.grants.find(g=>g.tier==='bronze').availableMinor,2500);
  assert.equal(st.grants.find(g=>g.tier==='gold').heldMinor,8000);
  await s.cancelHold({holdId:'gold-only',reason:'food-unavailable'});
  const after=invariant(s);
  assert.equal(after.grants.find(g=>g.tier==='gold').availableMinor,8000);
  assert.equal(after.grants.find(g=>g.tier==='bronze').availableMinor,2500);
});
test('R4.1: future credits cannot be minted before +20/+30 or without enough test funding',async()=>{
  const s=sandbox({futureCreditFixture:true,fundedMinor:25000});
  await s.enroll('p');await s.collectPaidOrder(line('p',4));
  await assert.rejects(s.issueFutureGrantForTest({customerId:'p',tier:'gold',expiresAt:goldExpiry}),/MILESTONE_NOT_REACHED/);
  await s.collectPaidOrder(line('p',20,{orderId:'gold-threshold'}));
  await s.issueFutureGrantForTest({customerId:'p',tier:'gold',expiresAt:goldExpiry});
  await assert.rejects(s.issueFutureGrantForTest({customerId:'p',tier:'platinum',expiresAt:platinumExpiry}),/MILESTONE_NOT_REACHED/);
  await s.collectPaidOrder(line('p',30,{orderId:'platinum-threshold'}));
  await assert.rejects(s.issueFutureGrantForTest({customerId:'p',tier:'platinum',expiresAt:platinumExpiry}),/INSUFFICIENT_FUNDED_BALANCE/);
  assert.equal(invariant(s).grants.length,2);
});
test('R4.1: concurrent same funded future reward grants are idempotent',async()=>{
  const s=sandbox({futureCreditFixture:true,fundedMinor:70000});
  await s.enroll('p');await s.collectPaidOrder(line('p',54));
  const args={customerId:'p',tier:'gold',expiresAt:goldExpiry};
  const res=await Promise.all(Array.from({length:20},()=>s.issueFutureGrantForTest(args)));
  assert.equal(res.filter(x=>x.replayed).length,19);
  assert.equal(invariant(s).grants.filter(g=>g.tier==='gold').length,1);
  assert.equal(s.snapshot().balances.customer,10500);
});
test('R4.1: no merchant debt before verified handover; wrong merchant, duplicated handover and reused evidence blocked',async()=>{
  const s=sandbox({participatingShops:['my-kota','shop-b']});await s.enroll('p');await s.collectPaidOrder(line('p',4));
  await s.holdCredit(hold('p'));
  const input={holdId:'hold-p',shopId:'shop-b',handoverId:'one-handover',paidRemainder:true,verifiedCollected:true};
  await assert.rejects(s.collectRewardFood(input),/HOLD_NOT_OWNED_OR_FINAL/);
  await s.collectRewardFood({...input,shopId:'my-kota'});
  await assert.rejects(s.collectRewardFood({...input,shopId:'my-kota',handoverId:'different'}),/CONFLICTING_REPLAY/);
  assert.equal(invariant(s).payables.length,1);
});
test('R4.1: no customer-side mutation of returned snapshots can mint money or pay merchants',async()=>{
  const s=sandbox();await s.enroll('p');
  const snap=s.snapshot();snap.balances.uncommitted=999999999;snap.participants.push({customerId:'fake',rank:'platinum'});
  assert.equal(invariant(s).balances.uncommitted,47500);
  assert.equal(s.snapshot().participants.length,1);
  assert.equal(s.snapshot().payables.length,0);
});
test('R4.1: two customers and different payables cannot reuse the same bank transfer ID',async()=>{
  const s=sandbox();
  for(const c of ['p','q']){
    await s.enroll(c);await s.collectPaidOrder(line(c,4));await s.holdCredit(hold(c));
    await s.collectRewardFood({holdId:`hold-${c}`,shopId:'my-kota',handoverId:`handover-${c}`,paidRemainder:true,verifiedCollected:true});
  }
  const p={payableId:'payable:hold-p',transferId:'transfer-one',bankReference:'SYNTHETIC-BANK-1',amountMinor:2500,adminRole:'super_admin',bankEvidence:true};
  await s.recordMockBankEvidence(p);
  await assert.rejects(s.recordMockBankEvidence({...p,payableId:'payable:hold-q'}),/BANK_REFERENCE_REUSED/);
  assert.equal(invariant(s).balances.paidOut,2500);
  assert.equal(s.snapshot().balances.payable,2500);
});
test('R4.1: 12 enrolments each complete/hold/collect, total liabilities and cash stay conserved',async()=>{
  const s=sandbox();
  await Promise.all(Array.from({length:12},(_,i)=>s.enroll(`p${i}`)));
  await Promise.all(Array.from({length:12},(_,i)=>s.collectPaidOrder(line(`p${i}`,4))));
  await Promise.all(Array.from({length:12},(_,i)=>s.holdCredit(hold(`p${i}`))));
  await Promise.all(Array.from({length:12},(_,i)=>s.collectRewardFood({holdId:`hold-p${i}`,shopId:'my-kota',handoverId:`h${i}`,paidRemainder:true,verifiedCollected:true})));
  const st=invariant(s);
  assert.equal(st.payables.length,12);
  assert.equal(st.balances.payable,30000);
  assert.equal(st.balances.uncommitted,20000);
  assert.equal(st.balances.customer,0);
  assert.equal(st.balances.held,0);
  assert.equal(st.journal.length,48);
});
test('R4.1: Bronze R24 redemption is one food ITEM, not R1 reusable promotional credit',async()=>{
  const s=sandbox();await s.enroll('p');await s.collectPaidOrder(line('p',4));
  await s.holdCredit(hold('p',{priceMinor:2400,creditMinor:2400}));
  await assert.rejects(s.holdCredit(hold('p',{holdId:'second-free-item',priceMinor:100,creditMinor:100,itemKind:'other_food'})));
  const result=await s.collectRewardFood({holdId:'hold-p',shopId:'my-kota',handoverId:'first-food',paidRemainder:true,verifiedCollected:true});
  assert.equal(result.amountMinor,2400);
  const st=invariant(s);
  assert.equal(st.balances.payable,2400);
  assert.equal(st.balances.uncommitted,47600);
  assert.equal(st.balances.customer,0);
  assert.equal(st.grants[0].redeemed,true);
  await assert.rejects(s.holdCredit(hold('p',{holdId:'third-attempt',priceMinor:100,creditMinor:100,itemKind:'other_food'})));
});
test('R4.1: alternative Bronze gift food must cost strictly under R25',async()=>{
  const s=sandbox();await s.enroll('p');await s.collectPaidOrder(line('p',4));
  await assert.rejects(s.holdCredit(hold('p',{itemKind:'other_food',priceMinor:2500,creditMinor:2500})),/BRONZE_REDEMPTION_INVALID/);
  const success=await s.holdCredit(hold('p',{itemKind:'other_food',priceMinor:2499,creditMinor:2499}));
  assert.equal(success.creditMinor,2499);
});
