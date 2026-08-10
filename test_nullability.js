import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const expiresAt = new Date(Date.now() + 1000000).toISOString();
  
  // We will try inserting a completely dummy record without rider_id.
  // Wait, I am not logged in, so it will fail with RLS anyway.
  console.log("Cannot test insert without auth.");
  process.exit(0);
}
check();
