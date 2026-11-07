/**
 * R2.4: INERT reward-evidence guard. No router imports this file, and no database
 * implementation or payout is provided. Never call with browser-supplied facts.
 * The future reader MUST fetch all fields from trusted, consistent server-side
 * snapshots of persisted pickup commands, programme versions and ownership.
 */
import type {PurchaseLine} from "./rewardsModel.js";

export interface RewardEvidenceReader {
  readCollectedOrderBundle(orderId: string): Promise<unknown>;
  readMerchantReceiptBundle(payableId: string): Promise<unknown>;
  readAdminTransferBundle(payableId: string): Promise<unknown>;
  readRefundReviewBundle(refundId: string): Promise<unknown>;
}
/**
 * Only middleware using Firebase Admin verifyIdToken(token, true) may construct
 * this value from a successfully checked token. NEVER forward request.body.
 * These shape checks are NOT authentication in isolation.
 */
export interface VerifiedFirebaseActor {
  uid: string;
  verifiedBy: "firebase-admin-revocation-checked";
  anonymous: false;
}

const fail = (code: string): never => { throw new Error("REWARDS_" + code); };
const object = (value: unknown, code: string): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return fail(code);
  return value as Record<string, unknown>;
};
const id = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 160 &&
  value.trim() === value && !/[\x00-\x1f\x7f]/.test(value);
const int = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const notBefore = (a: unknown,b: unknown): boolean => {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const left = Date.parse(a), right = Date.parse(b);
  return Number.isFinite(left) && Number.isFinite(right) && left >= right &&
    /\dT\d/.test(a) && /\dT\d/.test(b);
};
const ensureActor = (actor: unknown): string => {
  const x = object(actor, "VERIFIED_IDENTITY_REQUIRED");
  if (!id(x.uid) || x.verifiedBy !== "firebase-admin-revocation-checked" || x.anonymous !== false)
    return fail("VERIFIED_IDENTITY_REQUIRED");
  return x.uid;
};
const ensure = (ok: boolean, code: string): void => { if (!ok) fail(code); };
const recordArray = (value: unknown, code: string): Record<string, unknown>[] => {
  if (!Array.isArray(value) || !value.every(x => x && typeof x === "object" && !Array.isArray(x)))
    return fail(code);
  return value as Record<string,unknown>[];
};
const minor = (value: unknown): value is number => int(value) && value <= 100_000_000;

export interface VerifiedCreditCandidate {
  orderId: string;
  customerId: string;
  shopId: string;
  programmeVersion: string;
  lines: PurchaseLine[];
}
/**
 * Produces a *candidate* for the atomic PostgreSQL credit transaction.
 * Does not create grants/credits or claim real pickup events are available.
 * Requires a future database adapter that reads a single consistent snapshot.
 */
export async function verifyCollectedKotaEvidence(
  reader: RewardEvidenceReader, orderId: string,
): Promise<VerifiedCreditCandidate> {
  if (!id(orderId)) return fail("INVALID_ORDER_ID");
  const bundle = object(await reader.readCollectedOrderBundle(orderId), "EVIDENCE_UNAVAILABLE");
  const order = object(bundle.order, "ORDER_UNAVAILABLE");
  const shop = object(bundle.programmeShop, "PROGRAMME_PROOF_UNAVAILABLE");
  const customer = object(bundle.registeredCustomer, "CUSTOMER_PROOF_UNAVAILABLE");
  const commands = recordArray(bundle.pickupEvents, "PICKUP_EVENTS_UNAVAILABLE");
  const items = recordArray(order.items, "IMMUTABLE_LINES_REQUIRED");
  const evidence = recordArray(bundle.eligibilitySnapshots, "ELIGIBILITY_SNAPSHOTS_REQUIRED");
  const refunds = recordArray(bundle.verifiedRefunds, "REFUND_HISTORY_UNAVAILABLE");

  ensure(order.id === orderId && id(order.user_id) && id(order.shop_id),
    "ORDER_IDENTITY_MISMATCH");
  ensure(order.delivery_type === "collection" && order.status === "collected" &&
    order.payment_status === "paid" && order.test_record === false &&
    order.simulated_checkout === false &&
    typeof order.create_intent_hash === "string" && /^[a-f0-9]{64}$/i.test(order.create_intent_hash),
    "PICKUP_NOT_VERIFIABLY_PAID_AND_COLLECTED");
  ensure(customer.uid === order.user_id && customer.registered === true &&
    customer.anonymous === false && customer.test_account === false,
    "REGISTERED_CUSTOMER_REQUIRED");
  ensure(shop.shop_id === order.shop_id && shop.approval_status === "approved" &&
    shop.participating_at_purchase === true && id(shop.programme_version) &&
    notBefore(order.created_at, shop.rewards_started_at) &&
    notBefore(order.created_at, shop.shop_approved_at),
    "PROGRAMME_NOT_ELIGIBLE_AT_PURCHASE");

  // A trusted pickup command log is required, not just a mutable status flag.
  const sorted = [...commands].sort((a,b) => Number(a.revision)-Number(b.revision));
  const seenRevisions = new Set<number>();
  for (const command of sorted) {
    ensure(command.order_id === orderId && int(command.revision) &&
      id(command.actor_uid) && id(command.command_id) &&
      notBefore(command.occurred_at, order.created_at) &&
      !seenRevisions.has(command.revision as number), "PICKUP_EVENT_INVALID");
    seenRevisions.add(command.revision as number);
  }
  const payment = sorted.find(c => c.kind === "payment_confirmed");
  const collected = sorted.find(c => c.kind === "collected");
  ensure(!!payment && !!collected && Number(collected.revision) > Number(payment.revision) &&
    notBefore(collected.occurred_at, payment.occurred_at) &&
    notBefore(collected.occurred_at, shop.rewards_started_at),
    "PAYMENT_AND_HANDOVER_PROOF_REQUIRED");
  ensure(refunds.length === 0, "REFUNDED_ORDER_REQUIRES_REVIEW");
  ensure(items.length > 0 && items.length <= 100 && evidence.length === items.length,
    "IMMUTABLE_LINES_REQUIRED");

  const credits: PurchaseLine[] = [];
  for (let index=0; index<items.length; index++) {
    const line=items[index]!;
    const proof=evidence[index]!;
    ensure(id(line.menu_item_id) && int(line.quantity) && line.quantity <= 100 &&
      typeof line.unit_price === "number" && Number.isFinite(line.unit_price) && line.unit_price >= 0 &&
      proof.line_index === index && proof.order_id === orderId &&
      proof.shop_id === order.shop_id && proof.menu_item_id === line.menu_item_id &&
      proof.programme_version === shop.programme_version &&
      proof.proof_source === "server-persisted-at-purchase" &&
      proof.immutable === true &&
      notBefore(order.created_at,proof.snapshot_at),
      "IMMUTABLE_ELIGIBILITY_UNCONFIRMED");
    if (proof.qualifying_kota === true) {
      credits.push({orderId, lineId:orderId+":line:"+index, customerId:String(order.user_id),
        shopId:String(order.shop_id),quantity:line.quantity as number,paid:true,collected:true,
        eligibleKota:true,testRecord:false,refunded:false});
    } else ensure(proof.qualifying_kota === false, "ELIGIBILITY_UNKNOWN");
  }
  ensure(credits.length>0,"NO_QUALIFYING_KOTA");
  return {orderId,customerId:String(order.user_id),shopId:String(order.shop_id),
    programmeVersion:String(shop.programme_version),lines:credits};
}

export interface VerifiedMerchantReceiptCandidate {
  payableId: string;shopId: string;verifiedMerchantUid: string;amountMinor: number;
  transferId: string;
}
/** Read-only authorization check for a future merchant 'received' action. */
export async function verifyMerchantReceiptAuthority(
  reader: RewardEvidenceReader, actor: VerifiedFirebaseActor, payableId: string,
): Promise<VerifiedMerchantReceiptCandidate> {
  const uid=ensureActor(actor);
  if(!id(payableId))return fail("INVALID_PAYABLE_ID");
  const data=object(await reader.readMerchantReceiptBundle(payableId),"PAYABLE_PROOF_UNAVAILABLE");
  const payable=object(data.payable,"PAYABLE_PROOF_UNAVAILABLE");
  const shop=object(data.shop,"SHOP_OWNER_PROOF_UNAVAILABLE");
  const transfer=object(data.transfer,"TRANSFER_PROOF_UNAVAILABLE");
  ensure(payable.id===payableId && id(payable.shop_id) &&
    shop.id===payable.shop_id && shop.owner_id===uid &&
    payable.status==="sent" && minor(payable.amount_minor) &&
    id(payable.transfer_id) && transfer.id===payable.transfer_id &&
    transfer.payable_id===payableId && transfer.amount_minor===payable.amount_minor,
    "MERCHANT_RECEIPT_FORBIDDEN");
  return {payableId,shopId:String(payable.shop_id),verifiedMerchantUid:uid,
    amountMinor:payable.amount_minor as number,transferId:String(payable.transfer_id)};
}
export interface VerifiedAdminTransferCandidate {
  payableId: string; verifiedAdminUid: string; shopId: string; amountMinor: number;
}
/** This DOES NOT send money. It only validates eligibility to record a bank transfer. */
export async function verifyAdminTransferAuthority(
  reader: RewardEvidenceReader, actor: VerifiedFirebaseActor, payableId: string,
): Promise<VerifiedAdminTransferCandidate> {
  const uid=ensureActor(actor);
  if(!id(payableId))return fail("INVALID_PAYABLE_ID");
  const data=object(await reader.readAdminTransferBundle(payableId),"ADMIN_PROOF_UNAVAILABLE");
  const payable=object(data.payable,"PAYABLE_PROOF_UNAVAILABLE");
  const admin=object(data.adminUser,"ADMIN_PROOF_UNAVAILABLE");
  ensure(admin.firebase_uid===uid && admin.role==="super_admin" &&
    admin.is_active===true,"ACTIVE_SUPER_ADMIN_REQUIRED");
  ensure(payable.id===payableId && payable.status==="owed" &&
    id(payable.shop_id) && minor(payable.amount_minor) &&
    (payable.transfer_id === null || payable.transfer_id === undefined),
    "PAYOUT_NOT_OWED_OR_ALREADY_SENT");
  return {payableId,verifiedAdminUid:uid,shopId:String(payable.shop_id),
    amountMinor:payable.amount_minor as number};
}
export interface VerifiedRefundReview {
  refundId:string;orderId:string;lineId:string;customerId:string;
  shopId:string;units:number;merchantUid:string;adminUid:string;
}
/**
 * Cash/pay-at-shop has no card-network chargeback proof. Require a persisted
 * manually reconciled refund with TWO independent identities. This function
 * never releases a hold or cancels a merchant debt.
 */
export async function verifyManualRefundReview(
  reader: RewardEvidenceReader, refundId: string,
): Promise<VerifiedRefundReview> {
  if(!id(refundId))return fail("INVALID_REFUND_ID");
  const bundle=object(await reader.readRefundReviewBundle(refundId),"REFUND_PROOF_UNAVAILABLE");
  const refund=object(bundle.refund,"REFUND_PROOF_UNAVAILABLE");
  const credit=object(bundle.creditedLine,"CREDIT_PROOF_UNAVAILABLE");
  const shop=object(bundle.shop,"SHOP_OWNER_PROOF_UNAVAILABLE");
  const admin=object(bundle.adminUser,"ADMIN_PROOF_UNAVAILABLE");
  ensure(refund.id===refundId && refund.review_status==="verified" &&
    refund.origin==="verified_manual_shop_refund" && id(refund.order_id) &&
    id(refund.line_id) && id(refund.customer_id) && id(refund.shop_id) &&
    int(refund.units) && refund.units<=100 && minor(refund.amount_minor) &&
    id(refund.bank_or_cash_reference),"REFUND_NOT_VERIFIED");
  ensure(credit.order_id===refund.order_id && credit.line_id===refund.line_id &&
    credit.customer_id===refund.customer_id && int(credit.credited_units) &&
    refund.units<=credit.credited_units,"REFUND_CREDIT_MISMATCH");
  ensure(shop.id===refund.shop_id && id(shop.owner_id) &&
    shop.owner_id===refund.merchant_verified_by_uid &&
    admin.firebase_uid===refund.admin_verified_by_uid &&
    admin.role==="super_admin" && admin.is_active===true &&
    shop.owner_id!==admin.firebase_uid,
    "INDEPENDENT_REFUND_APPROVAL_REQUIRED");
  return {refundId,orderId:String(refund.order_id),lineId:String(refund.line_id),
    customerId:String(refund.customer_id),shopId:String(refund.shop_id),
    units:refund.units as number,merchantUid:String(shop.owner_id),
    adminUid:String(admin.firebase_uid)};
}
