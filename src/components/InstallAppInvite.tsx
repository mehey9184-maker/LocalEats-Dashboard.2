import { useEffect, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";
import {
  AUTO_INSTALL_DELAY_MS,
  appAlreadyInstalled,
  availableInstallEvent,
  deferInstallOffer,
  hasDeferredInstall,
  requestNativeInstall,
  subscribeToInstallability,
} from "../services/pwaInstallInvite";

type Props = {
  eligible: boolean;
  allowAutoShow?: boolean;
  appName: string;
  storageKey: string;
  variant: "customer" | "merchant";
  /** Customer post-review invite can appear immediately; Merchant waits ten minutes. */
  delayMs?: number;
};

/** An optional invitation. Only the browser may install the PWA. */
export function InstallAppInvite({
  eligible, allowAutoShow = true, appName, storageKey, variant,
  delayMs = AUTO_INSTALL_DELAY_MS,
}: Props) {
  const [, updateAvailability] = useState(0);
  const [ready, setReady] = useState(false);
  const [dismissedHere, setDismissedHere] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeToInstallability(() => updateAvailability(v => v + 1)), []);
  useEffect(() => {
    setReady(false);
    if (!eligible) return;
    // Count only visible foreground time; never time spent in a background tab.
    let remaining = Math.max(0, delayMs);
    let startedAt: number | null = null;
    let timer: number | null = null;
    const stop = () => {
      if (timer !== null) { window.clearTimeout(timer); timer = null; }
      if (startedAt !== null) {
        remaining = Math.max(0, remaining - (Date.now() - startedAt));
        startedAt = null;
      }
    };
    const sync = () => {
      stop();
      if (document.visibilityState !== "visible") return;
      if (remaining <= 0) { setReady(true); return; }
      startedAt = Date.now();
      timer = window.setTimeout(() => {
        startedAt = null;
        timer = null;
        remaining = 0;
        setReady(true);
      }, remaining);
    };
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => { stop(); document.removeEventListener("visibilitychange", sync); };
  }, [eligible, delayMs]);

  const available = Boolean(availableInstallEvent()) && !appAlreadyInstalled();
  const show = eligible && allowAutoShow && ready && !dismissedHere &&
    !hasDeferredInstall(storageKey) && available;
  if (!show) return null;

  const later = () => {
    deferInstallOffer(storageKey);
    setDismissedHere(true);
  };
  const install = async () => {
    setBusy(true);
    try {
      // requestNativeInstall invokes the browser prompt before its first await;
      // this call must remain inside a real user click handler.
      const outcome = await requestNativeInstall();
      if (outcome === "dismissed") later();
      if (outcome === "accepted") setDismissedHere(true);
    } finally { setBusy(false); }
  };
  const merchant = variant === "merchant";
  return (
    <aside aria-label={`Install ${appName} on your device`}
      className={`fixed inset-x-4 bottom-[calc(6.75rem+env(safe-area-inset-bottom))] md:bottom-6 md:left-auto md:right-6 z-[90] mx-auto md:mx-0 max-w-sm rounded-3xl border shadow-2xl p-4 sm:p-5 ${merchant
        ? "bg-surface-container-lowest text-on-surface border-outline-variant/30"
        : "bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-orange-100 dark:border-slate-700"}`}>
      <div className="flex items-start gap-3">
        <div aria-hidden="true" className={`shrink-0 h-11 w-11 rounded-2xl flex items-center justify-center ${merchant
          ? "bg-primary/10 text-primary"
          : "bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400"}`}>
          <Smartphone size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-extrabold text-base leading-6">Keep {appName} on your phone</h2>
          <p className={`text-xs leading-5 mt-1 ${merchant
            ? "text-on-surface-variant"
            : "text-slate-600 dark:text-slate-300"}`}>
            {merchant ? "Open your shop dashboard from your home screen."
              : "Find your next local kota right from your home screen."}
          </p>
        </div>
        <button type="button" onClick={later} aria-label="Maybe later — dismiss install offer"
          disabled={busy}
          className="min-h-11 min-w-11 shrink-0 flex items-center justify-center rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={() => { void install(); }} disabled={busy}
          className={`min-h-11 flex-1 rounded-xl px-4 py-2.5 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 ${merchant
            ? "bg-primary text-on-primary hover:opacity-90"
            : "bg-orange-600 text-white hover:bg-orange-700"}`}>
          <Download size={17} aria-hidden="true" />
          {busy ? "Opening…" : "Install now"}
        </button>
        <button type="button" onClick={later} disabled={busy}
          className={`min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 ${merchant
            ? "bg-surface-container-high text-on-surface"
            : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"}`}>
          Maybe later
        </button>
      </div>
    </aside>
  );
}
