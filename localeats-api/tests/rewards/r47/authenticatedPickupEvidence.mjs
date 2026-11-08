/**
 * R4.7 AUTHENTICATED PICKUP EVIDENCE REHEARSAL — TEST-ONLY.
 * NEVER import into src/, mount a route, or pass two users' ID tokens to
 * one live endpoint. The two simulated headers model TWO DISTINCT HTTPS
 * actor requests recorded at different times. A real reader must verify
 * the identities independently when each event is persisted, and use
 * immutable DB attribution, not browser-supplied user objects.
 *
 * Uses actual compiled LocalEats financeActor, trustedEvidence and
 * merchantCommandReceipt functions, but injected token validator and
 * database snapshots are FAKE. No real Firebase project, cash, credit,
 * R2.1 rewards, SQL write, bank or Production access.
 */
import {verifyFinancialActor} from '../../../dist/rewards/financeActor.js';
import {verifyCollectedKotaEvidence} from '../../../dist/rewards/trustedEvidence.js';
import {merchantCommandReceipt} from '../../../dist/orders/pickupService.js';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const bad=code=>{throw new Error('R47_'+code);};
const object=(x,code)=>x&&typeof x==='object'&&!Array.isArray(x)?x:bad(code);
const str=x=>typeof x==='string'&&x.length>0&&x.length<=160&&x===x.trim()&&!/[\x00-\x1f\x7f]/.test(x);
const time=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\dT/.test(x)&&Number.isFinite(Date.parse(x));
const before=(a,b)=>time(a)&&time(b)&&Date.parse(a)<=Date.parse(b);

/**
 * Simulates:
 * 1. An authenticated shop-owner action checked at payment/collection time;
 * 2. A separate authenticated customer action checked at pickup-code
 *    consumption time;
 * 3. One consistent PRIVATE read snapshot with genuine-looking records.
 * This is NOT a real simultaneous dual-token API design.
 */
export function createR47TestOnlyAuthAdapter({verifyIdToken,store}={}) {
  if(typeof verifyIdToken!=='function'||!store||
     typeof store.readOnlySnapshot!=='function')bad('MISSING_VERIFIED_ADAPTER');
  return Object.freeze({
    async inspectSimulatedEvents({merchantAuthorization,customerAuthorization,orderId,...unsupported}={}) {
      if(Object.keys(unsupported).length)bad('CLIENT_FINANCIAL_CLAIMS_FORBIDDEN');
      if(typeof orderId!=='string'||!UUID.test(orderId))bad('INVALID_ORDER_ID');
      // The actual financial helper calls verifyIdToken(token, true).
      const [merchant,customer]=await Promise.all([
        verifyFinancialActor(merchantAuthorization,verifyIdToken),
        verifyFinancialActor(customerAuthorization,verifyIdToken)
      ]);
      if(merchant.uid===customer.uid)bad('SEPARATE_MERCHANT_CUSTOMER_REQUIRED');
      return store.readOnlySnapshot(async(tx)=>{
        if(!tx||typeof tx.readBundle!=='function')bad('PRIVATE_READER_REQUIRED');
        const b=object(await tx.readBundle(orderId),'BUNDLE_NOT_FOUND');
        if(b.origin!=='synthetic-r47-private-snapshot')bad('NO_SERVER_OWNED_EVIDENCE');
        const o=object(b.order,'PERSISTED_ORDER_MISSING');
        const sh=object(b.shop,'SHOP_OWNERSHIP_MISSING');
        const co=object(b.registeredCustomer,'CUSTOMER_REGISTRATION_MISSING');
        const prog=object(b.programmeShop,'PROGRAMME_NOT_PERSISTED');
        const proof=object(b.customerHandoverProof,'CUSTOMER_CONSUMPTION_PROOF_MISSING');
        if(o.id!==orderId||o.user_id!==customer.uid||!str(o.shop_id)||
           o.delivery_type!=='collection'||o.payment_status!=='paid'||
           o.status!=='collected'||o.test_record!==false||
           o.simulated_checkout!==false||!time(o.created_at)||
           !Number.isSafeInteger(o.revision)||o.revision<2||
           !/^[a-f0-9]{64}$/i.test(o.create_intent_hash??''))
           bad('ORDER_CUSTOMER_IDENTITY_OR_PAYMENT_INVALID');
        if(sh.id!==o.shop_id||sh.owner_id!==merchant.uid||
           sh.approval_status!=='approved'||sh.archived_at!==null||
           prog.shop_id!==o.shop_id||prog.approval_status!=='approved'||
           prog.participating_at_purchase!==true||
           !before(prog.shop_approved_at,o.created_at)||
           !before(prog.rewards_started_at,o.created_at))
           bad('APPROVED_SHOP_SCOPE_OR_PROGRAMME_MISSING');
        if(co.uid!==customer.uid||co.registered!==true||
           co.anonymous!==false||co.test_account!==false)
           bad('REGISTERED_CUSTOMER_REQUIRED');
        if(!Array.isArray(b.pickupEvents)||b.pickupEvents.length<2)
           bad('PRIVATE_COMMAND_HISTORY_MISSING');
        const paid=b.pickupEvents.find(e=>e?.kind==='payment_confirmed');
        const collected=b.pickupEvents.find(e=>e?.kind==='collected');
        if(!paid||!collected)bad('PRIVATE_PAYMENT_COLLECTION_COMMANDS_MISSING');
        // Use actual pickup-service command receipt validation; also bind
        // merchant UID, order, revision and command IDs to the owner.
        const pRec=merchantCommandReceipt({order:o,event:paid});
        const cRec=merchantCommandReceipt({order:o,event:collected});
        const ids=b.pickupEvents.map(e=>e?.command_id);
        const revs=b.pickupEvents.map(e=>e?.revision);
        if(pRec.kind!=='payment_confirmed'||cRec.kind!=='collected'||
           pRec.actor_uid!==merchant.uid||cRec.actor_uid!==merchant.uid||
           pRec.order_id!==orderId||cRec.order_id!==orderId||
           pRec.revision>=cRec.revision||cRec.revision!==o.revision||
           ids.length!==new Set(ids).size||revs.length!==new Set(revs).size||
           !before(o.created_at,paid.occurred_at)||
           !before(paid.occurred_at,collected.occurred_at))
           bad('MERCHANT_COMMAND_ACTOR_OR_REVISION_MISMATCH');
        if(proof.order_id!==orderId||proof.customer_uid!==customer.uid||
           proof.shop_id!==o.shop_id||proof.collected_command_id!==cRec.command_id||
           proof.source!=='synthetic-server-consumed-authenticated-customer-code'||
           proof.authenticated_consumer_uid!==customer.uid||
           proof.used_once!==true||proof.revoked!==false||
           !str(proof.consumption_receipt)||!time(proof.issued_at)||
           !time(proof.expires_at)||!time(proof.consumed_at)||
           !before(proof.issued_at,proof.consumed_at)||
           !before(proof.consumed_at,proof.expires_at)||
           !before(paid.occurred_at,proof.consumed_at)||
           !before(proof.consumed_at,collected.occurred_at)||
           Object.keys(proof).some(k=>/^(pin|rawCode|plaintext|secret|otp)$/i.test(k)))
           bad('INDEPENDENT_CUSTOMER_AUTH_AND_HANDOVER_REQUIRED');
        if(!Array.isArray(b.verifiedRefunds))bad('FULL_REFUND_HISTORY_REQUIRED');
        if(!Array.isArray(b.eligibilitySnapshots)||
           !Array.isArray(o.items)||
           b.eligibilitySnapshots.length!==o.items.length)
           bad('IMMUTABLE_CHECKOUT_ELIGIBILITY_REQUIRED');
        for(let i=0;i<o.items.length;i++) {
          const line=object(o.items[i],'CHECKOUT_LINE_MISSING');
          const e=object(b.eligibilitySnapshots[i],'CHECKOUT_PROOF_MISSING');
          if(!str(line.menu_item_id)||!Number.isSafeInteger(line.quantity)||
             line.quantity<1||line.quantity>100||
             e.line_index!==i||e.order_id!==orderId||
             e.shop_id!==o.shop_id||e.menu_item_id!==line.menu_item_id||
             e.programme_version!==prog.programme_version||
             e.proof_source!=='server-persisted-at-purchase'||
             e.immutable!==true||e.reward_funded!==false||
             (e.qualifying_kota!==true&&e.qualifying_kota!==false)||
             !before(e.snapshot_at,o.created_at))
             bad('IMMUTABLE_QUALIFYING_PURCHASE_PROOF_MISSING');
        }
        // Test-only inert guard. It returns an eligible line candidate, not
        // a grant. Reuse the original private bundle under this SAME tx.
        const candidate=await verifyCollectedKotaEvidence({
          readCollectedOrderBundle:async id=>{
            if(id!==orderId)bad('CROSS_ORDER_READ_FORBIDDEN');
            return {order:o,programmeShop:prog,registeredCustomer:co,
              pickupEvents:b.pickupEvents,
              eligibilitySnapshots:b.eligibilitySnapshots,
              verifiedRefunds:b.verifiedRefunds};
          },
          readMerchantReceiptBundle:async()=>bad('RECEIPT_NOT_AVAILABLE'),
          readAdminTransferBundle:async()=>bad('BANK_NOT_AVAILABLE'),
          readRefundReviewBundle:async()=>bad('REFUND_WRITES_NOT_AVAILABLE')
        },orderId);
        const units=candidate.lines.reduce((sum,line)=>sum+line.quantity,0);
        if(!Number.isSafeInteger(units)||units<1)bad('NO_ELIGIBLE_PAID_KOTAS');
        return Object.freeze({
          mode:'r47-double-identity-synthetic-review-only',
          orderId,merchantUid:merchant.uid,customerUid:customer.uid,
          shopId:candidate.shopId,qualifyingBoughtKotas:units,
          canGrant:false,canReserve:false,canReimburse:false,
          canActivate:false,canReadProduction:false
        });
      });
    }
  });
}
