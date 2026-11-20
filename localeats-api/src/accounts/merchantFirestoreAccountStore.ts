/**
 * L3-N8C — NOT MOUNTED: server-only Merchant Firestore profile store.
 *
 * No Firebase app or database is initialized here. Composition must supply a
 * server Admin Firestore instance for the exact named database used by the
 * Merchant Dashboard. No client SDK, service credentials, or HTTP route.
 *
 * Firebase Auth is authoritative for identity and login email; existing
 * Firestore users/{verifiedUid} is authoritative for editable merchant
 * full_name, phone and display preferences. Do NOT create profiles here.
 */
import type {Firestore} from "firebase-admin/firestore";
import type {
  MerchantAccountSnapshot, MerchantAccountStore, MerchantAccountUpdate,
} from "../routes/merchantAccountContract.js";

function safeUid(uid: string): string {
  if (typeof uid !== "string" || !uid || uid.length > 128 ||
      [...uid].some(char => char === "/" || char === "\\" || char.charCodeAt(0) < 32))
    throw Error("INVALID_MERCHANT_ACCOUNT_UID");
  return uid;
}
const allowed = ["full_name","phone","marketing_preferences","dark_mode"] as const;

/** Passed an Admin SDK Firestore instance; no SDK client or module-level init. */
export function createFirestoreMerchantAccountStore(
  firestore: Pick<Firestore, "doc">,
  clock: () => string = () => new Date().toISOString(),
): MerchantAccountStore {
  if (!firestore || typeof firestore.doc !== "function")
    throw Error("MERCHANT_FIRESTORE_UNAVAILABLE");

  const refFor = (uid: string) => firestore.doc("users/" + safeUid(uid));

  async function read(uid: string): Promise<MerchantAccountSnapshot | null> {
    const ref = refFor(uid);
    const snap = await ref.get(); // Server-read, not a browser cache.
    if (!snap.exists) return null;
    if (snap.id !== uid) throw Error("MERCHANT_PROFILE_DOCUMENT_SCOPE_MISMATCH");
    const original = snap.data();
    if (!original || typeof original !== "object" || Array.isArray(original))
      throw Error("MERCHANT_PROFILE_DOCUMENT_INVALID");
    if (Object.hasOwn(original,"uid") && original.uid !== uid)
      throw Error("MERCHANT_PROFILE_OWNER_MISMATCH");
    // No account creation and no trust in a user-controlled role/owner field.
    return {...original,uid};
  }

  async function write(uid: string, patch: MerchantAccountUpdate): Promise<void> {
    const ref = refFor(uid);
    const fields = Object.keys(patch);
    if (!fields.length || fields.some(key => !allowed.includes(key as typeof allowed[number])))
      throw Error("FORBIDDEN_ACCOUNT_FIELD");
    for (const key of fields) {
      const value=patch[key as keyof MerchantAccountUpdate];
      if (key === "full_name" && (typeof value !== "string" ||
          value.trim().length < 2 || value.trim().length > 120)) throw Error("INVALID_FULL_NAME");
      if (key === "phone" && (typeof value !== "string" ||
          (value !== "" && !/^(?:\+27|0)[0-9]{9}$/.test(value)))) throw Error("INVALID_PHONE");
      if ((key === "marketing_preferences" || key === "dark_mode") && typeof value !== "boolean")
        throw Error("INVALID_PREFERENCE");
    }
    // Missing records must never be created or silently re-keyed.
    const prior = await read(uid);
    if (!prior) throw Error("MERCHANT_PROFILE_DOCUMENT_MISSING");
    const timestamp = clock();
    if (typeof timestamp !== "string" || !Number.isFinite(Date.parse(timestamp)))
      throw Error("MERCHANT_PROFILE_INVALID_SERVER_TIME");
    await ref.update({...patch,updated_at:timestamp});
    // The N8B HTTP contract performs a fresh read and field-by-field
    // confirmation before showing success. SDK update ack is not sufficient.
  }

  return Object.freeze({read,write});
}

export type MerchantIdentityForDisplay = {
  uid: string;
  email: string | null;
  displayName?: string | null;
  phoneNumber?: string | null;
};

const nonblank = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;

/** Pure read policy for eventual UI integration; NOT wired into the live UI. */
export function reconcileMerchantProfileDisplay(
  auth: MerchantIdentityForDisplay,
  firestoreDoc: MerchantAccountSnapshot | null,
): {uid:string;email:string|null;full_name:string;phone:string;
  marketing_preferences?:boolean;dark_mode?:boolean} {
  const uid=safeUid(auth.uid);
  if (firestoreDoc && firestoreDoc.uid !== uid)
    throw Error("MERCHANT_PROFILE_DOCUMENT_SCOPE_MISMATCH");
  // Firestore wins for editable display data, including deliberate blank phone.
  // Auth wins for login identity and email. Never use Firestore role/owner/email.
  const full_name=nonblank(firestoreDoc?.full_name) ??
    nonblank(auth.displayName) ??
    nonblank(auth.email?.split("@")[0]) ?? "LocalEats Merchant";
  const phone=typeof firestoreDoc?.phone === "string" ? firestoreDoc.phone :
    (typeof auth.phoneNumber === "string" ? auth.phoneNumber : "");
  const out:{
    uid:string;email:string|null;full_name:string;phone:string;
    marketing_preferences?:boolean;dark_mode?:boolean;
  }={uid,email:auth.email,full_name,phone};
  if (typeof firestoreDoc?.marketing_preferences === "boolean")
    out.marketing_preferences=firestoreDoc.marketing_preferences;
  if (typeof firestoreDoc?.dark_mode === "boolean")
    out.dark_mode=firestoreDoc.dark_mode;
  return out;
}
