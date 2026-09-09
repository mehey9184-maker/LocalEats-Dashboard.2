import React, { useState } from "react";
import { ShoppingBag, Bike, X, ArrowRight, ShieldAlert, Users, KeyRound, Copy, Check, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Order } from "../types";
import { toast } from "sonner";
import { isRiderOnline } from "../utils/availabilityChecker";

export interface RiderConnection {
  id: string;
  shop_id: number;
  rider_id: string | null;
  rider_name: string | null;
  rider_phone?: string | null;
  connection_code: string;
  expires_at: string;
  status: "active" | "expired" | "offline" | string;
  is_online: boolean;
  created_at: string;
  rating?: number;
  vehicle_type?: string;
  current_latitude?: number;
  current_longitude?: number;
}

interface NoLinkedRiderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  connectedRiders?: RiderConnection[];
  pairingCode?: string;
  onDispatchToRider?: (orderId: string, riderId: string, riderName?: string, riderPhone?: string) => Promise<void> | void;
  onPromptCustomerForPickup: (orderId: string) => Promise<void> | void;
  onOpenPairingCenter: () => void;
  onAcceptOrder?: (orderId: string) => Promise<void> | void;
}

export const NoLinkedRiderModal: React.FC<NoLinkedRiderModalProps> = ({
  isOpen,
  onClose,
  order,
  connectedRiders = [],
  pairingCode = "LOCAL-EATS-PASS",
  onDispatchToRider,
  onPromptCustomerForPickup,
  onOpenPairingCenter,
  onAcceptOrder,
}) => {
  const [selectedRiderId, setSelectedRiderId] = useState<string>("");
  const [copiedCode, setCopiedCode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !order) return null;

  const activeRiders = connectedRiders.filter(
    (r) => r.rider_id || r.connection_code === "IN-HOUSE"
  );

  const handleAssignRider = async () => {
    if (!selectedRiderId) {
      toast.error("Please select a rider from the list first");
      return;
    }
    const chosen = activeRiders.find(
      (r) => r.rider_id === selectedRiderId || String(r.id) === selectedRiderId
    );
    if (!chosen) return;

    setIsSubmitting(true);
    try {
      if (onDispatchToRider) {
        await onDispatchToRider(
          order.id,
          chosen.rider_id || String(chosen.id),
          chosen.rider_name || undefined,
          chosen.rider_phone || undefined
        );
      }
      if (onAcceptOrder) {
        await onAcceptOrder(order.id);
      }
      toast.success(`Order assigned to ${chosen.rider_name || "Rider"} and accepted!`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed to assign rider");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(pairingCode);
    setCopiedCode(true);
    toast.success("Pairing cipher code copied to clipboard!");
    setTimeout(() => setCopiedCode(false), 2500);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-surface-container-low dark:bg-zinc-900 border border-outline-variant/20 rounded-3xl p-6 md:p-8 max-w-xl w-full shadow-2xl relative overflow-hidden text-on-surface"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-on-surface-variant/40 hover:text-on-surface hover:bg-on-surface/5 rounded-full transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>

          {/* Header Icon */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
              <ShieldAlert size={26} className="animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full tracking-wider border border-amber-500/20">
                Unlinked Courier Required
              </span>
              <h3 className="text-lg font-headline font-black text-on-surface tracking-tight mt-0.5">
                Accept Delivery Order #{order.id.slice(-4).toUpperCase()}
              </h3>
            </div>
          </div>

          <p className="text-xs text-on-surface-variant leading-relaxed font-medium mb-5 bg-surface-container-high/40 p-3 rounded-2xl border border-outline-variant/10">
            This delivery order does not have an assigned courier yet. Please choose one of the three dispatch options below to proceed:
          </p>

          {/* 3 Dedicated Option Cards */}
          <div className="space-y-3.5 mb-6 max-h-[55vh] overflow-y-auto pr-1">
            
            {/* OPTION 1: Assign from Available List */}
            <div className="bg-surface-container-high/60 dark:bg-zinc-800/60 border border-outline-variant/10 rounded-2xl p-4 flex flex-col gap-3 group hover:border-emerald-500/30 transition-all">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Users size={20} />
                </div>
                <div className="space-y-1 flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wide text-on-surface">Option 1: Assign from Available List</h4>
                    <span className="text-[9px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      {activeRiders.length} Available
                    </span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant leading-normal">
                    Select a connected rider to assign directly and dispatch this mission immediately.
                  </p>

                  {/* Rider selection list / dropdown */}
                  {activeRiders.length > 0 ? (
                    <div className="mt-2 space-y-2">
                      <select
                        value={selectedRiderId}
                        onChange={(e) => setSelectedRiderId(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-surface-container-lowest dark:bg-zinc-900 border border-outline-variant/20 rounded-xl font-medium outline-none focus:ring-2 focus:ring-emerald-500 text-on-surface cursor-pointer"
                      >
                        <option value="">-- Choose Linked Rider --</option>
                        {activeRiders.map((r) => {
                          const rId = r.rider_id || String(r.id);
                          const isOnline = isRiderOnline(r);
                          return (
                            <option key={rId} value={rId}>
                              {r.rider_name || "Courier"} ({isOnline ? "🟢 Online" : "⚪ Offline"}) {r.rider_phone ? `- ${r.rider_phone}` : ""}
                            </option>
                          );
                        })}
                      </select>

                      <button
                        onClick={handleAssignRider}
                        disabled={!selectedRiderId || isSubmitting}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                      >
                        <Zap size={14} />
                        <span>Assign Rider & Accept Order</span>
                      </button>
                    </div>
                  ) : (
                    <div className="mt-2 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                      No connected riders found for this shop. Use Option 2 to pair a new rider.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* OPTION 2: Manual Pairing Code */}
            <div className="bg-surface-container-high/60 dark:bg-zinc-800/60 border border-outline-variant/10 rounded-2xl p-4 flex flex-col gap-3 group hover:border-indigo-500/30 transition-all">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 mt-0.5">
                  <KeyRound size={20} />
                </div>
                <div className="space-y-1 flex-1">
                  <h4 className="text-xs font-black uppercase tracking-wide text-on-surface">Option 2: Manual Pairing Code</h4>
                  <p className="text-[11px] text-on-surface-variant leading-normal">
                    Provide your 24-hour merchant pairing code to a rider to connect instantly.
                  </p>

                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="flex-1 bg-surface-container-lowest dark:bg-zinc-900 border border-indigo-500/30 px-3 py-2 rounded-xl text-center font-mono font-black text-sm text-indigo-600 dark:text-indigo-400 tracking-wider">
                      {pairingCode}
                    </div>
                    <button
                      onClick={handleCopyCode}
                      className="px-3 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      {copiedCode ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                      <span>{copiedCode ? "Copied" : "Copy"}</span>
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      onClose();
                      onOpenPairingCenter();
                    }}
                    className="w-full mt-2 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold text-xs rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Bike size={14} />
                    <span>Open Rider Pairing Center</span>
                  </button>
                </div>
              </div>
            </div>

            {/* OPTION 3: Prompt Customer for Collection Override */}
            <div className="bg-surface-container-high/60 dark:bg-zinc-800/60 border border-outline-variant/10 rounded-2xl p-4 flex flex-col gap-3 group hover:border-primary/30 transition-all">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <ShoppingBag size={20} />
                </div>
                <div className="space-y-1 flex-1">
                  <h4 className="text-xs font-black uppercase tracking-wide text-on-surface">Option 3: Prompt Customer for Collection Override</h4>
                  <p className="text-[11px] text-on-surface-variant leading-normal">
                    Switch order type to Self-Pickup / Collection so the kitchen can process it immediately without blocking on courier availability.
                  </p>
                  <button
                    onClick={async () => {
                      await onPromptCustomerForPickup(order.id);
                      toast.success("Order converted to Customer Self-Pickup!");
                      onClose();
                    }}
                    className="w-full mt-2 py-2.5 bg-primary text-on-primary font-black text-xs uppercase tracking-wider rounded-xl hover:opacity-95 transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <span>Prompt Customer & Convert to Pickup</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>

          </div>

          <div className="text-center pt-2 border-t border-outline-variant/10">
            <button
              onClick={onClose}
              className="text-xs font-bold text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
            >
              Cancel & Return
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
