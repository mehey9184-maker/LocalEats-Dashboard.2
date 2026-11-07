/**
 * R3.1 INERT read-only outbox inspection. NOT imported into routes/server.
 * This is a trust-boundary rehearsal, not a Firebase connection or Rewards worker.
 * An HTTP request must NEVER supply verifier or reader implementations.
 */
import {verifyFinancialActor,type FinancialTokenVerifier} from "./financeActor.js";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const goodId=(v:unknown):v is string=>
  typeof v==="string" && v.length>0 && v.length<=160 && v.trim()===v;
const err=(code:string):never=>{throw Error("REWARDS_R31_"+code);};
const object=(v:unknown):Record<string,unknown>=>{
  if(!v || typeof v!=="object" || Array.isArray(v))return err("SOURCE_UNAVAILABLE");
  return v as Record<string,unknown>;
};
const timestamp=(v:unknown):number=>{
  if(typeof v!=="string" || !/^\d{4}-\d\d-\d\dT/.test(v))return NaN;
  return Date.parse(v);
};
export interface PreviewOutboxReader {
  /**
   * Future adapter must SELECT all evidence from ONE consistent read-only
   * PostgreSQL transaction. All values are server-persisted, never body fields.
   */
  readCollectedOutboxBundle(orderId:string):Promise<unknown>;
}
export interface PreviewOutboxStore {
  readOnlySerializable<T>(fn:(tx:PreviewOutboxReader)=>Promise<T>):Promise<T>;
}
export interface PreviewOutboxDependencies {
  /** Fixed at server startup; MUST use Firebase Admin verifyIdToken(token,true). */
  verifyIdToken:FinancialTokenVerifier;
  transactionStore:PreviewOutboxStore;
}
export type OutboxInspection=Readonly<{
  mode:"preview-read-only";
  orderId:string;
  commandId:string;
  shopId:string;
  verifiedMerchantUid:string;
  eligibleUnits:number;
  canCredit:false;
  canAcknowledge:false;
}>;

/**
 * Read-only inspection. Does not enqueue, claim, acknowledge or credit.
 * Even a genuine owner may inspect only if shop ownership and all persisted
 * source/event/checkout/outbox facts match in the same database transaction.
 */
export function createInertR31PickupOutboxPreview(deps:PreviewOutboxDependencies){
  if(!deps || typeof deps.verifyIdToken!=="function" ||
     !deps.transactionStore || typeof deps.transactionStore.readOnlySerializable!=="function")
    return err("NOT_CONFIGURED");
  const verifier=deps.verifyIdToken;
  const db=deps.transactionStore;
  return Object.freeze({
    async inspect(
      serverAuthorizationHeader:string|undefined,
      orderId:string,
      collectedCommandId:string,
    ):Promise<OutboxInspection>{
      if(!uuid.test(orderId) || !uuid.test(collectedCommandId))return err("BAD_UUID");
      const actor=await verifyFinancialActor(serverAuthorizationHeader,verifier);
      return db.readOnlySerializable(async tx=>{
        const b=object(await tx.readCollectedOutboxBundle(orderId));
        const order=object(b.order);
        const shop=object(b.shop);
        const snapshot=object(b.checkoutProof);
        const programme=object(b.programme);
        const outbox=object(b.outbox);
        if(!Array.isArray(b.pickupEvents) ||
           !b.pickupEvents.every(v=>v && typeof v==="object" && !Array.isArray(v)))
          return err("COMMAND_EVIDENCE_MISSING");
        const events=b.pickupEvents as Record<string,unknown>[];
        const paid=events.find(x=>x.kind==="payment_confirmed");
        const collected=events.find(x=>x.kind==="collected");
        if(!paid || !collected ||
           order.id!==orderId || order.origin!=="authoritative_pickup" ||
           order.status!=="collected" || order.payment_status!=="paid" ||
           order.registered!==true || order.is_test!==false ||
           !goodId(order.shop_id) || !goodId(order.customer_uid) ||
           shop.id!==order.shop_id || shop.owner_uid!==actor.uid ||
           shop.approval_status!=="approved" ||
           snapshot.order_id!==orderId || snapshot.shop_id!==order.shop_id ||
           snapshot.customer_uid!==order.customer_uid ||
           snapshot.programme_version!==programme.version ||
           snapshot.approved_at_purchase!==true ||
           snapshot.enrolled_at_purchase!==true ||
           !Number.isSafeInteger(snapshot.eligible_units) ||
           Number(snapshot.eligible_units)<1 || Number(snapshot.eligible_units)>10000 ||
           programme.active!==true ||
           !goodId(programme.version) ||
           !Number.isFinite(timestamp(order.created_at)) ||
           !Number.isFinite(timestamp(programme.starts_at)) ||
           timestamp(order.created_at)<timestamp(programme.starts_at) ||
           !Number.isFinite(timestamp(snapshot.captured_at)) ||
           timestamp(snapshot.captured_at)>timestamp(order.created_at) ||
           paid.order_id!==orderId || collected.order_id!==orderId ||
           !uuid.test(String(paid.command_id)) ||
           collected.command_id!==collectedCommandId ||
           collected.actor_uid!==actor.uid ||
           !Number.isSafeInteger(paid.revision) || !Number.isSafeInteger(collected.revision) ||
           Number(paid.revision)<1 || Number(collected.revision)<=Number(paid.revision) ||
           !Number.isFinite(timestamp(paid.occurred_at)) ||
           timestamp(paid.occurred_at)<timestamp(order.created_at) ||
           !Number.isFinite(timestamp(collected.occurred_at)) ||
           timestamp(collected.occurred_at)<timestamp(paid.occurred_at) ||
           outbox.order_id!==orderId ||
           outbox.collected_command_id!==collectedCommandId ||
           outbox.collected_revision!==collected.revision ||
           !["pending","leased"].includes(String(outbox.state)))
          return err("UNTRUSTED_TRANSITION");
        return Object.freeze({
          mode:"preview-read-only",orderId,commandId:collectedCommandId,
          shopId:String(order.shop_id),verifiedMerchantUid:actor.uid,
          eligibleUnits:Number(snapshot.eligible_units),
          canCredit:false,canAcknowledge:false,
        }) as OutboxInspection;
      });
    }
  });
}
