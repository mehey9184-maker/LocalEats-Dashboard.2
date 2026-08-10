import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('rider_connections').select('*').limit(1);
  console.log("Data keys:", data ? Object.keys(data[0]) : null);
  console.log("Error:", error);
}
check();
