import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('rider_connections').select('*').is('rider_id', null).limit(1);
  console.log("null rider_id data:", data, error);
  process.exit(0);
}
check();
