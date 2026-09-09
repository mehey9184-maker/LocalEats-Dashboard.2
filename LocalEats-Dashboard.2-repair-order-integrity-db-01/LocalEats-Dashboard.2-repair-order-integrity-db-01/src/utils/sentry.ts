import * as Sentry from "@sentry/react";

/**
 * Initializes the Sentry SDK for client-side error monitoring and performance tracking.
 * Requires VITE_SENTRY_DSN environment variable.
 */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  if (!dsn) {
    console.log("[Sentry] VITE_SENTRY_DSN not set. Sentry active in manual/standby mode.");
    return;
  }

  try {
    Sentry.init({
      dsn,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: false,
          blockAllMedia: false,
        }),
      ],
      tracesSampleRate: 0.2,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      environment: import.meta.env.MODE || "development",
      ignoreErrors: [
        "Failed to fetch",
        "NetworkError",
        "Network request failed",
        "Load failed",
        "Lock broken",
        "steal",
        "User denied Geolocation",
        "JWT expired",
        "token expired",
        "refresh token",
        "{}",
        "[object Object]",
      ],
    });
    console.log("[Sentry] Sentry SDK initialized successfully for vendor-js.");
  } catch (err) {
    console.warn("[Sentry] Initialization failed:", err);
  }
}

/**
 * Captures custom exception or string error to Sentry.
 */
export function captureErrorToSentry(error: unknown, context?: string) {
  try {
    const errStr = typeof error === "object" ? JSON.stringify(error) : String(error || "");
    if (
      !errStr ||
      errStr === "{}" ||
      errStr === "[object Object]" ||
      errStr.includes("Lock broken") ||
      errStr.includes("steal") ||
      errStr.includes("Failed to fetch")
    ) {
      return;
    }
    if (context) {
      Sentry.setTag("context", context);
    }
    Sentry.captureException(error);
  } catch {
    // Fail-safe
  }
}

export { Sentry };
