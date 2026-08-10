import 'dotenv/config';

async function check() {
  const url = process.env.VITE_SUPABASE_URL + '/rest/v1/?apikey=' + process.env.VITE_SUPABASE_ANON_KEY;
  const res = await fetch(url);
  const json = await res.json();
  console.log("Keys of json:", Object.keys(json));
  if (json.definitions) console.log("Definitions:", Object.keys(json.definitions));
  if (json.components && json.components.schemas) console.log("Schemas:", Object.keys(json.components.schemas));
  process.exit(0);
}
check();
