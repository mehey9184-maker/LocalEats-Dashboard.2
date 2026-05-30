import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// --- SELF-HEALING / CRASH-RECOVERY PROTOCOL ---
// Prevents persistent white-screens, cached data corruption, and infinite boot failures
try {
  const handleGlobalCrash = (source: string, error: unknown) => {
    console.error(`[Self-Healing] App crash caught via ${source}:`, error);

    // Track consecutive crashes in sessionStorage (which survives manual reload in current tab)
    const consecutiveCrashes = Number(sessionStorage.getItem("localeats_crash_count") || "0");
    const nextCrashCount = consecutiveCrashes + 1;
    sessionStorage.setItem("localeats_crash_count", nextCrashCount.toString());

    // Clean service worker registrations since service worker cache poisoning is a common cause of persistent crashes
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const r of registrations) {
          r.unregister();
        }
      });
    }

    if (nextCrashCount === 1) {
      // Stage 1: Soft clear. Clears only the heavy database JSON cache keys
      // This solves 99% of schema-change or cache corruptions WITHOUT logging the merchant out!
      console.log("[Self-Healing] Stage 1 - Purging heavy model caches & refreshing...");
      try {
        localStorage.removeItem("le_shops");
        localStorage.removeItem("le_orders");
        localStorage.removeItem("le_menu");
      } catch (err) {
        console.error("Local storage remove item failure:", err);
      }
      setTimeout(() => {
        window.location.reload();
      }, 300);
    } else if (nextCrashCount === 2) {
      // Stage 2: Nuclear option. Reset all local states and force recovery
      console.log("[Self-Healing] Stage 2 - Clearing absolute storage & hard refreshing...");
      try {
        localStorage.clear();
        sessionStorage.clear();
        sessionStorage.setItem("localeats_crash_count", "2"); // Retain count
      } catch (err) {
        console.error("Local storage clear failure:", err);
      }
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } else {
      // Stage 3: Prevent infinite refresh loops & show gorgeous, interactive recovery screen
      console.error("[Self-Healing] Stage 3 - Blocking infinite reload. Rendering recovery terminal.");
      
      const rootEl = document.getElementById("root");
      if (rootEl) {
        const errorMessage = error && typeof error === "object" ? String((error as Record<string, unknown>).message || JSON.stringify(error)) : String(error || "Unknown boot failure");
        document.title = "LocalEats - Restoration Mode";
        rootEl.innerHTML = `
          <div style="font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background-color: #0c0a09; color: #f5f5f4; padding: 24px;">
            <div style="max-width: 500px; width: 100%; bg-color: #1c1917; background: #1c1917; border-radius: 16px; border: 1px solid #2e2a24; padding: 32px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); text-align: center;">
              <div style="display: flex; justify-content: center; margin-bottom: 24px;">
                <div style="height: 64px; width: 64px; background: rgba(239, 68, 68, 0.15); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                </div>
              </div>
              
              <h1 style="font-size: 22px; font-weight: 700; color: #ffffff; margin: 0 0 8px 0; letter-spacing: -0.025em;">Restoration Terminal</h1>
              <p style="font-size: 14px; color: #a8a29e; margin: 0 0 24px 0; line-height: 1.5;">The merchant portal experienced a fatal boot error or corrupted database caches. We isolated the session under emergency protocols.</p>
              
              <div style="background-color: #0c0a09; border-radius: 8px; border: 1px solid #2e2a24; padding: 16px; margin-bottom: 24px; text-align: left;">
                <div style="font-size: 10px; font-family: monospace; color: #78716c; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.05em;">Error Trace</div>
                <div style="font-size: 12px; font-family: monospace; color: #f43f5e; word-break: break-all; max-height: 100px; overflow-y: auto; line-height: 1.4;">${errorMessage}</div>
              </div>

              <div style="display: flex; flex-direction: column; gap: 12px;">
                <button id="repair-btn-nuclear" style="background-color: #f97316; font-weight: 600; color: #ffffff; border: none; padding: 12px 24px; font-size: 14px; border-radius: 8px; cursor: pointer; transition: background-color 0.2s ease; width: 100%;">
                  Perform Hard Reset (Clear Storage) & Re-login
                </button>
                <button id="repair-btn-soft" style="background-color: transparent; border: 1px solid #44403c; font-weight: 600; color: #d6d3d1; padding: 12px 24px; font-size: 14px; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; width: 100%;">
                  Just Refresh Page
                </button>
              </div>
              
              <div style="margin-top: 24px; font-size: 12px; color: #78716c;">
                Need assistance? Support email: info@localeatssa.co.za
              </div>
            </div>
          </div>
        </div>
      `;

        document.getElementById("repair-btn-nuclear")?.addEventListener("click", () => {
          try {
            localStorage.clear();
            sessionStorage.clear();
            window.location.reload();
          } catch {
            window.location.reload();
          }
        });

        document.getElementById("repair-btn-soft")?.addEventListener("click", () => {
          try {
            sessionStorage.removeItem("localeats_crash_count");
            window.location.reload();
          } catch {
            window.location.reload();
          }
        });
      }
    }
  };

  // Register unhandled error listeners
  window.addEventListener("error", (event) => {
    const errorMsg = event.error || event.message || "";
    if (String(errorMsg).includes("Extension") || String(event.filename || "").includes("chrome-extension")) {
      return; // Ignore external extensions
    }
    handleGlobalCrash("unhandled error", event.error || event.message);
  });

  window.addEventListener("unhandledrejection", (event) => {
    handleGlobalCrash("unhandled promise rejection", event.reason);
  });

  // Safe timeout to clear crash counts if stable for > 8 seconds
  setTimeout(() => {
    try {
      sessionStorage.removeItem("localeats_crash_count");
    } catch {
      // Fail-silent, optional non-blocking
    }
  }, 8000);

} catch (err) {
  console.error("Critical self-healing initializer failure:", err);
}

/*
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.log('Service worker registration failed: ', err);
    });
  });
}
*/

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
