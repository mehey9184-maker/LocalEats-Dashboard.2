require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const { data: { user }, error: authErr } = await supabase.auth.signInWithPassword({
    email: "aviwenotununu4@gmail.com",
    password: "password" // wait I don't know the user's password.
  });
  
  // I will just fetch a shop id that belongs to this user. Wait, I don't have the password.
  console.log("No password, so I'll just see what happens if I query without auth, or maybe I'll use the service role key if it's there.");
}
test();
