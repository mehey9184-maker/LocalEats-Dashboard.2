import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const expiresAt = new Date(Date.now() + 1000000).toISOString();
  // Using shop_id = 18 as seen from the db
  const { data, error } = await supabase.from("rider_connections").insert({
    shop_id: 18,
    connection_code: code,
    expires_at: expiresAt,
    status: "active",
  });
  console.log("Insert result:", { data, error });
}
check();
