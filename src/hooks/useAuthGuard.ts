import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export const useAuthGuard = () => {
  const subscribeWithAuthGuard = async (
    channelName: string,
    setupChannel: (channel: RealtimeChannel) => RealtimeChannel
  ): Promise<RealtimeChannel | null> => {
    try {
      // 1. Verify session validity
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // Check if JWT is nearing expiry (less than 5 minutes)
        const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
        const isExpiringSoon = expiresAt > 0 && expiresAt - Date.now() < 5 * 60 * 1000;
        
        if (isExpiringSoon) {
          console.log(`[Realtime ${channelName}] JWT expiring soon, refreshing session...`);
          const { data: refreshed } = await supabase.auth.refreshSession();
          if (refreshed?.session?.access_token) {
            supabase.realtime.setAuth(refreshed.session.access_token);
          }
        } else if (session.access_token) {
          supabase.realtime.setAuth(session.access_token);
        }
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

      // 3. Robust error handler catching Realtime connection errors
      return new Promise((resolve) => {
        configuredChannel.subscribe((status, err) => {
          if (status === "SUBSCRIBED") {
            resolve(configuredChannel);
          } else if (status === "CHANNEL_ERROR") {
            console.warn(`[Realtime ${channelName}] Channel Notice:`, err || "Unauthorized or RLS restricted");
            resolve(null);
          } else if (status === "TIMED_OUT") {
            console.warn(`[Realtime ${channelName}] Subscription Timed Out`);
            resolve(null);
          } else if (status === "CLOSED") {
            console.log(`[Realtime ${channelName}] Subscription Closed`);
          }
        });
      });
    } catch (err) {
      console.warn(`[Realtime ${channelName}] Subscription failed:`, err);
      return null;
    }
  };

  return { subscribeWithAuthGuard };
};
