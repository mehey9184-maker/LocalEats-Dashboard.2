import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";

// Web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "localeats-5e26e.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "localeats-5e26e",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "localeats-5e26e.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "281496568360",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
  measurementId: "G-Q5400WP0G5"
};

// Initialize Firebase App lazily
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

/**
 * Request permission for Web Push Notifications and obtain FCM token
 * @param vapidKey Web Push Certificate Key from Firebase Console
 */
export async function requestNotificationPermissionAndGetToken(vapidKey?: string): Promise<string | null> {
  try {
    const supported = await isSupported();
    if (!supported) {
      console.warn("[FCM] Push messaging is not supported in this browser environment.");
      return null;
    }

    if (!("Notification" in window)) {
      console.warn("[FCM] Notification API is not supported by browser.");
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("[FCM] Notification permission denied by user.");
      return null;
    }

    const messaging = getMessaging(app);
    
    // Register service worker if available
    let serviceWorkerRegistration: ServiceWorkerRegistration | undefined;
    if ("serviceWorker" in navigator) {
      serviceWorkerRegistration = await navigator.serviceWorker.register("/firebase-messaging-sw.js").catch((err) => {
        console.warn("[FCM] Service worker registration failed:", err);
        return undefined;
      });
    }

    const activeVapidKey = vapidKey || import.meta.env.VITE_FIREBASE_VAPID_KEY;

    const currentToken = await getToken(messaging, {
      vapidKey: activeVapidKey,
      serviceWorkerRegistration
    });

    if (currentToken) {
      console.log("[FCM] Token acquired successfully:", currentToken);
      return currentToken;
    } else {
      console.warn("[FCM] No registration token available. Request permission to generate one.");
      return null;
    }
  } catch (error) {
    console.warn("[FCM] Warning acquiring push notification token:", error);
    return null;
  }
}

/**
 * Foreground message listener (when app tab is actively open)
 */
export async function onForegroundMessage(callback: (payload: { notification?: { title?: string; body?: string }; data?: Record<string, string> }) => void) {
  try {
    const supported = await isSupported();
    if (!supported) return;
    const messaging = getMessaging(app);
    return onMessage(messaging, callback);
  } catch (err) {
    console.warn("[FCM] Foreground listener error:", err);
  }
}

/**
 * Send a push notification alert via the Supabase Edge Function `send-alert`
 */
export async function sendPushNotification({
  userId,
  token,
  title,
  body,
  data,
  userJwt,
  serverKey,
}: {
  userId?: string;
  token?: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  userJwt?: string;
  serverKey?: string;
}) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://qnwjkwlhmreenqotufvw.supabase.co";
  const edgeFunctionUrl = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/send-alert`;
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (userJwt) {
    headers["Authorization"] = `Bearer ${userJwt}`;
  }
  if (serverKey) {
    headers["x-fcm-server-key"] = serverKey;
  }

  try {
    const response = await fetch(edgeFunctionUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        user_id: userId,
        token,
        title,
        body,
        data,
      }),
    });

    if (!response.ok) {
      console.warn("[FCM] Push notification edge function responded with status:", response.status);
      return { ok: false, status: response.status };
    }

    const result = await response.json().catch(() => ({ ok: true }));
    return result;
  } catch (error) {
    console.warn("[FCM] Push notification edge function dispatch warning (offline or fallback mode):", error);
    return { ok: false, error: String(error) };
  }
}

