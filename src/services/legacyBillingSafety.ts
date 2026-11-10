/**
 * S1: One-time, same-origin cleanup for a legacy merchant Settings form that
 * incorrectly placed raw card number, expiration and CVV into localStorage.
 *
 * Never read, deserialize, log, migrate, display or forward those values.
 * The entire legacy draft is intentionally discarded. This only affects the
 * browser origin running the updated app; it is not a remote deletion.
 */
export function purgeLegacyBillingDraft():boolean {
  if (typeof window==="undefined")return true;
  try {
    window.localStorage.removeItem("localeats_billing_details");
    return true;
  } catch {
    // The Settings screen must explain the fallback when storage is blocked.
    return false;
  }
}
