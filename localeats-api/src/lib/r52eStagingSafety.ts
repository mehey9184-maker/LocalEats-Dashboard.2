/**
 * R5.2E: Opt-in, fail-closed checks ONLY for the dedicated, nondeploying
 * LocalEats API staging project. Do not infer cloud account provenance from
 * string equality alone; the owner must verify secret origin separately.
 *
 * Never log, return, or persist credential values.
 */
type StageEnvironment = Record<string, string | undefined>;
const expectedFirebaseProject = "localeats-staging";
const expectedSupabaseUrl = "https://rgpbdajhlrwfmhopzgzk.supabase.co";
const disabledFlags = [
  "PICKUP_WRITES_ENABLED",
  "PROFILE_WRITES_ENABLED",
  "RIDER_ACTIVATION_ENABLED",
  "REWARDS_ACTIVATION_ENABLED",
  "LOCALPAY_LIVE_WALLET_ENABLED",
] as const;

export function r52eStagingCredentialIssues(env: StageEnvironment): string[] {
  // Every pre-existing Production deployment retains its current behavior.
  if (env.LOCALEATS_STAGING_ONLY !== "true") return [];
  const issues: string[] = [];

  if (env.VERCEL_ENV !== "preview")
    issues.push("PREVIEW_ENV_REQUIRED");
  if (env.FIREBASE_PROJECT_ID !== expectedFirebaseProject)
    issues.push("FIREBASE_PROJECT_MISMATCH");
  const email = env.FIREBASE_CLIENT_EMAIL ?? "";
  if (!email.endsWith("@" + expectedFirebaseProject + ".iam.gserviceaccount.com") ||
      email.includes(" ") || email.startsWith("@"))
    issues.push("FIREBASE_STAGING_SERVICE_IDENTITY_REQUIRED");

  const key = (env.FIREBASE_PRIVATE_KEY ?? "")
    .replace(/^"|"$/g, "")
    .replace(/\\n/g, "\n").trim();
  if (!key.startsWith("-----BEGIN PRIVATE KEY-----") ||
      !key.endsWith("-----END PRIVATE KEY-----"))
    issues.push("FIREBASE_STAGING_PRIVATE_KEY_REQUIRED");

  if (env.FIREBASE_AUTH_EMULATOR_HOST)
    issues.push("HOSTED_FIREBASE_EMULATOR_FORBIDDEN");
  if (env.SUPABASE_URL !== expectedSupabaseUrl)
    issues.push("STAGING_SUPABASE_PROJECT_REQUIRED");
  // Supabase recommends modern secret keys for server apps. The API supports
  // this variable in staging while the existing Production fallback is intact.
  if (!/^sb_secret_[A-Za-z0-9_-]{12,}$/.test(env.SUPABASE_SECRET_KEY ?? ""))
    issues.push("STAGING_SUPABASE_SECRET_KEY_REQUIRED");
  if ((env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim())
    issues.push("LEGACY_SERVICE_ROLE_MUST_BE_UNSET_IN_STAGING");

  const customerOrigin = env.CUSTOMER_APP_ORIGIN ?? "";
  try {
    const url = new URL(customerOrigin);
    if (url.protocol !== "https:" ||
        !url.hostname.endsWith(".vercel.app") ||
        url.username || url.password || url.pathname !== "/" ||
        url.search || url.hash) {
      issues.push("CUSTOMER_STAGING_HTTPS_ORIGIN_REQUIRED");
    }
  } catch {
    issues.push("CUSTOMER_STAGING_HTTPS_ORIGIN_REQUIRED");
  }
  for (const flag of disabledFlags) {
    if (env[flag] !== "false")
      issues.push("WRITE_GATE_MUST_BE_FALSE_" + flag);
  }
  return issues;
}

export function assertR52EStagingSafety(env: StageEnvironment): void {
  const problems = r52eStagingCredentialIssues(env);
  if (problems.length) {
    // Codes only, NEVER print a key or token.
    throw new Error("R52E_STAGING_NOT_READY:" + problems.join(","));
  }
}
