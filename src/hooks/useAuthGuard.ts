import { useCallback } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export const useAuthGuard = () => {
  const checkAuthWithTimeout = useCallback(async (timeoutMs = 1200) => {
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
      // 1. Clean up any existing stale channel with the same name asynchronously (non-blocking)
      const existingChannels = supabase.getChannels();
      const existing = existingChannels.find(
        (ch) => ch.topic === `realtime:${channelName}` || ch.topic === channelName
      );
      if (existing) {
        void supabase.removeChannel(existing);
      }

      // 2. Verify session validity quickly with fast 1.2s timeout
      const authRes = await checkAuthWithTimeout(1200);
      const session = authRes?.data?.session;

      if (session?.access_token) {
        try {
          supabase.realtime.setAuth(session.access_token);
        } catch {
          // ignore
        }
      }

      // 3. Create clean channel for postgres_changes
      const baseChannel = supabase.channel(channelName);
      const configuredChannel = setupChannel(baseChannel);

      // 4. Fast subscription with 2s timeout safety
      return new Promise((resolve) => {
        let isResolved = false;
        const subTimeout = setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            resolve(configuredChannel);
          }
        }, 2000);

        configuredChannel.subscribe((status, err) => {
          if (isResolved) return;
          if (status === "SUBSCRIBED") {
            isResolved = true;
            clearTimeout(subTimeout);
            resolve(configuredChannel);
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            isResolved = true;
            clearTimeout(subTimeout);
            console.warn(`[Realtime ${channelName}] Channel status:`, status, err || "");
            resolve(null);
          }
        });
      });
    } catch (err) {
      console.warn(`[Realtime ${channelName}] Subscription failed:`, err);
      return null;
    }
  }, [checkAuthWithTimeout]);

  return { subscribeWithAuthGuard, checkAuthWithTimeout };
};

