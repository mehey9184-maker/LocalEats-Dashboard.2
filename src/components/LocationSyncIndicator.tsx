import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Navigation } from "lucide-react";
import { cn } from "../lib/utils";
import type { LocationSyncAnalysis, ShopLocationState } from "../hooks/useShopLocation";

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
  const needsAttention = syncAnalysis.status === "mismatch";
  const mayNeedReview = syncAnalysis.status === "overlap";
  const StatusIcon = needsAttention || mayNeedReview ? AlertTriangle : CheckCircle2;

  const handleUseDetectedArea = () => {
    if (!onAutoAlign) return;
    const confirmed = window.confirm(
      `Change your selected area from ${syncAnalysis.storedCity} to ${syncAnalysis.closestHubName}?`,
    );
    if (confirmed) onAutoAlign();
  };

  if (compact) {
    return (
      <div className={cn(
        "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs",
        needsAttention
          ? "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200"
          : "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        className,
      )}>
        <StatusIcon size={14} aria-hidden="true" />
        <span className="font-semibold">
          {needsAttention ? "Location needs attention" : locationState.city || "Shop location"}
        </span>
      </div>
    );
  }

  return (
    <section className={cn(
      "w-full rounded-2xl border p-4 md:p-5 shadow-sm",
      needsAttention
        ? "border-amber-500/30 bg-amber-500/[0.07]"
        : "border-outline-variant/10 bg-surface-container-low",
      className,
    )} aria-labelledby="shop-location-summary">
      <div className="flex items-start gap-3">
        <div className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          needsAttention ? "bg-amber-500/15 text-amber-700" : "bg-primary/10 text-primary",
        )}>
          <StatusIcon size={20} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 id="shop-location-summary" className="font-bold text-on-surface">
            {needsAttention ? "Location needs attention" : "Shop location"}
          </h4>
          <p className="mt-1 text-sm font-medium text-on-surface">
            {locationState.address || locationState.city || "Add your shop address"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
            {needsAttention
              ? `Your map pin doesn't appear to match ${syncAnalysis.storedCity}.`
              : mayNeedReview
                ? `Your map pin appears closer to ${syncAnalysis.closestHubName}. Check it when convenient.`
                : "Customers and riders will use this location to find your shop."}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {onOpenStorefrontMap && (
          <button type="button" onClick={onOpenStorefrontMap} className={cn(
            "min-h-11 rounded-xl px-4 text-sm font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50",
            needsAttention
              ? "bg-primary text-on-primary hover:bg-primary/90"
              : "border border-outline-variant/20 bg-surface-container-lowest text-on-surface hover:bg-surface-container-high",
          )}>
            {needsAttention ? "Fix location" : "View map"}
          </button>
        )}
        {onDetectGPS && (
          <button type="button" onClick={onDetectGPS} disabled={isLocating} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-4 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50">
            <Navigation size={15} aria-hidden="true" />
            {isLocating ? "Finding your location…" : "Use my current location"}
          </button>
        )}
        {onSave && (
          <button type="button" onClick={onSave} disabled={isSaving} className="min-h-11 rounded-xl bg-primary px-4 text-sm font-bold text-on-primary transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50">
            {isSaving ? "Saving…" : "Save location"}
          </button>
        )}
      </div>

      <div className="mt-4 border-t border-outline-variant/10 pt-3">
        <button type="button" onClick={() => setShowDetails((current) => !current)} aria-expanded={showDetails} className="flex min-h-11 w-full items-center justify-between gap-3 text-left text-sm font-semibold text-on-surface-variant transition-colors hover:text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50">
          <span>Advanced location details</span>
          {showDetails ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
        </button>

        {showDetails && (
          <div className="mt-3 space-y-4 rounded-xl bg-surface-container-high p-4 text-xs text-on-surface-variant">
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><dt className="font-semibold text-on-surface">Selected area</dt><dd>{syncAnalysis.storedCity || locationState.city}</dd></div>
              <div><dt className="font-semibold text-on-surface">Area near your map pin</dt><dd>{syncAnalysis.closestHubName}</dd></div>
              <div><dt className="font-semibold text-on-surface">Map coordinates</dt><dd className="font-mono">{locationState.lat.toFixed(5)}, {locationState.lng.toFixed(5)}</dd></div>
              <div><dt className="font-semibold text-on-surface">Distance from nearby area</dt><dd>{syncAnalysis.distanceFromHubKm.toFixed(1)} km</dd></div>
            </dl>
            {syncAnalysis.coveredTownships.length > 0 && (
              <div><p className="font-semibold text-on-surface">Areas within your delivery range</p><p className="mt-1">{syncAnalysis.coveredTownships.join(", ")}</p></div>
            )}
            {syncAnalysis.status !== "synced" && onAutoAlign && (
              <button type="button" onClick={handleUseDetectedArea} className="min-h-11 rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-4 font-bold text-on-surface hover:bg-surface-container">
                Use {syncAnalysis.closestHubName} as selected area
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default LocationSyncIndicator;
