import React, { useState } from "react";
import { Clock3, Loader2, LogOut, RefreshCw, ShieldCheck, Store } from "lucide-react";
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
  const status = shop.approval_status || "pending";

  const content = status === "rejected"
    ? {
        title: "Shop review update",
        message: "Your shop is not approved at this time. LocalEats will provide next steps in a future update.",
      }
    : status === "suspended"
      ? {
          title: "Shop access paused",
          message: "Your shop is currently suspended and operational tools remain unavailable.",
        }
      : {
          title: "Shop submitted for approval",
          message: "Your shop has been created successfully and is being reviewed by LocalEats. It will not be visible to customers until it is approved.",
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
    <div className="min-h-screen bg-surface px-4 py-10 text-on-surface md:px-8">
      <div className="mx-auto flex min-h-[80vh] max-w-2xl items-center justify-center">
        <section className="w-full rounded-[2rem] border border-outline-variant/15 bg-surface-container-lowest p-6 text-center shadow-xl md:p-10">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 text-primary">
            {status === "pending" ? <Clock3 size={38} /> : <ShieldCheck size={38} />}
          </div>
          <h1 className="font-headline text-3xl font-black tracking-tight">{content.title}</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm font-medium leading-6 text-on-surface-variant">{content.message}</p>

          <div className="mx-auto mt-8 max-w-md rounded-2xl border border-outline-variant/15 bg-surface-container p-5 text-left">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-on-primary"><Store size={21} /></div>
              <div>
                <p className="font-headline text-lg font-black">{shop.name}</p>
                {shop.category && <p className="text-xs font-medium text-on-surface-variant">{shop.category}</p>}
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-outline-variant/15 pt-4 text-xs">
              <span className="font-bold text-on-surface-variant">Approval status</span>
              <span className="rounded-full bg-primary/10 px-3 py-1 font-black uppercase tracking-wider text-primary">{status}</span>
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
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
