import React, { useState, useEffect, useCallback } from "react";
import { SupabaseClient } from "@supabase/supabase-js";
import {
  Activity,
  Wifi,
  WifiOff,
  AlertTriangle,
  RefreshCw,
  Trash2,
  X,
  CheckCircle2,
  Database,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useErrorHandler } from "../hooks/useErrorHandler";
import { ServiceLoadingState } from "../hooks/useAppInitializer";

interface DiagnosticUtilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  supabase: SupabaseClient;
  serviceLoading?: ServiceLoadingState;
}

export const DiagnosticUtilityModal: React.FC<DiagnosticUtilityModalProps> = ({
  isOpen,
  onClose,
  supabase,
  serviceLoading,
}) => {
  const { errorLog, clearLog, isOnline, refreshLog } = useErrorHandler();
  const [testingPing, setTestingPing] = useState(false);
  const [pingResult, setPingResult] = useState<{
    status: "idle" | "success" | "error";
    latencyMs?: number;
    message?: string;
  }>({ status: "idle" });
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);

  const testSupabasePing = useCallback(async () => {
    setTestingPing(true);
    setPingResult({ status: "idle" });
    const startTime = performance.now();

    try {
      const { error } = await supabase.from("shops").select("id").limit(1);
      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);

      if (error) {
        setPingResult({
          status: "error",
          latencyMs: latency,
          message: error.message || "Database returned an error code",
        });
      } else {
        setPingResult({
          status: "success",
          latencyMs: latency,
          message: "Database connection healthy and responsive",
        });
      }
    } catch (err: unknown) {
      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);
      setPingResult({
        status: "error",
        latencyMs: latency,
        message: err instanceof Error ? err.message : "Network request failed to reach Supabase server",
      });
    } finally {
      setTestingPing(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (isOpen) {
      refreshLog();
      void testSupabasePing();
    }
  }, [isOpen, refreshLog, testSupabasePing]);

  if (!isOpen) return null;

  // Last 5 errors
  const recentErrors = errorLog.slice(0, 5);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-xl bg-surface-container border border-outline-variant/20 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 bg-surface-container-high border-b border-outline-variant/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
              <Activity size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-tight text-on-surface">
                Network & System Diagnostics
              </h3>
              <p className="text-xs text-on-surface-variant font-medium">
                Live Supabase telemetry and error inspection
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-on-surface-variant hover:bg-surface-container-highest transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Status Indicators */}
          <div className="grid grid-cols-2 gap-3">
            {/* Browser Online Status */}
            <div className="p-4 rounded-2xl bg-surface-container-high border border-outline-variant/10 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-on-surface-variant">
                  Network Link
                </span>
                <p className="text-sm font-bold text-on-surface flex items-center gap-1.5">
                  {isOnline ? (
                    <>
                      <Wifi size={14} className="text-emerald-500" /> Online
                    </>
                  ) : (
                    <>
                      <WifiOff size={14} className="text-rose-500" /> Disconnected
                    </>
                  )}
                </p>
              </div>
              <div
                className={`w-3 h-3 rounded-full ${
                  isOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                }`}
              />
            </div>

            {/* Supabase Database Ping */}
            <div className="p-4 rounded-2xl bg-surface-container-high border border-outline-variant/10 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-on-surface-variant">
                  Supabase DB
                </span>
                <p className="text-sm font-bold text-on-surface flex items-center gap-1.5">
                  <Database size={14} className="text-primary" />
                  {testingPing ? (
                    <span className="text-xs text-on-surface-variant animate-pulse">Pinging...</span>
                  ) : pingResult.status === "success" ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                      {pingResult.latencyMs}ms
                    </span>
                  ) : pingResult.status === "error" ? (
                    <span className="text-rose-600 dark:text-rose-400 font-semibold text-xs">Failed</span>
                  ) : (
                    "Idle"
                  )}
                </p>
              </div>
              <button
                onClick={testSupabasePing}
                disabled={testingPing}
                className="p-1.5 rounded-lg bg-surface-container hover:bg-surface-container-highest text-on-surface-variant transition-colors cursor-pointer"
                title="Re-test Ping"
              >
                <RefreshCw size={14} className={testingPing ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {/* Per-Service Health Grid */}
          {serviceLoading && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                <Layers size={13} /> Service Health Monitor
              </span>
              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 rounded-xl bg-surface-container-high border border-outline-variant/10 text-center">
                  <span className="text-[10px] font-bold text-on-surface-variant block">Shops</span>
                  <span className={`text-xs font-bold ${serviceLoading.shops ? "text-amber-500 animate-pulse" : "text-emerald-500"}`}>
                    {serviceLoading.shops ? "Syncing..." : "Ready"}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-surface-container-high border border-outline-variant/10 text-center">
                  <span className="text-[10px] font-bold text-on-surface-variant block">Orders</span>
                  <span className={`text-xs font-bold ${serviceLoading.orders ? "text-amber-500 animate-pulse" : "text-emerald-500"}`}>
                    {serviceLoading.orders ? "Syncing..." : "Ready"}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-surface-container-high border border-outline-variant/10 text-center">
                  <span className="text-[10px] font-bold text-on-surface-variant block">Menu</span>
                  <span className={`text-xs font-bold ${serviceLoading.menu ? "text-amber-500 animate-pulse" : "text-emerald-500"}`}>
                    {serviceLoading.menu ? "Syncing..." : "Ready"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Diagnostic Error Logs (Last 5 errors) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                <AlertTriangle size={13} className="text-amber-500" /> Recent Diagnostic Logs (Last {recentErrors.length})
              </span>
              {recentErrors.length > 0 && (
                <button
                  onClick={clearLog}
                  className="text-xs text-rose-500 hover:text-rose-600 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Trash2 size={12} /> Clear Logs
                </button>
              )}
            </div>

            {recentErrors.length === 0 ? (
              <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-1">
                <CheckCircle2 size={24} className="mx-auto text-emerald-500" />
                <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  No network or Supabase errors logged!
                </p>
                <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                  All recent API queries completed cleanly.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentErrors.map((err) => {
                  const isExpanded = expandedErrorId === err.id;
                  return (
                    <div
                      key={err.id}
                      className="p-3 rounded-xl bg-surface-container-high border border-outline-variant/15 space-y-1.5 transition-all"
                    >
                      <div
                        onClick={() => setExpandedErrorId(isExpanded ? null : err.id)}
                        className="flex items-center justify-between cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          {err.code ? (
                            <span className="text-[10px] font-mono font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-md shrink-0">
                              {err.code}
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-md shrink-0">
                              ERR
                            </span>
                          )}
                          <span className="text-xs font-bold text-on-surface truncate">
                            {err.context}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-on-surface-variant font-mono">
                            {err.timestamp}
                          </span>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                      </div>

                      <p className="text-xs text-on-surface-variant leading-relaxed font-medium pl-1">
                        {err.message}
                      </p>

                      {isExpanded && err.details && (
                        <div className="p-2.5 rounded-lg bg-surface-container text-[11px] font-mono text-on-surface-variant/90 border border-outline-variant/10 break-all space-y-1">
                          <span className="font-bold block text-[10px] uppercase text-primary">Raw Details:</span>
                          <p>{err.details}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-surface-container-high border-t border-outline-variant/10 flex items-center justify-between text-xs text-on-surface-variant">
          <span>LocalEats Health Monitor v1.2</span>
          <button
            onClick={testSupabasePing}
            disabled={testingPing}
            className="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold hover:opacity-90 transition-opacity cursor-pointer flex items-center gap-2"
          >
            <RefreshCw size={14} className={testingPing ? "animate-spin" : ""} />
            Re-test Connectivity
          </button>
        </div>
      </div>
    </div>
  );
};
