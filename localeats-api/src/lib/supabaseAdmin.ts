import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import {resolveSupabaseServerKey} from "./supabaseServerKey.js";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "https://dummy.supabase.co";
const supabaseServiceRoleKey = resolveSupabaseServerKey() || "dummy_key";

if (!process.env.SUPABASE_URL || !resolveSupabaseServerKey()) {
  console.warn("Missing Supabase configuration. Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.");
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
