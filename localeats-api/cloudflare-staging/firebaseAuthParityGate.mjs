/**
 * CF2 Firebase identity PARITY CONTRACT ONLY. No Firebase SDK import, secrets,
 * runtime wiring or Cloudflare deployment.
 *
 * The existing admin route verifies ID tokens with checkRevoked=true, while
 * the general authenticateFirebase middleware currently omits this argument.
 * CF2 MUST retain revocation and disabled-account checks on all authenticated
 * routes; this pure dependency-injected gate demonstrates the safe requirement.
 *
 * Identity != merchant ownership, customer resource authorization or admin
 * permission. Those must be verified separately in an isolated backend.
 */
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const JWT=/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export function createRevocationRequiredIdentityGate(verifyIdToken) {
  if (typeof verifyIdToken !== "function")
    throw new Error("CF2_AUTH_PROVIDER_UNAVAILABLE");

  return async function verifiedIdentity(header) {
    if (typeof header !== "string" || !header.startsWith("Bearer fb-") ||
        header.length > 16384) {
      throw new Error("CF2_AUTH_UNAUTHORIZED");
    }
    const token=header.slice("Bearer fb-".length);
    if (!JWT.test(token)) throw new Error("CF2_AUTH_UNAUTHORIZED");

    let decoded;
    try {
      // Deliberately true; no token-only signature verification fallback.
      decoded=await verifyIdToken(token,true);
    } catch {
      // Never emit Firebase tokens, UIDs or provider error details.
      throw new Error("CF2_AUTH_UNAUTHORIZED");
    }

    if (!decoded || typeof decoded.uid !== "string" || !UID.test(decoded.uid) ||
        decoded.disabled === true || decoded.revoked === true) {
      throw new Error("CF2_AUTH_UNAUTHORIZED");
    }
    // This establishes verified identity only; role/ownership must be checked
    // independently by the future authenticated staging API.
    return Object.freeze({
      uid:decoded.uid,
      email:typeof decoded.email==="string" ? decoded.email : null,
      isAnonymous:decoded.firebase?.sign_in_provider==="anonymous"
    });
  };
}
