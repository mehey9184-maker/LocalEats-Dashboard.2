import React, { useEffect, useState, useCallback } from "react";
import { SupabaseClient } from "@supabase/supabase-js";
import { Wifi, WifiOff, RefreshCw, Layers, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { getQueuedMutations, processOfflineSyncQueue } from "../utils/offlineSyncQueue";
import { logNetworkError } from "../utils/errorHandler";

interface ConnectivityMonitorProps {
  supabase: SupabaseClient;
  onOpenDiagnostics?: () => void;
  className?: string;
}

export type ConnectionHealth = "connected" | "degraded" | "connecting" | "offline";

export function ConnectivityMonitor({ supabase, onOpenDiagnostics, className }: ConnectivityMonitorProps) {
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [healthStatus, setHealthStatus] = useState<ConnectionHealth>("connecting");
  const [wsStatus, setWsStatus] = useState<"SUBSCRIBED" | "CONNECTING" | "CLOSED" | "CHANNEL_ERROR" | "TIMED_OUT">("CONNECTING");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [pendingSyncs, setPendingSyncs] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // 1. Fetch & poll queued offline mutations count
  const updatePendingCount = useCallback(async () => {
    try {
      const items = await getQueuedMutations();
      setPendingSyncs(items.length);
    } catch {
      // ignore IndexedDB read error
    }
  }, []);

  useEffect(() => {
    updatePendingCount();

    const handleQueueUpdated = () => updatePendingCount();
    window.addEventListener("offline_queue_updated", handleQueueUpdated);
    window.addEventListener("online", updatePendingCount);

    const interval = setInterval(updatePendingCount, 5000);

    return () => {
      window.removeEventListener("offline_queue_updated", handleQueueUpdated);
      window.removeEventListener("online", updatePendingCount);
      clearInterval(interval);
    };
  }, [updatePendingCount]);

  // 2. Track network online/offline listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Automatically attempt queue sync when returning online
      processOfflineSyncQueue(supabase).then((count) => {
        if (count > 0) {
          toast.success(`Connection restored: Synced ${count} offline changes!`);
        }
      });
    };
    const handleOffline = () => {
      setIsOnline(false);
      setHealthStatus("offline");
      logNetworkError("connectivity_monitor", "Browser entered offline state", {
        type: "api_gateway",
        code: "BROWSER_OFFLINE",
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [supabase]);

  // 3. Perform real-time Supabase API Gateway & WebSocket Health Check
  const checkHealth = useCallback(async () => {
    if (!navigator.onLine) {
      setHealthStatus("offline");
      setLatencyMs(null);
      return;
    }

    const startTime = performance.now();
    try {
      // API Gateway Latency Ping
      const { error } = await supabase.from("shops").select("id").limit(1);
      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);
      setLatencyMs(latency);

      if (error) {
        logNetworkError("api_gateway_ping", error, {
          latencyMs: latency,
          type: "api_gateway",
        });
        setHealthStatus("degraded");
      } else {
        if (latency > 600) {
          setHealthStatus("degraded");
        } else if (wsStatus === "CLOSED" || wsStatus === "CHANNEL_ERROR" || wsStatus === "TIMED_OUT") {
          setHealthStatus("degraded");
        } else {
          setHealthStatus("connected");
        }
      }
    } catch (err: unknown) {
      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);
      setLatencyMs(latency);
      setHealthStatus("offline");
      logNetworkError("api_gateway_ping_exception", err, {
        latencyMs: latency,
        type: "api_gateway",
      });
    }
  }, [supabase, wsStatus]);

  // 4. Set up persistent Realtime Channel monitoring
  useEffect(() => {
    if (!isOnline) return;

    let wsChannel: ReturnType<typeof supabase.channel>;

    try {
      wsChannel = supabase.channel("system_connectivity_monitor");
      wsChannel.subscribe((status, err) => {
        setWsStatus(status);
        if (status === "SUBSCRIBED") {
          setHealthStatus((prev) => (prev === "offline" ? "degraded" : "connected"));
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setHealthStatus("degraded");
          logNetworkError("supabase_websocket_closed", err || `WebSocket channel status: ${status}`, {
            type: "websocket",
            closeCode: status === "TIMED_OUT" ? 4004 : 1006,
            closeReason: `Channel state transition to ${status}`,
          });
        }
      });
    } catch (err) {
      logNetworkError("supabase_websocket_init_error", err, { type: "websocket" });
    }

    // Ping check every 25 seconds
    checkHealth();
    const interval = setInterval(checkHealth, 25000);

    return () => {
      clearInterval(interval);
      if (wsChannel) {
        supabase.removeChannel(wsChannel);
      }
    };
  }, [isOnline, checkHealth, supabase]);

  // 5. Manual queue sync button handler
  const handleTriggerSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSyncing) return;

    setIsSyncing(true);
    try {
      const count = await processOfflineSyncQueue(supabase);
      await updatePendingCount();
      if (count > 0) {
        toast.success(`Successfully pushed ${count} pending offline operation${count > 1 ? "s" : ""}!`);
      } else {
        const remaining = await getQueuedMutations();
        if (remaining.length > 0) {
          toast.info(`${remaining.length} item(s) pending network clearance.`);
        } else {
          toast.success("All offline changes are fully synchronized!");
        }
      }
    } catch (err) {
      toast.error("Failed to process sync queue. Check network diagnostics.");
      logNetworkError("manual_sync_queue", err, { type: "offline_sync" });
    } finally {
      setIsSyncing(false);
    }
  };

  // Color mappings based on connection health stability
  const getBadgeStyles = () => {
    if (!isOnline || healthStatus === "offline") {
      return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 hover:bg-rose-500/20";
    }
    if (healthStatus === "degraded" || healthStatus === "connecting") {
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/20";
    }
    return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20";
  };

  const getDotStyles = () => {
    if (!isOnline || healthStatus === "offline") return "bg-rose-500";
    if (healthStatus === "degraded" || healthStatus === "connecting") return "bg-amber-500 animate-pulse";
    return "bg-emerald-500 animate-pulse";
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* 1. Sync Pending Counter Badge (Visible in top header when items are pending) */}
      {pendingSyncs > 0 && (
        <button
          onClick={handleTriggerSync}
          disabled={isSyncing}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-500 text-white shadow-md hover:bg-amber-600 active:scale-95 transition-all cursor-pointer border border-amber-400/30"
          title="Click to sync offline changes now"
        >
          {isSyncing ? (
            <RefreshCw size={12} className="animate-spin" />
          ) : (
            <Layers size={12} className="animate-pulse" />
          )}
          <span>{pendingSyncs} PENDING</span>
        </button>
      )}

      {/* 2. Persistent Connectivity Status Indicator */}
      <button
        onClick={onOpenDiagnostics}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border cursor-pointer select-none shadow-xs active:scale-95",
          getBadgeStyles()
        )}
        title="Realtime Gateway & WebSocket Connectivity Status (Click for Diagnostics)"
      >
        <div className={cn("w-2 h-2 rounded-full shrink-0", getDotStyles())} />

        {/* Icon */}
        {!isOnline || healthStatus === "offline" ? (
          <WifiOff size={14} className="shrink-0" />
        ) : healthStatus === "connecting" ? (
          <RefreshCw size={14} className="animate-spin shrink-0" />
        ) : healthStatus === "degraded" ? (
          <AlertCircle size={14} className="shrink-0" />
        ) : (
          <Wifi size={14} className="shrink-0" />
        )}

        {/* Status text */}
        <span className="font-extrabold tracking-tight hidden xs:inline text-[11px] uppercase">
          {!isOnline
            ? "Offline"
            : healthStatus === "connecting"
            ? "Connecting"
            : healthStatus === "degraded"
            ? "Degraded"
            : "Connected"}
        </span>

        {/* Latency badge */}
        {isOnline && latencyMs !== null && healthStatus !== "offline" && (
          <span className="text-[10px] font-mono opacity-80 hidden sm:inline border-l border-current/20 pl-1.5">
            {latencyMs}ms
          </span>
        )}
      </button>
    </div>
  );
}
