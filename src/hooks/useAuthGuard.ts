import { useCallback } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, getFreshChannel } from "../lib/supabase";

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
      console.debug("[AuthGuard] Auth check exception, proceeding in limited offline mode:", err);
      return { data: { session: null }, error: err };
    }
  }, []);

  const subscribeWithAuthGuard = useCallback(async (
    channelName: string,
    setupChannel: (channel: RealtimeChannel) => RealtimeChannel
  ): Promise<RealtimeChannel | null> => {
    try {
      // 1. Verify session validity quickly with fast 1.2s timeout
      const authRes = await checkAuthWithTimeout(1200);
      const session = authRes?.data?.session;

      if (session?.access_token) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((supabase as any).realtime) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (supabase as any).realtime.setAuth(session.access_token);
          }
        } catch {
          // ignore
        }
      }

      // 2. Obtain clean, guaranteed fresh channel instance
      const baseChannel = getFreshChannel(channelName);

      // 3. Attach listeners BEFORE calling .subscribe()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const configuredChannel = setupChannel(baseChannel as any);

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
            const errFormatted = err && typeof err === "object" ? (Object.keys(err).length > 0 ? JSON.stringify(err) : "") : String(err || "");
            console.debug(`[Realtime ${channelName}] Channel status: ${status}${errFormatted ? " - " + errFormatted : ""}`);
            resolve(null);
          }
        });
      });
    } catch (err) {
      console.debug(`[Realtime ${channelName}] Subscription notice:`, err);
      return null;
    }
  }, [checkAuthWithTimeout]);

  return { subscribeWithAuthGuard, checkAuthWithTimeout };
};

