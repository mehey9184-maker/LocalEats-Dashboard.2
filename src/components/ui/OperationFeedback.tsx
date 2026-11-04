import React from "react";
import { AlertCircle, CheckCircle2, Info, Loader2 } from "lucide-react";

export type OperationFeedbackStatus = "idle" | "loading" | "success" | "error" | "unverified";

interface OperationFeedbackProps {
  status: OperationFeedbackStatus;
  message?: string;
  detail?: string;
  onRetry?: () => void;
  className?: string;
}

const defaults: Record<Exclude<OperationFeedbackStatus, "idle">, string> = {
  loading: "Working…",
  success: "Confirmed",
  error: "Could not finish",
  unverified: "Result not verified",
};

/** UX feedback only; callers must set success after authoritative confirmation. */
export const OperationFeedback: React.FC<OperationFeedbackProps> = ({
  status,
  message,
  detail,
  onRetry,
  className = "",
}) => {
  if (status === "idle") return null;
  const Icon = status === "loading" ? Loader2 :
    status === "success" ? CheckCircle2 :
    status === "error" ? AlertCircle : Info;
  const tone = status === "success" ? "text-emerald-700 dark:text-emerald-300" :
    status === "error" ? "text-error" :
    status === "unverified" ? "text-amber-700 dark:text-amber-300" : "text-primary";

  return (
    <div
      role={status === "error" ? "alert" : "status"}
      aria-live={status === "error" ? "assertive" : "polite"}
      aria-atomic="true"
      className={`flex flex-wrap items-center gap-2.5 rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-3 py-2.5 text-sm shadow-sm ${className}`}
    >
      <Icon
        size={18}
        aria-hidden="true"
        className={`shrink-0 ${tone} ${status === "loading" ? "animate-spin motion-reduce:animate-none" : ""}`}
      />
      <div className="min-w-0 flex-1">
        <p className="font-bold text-on-surface">{message || defaults[status]}</p>
        {detail && <p className="mt-0.5 text-xs leading-5 text-on-surface-variant">{detail}</p>}
      </div>
      {onRetry && (status === "error" || status === "unverified") && (
        <button type="button" onClick={onRetry}
          className="min-h-9 rounded-lg border border-outline-variant/25 px-3 py-1.5 text-xs font-bold text-primary hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-primary">
          Retry
        </button>
      )}
    </div>
  );
};
