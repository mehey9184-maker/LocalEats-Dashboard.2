import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anon Key is missing. Please check your environment variables.');
}

const isSecretKey = supabaseAnonKey?.startsWith('sb_secret_');
const isProbablyNotSupabaseKey = supabaseAnonKey?.length && supabaseAnonKey.length < 50 && !supabaseAnonKey.startsWith('eyJ');

if (isSecretKey) {
  const msg = 'CRITICAL SECURITY ERROR: You are using a Supabase SECRET key (service_role) in the browser. This is forbidden and will cause the app to crash. Please replace VITE_SUPABASE_ANON_KEY with the public "anon" key in your project secrets.';
  console.error(msg);
  if (typeof window !== 'undefined') {
    console.log('%c' + msg, 'color: white; background: red; font-size: 20px; padding: 10px; border-radius: 5px;');
  }
}

if (isProbablyNotSupabaseKey) {
  const msg = 'WARNING: The Supabase Anon Key looks incorrect. It should be a long JWT string starting with "eyJ". Please check your Supabase dashboard.';
  console.warn(msg);
}

console.log('Supabase initialized with URL:', supabaseUrl ? `${supabaseUrl.substring(0, 10)}...` : 'MISSING');

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
