import { Request, Response, NextFunction } from "express";
import { authAdmin } from "../lib/firebaseAdmin.js";

export interface AuthenticatedRequest extends Request {
  authUser?: {
    uid: string;
    email: string | null;
    isAnonymous?: boolean;
  };
}

/** Keep the existing Firebase client bearer format; do not accept raw UIDs. */
export const getFirebaseBearerToken = (
  authorizationHeader: string | undefined
): string | null => {
  if (!authorizationHeader || !authorizationHeader.startsWith("Bearer fb-")) {
    return null;
  }
  return authorizationHeader.slice("Bearer fb-".length);
};

type VerifiedFirebaseClaims = {
  uid?: unknown;
  email?: unknown;
  firebase?: {sign_in_provider?: unknown};
};

/**
 * N8D — immutable server-side Firebase verifier, injectable for offline tests.
 * Real Firebase Admin verification MUST request revoked/disabled user checks
 * for every Customer/Merchant/Rider API route that uses this middleware.
 */
export type RevocationAwareFirebaseVerifier =
  (token: string, checkRevoked: true) => Promise<VerifiedFirebaseClaims>;

const validFirebaseUid = (uid: unknown): uid is string =>
  typeof uid === "string" && uid.length > 0 && uid.length <= 128 &&
  ![...uid].some(ch => ch === "/" || ch === "\\" || ch.charCodeAt(0) < 32);

export function makeAuthenticateFirebase(
  verify: RevocationAwareFirebaseVerifier,
) {
  if (typeof verify !== "function") throw Error("FIREBASE_VERIFIER_UNCONFIGURED");
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const token = getFirebaseBearerToken(req.headers.authorization);
      if (!token || token.length > 8192) {
        res.status(401).json({success:false,error:"Unauthorized"});
        return;
      }
      // A signature-valid, unexpired token is insufficient when its account
      // was disabled or its refresh tokens revoked. Fail closed on API errors.
      const decoded = await verify(token, true);
      if (!decoded || !validFirebaseUid(decoded.uid)) {
        res.status(401).json({success:false,error:"Unauthorized"});
        return;
      }
      req.authUser = {
        uid: decoded.uid,
        email: typeof decoded.email === "string" ? decoded.email : null,
        isAnonymous: decoded.firebase?.sign_in_provider === "anonymous",
      };
      next();
    } catch {
      // Never log a bearer token, private user data or provider exception.
      res.status(401).json({success:false,error:"Unauthorized"});
    }
  };
}

export const authenticateFirebase = makeAuthenticateFirebase(
  (token, checkRevoked) => authAdmin.verifyIdToken(token, checkRevoked)
);
