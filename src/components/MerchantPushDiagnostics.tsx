import {useState} from "react";
import {
  type BrowserNotificationResult,
  getNotificationWorkers,
  isMessagingWorker,
  readPushSubscription,
  runBrowserNotificationCheck,
} from "../lib/merchantPushDiagnostics";

const browserResults: Record<BrowserNotificationResult, string> = {
  "display-rejected": "Chrome rejected the display request.",
  listed: "Chrome accepted the request and listed the alert.",
  "listed-after-retry": "Chrome accepted the request. The alert appeared in its list on the second check.",
  "not-listed": "Chrome accepted the request but its list was empty on both checks.",
  "readback-unavailable": "Chrome accepted the request. Its notification list could not be read.",
};

const workerStatus = (registration?: ServiceWorkerRegistration) =>
  registration?.active?.state === "activated"
    ? registration.waiting ? "Active · update waiting" : "Active"
    : registration?.installing ? "Installing" : "Inactive or missing";

type Props = {
  registered: boolean;
  foregroundAt?: number;
  background?: {at: number; display: "accepted" | "failed"};
};

export function MerchantPushDiagnostics({registered, foregroundAt, background}: Props) {
  const [report, setReport] = useState<{label: string; value: string}[]>([]);
  const [reportBusy, setReportBusy] = useState(false);
  const [localBusy, setLocalBusy] = useState(false);
  const [localStatus, setLocalStatus] = useState("");
  const [canCompare, setCanCompare] = useState(false);

  async function refreshReport() {
    setReportBusy(true);
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    const basics = [
      {label: "Chrome permission", value: "Notification" in window ? Notification.permission : "Unsupported"},
      {label: "Secure page", value: window.isSecureContext ? "Yes" : "No"},
      {label: "Window", value: `${matchMedia("(display-mode: standalone)").matches ? "Installed app" : "Browser tab"} · ${document.visibilityState}`},
      {label: "Web Push key configured", value: vapidKey ? "Yes" : "No"},
    ];
    try {
      const {fcm, pwa} = await getNotificationWorkers(navigator.serviceWorker, location.origin);
      const fcmScriptMatches = isMessagingWorker(fcm?.active?.scriptURL, location.origin);
      setCanCompare(fcmScriptMatches && pwa?.active?.state === "activated");
      setReport([...basics,
        {label: "Firebase worker", value: fcm?.active && !fcmScriptMatches ? "Unexpected script at Firebase scope" : workerStatus(fcm)},
        {label: "Offline worker", value: workerStatus(pwa)},
        {label: "Page controller", value: !navigator.serviceWorker.controller ? "None" :
          navigator.serviceWorker.controller.scriptURL === pwa?.active?.scriptURL ? "Offline worker" : "Other worker"},
        {label: "Chrome push subscription", value: await readPushSubscription(fcmScriptMatches ? fcm : undefined, vapidKey)},
      ]);
    } catch {
      setCanCompare(false);
      setReport([...basics, {label: "Workers", value: "Chrome could not read registrations"}]);
    } finally {
      setReportBusy(false);
    }
  }

  async function testWindowsNotificationLocally(compareOfflineWorker = false) {
    if (localBusy) return;
    setLocalBusy(true);
    try {
      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        setLocalStatus("Chrome notification support is unavailable here.");
        return;
      }
      if (Notification.permission !== "granted") {
        setLocalStatus("Allow Notifications for this site using the site information icon in Chrome’s address bar.");
        return;
      }
      const {fcm, pwa} = await getNotificationWorkers(navigator.serviceWorker, location.origin);
      const useFirebaseWorker = !compareOfflineWorker && fcm?.active?.state === "activated" &&
        isMessagingWorker(fcm.active.scriptURL, location.origin);
      const registration = useFirebaseWorker ? fcm : pwa;
      if (registration?.active?.state !== "activated") {
        setLocalStatus("No suitable LocalEats worker is active. Reopen the dashboard and retry after it loads.");
        return;
      }
      const result = await runBrowserNotificationCheck(registration);
      setLocalStatus(`${useFirebaseWorker ? "Firebase worker" : "Offline worker"} · ${browserResults[result]} Check for “LocalEats Windows check” in Windows (Win + N).`);
    } catch {
      setLocalStatus("Chrome could not read the LocalEats worker registrations.");
    } finally {
      setLocalBusy(false);
    }
  }

  const buttonClass = "min-h-10 cursor-pointer rounded-xl border border-outline-variant/40 bg-surface-container-high px-4 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container-highest focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50";
  return (
    <div className="space-y-2 px-5 text-xs text-on-surface-variant">
      <div className="flex flex-col items-end gap-2">
        <button type="button" disabled={localBusy} className={buttonClass}
          onClick={() => void testWindowsNotificationLocally()}>
          {localBusy ? "Checking Windows alerts…" : "Test Windows alert (browser only)"}
        </button>
        {localStatus && <p role="status" className="max-w-sm text-right">{localStatus}</p>}
      </div>
      <p>Keep the Orders inbox open for verified pickup updates. Use it as your primary source until you’ve seen a Windows alert.</p>
      <details onToggle={event => {if (event.currentTarget.open && !report.length && !reportBusy) void refreshReport();}}>
        <summary className="cursor-pointer py-2 font-semibold text-on-surface">Notification troubleshooting</summary>
        <dl className="space-y-1">
          <div><dt className="inline font-semibold">LocalEats device registration </dt><dd className="inline">{registered ? "Confirmed" : "Unconfirmed"}</dd></div>
          {report.map(({label, value}) => <div key={label}><dt className="inline font-semibold">{label} </dt><dd className="inline">{value}</dd></div>)}
          <div><dt className="inline font-semibold">Foreground test </dt><dd className="inline">{foregroundAt ? `Received at ${new Date(foregroundAt).toLocaleTimeString()}` : "No receipt in this session"}</dd></div>
          <div><dt className="inline font-semibold">Background test </dt><dd className="inline">{background
            ? `Worker received it at ${new Date(background.at).toLocaleTimeString()} · Chrome ${background.display === "accepted" ? "accepted" : "rejected"} the display request`
            : "No worker receipt in this open dashboard session"}</dd></div>
        </dl>
        <div className="my-2 flex flex-wrap gap-2">
          <button type="button" className={buttonClass} disabled={reportBusy} onClick={() => void refreshReport()}>
            {reportBusy ? "Reading browser status…" : "Refresh browser status"}
          </button>
          {canCompare && <button type="button" className={buttonClass} disabled={localBusy}
            onClick={() => void testWindowsNotificationLocally(true)}>Compare with offline worker</button>}
        </div>
        <ol className="list-decimal space-y-1 pl-4">
          <li>In Chrome’s site information menu, set Notifications to Allow for this dashboard. Use a regular Chrome profile.</li>
          <li>In Windows Settings → System → Notifications, turn on notifications for Google Chrome or the installed LocalEats app. Enable banners and Notification Center and turn off Do not disturb for the test.</li>
          <li>Run the browser-only test once and check the banner and Win + N. Only a banner or an item you see there confirms Windows displayed it.</li>
          <li>For the Firebase background test, hide all LocalEats tabs and app windows during the countdown. Keep Chrome running. For the foreground test, keep this dashboard visible and wait at least one minute between sends.</li>
        </ol>
      </details>
    </div>
  );
}
