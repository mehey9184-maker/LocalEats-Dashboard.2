import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('shop_connections').select('*').limit(1);
  console.log("shop_connections:", data, error);
  process.exit(0);
}
check();
