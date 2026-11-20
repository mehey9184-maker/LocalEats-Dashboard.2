/**
 * L3-N8B — unmounted, review-only Merchant account HTTP contract.
 *
 * The production API does NOT mount this router. There is deliberately no
 * Firebase/Firestore/Supabase account writer here: N8B verifies the trust
 * boundary against injected disposable stores before any storage integration.
 *
 * Future composition must inject an API-verified approved merchant owner
 * lookup and a server-only account store. Never authorize using token custom
 * user_metadata, user-supplied IDs or local browser state.
 */
import {Router, type Request, type Response} from "express";
import {authAdmin} from "../lib/firebaseAdmin.js";
import {getFirebaseBearerToken} from "../middleware/authenticateFirebase.js";

export type MerchantAccountUpdate = Partial<{
  full_name: string;
  phone: string;
  marketing_preferences: boolean;
  dark_mode: boolean;
}>;

export type MerchantAccountSnapshot = {
  uid: string;
  full_name?: unknown;
  phone?: unknown;
  marketing_preferences?: unknown;
  dark_mode?: unknown;
  [key: string]: unknown;
};

export interface MerchantAccountStore {
  /** Must read only the verified token's UID; not a request-supplied ID. */
  read(uid: string): Promise<MerchantAccountSnapshot | null>;
  /** Must persist only the allowlisted patch for this verified UID. */
  write(uid: string, patch: MerchantAccountUpdate): Promise<void>;
}

type FirebaseAccountClaims = {
  uid?: unknown;
  firebase?: {sign_in_provider?: unknown};
};

export type MerchantAccountVerifier =
  (token: string, checkRevoked: true) => Promise<FirebaseAccountClaims>;

/** Requires the real Firebase Admin revoked/disabled-account verification. */
export const verifyMerchantAccountToken: MerchantAccountVerifier =
  (token, checkRevoked) => authAdmin.verifyIdToken(token, checkRevoked);

export type MerchantAccountContractDependencies = {
  verifyToken?: MerchantAccountVerifier;
  /** Must consult server-verified ownership/approval, not user metadata. */
  isApprovedMerchantOwner: (uid: string) => Promise<boolean>;
  store: MerchantAccountStore;
  /** Defaults to OFF. Test-only true must never be enabled on a hosted API. */
  writesEnabled?: () => boolean;
};

const permittedFields = new Set([
  "full_name", "phone", "marketing_preferences", "dark_mode",
]);
const reject = (code: string): never => {throw new Error(code);};

export function parseMerchantAccountUpdate(body: unknown): MerchantAccountUpdate {
  if (!body || typeof body !== "object" || Array.isArray(body))
    return reject("INVALID_ACCOUNT_UPDATE");
  const input = body as Record<string, unknown>;
  const keys = Object.keys(input);
  if (keys.length === 0) return reject("EMPTY_ACCOUNT_UPDATE");
  if (keys.some(key => !permittedFields.has(key)))
    return reject("FORBIDDEN_ACCOUNT_FIELD");

  const out: MerchantAccountUpdate = {};
  if ("full_name" in input) {
    if (typeof input.full_name !== "string") return reject("INVALID_FULL_NAME");
    const name = input.full_name.trim();
    if (name.length < 2 || name.length > 120) return reject("INVALID_FULL_NAME");
    out.full_name = name;
  }
  if ("phone" in input) {
    if (typeof input.phone !== "string") return reject("INVALID_PHONE");
    const phone = input.phone.replace(/[\s()-]/g, "");
    if (phone.length > 0 && !/^(?:\+27|0)[0-9]{9}$/.test(phone))
      return reject("INVALID_PHONE");
    out.phone = phone;
  }
  for (const key of ["marketing_preferences","dark_mode"] as const) {
    if (key in input) {
      if (typeof input[key] !== "boolean") return reject("INVALID_PREFERENCE");
      out[key] = input[key] as boolean;
    }
  }
  return out;
}

const safeAccountView = (source: MerchantAccountSnapshot | null, uid: string) => {
  if (!source || source.uid !== uid) return null;
  const view: MerchantAccountUpdate & {uid: string} = {uid};
  for (const key of ["full_name","phone"] as const) {
    const value = source[key];
    if (value === undefined) continue;
    if (typeof value !== "string") return null;
    view[key] = value;
  }
  for (const key of ["marketing_preferences","dark_mode"] as const) {
    const value = source[key];
    if (value === undefined) continue;
    if (typeof value !== "boolean") return null;
    view[key] = value;
  }
  return view;
};

type Admission = {uid: string} | null;
export function makeReviewOnlyMerchantAccountRouter(deps: MerchantAccountContractDependencies) {
  if (!deps || !deps.store || !deps.isApprovedMerchantOwner ||
      typeof deps.store.read !== "function" || typeof deps.store.write !== "function" ||
      typeof deps.isApprovedMerchantOwner !== "function")
    throw Error("MERCHANT_ACCOUNT_CONTRACT_UNCONFIGURED");

  const verify = deps.verifyToken ?? verifyMerchantAccountToken;
  const enabled = deps.writesEnabled ?? (() => false);
  const router = Router();
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  async function admit(req: Request, res: Response): Promise<Admission> {
    const token = getFirebaseBearerToken(req.headers.authorization);
    if (!token || token.length > 8192) {
      res.status(401).json({success:false,code:"MERCHANT_LOGIN_REQUIRED"});
      return null;
    }
    let claims: FirebaseAccountClaims;
    try {
      // Never use the shared non-revocation-aware middleware here.
      claims = await verify(token, true);
    } catch {
      res.status(401).json({success:false,code:"MERCHANT_SESSION_INVALID"});
      return null;
    }
    const uid = claims?.uid;
    if (typeof uid !== "string" || uid.length === 0 || uid.length > 128 ||
        [...uid].some(ch => ch === "/" || ch === "\\" || ch.charCodeAt(0) < 32) ||
        typeof claims.firebase?.sign_in_provider !== "string" ||
        claims.firebase.sign_in_provider === "anonymous") {
      res.status(401).json({success:false,code:"REGISTERED_MERCHANT_REQUIRED"});
      return null;
    }
    try {
      if (!(await deps.isApprovedMerchantOwner(uid))) {
        res.status(403).json({success:false,code:"MERCHANT_OWNERSHIP_REQUIRED"});
        return null;
      }
    } catch {
      res.status(503).json({success:false,code:"MERCHANT_OWNERSHIP_UNAVAILABLE"});
      return null;
    }
    return {uid};
  }

  router.get("/me", async (req, res) => {
    const actor = await admit(req,res);
    if (!actor) return;
    try {
      const original = await deps.store.read(actor.uid);
      if (!original) {
        res.status(404).json({success:false,code:"MERCHANT_ACCOUNT_NOT_FOUND"});
        return;
      }
      const profile = safeAccountView(original,actor.uid);
      if (!profile) throw Error("MERCHANT_ACCOUNT_SCOPE_MISMATCH");
      res.status(200).json({success:true,profile});
    } catch {
      res.status(503).json({success:false,code:"MERCHANT_ACCOUNT_READ_UNCONFIRMED"});
    }
  });

  router.post("/me", async (req, res) => {
    const actor = await admit(req,res);
    if (!actor) return;
    if (!enabled()) {
      res.status(503).json({success:false,code:"MERCHANT_ACCOUNT_WRITES_DISABLED",
        error:"Merchant account saving is not activated. No changes were saved."});
      return;
    }
    if (!req.is("application/json")) {
      res.status(415).json({success:false,code:"JSON_REQUIRED"});
      return;
    }
    let patch: MerchantAccountUpdate;
    try {patch = parseMerchantAccountUpdate(req.body);}
    catch (err) {
      const code = err instanceof Error ? err.message : "INVALID_ACCOUNT_UPDATE";
      res.status(code === "FORBIDDEN_ACCOUNT_FIELD" ? 403 : 400)
        .json({success:false,code});
      return;
    }
    try {
      const previous = await deps.store.read(actor.uid);
      if (!previous) {
        res.status(404).json({success:false,code:"MERCHANT_ACCOUNT_NOT_FOUND"});
        return;
      }
      if (!safeAccountView(previous,actor.uid)) throw Error("SCOPE_MISMATCH");
      await deps.store.write(actor.uid,patch);
      // A store write acknowledgement alone is NOT proof of persistence.
      const confirmed = safeAccountView(await deps.store.read(actor.uid),actor.uid);
      if (!confirmed || Object.keys(patch).some(key =>
        confirmed[key as keyof MerchantAccountUpdate] !== patch[key as keyof MerchantAccountUpdate]))
        throw Error("SAVE_UNCONFIRMED");
      res.status(200).json({success:true,profile:confirmed});
    } catch {
      res.status(503).json({success:false,code:"MERCHANT_ACCOUNT_SAVE_UNCONFIRMED",
        error:"Could not verify that your changes were saved."});
    }
  });
  return router;
}
