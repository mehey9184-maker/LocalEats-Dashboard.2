/**
 * L3-N8G: a *single* explicitly configured, isolated Merchant staging
 * browser Origin may call the existing dedicated API Preview.
 *
 * Not a new API route, write permission, session or deployment. Firebase
 * verification, shop ownership and previewReadOnlyGate still apply.
 * Production and generic PR Previews cannot borrow this exception.
 */
export const MERCHANT_STAGING_ORIGIN =
  "https://localeats-merchant-staging-r52d-mehey9184-makers-projects.vercel.app";

export function isVerifiedMerchantStagingOrigin(
  origin:string|undefined,
  env:NodeJS.ProcessEnv=process.env,
):boolean {
  if (!origin || origin!==MERCHANT_STAGING_ORIGIN ||
      env.MERCHANT_STAGING_ORIGIN!==MERCHANT_STAGING_ORIGIN) return false;
  return env.VERCEL_ENV==="preview" &&
    env.LOCALEATS_STAGING_ONLY==="true" &&
    env.FIREBASE_PROJECT_ID==="localeats-staging" &&
    env.SUPABASE_URL==="https://rgpbdajhlrwfmhopzgzk.supabase.co" &&
    env.PICKUP_WRITES_ENABLED==="false" &&
    env.PROFILE_WRITES_ENABLED==="false" &&
    env.MERCHANT_AVAILABILITY_WRITES_ENABLED!=="true" &&
    env.MERCHANT_ACCOUNT_WRITES_ENABLED!=="true";
}

