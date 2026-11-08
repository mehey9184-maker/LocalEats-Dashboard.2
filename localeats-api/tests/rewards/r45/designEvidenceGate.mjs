/**
 * R4.5 DESIGN-ONLY, TEST-SOURCE EVIDENCE CONTRACT. NOT production code.
 * This module is never imported by API src/ or mounted in Express.
 * Source labels, "reconciled" or "verified" fixture booleans here are NOT
 * proof of actual owner funding, Firebase authentication or physical payment.
 * No callback, database access, network, payout, balance or reward write.
 */
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const id=x=>typeof x==='string' && x.length>0 && x.length<=160 && x===x.trim() && !/[\x00-\x1f\x7f]/.test(x);
const hex=x=>typeof x==='string' && /^[a-f0-9]{64}$/i.test(x);
const money=x=>Number.isSafeInteger(x)&&x>=0&&x<=1_000_000;
const units=x=>Number.isSafeInteger(x)&&x>=1&&x<=100;
const t=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\dT/.test(x)&&Number.isFinite(Date.parse(x));
const before=(a,b)=>t(a)&&t(b)&&Date.parse(a)<=Date.parse(b);
const strictAfter=(a,b)=>t(a)&&t(b)&&Date.parse(a)>Date.parse(b);
const uid=x=>id(x);
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);

export function inspectR45ProposedEvidence(bundle) {
  const blockers=new Set();
  const block=code=>blockers.add(code);
  const out=(qualifyingUnits=0)=>Object.freeze({
    mode:'r45-design-fixture-only',
    decision:blockers.size?'BLOCKED_MISSING_OR_INVALID_EVIDENCE':'PASS_CANDIDATE_FOR_FUTURE_REVIEW',
    blockers:Object.freeze([...blockers].sort()),
    qualifyingUnits:blockers.size?0:qualifyingUnits,
    canGrant:false,canReserve:false,canReimburse:false,canActivate:false,
  });
  if(!isObj(bundle)||bundle.source!=='synthetic-r45-private-snapshot') {
    block('PRIVATE_SOURCE_UNVERIFIED');return out();
  }
  const {programme:p,funding:f,customer:c,shop:s,order:o,lines,events,
    merchantTill:m,customerHandover:h,refundReview:r}=bundle;
  if(!isObj(p)||p.version!=='bronze-only-v1'||p.active!==true||
     p.pilotCustomers!==12||p.budgetMinor!==50000||
     p.freeFoodCapMinor!==2500||p.goldActive!==false||p.platinumActive!==false||
     !hex(p.termsHash)||!t(p.startsAt)||!t(p.endsAt)||!before(p.startsAt,p.endsAt))
    block('PUBLISHED_BRONZE_ONLY_PROGRAMME_MISSING');
  if(!isObj(f)||f.source!=='synthetic-finance-review'||
     f.reconciled!==true||!id(f.bankEvidenceReference)||
     f.backingMinor!==50000||f.reservedMinor>30000||!money(f.reservedMinor)||
     f.bufferMinor<20000||!money(f.bufferMinor)||
     f.reservedMinor+f.bufferMinor>f.backingMinor||
     !uid(f.reviewerUid)||!t(f.reviewedAt))
    block('ACTUAL_BACKED_FUNDING_MISSING');
  if(!isObj(c)||!uid(c.uid)||c.registered!==true||
     c.anonymous!==false||c.testAccount!==false||c.consent===false||
     !id(c.admissionId)||!hex(c.acceptedTermsHash)||!t(c.enrolledAt))
    block('REGISTERED_ENROLLED_CUSTOMER_MISSING');
  if(!isObj(s)||!id(s.id)||!uid(s.ownerUid)||s.approved!==true||
     s.participating!==true||s.archived!==false||
     s.programmeVersion!=='bronze-only-v1'||!t(s.optedInAt))
    block('ELIGIBLE_PARTICIPATING_SHOP_MISSING');
  if(!isObj(o)||!uuid(o.id)||o.customerUid!==c?.uid||
     o.shopId!==s?.id||o.deliveryType!=='collection'||o.status!=='collected'||
     o.paymentStatus!=='paid'||o.testOrder!==false||
     o.simulated!==false||!hex(o.intentHash)||
     !Number.isSafeInteger(o.revision)||o.revision<2||
     !['cash','card_machine'].includes(o.paymentMethod)||
     !money(o.totalMinor)||!t(o.createdAt))
    block('AUTHORITATIVE_PICKUP_ORDER_MISSING');
  if(isObj(p)&&isObj(o)&&isObj(c)&&isObj(s) &&
     (!before(p.startsAt,o.createdAt)||!before(o.createdAt,p.endsAt)||
      !before(s.optedInAt,o.createdAt)||!before(c.enrolledAt,o.createdAt)||
      c.acceptedTermsHash!==p.termsHash))
     block('RETROACTIVE_OR_UNCONSENTED_PURCHASE');
  if(isObj(f)&&isObj(s)&&f.reviewerUid===s.ownerUid)
    block('FUNDING_INDEPENDENT_REVIEW_MISSING');
  let eligible=0;
  if(!Array.isArray(lines)||lines.length<1||lines.length>100)
    block('IMMUTABLE_PURCHASE_LINES_MISSING');
  else {
    const keys=new Set();
    for(const [index,l] of lines.entries()){
      if(!isObj(l)||!id(l.lineId)||keys.has(l.lineId)||
         l.index!==index||l.orderId!==o?.id||
         l.shopId!==s?.id||!id(l.menuItemId)||!money(l.unitMinor)||
         !units(l.quantity)||!money(l.lineTotalMinor)||
         l.lineTotalMinor!==l.unitMinor*l.quantity||
         l.source!=='synthetic-order-create-transaction'||
         l.immutable!==true||l.programmeVersion!==p?.version||
         l.rewardFunded!==false||!t(l.capturedAt)||
         !before(l.capturedAt,o?.createdAt)||
         ![true,false].includes(l.qualifyingKota))block('IMMUTABLE_PURCHASE_LINES_MISSING');
      if(l?.qualifyingKota===true)eligible+=l.quantity||0;
      if(isObj(l)&&id(l.lineId))keys.add(l.lineId);
    }
  }
  if(!Number.isSafeInteger(eligible)||eligible<1)
    block('NO_ELIGIBLE_KOTA_UNITS');
  if(!Array.isArray(events)||events.length<2)
    block('PAYMENT_AND_COLLECTION_EVENTS_MISSING');
  else {
    const paid=events.find(e=>e?.kind==='payment_confirmed');
    const collected=events.find(e=>e?.kind==='collected');
    const commands=new Set(),revisions=new Set();
    for(const e of events){
      if(!isObj(e)||!uuid(e.commandId)||commands.has(e.commandId)||
         !Number.isSafeInteger(e.revision)||e.revision<1||
         revisions.has(e.revision)||e.orderId!==o?.id||
         e.shopId!==s?.id||e.actorUid!==s?.ownerUid||
         e.actorSource!=='synthetic-revocation-checked-merchant'||
         !t(e.occurredAt)||!before(o?.createdAt,e.occurredAt))
        block('PAYMENT_AND_COLLECTION_EVENTS_UNTRUSTED');
      if(isObj(e)){commands.add(e.commandId);revisions.add(e.revision);}
    }
    if(!paid||!collected||!Number.isSafeInteger(paid.revision)||
       !Number.isSafeInteger(collected.revision)||
       paid.revision>=collected.revision||collected.revision!==o?.revision||
       !before(paid.occurredAt,collected.occurredAt))
       block('PAYMENT_AND_COLLECTION_SEQUENCE_INVALID');
  }
  const paid=Array.isArray(events)?events.find(e=>e?.kind==='payment_confirmed'):null;
  const collected=Array.isArray(events)?events.find(e=>e?.kind==='collected'):null;
  if(!isObj(m)||m.source!=='synthetic-shop-till-attestation'||
     m.orderId!==o?.id||m.commandId!==paid?.commandId||
     m.shopId!==s?.id||m.merchantUid!==s?.ownerUid||
     m.method!==o?.paymentMethod||m.amountMinor!==o?.totalMinor||
     !id(m.receiptReference)||m.disputed!==false||
     !t(m.attestedAt)||!before(paid?.occurredAt,m.attestedAt)||
     !before(m.attestedAt,collected?.occurredAt))
    block('PHYSICAL_TILL_ATTESTATION_UNVERIFIED');
  if(!isObj(h)||h.source!=='synthetic-server-consumed-challenge'||
     h.orderId!==o?.id||h.customerUid!==c?.uid||
     h.shopId!==s?.id||h.collectedCommandId!==collected?.commandId||
     !id(h.challengeId)||h.consumed!==true||
     !t(h.issuedAt)||!t(h.expiresAt)||!t(h.consumedAt)||
     !before(h.issuedAt,h.consumedAt)||!before(h.consumedAt,h.expiresAt)||
     !before(paid?.occurredAt,h.consumedAt)||
     !before(h.consumedAt,collected?.occurredAt)||
     !Number.isSafeInteger(h.attempts)||h.attempts<1||
     !Number.isSafeInteger(h.maxAttempts)||h.maxAttempts>5||h.attempts>h.maxAttempts||
     !id(h.consumptionReceiptId)||
     Object.keys(h||{}).some(k=>/^(pin|secret|plaintext|rawCode|otp)$/i.test(k)))
    block('INDEPENDENT_CUSTOMER_HANDOVER_UNVERIFIED');
  if(!isObj(r)||r.source!=='synthetic-private-refund-review'||
     r.orderId!==o?.id||r.complete!==true||
     !Array.isArray(r.events)||r.events.length>0)
    block('REFUND_OR_DISPUTE_REVIEW_REQUIRED');
  if(isObj(o)&&Array.isArray(lines)&&lines.every(isObj)){
    const total=lines.reduce((n,x)=>n+(Number.isSafeInteger(x.lineTotalMinor)?x.lineTotalMinor:0),0);
    if(total!==o.totalMinor)block('AUTHORITATIVE_TOTAL_MISMATCH');
  }
  return out(eligible);
}
