/**
 * L3-N8C — review-only Firebase Admin database selector. No caller in server.ts.
 *
 * The merchant browser currently selects a named Firestore database.
 * Firebase Admin defaults to (default) unless the database ID is explicit.
 * Refuse to connect if stage/API and client database identifiers differ.
 * The caller must separately verify project ID and isolated environment.
 */
import type {App} from "firebase-admin/app";
import {getFirestore, type Firestore} from "firebase-admin/firestore";

export function openMerchantAccountFirestoreForReview(
  app:App,
  apiDatabaseId:string | undefined,
  merchantClientDatabaseId:string | undefined,
):Firestore {
  if (!app || !apiDatabaseId || !merchantClientDatabaseId ||
      apiDatabaseId.trim() !== apiDatabaseId ||
      merchantClientDatabaseId.trim() !== merchantClientDatabaseId ||
      apiDatabaseId !== merchantClientDatabaseId)
    throw Error("MERCHANT_FIRESTORE_DATABASE_ID_MISMATCH");
  return apiDatabaseId === "(default)"
    ? getFirestore(app)
    : getFirestore(app,apiDatabaseId);
}
