import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { cleanLocalStorageCache } from './utils/storageCleanup';
import { initTimeSync } from './utils/timeSync';
import { initGlobalErrorLogging } from './utils/errorHandler';
import { initSentry } from './utils/sentry';
import { ErrorBoundary } from './components/ErrorBoundary';

// Initialize Sentry SDK
try {
  initSentry();
} catch {
  // Fail-safe
}

// Run storage cleanup audit, time sync, and global error logging on boot
try {
  cleanLocalStorageCache();
  initTimeSync().catch(() => {});
  initGlobalErrorLogging();
} catch {
  // Fail-safe initialization
}

// --- CRASH-RECOVERY PROTOCOL ---
// Prevents persistent white-screens while preventing infinite reload loops or DOM node removal errors.
try {
  const handleGlobalCrash = (source: string, error: unknown) => {
    console.error(`[Crash Monitor] App error logged via ${source}:`, error);

    // Never destroy offline assets or user data on a single script error.
    // The existing React ErrorBoundary owns visible recovery; do not force
    // reloads that can erase in-progress work and cause startup flicker.
  };

  // Register unhandled error listeners
  window.addEventListener("error", (event) => {
    const rawMsg = event.error?.message || event.message || "";
    const errorMsg = typeof rawMsg === "object" ? JSON.stringify(rawMsg) : String(rawMsg);
    const filename = String(event.filename || "");
    if (filename.includes("chrome-extension") || errorMsg.includes("Extension") || errorMsg.includes("ExtensionContext")) {
      return; // Ignore external extensions
    }
    if (
      !errorMsg ||
      errorMsg === "{}" ||
      errorMsg === "[object Object]" ||
      errorMsg === "undefined" ||
      errorMsg === "null" ||
      errorMsg.includes("Failed to fetch") ||
      errorMsg.includes("network") ||
      errorMsg.includes("NetworkError") ||
      errorMsg.includes("Load failed") ||
      errorMsg.includes("Failed to load") ||
      errorMsg.includes("Script error") ||
      errorMsg.includes("Lock broken") ||
      errorMsg.includes("steal") ||
      errorMsg.toLowerCase().includes("jwt expired") ||
      errorMsg.toLowerCase().includes("token expired") ||
      errorMsg.toLowerCase().includes("refresh token") ||
      errorMsg.toLowerCase().includes("auth session missing") ||
      errorMsg.toLowerCase().includes("session_not_found") ||
      errorMsg.toLowerCase().includes("pgrst301") ||
      errorMsg.toLowerCase().includes("unauthorized") ||
      errorMsg.toLowerCase().includes("401")
    ) {
      return;
    }
    handleGlobalCrash("unhandled error", event.error || event.message);
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
      reasonStr.includes("Failed to load") ||
      reasonStr.includes("User denied Geolocation") ||
      reasonStr.includes("Timeout expired") ||
      reasonStr.includes("position acquisition error") ||
      reasonStr.includes("Script error") ||
      reasonStr.includes("Lock broken") ||
      reasonStr.includes("steal") ||
      reasonStr.toLowerCase().includes("jwt expired") ||
      reasonStr.toLowerCase().includes("token expired") ||
      reasonStr.toLowerCase().includes("refresh token") ||
      reasonStr.toLowerCase().includes("auth session missing") ||
      reasonStr.toLowerCase().includes("session_not_found") ||
      reasonStr.toLowerCase().includes("pgrst301") ||
      reasonStr.toLowerCase().includes("unauthorized") ||
      reasonStr.toLowerCase().includes("401")
    ) {
      return;
    }
    handleGlobalCrash("unhandled promise rejection", event.reason);
  });


} catch (err) {
  console.error("Critical self-healing initializer failure:", err);
}


console.log("[Boot] main.tsx executing");
const rootElement = document.getElementById('root');
console.log("[Boot] root element found:", !!rootElement);
console.log("[Boot] React render requested");

ReactDOM.createRoot(rootElement!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
