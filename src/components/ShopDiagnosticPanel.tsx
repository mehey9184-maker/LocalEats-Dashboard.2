import React from "react";
import { Shop } from "../types";
import { FileCode, Activity } from "lucide-react";

interface ShopDiagnosticPanelProps {
  currentShop: Shop | null;
}

export const ShopDiagnosticPanel: React.FC<ShopDiagnosticPanelProps> = ({ currentShop }) => {
  if (!currentShop) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex items-start gap-3 mt-4">
        <Activity className="text-rose-600 mt-0.5" size={18} />
        <div>
          <h4 className="text-sm font-bold text-rose-800 dark:text-rose-300">Shop Diagnostic Tool</h4>
          <p className="text-xs text-rose-700/80 dark:text-rose-400/80 mt-1">
            No active shop record loaded for the current user. Client apps will report "No Shop Available".
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-emerald-500/5 border border-emerald-500/20 p-5 rounded-2xl mt-4 space-y-3">
      <div className="flex items-center gap-2 mb-2 border-b border-emerald-500/10 pb-2">
        <FileCode className="text-emerald-600" size={16} />
        <h4 className="text-sm font-extrabold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">
          Firestore Record Diagnostics
        </h4>
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-xs font-mono">
        <div className="bg-surface-container-high p-2 rounded-lg">
          <span className="text-on-surface-variant block mb-0.5 uppercase text-[10px] tracking-wider">is_active</span>
          <span className={currentShop.is_active ? "text-emerald-600 font-bold" : "text-rose-500 font-bold"}>
            {String(currentShop.is_active)}
          </span>
        </div>
        <div className="bg-surface-container-high p-2 rounded-lg">
          <span className="text-on-surface-variant block mb-0.5 uppercase text-[10px] tracking-wider">Shop ID</span>
          <span className="text-primary font-bold">{currentShop.id}</span>
        </div>
        <div className="bg-surface-container-high p-2 rounded-lg col-span-2">
          <span className="text-on-surface-variant block mb-0.5 uppercase text-[10px] tracking-wider">Owner ID</span>
          <span className="text-on-surface font-medium truncate">{currentShop.owner_id || "None"}</span>
        </div>
        <div className="bg-surface-container-high p-2 rounded-lg col-span-2 overflow-auto max-h-40">
          <span className="text-on-surface-variant block mb-0.5 uppercase text-[10px] tracking-wider">Raw JSON Data</span>
          <pre className="text-[10px] text-on-surface whitespace-pre-wrap">
            {JSON.stringify(currentShop, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
};
