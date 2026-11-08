import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import {assertR52EStagingSafety} from "./r52eStagingSafety.js";

dotenv.config();

// No Production behavior changes unless the isolated API explicitly opts in.
assertR52EStagingSafety(process.env);

const supabaseUrl = process.env.SUPABASE_URL || "https://dummy.supabase.co";
const supabaseServiceRoleKey = process.env.LOCALEATS_STAGING_ONLY === "true"
  ? (process.env.SUPABASE_SECRET_KEY || "dummy_key")
  : (process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy_key");

if (!process.env.SUPABASE_URL || !(process.env.LOCALEATS_STAGING_ONLY === "true"
  ? process.env.SUPABASE_SECRET_KEY : process.env.SUPABASE_SERVICE_ROLE_KEY)) {
  console.warn("Missing Supabase configuration. Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.");
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
