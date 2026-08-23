import React from "react";
import { CheckCircle2 } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { OrderStatus } from "../types";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface OrderStatusBadgeProps {
  status: OrderStatus;
  className?: string;
  showDot?: boolean;
}

export const STATUS_STYLES: Record<OrderStatus, { bg: string; dotColor: string; label: string }> = {
  pending: {
    bg: "bg-primary-fixed text-on-primary-fixed",
    dotColor: "bg-primary",
    label: "Pending",
  },
  accepted: {
    bg: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    dotColor: "bg-blue-500",
    label: "Accepted",
  },
  preparing: {
    bg: "bg-primary/10 text-primary dark:bg-primary/20",
    dotColor: "bg-primary",
    label: "Preparing",
  },
  ready: {
    bg: "bg-tertiary/10 text-tertiary dark:bg-tertiary/20",
    dotColor: "bg-tertiary",
    label: "Ready",
  },
  completed: {
    bg: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    dotColor: "bg-emerald-500",
    label: "Completed",
  },
  cancelled: {
    bg: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    dotColor: "bg-red-500",
    label: "Cancelled",
  },
  dispatched: {
    bg: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    dotColor: "bg-purple-500",
    label: "Dispatched",
  },
};

export const OrderStatusBadge: React.FC<OrderStatusBadgeProps> = ({ status, className, showDot = true }) => {
  const styles = STATUS_STYLES[status] || {
    bg: "bg-surface-container-highest text-on-surface-variant",
    dotColor: "bg-outline",
    label: status,
  };

  const { bg, dotColor, label } = styles;
  const isLive = status === "pending" || status === "preparing" || status === "accepted";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold capitalize",
        bg,
        className
      )}
    >
      {showDot && (
        isLive ? (
          <span className="relative flex h-2 w-2">
            <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", dotColor)}></span>
            <span className={cn("relative inline-flex rounded-full h-2 w-2", dotColor)}></span>
          </span>
        ) : (
          status === "completed" ? (
            <CheckCircle2 size={12} className="shrink-0" />
          ) : (
            <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColor)} />
          )
        )
      )}
      <span>{label}</span>
    </span>
  );
};
