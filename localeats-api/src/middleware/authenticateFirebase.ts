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

  const token = authorizationHeader.slice("Bearer fb-".length);
  return token && !/\s/.test(token) ? token : null;
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

    const decoded = await authAdmin.verifyIdToken(token, true);

    req.authUser = {
      uid: decoded.uid,
      email: decoded.email || null,
      isAnonymous: decoded.firebase?.sign_in_provider === "anonymous",
    };

    next();
  } catch (error) {
    // Never log token contents or provider error payloads.
    void error;
    console.warn("Firebase authentication rejected");
    res.status(401).json({ success: false, error: "Unauthorized" });
  }
};
