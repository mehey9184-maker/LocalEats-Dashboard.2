import React from "react";
import { Shop } from "../types";
import { FileCode, Activity } from "lucide-react";

interface ShopDiagnosticPanelProps {
  currentShop: Shop | null;
}

/** A local, privacy-safe UI summary — not a Firestore verification or a
 * permission/security audit. Never print raw shop JSON or owner identifiers.
 */
export const ShopDiagnosticPanel: React.FC<ShopDiagnosticPanelProps> = ({ currentShop }) => {
  if (!currentShop) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex items-start gap-3 mt-4">
        <Activity className="text-rose-600 mt-0.5" size={18} />
        <div>
          <h4 className="text-sm font-bold text-rose-800 dark:text-rose-300">Shop Diagnostics — Preview Only</h4>
          <p className="text-xs text-rose-700/80 dark:text-rose-400/80 mt-1">
            No selected shop record is available for this view. This does not prove the shop is missing from the database.
          </p>
        </div>
      </div>
    );
  }

  const status = typeof currentShop.is_active === "boolean"
    ? currentShop.is_active ? "Recorded available" : "Recorded unavailable"
    : "Status unavailable";

  return (
    <div className="bg-surface-container-low border border-outline-variant/20 p-5 rounded-2xl mt-4 space-y-3">
      <div className="flex items-center gap-2 mb-2 border-b border-outline-variant/10 pb-2">
        <FileCode className="text-on-surface-variant" size={16} />
        <h4 className="text-sm font-extrabold text-on-surface uppercase tracking-wide">
          Shop Record Diagnostics — Preview
        </h4>
      </div>
      <p role="status" className="text-xs text-on-surface-variant">
        Read-only summary of the currently loaded shop record. No live Firestore verification, permission check or customer-order availability is confirmed here.
      </p>
      <div className="grid grid-cols-2 gap-4 text-xs font-mono">
        <div className="bg-surface-container-high p-2 rounded-lg">
          <span className="text-on-surface-variant block mb-0.5 uppercase text-[10px] tracking-wider">Shop availability</span>
          <span className="text-on-surface font-bold">{status}</span>
        </div>
        <div className="bg-surface-container-high p-2 rounded-lg">
          <span className="text-on-surface-variant block mb-0.5 uppercase text-[10px] tracking-wider">Selected shop</span>
          <span className="text-on-surface font-bold">Record loaded</span>
        </div>
        <div className="bg-surface-container-high p-2 rounded-lg col-span-2">
          <span className="text-on-surface-variant block mb-0.5 uppercase text-[10px] tracking-wider">Owner identifier</span>
          <span className="text-on-surface font-medium">Hidden in merchant Preview</span>
        </div>
        <div className="bg-surface-container-high p-2 rounded-lg col-span-2">
          <span className="text-on-surface-variant block mb-0.5 uppercase text-[10px] tracking-wider">Raw JSON data</span>
          <p className="text-xs text-on-surface-variant">Not displayed here to protect internal and potentially sensitive shop fields.</p>
        </div>
      </div>
    </div>
  );
};
