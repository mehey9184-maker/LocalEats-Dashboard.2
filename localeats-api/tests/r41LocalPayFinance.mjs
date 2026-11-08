// LocalPay R4.1 — SYNTHETIC-ONLY financial security rehearsal.
 // This file belongs ONLY under localeats-api/tests/, not imported by apps,
 // routes, workers, DB adapters, bank services or Production startup.
 // ALL "verified" inputs are mock fixtures, NOT real-world verification.
 // In-memory serialization protects only this test instance, NOT processes.
const fail = code => { throw new Error(`R41_${code}`); };
const requireThat = (condition, code) => { if (!condition) fail(code); };
const id = s => typeof s === 'string' && s.length > 0 && s.length <= 160 &&
  s.trim() === s && !/[\x00-\x1f\x7f]/.test(s);
const minor = value => Number.isSafeInteger(value) && value > 0 && value <= 1_000_000;
const copy = value => structuredClone(value);
const accounts = ['uncommitted','reserved','customer','held','payable','paidOut'];
const emptyAccounts = funded => ({uncommitted:funded,reserved:0,customer:0,held:0,payable:0,paidOut:0});
const stable = x => JSON.stringify(x);

export class SyntheticLocalPayR41 {
  #s;
  #queue = Promise.resolve();
  constructor({syntheticFixture, fundedMinor=0, participantCap=12, participatingShops=['my-kota'], futureCreditFixture=false}={}) {
    requireThat(syntheticFixture === 'R41_TEST_ONLY', 'TEST_FIXTURE_REQUIRED');
    requireThat(Number.isSafeInteger(fundedMinor) && fundedMinor>=0 && fundedMinor<=10_000_000, 'INVALID_TEST_FUNDING');
    requireThat(Number.isSafeInteger(participantCap) && participantCap>=1 && participantCap<=100, 'INVALID_CAP');
    requireThat(Array.isArray(participatingShops) && participatingShops.length>0 && participatingShops.every(id), 'INVALID_SHOPS');
    this.#s = {
      fundedMinor,participantCap,shops:new Set(participatingShops),futureCreditFixture:futureCreditFixture===true,
      balances:emptyAccounts(fundedMinor),participants:new Map(),orders:new Map(),grants:new Map(),
      holds:new Map(),payables:new Map(),transfers:new Map(),transferReferences:new Set(),bankReferences:new Set(),
      handoverReferences:new Set(),replays:new Map(),journal:[],
    };
    this.#invariant(this.#s);
  }
  snapshot(){
    const s=this.#s;
    return copy({
      mode:'synthetic-only',fundedMinor:s.fundedMinor,participantCap:s.participantCap,
      balances:s.balances,participants:[...s.participants.values()],orders:[...s.orders.values()],
      grants:[...s.grants.values()],holds:[...s.holds.values()],payables:[...s.payables.values()],
      transfers:[...s.transfers.values()],journal:s.journal,
    });
  }
  #move(s,from,to,amount,kind,reference){
    requireThat(accounts.includes(from) && accounts.includes(to) && from!==to, 'INVALID_JOURNAL_ACCOUNTS');
    requireThat(minor(amount) && s.balances[from]>=amount, 'INSUFFICIENT_FUNDED_BALANCE');
    s.balances[from]-=amount;
    s.balances[to]+=amount;
    requireThat(Number.isSafeInteger(s.balances[to]),'BALANCE_OVERFLOW');
    s.journal.push({seq:s.journal.length+1,from,to,minor:amount,kind,reference});
  }
  #invariant(s){
    let sum=0;
    for(const k of accounts){
      const v=s.balances[k];
      requireThat(Number.isSafeInteger(v) && v>=0,'NEGATIVE_OR_INVALID_BALANCE');
      sum+=v;
    }
    requireThat(sum===s.fundedMinor && Number.isSafeInteger(sum),'FUNDING_CONSERVATION_BROKEN');
    requireThat(s.participants.size<=s.participantCap,'COHORT_CAP_BROKEN');
    const g=[...s.grants.values()];
    requireThat(g.every(l=>Number.isSafeInteger(l.availableMinor)&&l.availableMinor>=0&&
      Number.isSafeInteger(l.heldMinor)&&l.heldMinor>=0),'GRANT_LOT_NEGATIVE');
    requireThat(g.reduce((n,l)=>n+l.availableMinor,0)===s.balances.customer,'CUSTOMER_LIABILITY_MISMATCH');
    requireThat(g.reduce((n,l)=>n+l.heldMinor,0)===s.balances.held,'HELD_LIABILITY_MISMATCH');
    requireThat([...s.payables.values()].filter(x=>x.status==='owed').reduce((n,p)=>n+p.amountMinor,0)===s.balances.payable,'MERCHANT_LIABILITY_MISMATCH');
    requireThat([...s.transfers.values()].reduce((n,t)=>n+t.amountMinor,0)===s.balances.paidOut,'BANK_EVIDENCE_TOTAL_MISMATCH');
    requireThat(s.journal.every((e,i)=>e.seq===i+1 && minor(e.minor) && accounts.includes(e.from) && accounts.includes(e.to)),'INVALID_JOURNAL');
  }
  async #act(kind,key,payload,work){
    requireThat(id(key),'INVALID_IDEMPOTENCY_KEY');
    const previous=this.#queue;
    let release;
    this.#queue = new Promise(resolve=>{release=resolve;});
    await previous;
    try{
      const replayKey=`${kind}\u001f${key}`;
      const existing=this.#s.replays.get(replayKey);
      if(existing){
        requireThat(existing.fingerprint===stable(payload),'CONFLICTING_REPLAY');
        return {...copy(existing.receipt),replayed:true};
      }
      const next=copy(this.#s);
      const receipt=work(next);
      this.#invariant(next);
      next.replays.set(replayKey,{fingerprint:stable(payload),receipt:copy(receipt)});
      this.#s=next;
      return {...copy(receipt),replayed:false};
    } finally {release();}
  }
  enroll(customerId){
    return this.#act('enroll',customerId,{customerId},s=>{
      requireThat(id(customerId),'INVALID_CUSTOMER');
      requireThat(!s.participants.has(customerId),'CUSTOMER_ALREADY_ENROLLED');
      requireThat(s.participants.size<s.participantCap,'COHORT_FULL');
      this.#move(s,'uncommitted','reserved',2500,'bronze-admission',customerId);
      s.participants.set(customerId,{customerId,eligiblePaidUnits:0,rank:'bronze',bronzeIssued:false});
      return {customerId,reservedMinor:2500,participants:s.participants.size};
    });
  }
  // Inputs are TEST DATA, not an HTTP schema; real proof MUST be DB-derived.
  collectPaidOrder({orderId,lineId,customerId,shopId,quantity,paid,collected,eligibleKota,
    simulated=false,refunded=false,rewardFunded=false}={}) {
    const payload={orderId,lineId,customerId,shopId,quantity,paid,collected,eligibleKota,simulated,refunded,rewardFunded};
    return this.#act('purchase',JSON.stringify([orderId,lineId]),payload,s=>{
      requireThat([orderId,lineId,customerId,shopId].every(id),'INVALID_PURCHASE_ID');
      requireThat(Number.isSafeInteger(quantity)&&quantity>=1&&quantity<=100,'INVALID_QUANTITY');
      requireThat(paid===true&&collected===true&&eligibleKota===true&&simulated===false&&
        refunded===false&&rewardFunded===false,'NOT_A_REAL_PAID_COLLECTED_KOTA');
      requireThat(s.shops.has(shopId),'SHOP_NOT_PARTICIPATING');
      const person=s.participants.get(customerId);
      requireThat(!!person,'CUSTOMER_NOT_ENROLLED');
      requireThat(!s.orders.has(JSON.stringify([orderId,lineId])),'DUPLICATE_PURCHASE_LINE');
      person.eligiblePaidUnits+=quantity;
      requireThat(Number.isSafeInteger(person.eligiblePaidUnits),'UNIT_OVERFLOW');
      s.orders.set(JSON.stringify([orderId,lineId]),payload);
      if(!person.bronzeIssued&&person.eligiblePaidUnits>=4){
        const grantId=`${customerId}:bronze:once`;
        requireThat(!s.grants.has(grantId),'DUPLICATE_BRONZE_GRANT');
        this.#move(s,'reserved','customer',2500,'bronze-earned',grantId);
        s.grants.set(grantId,{grantId,customerId,tier:'bronze',initialMinor:2500,availableMinor:2500,
          heldMinor:0,expiresAt:null,redeemed:false});
        person.bronzeIssued=true;
        person.rank='silver';
      }
      // Future Gold/Platinum missions are NOT activated under Bronze-only pilot,
      // even if 54+ ordinary eligible purchased kota units are measured.
      return {customerId,qualifyingUnits:person.eligiblePaidUnits,rank:person.rank,
        bronzeIssued:person.bronzeIssued,grantCount:s.grants.size};
    });
  }
  // Future-credit fixture exists ONLY to test spend mechanics, never Bronze-only.
  issueFutureGrantForTest({customerId,tier,expiresAt}={}){
    const payload={customerId,tier,expiresAt};
    return this.#act('future-grant',`${customerId}:${tier}`,payload,s=>{
      requireThat(s.futureCreditFixture,'FUTURE_REWARDS_INACTIVE');
      requireThat(id(customerId) && ['gold','platinum'].includes(tier),'INVALID_FUTURE_GRANT');
      const p=s.participants.get(customerId);
      requireThat(!!p && p.bronzeIssued,'BRONZE_NOT_COMPLETED');
      requireThat(p.eligiblePaidUnits>=(tier==='gold'?24:54),'MILESTONE_NOT_REACHED');
      if(tier==='platinum')requireThat(s.grants.has(`${customerId}:gold:once`),'GOLD_GRANT_REQUIRED');
      requireThat(typeof expiresAt==='string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.000Z$/.test(expiresAt)
        && Number.isFinite(Date.parse(expiresAt)),'INVALID_EXPIRY_FIXTURE');
      const amount=tier==='gold'?8000:15000;
      const grantId=`${customerId}:${tier}:once`;
      requireThat(!s.grants.has(grantId),'DUPLICATE_GRANT');
      this.#move(s,'uncommitted','customer',amount,'future-funded-fixture-only',grantId);
      s.grants.set(grantId,{grantId,customerId,tier,initialMinor:amount,
        availableMinor:amount,heldMinor:0,expiresAt,redeemed:false});
      if(tier==='gold')p.rank='gold'; else p.rank='platinum';
      return {grantId,amountMinor:amount,rank:p.rank};
    });
  }
  holdCredit({holdId,customerId,shopId,orderId,priceMinor,creditMinor,itemKind='standard_kota',nowIso}={}){
    const payload={holdId,customerId,shopId,orderId,priceMinor,creditMinor,itemKind,nowIso};
    return this.#act('hold',holdId,payload,s=>{
      requireThat([holdId,customerId,shopId,orderId].every(id),'INVALID_HOLD');
      requireThat(s.shops.has(shopId),'SHOP_NOT_PARTICIPATING');
      requireThat(minor(priceMinor)&&minor(creditMinor)&&creditMinor<=priceMinor,'INVALID_HOLD_AMOUNT');
      requireThat(typeof nowIso==='string'&&Number.isFinite(Date.parse(nowIso)),'INVALID_FIXTURE_TIME');
      requireThat(!s.holds.has(holdId),'HOLD_EXISTS');
      // Bronze one-time ITEM is not a fungible part of Gold/Platinum food credit.
      const bronzeRedemption=!s.futureCreditFixture || itemKind==='bronze_gift';
      const lots=[...s.grants.values()].filter(g=>g.customerId===customerId &&
        (bronzeRedemption?g.tier==='bronze':g.tier!=='bronze') && g.availableMinor>0 &&
        (!g.expiresAt || Date.parse(g.expiresAt)>Date.parse(nowIso)));
      const bronze=lots.filter(l=>l.tier==='bronze');
      if(bronzeRedemption){
        requireThat(bronze.length===1 && bronze[0].redeemed!==true &&
          ![...s.holds.values()].some(h=>h.customerId===customerId && h.status==='held' &&
            h.components.some(x=>x.grantId===bronze[0].grantId)),'BRONZE_GIFT_ALREADY_USED_OR_HELD');
        requireThat(bronze.length===1 && creditMinor===priceMinor && priceMinor<=2500 &&
          (itemKind==='standard_kota'||itemKind==='other_food'||itemKind==='bronze_gift') &&
          (itemKind!=='other_food'||priceMinor<2500),'BRONZE_REDEMPTION_INVALID');
      }
      lots.sort((a,b)=>(a.expiresAt?Date.parse(a.expiresAt):Infinity)-
        (b.expiresAt?Date.parse(b.expiresAt):Infinity)||a.grantId.localeCompare(b.grantId));
      let missing=creditMinor; const components=[];
      for(const g of lots){
        if(missing===0)break;
        const amount=Math.min(missing,g.availableMinor);
        g.availableMinor-=amount;g.heldMinor+=amount;missing-=amount;
        components.push({grantId:g.grantId,amountMinor:amount});
      }
      requireThat(missing===0,'CREDIT_UNAVAILABLE');
      this.#move(s,'customer','held',creditMinor,'hold',holdId);
      const h={holdId,customerId,shopId,orderId,priceMinor,creditMinor,
        remainderMinor:priceMinor-creditMinor,status:'held',components};
      s.holds.set(holdId,h);
      return {holdId,creditMinor,remainderMinor:h.remainderMinor,components};
    });
  }
  cancelHold({holdId,reason}={}){
    const payload={holdId,reason};
    return this.#act('cancel',holdId,payload,s=>{
      requireThat(id(reason),'INVALID_CANCEL_REASON');
      const h=s.holds.get(holdId);
      requireThat(h?.status==='held','HOLD_NOT_CANCELLABLE');
      for(const item of h.components){
        const g=s.grants.get(item.grantId);
        g.heldMinor-=item.amountMinor;g.availableMinor+=item.amountMinor;
      }
      h.status='cancelled';
      this.#move(s,'held','customer',h.creditMinor,'hold-cancelled',holdId);
      return {holdId,releasedMinor:h.creditMinor};
    });
  }
  collectRewardFood({holdId,shopId,paidRemainder,verifiedCollected,handoverId}={}){
    const payload={holdId,shopId,paidRemainder,verifiedCollected,handoverId};
    return this.#act('handover',holdId,payload,s=>{
      requireThat([holdId,shopId,handoverId].every(id),'INVALID_HANDOVER');
      const h=s.holds.get(holdId);
      requireThat(h?.status==='held' && h.shopId===shopId,'HOLD_NOT_OWNED_OR_FINAL');
      requireThat(paidRemainder===true && verifiedCollected===true,'PICKUP_AND_PAYMENT_PROOF_REQUIRED');
      requireThat(!s.handoverReferences.has(handoverId),'HANDOVER_REUSED');
      for(const item of h.components){
        const g=s.grants.get(item.grantId);g.heldMinor-=item.amountMinor;
        if(g.tier==='bronze'){
          g.redeemed=true; // One ITEM, not divisible R25 spendable credit.
          if(g.availableMinor>0){
            const unusedCap=g.availableMinor;
            g.availableMinor=0;
            this.#move(s,'customer','uncommitted',unusedCap,'unused-bronze-item-cap',holdId);
          }
        }
      }
      this.#move(s,'held','payable',h.creditMinor,'collected-to-merchant',holdId);
      h.status='captured';s.handoverReferences.add(handoverId);
      const payableId=`payable:${holdId}`;
      s.payables.set(payableId,{payableId,holdId,shopId,amountMinor:h.creditMinor,status:'owed',transferId:null,receiptId:null});
      return {payableId,amountMinor:h.creditMinor,remainderPaidMinor:h.remainderMinor};
    });
  }
  recordMockBankEvidence({payableId,transferId,bankReference,amountMinor,adminRole,bankEvidence}={}){
    const payload={payableId,transferId,bankReference,amountMinor,adminRole,bankEvidence};
    return this.#act('bank',payableId,payload,s=>{
      requireThat([payableId,transferId,bankReference].every(id),'INVALID_BANK_REFERENCE');
      requireThat(adminRole==='super_admin'&&bankEvidence===true,'ADMIN_AND_BANK_PROOF_REQUIRED');
      const p=s.payables.get(payableId);
      requireThat(p?.status==='owed','PAYABLE_NOT_OWED');
      requireThat(p.amountMinor===amountMinor,'TRANSFER_AMOUNT_MISMATCH');
      requireThat(!s.transferReferences.has(transferId) && !s.bankReferences.has(bankReference),'BANK_REFERENCE_REUSED');
      this.#move(s,'payable','paidOut',amountMinor,'bank-proof-fixture',payableId);
      p.status='sent';p.transferId=transferId;
      s.transferReferences.add(transferId);s.bankReferences.add(bankReference);
      s.transfers.set(transferId,{transferId,payableId,bankReference,amountMinor});
      return {payableId,transferId,status:'sent-not-merchant-confirmed'};
    });
  }
  merchantReceipt({payableId,shopId,receiptId,received}={}){
    const payload={payableId,shopId,receiptId,received};
    return this.#act('receipt',payableId,payload,s=>{
      requireThat([payableId,shopId,receiptId].every(id),'INVALID_RECEIPT');
      const p=s.payables.get(payableId);
      requireThat(p?.shopId===shopId,'MERCHANT_FORBIDDEN');
      requireThat(p.status==='sent','BANK_PAYMENT_NOT_RECORDED');
      requireThat(typeof received==='boolean','INVALID_RECEIPT_DECISION');
      p.status=received?'confirmed':'disputed';p.receiptId=receiptId;
      return {payableId,status:p.status};
    });
  }
}
export const newR41TestSandbox = options => new SyntheticLocalPayR41(options);
