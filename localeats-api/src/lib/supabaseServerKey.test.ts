import test from "node:test";
import assert from "node:assert/strict";
import {resolveSupabaseServerKey} from "./supabaseServerKey.js";

const stage:NodeJS.ProcessEnv={
 VERCEL_ENV:"preview", LOCALEATS_STAGING_ONLY:"true",
 FIREBASE_PROJECT_ID:"localeats-staging",
 PICKUP_WRITES_ENABLED:"false",
 SUPABASE_URL:"https://rgpbdajhlrwfmhopzgzk.supabase.co",
 SUPABASE_SECRET_KEY:"sb_secret_synthetic_key_only"
};
test("only dedicated isolated staging accepts modern Supabase secret fallback",()=>{
 assert.equal(resolveSupabaseServerKey(stage),"sb_secret_synthetic_key_only");
 for(const env of [
  {...stage,VERCEL_ENV:"production"},
  {...stage,LOCALEATS_STAGING_ONLY:"false"},
  {...stage,FIREBASE_PROJECT_ID:"localeats-5e26e"},
  {...stage,PICKUP_WRITES_ENABLED:"true"},
  {...stage,SUPABASE_URL:"https://phdjumtqkooyppxozqsi.supabase.co"},
  {...stage,SUPABASE_SECRET_KEY:"not-a-secret"}
 ])assert.equal(resolveSupabaseServerKey(env),null);
});
test("existing Production service-role path remains unchanged",()=>{
 assert.equal(resolveSupabaseServerKey({VERCEL_ENV:"production",SUPABASE_SERVICE_ROLE_KEY:"production-fixture",SUPABASE_SECRET_KEY:"sb_secret_fixture"}),"production-fixture");
});
