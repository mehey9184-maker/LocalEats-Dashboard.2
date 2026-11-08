/**
 * R3.0: INERT server-owned identity and financial review boundary.
 *
 * This module has NO HTTP route, no Firebase Admin instance, no Supabase
 * credentials, no bank API and no ledger writer. It is a test-only contract.
 * A future composition root MUST inject Firebase Admin verifyIdToken(t, true)
 * from trusted server code, not an injectable HTTP request parameter.
 *
 * Only the actual request Authorization header is accepted per invocation.
 * Caller cannot provide a fabricated VerifiedFirebaseActor, UID, role, owner,
 * payable amount or action permission.
 */
import {verifyFinancialActor, type FinancialTokenVerifier} from "./financeActor.js";
import {
  verifyAdminTransferAuthority,
  verifyMerchantReceiptAuthority,
  type RewardEvidenceReader,
} from "./trustedEvidence.js";

export interface ReadOnlyFinancialTransaction extends RewardEvidenceReader {
  // Every read MUST use the SAME consistent server-only DB transaction.
  // The interface deliberately has no credit, transfer, refund or payout writer.
}
export interface ReadOnlyFinancialTransactionStore {
  readOnlySerializable<T>(
    verify: (transaction: ReadOnlyFinancialTransaction) => Promise<T>
  ): Promise<T>;
}
export type ReviewOnlyResult = Readonly<{
  mode: "review-only";
  payableId: string;
  actorUid: string;
  shopId: string;
  amountMinor: number;
  kind: "admin-proposed-transfer" | "merchant-proposed-receipt";
  canSettlePayment: false;
}>;

export interface R30ExecutorDependencies {
  /** Must be Firebase Admin's server-only verifyIdToken(token,true). */
  verifyIdToken: FinancialTokenVerifier;
  transactions: ReadOnlyFinancialTransactionStore;
}
/**
 * Startup-only factory. The caller cannot change the verifier per request.
 * This is NOT a payment executor: there are no write methods and no route.
 */
export function createInertR30FinancialReviewExecutor(deps: R30ExecutorDependencies) {
  if (!deps || typeof deps.verifyIdToken !== "function" ||
      !deps.transactions || typeof deps.transactions.readOnlySerializable !== "function")
    throw Error("REWARDS_FINANCIAL_REVIEW_NOT_CONFIGURED");

  const verifyToken=deps.verifyIdToken;
  const store=deps.transactions;

  return Object.freeze({
    async reviewAdminTransfer(
      serverAuthorizationHeader: string | undefined,
      payableId: string,
    ): Promise<ReviewOnlyResult> {
      // Verify signature, expiry and revocation with Firebase Admin before
      // accessing the money-related PostgreSQL review transaction.
      const actor=await verifyFinancialActor(serverAuthorizationHeader,verifyToken);
      return store.readOnlySerializable(async tx=>{
        // Trust active admin role and payable status *inside* the transaction.
        const candidate=await verifyAdminTransferAuthority(tx,actor,payableId);
        return Object.freeze({
          mode:"review-only",payableId:candidate.payableId,
          actorUid:candidate.verifiedAdminUid,shopId:candidate.shopId,
          amountMinor:candidate.amountMinor,
          kind:"admin-proposed-transfer",
          canSettlePayment:false,
        }) as ReviewOnlyResult;
      });
    },

    async reviewMerchantReceipt(
      serverAuthorizationHeader: string | undefined,
      payableId: string,
    ): Promise<ReviewOnlyResult> {
      const actor=await verifyFinancialActor(serverAuthorizationHeader,verifyToken);
      return store.readOnlySerializable(async tx=>{
        const candidate=await verifyMerchantReceiptAuthority(tx,actor,payableId);
        return Object.freeze({
          mode:"review-only",payableId:candidate.payableId,
          actorUid:candidate.verifiedMerchantUid,shopId:candidate.shopId,
          amountMinor:candidate.amountMinor,
          kind:"merchant-proposed-receipt",
          canSettlePayment:false,
        }) as ReviewOnlyResult;
      });
    },
  });
}
