import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Inbox, AlertTriangle, ArrowRight } from "lucide-react";
import type { MerchantNoticeTopic } from "../hooks/usePageNotificationAttention";
import { Order, MenuItem } from "../types";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface NotificationCenterSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  menuItems: MenuItem[];
  onPreviewTestNotice?: (topic: MerchantNoticeTopic) => void;
}

export const NotificationCenterSidePanel: React.FC<NotificationCenterSidePanelProps> = ({
  isOpen,
  onClose,
  orders,
  menuItems,
  onPreviewTestNotice,
}) => {
  const pendingOrdersCount = Array.isArray(orders)
    ? orders.filter((o) => o && (o.status === "pending" || o.status === "accepted")).length
    : 0;
  const lowStockItems = Array.isArray(menuItems)
    ? menuItems.filter((m) => m && typeof m.stock_quantity === "number" && m.stock_quantity < 5)
    : [];

  const alerts = [];

  if (pendingOrdersCount > 0) {
    alerts.push({
      id: "orders",
      type: "info",
      icon: <Inbox size={16} />,
      title: "Active Orders",
      message: `You have ${pendingOrdersCount} active orders needing attention.`,
      time: "Current",
    });
  }

  if (lowStockItems.length > 0) {
    alerts.push({
      id: "inventory",
      type: "warning",
      icon: <AlertTriangle size={16} />,
      title: "Low Inventory",
      message: `${lowStockItems.length} items are running low on stock. Please restock soon.`,
      time: "Current",
    });
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="notification-center-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] flex justify-end bg-black/20 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="w-full max-w-sm h-full bg-surface-container-lowest border-l border-outline-variant/20 shadow-[-8px_0_32px_-12px_rgba(0,0,0,0.1)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 flex justify-between items-center border-b border-outline-variant/10">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-xl text-primary">
                  <Inbox size={20} />
                </div>
                <h3 className="font-bold text-on-surface">Notification Center</h3>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-surface-container-low rounded-full transition-colors text-on-surface-variant hover:text-on-surface"
              >
                <ArrowRight size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {onPreviewTestNotice && (
                <section aria-label="Preview navigation attention tester"
                  className="rounded-2xl border border-dashed border-amber-400/60 bg-amber-50/70 dark:bg-amber-950/25 p-3 space-y-2">
                  <p className="text-[11px] font-black text-amber-900 dark:text-amber-200">
                    Preview only · Test page icon animation
                  </p>
                  <p className="text-[11px] text-on-surface-variant">
                    This only shakes an icon. It does not create a notification or order.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {([
                      ["new_order","Orders"],["inventory_low","Menu"],
                      ["rider","Riders"],["marketing","Marketing"],
                      ["payment","Payments"],["settings","Settings"]
                    ] as const).map(([topic,label])=>(
                      <button key={topic} type="button"
                        onClick={()=>onPreviewTestNotice(topic)}
                        className="min-h-9 rounded-lg bg-white dark:bg-zinc-900 border border-amber-300/70 px-3 text-xs font-semibold text-on-surface">
                        Shake {label}
                      </button>
                    ))}
                  </div>
                </section>
              )}
              {alerts.length === 0 ? (
                <div className="text-center p-8 mt-10">
                  <div className="w-16 h-16 bg-surface-container-highest rounded-full flex items-center justify-center mx-auto mb-4 text-on-surface-variant/40">
                    <Inbox size={32} />
                  </div>
                  <h4 className="font-bold text-on-surface">No new notifications</h4>
                  <p className="text-xs text-on-surface-variant mt-2">You're all caught up!</p>
                </div>
              ) : (
                alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-4 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest shadow-sm flex flex-col gap-2 relative overflow-hidden group"
                  >
                    {alert.type === "warning" && (
                      <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                    )}
                    {alert.type === "info" && (
                      <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                    )}
                    {alert.type === "success" && (
                      <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                    )}

                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "p-2 rounded-xl shrink-0 text-white",
                          alert.type === "warning"
                            ? "bg-amber-500"
                            : alert.type === "info"
                              ? "bg-blue-500"
                              : "bg-emerald-500",
                        )}
                      >
                        {alert.icon || <Inbox size={16} />}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <h4 className="text-sm font-bold text-on-surface">{alert.title}</h4>
                          <span className="text-[10px] font-medium text-on-surface-variant/60 whitespace-nowrap ml-2">
                            {alert.time}
                          </span>
                        </div>
                        <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                          {alert.message}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
