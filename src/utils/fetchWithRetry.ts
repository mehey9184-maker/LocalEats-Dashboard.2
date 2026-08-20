import { supabase, isSupabaseMocked } from "../lib/supabase";

/**
 * Global fetch wrapper with retry logic to handle intermittent "Failed to fetch" errors.
 */
export async function fetchWithRetry<T>(
  fn: () => Promise<{ data: T | null; error: unknown }>,
  retries = 3,
  delay = 1000,
): Promise<{ data: T | null; error: { message: string } | null }> {
  let lastError: { message: string } | null = null;
  for (let i = 0; i < retries; i++) {
    try {
      const result = await fn();
      const { error } = result as {
        data: T | null;
        error: { message: string; code?: string } | null;
      };
      if (!error) return result as { data: T | null; error: null };
      lastError = error;

      // Automatically refresh session if JWT has expired
      const isJwtExpired =
        error.message?.toLowerCase().includes("jwt expired") ||
        error.message?.toLowerCase().includes("token expired") ||
        error.message?.toLowerCase().includes("invalid jwt") ||
        error.code === "PGRST301";

      if (isJwtExpired && !isSupabaseMocked()) {
        try {
          const { data: refreshData, error: refreshErr } = await supabase.auth.refreshSession();
          if (!refreshErr && refreshData?.session) {
            // Session refreshed successfully, retry original call
            const retryResult = await fn();
            const { error: retryError } = retryResult as {
              data: T | null;
              error: { message: string } | null;
            };
            if (!retryError) return retryResult as { data: T | null; error: null };
            lastError = retryError;
          } else {
            if (typeof window !== "undefined") {
              window.dispatchEvent(new Event("force_logout"));
            }
          }
        } catch {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("force_logout"));
          }
        }
      }

      // Only retry on network errors or Failed to fetch
      if (
        !error.message?.includes("Failed to fetch") &&
        !error.message?.includes("network") &&
        !error.message?.includes("FetchError")
      ) {
        return result as { data: T | null; error: { message: string } | null };
      }
    } catch (err) {
      if (err instanceof Error) {
        lastError = { message: err.message.includes("Failed to fetch") ? "Failed to fetch" : err.message };
      } else {
        lastError = { message: String(err) };
      }
    }

    if (i < retries - 1) {
      await new Promise((r) => setTimeout(r, delay * (i + 1)));
    }
  }
  return { data: null, error: lastError };
}
