import 'dotenv/config';

async function check() {
  const url = process.env.VITE_SUPABASE_URL + '/rest/v1/?apikey=' + process.env.VITE_SUPABASE_ANON_KEY;
  const res = await fetch(url);
  const json = await res.json();
  const def = json.definitions.rider_connections;
  console.log(JSON.stringify(def.properties, null, 2));
  console.log("Required:", def.required);
  process.exit(0);
}
check();
