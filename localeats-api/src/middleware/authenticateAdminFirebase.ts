import {beforeFirebaseVerification,afterFirebaseVerification} from "./apiAdmission.js";
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

    if (!beforeFirebaseVerification(res)) return;
    const decoded = await authAdmin.verifyIdToken(token, true);
    if (!afterFirebaseVerification(res,decoded.uid)) return;

    req.authUser = {
      uid: decoded.uid,
      email: decoded.email || null,
    };

    next();
  } catch (error) {
    void error;
    console.warn("Admin Firebase authentication rejected");
    res.status(401).json({ success: false, error: "Unauthorized" });
  }
};
