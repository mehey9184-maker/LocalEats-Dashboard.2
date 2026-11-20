/**
 * L3-N8I — Merchant staging client mutation containment.
 *
 * This is a defense in depth for an isolated, read-only authentication
 * rehearsal. It is NOT a substitute for Firebase Security Rules / backend
 * authorization. The live Production build does not set these stage flags.
 */
export const MERCHANT_STAGING_WRITE_DISABLED =
  "Merchant staging is read-only. No account, shop, menu, profile, order, or storage changes were saved.";

export type MerchantStageFlagEnvironment = {
  VITE_MERCHANT_STAGING_ONLY?: unknown;
  VITE_MERCHANT_PREVIEW_READ_ONLY?: unknown;
};

/**
 * Either staging marker blocks writes. This fails closed even if one flag is
 * accidentally omitted during a staged build after the other is set.
 */
export function isMerchantClientMutationBlocked(env:MerchantStageFlagEnvironment):boolean {
  return env.VITE_MERCHANT_STAGING_ONLY === "true" ||
         env.VITE_MERCHANT_PREVIEW_READ_ONLY === "true";
}

export function assertMerchantClientMutationAllowed(
  env:MerchantStageFlagEnvironment,
):void {
  if (isMerchantClientMutationBlocked(env)) {
    throw new Error(MERCHANT_STAGING_WRITE_DISABLED);
  }
}

/**
 * The caller owns user-visible errors; do not log tokens, profile content or
 * user-supplied operation names from this low-level guard.
 */
export function ensureMerchantClientMutationAllowed():void {
  assertMerchantClientMutationAllowed(import.meta.env);
}
