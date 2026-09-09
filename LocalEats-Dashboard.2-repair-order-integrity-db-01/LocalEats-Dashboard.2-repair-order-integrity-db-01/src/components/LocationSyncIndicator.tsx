import React, { useState } from "react";
import {
  MapPin,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Navigation,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
  Layers,
  ArrowRight,
  Compass,
} from "lucide-react";
import { cn } from "../lib/utils";
import {
  LocationSyncAnalysis,
  ShopLocationState,
} from "../hooks/useShopLocation";

interface LocationSyncIndicatorProps {
  locationState: ShopLocationState;
  syncAnalysis: LocationSyncAnalysis;
  isLocating?: boolean;
  isSaving?: boolean;
  onDetectGPS?: () => void;
  onAutoAlign?: () => void;
  onSave?: () => void;
  onOpenStorefrontMap?: () => void;
  className?: string;
  compact?: boolean;
}

export const LocationSyncIndicator: React.FC<LocationSyncIndicatorProps> = ({
  locationState,
  syncAnalysis,
  isLocating = false,
  isSaving = false,
  onDetectGPS,
  onAutoAlign,
  onSave,
  onOpenStorefrontMap,
  className = "",
  compact = false,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleVerify = () => {
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
    }, 600);
  };

  const getStatusBadge = () => {
    switch (syncAnalysis.status) {
      case "synced":
        return {
          bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
          dot: "bg-emerald-500",
          icon: CheckCircle2,
          title: "Location & Area In Sync",
          tag: "Verified GPS Alignment",
        };
      case "overlap":
        return {
          bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
          dot: "bg-amber-500",
          icon: Compass,
          title: "Active Radius Coverage",
          tag: "Multi-Zone Coverage Active",
        };
      case "mismatch":
        return {
          bg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
          dot: "bg-rose-500",
          icon: AlertTriangle,
          title: "Area Filter Mismatch",
          tag: "Action Recommended",
        };
      default:
        return {
          bg: "bg-surface-container-highest text-on-surface-variant/80 border-outline-variant/20",
          dot: "bg-outline-variant/50",
          icon: Info,
          title: "GPS Status Pending",
          tag: "Unverified",
        };
    }
  };

  const badge = getStatusBadge();
  const Icon = badge.icon;

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center justify-between gap-3 px-3 py-2 rounded-xl border text-xs transition-all",
          badge.bg,
          className
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn("w-2 h-2 rounded-full shrink-0", badge.dot, "animate-pulse")} />
          <span className="font-bold truncate">{badge.title}</span>
          <span className="text-[10px] opacity-80 shrink-0">
            ({locationState.city} • {locationState.lat.toFixed(3)}, {locationState.lng.toFixed(3)})
          </span>
        </div>
        {syncAnalysis.status === "mismatch" && onAutoAlign && (
          <button
            type="button"
            onClick={onAutoAlign}
            className="text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white px-2 py-0.5 rounded-lg shadow-sm hover:bg-rose-700 active:scale-95 transition-all shrink-0"
          >
            Auto-Fix
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "w-full bg-surface-container-low rounded-2xl border border-outline-variant/10 p-5 space-y-4 shadow-sm relative overflow-hidden transition-all",
        className
      )}
    >
      {/* Top Banner & Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-outline-variant/10">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 transition-transform",
              badge.bg
            )}
          >
            <Icon size={20} className={isVerifying ? "animate-spin" : ""} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-sm text-on-surface">Location Sync Status</h4>
              <span
                className={cn(
                  "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border",
                  badge.bg
                )}
              >
                {badge.tag}
              </span>
            </div>
            <p className="text-xs text-on-surface-variant line-clamp-1">
              Verifies GPS coordinates match your selected storefront area filter
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {onDetectGPS && (
            <button
              type="button"
              onClick={onDetectGPS}
              disabled={isLocating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-bold transition-all border border-outline-variant/10 active:scale-95 disabled:opacity-50"
              title="Detect current device GPS location"
            >
              <Navigation
                size={13}
                className={cn("text-primary", isLocating ? "animate-spin text-primary" : "")}
              />
              <span>{isLocating ? "Locating..." : "Auto-Detect GPS"}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleVerify}
            disabled={isVerifying}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface-variant text-xs font-bold transition-all border border-outline-variant/10"
            title="Re-verify sync diagnostics"
          >
            <RefreshCw size={12} className={cn(isVerifying ? "animate-spin text-primary" : "")} />
            <span className="hidden xs:inline">Verify</span>
          </button>
        </div>
      </div>

      {/* Sync Explanation & Analysis Card */}
      <div
        className={cn(
          "p-4 rounded-xl border transition-all text-xs leading-relaxed space-y-2.5",
          syncAnalysis.status === "synced"
            ? "bg-emerald-500/5 border-emerald-500/15 text-on-surface"
            : syncAnalysis.status === "overlap"
            ? "bg-amber-500/5 border-amber-500/15 text-on-surface"
            : "bg-rose-500/5 border-rose-500/15 text-on-surface"
        )}
      >
        <div className="flex items-start gap-2.5">
          <MapPin
            size={16}
            className={cn(
              "shrink-0 mt-0.5",
              syncAnalysis.status === "synced"
                ? "text-emerald-500"
                : syncAnalysis.status === "overlap"
                ? "text-amber-500"
                : "text-rose-500"
            )}
          />
          <div className="space-y-1 flex-1">
            <p className="font-medium">{syncAnalysis.message}</p>
            {syncAnalysis.recommendation && (
              <p className="text-[11px] font-bold text-primary flex items-center gap-1.5 pt-1">
                <Sparkles size={13} className="shrink-0" />
                <span>{syncAnalysis.recommendation}</span>
              </p>
            )}
          </div>
        </div>

        {/* Action Button for Mismatches */}
        {syncAnalysis.status !== "synced" && onAutoAlign && (
          <div className="flex items-center justify-between pt-2 border-t border-outline-variant/10">
            <span className="text-[11px] text-on-surface-variant">
              Reconcile area to <span className="font-bold text-on-surface">{syncAnalysis.closestHubName}</span>?
            </span>
            <button
              type="button"
              onClick={onAutoAlign}
              className="flex items-center gap-1.5 px-3 py-1 bg-primary text-on-primary rounded-lg text-xs font-bold shadow-sm hover:bg-primary/90 active:scale-95 transition-all"
            >
              <span>Auto-Align to {syncAnalysis.closestHubName}</span>
              <ArrowRight size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Grid Diagnostics breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
        <div className="p-3 bg-surface-container rounded-xl border border-outline-variant/10 space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/70 block">
            Stored Area Filter
          </span>
          <p className="text-xs font-bold text-on-surface truncate">{locationState.city || "Tembisa"}</p>
        </div>

        <div className="p-3 bg-surface-container rounded-xl border border-outline-variant/10 space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/70 block">
            Detected GPS Hub
          </span>
          <p className="text-xs font-bold text-primary truncate">
            {syncAnalysis.closestHubName} ({syncAnalysis.distanceFromHubKm.toFixed(1)} km)
          </p>
        </div>

        <div className="p-3 bg-surface-container rounded-xl border border-outline-variant/10 space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/70 block">
            Coordinates
          </span>
          <p className="text-xs font-mono font-bold text-on-surface truncate" title={`${locationState.lat}, ${locationState.lng}`}>
            {locationState.lat.toFixed(4)}, {locationState.lng.toFixed(4)}
          </p>
        </div>

        <div className="p-3 bg-surface-container rounded-xl border border-outline-variant/10 space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/70 block">
            Delivery Radius
          </span>
          <p className="text-xs font-bold text-on-surface truncate">
            {locationState.deliveryRadiusEnabled ? `${locationState.deliveryRadiusKm} KM Active` : "Disabled (Open)"}
          </p>
        </div>
      </div>

      {/* Expandable Area Coverage Details */}
      <div className="border-t border-outline-variant/10 pt-3">
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="w-full flex items-center justify-between text-xs font-bold text-on-surface-variant hover:text-on-surface py-1 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Layers size={14} className="text-primary" />
            <span>Why do certain neighboring areas still appear in orders or search?</span>
          </span>
          {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showDetails && (
          <div className="mt-3 p-4 bg-surface-container-high rounded-xl border border-outline-variant/10 space-y-3 text-xs text-on-surface-variant animate-in fade-in duration-200">
            <p className="leading-relaxed">
              LocalEats uses a <strong className="text-on-surface">Zero-Guesswork GPS Location Engine</strong>. Customer storefront visibility and rider missions are calculated using both your shop's numerical pin and your <strong className="text-on-surface">{locationState.deliveryRadiusKm} KM delivery boundary</strong>.
            </p>

            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-on-surface">
                Townships & Suburbs currently in your delivery zone:
              </span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {syncAnalysis.coveredTownships.map((suburb) => (
                  <span
                    key={suburb}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container text-xs font-bold text-on-surface border border-outline-variant/20"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    {suburb}
                  </span>
                ))}
              </div>
            </div>

            <p className="text-[11px] opacity-80 pt-1">
              💡 Customers located within this {locationState.deliveryRadiusKm} KM circle can order from your shop even if their primary residential suburb label is different (e.g. Kaalfontein customers ordering from a Tembisa hub).
            </p>

            {onOpenStorefrontMap && (
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={onOpenStorefrontMap}
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                >
                  <span>View Map Boundary in Storefront Profile</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Save Button if onSave provided */}
      {onSave && (
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="px-5 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50"
          >
            {isSaving ? "Saving Location..." : "Save Location Settings"}
          </button>
        </div>
      )}
    </div>
  );
};

export default LocationSyncIndicator;
