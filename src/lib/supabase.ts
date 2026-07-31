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

export const isSupabaseMocked = () => {
  return !supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder') || supabaseAnonKey === 'your-anon-key';
};

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
const createMockThenable = (targetPath = ""): any => {
  const mock: any = () => createMockThenable(targetPath + "()");
  
  mock.then = (onFulfilled: any) => {
    const result = { data: null, error: { message: "Supabase is unconfigured in this environment." } };
    return Promise.resolve(onFulfilled ? onFulfilled(result) : result);
  };
  
  mock.catch = (onRejected: any) => {
    return Promise.resolve();
  };

  mock.subscribe = () => mock;
  mock.on = () => mock;
  mock.getPublicUrl = () => ({ data: { publicUrl: "" } });
  
  return new Proxy(mock, {
    get(target, prop) {
      if (prop === "then") return target.then;
      if (prop === "catch") return target.catch;
      if (prop === "subscribe") return target.subscribe;
      if (prop === "on") return target.on;
      if (prop === "getPublicUrl") return target.getPublicUrl;
      
      if (prop === "getSession") {
        return () => Promise.resolve({ data: { session: null }, error: null });
      }
      if (prop === "onAuthStateChange") {
        return (callback: any) => {
          callback("SIGNED_OUT", null);
          return { data: { subscription: { unsubscribe: () => {} } } };
        };
      }
      if (prop === "signOut") {
        return () => Promise.resolve({ error: null });
      }
      
      return createMockThenable(targetPath + "." + String(prop));
    }
  });
};
/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

const resilientFetch: typeof fetch = async (input, init) => {
  try {
    const res = await fetch(input, init);
    return res;
  } catch (err: unknown) {
    const errorObj = err as Error;
    if (errorObj?.name === 'TypeError' || errorObj?.message?.includes('Failed to fetch')) {
      console.warn('[Supabase Resilient Fetch] Intercepted network connection error:', errorObj.message);
      return new Response(
        JSON.stringify({ data: null, error: { message: 'Network connection unavailable. Falling back to cache.' } }),
        {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    throw err;
  }
};

const isMocked = isSupabaseMocked();

export const supabase = isMocked 
  ? createMockThenable("supabase") 
  : createClient(supabaseUrl || '', supabaseAnonKey || '', {
      global: {
        fetch: resilientFetch,
      },
    });

export const getSupabase = () => supabase;

// The official dashboard URL for LocalEats South Africa
export const DASHBOARD_URL = 'https://dashboard.localeatssa.co.za';
