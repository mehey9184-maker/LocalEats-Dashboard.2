import React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div
      className={cn(
        "rounded-md shimmer-effect",
        className,
      )}
    />
  );
};

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="p-6 md:p-8 space-y-8 animate-pulse">
      {/* Top Header Row / Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/60 backdrop-blur-md p-6 rounded-[2rem] border border-gray-100 shadow-sm">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 rounded-xl" />
          <Skeleton className="h-4 w-64 rounded-lg" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-11 w-32 rounded-full" />
          <Skeleton className="h-11 w-11 rounded-full" />
        </div>
      </div>

      {/* Grid of Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white/80 border border-gray-100 p-6 rounded-[2rem] shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
            <Skeleton className="h-9 w-32 rounded-xl" />
            <Skeleton className="h-3 w-40 rounded" />
          </div>
        ))}
      </div>

      {/* Main Double-Panel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white/80 border border-gray-100 p-6 rounded-[2.5rem] shadow-sm space-y-6 h-[400px]">
          <div className="flex justify-between items-center">
            <Skeleton className="h-6 w-36 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
          <Skeleton className="h-full w-full rounded-[1.5rem]" />
        </div>
        <div className="bg-white/80 border border-gray-100 p-6 rounded-[2.5rem] shadow-sm space-y-6 h-[400px] flex flex-col justify-between">
          <div className="space-y-4">
            <Skeleton className="h-6 w-28 rounded-lg" />
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex gap-4 items-center">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-full rounded" />
                  <Skeleton className="h-3 w-1/2 rounded" />
                </div>
              </div>
            ))}
          </div>
          <Skeleton className="h-12 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
};
