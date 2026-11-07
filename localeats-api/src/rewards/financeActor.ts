/**
 * R2.6 TEST-ONLY FINANCIAL AUTH GATE. This module is NOT mounted in Express.
 * The verifier argument must be wired to Firebase Admin verifyIdToken(token, true)
 * from server-only code. Never construct VerifiedFirebaseActor from request body,
 * user_metadata, a client-supplied uid or an ordinary decoded token.
 */
import type {VerifiedFirebaseActor} from "./trustedEvidence.js";

export type FinancialTokenVerifier = (
  token: string, checkRevoked: true
) => Promise<unknown>;

const invalid = (): never => {throw Error("REWARDS_FINANCIAL_AUTH_REQUIRED");};
export async function verifyFinancialActor(
  serverAuthorizationHeader: string | undefined,
  verifyIdToken: FinancialTokenVerifier,
): Promise<VerifiedFirebaseActor> {
  if (typeof serverAuthorizationHeader !== "string" ||
      !serverAuthorizationHeader.startsWith("Bearer fb-")) return invalid();
  const token=serverAuthorizationHeader.slice("Bearer fb-".length);
  if(token.length<8 || token.length>8192 || /\s/.test(token))return invalid();
  let decoded: unknown;
  try {
    // A revoked, expired or disabled user MUST fail; no non-revocation overload.
    decoded=await verifyIdToken(token,true);
  } catch {
    return invalid();
  }
  if (!decoded || typeof decoded!=="object" || Array.isArray(decoded))return invalid();
  const details=decoded as Record<string,unknown>;
  const firebase=details.firebase;
  if(typeof details.uid!=="string" || !details.uid || details.uid.length>160 ||
     details.uid.trim()!==details.uid || /[\x00-\x1f\x7f\s]/.test(details.uid) ||
     !firebase || typeof firebase!=="object" || Array.isArray(firebase) ||
     typeof (firebase as Record<string,unknown>).sign_in_provider!=="string" ||
     !(firebase as Record<string,unknown>).sign_in_provider ||
     (firebase as Record<string,unknown>).sign_in_provider==="anonymous")return invalid();
  return {uid:details.uid,verifiedBy:"firebase-admin-revocation-checked",anonymous:false};
}
