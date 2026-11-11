import { Router } from "express";
import { getApps } from "firebase-admin/app";

const router = Router();

router.get("/", (_req, res) => {
  res.json({status:"ok",service:"localeats-api"});
});

/**
 * Operational readiness is NOT uptime. Missing Firebase Admin means that
 * protected orders, authenticated devices and push delivery cannot operate.
 * Keep this public diagnostic free from customer IDs, tokens and secrets.
 */
export function launchReadiness(firebaseReady:boolean,pickupEnabled:boolean,allowlisted:boolean) {
  return {
    status:firebaseReady && pickupEnabled && allowlisted ? "candidate" : "blocked",
    firebase_admin_ready:firebaseReady,
    controlled_pickup_configured:pickupEnabled && allowlisted,
    // A valid config is not proof of FCM delivery, payment or owner acceptance.
    human_acceptance_required:true
  } as const;
}
router.get("/launch-readiness",(_req,res)=>{
  const firebaseReady=getApps().length>0;
  const enabled=process.env.PICKUP_WRITES_ENABLED==="true";
  const allowed=typeof process.env.PICKUP_TEST_CUSTOMER_UID==="string" &&
    process.env.PICKUP_TEST_CUSTOMER_UID.length>0;
  const report=launchReadiness(firebaseReady,enabled,allowed);
  // Always return a non-cached, honest readiness result; not a misleading
  // healthy response when Firebase Admin is missing.
  res.set("Cache-Control","no-store");
  res.status(report.status==="candidate" ? 200 : 503).json(report);
});

export default router;
