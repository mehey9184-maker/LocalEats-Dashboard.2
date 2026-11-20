/**
 * L3-N8D — DORMANT Merchant profile API composition.
 *
 * Not imported by server.ts and cannot activate profile writes even if an
 * environment variable says otherwise. A later, separately approved stage
 * must verify the actual Firebase project + named database and add an
 * explicit reviewed route mount. This factory holds NO client credentials.
 */
import type {App} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import type {Firestore} from "firebase-admin/firestore";
import type {SupabaseClient} from "@supabase/supabase-js";
import {createFirestoreMerchantAccountStore} from "./merchantFirestoreAccountStore.js";
import {createSupabaseMerchantOwnershipLookup} from "./merchantApprovedOwner.js";
import {openMerchantAccountFirestoreForReview} from "./merchantAdminFirestore.js";
import {
  makeReviewOnlyMerchantAccountRouter,
  type MerchantAccountVerifier,
} from "../routes/merchantAccountContract.js";

export type MerchantAccountTarget = {
  /** Values from authenticated API server configuration, not a request. */
  apiProjectId: string | undefined;
  apiDatabaseId: string | undefined;
  /** Explicit Merchant client deployment target, confirmed out-of-band. */
  merchantProjectId: string | undefined;
  merchantDatabaseId: string | undefined;
};

const sane = (value:unknown):value is string =>
  typeof value === "string" && value.length>0 && value.trim()===value;

/** Fail closed unless Firebase Admin app, API and Merchant target exactly match. */
export function verifyMerchantAccountTarget(
  app:Pick<App,"options">,
  target:MerchantAccountTarget,
):{projectId:string;databaseId:string} {
  const appProject=app?.options?.projectId;
  const {apiProjectId,merchantProjectId,apiDatabaseId,merchantDatabaseId}=target;
  if (!sane(appProject) || !sane(apiProjectId) || !sane(merchantProjectId) ||
      appProject!==apiProjectId || apiProjectId!==merchantProjectId)
    throw Error("MERCHANT_FIREBASE_PROJECT_MISMATCH");
  if (!sane(apiDatabaseId) || !sane(merchantDatabaseId) ||
      apiDatabaseId!==merchantDatabaseId)
    throw Error("MERCHANT_FIRESTORE_DATABASE_ID_MISMATCH");
  return {projectId:apiProjectId,databaseId:apiDatabaseId};
}

export type DormantMerchantAccountApiDependencies = {
  app:App;
  target:MerchantAccountTarget;
  /** Only the API server's service-role Supabase client is permissible. */
  ownershipDb:Pick<SupabaseClient,"from">;
  /** Test injection only. No real database connections in CI. */
  reviewFirestoreFactory?:(
    app:App,apiDatabaseId:string,merchantDatabaseId:string
  )=>Pick<Firestore,"doc">;
  /** Synthetic-test verifier only; default uses this App's Admin Auth. */
  reviewVerifier?:MerchantAccountVerifier;
};

/**
 * Prepare an unmounted route with project/database safeguards.
 * DOES NOT read any activation flags and hard-codes writes disabled.
 * The result is never imported by the active API server.
 */
export function prepareDormantMerchantAccountApi(deps:DormantMerchantAccountApiDependencies){
  if (!deps || !deps.app || !deps.target || !deps.ownershipDb)
    throw Error("MERCHANT_ACCOUNT_API_UNCONFIGURED");
  const matched=verifyMerchantAccountTarget(deps.app,deps.target);
  const firestore=(deps.reviewFirestoreFactory??openMerchantAccountFirestoreForReview)(
    deps.app,matched.databaseId,matched.databaseId
  );
  const store=createFirestoreMerchantAccountStore(firestore);
  const isApprovedMerchantOwner=createSupabaseMerchantOwnershipLookup(deps.ownershipDb);
  const verifyToken=deps.reviewVerifier ??
    ((token:string,checkRevoked:true)=>getAuth(deps.app).verifyIdToken(token,checkRevoked));
  return makeReviewOnlyMerchantAccountRouter({
    store,isApprovedMerchantOwner,verifyToken,
    // No environment flag can enable profile writes in N8D.
    writesEnabled:()=>false,
  });
}
