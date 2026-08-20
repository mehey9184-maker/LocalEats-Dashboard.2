import { toast } from "sonner";
import { captureErrorToSentry } from "./sentry";

export interface LoggedNetworkError {
  id: string;
  timestamp: string;
  context: string;
  message: string;
  code?: string;
  closeCode?: number;
  closeReason?: string;
  details?: string;
  latencyMs?: number;
  type?: "websocket" | "api_gateway" | "database" | "offline_sync" | "general";
}

export function getWebSocketCloseCodeInfo(code: number): { name: string; description: string; isFatal: boolean } {
  switch (code) {
    case 1000:
      return { name: "1000 Normal Closure", description: "Connection closed normally.", isFatal: false };
    case 1001:
      return { name: "1001 Going Away", description: "Endpoint server restarted or client navigated away.", isFatal: false };
    case 1002:
      return { name: "1002 Protocol Error", description: "WebSocket protocol error detected.", isFatal: true };
    case 1003:
      return { name: "1003 Unsupported Data", description: "Unsupported frame data type received.", isFatal: true };
    case 1005:
      return { name: "1005 No Status Code", description: "Connection closed without status code.", isFatal: true };
    case 1006:
      return { name: "1006 Abnormal Closure", description: "Connection lost without close frame (Network drop or connection timeout).", isFatal: true };
    case 1007:
      return { name: "1007 Invalid Payload", description: "Inconsistent frame payload format.", isFatal: true };
    case 1008:
      return { name: "1008 Policy Violation", description: "Connection terminated due to security policy.", isFatal: true };
    case 1009:
      return { name: "1009 Message Too Big", description: "Message payload exceeded maximum allowed frame size.", isFatal: true };
    case 1011:
      return { name: "1011 Server Error", description: "Realtime server encountered an unexpected failure.", isFatal: true };
    case 1012:
      return { name: "1012 Service Restart", description: "Supabase Realtime engine restarting.", isFatal: false };
    case 1013:
      return { name: "1013 Try Again Later", description: "Realtime server temporary load shedding.", isFatal: false };
    case 1015:
      return { name: "1015 TLS Failure", description: "TLS handshake error during WebSocket negotiation.", isFatal: true };
    case 4000:
      return { name: "4000 Realtime Error", description: "Supabase Realtime subscription configuration error.", isFatal: true };
    case 4001:
      return { name: "4001 Unauthorized", description: "Invalid auth token or insufficient RLS channel permissions.", isFatal: true };
    case 4002:
      return { name: "4002 Rate Limited", description: "Realtime message rate limit exceeded.", isFatal: true };
    case 4003:
      return { name: "4003 Token Expired", description: "Realtime auth token expired.", isFatal: true };
    case 4004:
      return { name: "4004 Connection Timeout", description: "Supabase Realtime connection timed out.", isFatal: true };
    default:
      return { name: `${code} Custom Code`, description: `WebSocket terminated with close code ${code}.`, isFatal: code >= 1002 };
  }
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

    // Forward exception to Sentry
    captureErrorToSentry(entry.message, entry.context);
  } catch {
    // Safe non-blocking execution
  }
};

export const logNetworkError = (
  context: string,
  error: unknown,
  options?: {
    code?: string;
    closeCode?: number;
    closeReason?: string;
    details?: string;
    latencyMs?: number;
    type?: "websocket" | "api_gateway" | "database" | "offline_sync" | "general";
  }
): LoggedNetworkError => {
  const errObj = error as Record<string, unknown> | null;
  const code = options?.code || (errObj?.code ? String(errObj.code) : undefined);
  let message = "An unexpected notice occurred";
  if (errObj?.message) {
    message = String(errObj.message);
  } else if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "string" && error.trim() !== "") {
    message = error;
  } else if (error && typeof error === "object") {
    const json = JSON.stringify(error);
    message = json !== "{}" ? json : "Network or database connection notice";
  } else if (error) {
    message = String(error);
  }
  const details = options?.details || (errObj?.details ? String(errObj.details) : (errObj?.hint ? String(errObj.hint) : undefined));

  // Determine error classification type if omitted
  let errorType: "websocket" | "api_gateway" | "database" | "offline_sync" | "general" = options?.type || "general";
  if (!options?.type) {
    if (context.includes("websocket") || context.includes("realtime") || options?.closeCode) {
      errorType = "websocket";
    } else if (context.includes("offline") || context.includes("sync")) {
      errorType = "offline_sync";
    } else if (context.includes("api") || context.includes("gateway") || context.includes("ping")) {
      errorType = "api_gateway";
    } else if (code || context.includes("supabase") || context.includes("db")) {
      errorType = "database";
    }
  }

  const entry: LoggedNetworkError = {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    context,
    message,
    code,
    closeCode: options?.closeCode,
    closeReason: options?.closeReason,
    details,
    latencyMs: options?.latencyMs,
    type: errorType,
  };

  errorLogMemory = [entry, ...errorLogMemory].slice(0, MAX_LOG_ENTRIES);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(errorLogMemory));
  } catch {
    // ignore
  }

  // Dispatch window event so Diagnostic UI components update instantly
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("diagnostic_log_updated"));
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

export const formatAuthError = (err: unknown, isSignUp: boolean = false): string => {
  if (!err) return isSignUp ? "Unable to create account. Please check your details and try again." : "An unexpected error occurred. Please try again.";
  let msg = "";
  if (typeof err === "string") {
    msg = err;
  } else if (typeof err === "object" && err !== null) {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === "string" && obj.message) {
      msg = obj.message;
    } else if (typeof obj.error_description === "string" && obj.error_description) {
      msg = obj.error_description;
    } else if (typeof obj.msg === "string" && obj.msg) {
      msg = obj.msg;
    } else if (typeof obj.description === "string" && obj.description) {
      msg = obj.description;
    } else {
      try {
        const json = JSON.stringify(err);
        if (json !== "{}" && json !== "[]") msg = json;
      } catch {
        msg = "";
      }
    }
  }

  msg = msg.trim();

  if (!msg || msg === "{}" || msg === "[object Object]" || msg === "null" || msg === "undefined") {
    return isSignUp
      ? "Unable to create account. Please check your details and try again."
      : "Invalid email or password. Please check your details and try again.";
  }

  const lower = msg.toLowerCase();

  // Specific Registration / Sign-Up Errors
  if (
    lower.includes("user_already_exists") ||
    lower.includes("user already registered") ||
    lower.includes("already registered") ||
    lower.includes("already been registered") ||
    lower.includes("email address is already in use")
  ) {
    return "An account with this email address already exists. Please sign in instead or click 'Forgot Password'.";
  }

  if (
    lower.includes("password should be at least") ||
    lower.includes("password is too short") ||
    lower.includes("weak_password") ||
    lower.includes("password must be")
  ) {
    return "Password must be at least 6 characters long. Please enter a stronger password.";
  }

  if (
    lower.includes("unable to validate email") ||
    lower.includes("invalid email") ||
    lower.includes("email address is invalid")
  ) {
    return "Please enter a valid email address (e.g. name@example.com).";
  }

  if (lower.includes("signup is disabled") || lower.includes("signups are disabled")) {
    return "Account registration is currently disabled. Please contact system support.";
  }

  // Network / timeout / service error actionable recovery steps
  if (
    lower.includes("timed out") ||
    lower.includes("timeout") ||
    lower.includes("signal is aborted") ||
    lower.includes("failed to fetch") ||
    lower.includes("network_error") ||
    lower.includes("network error") ||
    lower.includes("connection") ||
    lower.includes("503") ||
    lower.includes("service unavailable") ||
    lower.includes("aborted")
  ) {
    return "Network connection unavailable or request timed out. Please check your Wi-Fi or cellular data connection and try again.";
  }

  if (msg.includes("Forbidden use of secret API key")) {
    return 'CRITICAL: You are using a Supabase SECRET key in the browser. Please update your project secrets with the public "anon" key.';
  }
  if (lower.includes("invalid login credentials") || lower.includes("invalid_credentials")) {
    return isSignUp
      ? "Registration failed. Please check your email and password format."
      : "Invalid email or password. Action: Double-check for typos, check caps lock, or click 'Forgot Password' to reset your password.";
  }
  if (lower.includes("email not confirmed")) {
    return "Your email address has not been confirmed yet. Action: Check your inbox and spam folder for the confirmation link.";
  }
  if (lower.includes("user not found")) {
    return "No account found with this email address. Action: Verify the address or click 'Sign Up' to create a new account.";
  }
  if (lower.includes("too many requests") || lower.includes("rate limit")) {
    return "Too many attempts. Action: Please wait 60 seconds before trying again.";
  }

  return msg;
};

export const isNetworkOrTimeout = (errObj: unknown): boolean => {
  if (!errObj) return false;
  let raw = "";
  if (typeof errObj === "string") {
    raw = errObj;
  } else if (typeof errObj === "object" && errObj !== null) {
    const obj = errObj as Record<string, unknown>;
    raw = String(obj.message || obj.error_description || obj.msg || JSON.stringify(errObj));
  } else {
    raw = String(errObj);
  }
  const lower = raw.toLowerCase();
  return (
    lower.includes("timed out") ||
    lower.includes("timeout") ||
    lower.includes("network") ||
    lower.includes("failed to fetch") ||
    lower.includes("service unavailable") ||
    lower.includes("connection") ||
    lower.includes("503") ||
    lower.includes("aborted") ||
    lower.includes("unconfigured") ||
    lower.includes("unexpected error") ||
    lower.includes("unable to create account")
  );
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
    const rawMsg = event.error?.message || event.message || "";
    const msg = typeof rawMsg === "object" ? JSON.stringify(rawMsg) : String(rawMsg);
    if (
      !msg ||
      msg === "{}" ||
      msg === "[object Object]" ||
      msg === "undefined" ||
      msg === "null" ||
      msg.includes("Failed to fetch") ||
      msg.includes("network") ||
      msg.includes("NetworkError") ||
      msg.includes("Load failed") ||
      msg.includes("Lock broken") ||
      msg.includes("steal")
    ) {
      return;
    }
    const lowerMsg = msg.toLowerCase();
    if (
      lowerMsg.includes("refresh token") ||
      lowerMsg.includes("jwt expired") ||
      lowerMsg.includes("token expired") ||
      lowerMsg.includes("session_not_found") ||
      lowerMsg.includes("auth session missing")
    ) {
      window.dispatchEvent(new Event("force_logout"));
      return;
    }
    logNetworkError("window_uncaught_error", event.error || event.message);
  });

  window.addEventListener("unhandledrejection", (event) => {
    const rawReason = event.reason?.message || event.reason || "";
    const reasonStr = typeof rawReason === "object" ? JSON.stringify(rawReason) : String(rawReason);
    if (
      !reasonStr ||
      reasonStr === "{}" ||
      reasonStr === "[object Object]" ||
      reasonStr === "undefined" ||
      reasonStr === "null" ||
      reasonStr.includes("Failed to fetch") ||
      reasonStr.includes("network") ||
      reasonStr.includes("NetworkError") ||
      reasonStr.includes("Load failed") ||
      reasonStr.includes("Lock broken") ||
      reasonStr.includes("steal") ||
      reasonStr.includes("User denied Geolocation")
    ) {
      return;
    }
    const lowerReason = reasonStr.toLowerCase();
    if (
      lowerReason.includes("refresh token") ||
      lowerReason.includes("jwt expired") ||
      lowerReason.includes("token expired") ||
      lowerReason.includes("session_not_found") ||
      lowerReason.includes("auth session missing")
    ) {
      window.dispatchEvent(new Event("force_logout"));
      return;
    }
    logNetworkError("unhandled_promise_rejection", event.reason);
  });
};
