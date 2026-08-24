import React, { useState, useEffect, useCallback } from "react";
import {
  Activity,
  WifiOff,
  RefreshCw,
  Trash2,
  X,
  CheckCircle2,
  Database,
  Layers,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Radio,
  FileCode,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import { validateFirestoreConnection } from "../lib/firebase";
import { supabase as supabaseClient } from "../lib/supabase";
import { useErrorHandler } from "../hooks/useErrorHandler";
import { ServiceLoadingState } from "../hooks/useAppInitializer";
import { getWebSocketCloseCodeInfo, LoggedNetworkError, logNetworkError } from "../utils/errorHandler";

interface DiagnosticUtilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  supabase?: unknown;
  serviceLoading?: ServiceLoadingState;
}

type FilterCategory = "all" | "websocket" | "api_gateway" | "offline_sync";

export const DiagnosticUtilityModal: React.FC<DiagnosticUtilityModalProps> = ({
  isOpen,
  onClose,
  serviceLoading,
}) => {
  const { errorLog, clearLog, isOnline, refreshLog } = useErrorHandler();
  const [activeCategory, setActiveCategory] = useState<FilterCategory>("all");
  const [testingPing, setTestingPing] = useState(false);
  const [testingWs, setTestingWs] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);

  const [wsResult, setWsResult] = useState<{
    status: "idle" | "success" | "error";
    message?: string;
    closeCode?: number;
  }>({ status: "idle" });

  const [pingResult, setPingResult] = useState<{
    status: "idle" | "success" | "error";
    latencyMs?: number;
    message?: string;
  }>({ status: "idle" });

  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);

  // Connection Diagnostics test (Ping API + WebSocket connection check)
  const testSupabaseConnectivity = useCallback(async () => {
    setTestingPing(true);
    setPingResult({ status: "idle" });
    const startTime = performance.now();

    try {
      const { error } = await supabaseClient.from("shops").select("id").limit(1);
      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);

      if (error) {
        setPingResult({
          status: "error",
          latencyMs: latency,
          message: (error as Error).message || "Database returned an error code",
        });
        logNetworkError("diagnostic_ping_failure", error as Error, { latencyMs: latency, type: "api_gateway" });
      } else {
        setPingResult({
          status: "success",
          latencyMs: latency,
          message: `API Gateway responsive (${latency}ms)`,
        });
      }
    } catch (err: unknown) {
      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);
      setPingResult({
        status: "error",
        latencyMs: latency,
        message: err instanceof Error ? err.message : "Network request failed to reach Supabase API Gateway",
      });
      logNetworkError("diagnostic_ping_exception", err, { latencyMs: latency, type: "api_gateway" });
    } finally {
      setTestingPing(false);
    }

    // Test Firestore Realtime Channel
    setTestingWs(true);
    setWsResult({ status: "idle" });

    try {
      const isLive = await validateFirestoreConnection();
      if (isLive) {
        setWsResult({ status: "success", message: "Google Cloud Firestore connection active and verified" });
      } else {
        setWsResult({ status: "error", message: "Firestore is reconnecting in background" });
      }
    } catch (err: unknown) {
      setWsResult({
        status: "error",
        message: err instanceof Error ? err.message : "Firestore probe notice",
      });
    } finally {
      setTestingWs(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      refreshLog();
      void testSupabaseConnectivity();
    }
  }, [isOpen, refreshLog, testSupabaseConnectivity]);

  // Copy structured diagnostic report
  const handleCopyDiagnosticReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      navigatorOnline: isOnline,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      apiGatewayPing: pingResult,
      websocketProbe: wsResult,
      serviceHealth: serviceLoading || null,
      loggedNetworkErrors: errorLog,
    };

    try {
      navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      setCopiedReport(true);
      toast.success("Diagnostic report copied to clipboard!");
      setTimeout(() => setCopiedReport(false), 2500);
    } catch {
      toast.error("Failed to copy report to clipboard");
    }
  };

  if (!isOpen) return null;

  // Filter logs by category
  const filteredErrors = errorLog.filter((err) => {
    if (activeCategory === "all") return true;
    if (activeCategory === "websocket") {
      return err.type === "websocket" || err.closeCode !== undefined || err.context.includes("websocket") || err.context.includes("realtime");
    }
    if (activeCategory === "api_gateway") {
      return err.type === "api_gateway" || err.context.includes("api") || err.context.includes("gateway") || err.context.includes("ping");
    }
    if (activeCategory === "offline_sync") {
      return err.type === "offline_sync" || err.context.includes("offline") || err.context.includes("sync");
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl bg-surface-container border border-outline-variant/20 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 bg-surface-container-high border-b border-outline-variant/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
              <Activity size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-tight text-on-surface">
                Network & Gateway Diagnostics
              </h3>
              <p className="text-xs text-on-surface-variant font-medium">
                WebSocket closing code inspector & API gateway health
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyDiagnosticReport}
              className="p-2 rounded-xl text-on-surface-variant hover:bg-surface-container-highest transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold"
              title="Copy JSON diagnostic report"
            >
              {copiedReport ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
              <span className="hidden sm:inline">{copiedReport ? "Copied!" : "Report"}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-on-surface-variant hover:bg-surface-container-highest transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto">
          {/* Status Indicators Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 1. Browser Network Link */}
            <div className="p-3.5 rounded-2xl bg-surface-container-high border border-outline-variant/10 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-on-surface-variant">
                  Network Link
                </span>
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    isOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                  }`}
                />
              </div>
              <p className="text-xs font-bold text-on-surface flex items-center gap-1.5 pt-0.5">
                {isOnline ? (
                  <>
                    <Globe size={13} className="text-emerald-500" /> Online
                  </>
                ) : (
                  <>
                    <WifiOff size={13} className="text-rose-500" /> Disconnected
                  </>
                )}
              </p>
            </div>

            {/* 2. Realtime WebSocket Health */}
            <div className="p-3.5 rounded-2xl bg-surface-container-high border border-outline-variant/10 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-on-surface-variant">
                  Realtime WS
                </span>
                <Radio
                  size={14}
                  className={testingWs ? "text-amber-500 animate-spin" : wsResult.status === "success" ? "text-emerald-500" : "text-rose-500"}
                />
              </div>
              <p className="text-xs font-bold text-on-surface truncate">
                {testingWs ? (
                  <span className="text-amber-500 animate-pulse">Handshaking...</span>
                ) : wsResult.status === "success" ? (
                  <span className="text-emerald-600 dark:text-emerald-400">Connected</span>
                ) : wsResult.status === "error" ? (
                  <span className="text-rose-600 dark:text-rose-400 font-mono text-[11px]">
                    {wsResult.closeCode ? `Code ${wsResult.closeCode}` : "Failed"}
                  </span>
                ) : (
                  "Idle"
                )}
              </p>
            </div>

            {/* 3. API Gateway Ping */}
            <div className="p-3.5 rounded-2xl bg-surface-container-high border border-outline-variant/10 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-on-surface-variant">
                  API Gateway Ping
                </span>
                <Database size={13} className="text-primary" />
              </div>
              <p className="text-xs font-bold text-on-surface">
                {testingPing ? (
                  <span className="text-amber-500 animate-pulse">Pinging...</span>
                ) : pingResult.status === "success" ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                    {pingResult.latencyMs}ms
                  </span>
                ) : pingResult.status === "error" ? (
                  <span className="text-rose-600 dark:text-rose-400 text-[11px]">Error</span>
                ) : (
                  "Idle"
                )}
              </p>
            </div>
          </div>

          {/* Service Health Monitor */}
          {serviceLoading && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                <Layers size={13} /> Subsystem Sync State
              </span>
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 rounded-xl bg-surface-container-high border border-outline-variant/10 text-center">
                  <span className="text-[10px] font-bold text-on-surface-variant block">Shops</span>
                  <span className={`text-[11px] font-bold ${serviceLoading.shops ? "text-amber-500 animate-pulse" : "text-emerald-500"}`}>
                    {serviceLoading.shops ? "Syncing..." : "Ready"}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-surface-container-high border border-outline-variant/10 text-center">
                  <span className="text-[10px] font-bold text-on-surface-variant block">Orders</span>
                  <span className={`text-[11px] font-bold ${serviceLoading.orders ? "text-amber-500 animate-pulse" : "text-emerald-500"}`}>
                    {serviceLoading.orders ? "Syncing..." : "Ready"}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-surface-container-high border border-outline-variant/10 text-center">
                  <span className="text-[10px] font-bold text-on-surface-variant block">Menu</span>
                  <span className={`text-[11px] font-bold ${serviceLoading.menu ? "text-amber-500 animate-pulse" : "text-emerald-500"}`}>
                    {serviceLoading.menu ? "Syncing..." : "Ready"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Category Filter Tabs & Log Header */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-outline-variant/10 pb-3">
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                <button
                  onClick={() => setActiveCategory("all")}
                  className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                    activeCategory === "all"
                      ? "bg-primary text-on-primary shadow-xs"
                      : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  All Logs ({errorLog.length})
                </button>
                <button
                  onClick={() => setActiveCategory("websocket")}
                  className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                    activeCategory === "websocket"
                      ? "bg-primary text-on-primary shadow-xs"
                      : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  WebSockets
                </button>
                <button
                  onClick={() => setActiveCategory("api_gateway")}
                  className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                    activeCategory === "api_gateway"
                      ? "bg-primary text-on-primary shadow-xs"
                      : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  API Gateway
                </button>
                <button
                  onClick={() => setActiveCategory("offline_sync")}
                  className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                    activeCategory === "offline_sync"
                      ? "bg-primary text-on-primary shadow-xs"
                      : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  Offline Queue
                </button>
              </div>

              {errorLog.length > 0 && (
                <button
                  onClick={clearLog}
                  className="text-xs text-rose-500 hover:text-rose-600 font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0 self-end sm:self-auto"
                >
                  <Trash2 size={12} /> Clear Logs
                </button>
              )}
            </div>

            {/* Error Log Entries */}
            {filteredErrors.length === 0 ? (
              <div className="p-8 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-1.5">
                <CheckCircle2 size={28} className="mx-auto text-emerald-500" />
                <p className="text-xs font-extrabold text-emerald-800 dark:text-emerald-300">
                  No network or WebSocket errors recorded!
                </p>
                <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                  All connection handshakes and API queries are operating smoothly.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                {filteredErrors.map((err: LoggedNetworkError) => {
                  const isExpanded = expandedErrorId === err.id;
                  const closeCodeInfo = err.closeCode ? getWebSocketCloseCodeInfo(err.closeCode) : null;

                  return (
                    <div
                      key={err.id}
                      className="p-3.5 rounded-2xl bg-surface-container-high border border-outline-variant/15 space-y-2 transition-all hover:border-outline-variant/30"
                    >
                      {/* Top bar of log item */}
                      <div
                        onClick={() => setExpandedErrorId(isExpanded ? null : err.id)}
                        className="flex items-start justify-between gap-2 cursor-pointer select-none"
                      >
                        <div className="space-y-1 overflow-hidden">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {/* WebSocket Closing Code Badge */}
                            {err.closeCode && closeCodeInfo && (
                              <span className="text-[10px] font-mono font-black bg-rose-500/20 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-md shrink-0 border border-rose-500/30">
                                Close Code {closeCodeInfo.name}
                              </span>
                            )}

                            {/* Standard Error Code Badge */}
                            {err.code && !err.closeCode && (
                              <span className="text-[10px] font-mono font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-md shrink-0">
                                {err.code}
                              </span>
                            )}

                            {/* Classification Tag */}
                            <span className="text-[10px] font-mono uppercase font-bold text-on-surface-variant/70 bg-surface-container px-1.5 py-0.5 rounded border border-outline-variant/10">
                              {err.type || "general"}
                            </span>

                            <span className="text-xs font-extrabold text-on-surface truncate">
                              {err.context}
                            </span>
                          </div>

                          {/* Message */}
                          <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
                            {err.message}
                          </p>

                          {/* Detailed WebSocket close reason explanation if present */}
                          {closeCodeInfo && (
                            <p className="text-[11px] text-rose-600/90 dark:text-rose-400/90 font-medium italic">
                              Diagnosis: {closeCodeInfo.description}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                          <span className="text-[10px] text-on-surface-variant font-mono">
                            {new Date(err.timestamp).toLocaleTimeString()}
                          </span>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                      </div>

                      {/* Expandable Technical Details */}
                      {isExpanded && (
                        <div className="pt-2 border-t border-outline-variant/10 space-y-2 animate-fade-in">
                          {err.latencyMs !== undefined && (
                            <div className="text-[11px] text-on-surface-variant font-mono">
                              <span className="font-bold text-primary">Latency:</span> {err.latencyMs}ms
                            </div>
                          )}

                          {err.details && (
                            <div className="p-2.5 rounded-xl bg-surface-container text-[11px] font-mono text-on-surface-variant/90 border border-outline-variant/10 break-all space-y-1">
                              <span className="font-bold block text-[10px] uppercase text-primary flex items-center gap-1">
                                <FileCode size={12} /> Raw Error Payload / Stack Details:
                              </span>
                              <p>{err.details}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-surface-container-high border-t border-outline-variant/10 flex items-center justify-between text-xs text-on-surface-variant shrink-0">
          <span className="font-mono text-[11px]">LocalEats Connectivity Telemetry v1.3</span>
          <button
            onClick={testSupabaseConnectivity}
            disabled={testingPing || testingWs}
            className="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold hover:opacity-90 transition-opacity cursor-pointer flex items-center gap-2 shadow-sm"
          >
            <RefreshCw size={14} className={testingPing || testingWs ? "animate-spin" : ""} />
            Re-test Connectivity
          </button>
        </div>
      </div>
    </div>
  );
};
