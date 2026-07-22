import { toast } from "sonner";

export interface LoggedNetworkError {
  id: string;
  timestamp: string;
  context: string;
  message: string;
  code?: string;
  details?: string;
}

const MAX_LOG_ENTRIES = 10;
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

export const logNetworkError = (context: string, error: unknown): LoggedNetworkError => {
  const errObj = error as Record<string, unknown> | null;
  const code = errObj?.code ? String(errObj.code) : undefined;
  const message = errObj?.message ? String(errObj.message) : (error instanceof Error ? error.message : String(error));
  const details = errObj?.details ? String(errObj.details) : (errObj?.hint ? String(errObj.hint) : undefined);

  const entry: LoggedNetworkError = {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toLocaleTimeString(),
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
