import React, { useState } from "react";
import {
  AlertCircle,
  Check,
  Circle,
  Clock3,
  Loader2,
  LogOut,
  MapPin,
  RefreshCw,
  ShieldAlert,
  Store,
} from "lucide-react";
import { Shop } from "../types";

interface PendingShopApprovalProps {
  shop: Shop;
  onRefresh: () => void | Promise<void>;
  onSignOut: () => void | Promise<void>;
}

export const PendingShopApproval: React.FC<PendingShopApprovalProps> = ({
  shop,
  onRefresh,
  onSignOut,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const status = shop.approval_status === "rejected" || shop.approval_status === "suspended"
    ? shop.approval_status
    : "pending";
  const approvalReason = typeof shop.approval_reason === "string"
    ? shop.approval_reason.trim()
    : "";
  const shopAddress = shop.address?.trim() || shop.location?.trim();

  const content = status === "rejected"
    ? {
        title: "Your shop needs attention",
        message: "We couldn't approve your shop with the current information.",
        visibility: "Your shop is not visible to customers.",
        reasonTitle: "Why this needs attention",
        reasonFallback: "We need to review some of your shop information before it can be approved.",
        iconStyle: "bg-amber-500/10 text-amber-700",
        statusStyle: "bg-amber-500/10 text-amber-800",
      }
    : status === "suspended"
      ? {
          title: "Your shop is temporarily paused",
          message: "Your shop is currently unavailable on LocalEats.",
          visibility: "Orders and merchant tools remain unavailable while the shop is suspended.",
          reasonTitle: "Reason",
          reasonFallback: "LocalEats has temporarily paused this shop while its account is being reviewed.",
          iconStyle: "bg-orange-500/10 text-orange-700",
          statusStyle: "bg-orange-500/10 text-orange-800",
        }
      : {
          title: "We're reviewing your shop",
          message: "Your shop was submitted successfully. LocalEats is reviewing the details before it can appear to customers.",
          visibility: "Your shop is not visible to customers yet.",
          reasonTitle: null,
          reasonFallback: null,
          iconStyle: "bg-primary/10 text-primary",
          statusStyle: "bg-primary/10 text-primary",
        };

  const refresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface px-4 py-6 text-on-surface sm:py-10 md:px-8">
      <div className="mx-auto flex max-w-2xl justify-center">
        <section className="w-full overflow-hidden rounded-[2rem] border border-outline-variant/15 bg-surface-container-lowest p-5 text-center shadow-xl sm:p-8 md:p-10">
          <div className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl sm:h-20 sm:w-20 sm:rounded-3xl ${content.iconStyle}`}>
            {status === "pending" && <Clock3 size={36} aria-hidden="true" />}
            {status === "rejected" && <AlertCircle size={36} aria-hidden="true" />}
            {status === "suspended" && <ShieldAlert size={36} aria-hidden="true" />}
          </div>
          <h1 className="font-headline text-2xl font-black tracking-tight sm:text-3xl">{content.title}</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm font-medium leading-6 text-on-surface-variant">{content.message}</p>
          <p className="mx-auto mt-3 max-w-xl text-sm font-black leading-6 text-on-surface">{content.visibility}</p>

          {status === "pending" && (
            <div className="mx-auto mt-6 max-w-lg rounded-2xl border border-outline-variant/15 bg-surface-container p-4 text-left" aria-label="Shop approval progress">
              <p className="text-xs font-black uppercase tracking-wider text-on-surface-variant">Approval progress</p>
              <ol className="mt-4 grid grid-cols-3 gap-2">
                <li className="min-w-0 rounded-xl bg-emerald-500/10 px-2 py-3 text-center text-emerald-700">
                  <Check className="mx-auto" size={20} aria-hidden="true" />
                  <span className="mt-2 block break-words text-xs font-black">Submitted</span>
                  <span className="mt-1 block text-[11px] font-bold">Complete</span>
                </li>
                <li className="min-w-0 rounded-xl bg-primary/10 px-2 py-3 text-center text-primary" aria-current="step">
                  <Clock3 className="mx-auto" size={20} aria-hidden="true" />
                  <span className="mt-2 block break-words text-xs font-black">Under review</span>
                  <span className="mt-1 block text-[11px] font-bold">Current</span>
                </li>
                <li className="min-w-0 rounded-xl bg-surface-container-high px-2 py-3 text-center text-on-surface-variant">
                  <Circle className="mx-auto" size={20} aria-hidden="true" />
                  <span className="mt-2 block break-words text-xs font-black">Approved</span>
                  <span className="mt-1 block text-[11px] font-bold">Next</span>
                </li>
              </ol>
            </div>
          )}

          {status !== "pending" && (
            <div className="mx-auto mt-6 max-w-lg rounded-2xl border border-outline-variant/20 bg-surface-container p-4 text-left sm:p-5">
              <p className="text-xs font-black uppercase tracking-wider text-on-surface-variant">{content.reasonTitle}</p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm font-semibold leading-6 text-on-surface">
                {approvalReason || content.reasonFallback}
              </p>
            </div>
          )}

          <div className="mx-auto mt-6 max-w-lg rounded-2xl border border-outline-variant/15 bg-surface-container p-4 text-left sm:p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary"><Store size={21} aria-hidden="true" /></div>
              <div className="min-w-0">
                <p className="break-words font-headline text-lg font-black">{shop.name}</p>
                {shop.category && <p className="break-words text-xs font-medium text-on-surface-variant">{shop.category}</p>}
              </div>
            </div>
            {shopAddress && (
              <div className="mt-4 flex items-start gap-2 border-t border-outline-variant/15 pt-4 text-xs font-medium leading-5 text-on-surface-variant">
                <MapPin className="mt-0.5 shrink-0" size={15} aria-hidden="true" />
                <span className="break-words">{shopAddress}</span>
              </div>
            )}
            <div className="mt-4 flex items-center justify-between border-t border-outline-variant/15 pt-4 text-xs">
              <span className="font-bold text-on-surface-variant">Approval status</span>
              <span className={`rounded-full px-3 py-1 font-black uppercase tracking-wider ${content.statusStyle}`}>{status}</span>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => void refresh()} disabled={isRefreshing} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black text-on-primary shadow-lg shadow-primary/20 disabled:opacity-60">
              {isRefreshing ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />} Refresh Status
            </button>
            <button type="button" onClick={() => void onSignOut()} disabled={isRefreshing} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-outline-variant/30 px-5 py-3 text-sm font-black text-on-surface-variant hover:bg-surface-container disabled:opacity-60">
              <LogOut size={18} /> Sign Out
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
