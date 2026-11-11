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
const listeners = new Set<() => void>();
const publish = () => { for (const callback of listeners) callback(); };

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event: Event) => {
    const candidate = event as BrowserInstallEvent;
    if (typeof candidate.prompt !== "function") return;
    event.preventDefault();
    pendingInstall = candidate;
    publish();
  });
  window.addEventListener("appinstalled", () => {
    installedThisSession = true;
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
  if (nav.standalone === true) return true;
  try {
    return window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches;
  } catch { return false; }
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
export function deferInstallOffer(storageKey: string, days = 14): void {
  try {
    window.localStorage.setItem(storageKey, String(Date.now() + days * 86400000));
  } catch { /* Storage may be disabled: do not interrupt navigation. */ }
}
