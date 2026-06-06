import { useState, useCallback } from 'react';
import { toast } from 'sonner';

// --- Type Definitions ---
export type RoleType = 'rider' | 'client' | 'merchant';

interface PushNotificationHook {
  pushEnabled: boolean;
  requestPushPermissions: (userId: string | undefined, role: RoleType, supabaseClient: any) => Promise<void>;
  urlBase64ToUint8Array: (base64String: string) => Uint8Array;
}

/**
 * Custom hook to manage Web Push Notifications via VAPID.
 * Implements DRY, SOLID, and defensive validation.
 */
export const usePushNotifications = (initialState = false): PushNotificationHook => {
  const [pushEnabled, setPushEnabled] = useState<boolean>(initialState);

  /**
   * Converts a base64 string to a Uint8Array.
   * Required for VAPID key conversion.
   */
  const urlBase64ToUint8Array = useCallback((base64String: string): Uint8Array => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }, []);

  /**
   * Requests permission and subscribes the user to push notifications.
   */
  const requestPushPermissions = useCallback(async (userId: string | undefined, role: RoleType, supabaseClient: any) => {
    // 1. Defensively check environment support
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      toast.error('This browser does not support push notifications.');
      return;
    }

    try {
      // 2. Request native permission
      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        setPushEnabled(false);
        toast.error('Notification permission denied.');
        return;
      }

      setPushEnabled(true);

      // 3. Early return if user is not authenticated
      if (!userId) {
        toast.success('Push notifications enabled locally!');
        return;
      }

      // 4. Validate Service Worker
      const registration = await navigator.serviceWorker.ready;
      if (!registration) {
        toast.error('Service worker not active yet.');
        return;
      }

      // 5. Subscribe to Push Manager
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        const vapidPublicKey = 'BD1XkIROdUwh10mz-IoWXYIy3awy5SN37JRExUeG0eIkgcyvSt7HzrXmRhERIDigFylQOP9GgglaWmVStB2Cx1c';
        const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
        
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey,
        });
      }

      // 6. Persist to Database
      const subJSON = subscription.toJSON();
      const { error } = await supabaseClient.from('push_subscriptions').upsert(
        {
          user_id: userId,
          role,
          endpoint: subJSON.endpoint,
          p256dh: subJSON.keys?.p256dh,
          auth: subJSON.keys?.auth,
          last_used: new Date().toISOString(),
        },
        { onConflict: 'endpoint' }
      );

      if (error) {
        console.error('Failed to save push subscription to DB:', error);
        toast.error('Failed to register device with the server.');
      } else {
        toast.success('Push notifications enabled!');
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast.error('Failed to enable push notifications.');
    }
  }, [urlBase64ToUint8Array]);

  return { pushEnabled, requestPushPermissions, urlBase64ToUint8Array };
};
