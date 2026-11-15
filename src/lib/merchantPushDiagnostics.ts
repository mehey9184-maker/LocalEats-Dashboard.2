export const FCM_SCOPE = "/firebase-cloud-messaging-push-scope/";
export const FCM_SCRIPT = "/firebase-messaging-sw.js";

export function isMessagingWorker(scriptURL: string | undefined, origin: string) {
  return scriptURL === origin + FCM_SCRIPT;
}

export async function getNotificationWorkers(container: Pick<ServiceWorkerContainer, "getRegistrations">, origin: string) {
  const registrations = await container.getRegistrations();
  return {
    fcm: registrations.find(registration => registration.scope === origin + FCM_SCOPE),
    pwa: registrations.find(registration => registration.scope === origin + "/"),
  };
}

// Firebase waits for its default registration, but delegates activation of a
// caller-supplied registration to the caller.
export async function waitForMessagingWorker(registration: ServiceWorkerRegistration) {
  if (registration.active) return;
  const worker = registration.installing ?? registration.waiting;
  if (!worker) throw new Error("Messaging worker did not install.");

  await new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timeout);
      worker.removeEventListener("statechange", checkState);
      if (error) reject(error);
      else resolve();
    };
    const checkState = () => {
      if (worker.state === "activated") finish();
      if (worker.state === "redundant") finish(new Error("Messaging worker installation failed."));
    };
    const timeout = setTimeout(() => finish(new Error("Messaging worker did not activate in time.")), 10_000);
    worker.addEventListener("statechange", checkState);
    checkState();
  });
}

export type BrowserNotificationResult =
  | "display-rejected" | "listed" | "listed-after-retry" | "not-listed" | "readback-unavailable";

export async function runBrowserNotificationCheck(
  registration: Pick<ServiceWorkerRegistration, "showNotification" | "getNotifications">,
  wait = () => new Promise<void>(resolve => setTimeout(resolve, 750)),
): Promise<BrowserNotificationResult> {
  const tag = "localeats-local-windows-check-" + crypto.randomUUID();
  try {
    // Keep this probe free of asset requests and separate from FCM test tags.
    await registration.showNotification("LocalEats Windows check", {
      body: "Browser-only test. No order or payment was created.",
      tag,
      data: {type: "merchant_local_notification_check", url: "/"},
    });
  } catch {
    return "display-rejected";
  }

  try {
    if ((await registration.getNotifications({tag})).length > 0) return "listed";
    await wait();
    return (await registration.getNotifications({tag})).length > 0
      ? "listed-after-retry"
      : "not-listed";
  } catch {
    return "readback-unavailable";
  }
}

export async function readPushSubscription(
  registration: ServiceWorkerRegistration | undefined,
  vapidKey: string | undefined,
) {
  if (!registration?.active) return "Worker inactive";
  try {
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return "Missing";
    const subscriptionKey = subscription.options.applicationServerKey;
    if (!vapidKey || !subscriptionKey) return "Present · key comparison unavailable";
    const padded = vapidKey.padEnd(Math.ceil(vapidKey.length / 4) * 4, "=");
    const expected = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
    const actual = new Uint8Array(subscriptionKey);
    return actual.length === expected.length && actual.every((byte, index) => byte === expected.charCodeAt(index))
      ? "Present · Web Push key matches"
      : "Present · Web Push key differs";
  } catch {
    return "Could not read subscription";
  }
}
