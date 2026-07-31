import { toast } from "sonner";
import { supabase } from "../lib/supabase";

export interface LoggedNetworkError {
  id: string;
  timestamp: string;
  context: string;
  message: string;
  code?: string;
  details?: string;
}

const MAX_LOG_ENTRIES = 20;
const STORAGE_KEY = "localeats_diagnostic_errors_log";

// Global in-memory log of network errors
let errorLogMemory: LoggedNetworkError[] = (() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
})();

export const getLoggedNetworkErrors = (): LoggedNetworkError[] => {
  return [...errorLogMemory];
};

export const clearLoggedNetworkErrors = () => {
  errorLogMemory = [];
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};

/**
 * Sends caught error asynchronously to Supabase app_errors and app_error_logs tables for remote debugging.
 */
export const sendErrorToSupabaseLogs = async (entry: LoggedNetworkError) => {
  try {
    if (!supabase || typeof supabase.from !== "function") return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    if (
      entry.message?.includes("Failed to fetch") ||
      entry.message?.includes("NetworkError") ||
      entry.message?.includes("network") ||
      entry.context?.includes("uncaught") ||
      entry.context?.includes("unhandled")
    ) {
      return;
    }

    let userId: string | null = null;
    try {
      const { data } = await supabase.auth.getUser();
      userId = data?.user?.id || null;
    } catch {
      // ignore
    }

    const payload = {
      user_id: userId,
      context: entry.context,
      message: entry.message,
      exception: entry.message,
      code: entry.code || null,
      details: entry.details || null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      page_url: typeof window !== "undefined" ? window.location.href : null,
      created_at: new Date().toISOString(),
      timestamp: entry.timestamp,
    };

    // Try app_errors primary table first
    await supabase.from("app_errors").insert([payload]).catch(() => {});
    // Also try app_error_logs table as fallback
    await supabase.from("app_error_logs").insert([payload]).catch(() => {});
  } catch {
    // Safe non-blocking execution
  }
};

export const logNetworkError = (context: string, error: unknown): LoggedNetworkError => {
  const errObj = error as Record<string, unknown> | null;
  const code = errObj?.code ? String(errObj.code) : undefined;
  const message = errObj?.message ? String(errObj.message) : (error instanceof Error ? error.message : String(error));
  const details = errObj?.details ? String(errObj.details) : (errObj?.hint ? String(errObj.hint) : undefined);

  const entry: LoggedNetworkError = {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    context,
    message,
    code,
    details,
  };

  errorLogMemory = [entry, ...errorLogMemory].slice(0, MAX_LOG_ENTRIES);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(errorLogMemory));
  } catch {
    // ignore
  }

  // Trigger structured remote logging to Supabase table
  sendErrorToSupabaseLogs(entry);

  return entry;
};

/**
 * Maps Supabase, PostgreSQL, and HTTP network errors into user-friendly notifications.
 */
export const mapSupabaseError = (error: unknown, fallbackMessage?: string): { message: string; code?: string } => {
  if (!error) {
    return { message: fallbackMessage || "An unexpected error occurred." };
  }

  const errObj = error as Record<string, unknown>;
  const code = errObj?.code ? String(errObj.code) : undefined;
  const rawMsg = errObj?.message ? String(errObj.message) : (error instanceof Error ? error.message : String(error));

  if (
    rawMsg?.toLowerCase().includes("jwt expired") ||
    rawMsg?.toLowerCase().includes("token expired") ||
    rawMsg?.toLowerCase().includes("invalid jwt") ||
    rawMsg?.toLowerCase().includes("jwt claims")
  ) {
    return {
      code: "JWT_EXPIRED",
      message: "Your session has expired. Please sign in again.",
    };
  }

  // PostgreSQL / PostgREST Error Codes
  if (code === "42703" || rawMsg?.includes("column") || rawMsg?.includes("schema cache")) {
    return {
      code,
      message: "Database schema mismatch. Some requested fields are currently unavailable or undergoing maintenance.",
    };
  }

  if (code === "23505" || rawMsg?.includes("duplicate key")) {
    return {
      code,
      message: "An item with this name or identifier already exists in the database.",
    };
  }

  if (code === "23503" || rawMsg?.includes("foreign key")) {
    return {
      code,
      message: "Cannot complete operation because associated database records exist.",
    };
  }

  if (code === "42501" || code === "PGRST301" || rawMsg?.includes("permission") || rawMsg?.includes("row-level security")) {
    return {
      code,
      message: "Access restricted. You don't have permission to modify this record.",
    };
  }

  if (code === "PGRST116") {
    return {
      code,
      message: "The requested record was not found or has been removed.",
    };
  }

  // Network / Fetch Failures
  if (
    rawMsg?.includes("Failed to fetch") ||
    rawMsg?.includes("NetworkError") ||
    rawMsg?.includes("Network request failed") ||
    rawMsg?.includes("offline")
  ) {
    return {
      code: "NETWORK_OFFLINE",
      message: "Network connectivity interrupted. Operating in offline/cached mode.",
    };
  }

  if (rawMsg?.includes("timeout") || rawMsg?.includes("Timeout")) {
    return {
      code: "TIMEOUT",
      message: "Request timed out. Please check your internet connection.",
    };
  }

  return {
    code,
    message: fallbackMessage || rawMsg || "A temporary database connection error occurred.",
  };
};

/**
 * Centralized error handler function to log and display friendly user notifications.
 */
export const handleCentralizedError = (
  error: unknown,
  context: string,
  fallbackMessage?: string,
  showToast = true
): string => {
  logNetworkError(context, error);
  const { message } = mapSupabaseError(error, fallbackMessage);

  if (showToast) {
    toast.error(message, {
      description: context ? `Context: ${context}` : undefined,
      duration: 4500,
    });
  }

  return message;
};

/**
 * Attaches global uncaught error and promise rejection listeners for app_errors remote logging.
 */
export const initGlobalErrorLogging = () => {
  if (typeof window === "undefined") return;

  window.addEventListener("error", (event) => {
    if (event.filename?.includes("chrome-extension")) return;
    const msg = String(event.error?.message || event.message || "");
    if (
      msg.includes("Failed to fetch") ||
      msg.includes("network") ||
      msg.includes("NetworkError") ||
      msg.includes("Load failed") ||
      msg.includes("Lock broken")
    ) {
      return;
    }
    if (msg.includes("Refresh Token")) {
      window.dispatchEvent(new Event("force_logout"));
      return;
    }
    logNetworkError("window_uncaught_error", event.error || event.message);
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reasonStr = event.reason ? String(event.reason.message || event.reason) : String(event.reason || "");
    if (
      reasonStr.includes("Failed to fetch") ||
      reasonStr.includes("network") ||
      reasonStr.includes("NetworkError") ||
      reasonStr.includes("Load failed") ||
      reasonStr.includes("Lock broken") ||
      reasonStr.includes("User denied Geolocation")
    ) {
      return;
    }
    if (reasonStr.includes("Refresh Token")) {
      window.dispatchEvent(new Event("force_logout"));
      return;
    }
    logNetworkError("unhandled_promise_rejection", event.reason);
  });
};
