import { useCallback } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export const useAuthGuard = () => {
  const checkAuthWithTimeout = useCallback(async (timeoutMs = 8000) => {
    try {
      const timeoutPromise = new Promise<{ data: { session: null }; error: Error }>((resolve) =>
        setTimeout(
          () => resolve({ data: { session: null }, error: new Error("Auth session check timed out") }),
          timeoutMs
        )
      );
      const res = await Promise.race([
        supabase.auth.getSession(),
        timeoutPromise,
      ]);
      return res;
    } catch (err) {
      console.warn("[AuthGuard] Auth check exception, proceeding in limited offline mode:", err);
      return { data: { session: null }, error: err };
    }
  }, []);

  const subscribeWithAuthGuard = useCallback(async (
    channelName: string,
    setupChannel: (channel: RealtimeChannel) => RealtimeChannel
  ): Promise<RealtimeChannel | null> => {
    try {
      // 1. Verify session validity with timeout protection
      console.log(`[Realtime ${channelName}] Verifying session validity prior to subscription...`);
      const authRes = await checkAuthWithTimeout(8000);
      const session = authRes?.data?.session;

      if (session) {
        // Check if JWT is nearing expiry (less than 5 minutes)
        const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
        const isExpiringSoon = expiresAt > 0 && expiresAt - Date.now() < 5 * 60 * 1000;

        if (isExpiringSoon) {
          console.log(`[Realtime ${channelName}] JWT expiring soon, refreshing session...`);
          try {
            const refreshTimeout = new Promise<{ data: { session: null } }>((resolve) =>
              setTimeout(() => resolve({ data: { session: null } }), 4000)
            );
            const refreshed = await Promise.race([
              supabase.auth.refreshSession(),
              refreshTimeout,
            ]);
            if (refreshed?.data?.session?.access_token) {
              supabase.realtime.setAuth(refreshed.data.session.access_token);
            }
          } catch (e) {
            console.warn(`[Realtime ${channelName}] Token refresh timed out / failed. Continuing with existing token or offline fallback:`, e);
            if (session.access_token) {
              supabase.realtime.setAuth(session.access_token);
            }
          }
        } else if (session.access_token) {
          supabase.realtime.setAuth(session.access_token);
        }
      } else {
        console.log(`[Realtime ${channelName}] No active online session. Proceeding anonymously.`);
      }

      // 2. Clean up any existing stale channel with the same name first
      const existingChannels = supabase.getChannels();
      const existing = existingChannels.find(
        (ch) => ch.topic === `realtime:${channelName}` || ch.topic === channelName
      );
      if (existing) {
        await supabase.removeChannel(existing);
      }

      // 3. Create clean channel for postgres_changes
      const baseChannel = supabase.channel(channelName);
      const configuredChannel = setupChannel(baseChannel);

      // 4. Robust subscription with timeout safety for offline/flaky connections
      return new Promise((resolve) => {
        let isResolved = false;
        const subTimeout = setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            console.warn(`[Realtime ${channelName}] Subscription attempt timed out. Active in limited offline mode.`);
            resolve(null);
          }
        }, 8000);

        configuredChannel.subscribe((status, err) => {
          if (isResolved) return;
          if (status === "SUBSCRIBED") {
            isResolved = true;
            clearTimeout(subTimeout);
            console.log(`[Realtime ${channelName}] Successfully subscribed.`);
            resolve(configuredChannel);
          } else if (status === "CHANNEL_ERROR") {
            isResolved = true;
            clearTimeout(subTimeout);
            console.warn(`[Realtime ${channelName}] Channel Notice:`, err || "Unauthorized or RLS restricted");
            resolve(null);
          } else if (status === "TIMED_OUT") {
            isResolved = true;
            clearTimeout(subTimeout);
            console.warn(`[Realtime ${channelName}] Subscription Timed Out`);
            resolve(null);
          } else if (status === "CLOSED") {
            console.log(`[Realtime ${channelName}] Subscription Closed`);
          }
        });
      });
    } catch (err) {
      console.warn(`[Realtime ${channelName}] Subscription failed (operating in limited offline mode):`, err);
      return null;
    }
  }, [checkAuthWithTimeout]);

  return { subscribeWithAuthGuard, checkAuthWithTimeout };
};

