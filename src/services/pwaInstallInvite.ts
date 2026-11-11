/**
 * Browser-owned PWA install invitation bridge.
 * Imported during app startup so installability is captured before login completes.
 * We never fake installation and never request user data to show an invitation.
 */
export type InstallChoice = "accepted" | "dismissed";
export type BrowserInstallEvent = Event & {
  prompt: () => Promise<{ outcome?: InstallChoice } | void>;
  userChoice?: Promise<{ outcome: InstallChoice }>;
};
let pendingInstall: BrowserInstallEvent | null = null;
let installedThisSession = false;
/** Display only after ten minutes of visible, authenticated app use. */
export const AUTO_INSTALL_DELAY_MS = 10 * 60 * 1000;
export const INSTALL_REMINDER_HOURS = 20;
const installedMarker = "localeats_pwa_installed_verified_v1";
function readInstalledMarker(): boolean {
  try { return window.localStorage.getItem(installedMarker) === "true"; }
  catch { return false; }
}
function saveInstalledMarker(): void {
  try { window.localStorage.setItem(installedMarker, "true"); }
  catch { /* Private-browsing storage can be unavailable. */ }
}
const listeners = new Set<() => void>();
const publish = () => { for (const callback of listeners) callback(); };

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event: Event) => {
    const candidate = event as BrowserInstallEvent;
    if (typeof candidate.prompt !== "function") return;
    event.preventDefault();
    // A browser-provided install prompt is positive evidence this site is
    // installable here. An old local marker may be stale after an uninstall.
    pendingInstall = candidate;
    publish();
  });
  window.addEventListener("appinstalled", () => {
    installedThisSession = true;
    saveInstalledMarker();
    pendingInstall = null;
    publish();
  });
}

export function subscribeToInstallability(callback: () => void) {
  listeners.add(callback);
  return () => { listeners.delete(callback); };
}
export function availableInstallEvent(): BrowserInstallEvent | null {
  return pendingInstall;
}
export function consumeInstallEvent(): BrowserInstallEvent | null {
  const event = pendingInstall;
  pendingInstall = null;
  publish();
  return event;
}
export function appAlreadyInstalled(): boolean {
  if (installedThisSession) return true;
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  const runningStandalone = nav.standalone === true ||
    (() => {
      try {
        return window.matchMedia("(display-mode: standalone)").matches ||
          window.matchMedia("(display-mode: fullscreen)").matches;
      } catch { return false; }
    })();
  if (runningStandalone) {
    installedThisSession = true;
    saveInstalledMarker();
    return true;
  }
  // Helps remember confirmed installations when reopened in a browser tab.
  // Browser storage cannot reliably detect later OS-level uninstallations.
  return readInstalledMarker() && pendingInstall === null;
}
export function appleMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod/i.test(ua) ||
    (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}
export function hasDeferredInstall(storageKey: string, now = Date.now()): boolean {
  try {
    const until = Number(window.localStorage.getItem(storageKey) || 0);
    return Number.isFinite(until) && until > now;
  } catch { return false; }
}
/** "Maybe later" means a 20-hour pause, not fourteen days. */
export function deferInstallOffer(storageKey: string, hours = INSTALL_REMINDER_HOURS): void {
  try {
    window.localStorage.setItem(storageKey, String(Date.now() + hours * 60 * 60 * 1000));
  } catch { /* Storage may be disabled: do not interrupt navigation. */ }
}
