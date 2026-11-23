/**
 * CF2 BUILD-ONLY Firebase Admin dependency compatibility probe.
 * Never deploy this entrypoint. No initializeApp(), credentials, token reads,
 * database, notifications, FCM sends, accounts or request writes.
 *
 * Wrangler --dry-run tests bundling only. Passing does NOT prove runtime,
 * revoked-token enforcement, disabled-account checks, network or FCM delivery.
 */
import {getApps} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getMessaging} from "firebase-admin/messaging";

export const canImportAdminLibraries =
  typeof getApps === "function" &&
  typeof getAuth === "function" &&
  typeof getMessaging === "function";

export default {
  async fetch() {
    // Not wired to production or staging; CI must never deploy this probe.
    return Response.json({
      api_ready:false,
      auth_enabled:false,
      fcm_enabled:false,
      canImportAdminLibraries,
      code:"CF2_BUILD_ONLY_NOT_RUNTIME_VERIFIED"
    },{status:503,headers:{"Cache-Control":"no-store"}});
  }
};
