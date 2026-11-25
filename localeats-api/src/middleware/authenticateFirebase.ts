import {beforeFirebaseVerification,afterFirebaseVerification} from "./apiAdmission.js";
import { Request, Response, NextFunction } from "express";
import { authAdmin } from "../lib/firebaseAdmin.js";
import {createProviderBudget,ProviderDeadlineError} from "../lib/providerDeadline.js";

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
  return token && token.length<=8192 && !/\s/.test(token) ? token : null;
};

export const authenticateFirebase = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  let budget:ReturnType<typeof createProviderBudget>|undefined;
  try {
    const token = getFirebaseBearerToken(req.headers.authorization);
    if (token === null) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    if (!beforeFirebaseVerification(res)) return;
    budget=createProviderBudget(5000);
    const decoded = await budget.run(()=>authAdmin.verifyIdToken(token, true));
    budget.close();
    if (!afterFirebaseVerification(res,decoded.uid)) return;

    req.authUser = {
      uid: decoded.uid,
      email: decoded.email || null,
      isAnonymous: decoded.firebase?.sign_in_provider === "anonymous",
    };

    next();
  } catch (error) {
    // Never log token contents or provider error payloads.
    const code=typeof error==="object" && error!==null ? (error as {code?:unknown}).code:undefined;
    if(error instanceof ProviderDeadlineError || code==="auth/internal-error" || code==="app/network-error"){
      res.set("Cache-Control","no-store").set("Retry-After","30").status(503).json({success:false,code:"AUTH_SERVICE_UNAVAILABLE",error:"Authentication temporarily unavailable. Please try again later."});
      return;
    }
    console.warn("Firebase authentication rejected");
    res.status(401).json({ success: false, error: "Unauthorized" });
  }finally{budget?.close();}
};
