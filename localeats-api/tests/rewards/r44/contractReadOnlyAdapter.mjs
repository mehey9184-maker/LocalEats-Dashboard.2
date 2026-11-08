/**
 * LocalPay R4.4: Test-only read-only bridge against the CURRENT pickup API types.
 * NO Supabase client, no HTTP router, no write/credit functions, no Production calls.
 * The injected store/verifier are SYNTHETIC fixtures. A test-only "verified"
 * flag does NOT prove actual Firebase revocation or physical cash collection.
 */
import { verifyFinancialActor } from '../../../dist/rewards/financeActor.js';
import { verifyCollectedKotaEvidence } from '../../../dist/rewards/trustedEvidence.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = code => { throw new Error('R44_' + code); };
const obj = (x,code) => x && typeof x === 'object' && !Array.isArray(x) ? x : fail(code);
const str = x => typeof x === 'string' && x.length>0 && x.length<=160 && x===x.trim() && !/[\x00-\x1f\x7f]/.test(x);
const validTime = x => typeof x === 'string' && /^\d{4}-\d\d-\d\dT/.test(x) && Number.isFinite(Date.parse(x));
const date = x => Date.parse(x);

/**
 * Intentionally accepts only:
 *  - server-verified authorization header + an injected verifier,
 *  - an id, not a client-supplied order/pay/shop/customer object,
 *  - a single read-only snapshot callback, not separate unfenced queries.
 * Is NEVER imported by src/. It returns candidate information for review only.
 */
export function createR44InertPickupInspector(deps) {
  if(!deps || typeof deps.verifyIdToken!=='function' ||
     !deps.store || typeof deps.store.readOnlySnapshot!=='function') fail('MISSING_READ_ONLY_DEPENDENCIES');
  const verifyIdToken = deps.verifyIdToken;
  const store = deps.store;
  return Object.freeze({
    async inspect(authorizationHeader,orderId) {
      if(!uuid.test(orderId))fail('INVALID_ORDER_UUID');
      const actor=await verifyFinancialActor(authorizationHeader,verifyIdToken);
      return store.readOnlySnapshot(async tx => {
        if(typeof tx.readRewardEvidenceBundle!=='function')fail('READER_MISSING');
        const b=obj(await tx.readRewardEvidenceBundle(orderId),'PRIVATE_SNAPSHOT_UNAVAILABLE');
        // A source flag is just a test assertion; real authority must come from
        // a trusted server-owned transaction and privilege checks, not this string.
        if(b.source!=='synthetic-server-readonly-snapshot')fail('SOURCE_NOT_INDEPENDENT');
        const order=obj(b.order,'PERSISTED_PICKUP_ORDER_MISSING');
        const shop=obj(b.shop,'PERSISTED_OWNER_SHOP_MISSING');
        const customer=obj(b.registeredCustomer,'REGISTERED_CUSTOMER_MISSING');
        const programme=obj(b.programmeShop,'PROGRAMME_SNAPSHOT_MISSING');
        const code=obj(b.customerHandoverProof,'INDEPENDENT_PICKUP_PROOF_MISSING');

        if(order.id!==orderId || order.delivery_type!=='collection' ||
           order.status!=='collected' || order.payment_status!=='paid' ||
           order.test_record!==false || order.simulated_checkout!==false ||
           typeof order.create_intent_hash!=='string' ||
           !/^[a-f0-9]{64}$/i.test(order.create_intent_hash) ||
           !Number.isSafeInteger(order.revision) || order.revision<2)
          fail('PICKUP_ORDER_NOT_TRUSTWORTHY');
        if(!str(order.shop_id) || !str(order.user_id) || !validTime(order.created_at) ||
           shop.id!==order.shop_id || shop.owner_id!==actor.uid ||
           shop.approval_status!=='approved' || shop.archived_at!==null)
          fail('MERCHANT_SHOP_OWNERSHIP_MISMATCH');
        if(programme.shop_id!==order.shop_id || customer.uid!==order.user_id)
          fail('PURCHASE_OWNER_PROGRAMME_MISMATCH');
        if(!Array.isArray(b.pickupEvents) || b.pickupEvents.length<2 ||
           !b.pickupEvents.every(x=>x && typeof x==='object' && !Array.isArray(x)))
          fail('PICKUP_COMMAND_LOG_INCOMPLETE');
        const events = b.pickupEvents;
        const revisions = new Set(), commandIds = new Set();
        for(const e of events){
          if(e.order_id!==orderId || !uuid.test(e.command_id) ||
             !Number.isSafeInteger(e.revision) || e.revision<1 ||
             !str(e.actor_uid) || !validTime(e.occurred_at) ||
             revisions.has(e.revision) || commandIds.has(e.command_id) ||
             e.revision>order.revision)
             fail('COMMAND_RECEIPT_SCHEMA_INCOMPLETE');
          revisions.add(e.revision);
          commandIds.add(e.command_id);
        }
        const paid=events.find(e=>e.kind==='payment_confirmed');
        const collected=events.find(e=>e.kind==='collected');
        if(!paid || !collected || paid.actor_uid!==actor.uid ||
           collected.actor_uid!==actor.uid ||
           paid.revision>=collected.revision ||
           collected.revision!==order.revision ||
           date(paid.occurred_at)<date(order.created_at) ||
           date(collected.occurred_at)<date(paid.occurred_at))
          fail('COLLECTION_AND_PAYMENT_COMMAND_MISMATCH');
        // Existing pickup collect only has handover_confirmed:true; no real
        // separately verified customer-code evidence is currently persisted.
        if(code.order_id!==orderId || code.customer_uid!==order.user_id ||
           code.shop_id!==order.shop_id ||
           code.collected_command_id!==collected.command_id ||
           code.source!=='server-consumed-single-use-customer-code' ||
           code.verified!==true || !validTime(code.verified_at) ||
           date(code.verified_at)<date(paid.occurred_at) ||
           date(code.verified_at)>date(collected.occurred_at))
          fail('INDEPENDENT_PICKUP_PROOF_UNVERIFIED');

        // Real StoredOrder.items are JSONB pricing lines. They are NOT
        // themselves immutable programme eligibility at purchase.
        if(!Array.isArray(order.items) || !Array.isArray(b.eligibilitySnapshots) ||
           b.eligibilitySnapshots.length!==order.items.length)
          fail('ELIGIBILITY_SNAPSHOT_NOT_PERSISTED');
        for(let i=0;i<order.items.length;i++){
          const line=obj(order.items[i],'PERSISTED_PICKUP_LINE_INVALID');
          const proof=obj(b.eligibilitySnapshots[i],'PURCHASE_TIME_REWARDS_LINE_MISSING');
          if(!str(line.menu_item_id) ||
             !Number.isSafeInteger(line.quantity) || line.quantity<1 || line.quantity>100 ||
             typeof line.unit_price!=='number' || line.unit_price<0 ||
             !Number.isSafeInteger(Math.round(line.unit_price*100)) ||
             typeof line.line_total!=='number' ||
             Math.round(line.line_total*100)!==Math.round(line.unit_price*line.quantity*100) ||
             proof.proof_source!=='server-persisted-at-purchase' ||
             proof.immutable!==true || proof.order_id!==orderId ||
             proof.menu_item_id!==line.menu_item_id ||
             proof.line_index!==i || proof.shop_id!==order.shop_id ||
             proof.programme_version!==programme.programme_version ||
             proof.reward_funded!==false ||
             (proof.qualifying_kota!==true && proof.qualifying_kota!==false))
             fail('IMMUTABLE_REWARDS_ITEM_NOT_CONFIRMED');
        }
        if(!Array.isArray(b.verifiedRefunds))
          fail('REFUND_HISTORY_NOT_READ');
        // This existing read-only validator does NOT write. A future reader
        // must be one DB transaction and supply FULL source truth.
        const result=await verifyCollectedKotaEvidence({
          readCollectedOrderBundle: async id => {
            if(id!==orderId)fail('SNAPSHOT_ORDER_MISMATCH');
            return {
              order,programmeShop:programme,
              registeredCustomer:customer,
              pickupEvents:events,eligibilitySnapshots:b.eligibilitySnapshots,
              verifiedRefunds:b.verifiedRefunds
            };
          },
          // The other finance methods remain unavailable in R4.4.
          readMerchantReceiptBundle: async()=>fail('RECEIPT_UNSUPPORTED'),
          readAdminTransferBundle: async()=>fail('BANK_TRANSFER_UNSUPPORTED'),
          readRefundReviewBundle: async()=>fail('REFUND_MUTATION_UNSUPPORTED')
        },orderId);
        const eligibleUnits=result.lines.reduce((sum,line)=>sum+line.quantity,0);
        if(!Number.isSafeInteger(eligibleUnits) || eligibleUnits<1)fail('EMPTY_ELIGIBLE_UNITS');
        return Object.freeze({
          mode:'r44-readonly-contract-fixture',
          orderId,shopId:result.shopId,programmeVersion:result.programmeVersion,
          eligibleUnits,
          canGrant:false,canReserve:false,canReimburse:false,canActivate:false
        });
      });
    }
  });
}
