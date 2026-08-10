import React, { useEffect, useState } from "react";
import { Wifi, WifiOff, Activity, RefreshCw } from "lucide-react";
import { supabase, getFreshChannel } from "../lib/supabase";
import { cn } from "../lib/utils";
import { getQueuedMutations } from "../utils/offlineSyncQueue";

export function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [supabaseStatus, setSupabaseStatus] = useState<"connected" | "connecting" | "offline">("connecting");
  const [pendingSyncs, setPendingSyncs] = useState(0);

  useEffect(() => {
    // Basic browser online/offline
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Track pending mutations
    const checkMutations = async () => {
      try {
        const mutations = await getQueuedMutations();
        setPendingSyncs(mutations.length);
      } catch {
        // ignore
      }
    };
    checkMutations();
    const interval = setInterval(checkMutations, 5000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!isOnline) {
      return;
    }

    let wsChannel: ReturnType<typeof supabase.channel>;

    try {
      wsChannel = getFreshChannel('system_health_check');
      wsChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setSupabaseStatus("connected");
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setSupabaseStatus("offline");
        } else if (status === 'CONNECTING') {
          setSupabaseStatus("connecting");
        }
      });
    } catch {
      // ignore
    }

    return () => {
      if (wsChannel) {
        supabase.removeChannel(wsChannel);
      }
    };
  }, [isOnline]);

  const activeSupabaseStatus = !isOnline ? "offline" : supabaseStatus;

  if (isOnline && activeSupabaseStatus === "connected" && pendingSyncs === 0) {
    return null; // All good, hide
  }

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest cursor-default select-none border shadow-sm transition-all animate-in fade-in slide-in-from-top-2",
      !isOnline || activeSupabaseStatus === "offline" 
        ? "bg-red-50 text-red-600 border-red-200" 
        : activeSupabaseStatus === "connecting" || pendingSyncs > 0
          ? "bg-orange-50 text-orange-600 border-orange-200"
          : "bg-green-50 text-green-600 border-green-200"
    )}>
      {!isOnline || activeSupabaseStatus === "offline" ? (
        <WifiOff size={14} className="animate-pulse" />
      ) : activeSupabaseStatus === "connecting" ? (
        <RefreshCw size={14} className="animate-spin" />
      ) : pendingSyncs > 0 ? (
        <Activity size={14} className="animate-pulse" />
      ) : (
        <Wifi size={14} />
      )}
      
      <span>
        {!isOnline || activeSupabaseStatus === "offline" ? "Offline" : activeSupabaseStatus === "connecting" ? "Connecting" : pendingSyncs > 0 ? "Syncing" : "Online"}
      </span>

      {pendingSyncs > 0 && (
        <>
          <span className="w-1 h-1 rounded-full bg-current opacity-50" />
          <span className="font-mono">{pendingSyncs} PENDING</span>
        </>
      )}
    </div>
  );
}
