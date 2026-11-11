import React, { useEffect, useState } from "react";
import { Download, Smartphone, X, Share2 } from "lucide-react";
import {
  appAlreadyInstalled,
  appleMobileBrowser,
  availableInstallEvent,
  consumeInstallEvent,
  deferInstallOffer,
  hasDeferredInstall,
  subscribeToInstallability,
} from "../services/pwaInstallInvite";

type Props = {
  eligible: boolean;
  appName: string;
  storageKey: string;
  variant: "customer" | "merchant";
};

/**
 * An invitation, not an installation promise.
 * Requires a verified login and a settled home view (provided by the parent).
 * Chromium prompts only from a real click. iOS has a manual home-screen flow.
 */
export function InstallAppInvite({ eligible, appName, storageKey, variant }: Props) {
  const [, rerender] = useState(0);
  const [ready, setReady] = useState(false);
  const [dismissedHere, setDismissedHere] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState("");

  useEffect(() => subscribeToInstallability(() => rerender((v) => v + 1)), []);
  useEffect(() => {
    setReady(false);
    if (!eligible) return;
    const timer = window.setTimeout(() => setReady(true), 2800);
    return () => window.clearTimeout(timer);
  }, [eligible]);

  if (!eligible || !ready || dismissedHere || appAlreadyInstalled() || hasDeferredInstall(storageKey)) return null;
  const onAppleDevice = appleMobileBrowser();
  if (!onAppleDevice && !availableInstallEvent() && !help && !busy) return null;

  const later = () => {
    deferInstallOffer(storageKey);
    setDismissedHere(true);
  };
  const install = async () => {
    if (onAppleDevice) { setShowSteps(true); return; }
    const event = consumeInstallEvent();
    if (!event) {
      setHelp("Your browser has not offered installation. Try your browser menu, or choose Maybe later.");
      return;
    }
    // Must be called directly during the user's click, without awaiting first.
    setBusy(true);
    try {
      const response = await event.prompt();
      const outcome = (response && typeof response === "object" ? response.outcome : undefined) ?? (await event.userChoice)?.outcome;
      if (outcome === "accepted" || outcome === "dismissed") {
        // The browser still owns success/failure; appinstalled/standalone confirms an actual install.
        later();
      } else {
        setHelp("Use your browser menu if the installation option did not appear.");
      }
    } catch {
      setHelp("The browser did not open installation. Check its menu for Install app.");
    } finally { setBusy(false); }
  };
  const isMerchant = variant === "merchant";
  return (
    <aside aria-label={`Install ${appName} on your device`}
      className={`fixed inset-x-4 bottom-[calc(6.75rem+env(safe-area-inset-bottom))] md:bottom-6 md:left-auto md:right-6 z-[90] mx-auto md:mx-0 max-w-sm rounded-3xl border shadow-2xl p-4 sm:p-5 ${isMerchant
        ? "bg-surface-container-lowest text-on-surface border-outline-variant/30"
        : "bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-orange-100 dark:border-slate-700"}`}>
      <div className="flex items-start gap-3">
        <div aria-hidden="true" className={`shrink-0 h-11 w-11 rounded-2xl flex items-center justify-center ${isMerchant
          ? "bg-primary/10 text-primary"
          : "bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400"}`}>
          <Smartphone size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-extrabold text-base leading-6">Keep {appName} on your phone</h2>
          <p className={`text-xs leading-5 mt-1 ${isMerchant ? "text-on-surface-variant" : "text-slate-600 dark:text-slate-300"}`}>
            {isMerchant
              ? "Open your shop dashboard from your home screen. Your shop permissions stay the same."
              : "Find local food and your pickup information straight from your home screen."}
          </p>
        </div>
        <button type="button" onClick={later} aria-label="Maybe later — dismiss install offer"
          className="min-h-11 min-w-11 shrink-0 flex items-center justify-center rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
          disabled={busy}><X size={18} aria-hidden="true" /></button>
      </div>
      {onAppleDevice && showSteps && (
        <div role="status" className={`mt-3 rounded-2xl px-3 py-3 text-xs leading-5 ${isMerchant
          ? "bg-surface-container-low"
          : "bg-orange-50 dark:bg-slate-800"}`}>
          <p className="font-bold flex gap-2 items-center"><Share2 size={16} aria-hidden="true" /> Add to Home Screen</p>
          <p className="mt-1">Tap the browser’s <strong>Share</strong> menu, choose <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>. The browser controls installation.</p>
        </div>
      )}
      {help && <p role="status" className="mt-3 text-xs leading-5">{help}</p>}
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={() => { if (onAppleDevice && showSteps) { later(); return; } void install(); }} disabled={busy}
          className={`min-h-11 flex-1 rounded-xl px-4 py-2.5 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 ${isMerchant
            ? "bg-primary text-on-primary hover:opacity-90"
            : "bg-orange-600 text-white hover:bg-orange-700"}`}>
          {onAppleDevice && showSteps ? <Share2 size={17} aria-hidden="true" /> : <Download size={17} aria-hidden="true" />}
          {busy ? "Opening…" : onAppleDevice && showSteps ? "Got it" : "Install now"}
        </button>
        <button type="button" onClick={later} disabled={busy}
          className={`min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 ${isMerchant
            ? "bg-surface-container-high text-on-surface"
            : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"}`}>
          Maybe later
        </button>
      </div>
    </aside>
  );
}
