import React from "react";

export const DashboardSkeleton: React.FC<{ title?: string }> = ({ title = "Loading Section..." }) => {
  return (
    <div className="w-full p-6 space-y-6 animate-pulse bg-surface-container-lowest/50 rounded-3xl border border-outline-variant/15 my-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-surface-container-high rounded-xl flex items-center px-2 text-xs font-bold text-on-surface-variant/40">{title}</div>
          <div className="h-4 w-72 bg-surface-container rounded-lg"></div>
        </div>
        <div className="h-10 w-32 bg-surface-container-high rounded-full"></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
        <div className="h-32 bg-surface-container rounded-2xl"></div>
        <div className="h-32 bg-surface-container rounded-2xl"></div>
        <div className="h-32 bg-surface-container rounded-2xl"></div>
      </div>

      <div className="h-64 bg-surface-container-low rounded-3xl border border-outline-variant/10"></div>
    </div>
  );
};
