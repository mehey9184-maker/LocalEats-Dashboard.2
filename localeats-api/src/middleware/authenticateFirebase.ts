import { Request, Response, NextFunction } from "express";
import { authAdmin } from "../lib/firebaseAdmin.js";

export interface AuthenticatedRequest extends Request {
  authUser?: {
    uid: string;
    email: string | null;
    isAnonymous?: boolean;
  };
}

export const getFirebaseBearerToken = (
  authorizationHeader: string | undefined
): string | null => {
  if (!authorizationHeader || !authorizationHeader.startsWith("Bearer fb-")) {
    return null;
  }

  return authorizationHeader.slice("Bearer fb-".length);
};

export const authenticateFirebase = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = getFirebaseBearerToken(req.headers.authorization);
    if (token === null) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    // R4.8 draft-only security fix: reject revoked and disabled accounts.
    // Firebase Admin checks revocation with an additional backend lookup.
    // Do not deploy without isolated auth tests, latency review and owner release approval.
    const decoded = await authAdmin.verifyIdToken(token, true);
    if (typeof decoded?.uid !== "string" || !decoded.uid ||
        decoded.uid.length > 160 || decoded.uid.trim() !== decoded.uid ||
        /[\s\x00-\x1f\x7f]/.test(decoded.uid)) {
      throw new Error("INVALID_VERIFIED_UID");
    }

    req.authUser = {
      uid: decoded.uid,
      email: decoded.email || null,
      isAnonymous: decoded.firebase?.sign_in_provider === "anonymous",
    };

    next();
  } catch (error) {
    console.error("Firebase auth error:", error);
    res.status(401).json({ success: false, error: "Unauthorized" });
  }
};
