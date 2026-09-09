import { Response, NextFunction } from "express";
import { authAdmin } from "../lib/firebaseAdmin.js";
import {
  AuthenticatedRequest,
  getFirebaseBearerToken,
} from "./authenticateFirebase.js";

export const authenticateAdminFirebase = async (
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
    };

    next();
  } catch (error) {
    console.error("Admin Firebase auth error:", error);
    res.status(401).json({ success: false, error: "Unauthorized" });
  }
};
