import React, { useEffect, useState } from "react";
import { Wifi, WifiOff, Activity, RefreshCw } from "lucide-react";
import { validateFirestoreConnection } from "../lib/firebase";
import { cn } from "../lib/utils";
import { getQueuedMutations } from "../utils/offlineSyncQueue";

export function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [firebaseStatus, setFirebaseStatus] = useState<"connected" | "connecting" | "offline">("connecting");
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
    let isMounted = true;

    if (!isOnline) {
      // Async state update via queueMicrotask or check
      queueMicrotask(() => {
        if (isMounted) setFirebaseStatus("offline");
      });
      return () => {
        isMounted = false;
      };
    }

    const checkFirestore = async () => {
      try {
        const ok = await validateFirestoreConnection();
        if (isMounted) {
          setFirebaseStatus(ok ? "connected" : "offline");
        }
      } catch {
        if (isMounted) setFirebaseStatus("offline");
      }
    };

    checkFirestore();
    const interval = setInterval(checkFirestore, 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOnline]);

  const activeStatus = !isOnline ? "offline" : firebaseStatus;

  if (isOnline && activeStatus === "connected" && pendingSyncs === 0) {
    return null; // All good, hide
  }

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest cursor-default select-none border shadow-sm transition-all animate-in fade-in slide-in-from-top-2",
      !isOnline || activeStatus === "offline" 
        ? "bg-red-50 text-red-600 border-red-200" 
        : activeStatus === "connecting" || pendingSyncs > 0
          ? "bg-orange-50 text-orange-600 border-orange-200"
          : "bg-green-50 text-green-600 border-green-200"
    )}>
      {!isOnline || activeStatus === "offline" ? (
        <WifiOff size={14} className="animate-pulse" />
      ) : activeStatus === "connecting" ? (
        <RefreshCw size={14} className="animate-spin" />
      ) : pendingSyncs > 0 ? (
        <Activity size={14} className="animate-pulse" />
      ) : (
        <Wifi size={14} />
      )}
      
      <span>
        {!isOnline || activeStatus === "offline" ? "Offline" : activeStatus === "connecting" ? "Connecting" : pendingSyncs > 0 ? "Syncing" : "Online"}
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
