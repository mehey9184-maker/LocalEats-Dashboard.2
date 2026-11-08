/**
 * R2.6 INERT transaction-integration rehearsal.
 *
 * No Supabase/PG adapter implements this interface; no API/router imports it.
 * Every read, identity/eligibility check, budget reservation and write below
 * MUST occur inside ONE server-owned serialized transaction in a future adapter.
 * Never pass a browser-supplied evidence reader or construct a fake actor.
 *
 * The R2.2/R2.5 disposable PG17 tests separately prove unique indexes/locks.
 * These fake-reader tests only verify API orchestration and fail-closed policy.
 */
import {
  verifyCollectedKotaEvidence, verifyManualRefundReview,
  verifyAdminTransferAuthority, verifyMerchantReceiptAuthority,
  type RewardEvidenceReader, type VerifiedCreditCandidate,
  type VerifiedRefundReview,
} from "./trustedEvidence.js";
import {verifyFinancialActor, type FinancialTokenVerifier} from "./financeActor.js";

export interface ProgrammeSnapshot {
  active: boolean;
  version: string;
  funded: boolean;
}
export interface CreditCommit {
  orderId: string;
  customerId: string;
  newUnits: number;
  replayed: boolean;
}
export interface RefundHoldCommit {
  refundId: string;
  customerId: string;
  held: true;
  replayed: boolean;
}
/**
 * This is an unimplemented interface for ONE atomic server-side command, not a
 * REST/Supabase client and not a direct model-writer for use by frontends.
 * The transaction must use a single serializable DB connection and must reject
 * any evidence mutation, account change or budget overrun before commit.
 */
export interface RewardsTransactionalReader extends RewardEvidenceReader {
  readProgrammeSnapshot(): Promise<ProgrammeSnapshot>;
  applyCreditCandidate(proof: VerifiedCreditCandidate): Promise<CreditCommit>;
  applyVerifiedRefundHold(proof: VerifiedRefundReview): Promise<RefundHoldCommit>;
}
export interface RewardsTransactionalStore {
  serializable<T>(work: (transaction: RewardsTransactionalReader) => Promise<T>): Promise<T>;
}
const fail = (code: string): never => {throw Error("REWARDS_"+code);};
const id = (value: unknown): value is string =>
  typeof value==="string" && value.length>0 && value.length<=160 &&
  value.trim()===value && !/[\x00-\x1f\x7f]/.test(value);
const eq = (a: unknown,b: unknown): boolean => a===b;

/**
 * One order, possibly multiple kota lines, must credit as an indivisible unit.
 * Do not call the old R2.1 single-line model separately outside this transaction:
 * an error on the second line must roll back the first line and budget promise.
 */
export async function rehearseCollectedPickupCredit(
  store: RewardsTransactionalStore, orderId: string,
): Promise<CreditCommit> {
  if(!id(orderId))return fail("INVALID_ORDER_ID");
  return store.serializable(async transaction=>{
    // The future reader must load orders, pickup events, snapshots and refunds
    // from the transaction's own consistent DB connection, not web/API calls.
    const policy=await transaction.readProgrammeSnapshot();
    if(!policy || policy.active!==true || policy.funded!==true || !id(policy.version))
      return fail("PROGRAMME_NOT_FUNDED_OR_ACTIVE");
    const proof=await verifyCollectedKotaEvidence(transaction,orderId);
    if(proof.programmeVersion!==policy.version)return fail("PROGRAMME_VERSION_MISMATCH");
    if(!proof.lines.length || proof.lines.some(line=>line.orderId!==orderId ||
       line.customerId!==proof.customerId || line.shopId!==proof.shopId))
      return fail("INVALID_VERIFIED_CREDIT_BUNDLE");
    const units=proof.lines.reduce((sum,line)=>sum+line.quantity,0);
    if(!Number.isSafeInteger(units)||units<1||units>10000)
      return fail("INVALID_VERIFIED_CREDIT_BUNDLE");

    // The *future* concrete DB implementation must enforce programme caps,
    // idempotency key uniqueness and budget reservations atomically.
    const receipt=await transaction.applyCreditCandidate(proof);
    if(!receipt || !eq(receipt.orderId,orderId) ||
       !eq(receipt.customerId,proof.customerId) ||
       !Number.isSafeInteger(receipt.newUnits) || receipt.newUnits<0 ||
       receipt.newUnits>units || typeof receipt.replayed!=="boolean" ||
       (receipt.replayed && receipt.newUnits!==0))
      return fail("UNCONFIRMED_TRANSACTION_RECEIPT");
    return receipt;
  });
}
/** Append-only refund review + hold in same atomic transaction, never debit merchant. */
export async function rehearseVerifiedManualRefundHold(
  store: RewardsTransactionalStore, refundId: string,
): Promise<RefundHoldCommit> {
  if(!id(refundId))return fail("INVALID_REFUND_ID");
  return store.serializable(async transaction=>{
    const proof=await verifyManualRefundReview(transaction,refundId);
    const receipt=await transaction.applyVerifiedRefundHold(proof);
    if(!receipt || receipt.refundId!==refundId ||
       receipt.customerId!==proof.customerId || receipt.held!==true ||
       typeof receipt.replayed!=="boolean")
      return fail("UNCONFIRMED_REFUND_HOLD");
    return receipt;
  });
}
export interface FinancialReviewResult {
  payableId: string;
  actorUid: string;
  shopId: string;
  amountMinor: number;
  outcome: "admin-review-only" | "merchant-review-only";
}
/**
 * Review ONLY; no bank transfer or financial-status change occurs.
 * Revocation check is performed OUTSIDE the DB transaction to keep locks short;
 * ownership/role and payable evidence are re-checked INSIDE it.
 */
export async function rehearseAdminTransferReview(
  store: RewardsTransactionalStore,
  serverAuthorizationHeader: string | undefined,
  tokenVerifier: FinancialTokenVerifier,
  payableId: string,
): Promise<FinancialReviewResult> {
  const actor=await verifyFinancialActor(serverAuthorizationHeader,tokenVerifier);
  return store.serializable(async transaction=>{
    const candidate=await verifyAdminTransferAuthority(transaction,actor,payableId);
    return {payableId:candidate.payableId,actorUid:candidate.verifiedAdminUid,
      shopId:candidate.shopId,amountMinor:candidate.amountMinor,
      outcome:"admin-review-only" as const};
  });
}
export async function rehearseMerchantReceiptReview(
  store: RewardsTransactionalStore,
  serverAuthorizationHeader: string | undefined,
  tokenVerifier: FinancialTokenVerifier,
  payableId: string,
): Promise<FinancialReviewResult> {
  const actor=await verifyFinancialActor(serverAuthorizationHeader,tokenVerifier);
  return store.serializable(async transaction=>{
    const candidate=await verifyMerchantReceiptAuthority(transaction,actor,payableId);
    return {payableId:candidate.payableId,actorUid:candidate.verifiedMerchantUid,
      shopId:candidate.shopId,amountMinor:candidate.amountMinor,
      outcome:"merchant-review-only" as const};
  });
}
