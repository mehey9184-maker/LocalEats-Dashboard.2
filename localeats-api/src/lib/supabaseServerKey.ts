/** Vercel stages use the newer sb_secret key; Production retains its
 * existing service-role credential behavior. Never send this key to a client.
 */
export function resolveSupabaseServerKey(env:NodeJS.ProcessEnv=process.env):string|null {
  if(env.SUPABASE_SERVICE_ROLE_KEY)return env.SUPABASE_SERVICE_ROLE_KEY;
  if(env.VERCEL_ENV==="preview" && env.LOCALEATS_STAGING_ONLY==="true" &&
     env.FIREBASE_PROJECT_ID==="localeats-staging" &&
     env.PICKUP_WRITES_ENABLED==="false" &&
     env.SUPABASE_URL==="https://rgpbdajhlrwfmhopzgzk.supabase.co" &&
     env.SUPABASE_SECRET_KEY && env.SUPABASE_SECRET_KEY.startsWith("sb_secret_"))
    return env.SUPABASE_SECRET_KEY;
  return null;
}
