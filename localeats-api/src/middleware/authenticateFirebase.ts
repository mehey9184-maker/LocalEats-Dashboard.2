import { Request, Response, NextFunction } from "express";
import { authAdmin } from "../lib/firebaseAdmin.js";

export interface AuthenticatedRequest extends Request {
  authUser?: {
    uid: string;
    email: string | null;
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

    const decoded = await authAdmin.verifyIdToken(token);

    req.authUser = {
      uid: decoded.uid,
      email: decoded.email || null,
    };

    next();
  } catch (error) {
    console.error("Firebase auth error:", error);
    res.status(401).json({ success: false, error: "Unauthorized" });
  }
};
