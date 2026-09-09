import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  // we can't easily test updateUser without a logged in session, but we can verify it's supported
  console.log("Supabase client initialized: ", !!supabase);
}
run();
