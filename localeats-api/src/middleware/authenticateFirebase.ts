import { Request, Response, NextFunction } from "express";
import { authAdmin } from "../lib/firebaseAdmin.js";

export interface AuthenticatedRequest extends Request {
  authUser?: {
    uid: string;
    email: string | null;
  };
}

export const authenticateFirebase = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    if (!authHeader.startsWith("Bearer fb-")) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const token = authHeader.replace("Bearer fb-", "");
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
