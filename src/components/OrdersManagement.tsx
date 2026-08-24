import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Clock,
  AlertCircle,
  Bike,
  RefreshCw,
  Search,
  Filter,
  Check,
  X,
  Printer,
  Phone,
  ShoppingBag,
  ArrowRight,
  TrendingUp,
  Store,
  Send,
  Trash2,
  Bell,
  MapPin,
  Zap,
  Calendar,
  Eye,
  AlertTriangle,
  Inbox,
  Volume2,
  PauseCircle,
  ChevronRight,
  Activity,
  Wifi,
  Database,
  Copy,
  UtensilsCrossed,
  CreditCard,
  LayoutGrid,
  FileDown,
  ReceiptText,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  RotateCcw,
  GripVertical,
  Rocket,
  EyeOff,
  Star,
  MessageCircle,
  Timer,
  Edit2,
  List,
  Settings,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import {
  checkPrinterConnectivity,
  type PrinterDiagnosticResult,
  type PrintingFormat,
  type QueuedPrintJob,
} from "../utils/escPosEngine";
import { isRiderOnline } from "../utils/availabilityChecker";
import { Order, Shop, OrderStatus, RiderProfile, Message, RiderConnection } from "../types";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { Pagination } from "./Pagination";
import { useAuthGuard } from "../hooks/useAuthGuard";
import { AddressDisplay } from "./AddressDisplay";
import { Skeleton } from "./ui/Skeleton";
import { NoLinkedRiderModal } from "./NoLinkedRiderModal";
import { DispatchAlertModal } from "./DispatchAlertModal";
import { format } from "date-fns";

export const isOrderDelivery = (order: Order): boolean => {
  return order.order_type === "delivery" || !!order.address;
};

export function safeGetOrderItems(rawItems: unknown): (string | { name: string; quantity: number; price?: number })[] {
  if (!rawItems) return [];
  if (Array.isArray(rawItems)) return rawItems;
  if (typeof rawItems === "string") {
    try {
      const parsed = JSON.parse(rawItems);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [rawItems];
    }
  }
  return [];
}

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface OrdersManagementProps {
  orders: Order[];
  onUpdateStatus: (id: string, status: OrderStatus, message?: string, estimatedTime?: string) => Promise<void> | void;
  onDispatchToRider?: (id: string, riderId: string, riderName?: string, riderPhone?: string) => Promise<void> | void;
  onConvertOrderToPickup?: (id: string) => Promise<void> | void;
  onDeleteAllOrders: () => void;
  loading: boolean;
  onRefresh: () => void;
  kitchenMode: boolean;
  setKitchenMode: (val: boolean) => void;
  soundAlerts: boolean;
  setSoundAlerts: (val: boolean) => void;
  onRequestRider: (id: string, riderId?: string, riderName?: string, riderPhone?: string) => void;
  onUnassignRider: (id: string) => void;
  onTabChange: (tab: string) => void;
  sendRiderNudge: (riderId: string, message: string) => Promise<void>;
  currentShop: Shop | undefined;
  printingFormat?: PrintingFormat;
  setPrintingFormat?: (format: PrintingFormat) => void;
  failedPrints?: QueuedPrintJob[];
  printingHardwareLoading?: boolean;
  handlePrintBluetoothDirect?: (order: Order) => Promise<boolean>;
  handlePrintUSBDirect?: (order: Order) => Promise<boolean>;
  retryQueuedPrintDirect?: (failedPrintId: string) => Promise<boolean>;
  clearPrintQueue?: () => void;
}

const ChatWindow = ({
  orderId,
  shopId,
  userId,
  onClose,
}: {
  orderId: string;
  shopId: number;
  userId: string;
  onClose: () => void;
}) => {
  const { subscribeWithAuthGuard } = useAuthGuard();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });

      if (!error && data) setMessages(data as Message[]);
      setLoading(false);
    };

    fetchMessages();

    // Real-time subscription
    let activeChannel: RealtimeChannel | null = null;
    let isMounted = true;
    void subscribeWithAuthGuard(`chat:${orderId}`, (ch) => 
      ch.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        },
      )
    ).then(ch => {
      if (ch) {
        if (isMounted) activeChannel = ch;
        else void supabase.removeChannel(ch);
      }
    });

    return () => {
      isMounted = false;
      if (activeChannel) void supabase.removeChannel(activeChannel);
    };
  }, [orderId, subscribeWithAuthGuard]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const message = {
      order_id: orderId,
      shop_id: shopId,
      user_id: userId,
      sender_id: shopId.toString(), // Shop is sender
      sender_type: "shop",
      content: newMessage.trim(),
    };

    const { error } = await supabase.from("chat_messages").insert(message);
    if (error) toast.error("Failed to send message");
    else setNewMessage("");
  };

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl overflow-hidden flex flex-col h-[400px] shadow-xl mt-4">
      <div className="p-4 bg-primary text-on-primary flex justify-between items-center">
        <div className="flex items-center gap-2">
          <MessageCircle size={18} />
          <span className="font-bold text-sm">
            Customer Chat - #LE-{orderId}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/20 rounded-full transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-surface-container-lowest"
      >
        {loading ? (
          <div className="flex justify-center p-4">
            <RefreshCw className="animate-spin text-primary/40" size={24} />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-on-surface-variant/40 py-12">
            <p className="text-xs italic">
              No messages yet. Start the conversation!
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex flex-col max-w-[80%]",
                msg.sender_type === "shop"
                  ? "ml-auto items-end"
                  : "mr-auto items-start",
              )}
            >
              <div
                className={cn(
                  "px-4 py-2 rounded-2xl text-sm shadow-sm",
                  msg.sender_type === "shop"
                    ? "bg-primary text-on-primary rounded-tr-none"
                    : "bg-surface-container-high text-on-surface rounded-tl-none",
                )}
              >
                {msg.content}
              </div>
              <span className="text-[9px] text-on-surface-variant/60 mt-1">
                {format(new Date(msg.created_at), "HH:mm")}
              </span>
            </div>
          ))
        )}
      </div>

      <form
        onSubmit={sendMessage}
        className="p-3 bg-surface-container-low border-t border-outline-variant/10 flex gap-2"
      >
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-surface-container-lowest border border-outline-variant/20 rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="submit"
          className="p-2 bg-primary text-on-primary rounded-full hover:scale-105 transition-transform"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};



export const OrdersManagement: React.FC<OrdersManagementProps> = ({
  orders,
  onUpdateStatus,
  onDispatchToRider,
  onConvertOrderToPickup,
  onDeleteAllOrders,
  loading,
  onRefresh,
  kitchenMode,
  setKitchenMode,
  soundAlerts,
  setSoundAlerts,
  onRequestRider,
  onUnassignRider,
  onTabChange,
  sendRiderNudge,
  currentShop,
  printingFormat: propPrintingFormat,
  setPrintingFormat: propSetPrintingFormat,
  failedPrints = [],
  printingHardwareLoading = false,
  handlePrintBluetoothDirect,
  handlePrintUSBDirect,
  retryQueuedPrintDirect,
  clearPrintQueue,
}) => {
  const { subscribeWithAuthGuard } = useAuthGuard();
  const [viewMode, setViewMode] = useState<"active" | "history">("active");
  const [layoutMode, setLayoutMode] = useState<"list" | "kanban">("kanban");
  const [printerDiagStatus, setPrinterDiagStatus] = useState<{
    bt: PrinterDiagnosticResult;
    usb: PrinterDiagnosticResult;
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [phoneSearch, setPhoneSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [acceptingOrderId, setAcceptingOrderId] = useState<string | null>(null);
  const [orderNotes, setOrderNotes] = useState(""); // Added for Order Notes
  const [selectedPendingOrders, setSelectedPendingOrders] = useState<string[]>([]); // Added for Bulk Actions
  const [preparingOrderId, setPreparingOrderId] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [readyOrderId, setReadyOrderId] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [chatOrderId, setChatOrderId] = useState<string | null>(null);
  const [showRiderPicker, setShowRiderPicker] = useState<string | null>(null);
  const [connectedRiders, setConnectedRiders] = useState<RiderConnection[]>([]);
  const [ratingOrderId, setRatingOrderId] = useState<string | null>(null);
  const [ratingValue, setRatingValue] = useState<number>(0);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const [unlinkedModalOrder, setUnlinkedModalOrder] = useState<Order | null>(null);
  const [dispatchAlertOrder, setDispatchAlertOrder] = useState<Order | null>(null);
  const [dispatchAlertType, setDispatchAlertType] = useState<"rider_dispatch" | "customer_status" | "rider_pairing">("customer_status");

  // Pending orders priority sorting & Drag and Drop state
  const pendingSortStorageKey = `localeats_pending_priority_${currentShop?.id || "default"}`;
  const [pendingOrderPriorityIds, setPendingOrderPriorityIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`localeats_pending_priority_${currentShop?.id || "default"}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [draggedPendingId, setDraggedPendingId] = useState<string | null>(null);
  const [dragOverPendingId, setDragOverPendingId] = useState<string | null>(null);

  const [prevShopId, setPrevShopId] = useState(currentShop?.id);
  if (prevShopId !== currentShop?.id) {
    setPrevShopId(currentShop?.id);
    try {
      const saved = localStorage.getItem(`localeats_pending_priority_${currentShop?.id || "default"}`);
      setPendingOrderPriorityIds(saved ? JSON.parse(saved) : []);
    } catch {
      setPendingOrderPriorityIds([]);
    }
  }

  const handleReorderPendingOrders = (sourceId: string, targetId: string) => {
    if (!sourceId || !targetId || sourceId === targetId) return;

    setPendingOrderPriorityIds((prev) => {
      const allPending = orders.filter((o) => o.status === "pending").map((o) => o.id);
      const currentOrdered = [
        ...prev.filter((id) => allPending.includes(id)),
        ...allPending.filter((id) => !prev.includes(id)),
      ];

      const fromIndex = currentOrdered.indexOf(sourceId);
      const toIndex = currentOrdered.indexOf(targetId);

      if (fromIndex === -1 || toIndex === -1) return prev;

      const updated = [...currentOrdered];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);

      try {
        localStorage.setItem(pendingSortStorageKey, JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to save pending order priorities", e);
      }

      toast.success(`Priority updated: #${sourceId.slice(-4).toUpperCase()} moved to position #${toIndex + 1}`);
      return updated;
    });
  };

  const handleResetPendingPriority = () => {
    setPendingOrderPriorityIds([]);
    try {
      localStorage.removeItem(pendingSortStorageKey);
    } catch {
      // ignore
    }
    toast.info("Pending order priority reset to default order");
  };

  const renderRiderStatusBadge = (order: Order) => {
    if (!isOrderDelivery(order)) {
      return (
        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 text-[8px] font-extrabold uppercase">
          <ShoppingBag size={10} /> Self-Pickup
        </div>
      );
    }

    const assignedRider = connectedRiders.find(
      (r) => r.rider_id === order.rider_id || String(r.id) === order.rider_id
    );
    const isAssigned = !!(order.rider_id || assignedRider);
    const isOnline = isRiderOnline(assignedRider);
    const riderName = assignedRider?.rider_name || (order.rider_id ? "Assigned Courier" : "");

    if (!isAssigned) {
      return (
        <div className="inline-flex items-center justify-between gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[9px] font-black uppercase tracking-wider animate-pulse w-full">
          <div className="flex items-center gap-1">
            <AlertTriangle size={11} className="text-amber-500 shrink-0" />
            <span>Finding Rider (Unassigned)</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (connectedRiders.length === 0 && !currentShop?.linked_rider_id) {
                setUnlinkedModalOrder(order);
              } else {
                setShowRiderPicker(order.id);
              }
            }}
            className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-white text-[8px] font-black uppercase rounded-lg transition-transform active:scale-95 flex items-center gap-0.5 cursor-pointer shrink-0 shadow-xs"
          >
            <Rocket size={10} />
            <span>Pair</span>
          </button>
        </div>
      );
    }

    return (
      <div className="inline-flex items-center justify-between gap-2 px-2.5 py-1 rounded-xl bg-surface-container-high/90 dark:bg-zinc-800/90 border border-emerald-500/30 text-[9px] font-bold w-full">
        <div className="flex items-center gap-1.5 min-w-0">
          {isOnline ? (
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          ) : (
            <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
          )}
          <span className="truncate text-on-surface font-black max-w-[100px]" title={riderName}>
            {riderName}
          </span>
          <span className={cn(
            "uppercase text-[8px] font-black px-1.5 py-0.2 rounded-md",
            isOnline ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
          )}>
            {isOnline ? "Online" : "Idle"}
          </span>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            if (order.rider_id) {
              void sendRiderNudge(order.rider_id, "Order update: Please check your active delivery mission!");
            } else {
              toast.error("No rider assigned to nudge");
            }
          }}
          className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-[8px] font-black uppercase tracking-wider rounded-lg transition-transform flex items-center gap-0.5 cursor-pointer shrink-0 shadow-xs"
          title="Trigger silent push notification alert to rider"
        >
          <Zap size={10} className="fill-current" />
          <span>Nudge</span>
        </button>
      </div>
    );
  };

  const [orderTags, setOrderTags] = useState<Record<string, string[]>>(() => {
    const tags: Record<string, string[]> = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("order_tags_")) {
          const orderId = key.replace("order_tags_", "");
          const val = JSON.parse(localStorage.getItem(key) || "[]");
          tags[orderId] = val;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return tags;
  });

  const toggleOrderTag = (orderId: string, tag: string) => {
    setOrderTags((prev) => {
      const current = prev[orderId] || [];
      const updated = current.includes(tag)
        ? current.filter((t) => t !== tag)
        : [...current, tag];
      localStorage.setItem(`order_tags_${orderId}`, JSON.stringify(updated));
      return { ...prev, [orderId]: updated };
    });
  };

  const getOrderTags = (order: Order): string[] => {
    const manualTags = orderTags[order.id] || [];
    const autoTags: string[] = [];

    // Auto large order tag
    const items = safeGetOrderItems(order.items);
    const hasManyItems = items.length > 3;
    const hasHighPrice = Number(order.total_price) > 300;
    if (hasManyItems || hasHighPrice) {
      autoTags.push("Large Order");
    }

    // Auto rush order tag
    const notesLower = (order.notes || "").toLowerCase();
    if (notesLower.includes("urgent") || notesLower.includes("fast") || notesLower.includes("asap") || notesLower.includes("rush") || notesLower.includes("quick")) {
      autoTags.push("Rush");
    }

    // Merge manual and auto tags, ensuring no duplicates
    return Array.from(new Set([...manualTags, ...autoTags]));
  };

  // Advanced upgrade configurations for client readiness
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);
  const [localPrintingFormat, setLocalPrintingFormat] = useState<"80mm" | "58mm">((localStorage.getItem("printingFormat") as "80mm" | "58mm") || "80mm");
  const printingFormat = propPrintingFormat || localPrintingFormat;
  const setPrintingFormat = (fmt: "80mm" | "58mm") => {
    if (propSetPrintingFormat) {
      propSetPrintingFormat(fmt);
    } else {
      setLocalPrintingFormat(fmt);
      localStorage.setItem("printingFormat", fmt);
    }
  };
  const [printingIncludeAddr, setPrintingIncludeAddr] = useState<boolean>(true);
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);
  const [cancelReasonPreset, setCancelReasonPreset] = useState<string>("Out of ingredients / Items unavailable");
  const [customCancelExplanation, setCustomCancelExplanation] = useState<string>("Kitchen is temporarily out of ingredients.");

  const currentShopId = currentShop?.id;
  const currentShopPhone = currentShop?.phone;

  useEffect(() => {
    if (currentShopId) {
      const fetchRiders = async () => {
        const shopId = currentShopId;
        const numericShopId = typeof shopId === "number" ? shopId : (parseInt(String(shopId).replace(/\D/g, ""), 10) || shopId);
        let conns: RiderConnection[] | null = null;
        let connErr: { message?: string } | null = null;

        try {
          console.log(`[App.tsx useEffect] Querying rider_connections for shop_id:`, shopId, `(type: ${typeof shopId})`, `| numericShopId:`, numericShopId);
          const res = await supabase
            .from("rider_connections")
            .select("*")
            .eq("shop_id", shopId);
          conns = (res.data as unknown as RiderConnection[]) || null;
          connErr = res.error as { message?: string } | null;

          if ((connErr || !conns || conns.length === 0) && numericShopId !== shopId) {
            console.log(`[App.tsx useEffect] Retrying query with numericShopId:`, numericShopId);
            const retryRes = await supabase
              .from("rider_connections")
              .select("*")
              .eq("shop_id", numericShopId);
            if (!retryRes.error && retryRes.data && (retryRes.data as unknown as RiderConnection[]).length > 0) {
              conns = retryRes.data as unknown as RiderConnection[];
              connErr = null;
            }
          }

          console.log(`[App.tsx useEffect] rider_connections query outcome:`, { shop_id: shopId, numericShopId, count: conns?.length || 0, conns, connErr });
        } catch (e) {
          connErr = e;
        }

        const blacklistKey = `localeats_deleted_conns_${currentShopId}`;
        let deletedSet = new Set<string>();
        try {
          const storedDel = localStorage.getItem(blacklistKey);
          if (storedDel) {
            const parsedDel = JSON.parse(storedDel);
            if (Array.isArray(parsedDel)) deletedSet = new Set(parsedDel);
          }
        } catch {
          // ignore
        }

        let finalConns: RiderConnection[] = (conns || []).filter(
          (c) =>
            !deletedSet.has(c.id) &&
            !deletedSet.has(c.connection_code) &&
            !(c.rider_id && deletedSet.has(c.rider_id))
        );

        if (connErr || !conns || conns.length === 0 || finalConns.length === 0) {
          if (connErr) {
            console.warn("Notice fetching rider connections (using local cache/fallback):", connErr.message || connErr);
          }
          try {
            const cached = localStorage.getItem(`localeats_rider_conns_${currentShopId}`);
            if (cached) {
              const parsed = JSON.parse(cached);
              if (Array.isArray(parsed) && parsed.length > 0) {
                finalConns = parsed.filter(
                  (c) =>
                    !deletedSet.has(c.id) &&
                    !deletedSet.has(c.connection_code) &&
                    !(c.rider_id && deletedSet.has(c.rider_id))
                );
              }
            }
          } catch {
            // ignore
          }

          if (finalConns.length === 0) {
            finalConns = [
              {
                id: `in_house_${currentShopId}`,
                shop_id: currentShopId,
                rider_id: null,
                connection_code: "IN-HOUSE",
                status: "active",
                created_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                rider_name: "In-House Express Fleet",
                rider_phone: currentShopPhone || "+27 82 000 0000",
              } as RiderConnection,
            ];
          }
        } else {
          try {
            localStorage.setItem(`localeats_rider_conns_${currentShopId}`, JSON.stringify(conns));
          } catch {
            // ignore
          }
        }

        const riderIds = finalConns.map((c) => c.rider_id).filter(Boolean) as string[];

        const profiles: Record<string, RiderProfile> = {};
        if (riderIds.length > 0) {
          try {
            const { data: profData, error: profErr } = await supabase
              .from("rider_profiles")
              .select("id, is_online, full_name, phone, status, vehicle_type, rating, current_latitude, current_longitude")
              .in("id", riderIds);

            if (!profErr && profData && Array.isArray(profData)) {
              (profData as unknown as RiderProfile[]).forEach((p) => {
                profiles[p.id] = p;
              });
            }
          } catch {
            // ignore
          }
        }

        const now = new Date();
        const processed: RiderConnection[] = finalConns.map((conn) => {
          const profile = conn.rider_id ? profiles[conn.rider_id] : null;
          const isInHouse = conn.connection_code === "IN-HOUSE";
          const isBound = Boolean(conn.rider_id);
          const isExpired = !isBound && !isInHouse && conn.expires_at && new Date(conn.expires_at) < now;
          return {
            ...conn,
            is_online: profile?.is_online || (isInHouse ? true : (isBound ? (conn.is_online ?? true) : false)),
            rider_name: profile?.full_name || conn.rider_name || "In-House Express Fleet",
            rider_phone: profile?.phone || conn.rider_phone || currentShopPhone || "+27 82 000 0000",
            status: (profile?.status === "online" ? "active" : profile?.status || (isExpired ? "expired" : isInHouse ? "active" : conn.status || "active")) as RiderConnection["status"],
            vehicle_type: profile?.vehicle_type || "Road",
            rating: profile?.rating || 5.0,
            current_latitude: profile?.current_latitude,
            current_longitude: profile?.current_longitude,
          };
        });
        const activeConnections = processed.filter((r) => r.rider_id !== null || r.connection_code === "IN-HOUSE");
        setConnectedRiders(activeConnections);
      };
      void fetchRiders();
      let activeChannel: RealtimeChannel | null = null;
      let isMounted = true;
      void subscribeWithAuthGuard("riders-sync", (ch) =>
        ch.on(
          "postgres_changes",
          { 
            event: "*", 
            schema: "public", 
            table: "rider_connections",
            filter: `shop_id=eq.${currentShopId}`
          },
          () => void fetchRiders(),
        )
      ).then(ch => {
        if (ch) {
          if (isMounted) activeChannel = ch;
          else void supabase.removeChannel(ch);
        }
      });

      return () => {
        isMounted = false;
        if (activeChannel) void supabase.removeChannel(activeChannel);
      };
    }
  }, [currentShopId, currentShopPhone, subscribeWithAuthGuard]);
  const [customMessage, setCustomMessage] = useState(
    "We have received your order and are starting to prepare it!",
  );
  const [estimatedTime, setEstimatedTime] = useState("20-30 mins");

  const avgPrepTime = useMemo(() => {
    const pendingCount = orders.filter(
      (o) => o.status === "pending" || o.status === "preparing",
    ).length;
    // Base 12 mins + 1.5 mins per pending order, capped at 45
    return Number(Math.min(12 + pendingCount * 1.5, 45)).toFixed(1);
  }, [orders]);

  const submitRiderRating = async (orderId: string, riderId: string, rating: number) => {
    if(!rating) return;
    try {
      const existingOverrides = JSON.parse(localStorage.getItem("localeats_order_overrides") || "{}");
      existingOverrides[orderId] = { ...existingOverrides[orderId], merchant_rating: rating, updated_at: new Date().toISOString() };
      localStorage.setItem("localeats_order_overrides", JSON.stringify(existingOverrides));
    } catch {
      // ignore
    }
    const { error } = await supabase.from('orders').update({ merchant_rating: rating }).eq('id', orderId);
    if (error) {
      console.warn("Rating update warning (saved locally):", error);
    }
    toast.success("Rider rated successfully!");
    onRefresh();

    // Calculate new average rating
    try {
      const { data: ratingsData } = await supabase
        .from('orders')
        .select('merchant_rating')
        .eq('rider_id', riderId)
        .not('merchant_rating', 'is', null);

      const items = (ratingsData as unknown as { merchant_rating: number }[]) || [];
      if (Array.isArray(items) && items.length > 0) {
        const avgRating = items.reduce((acc, curr) => acc + (curr.merchant_rating || 0), 0) / items.length;
        await supabase.from('rider_profiles').update({ rating: avgRating }).eq('id', riderId);
      }
    } catch {
      // ignore
    }
    setRatingOrderId(null);
    setRatingValue(0);
  };

  const handleIframePrint = (order: Order, formatOption: "80mm" | "58mm", includeAddress: boolean) => {
    toast.info("Receipt Printing Requested");
    try {
      const iframe = document.createElement("iframe");
      iframe.style.position = "absolute";
      iframe.style.width = "0px";
      iframe.style.height = "0px";
      iframe.style.border = "none";
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (!doc) {
        toast.error("Interactive printing is not available in full sandbox. Copying receipt text instead!");
        copyReceiptToClipboard(order);
        return;
      }

      const formattedItems = safeGetOrderItems(order.items)
        .map((i) => {
          const isObj = typeof i === "object" && i !== null;
          const p = isObj && "price" in i ? (i as { price: number }).price : (Number(order.total_price) || 0);
          const q = isObj && "quantity" in i ? (i as { quantity: number }).quantity : 1;
          const n = isObj && "name" in i ? (i as { name: string }).name : String(i);
          return `
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span>${q}x ${n}</span>
              <span>R${Number(p * q).toFixed(2)}</span>
            </div>
          `;
        })
        .join("") ||
        `<div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>1x ${order.product_name}</span><span>R${Number(order.total_price || 0).toFixed(2)}</span></div>`;

      const widthOfText = formatOption === "58mm" ? "54mm" : "76mm";
      const printingPageSize = formatOption === "58mm" ? "58mm auto" : "80mm auto";

      doc.write(`
        <html>
          <head>
            <title>Receipt #LE-${order.id}</title>
            <style>
              @page {
                size: ${printingPageSize};
                margin: 0;
              }
              body {
                font-family: 'Courier New', Courier, monospace;
                width: ${widthOfText};
                padding: 4mm;
                font-size: 12px;
                line-height: 1.4;
                color: #000;
                background: #fff;
                margin: 0 auto;
              }
              .header { 
                text-align: center; 
                border-bottom: 1px dashed #000; 
                padding-bottom: 6px; 
                margin-bottom: 8px; 
              }
              .items {
                margin: 8px 0;
              }
              .total { 
                border-top: 1px dashed #000; 
                border-bottom: 1px dashed #000;
                padding: 6px 0; 
                margin-top: 8px; 
                font-weight: bold; 
                font-size: 13px; 
              }
              .footer { 
                text-align: center; 
                margin-top: 12px; 
                font-size: 11px; 
                padding-top: 6px; 
              }
              @media print {
                body { 
                  width: ${widthOfText}; 
                  padding: 2mm; 
                  margin: 0; 
                }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h3 style="margin: 0 0 4px 0; text-transform: uppercase; font-size: 16px; letter-spacing: 1px;">LOCALEATS</h3>
              <p style="margin: 2px 0; font-size: 11px;">EATS WITH LOCAL ROOTS</p>
              <p style="margin: 4px 0 2px 0;">Order ID: #LE-${order.id}</p>
              <p style="margin: 2px 0;">${new Date(order.created_at).toLocaleString()}</p>
              <p style="margin: 2px 0; font-weight: bold; text-transform: uppercase;">Fulfillment: ${!isOrderDelivery(order) ? "COLLECTION" : "DELIVERY"}</p>
            </div>
            <div class="items">
              ${formattedItems}
            </div>
            <div class="total">
              <div style="display: flex; justify-content: space-between;">
                <span>GRAND TOTAL</span>
                <span>R${Number(order.total_price || 0).toFixed(2)}</span>
              </div>
            </div>
            <div class="footer">
              <p style="margin: 2px 0; font-weight: bold;">Customer: ${order.customer_name || "Guest"}</p>
              ${order.phone ? `<p style="margin: 2px 0;">Phone: ${order.phone}</p>` : ""}
              ${includeAddress && order.address ? `<p style="margin: 3px 0; font-style: italic;">Addr: ${order.address}, ${order.city}</p>` : ""}
              ${order.notes ? `<p style="margin: 5px 0; font-style: italic; background: #f2f2f2; padding: 6px; border-radius: 4px;">Notes: "${order.notes}"</p>` : ""}
              <p style="margin: 12px 0 0 0; font-weight: bold; font-size: 12px;">THANK YOU FOR SUPPORTING LOCAL!</p>
            </div>
          </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (printErr) {
          console.error("Direct printing failed inside sandbox iframe: ", printErr);
        }
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1200);
      }, 150);
    } catch (e) {
      console.error(e);
      toast.error("Printing failed. Copying receipt to clipboard instead.");
      copyReceiptToClipboard(order);
    }
  };

  const handleBulkPrint = (ordersToPrint: Order[], formatOption: "80mm" | "58mm", includeAddress: boolean) => {
    try {
      const iframe = document.createElement("iframe");
      iframe.style.position = "absolute";
      iframe.style.width = "0px";
      iframe.style.height = "0px";
      iframe.style.border = "none";
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (!doc) {
        toast.error("Interactive printing is not available in full sandbox.");
        return;
      }

      const widthOfText = formatOption === "58mm" ? "54mm" : "76mm";
      const printingPageSize = formatOption === "58mm" ? "58mm auto" : "80mm auto";

      const allReceiptsHTML = ordersToPrint.map((order) => {
        const formattedItems = safeGetOrderItems(order.items)
          .map((i) => {
            const isObj = typeof i === "object" && i !== null;
            const p = isObj && "price" in i ? (i as { price: number }).price : (Number(order.total_price) || 0);
            const q = isObj && "quantity" in i ? (i as { quantity: number }).quantity : 1;
            const n = isObj && "name" in i ? (i as { name: string }).name : String(i);
            return `
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span>${q}x ${n}</span>
                <span>R${Number(p * q).toFixed(2)}</span>
              </div>
            `;
          })
          .join("") ||
          `<div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>1x ${order.product_name}</span><span>R${Number(order.total_price || 0).toFixed(2)}</span></div>`;

        return `
          <div class="receipt">
            <div class="header">
              <h3 style="margin: 0 0 4px 0; text-transform: uppercase; font-size: 16px; letter-spacing: 1px;">LOCALEATS</h3>
              <p style="margin: 2px 0; font-size: 11px;">EATS WITH LOCAL ROOTS</p>
              <p style="margin: 4px 0 2px 0;">Order ID: #LE-${order.id}</p>
              <p style="margin: 2px 0;">${new Date(order.created_at).toLocaleString()}</p>
              <p style="margin: 2px 0; font-weight: bold; text-transform: uppercase;">Fulfillment: ${!isOrderDelivery(order) ? "COLLECTION" : "DELIVERY"}</p>
            </div>

            <div class="items">
              ${formattedItems}
            </div>

            <div class="total">
              <div style="display: flex; justify-content: space-between;">
                <span>GRAND TOTAL</span>
                <span>R${Number(order.total_price || 0).toFixed(2)}</span>
              </div>
            </div>

            <div class="footer">
              <p style="margin: 2px 0; font-weight: bold;">Customer: ${order.customer_name || "Guest"}</p>
              ${order.phone ? `<p style="margin: 2px 0;">Phone: ${order.phone}</p>` : ""}
              ${includeAddress && order.address ? `<p style="margin: 3px 0; font-style: italic;">Addr: ${order.address}, ${order.city}</p>` : ""}
              ${order.notes ? `<p style="margin: 5px 0; font-style: italic; background: #f2f2f2; padding: 6px; border-radius: 4px;">Notes: "${order.notes}"</p>` : ""}
              <p style="margin: 12px 0 0 0; font-weight: bold; font-size: 12px;">THANK YOU FOR SUPPORTING LOCAL!</p>
            </div>
          </div>
        `;
      }).join('<div class="page-break"></div>');

      doc.write(`
        <html>
          <head>
            <title>Batch Print (${ordersToPrint.length} Orders)</title>
            <style>
              @page {
                size: ${printingPageSize};
                margin: 0;
              }
              body {
                font-family: 'Courier New', Courier, monospace;
                width: ${widthOfText};
                padding: 4mm;
                font-size: 12px;
                line-height: 1.4;
                color: #000;
                background: #fff;
                margin: 0 auto;
              }
              .receipt {
                margin-bottom: 24px;
              }
              .header { 
                text-align: center; 
                border-bottom: 1px dashed #000; 
                padding-bottom: 6px; 
                margin-bottom: 8px; 
              }
              .items {
                margin: 8px 0;
              }
              .total { 
                border-top: 1px dashed #000; 
                border-bottom: 1px dashed #000;
                padding: 6px 0; 
                margin-top: 8px; 
                font-weight: bold; 
                font-size: 13px; 
              }
              .footer { 
                text-align: center; 
                margin-top: 12px; 
                font-size: 11px; 
                padding-top: 6px; 
              }
              .page-break {
                page-break-after: always;
                border-bottom: 2px dotted #000;
                margin: 24px 0;
              }
              @media print {
                body { 
                  width: ${widthOfText}; 
                  padding: 2mm; 
                  margin: 0; 
                }
              }
            </style>
          </head>
          <body>
            ${allReceiptsHTML}
          </body>
        </html>
      `);

      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (printErr) {
          console.error("Direct batch printing failed inside sandbox iframe: ", printErr);
        }
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1200);
      }, 150);

    } catch (e) {
      console.error(e);
      toast.error("An error occurred trying to batch print.");
    }
  };

  const copyReceiptToClipboard = (order: Order) => {
    const itemsText = safeGetOrderItems(order.items)
      .map((i) => {
        const isObj = typeof i === "object" && i !== null;
        const p = isObj && "price" in i ? (i as { price: number }).price : (Number(order.total_price) || 0);
        const q = isObj && "quantity" in i ? (i as { quantity: number }).quantity : 1;
        const n = isObj && "name" in i ? (i as { name: string }).name : String(i);
        return `${q}x ${n.padEnd(22)} R${(p * q).toFixed(2)}`;
      })
      .join("") || `1x ${order.product_name.padEnd(22)} R${(Number(order.total_price) || 0).toFixed(2)}`;

    const textReceipt = `
========================================
           LOCALEATS ORDER
Order ID: #LE-${order.id}
Date: ${new Date(order.created_at).toLocaleString()}
Type: ${!isOrderDelivery(order) ? "COLLECTION" : "DELIVERY"}
----------------------------------------
${itemsText}
----------------------------------------
TOTAL: R${Number(order.total_price || 0).toFixed(2)}
========================================
Customer: ${order.customer_name || "Guest"}
Phone: ${order.phone || "N/A"}
Address: ${order.address || ""}, ${order.city || ""}
Notes: "${order.notes || "None"}"
========================================
    `.trim();

    navigator.clipboard.writeText(textReceipt)
      .then(() => toast.success("Receipt copied as plain-text! Ready to send on WhatsApp."))
      .catch(() => toast.error("Failed to copy receipt to clipboard"));
  };

  const calculateDynamicETA = (order: Order) => {
    if (!order.rider_id || !order.lat || !order.lng || order.delivery_status === "delivered") {
       return order.estimated_delivery_time || "20-30 mins";
    }

    const assignedRider = connectedRiders.find((r) => r.rider_id === order.rider_id) as RiderConnection & { current_latitude?: number, current_longitude?: number };
    if (!assignedRider || !assignedRider.current_latitude || !assignedRider.current_longitude) {
       return order.estimated_delivery_time || "20-30 mins";
    }

    const R = 6371;
    const dLat = (order.lat - assignedRider.current_latitude) * Math.PI / 180;
    const dLon = (order.lng - assignedRider.current_longitude) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(assignedRider.current_latitude * Math.PI / 180) * Math.cos(order.lat * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const d = R * c;

    const timeMinutes = Math.max(5, Math.round(d * 4)); // 15km/h avg

    if (order.delivery_status === "finding_rider" || order.delivery_status === "accepted") {
        return `${Math.round(timeMinutes + Number(avgPrepTime))} mins`;
    }

    return `${timeMinutes} mins`;
  };

  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [expandedNotesOrderIds, setExpandedNotesOrderIds] = useState<Record<string, boolean>>({});
  const [kitchenNotes, setKitchenNotes] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem("le_kitchen_notes");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem("le_kitchen_notes", JSON.stringify(kitchenNotes));
  }, [kitchenNotes]);

  const getPastDateStr = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split("T")[0];
  };

  const [recentlyChangedOrders, setRecentlyChangedOrders] = useState<
    Record<string, boolean>
  >({});
  const prevOrdersRef = useRef<Order[]>([]);
  const [maxConcurrentOrders, setMaxConcurrentOrders] = useState(() => {
    return Number(localStorage.getItem("maxConcurrentOrders")) || 10;
  });

  useEffect(() => {
    if (prevOrdersRef.current.length > 0) {
      const changes: Record<string, boolean> = {};
      orders.forEach((order) => {
        const prevOrder = prevOrdersRef.current.find((o) => o.id === order.id);
        if (prevOrder && prevOrder.status !== order.status) {
          changes[order.id] = true;
          // Clear highlight after 5 seconds
          setTimeout(() => {
            setRecentlyChangedOrders((prev) => {
              const next = { ...prev };
              delete next[order.id];
              return next;
            });
          }, 5000);
        }
      });
      if (Object.keys(changes).length > 0) {
        setTimeout(() => {
          setRecentlyChangedOrders((prev) => ({ ...prev, ...changes }));
        }, 0);
      }
    }
    prevOrdersRef.current = orders;
  }, [orders]);

  useEffect(() => {
    localStorage.setItem("maxConcurrentOrders", maxConcurrentOrders.toString());
  }, [maxConcurrentOrders]);

  const activeCount = orders.filter(
    (o) => o.status !== "completed" && o.status !== "cancelled",
  ).length;
  const isLimitReached = activeCount >= maxConcurrentOrders;

  // Calculate customer loyalty
  const customerOrderCounts = orders.reduce(
    (acc: Record<string, number>, order) => {
      acc[order.user_id] = (acc[order.user_id] || 0) + 1;
      return acc;
    },
    {},
  );

  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [ordersPaused, setOrdersPaused] = useState(false);
  const [filterStatus, setFilterStatus] = useState<OrderStatus | "All">("All");
  const [orderTypeFilter, setOrderTypeFilter] = useState<"All" | "delivery" | "collection">("All");
  const [sortField, setSortField] = useState<
    "id" | "total_price" | "created_at"
  >("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const [ordersPage, setOrdersPage] = useState(1);
  const ordersPerPage = 12;

  const filterKey = `${searchTerm}_${customerSearch}_${phoneSearch}_${filterStatus}_${orderTypeFilter}_${startDate}_${endDate}_${viewMode}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey);
    setOrdersPage(1);
  }

  const displayedOrders = useMemo(() => {
    const activeOrders = orders.filter(
      (o) => o.status !== "completed" && o.status !== "cancelled",
    );
    const historyOrders = orders.filter(
      (o) => o.status === "completed" || o.status === "cancelled",
    );
    const baseOrders = viewMode === "active" ? activeOrders : historyOrders;

    const filtered = baseOrders.filter((o) => {
      const matchesSearch =
        o.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.id.toString().includes(searchTerm);
      const matchesCustomer =
        !customerSearch ||
        o.customer_name?.toLowerCase().includes(customerSearch.toLowerCase());
      const matchesPhone = !phoneSearch || o.phone?.includes(phoneSearch);
      const matchesFilter = filterStatus === "All" || o.status === filterStatus;
      const matchesOrderType = orderTypeFilter === "All" || o.order_type === orderTypeFilter;

      let matchesDate = true;
      // Active orders in the operational kitchen queue should not be hidden by historical date filters
      if (viewMode === "history") {
        const dateToCheck = o.completed_at || o.created_at;
        if (dateToCheck) {
          const d = new Date(dateToCheck);
          if (!isNaN(d.getTime())) {
            if (startDate) {
              const s = new Date(startDate + "T00:00:00");
              if (!isNaN(s.getTime()) && d < s) matchesDate = false;
            }
            if (endDate) {
              const e = new Date(endDate + "T23:59:59.999");
              if (!isNaN(e.getTime()) && d > e) matchesDate = false;
            }
          }
        }
      }

      return (
        matchesSearch &&
        matchesCustomer &&
        matchesPhone &&
        matchesFilter &&
        matchesOrderType &&
        matchesDate
      );
    });

    return filtered.sort((a, b) => {
      let comparison = 0;
      if (sortField === "id") {
        comparison = a.id.localeCompare(b.id);
      } else if (sortField === "total_price") {
        comparison = Number(a.total_price) - Number(b.total_price);
      } else if (sortField === "created_at") {
        comparison =
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [
    orders,
    viewMode,
    searchTerm,
    customerSearch,
    phoneSearch,
    filterStatus,
    orderTypeFilter,
    startDate,
    endDate,
    sortField,
    sortDirection,
  ]);

  const prioritizedPendingOrders = useMemo(() => {
    const pending = displayedOrders.filter((o) => o.status === "pending");
    if (!pendingOrderPriorityIds || pendingOrderPriorityIds.length === 0) {
      return pending;
    }

    return [...pending].sort((a, b) => {
      const indexA = pendingOrderPriorityIds.indexOf(a.id);
      const indexB = pendingOrderPriorityIds.indexOf(b.id);

      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;

      return 0;
    });
  }, [displayedOrders, pendingOrderPriorityIds]);

  const fulfilledOrdersToday = useMemo(() => {
    const now = new Date();
    return orders.filter((o) => {
      const isFulfilled = o.status === "completed" || o.status === "cancelled";
      let isToday = false;
      if (o.created_at) {
        const d = new Date(o.created_at);
        if (!isNaN(d.getTime())) {
          isToday =
            d.getFullYear() === now.getFullYear() &&
            d.getMonth() === now.getMonth() &&
            d.getDate() === now.getDate();
        }
      }

      const matchesSearch =
        o.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.id.toString().includes(searchTerm);
      const matchesCustomer =
        !customerSearch ||
        o.customer_name?.toLowerCase().includes(customerSearch.toLowerCase());
      const matchesPhone = !phoneSearch || o.phone?.includes(phoneSearch);

      return isFulfilled && isToday && matchesSearch && matchesCustomer && matchesPhone;
    });
  }, [orders, searchTerm, customerSearch, phoneSearch]);

  const startOrderIdx = (ordersPage - 1) * ordersPerPage;
  const paginatedOrders = useMemo(() => {
    return displayedOrders.slice(startOrderIdx, startOrderIdx + ordersPerPage);
  }, [displayedOrders, startOrderIdx, ordersPerPage]);

  const totalOrdersPages = Math.ceil(displayedOrders.length / ordersPerPage);

  const handleSort = (field: "id" | "total_price" | "created_at") => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const exportToCSV = () => {
    const headers = [
      "Order ID",
      "Product Name",
      "Total Price",
      "Status",
      "Date",
      "Customer",
      "Address",
    ];
    const csvContent = [
      headers.join(","),
      ...displayedOrders.map((o) =>
        [
          o.id,
          `"${o.product_name.replace(/"/g, '""')}"`,
          o.total_price,
          o.status,
          format(new Date(o.created_at), "yyyy-MM-dd HH:mm:ss"),
          `"${o.customer_name.replace(/"/g, '""')}"`,
          `"${o.address.replace(/"/g, '""')}, ${o.city.replace(/"/g, '""')}"`,
        ].join(","),
      ),
    ].join("");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `accounting_orders_export_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Orders exported as Spreadsheet for Accounting!");
  };

  const exportToJSON = () => {
    const jsonContent = JSON.stringify(orders, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `orders_backup_${format(new Date(), "yyyyMMdd_HHmmss")}.json`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Orders backup file downloaded!");
  };

  const orderStatuses: (OrderStatus | "All")[] = [
    "All",
    "pending",
    "preparing",
    "ready",
    "completed",
  ];

  const handleRiderAction = (rider: RiderConnection, orderId: string) => {
    const isExpired = !rider.rider_id && rider.connection_code !== "IN-HOUSE" && rider.expires_at && new Date(rider.expires_at) < new Date();

    if (isExpired) {
      toast.error(
        "Connection Expired. Please generate a new Link Code to re-pair.",
        {
          duration: 5000,
          position: "top-center",
        },
      );
      // Redirect logic
      onTabChange("riders");
      return;
    }

    if (!rider.is_online) {
      // Show "Wake to Tip" button UI or similar
      // Handled in the UI loop
      return;
    }

    onRequestRider(orderId, rider.rider_id!);
  };

  const renderOrderCard = (order: Order, i: number) => {

                  const orderCount = customerOrderCounts[order.user_id] || 0;
                  const isReturning = orderCount > 1;

                  // Timer Alert Logic: If order is pending/preparing for more than 20 mins
                  const orderTime = new Date(order.created_at).getTime();
                  const now = new Date().getTime();
                  const diffMins = Math.floor((now - orderTime) / (1000 * 60));
                  const isOverdue =
                    diffMins >= 20 &&
                    (order.status === "pending" || order.status === "preparing");
                    
                  // Rider Timeout Logic: Rider assigned but not picked up for 15+ mins
                  const assignedTime = new Date(order.updated_at || order.created_at).getTime();
                  const diffRiderMins = Math.floor((now - assignedTime) / (1000 * 60));
                  const isRiderTimeout = 
                    diffRiderMins >= 15 && 
                    order.rider_id && 
                    (order.delivery_status === "accepted" || order.delivery_status === "finding_rider");

                  const isSelected = selectedPendingOrders.includes(order.id);

                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: -20, transition: { duration: 0.2 } }}
                      transition={{ 
                        type: "spring", 
                        stiffness: 260, 
                        damping: 20,
                        delay: Math.min(i * 0.05, 0.5) 
                      }}
                      key={order.id}
                      className={cn(
                        "group rounded-2xl p-4 sm:p-5 shadow-sm border transition-all duration-300 cursor-pointer space-y-4 relative bg-surface-container-lowest",
                        isOverdue
                          ? "bg-error/5 border-error/30 ring-1 ring-error/20"
                          : order.status === "pending"
                            ? "bg-primary-light border-primary/20"
                            : order.status === "preparing"
                              ? "bg-primary/10 border-primary/10"
                              : order.status === "ready"
                                ? "bg-tertiary/10 border-tertiary/20"
                                : "bg-surface-container-highest border-transparent",
                        kitchenMode && "p-8 md:p-10 border-2",
                        expandedOrderId === order.id &&
                          "ring-2 ring-primary/20 border-primary/30 shadow-md",
                      )}
                      onClick={() =>
                        setExpandedOrderId(
                          expandedOrderId === order.id ? null : order.id,
                        )
                      }
                    >
                      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4">
                        <div className="relative flex items-start gap-3 w-full sm:w-auto">
                          {order.status === "pending" && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedPendingOrders(prev => [...prev, order.id]);
                                } else {
                                  setSelectedPendingOrders(prev => prev.filter(id => id !== order.id));
                                }
                              }}
                              className="mt-1.5 w-5 h-5 rounded border-outline-variant/30 text-primary focus:ring-primary/50 cursor-pointer shrink-0"
                            />
                          )}
                          <div>
                          {isOverdue && (
                            <div className="absolute -top-3 -left-3 bg-error text-white text-[9px] font-black px-2 py-0.5 rounded-full animate-bounce shadow-lg z-20">
                              OVERDUE ({diffMins}m)
                            </div>
                          )}
                          {recentlyChangedOrders[order.id] && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute -top-2 -left-2 w-4 h-4 bg-primary rounded-full border-2 border-white z-10"
                            />
                          )}
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span
                              className="px-3 py-1 bg-primary text-on-primary font-mono text-xs md:text-sm font-black uppercase tracking-wider rounded-xl shadow-xs inline-flex items-center gap-1"
                            >
                              #LE-{order.id.length > 8 ? order.id.slice(-6).toUpperCase() : order.id}
                            </span>
                            {isReturning && (
                              <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-[10px] font-extrabold px-2.5 py-1 rounded-xl flex items-center gap-1 border border-emerald-200/50">
                                <Star size={11} fill="currentColor" />
                                RETURNING ({orderCount})
                              </span>
                            )}
                            {isOrderDelivery(order) ? (
                              <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300 text-[10px] font-extrabold px-2.5 py-1 rounded-xl flex items-center gap-1 border border-indigo-200/50">
                                🛵 DELIVERY
                              </span>
                            ) : (
                              <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-[10px] font-extrabold px-2.5 py-1 rounded-xl flex items-center gap-1 border border-amber-200/50">
                                🛍️ COLLECTION
                              </span>
                            )}
                            <span className={cn(
                              "text-[10px] font-extrabold px-2.5 py-1 rounded-xl flex items-center gap-1 border",
                              (order.payment_method === "cod" || order.payment_method === "Cash" || order.payment_method === "cash_on_delivery")
                                ? "bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 border-rose-200/50"
                                : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border-emerald-200/50"
                            )}>
                              <CreditCard size={11} fill="currentColor" />
                              {(order.payment_method === "cod" || order.payment_method === "Cash" || order.payment_method === "cash_on_delivery") ? "CASH ON ARRIVAL" : "ONLINE PAID"}
                            </span>
                          </div>
                          <h4
                            className={cn(
                              "font-headline font-bold text-on-surface flex items-center gap-2",
                              kitchenMode ? "text-2xl" : "text-lg md:text-xl",
                            )}
                          >
                            {order.customer_name ||
                              `Customer #${order.user_id.slice(0, 5)}`}
                            {order.delivery_status === "picked_up" && (
                               <motion.span 
                                 initial={{ opacity: 0 }}
                                 animate={{ opacity: 1 }}
                                 className="bg-primary/10 text-primary text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest animate-pulse"
                               >
                                 Out for Delivery
                               </motion.span>
                            )}
                          </h4>
                          <div className="flex flex-col gap-2.5 mt-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <a
                                href={`tel:${order.phone}`}
                                className="flex items-center gap-2 text-xs text-primary font-bold hover:underline bg-primary/5 px-3 py-2 rounded-xl transition-colors border border-primary/10 min-h-[40px]"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Phone size={14} />
                                <span>{order.phone || "No phone"}</span>
                              </a>
                              {order.phone && (
                                <a
                                  href={`https://wa.me/${order.phone.replace(/\D/g, "")}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:bg-emerald-50 dark:hover:bg-emerald-950/30 px-3 py-2 rounded-xl transition-colors border border-emerald-200/60 min-h-[40px]"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MessageCircle size={14} />
                                  <span>WhatsApp</span>
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDispatchAlertOrder(order);
                                  setDispatchAlertType(order.rider_id ? "rider_dispatch" : "customer_status");
                                }}
                                className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300 font-extrabold bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-2 rounded-xl transition-colors border border-emerald-500/30 min-h-[40px] cursor-pointer"
                                title="Open SMS & WhatsApp Dispatch Studio"
                              >
                                <Send size={13} />
                                <span>Dispatch Alert</span>
                              </button>
                            </div>
                          <div className="flex flex-col gap-1 text-xs text-on-surface-variant">
                            <div className="flex items-center gap-2">
                              <MapPin size={12} className="text-primary/60" />
                              <AddressDisplay address={order.address} city={order.city} className="italic font-medium text-xs max-sm:text-xs" maxParts={2} />
                            </div>
                            {order.lat && order.lng && (
                              <div className="ml-5 text-[9px] text-primary/60 font-mono">
                                {order.lat.toFixed(5)}, {order.lng.toFixed(5)}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {order.estimated_delivery_time || calculateDynamicETA(order) ? (
                              <div className="flex items-center gap-2 text-xs text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded-lg">
                                <Timer size={12} />
                                <span>ETA: {calculateDynamicETA(order)}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-xs text-zinc-500 font-bold bg-zinc-50 px-2 py-1 rounded-lg">
                                <Timer size={12} />
                                <span>ETA: 20-30 mins</span>
                              </div>
                            )}
                            {order.status !== 'completed' && order.status !== 'cancelled' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newEta = prompt("Enter estimated delivery time (e.g. 20-30 mins):", order.estimated_delivery_time || "25 mins");
                                  if (newEta !== null) {
                                    onUpdateStatus(order.id, order.status, undefined, newEta);
                                  }
                                }}
                                className="p-1 text-primary hover:bg-primary/5 rounded shadow-sm"
                                title="Adjust ETA"
                              >
                                <Edit2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 mt-3 text-[10px] font-bold text-primary/60 uppercase tracking-wider">
                          {expandedOrderId === order.id
                            ? "Hide Details"
                            : "View Details"}
                          <motion.div
                            animate={{
                              rotate: expandedOrderId === order.id ? 90 : 0,
                            }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronRight size={12} />
                          </motion.div>
                        </div>
                        </div>
                      </div>
                      <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start w-full sm:w-auto mt-2 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-0 border-outline-variant/10">
                        <OrderStatusBadge status={order.status} />
                        <span className="text-[11px] font-semibold text-on-surface-variant mt-0 sm:mt-2 flex items-center gap-1">
                          <Clock size={14} />
                          {format(new Date(order.created_at), "HH:mm")}
                        </span>
                      </div>
                    </div>

                    <div className={cn("space-y-3", expandedOrderId === order.id ? "mb-6" : "mb-2")}>
                      <div
                        className={cn(
                          "flex justify-between items-center",
                          kitchenMode ? "text-xl" : "text-sm",
                        )}
                      >
                        <span className="text-on-surface-variant font-medium">
                          {order.product_name}
                        </span>
                        <span className="text-on-surface font-semibold">
                          R {Number(order.total_price || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <AnimatePresence>
                      {expandedOrderId === order.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden border-t border-outline-variant/10 pt-6 mb-8 space-y-6"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="space-y-3">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                              Order Items
                            </span>
                            <div className="bg-surface-container-low rounded-2xl overflow-x-auto border border-outline-variant/10">
                              <table className="w-full min-w-[300px] text-left text-sm">
                                <thead className="bg-surface-container-high text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                                  <tr>
                                    <th className="px-4 py-2">Item</th>
                                    <th className="px-4 py-2 text-center">
                                      Qty
                                    </th>
                                    <th className="px-4 py-2 text-right">
                                      Price
                                    </th>
                                    <th className="px-4 py-2 text-right">
                                      Total
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-outline-variant/10">
                                  {safeGetOrderItems(order.items).length > 0 ? (
                                    safeGetOrderItems(order.items).map((item, idx) => (
                                      <tr
                                        key={idx}
                                        className="hover:bg-surface-container-highest/30 transition-colors"
                                      >
                                        <td className="px-4 py-3 font-medium text-on-surface">
                                          {typeof item === "object" &&
                                          item !== null &&
                                          "name" in item
                                            ? ((item as unknown) as Record<string, unknown>).name as string
                                            : String(item)}
                                        </td>
                                        <td className="px-4 py-3 text-center text-on-surface-variant">
                                          {typeof item === "object" &&
                                          item !== null &&
                                          "quantity" in item
                                            ? ((item as unknown) as Record<string, unknown>).quantity as number
                                            : 1}
                                        </td>
                                        <td className="px-4 py-3 text-right text-on-surface-variant">
                                          R{" "}
                                          {Number(
                                            typeof item === "object" &&
                                              item !== null &&
                                              "price" in item
                                              ? ((item as unknown) as Record<string, unknown>).price as number
                                              : 0,
                                          ).toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-on-surface">
                                          R{" "}
                                          {(
                                            Number(
                                              typeof item === "object" &&
                                                item !== null &&
                                                "price" in item
                                                ? ((item as unknown) as Record<string, unknown>).price as number
                                                : 0,
                                            ) *
                                            Number(
                                              typeof item === "object" &&
                                                item !== null &&
                                                "quantity" in item
                                                ? ((item as unknown) as Record<string, unknown>).quantity as number
                                                : 1,
                                            )
                                          ).toFixed(2)}
                                        </td>
                                      </tr>
                                    ))
                                  ) : (
                                    <tr>
                                      <td className="px-4 py-3 font-medium text-on-surface">
                                        {order.product_name}
                                      </td>
                                      <td className="px-4 py-3 text-center text-on-surface-variant">
                                        1
                                      </td>
                                      <td className="px-4 py-3 text-right text-on-surface-variant">
                                        R{" "}
                                        {Number(order.total_price || 0).toFixed(
                                          2,
                                        )}
                                      </td>
                                      <td className="px-4 py-3 text-right font-bold text-on-surface">
                                        R{" "}
                                        {Number(order.total_price || 0).toFixed(
                                          2,
                                        )}
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                                <tfoot className="bg-surface-container-low border-t border-outline-variant/20">
                                  <tr>
                                    <td
                                      colSpan={3}
                                      className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60"
                                    >
                                      Grand Total
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-primary text-lg">
                                      R{" "}
                                      {Number(order.total_price || 0).toFixed(
                                        2,
                                      )}
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1 sm:col-span-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                                Fulfillment
                              </span>
                              <div className="inline-flex items-center px-2 py-1 rounded bg-secondary/10 text-secondary text-xs font-black uppercase tracking-widest">
                                {!isOrderDelivery(order)
                                  ? "Customer Collection"
                                  : "Delivery"}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                                Customer Name
                              </span>
                              <p className="text-sm font-semibold text-on-surface">
                                {order.customer_name || "Not provided"}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                                Phone Number
                              </span>
                              <p className="text-sm font-semibold text-on-surface">
                                {order.phone || "Not provided"}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                                Payment Method
                              </span>
                              <div className="flex flex-col gap-2">
                                <p className="text-sm font-semibold text-primary">
                                  {order.payment_method || "Cash on Delivery"}
                                </p>
                                {order.terminal_masked_card && (
                                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-600 rounded border border-emerald-500/20 max-w-max">
                                    <CreditCard size={14} />
                                    <span className="text-[10px] uppercase tracking-wider font-extrabold">💳 Sync'd Terminal Receipt - {order.terminal_masked_card}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                                Email Address
                              </span>
                              <p className="text-sm font-semibold text-on-surface">
                                {order.email || "Not provided"}
                              </p>
                            </div>
                            <div className="space-y-1 sm:col-span-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                                  Delivery Address
                                </span>
                                {order.lat && order.lng && (
                                  <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${order.lat},${order.lng}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                                  >
                                    <MapPin size={10} /> Open Map
                                  </a>
                                )}
                              </div>
                              <AddressDisplay address={order.address} city={order.city} className="text-sm font-semibold text-on-surface max-sm:text-xs" maxParts={3} />
                              {order.lat && order.lng && (
                                <p className="text-[10px] font-mono text-primary/70 mt-1 select-all bg-primary/5 p-1 rounded inline-block">
                                  GPS: {order.lat.toFixed(6)}, {order.lng.toFixed(6)}
                                </p>
                              )}
                            </div>
                            {order.accepted_at && (
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                                  Accepted At
                                </span>
                                <p className="text-sm font-semibold text-on-surface">
                                  {format(
                                    new Date(order.accepted_at),
                                    "HH:mm:ss",
                                  )}
                                </p>
                              </div>
                            )}
                            {(order.estimated_delivery_time || calculateDynamicETA(order)) && (
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                                  Est. Delivery
                                </span>
                                <p className="text-sm font-semibold text-primary">
                                  {calculateDynamicETA(order)}
                                </p>
                              </div>
                            )}
                            {order.notes && (
                              <div className="space-y-1 sm:col-span-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                                    Customer Order Notes
                                  </span>
                                  <button
                                    onClick={() => {
                                      setExpandedNotesOrderIds(prev => ({
                                        ...prev,
                                        [order.id]: !prev[order.id]
                                      }));
                                    }}
                                    className="flex items-center gap-1 text-[10px] text-primary hover:underline font-bold uppercase cursor-pointer"
                                  >
                                    {expandedNotesOrderIds[order.id] ? (
                                      <>
                                        <EyeOff size={12} />
                                        <span>Hide</span>
                                      </>
                                    ) : (
                                      <>
                                        <Eye size={12} />
                                        <span>View Notes ({order.notes.length > 15 ? `${order.notes.slice(0, 12)}...` : "Show"})</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                                <AnimatePresence>
                                  {expandedNotesOrderIds[order.id] && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      className="overflow-hidden mt-1.5"
                                    >
                                      <div className="p-3 bg-surface-container-low rounded-lg text-sm text-on-surface-variant italic">
                                        "{order.notes}"
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )}

                            {kitchenNotes[order.id] && (
                              <div className="space-y-1 sm:col-span-2 bg-amber-500/[0.04] border border-amber-500/25 p-3.5 rounded-xl">
                                <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                                  <UtensilsCrossed size={12} />
                                  Internal Kitchen Instruction
                                </span>
                                <p className="text-xs font-semibold text-on-surface mt-1 leading-relaxed">
                                  {kitchenNotes[order.id]}
                                </p>
                              </div>
                            )}

                            {isOrderDelivery(order) && (
                              <div className="space-y-4 sm:col-span-2 border-t border-outline-variant/10 pt-6 mt-2">
                                <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                  <Zap size={14} />
                                  Delivery Ecosystem
                                </span>
                                {order.delivery_status && (
                                  <span
                                    className={cn(
                                      "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter",
                                      order.delivery_status === "finding_rider"
                                        ? "bg-amber-100 text-amber-700 animate-pulse"
                                        : order.delivery_status === "picked_up"
                                          ? "bg-blue-100 text-blue-700"
                                          : "bg-emerald-100 text-emerald-700",
                                    )}
                                  >
                                    {order.delivery_status.replace("_", " ")}
                                  </span>
                                )}
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                <div className="bg-surface-container p-3 rounded-xl border border-outline-variant/5">
                                  <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1">
                                    Fee Collection
                                  </span>
                                  <p className="text-sm font-black text-on-surface">
                                    R{" "}
                                    {Number(order.delivery_fee || 0).toFixed(2)}
                                  </p>
                                </div>
                                <div className={cn("p-3 rounded-xl border transition-all", 
                                  isRiderTimeout ? "bg-red-50/50 dark:bg-red-900/10 border-red-500/30 animate-pulse" : "bg-surface-container border-outline-variant/5"
                                )}>
                                  <span className={cn("text-[9px] font-bold uppercase tracking-widest block mb-1",
                                    isRiderTimeout ? "text-red-500" : "text-on-surface-variant/50"
                                  )}>
                                    {isRiderTimeout ? "⚠️ RIDER TIMEOUT (15m+)" : "Rider Assignment"}
                                  </span>
                                  <div className="flex flex-col gap-2">
                                    <p className="text-xs font-mono text-on-surface-variant truncate">
                                      {order.rider_id
                                        ? order.rider_id.split("-")[0]
                                        : "Idle..."}
                                    </p>
                                    {order.rider_id &&
                                      order.delivery_status !== "delivered" && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onUnassignRider(order.id);
                                          }}
                                          className={cn("text-[10px] px-2 py-1.5 rounded font-bold w-full text-center transition-colors",
                                            isRiderTimeout ? "bg-red-500 text-white shadow hover:bg-red-600" : "bg-red-100 text-red-600 hover:bg-red-200"
                                          )}
                                        >
                                          {isRiderTimeout ? "Unassign & Re-broadcast" : "Remove Rider"}
                                        </button>
                                      )}
                                  </div>
                                </div>
                                <div className="bg-surface-container p-3 rounded-xl border border-outline-variant/5">
                                  <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1">
                                    Live Track
                                  </span>
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs font-bold text-on-surface-variant">
                                      {order.delivery_status
                                        ? "Active Protocol"
                                        : "No Signal"}
                                    </p>
                                    {order.delivery_pin && (
                                      <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-black tracking-widest border border-primary/20">
                                        PIN: {order.delivery_pin}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {order.delivery_status && (
                                <div className="mt-4 space-y-2" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                                      Update Delivery Status
                                    </span>
                                  </div>
                                  <div className="flex gap-2 text-xs">
                                    {["finding_rider", "picked_up", "delivered"].map(status => (
                                      <button
                                        key={status}
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          try {
                                            const existingOverrides = JSON.parse(localStorage.getItem("localeats_order_overrides") || "{}");
                                            existingOverrides[order.id] = { ...existingOverrides[order.id], delivery_status: status, updated_at: new Date().toISOString() };
                                            localStorage.setItem("localeats_order_overrides", JSON.stringify(existingOverrides));
                                          } catch {
                                            // ignore
                                          }
                                          const { error } = await supabase.from("orders").update({ delivery_status: status }).eq("id", order.id);
                                          if (error) {
                                            console.warn("Delivery status database sync warning (saved locally):", error);
                                          }
                                          toast.success(`Delivery status: ${status.replace("_", " ")}`);
                                        }}
                                        className={cn(
                                          "px-3 py-1.5 rounded-lg font-bold border transition-colors flex-1 capitalize",
                                          order.delivery_status === status ? "bg-primary text-white border-primary shadow-sm shadow-primary/20" : "bg-surface-container hover:bg-surface-container-high border-outline-variant/10 text-on-surface-variant"
                                        )}
                                      >
                                        {status.replace("_", " ")}
                                      </button>
                                    ))}
                                  </div>

                                  {order.delivery_status === "picked_up" && (
                                    <div className="w-full h-32 bg-stone-100 dark:bg-stone-900 rounded-xl overflow-hidden relative border border-outline-variant/10 mt-4 flex items-center justify-center">
                                       <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>

                                       {/* Mock Map Route */}
                                       <div className="absolute top-1/2 left-1/4 right-1/4 h-1 border-t-2 border-dashed border-primary/40 -translate-y-1/2"></div>

                                       <div className="absolute left-1/4 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-full p-1 shadow-md z-10">
                                         <Store size={14} className="text-secondary" />
                                       </div>
                                       <div className="absolute right-1/4 top-1/2 translate-x-1/2 -translate-y-1/2 bg-white rounded-full p-1 shadow-md z-10">
                                          <MapPin size={14} className="text-primary" />
                                       </div>

                                       {/* Moving Rider */}
                                       <motion.div 
                                         animate={{ x: ["0%", "100%", "0%"] }}
                                         transition={{ repeat: Infinity, duration: 15, ease: "linear" }}
                                         className="absolute left-1/4 right-1/4 top-1/2 -translate-y-1/2 z-20 flex items-center justify-start pointer-events-none"
                                       >
                                         <div className="relative -ml-4 -mt-6">
                                            <div className="bg-primary text-white rounded-full p-2 shadow-lg drop-shadow-md border-2 border-white">
                                              <Bike size={16} />
                                            </div>
                                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
                                               <span className="text-[9px] font-black uppercase text-primary tracking-widest bg-white/95 px-2 py-0.5 rounded shadow-sm border border-primary/10">
                                                 Live ETA: 3 min
                                               </span>
                                            </div>
                                         </div>
                                       </motion.div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {!isOrderDelivery(order) && (
                                <div className="space-y-4 sm:col-span-2 border-t border-outline-variant/10 pt-6 mt-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                      <ShoppingBag size={14} />
                                      Fulfillment Status
                                    </span>
                                    <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter bg-blue-100 text-blue-700">
                                      {order.order_type === "pickup" ? "Counter Pickup" : "Collection"}
                                    </span>
                                  </div>
                                  <div className="bg-surface-container p-4 rounded-xl border border-outline-variant/5">
                                    <p className="text-xs font-semibold text-on-surface-variant">
                                      This order has been selected for <strong className="text-primary">{order.order_type === "pickup" ? "Counter Pickup" : "Collection"}</strong>.
                                    </p>
                                    <p className="text-[10px] text-on-surface-variant/70 mt-1">
                                      No rider assignment is required. The customer will pick up this order directly from your store.
                                    </p>
                                  </div>
                                </div>
                              )}

                              {isOrderDelivery(order) && !order.delivery_status &&
                                order.status !== "completed" && (
                                  <div className="space-y-2">
                                    {showRiderPicker === order.id ? (
                                      <div className="bg-surface-container p-4 rounded-xl border-2 border-primary/20 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <div className="flex items-center justify-between">
                                          <span className="text-[10px] font-black uppercase text-primary tracking-widest">
                                            Select Rider to Tag
                                          </span>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setShowRiderPicker(null);
                                            }}
                                            className="text-on-surface-variant/40 hover:text-on-surface"
                                          >
                                            <X size={14} />
                                          </button>
                                        </div>
                                        <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-1">
                                          {connectedRiders.map((rider) => {
                                            const isExpired =
                                              !rider.rider_id && rider.connection_code !== "IN-HOUSE" && new Date(rider.expires_at) < new Date();
                                            const isOffline =
                                              !rider.is_online && !isExpired;

                                            return (
                                              <div
                                                key={rider.id}
                                                className={cn(
                                                  "flex items-center justify-between p-3 bg-surface-container-high rounded-xl transition-all border border-outline-variant/10 group text-left",
                                                  isExpired &&
                                                    "opacity-50 grayscale",
                                                  !isExpired &&
                                                    "hover:bg-primary/10",
                                                )}
                                              >
                                                <div className="flex items-center gap-3">
                                                  <div
                                                    className={cn(
                                                      "w-8 h-8 rounded-lg flex items-center justify-center",
                                                      isExpired
                                                        ? "bg-on-surface/5 text-on-surface-variant"
                                                        : "bg-primary/10 text-primary",
                                                    )}
                                                  >
                                                    <Bike size={16} />
                                                  </div>
                                                  <div>
                                                    <div className="flex items-center gap-2">
                                                      <p className="text-xs font-bold text-on-surface">
                                                        {rider.rider_name || "Quick Rider"}
                                                      </p>
                                                      {!isExpired && (
                                                        <div
                                                          className={cn(
                                                            "w-1.5 h-1.5 rounded-full",
                                                            rider.is_online 
                                                              ? (rider.status === 'paused' ? "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]" : "bg-green-500 animate-pulse shadow-[0_0_6px_rgba(34,197,94,0.5)]")
                                                              : "bg-zinc-300",
                                                          )}
                                                        />
                                                      )}
                                                      {isOffline && (
                                                        <span className="text-[8px] px-1.5 py-0.5 bg-on-surface/10 text-on-surface-variant rounded-full font-black uppercase">
                                                          OFFLINE
                                                        </span>
                                                      )}
                                                      {!isExpired && rider.is_online && rider.status === 'paused' && (
                                                        <span className="text-[8px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-black uppercase">
                                                          PAUSED
                                                        </span>
                                                      )}
                                                    </div>
                                                    <p className="text-[9px] text-on-surface-variant/60 font-mono">
                                                      {isExpired
                                                        ? "EXPIRED"
                                                        : rider.connection_code}
                                                    </p>
                                                  </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                  {isExpired ? (
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleRiderAction(
                                                          rider,
                                                          order.id,
                                                        );
                                                      }}
                                                      className="px-2 py-1 bg-error/10 text-error text-[9px] font-black rounded-lg uppercase hover:bg-error/20"
                                                    >
                                                      Repair
                                                    </button>
                                                  ) : isOffline ? (
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        sendRiderNudge(
                                                          rider.rider_id!,
                                                          "Urgent order available - Tip boost active!",
                                                        );
                                                      }}
                                                      className="flex items-center gap-1 px-2 py-1 bg-amber-500 text-white text-[9px] font-black rounded-lg uppercase hover:scale-105 transition-transform"
                                                    >
                                                      <Zap size={10} />
                                                      Wake to Tip
                                                    </button>
                                                  ) : (
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (rider.connection_code === "IN-HOUSE") {
                                                          onRequestRider(
                                                            order.id,
                                                            undefined,
                                                            rider.rider_name || "In-House Driver",
                                                            rider.rider_phone || ""
                                                          );
                                                        } else {
                                                          onRequestRider(
                                                            order.id,
                                                            rider.rider_id || undefined,
                                                            rider.rider_name || undefined,
                                                            rider.rider_phone || undefined
                                                          );
                                                        }
                                                        setShowRiderPicker(
                                                          null,
                                                        );
                                                      }}
                                                      className="p-2 text-primary hover:bg-primary/20 rounded-lg transition-all"
                                                    >
                                                      <ArrowRight size={14} />
                                                    </button>
                                                  )}
                                                </div>
                                              </div>
                                            );
                                          })}
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onRequestRider(order.id);
                                              setShowRiderPicker(null);
                                            }}
                                            className="p-3 text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 hover:text-primary transition-colors italic"
                                          >
                                            Broadcast to all (Public)
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (connectedRiders.length > 0) {
                                            setShowRiderPicker(order.id);
                                          } else {
                                            onRequestRider(order.id);
                                          }
                                        }}
                                        className="w-full h-12 bg-primary/10 text-primary border-2 border-primary/20 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary hover:text-on-primary transition-all flex items-center justify-center gap-2 group shadow-sm active:scale-95"
                                      >
                                        <Rocket
                                          size={16}
                                          className="group-hover:animate-bounce"
                                        />
                                        {connectedRiders.length > 0
                                          ? `Tag Rider (${connectedRiders.length} Online)`
                                          : "Invoke Rider Dispatch (R 5.00)"}
                                      </button>
                                    )}
                                  </div>
                                )}
                            </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {viewMode === "active" && (
                      <div
                        className="flex flex-col gap-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-3">
                          {order.status === "pending" && (
                            <div className="flex-1 flex flex-col gap-2">
                              {isOrderDelivery(order) &&
                                !order.delivery_status && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onRequestRider(order.id);
                                    }}
                                    className={cn(
                                      "w-full bg-orange-600 text-white font-black rounded-full shadow-lg hover:bg-orange-700 transition-all mb-2 flex items-center justify-center gap-2 border-2 border-orange-400/30 py-4",
                                      kitchenMode ? "text-xl" : "text-sm",
                                    )}
                                  >
                                    <Rocket
                                      size={20}
                                      className="animate-pulse"
                                    />
                                    REQUEST RIDER NOW
                                  </button>
                                )}
                              {acceptingOrderId === order.id ? (
                                <motion.div
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="space-y-2"
                                >
                                  <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/60 block">Order Notes & Custom Message</label>
                                  <input
                                    type="text"
                                    value={orderNotes}
                                    onChange={(e) => setOrderNotes(e.target.value)}
                                    className="w-full px-4 py-2 text-xs bg-surface-container-low border border-primary/20 rounded-lg focus:ring-1 focus:ring-primary outline-none text-on-surface"
                                    placeholder="Kitchen notes (e.g., no onions)..."
                                    autoFocus
                                  />
                                  <input
                                    type="text"
                                    value={customMessage}
                                    onChange={(e) =>
                                      setCustomMessage(e.target.value)
                                    }
                                    className="w-full px-4 py-2 text-xs bg-surface-container-low border border-primary/20 rounded-lg focus:ring-1 focus:ring-primary outline-none text-on-surface"
                                    placeholder="Receipt message..."
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => {
                                        const finalMsg = orderNotes ? `Notes: ${orderNotes} | Msg: ${customMessage}` : customMessage;
                                        onUpdateStatus(
                                          order.id,
                                          "preparing",
                                          finalMsg,
                                        );
                                        setAcceptingOrderId(null);
                                        setOrderNotes("");
                                      }}
                                      className="flex-1 py-2 bg-primary text-white text-xs font-bold rounded-full"
                                    >
                                      Send & Accept
                                    </button>
                                    <button
                                      onClick={() => {
                                        setAcceptingOrderId(null);
                                        setOrderNotes("");
                                      }}
                                      className="px-4 py-2 bg-surface-container-high text-on-surface-variant text-xs font-bold rounded-full"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </motion.div>
                              ) : (
                                <div className="space-y-2">
                                  {isLimitReached && (
                                    <div className="flex items-center gap-2 p-2 bg-error/10 text-error rounded-lg text-[10px] font-bold">
                                      <AlertCircle size={12} />
                                      ORDER LIMIT REACHED ({maxConcurrentOrders}
                                      )
                                    </div>
                                  )}
                                  <button
                                    onClick={() =>
                                      setAcceptingOrderId(order.id)
                                    }
                                    disabled={isLimitReached}
                                    className={cn(
                                      "w-full bg-primary text-white font-bold rounded-full shadow-md hover:bg-primary-container transition-colors disabled:opacity-50 disabled:grayscale",
                                      kitchenMode
                                        ? "py-5 text-lg"
                                        : "py-3 text-sm",
                                    )}
                                  >
                                    Accept Order
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                          {(order.status === "preparing" ||
                            order.status === "accepted") && (
                            <div className="flex-1 flex flex-col gap-2">
                              {isOrderDelivery(order) &&
                                !order.delivery_status && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onRequestRider(order.id);
                                    }}
                                    className={cn(
                                      "w-full bg-orange-600 text-white font-black rounded-full shadow-lg hover:bg-orange-700 transition-all mb-2 flex items-center justify-center gap-2 border-2 border-orange-400/30 py-4",
                                      kitchenMode ? "text-xl" : "text-sm",
                                    )}
                                  >
                                    <Rocket
                                      size={20}
                                      className="animate-pulse"
                                    />
                                    REQUEST RIDER NOW
                                  </button>
                                )}
                              {order.status === "accepted" && (
                                preparingOrderId === order.id ? (
                                  <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="space-y-2 mb-2 p-3 bg-primary/5 rounded-xl border border-primary/10"
                                  >
                                    <div className="flex flex-col gap-1">
                                      <label className="text-[10px] font-bold text-on-surface-variant uppercase ml-1">
                                        Update Est. Delivery Time
                                      </label>
                                      <input
                                        type="text"
                                        value={estimatedTime}
                                        onChange={(e) => setEstimatedTime(e.target.value)}
                                        className="w-full px-4 py-2 text-xs bg-surface-container-low border border-primary/20 rounded-lg focus:ring-1 focus:ring-primary outline-none"
                                        placeholder="e.g. 25 mins"
                                        autoFocus
                                      />
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => {
                                          onUpdateStatus(order.id, "preparing", undefined, estimatedTime);
                                          setPreparingOrderId(null);
                                        }}
                                        className="flex-1 py-2 bg-primary text-white text-xs font-bold rounded-lg"
                                      >
                                        Set Time & Start
                                      </button>
                                      <button
                                        onClick={() => setPreparingOrderId(null)}
                                        className="px-4 py-2 bg-surface-container-high text-on-surface-variant text-xs font-bold rounded-lg"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </motion.div>
                                ) : (
                                  <button
                                    onClick={() => setPreparingOrderId(order.id)}
                                    className={cn(
                                      "w-full bg-primary text-white font-bold rounded-full shadow-md hover:bg-primary-container transition-colors mb-2",
                                      kitchenMode
                                        ? "py-5 text-lg"
                                        : "py-3 text-sm",
                                    )}
                                  >
                                    Start Preparing
                                  </button>
                                )
                              )}
                              {readyOrderId === order.id ? (
                                <motion.div
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="space-y-2"
                                >
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-bold text-on-surface-variant uppercase ml-1">
                                      Est. Delivery Time
                                    </label>
                                    <input
                                      type="text"
                                      value={estimatedTime}
                                      onChange={(e) =>
                                        setEstimatedTime(e.target.value)
                                      }
                                      className="w-full px-4 py-2 text-xs bg-surface-container-low border border-primary/20 rounded-lg focus:ring-1 focus:ring-primary outline-none"
                                      placeholder="e.g. 20-30 mins"
                                      autoFocus
                                    />
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      disabled={updatingOrderId === order.id}
                                      onClick={async () => {
                                        setUpdatingOrderId(order.id);
                                        await onUpdateStatus(
                                          order.id,
                                          "ready",
                                          undefined,
                                          estimatedTime,
                                        );
                                        setUpdatingOrderId(null);
                                        setReadyOrderId(null);
                                      }}
                                      className="flex-1 py-2 bg-tertiary text-white text-xs font-bold rounded-full disabled:opacity-50"
                                    >
                                      {updatingOrderId === order.id ? "Updating..." : "Confirm & Ready"}
                                    </button>
                                    <button
                                      disabled={updatingOrderId === order.id}
                                      onClick={() => setReadyOrderId(null)}
                                      className="px-4 py-2 bg-surface-container-high text-on-surface-variant text-xs font-bold rounded-full disabled:opacity-50"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </motion.div>
                              ) : (
                                <button
                                  onClick={() => setReadyOrderId(order.id)}
                                  disabled={updatingOrderId === order.id}
                                  className={cn(
                                    "w-full bg-gradient-to-br from-primary to-primary-container text-white font-bold rounded-full shadow-[0_8px_24px_-4px_rgba(167,52,0,0.2)] hover:scale-[0.98] transition-transform",
                                    kitchenMode
                                      ? "py-5 text-lg"
                                      : "py-3 text-sm",
                                    updatingOrderId === order.id && "opacity-50 pointer-events-none"
                                  )}
                                >
                                  {updatingOrderId === order.id ? "Marking..." : "Mark as Ready"}
                                </button>
                              )}
                            </div>
                          )}
                          {order.status === "ready" && (
                            <button
                              onClick={() =>
                                onUpdateStatus(order.id, "completed")
                              }
                              className={cn(
                                "flex-1 bg-tertiary text-white font-bold rounded-full hover:bg-tertiary-container transition-colors shadow-md",
                                kitchenMode ? "py-5 text-lg" : "py-3 text-sm",
                              )}
                            >
                              Mark as Completed
                            </button>
                          )}
                          <div className="flex gap-2">
                            {order.rider_id && order.status !== "completed" && (
                              <button
                                onClick={() => {
                                  const nudgeMessage = order.delivery_status === 'picked_up' ? "Your delivery is almost there!" : "Order ready for pickup!";
                                  sendRiderNudge(
                                    order.rider_id!,
                                    nudgeMessage
                                  );
                                  toast.success("Rider nudged successfully!");
                                }}
                                className={cn(
                                  "bg-amber-100 text-amber-700 rounded-full hover:bg-amber-200 transition-all font-bold flex flex-1 items-center justify-center gap-2",
                                  kitchenMode ? "p-5 text-lg" : "p-3 text-sm"
                                )}
                                title="Nudge Rider"
                              >
                                <Zap size={kitchenMode ? 24 : 18} />
                                {kitchenMode ? "Nudge Rider" : (order.delivery_status === 'picked_up' ? "Ping Rider" : "Nudge")}
                              </button>
                            )}
                            <button
                              onClick={() =>
                                setChatOrderId(
                                  chatOrderId === order.id ? null : order.id,
                                )
                              }
                              className={cn(
                                "bg-surface-container-high rounded-full text-on-surface-variant hover:bg-surface-container-highest transition-all",
                                kitchenMode ? "p-5" : "p-3",
                                chatOrderId === order.id &&
                                  "bg-primary text-on-primary",
                              )}
                              title="Chat with Customer"
                            >
                              <MessageCircle size={kitchenMode ? 24 : 18} />
                            </button>
                            <button
                              onClick={() => {
                                setPrintingOrder(order);
                              }}
                              className={cn(
                                "bg-surface-container-high rounded-full text-on-surface-variant hover:bg-surface-container-highest transition-all",
                                kitchenMode ? "p-5" : "p-3",
                              )}
                              title="Print Kitchen Ticket"
                            >
                              <Printer size={kitchenMode ? 24 : 18} />
                            </button>
                            {order.status !== "completed" &&
                              order.status !== "cancelled" && (
                                <button
                                  onClick={() => {
                                    setCancellingOrder(order);
                                    setCancelReasonPreset("Out of ingredients / Items unavailable");
                                    setCustomCancelExplanation("Kitchen is temporarily out of key ingredients.");
                                  }}
                                  className={cn(
                                    "ml-auto bg-error/10 text-error rounded-full hover:bg-error/20 transition-all font-bold tracking-widest uppercase text-[10px]",
                                    kitchenMode ? "px-6 py-2" : "px-4 py-2",
                                  )}
                                >
                                  Cancel Order
                                </button>
                              )}
                          </div>
                        </div>

                        <AnimatePresence>
                          {chatOrderId === order.id && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden"
                            >
                              <ChatWindow
                                orderId={order.id}
                                shopId={order.shop_id}
                                userId={order.user_id}
                                onClose={() => setChatOrderId(null)}
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                    {viewMode === "history" && order.delivery_status === "delivered" && order.rider_id && (
                       <div className="mt-4 pt-4 border-t border-outline-variant/10" onClick={(e) => e.stopPropagation()}>
                           <div className="flex items-center justify-between">
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-1">Rider Rating</p>
                                {order.merchant_rating ? (
                                  <div className="flex items-center gap-1 text-amber-500">
                                      {Array(5).fill(0).map((_, i) => (
                                          <Star key={i} size={14} className={i < order.merchant_rating! ? "fill-current" : "text-outline-variant"} />
                                      ))}
                                      <span className="text-xs font-bold text-on-surface ml-2 pl-2 border-l border-outline-variant/20">{order.merchant_rating.toFixed(1)}</span>
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-2">
                                     <button
                                        onClick={() => {
                                           if (ratingOrderId === order.id) {
                                              setRatingOrderId(null);
                                              setRatingValue(0);
                                           } else {
                                              setRatingOrderId(order.id);
                                              setRatingValue(5);
                                           }
                                        }}
                                        className="text-xs font-bold text-primary hover:text-primary-container decoration-dashed hover:underline transition-all"
                                     >
                                        Rate Rider Performance
                                     </button>
                                     {ratingOrderId === order.id && (
                                        <div className="flex items-center gap-3 bg-surface-container-low p-2 rounded-xl w-fit border border-outline-variant/20">
                                           <div className="flex items-center gap-1">
                                             {[1, 2, 3, 4, 5].map((star) => (
                                               <button
                                                 key={star}
                                                 onClick={() => setRatingValue(star)}
                                                 className="p-1 hover:scale-110 transition-transform"
                                               >
                                                 <Star size={18} className={star <= ratingValue ? "fill-amber-500 text-amber-500" : "text-outline-variant"} />
                                               </button>
                                             ))}
                                           </div>
                                           <button
                                              onClick={() => submitRiderRating(order.id, order.rider_id!, ratingValue)}
                                              className="ml-2 text-[10px] bg-primary text-white font-bold px-3 py-1.5 rounded-lg hover:bg-primary-container"
                                           >
                                              Submit
                                           </button>
                                        </div>
                                     )}
                                  </div>
                                )}
                              </div>
                           </div>
                       </div>
                    )}
                  </motion.div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-12">
        <Skeleton className="h-40 rounded-3xl" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
          <Skeleton className="lg:col-span-4 h-96 rounded-3xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="max-w-2xl space-y-1">
            <span className="font-label text-[11px] font-bold uppercase tracking-[0.2em] text-primary mb-2 block">
              Live Operations
            </span>
            <h2 className="font-headline text-2xl md:text-3xl font-bold text-on-surface tracking-tight">
              Orders Management
            </h2>
            <p className="text-sm text-on-surface-variant font-medium">
              Streamline your kitchen workflow and monitor real-time fulfillment
              across all delivery channels.
            </p>
          </div>
          
          <div className="hidden md:flex flex-wrap gap-3 justify-start md:justify-end shrink-0">
            <button
              onClick={() => {
                console.log("Clearing all orders...");
                onDeleteAllOrders();
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-error/10 text-error rounded-full text-xs md:text-sm font-bold shadow-sm hover:bg-error/20 transition-all cursor-pointer relative z-20"
            >
              <Trash2 size={16} className="md:w-[18px] md:h-[18px]" />
              Clear All
            </button>
            <button
              onClick={() => {
                console.log("Refreshing orders...");
                onRefresh();
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-full text-xs md:text-sm font-bold shadow-sm hover:scale-105 transition-all cursor-pointer relative z-20"
            >
              <Clock size={16} className="md:w-[18px] md:h-[18px]" />
              Refresh
            </button>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-high text-on-surface rounded-full text-xs md:text-sm font-bold shadow-sm hover:bg-surface-container-highest transition-all cursor-pointer relative z-20"
            >
              <FileDown size={16} className="md:w-[18px] md:h-[18px]" />
              Spreadsheet
            </button>
            <button
              onClick={exportToJSON}
              className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-high text-on-surface rounded-full text-xs md:text-sm font-bold shadow-sm hover:bg-surface-container-highest transition-all cursor-pointer relative z-20"
            >
              <FileDown size={16} className="md:w-[18px] md:h-[18px]" />
              Backup Data
            </button>
          </div>
        </div>

        <div className="hidden md:flex flex-wrap items-center gap-4">
          <div className="hidden md:flex p-1.5 bg-surface-container-low rounded-full w-fit">
            <button
              onClick={() => setViewMode("active")}
              className={cn(
                "px-6 py-2.5 rounded-full text-sm font-bold transition-all",
                viewMode === "active"
                  ? "bg-surface-container-lowest shadow-sm text-primary"
                  : "text-on-secondary-container hover:bg-surface-container-high",
              )}
            >
              Current Orders
            </button>
            <button
              onClick={() => setViewMode("history")}
              className={cn(
                "px-6 py-2.5 rounded-full text-sm font-bold transition-all",
                viewMode === "history"
                  ? "bg-surface-container-lowest shadow-sm text-primary"
                  : "text-on-secondary-container hover:bg-surface-container-high",
              )}
            >
              Order History
            </button>
          </div>

          {viewMode === "active" && (
            <div className="hidden md:flex p-1.5 bg-surface-container-low rounded-full w-fit border border-outline-variant/10">
              <button
                onClick={() => setLayoutMode("list")}
                className={cn(
                  "px-6 py-2.5 rounded-full text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                  layoutMode === "list"
                    ? "bg-surface-container-lowest shadow-sm text-primary font-bold"
                    : "text-on-secondary-container hover:bg-surface-container-high"
                )}
              >
                <List size={16} />
                <span>List View</span>
              </button>
              <button
                onClick={() => setLayoutMode("kanban")}
                className={cn(
                  "px-6 py-2.5 rounded-full text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                  layoutMode === "kanban"
                    ? "bg-surface-container-lowest shadow-sm text-primary font-bold"
                    : "text-on-secondary-container hover:bg-surface-container-high"
                )}
              >
                <LayoutGrid size={16} />
                <span>Kanban Board</span>
              </button>
            </div>
          )}

          <button
            onClick={() => setKitchenMode(!kitchenMode)}
            className={cn(
              "hidden md:flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all border-2 ml-auto",
              kitchenMode
                ? "bg-primary text-on-primary border-primary"
                : "bg-surface-container-low text-on-surface-variant border-transparent hover:border-primary/20",
            )}
          >
            <UtensilsCrossed size={18} />
            Kitchen Mode {kitchenMode ? "ON" : "OFF"}
          </button>
        </div>

        {/* MOBILE COMPACT ACTIONS CONSOLE */}
          <div className="flex md:hidden flex-col gap-2.5 w-full bg-surface-container-lowest/40 dark:bg-zinc-900/40 p-3 rounded-2xl border border-outline-variant/5">
            <div className="flex items-center gap-2 w-full justify-between">
              {/* Core viewMode switch */}
              <div className="flex p-1 bg-surface-container-low rounded-full flex-1">
                <button
                  onClick={() => setViewMode("active")}
                  className={cn(
                    "flex-1 py-2 text-center rounded-full text-xs font-black transition-all",
                    viewMode === "active"
                      ? "bg-white dark:bg-zinc-800 shadow-sm text-primary"
                      : "text-on-surface-variant/70 hover:text-on-surface",
                  )}
                >
                  Current
                </button>
                <button
                  onClick={() => setViewMode("history")}
                  className={cn(
                    "flex-1 py-2 text-center rounded-full text-xs font-black transition-all",
                    viewMode === "history"
                      ? "bg-white dark:bg-zinc-800 shadow-sm text-primary"
                      : "text-on-surface-variant/70 hover:text-on-surface",
                  )}
                >
                  History
                </button>
              </div>

              {/* Live refresh shortcut button */}
              <button
                onClick={() => {
                  console.log("Refreshing orders...");
                  onRefresh();
                }}
                className="w-10 h-10 bg-primary text-on-primary rounded-full flex items-center justify-center shadow-sm active:scale-95 transition-transform"
                title="Refresh Queue"
              >
                <Clock size={16} />
              </button>

              {/* More tools console toggle */}
              <button
                onClick={() => setShowMobileActions(!showMobileActions)}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all border",
                  showMobileActions
                    ? "bg-primary text-white border-primary shadow-md shadow-primary/20"
                    : "bg-surface-container-high text-on-surface border-transparent"
                )}
                title="Toggle Extra Tools"
              >
                <Settings size={16} className={cn(showMobileActions && "animate-spin")} />
              </button>
            </div>

            {/* Collapsible secondary actions panel */}
            <AnimatePresence>
              {showMobileActions && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden flex flex-col gap-2 pt-2 border-t border-outline-variant/10"
                >
                  {/* Kitchen Mode row */}
                  <div className="flex items-center justify-between p-2 rounded-xl bg-on-surface/[0.02] border border-outline-variant/10">
                    <span className="text-xs font-bold text-on-surface-variant flex items-center gap-1.5">
                      <UtensilsCrossed size={14} />
                      Kitchen Mode {kitchenMode ? "(Active)" : "(Inactive)"}
                    </span>
                    <button
                      onClick={() => setKitchenMode(!kitchenMode)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors",
                        kitchenMode
                          ? "bg-primary text-on-primary"
                          : "bg-surface-container-high text-on-surface"
                      )}
                    >
                      Toggle
                    </button>
                  </div>

                  {/* Layout Mode row */}
                  {viewMode === "active" && (
                    <div className="flex items-center justify-between p-2 rounded-xl bg-on-surface/[0.02] border border-outline-variant/10">
                      <span className="text-xs font-bold text-on-surface-variant flex items-center gap-1.5">
                        <LayoutGrid size={14} />
                        Layout: {layoutMode === "kanban" ? "Kanban Board" : "List View"}
                      </span>
                      <button
                        onClick={() => setLayoutMode(layoutMode === "kanban" ? "list" : "kanban")}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-primary text-on-primary cursor-pointer"
                      >
                        Switch
                      </button>
                    </div>
                  )}

                  {/* Exports Row */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={exportToCSV}
                      className="flex items-center justify-center gap-1.5 py-2.5 bg-surface-container-high text-on-surface rounded-xl text-xs font-bold shadow-sm"
                    >
                      <FileDown size={14} />
                      Export Spreadsheet
                    </button>
                    <button
                      onClick={exportToJSON}
                      className="flex items-center justify-center gap-1.5 py-2.5 bg-surface-container-high text-on-surface rounded-xl text-xs font-bold shadow-sm"
                    >
                      <FileDown size={14} />
                      Backup Data
                    </button>
                  </div>

                  {/* Danger zone clear all */}
                  <button
                    onClick={() => {
                      console.log("Clearing all orders...");
                      onDeleteAllOrders();
                      setShowMobileActions(false);
                    }}
                    className="flex items-center justify-center gap-2 py-2.5 bg-error/10 text-error rounded-xl text-xs font-bold"
                  >
                    <Trash2 size={14} />
                    Clear All Orders (Reset)
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
      </section>

      <div
        className={cn(
          "grid grid-cols-1 gap-8 items-start",
          !kitchenMode && "lg:grid-cols-12",
        )}
      >
        <div
          className={cn(
            kitchenMode ? "col-span-full" : "lg:col-span-8",
            "space-y-6",
          )}
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-4 mb-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-on-surface-variant/60 uppercase tracking-widest mr-2">
                  Filter Status:
                </span>
                {orderStatuses.map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={cn(
                      "px-4 py-1.5 rounded-full text-xs font-bold transition-all border-2",
                      filterStatus === status
                        ? "bg-primary/10 text-primary border-primary"
                        : "bg-surface-container-low text-on-surface-variant border-transparent hover:border-primary/20",
                    )}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-on-surface-variant/60 uppercase tracking-widest mr-2">
                  Status Dropdown:
                </span>
                <div className="relative">
                  <select
                    id="status-filter-select"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as OrderStatus | "All")}
                    className="appearance-none bg-surface-container-low text-on-surface text-xs font-bold pl-4 pr-10 py-2 rounded-xl border border-outline-variant/20 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer shadow-xs transition-all"
                  >
                    <option value="All">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="preparing">Preparing</option>
                    <option value="ready">Ready</option>
                    <option value="completed">Completed</option>
                  </select>
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">
                    <Filter size={12} />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-2">
                {(filterStatus !== "All" || orderTypeFilter !== "All" || startDate || endDate || searchTerm || customerSearch || phoneSearch) && (
                  <button
                    onClick={() => {
                      setFilterStatus("All");
                      setOrderTypeFilter("All");
                      setStartDate("");
                      setEndDate("");
                      setSearchTerm("");
                      setCustomerSearch("");
                      setPhoneSearch("");
                    }}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-black text-white bg-error shadow-lg shadow-error/20 hover:scale-105 active:scale-95 transition-all"
                  >
                    <RefreshCw size={12} />
                    RESET FILTERS
                  </button>
                )}
              </div>
            </div>

            {viewMode === "history" && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full bg-surface-container-low p-5 rounded-2xl border border-outline-variant/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-2 animate-in fade-in slide-in-from-top-2 duration-300"
              >
                <div className="flex items-center gap-2 text-on-surface">
                  <Calendar size={18} className="text-primary shrink-0" />
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-on-surface">Filter by Date Range</h4>
                    <p className="text-[10px] text-on-surface-variant font-semibold">Analyze and filter historic orders</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { label: "All Time", start: "", end: "" },
                    { label: "Today", start: new Date().toISOString().split("T")[0], end: new Date().toISOString().split("T")[0] },
                    { label: "Yesterday", start: getPastDateStr(1), end: getPastDateStr(1) },
                    { label: "7 Days", start: getPastDateStr(7), end: new Date().toISOString().split("T")[0] },
                    { label: "30 Days", start: getPastDateStr(30), end: new Date().toISOString().split("T")[0] },
                  ].map((preset) => {
                    const isSelected = startDate === preset.start && endDate === preset.end;
                    return (
                      <button
                        key={preset.label}
                        onClick={() => {
                          setStartDate(preset.start);
                          setEndDate(preset.end);
                        }}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer hover:scale-[1.02] active:scale-95",
                          isSelected 
                            ? "bg-primary text-on-primary shadow-xs" 
                            : "bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant"
                        )}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/75">From:</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-surface-container-highest/60 text-on-surface px-2.5 py-1.5 rounded-xl border border-outline-variant/10 focus:outline-none focus:ring-1 focus:ring-primary text-[11px] font-bold text-on-surface"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/75">To:</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-surface-container-highest/60 text-on-surface px-2.5 py-1.5 rounded-xl border border-outline-variant/10 focus:outline-none focus:ring-1 focus:ring-primary text-[11px] font-bold text-on-surface"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            <div className="flex items-center justify-between mb-2">
              <h3 className="font-headline text-xl font-bold flex items-center gap-2">
                {viewMode === "active" ? "Active Queue" : "Order History"}
                <span className="bg-primary-fixed text-on-primary-fixed text-xs px-2.5 py-1 rounded-full">
                  {displayedOrders.length} Orders
                </span>
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowSearch(!showSearch)}
                  className={cn(
                    "p-2 rounded-full transition-colors",
                    showSearch
                      ? "bg-primary text-on-primary"
                      : "hover:bg-surface-container-low text-on-surface-variant",
                  )}
                >
                  <Search size={20} />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4 mb-2 overflow-x-auto pb-2 scrollbar-hide">
              <span className="text-xs font-bold text-on-surface-variant/60 uppercase tracking-widest shrink-0">
                Sort by:
              </span>
              {[
                { id: "created_at", label: "Date", icon: Clock },
                { id: "total_price", label: "Price", icon: TrendingUp },
                { id: "id", label: "Order ID", icon: ReceiptText },
              ].map((field) => (
                <button
                  key={field.id}
                  onClick={() =>
                    handleSort(field.id as "id" | "total_price" | "created_at")
                  }
                  className={cn(
                    "flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold transition-all shrink-0 border-2",
                    sortField === field.id
                      ? "bg-primary text-on-primary border-primary shadow-[0_4px_12px_rgba(167,52,0,0.3)] scale-105 ring-2 ring-primary/20"
                      : "bg-surface-container-low text-on-surface-variant border-transparent hover:border-primary/20",
                  )}
                >
                  <field.icon
                    size={14}
                    className={cn(
                      sortField === field.id ? "animate-pulse" : "",
                    )}
                  />
                  {field.label}
                  {sortField === field.id && (
                    <motion.span
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      className="ml-1 bg-white/20 p-0.5 rounded-full flex items-center justify-center"
                    >
                      {sortDirection === "asc" ? (
                        <ArrowUp size={12} />
                      ) : (
                        <ArrowDown size={12} />
                      )}
                    </motion.span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <AnimatePresence>
            {showSearch && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="relative">
                    <Search
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40"
                      size={18}
                    />
                    <input
                      autoFocus
                      type="text"
                      placeholder="Search product or ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-surface-container-lowest border-2 border-primary/10 rounded-2xl py-3 pl-12 pr-5 focus:ring-2 focus:ring-primary/40 transition-all outline-none"
                    />
                  </div>
                  <div className="relative">
                    <Search
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40"
                      size={18}
                    />
                    <input
                      type="text"
                      placeholder="Customer Name..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      className="w-full bg-surface-container-lowest border-2 border-primary/10 rounded-2xl py-3 pl-12 pr-5 focus:ring-2 focus:ring-primary/40 transition-all outline-none"
                    />
                  </div>
                  <div className="relative">
                    <Phone
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40"
                      size={18}
                    />
                    <input
                      type="text"
                      placeholder="Phone Number..."
                      value={phoneSearch}
                      onChange={(e) => setPhoneSearch(e.target.value)}
                      className="w-full bg-surface-container-lowest border-2 border-primary/10 rounded-2xl py-3 pl-12 pr-5 focus:ring-2 focus:ring-primary/40 transition-all outline-none"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {displayedOrders.length === 0 ? (
            <div className="bg-surface-container-low rounded-[2rem] p-12 flex flex-col items-center text-center space-y-6 border-2 border-dashed border-outline-variant/20">
              <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center">
                {viewMode === "active" ? (
                  <Clock className="text-primary" size={40} />
                ) : (
                  <ReceiptText className="text-primary" size={40} />
                )}
              </div>
              <div className="space-y-2">
                <h4 className="font-headline text-2xl font-bold">
                  {viewMode === "active" ? "All caught up!" : "No history yet"}
                </h4>
                <p className="text-on-surface-variant max-w-xs mx-auto">
                  {viewMode === "active"
                    ? "Your kitchen is currently clear. New orders will appear here as they arrive."
                    : "Completed orders will appear here once they are fulfilled."}
                </p>
              </div>
              {viewMode === "active" && (
                <button
                  onClick={onRefresh}
                  className="px-8 py-3 bg-surface-container-lowest text-primary font-bold rounded-full shadow-sm hover:scale-105 transition-all border border-primary/10"
                >
                  Check for New Orders
                </button>
              )}
            </div>
          ) : viewMode === "active" && layoutMode === "kanban" ? (
            <div className="flex overflow-x-auto hide-scrollbar xl:grid xl:grid-cols-4 gap-6 items-start snap-x snap-mandatory pb-4 xl:pb-0">
              {/* Column 1: New Orders */}
              <div className="bg-surface-container-low/60 rounded-[2.5rem] p-5 border border-outline-variant/10 flex flex-col gap-4 min-h-[500px] w-[85vw] md:w-[360px] xl:w-[400px] shrink-0 snap-center">
                <div className="flex items-center justify-between px-2 pb-2 border-b border-outline-variant/10">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <div>
                      <h3 className="font-headline font-black text-xs uppercase tracking-wider text-on-surface">New Orders</h3>
                      {pendingOrderPriorityIds.length > 0 && (
                        <span className="text-[8px] font-bold text-amber-600 dark:text-amber-400 block -mt-0.5 flex items-center gap-1">
                          <SlidersHorizontal size={8} /> Prioritized
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {pendingOrderPriorityIds.length > 0 && (
                      <button
                        onClick={handleResetPendingPriority}
                        title="Reset to default chronological order"
                        className="px-2 py-0.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant text-[10px] font-bold rounded-full transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw size={10} /> Reset
                      </button>
                    )}
                    {selectedPendingOrders.length > 0 && (
                      <button
                        onClick={() => {
                          const ordersToPrint = prioritizedPendingOrders.filter((o) => selectedPendingOrders.includes(o.id));
                          handleBulkPrint(ordersToPrint, printingFormat, printingIncludeAddr);
                          setSelectedPendingOrders([]);
                        }}
                        className="px-2.5 py-0.5 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-[10px] rounded-full transition-colors flex items-center gap-1"
                      >
                        <Printer size={10} /> Print Selected
                      </button>
                    )}
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-bold text-[10px]">
                      {prioritizedPendingOrders.length}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-3 overflow-y-auto max-h-[45vh] xl:max-h-[65vh] pr-1 scroll-smooth [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-on-surface/15 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-on-surface/30">
                  <AnimatePresence mode="popLayout">
                  {prioritizedPendingOrders.map((order, index) => {
                    const items = safeGetOrderItems(order.items);
                    const isSelected = selectedPendingOrders.includes(order.id);
                    const isDelivery = isOrderDelivery(order);
                    const isFindingRider = isDelivery && (!order.rider_id || order.delivery_status === "finding_rider");
                    const isDispatched = isDelivery && (order.rider_id || order.delivery_status === "accepted" || order.delivery_status === "picked_up" || order.delivery_status === "dispatched");
                    const isDragging = draggedPendingId === order.id;
                    const isDragOver = dragOverPendingId === order.id;

                    return (
                      <motion.div
                        layoutId={order.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        key={order.id}
                        draggable={true}
                        onDragStart={((e: React.DragEvent) => {
                          setDraggedPendingId(order.id);
                          if (e.dataTransfer) {
                            e.dataTransfer.setData("text/plain", order.id);
                            e.dataTransfer.effectAllowed = "move";
                          }
                        }) as any}
                        onDragOver={(e: React.DragEvent) => {
                          e.preventDefault();
                          if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
                          if (draggedPendingId && draggedPendingId !== order.id && dragOverPendingId !== order.id) {
                            setDragOverPendingId(order.id);
                          }
                        }}
                        onDragLeave={(e: React.DragEvent) => {
                          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                          if (dragOverPendingId === order.id) {
                            setDragOverPendingId(null);
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (draggedPendingId && draggedPendingId !== order.id) {
                            handleReorderPendingOrders(draggedPendingId, order.id);
                          }
                          setDraggedPendingId(null);
                          setDragOverPendingId(null);
                        }}
                        onDragEnd={() => {
                          setDraggedPendingId(null);
                          setDragOverPendingId(null);
                        }}
                        className={cn(
                          "order-card bg-white dark:bg-zinc-900 border rounded-2xl p-4 shadow-xs relative overflow-hidden group transition-all duration-300 space-y-2 cursor-grab active:cursor-grabbing",
                          isSelected ? "border-primary ring-2 ring-primary/30" : "",
                          isDragging ? "opacity-40 scale-[0.98] border-dashed border-primary ring-2 ring-primary/20" : "",
                          isDragOver ? "border-primary bg-primary/[0.04] ring-2 ring-primary shadow-md -translate-y-1" : "",
                          !isDragging && !isDragOver && (
                            isFindingRider
                              ? "border-2 border-amber-500 ring-2 ring-amber-500/30 animate-pulse bg-gradient-to-b from-amber-500/5 via-transparent to-transparent dark:from-amber-500/10"
                              : isDispatched
                                ? "border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-950/10"
                                : "border-outline-variant/10"
                          )
                        )}
                        whileHover={{ y: -2 }}
                      >
                        {/* Drag Over Drop Indicator Banner */}
                        {isDragOver && (
                          <div className="absolute top-0 left-0 right-0 h-1 bg-primary rounded-t-2xl animate-pulse" />
                        )}

                        {/* Rider / Delivery Live Status Indicator */}
                        <div className="mb-2">
                          {renderRiderStatusBadge(order)}
                        </div>
                        {/* Top info */}
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex items-start gap-2">
                            <div
                              className="mt-1 cursor-grab active:cursor-grabbing text-on-surface-variant/40 hover:text-primary transition-colors flex items-center justify-center shrink-0"
                              title="Drag to prioritize"
                            >
                              <GripVertical size={15} />
                            </div>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedPendingOrders(prev => [...prev, order.id]);
                                } else {
                                  setSelectedPendingOrders(prev => prev.filter(id => id !== order.id));
                                }
                              }}
                              className="mt-1 w-3.5 h-3.5 rounded border-outline-variant/30 text-primary focus:ring-primary/50 cursor-pointer"
                            />
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-mono font-black text-primary uppercase">
                                  #{order.id.slice(-4).toUpperCase()}
                                </span>
                                <span className="px-1.5 py-0.2 rounded text-[8px] font-black font-mono bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20" title="Priority rank">
                                  P{index + 1}
                                </span>
                              </div>
                              <h4 className="font-bold text-sm text-on-surface mt-0.5">{order.customer_name}</h4>
                              {/* Custom Tags display */}
                              <div className="flex flex-wrap gap-1 mt-1">
                                {getOrderTags(order).map((tag) => {
                                  const colors: Record<string, string> = {
                                    "Rush": "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
                                    "VIP": "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                                    "Large Order": "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
                                    "Special": "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
                                  };
                                  return (
                                    <span
                                      key={tag}
                                      className={cn(
                                        "px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-md border whitespace-nowrap",
                                        colors[tag] || "bg-zinc-100 text-zinc-600 border-zinc-200"
                                      )}
                                    >
                                      {tag === "Rush" && "⚡ "}{tag === "VIP" && "⭐ "}{tag === "Large Order" && "📦 "}{tag}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                          <span className="text-[9px] font-mono text-on-surface-variant/70 bg-surface-container-high px-2 py-0.5 rounded-md">
                            {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {/* Items list */}
                        <div className="mt-3 text-xs text-on-surface-variant space-y-1 font-medium bg-surface-container-lowest p-2 rounded-xl border border-outline-variant/5">
                          {items.map((item, idx) => {
                            const isObj = typeof item === "object" && item !== null;
                            const name = isObj ? ((item as unknown) as Record<string, unknown>).name as string : String(item);
                            const qty = isObj ? ((item as unknown) as Record<string, unknown>).quantity as number : 1;
                            const price = isObj ? ((item as unknown) as Record<string, unknown>).price as number : 0;
                            return (
                              <div key={idx} className="flex justify-between">
                                <span className="truncate max-w-[150px]">{qty}x {name}</span>
                                <span className="opacity-70 font-mono">R {Number(price || 0).toFixed(2)}</span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Order Type Badge & Address */}
                        <div className="mt-2 flex items-center justify-between gap-1.5 text-[10px] text-on-surface-variant">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full font-bold uppercase text-[8px]",
                            !isOrderDelivery(order) ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                          )}>
                            {!isOrderDelivery(order) ? "collection" : "delivery"}
                          </span>
                          <AddressDisplay address={order.address} city={order.city} className="text-[10px] max-sm:text-[9px] font-medium max-w-[170px]" maxParts={2} />
                        </div>

                        {/* Action buttons with inline input forms */}
                        {acceptingOrderId === order.id ? (
                          <div className="space-y-2 mt-3 pt-3 border-t border-outline-variant/5">
                            <label className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/60 block">Order Notes & Custom Message</label>
                            <input
                              type="text"
                              value={orderNotes}
                              onChange={(e) => setOrderNotes(e.target.value)}
                              className="w-full px-3 py-1.5 text-xs bg-surface-container-low border border-primary/20 rounded-lg focus:ring-1 focus:ring-primary outline-none text-on-surface mb-2"
                              placeholder="Kitchen notes (e.g., no onions)..."
                              autoFocus
                            />
                            <input
                              type="text"
                              value={customMessage}
                              onChange={(e) => setCustomMessage(e.target.value)}
                              className="w-full px-3 py-1.5 text-xs bg-surface-container-low border border-primary/20 rounded-lg focus:ring-1 focus:ring-primary outline-none text-on-surface"
                              placeholder="Receipt message..."
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  const finalMsg = orderNotes ? `Notes: ${orderNotes} | Msg: ${customMessage}` : customMessage;
                                  onUpdateStatus(order.id, "preparing", finalMsg);
                                  setAcceptingOrderId(null);
                                  setOrderNotes("");
                                }}
                                className="flex-1 py-1.5 bg-primary text-white text-[10px] font-black uppercase tracking-wider rounded-lg shadow-sm hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                              >
                                Send & Accept
                              </button>
                              <button
                                onClick={() => {
                                  setAcceptingOrderId(null);
                                  setOrderNotes("");
                                }}
                                className="px-2.5 py-1.5 bg-surface-container-high text-on-surface-variant text-[10px] font-bold rounded-lg hover:bg-surface-container-highest transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 pt-3 border-t border-outline-variant/5 flex items-center justify-between gap-2">
                            <span className="font-mono font-black text-xs text-primary">R {Number(order.total_price || 0).toFixed(2)}</span>
                            <div className="flex flex-col items-end gap-1 flex-1">
                              {isLimitReached && (
                                <span className="text-[8px] font-bold text-error leading-none mb-0.5">LIMIT REACHED</span>
                              )}
                              <button
                                disabled={isLimitReached}
                                onClick={(e) => {
                                  if (isOrderDelivery(order) && !order.rider_id && connectedRiders.length === 0 && !currentShop?.linked_rider_id) {
                                    setUnlinkedModalOrder(order);
                                    return;
                                  }
                                  setAcceptingOrderId(order.id);
                                  const card = e.currentTarget.closest(".order-card");
                                  if (card) {
                                    setTimeout(() => {
                                      card.scrollIntoView({ behavior: "smooth", block: "nearest" });
                                    }, 100);
                                  }
                                }}
                                className="px-3 py-1.5 bg-primary text-on-primary text-[10px] font-black uppercase tracking-wider rounded-lg shadow-sm hover:opacity-90 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none w-full text-center"
                              >
                                Accept
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Quick Tag Toggles */}
                        <div className="mt-2.5 flex items-center justify-between gap-1.5 border-t border-dashed border-outline-variant/10 pt-2 text-[9px]">
                          <span className="text-on-surface-variant/40 font-bold uppercase tracking-wider">Quick Tags:</span>
                          <div className="flex items-center gap-1">
                            {(["Rush", "VIP", "Special"] as const).map((tag) => {
                              const isActive = (orderTags[order.id] || []).includes(tag);
                              const icons = { Rush: "⚡", VIP: "⭐", Special: "📝" };
                              return (
                                <button
                                  key={tag}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleOrderTag(order.id, tag);
                                  }}
                                  title={`Toggle ${tag}`}
                                  className={cn(
                                    "px-1.5 py-0.5 rounded-md font-bold transition-all cursor-pointer select-none text-[8px]",
                                    isActive
                                      ? tag === "Rush"
                                        ? "bg-rose-500 text-white"
                                        : tag === "VIP"
                                          ? "bg-amber-500 text-white"
                                          : "bg-teal-500 text-white"
                                      : "bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500 hover:text-stone-600"
                                  )}
                                >
                                  {icons[tag]} {tag === "Special" ? "Spec" : tag}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                  {prioritizedPendingOrders.length === 0 && (
                    <div className="text-center py-8 text-xs text-on-surface-variant/50 font-bold">No new orders</div>
                  )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Column 2: Preparing */}
              <div className="bg-surface-container-low/60 rounded-[2.5rem] p-5 border border-outline-variant/10 flex flex-col gap-4 min-h-[500px] w-[85vw] md:w-[360px] xl:w-[400px] shrink-0 snap-center">
                <div className="flex items-center justify-between px-2 pb-2 border-b border-outline-variant/10">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                    <h3 className="font-headline font-black text-xs uppercase tracking-wider text-on-surface">Preparing</h3>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 font-bold text-[10px]">
                    {displayedOrders.filter(o => o.status === "accepted" || o.status === "preparing").length}
                  </span>
                </div>

                <div className="flex flex-col gap-3 overflow-y-auto max-h-[45vh] xl:max-h-[65vh] pr-1 scroll-smooth [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-on-surface/15 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-on-surface/30">
                  <AnimatePresence mode="popLayout">
                  {displayedOrders.filter(o => o.status === "accepted" || o.status === "preparing").map((order) => {
                    const items = safeGetOrderItems(order.items);
                    const isDelivery = isOrderDelivery(order);
                    const isFindingRider = isDelivery && (!order.rider_id || order.delivery_status === "finding_rider");
                    const isDispatched = isDelivery && (order.rider_id || order.delivery_status === "accepted" || order.delivery_status === "picked_up" || order.delivery_status === "dispatched");

                    return (
                      <motion.div
                        layoutId={order.id}
                        key={order.id}
                        className={cn(
                          "order-card bg-white dark:bg-zinc-900 border rounded-2xl p-4 shadow-xs relative overflow-hidden group transition-all duration-300 space-y-2",
                          isFindingRider
                            ? "border-2 border-amber-500 ring-2 ring-amber-500/30 animate-pulse bg-gradient-to-b from-amber-500/5 via-transparent to-transparent dark:from-amber-500/10"
                            : isDispatched
                              ? "border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-950/10"
                              : "border-outline-variant/10"
                        )}
                        whileHover={{ y: -2 }}
                      >
                        {/* Rider / Delivery Live Status Indicator */}
                        <div className="mb-2">
                          {renderRiderStatusBadge(order)}
                        </div>
                        {/* Top info */}
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <span className="text-[10px] font-mono font-black text-primary uppercase">
                              #{order.id.slice(-4).toUpperCase()}
                            </span>
                            <h4 className="font-bold text-sm text-on-surface mt-0.5">{order.customer_name}</h4>
                            {/* Custom Tags display */}
                            <div className="flex flex-wrap gap-1 mt-1">
                              {getOrderTags(order).map((tag) => {
                                const colors: Record<string, string> = {
                                  "Rush": "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
                                  "VIP": "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                                  "Large Order": "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
                                  "Special": "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
                                };
                                return (
                                  <span
                                    key={tag}
                                    className={cn(
                                      "px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-md border whitespace-nowrap",
                                      colors[tag] || "bg-zinc-100 text-zinc-600 border-zinc-200"
                                    )}
                                  >
                                    {tag === "Rush" && "⚡ "}{tag === "VIP" && "⭐ "}{tag === "Large Order" && "📦 "}{tag}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                          <span className="text-[9px] font-mono text-on-surface-variant/70 bg-surface-container-high px-2 py-0.5 rounded-md">
                            {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {/* Items list */}
                        <div className="mt-3 text-xs text-on-surface-variant space-y-1 font-medium bg-surface-container-lowest p-2 rounded-xl border border-outline-variant/5">
                          {items.map((item, idx) => {
                            const isObj = typeof item === "object" && item !== null;
                            const name = isObj ? ((item as unknown) as Record<string, unknown>).name as string : String(item);
                            const qty = isObj ? ((item as unknown) as Record<string, unknown>).quantity as number : 1;
                            const price = isObj ? ((item as unknown) as Record<string, unknown>).price as number : 0;
                            return (
                              <div key={idx} className="flex justify-between">
                                <span className="truncate max-w-[150px]">{qty}x {name}</span>
                                <span className="opacity-70 font-mono">R {Number(price || 0).toFixed(2)}</span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Delivery Track Badge & Gated Dispatch Action */}
                        <div className="mt-2.5 space-y-1.5">
                          {isDelivery && order.status !== "dispatched" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!order.rider_id && connectedRiders.length === 0 && !currentShop?.linked_rider_id) {
                                  setUnlinkedModalOrder(order);
                                } else if (connectedRiders.length === 1 && onDispatchToRider) {
                                  const r = connectedRiders[0];
                                  void onDispatchToRider(order.id, r.rider_id || String(r.id), r.rider_name || undefined, r.rider_phone || undefined);
                                } else {
                                  setShowRiderPicker(order.id);
                                }
                              }}
                              className="w-full py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                            >
                              <Rocket size={12} className="animate-pulse text-amber-200" />
                              <span>Send Rider (Dispatch)</span>
                            </button>
                          )}
                          {isDelivery ? (
                            <div className="p-2 bg-surface-container-low rounded-xl border border-outline-variant/5 text-[9px] font-bold text-on-surface-variant flex items-center justify-between">
                              <span className="uppercase tracking-wider text-on-surface-variant/60">Delivery status:</span>
                              <span className="text-primary uppercase font-black">{order.delivery_status?.replace("_", " ") || "Pending Dispatch"}</span>
                            </div>
                          ) : null}
                        </div>

                        {/* Action buttons with inline input forms */}
                        {order.status === "accepted" ? (
                          preparingOrderId === order.id ? (
                            <div className="space-y-2 mt-3 pt-3 border-t border-outline-variant/5">
                              <label className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/60 block">Prep Time (mins)</label>
                              <input
                                type="text"
                                value={estimatedTime}
                                onChange={(e) => setEstimatedTime(e.target.value)}
                                className="w-full px-3 py-1.5 text-xs bg-surface-container-low border border-primary/20 rounded-lg focus:ring-1 focus:ring-primary outline-none text-on-surface"
                                placeholder="e.g. 25 mins"
                                autoFocus
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    onUpdateStatus(order.id, "preparing", undefined, estimatedTime);
                                    setPreparingOrderId(null);
                                  }}
                                  className="flex-1 py-1.5 bg-primary text-white text-[10px] font-black uppercase tracking-wider rounded-lg shadow-sm hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                                >
                                  Start Prep
                                </button>
                                <button
                                  onClick={() => setPreparingOrderId(null)}
                                  className="px-2.5 py-1.5 bg-surface-container-high text-on-surface-variant text-[10px] font-bold rounded-lg hover:bg-surface-container-highest transition-colors cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-3 pt-3 border-t border-outline-variant/5 flex items-center justify-between gap-2">
                              <span className="font-mono font-black text-xs text-primary">R {Number(order.total_price || 0).toFixed(2)}</span>
                              <button
                                onClick={(e) => {
                                  setPreparingOrderId(order.id);
                                  const card = e.currentTarget.closest(".order-card");
                                  if (card) {
                                    setTimeout(() => {
                                      card.scrollIntoView({ behavior: "smooth", block: "nearest" });
                                    }, 100);
                                  }
                                }}
                                className="px-3 py-1.5 bg-primary text-white text-[10px] font-black uppercase tracking-wider rounded-lg shadow-sm hover:opacity-95 active:scale-95 transition-all cursor-pointer flex-1 text-center"
                              >
                                Start Preparing
                              </button>
                            </div>
                          )
                        ) : (
                          readyOrderId === order.id ? (
                            <div className="space-y-2 mt-3 pt-3 border-t border-outline-variant/5">
                              <label className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/60 block">Est. Delivery Time</label>
                              <input
                                type="text"
                                value={estimatedTime}
                                onChange={(e) => setEstimatedTime(e.target.value)}
                                className="w-full px-3 py-1.5 text-xs bg-surface-container-low border border-primary/20 rounded-lg focus:ring-1 focus:ring-primary outline-none text-on-surface"
                                placeholder="e.g. 15-20 mins"
                                autoFocus
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    onUpdateStatus(order.id, "ready", undefined, estimatedTime);
                                    setReadyOrderId(null);
                                  }}
                                  className="flex-1 py-1.5 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider rounded-lg shadow-sm hover:bg-emerald-500 active:scale-95 transition-all cursor-pointer"
                                >
                                  Confirm Ready
                                </button>
                                <button
                                  onClick={() => setReadyOrderId(null)}
                                  className="px-2.5 py-1.5 bg-surface-container-high text-on-surface-variant text-[10px] font-bold rounded-lg hover:bg-surface-container-highest transition-colors cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-3 pt-3 border-t border-outline-variant/5 flex items-center justify-between gap-2">
                              <span className="font-mono font-black text-xs text-primary">R {Number(order.total_price || 0).toFixed(2)}</span>
                              <button
                                onClick={(e) => {
                                  setReadyOrderId(order.id);
                                  const card = e.currentTarget.closest(".order-card");
                                  if (card) {
                                    setTimeout(() => {
                                      card.scrollIntoView({ behavior: "smooth", block: "nearest" });
                                    }, 100);
                                  }
                                }}
                                className="px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider rounded-lg shadow-sm hover:bg-emerald-500 active:scale-95 transition-all cursor-pointer flex-1 text-center"
                              >
                                Mark Ready
                              </button>
                            </div>
                          )
                        )}

                        {/* Quick Tag Toggles */}
                        <div className="mt-2.5 flex items-center justify-between gap-1.5 border-t border-dashed border-outline-variant/10 pt-2 text-[9px]">
                          <span className="text-on-surface-variant/40 font-bold uppercase tracking-wider">Quick Tags:</span>
                          <div className="flex items-center gap-1">
                            {(["Rush", "VIP", "Special"] as const).map((tag) => {
                              const isActive = (orderTags[order.id] || []).includes(tag);
                              const icons = { Rush: "⚡", VIP: "⭐", Special: "📝" };
                              return (
                                <button
                                  key={tag}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleOrderTag(order.id, tag);
                                  }}
                                  title={`Toggle ${tag}`}
                                  className={cn(
                                    "px-1.5 py-0.5 rounded-md font-bold transition-all cursor-pointer select-none text-[8px]",
                                    isActive
                                      ? tag === "Rush"
                                        ? "bg-rose-500 text-white"
                                        : tag === "VIP"
                                          ? "bg-amber-500 text-white"
                                          : "bg-teal-500 text-white"
                                      : "bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500 hover:text-stone-600"
                                  )}
                                >
                                  {icons[tag]} {tag === "Special" ? "Spec" : tag}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                  {displayedOrders.filter(o => o.status === "accepted" || o.status === "preparing").length === 0 && (
                    <div className="text-center py-8 text-xs text-on-surface-variant/50 font-bold">None in prep</div>
                  )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Column 3: Ready for Pickup */}
              <div className="bg-surface-container-low/60 rounded-[2.5rem] p-5 border border-outline-variant/10 flex flex-col gap-4 min-h-[500px] w-[85vw] md:w-[360px] xl:w-[400px] shrink-0 snap-center">
                <div className="flex items-center justify-between px-2 pb-2 border-b border-outline-variant/10">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <h3 className="font-headline font-black text-xs uppercase tracking-wider text-on-surface">Ready</h3>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-bold text-[10px]">
                    {displayedOrders.filter(o => o.status === "ready").length}
                  </span>
                </div>

                <div className="flex flex-col gap-3 overflow-y-auto max-h-[45vh] xl:max-h-[65vh] pr-1 scroll-smooth [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-on-surface/15 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-on-surface/30">
                  <AnimatePresence mode="popLayout">
                  {displayedOrders.filter(o => o.status === "ready").map((order) => {
                    const items = safeGetOrderItems(order.items);
                    const canNudge = order.rider_id && order.status !== "completed";
                    const isDelivery = isOrderDelivery(order);
                    const isFindingRider = isDelivery && (!order.rider_id || order.delivery_status === "finding_rider");
                    const isDispatched = isDelivery && (order.rider_id || order.delivery_status === "accepted" || order.delivery_status === "picked_up" || order.delivery_status === "dispatched");

                    return (
                      <motion.div
                        layoutId={order.id}
                        key={order.id}
                        className={cn(
                          "order-card bg-white dark:bg-zinc-900 border rounded-2xl p-4 shadow-xs relative overflow-hidden group transition-all duration-300 space-y-2",
                          isFindingRider
                            ? "border-2 border-amber-500 ring-2 ring-amber-500/30 animate-pulse bg-gradient-to-b from-amber-500/5 via-transparent to-transparent dark:from-amber-500/10"
                            : isDispatched
                              ? "border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-950/10"
                              : "border-outline-variant/10"
                        )}
                        whileHover={{ y: -2 }}
                      >
                        {/* Rider / Delivery Live Status Indicator */}
                        <div className="mb-2">
                          {renderRiderStatusBadge(order)}
                        </div>
                        {/* Top info */}
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <span className="text-[10px] font-mono font-black text-primary uppercase">
                              #{order.id.slice(-4).toUpperCase()}
                            </span>
                            <h4 className="font-bold text-sm text-on-surface mt-0.5">{order.customer_name}</h4>
                            {/* Custom Tags display */}
                            <div className="flex flex-wrap gap-1 mt-1">
                              {getOrderTags(order).map((tag) => {
                                const colors: Record<string, string> = {
                                  "Rush": "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
                                  "VIP": "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                                  "Large Order": "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
                                  "Special": "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
                                };
                                return (
                                  <span
                                    key={tag}
                                    className={cn(
                                      "px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-md border whitespace-nowrap",
                                      colors[tag] || "bg-zinc-100 text-zinc-600 border-zinc-200"
                                    )}
                                  >
                                    {tag === "Rush" && "⚡ "}{tag === "VIP" && "⭐ "}{tag === "Large Order" && "📦 "}{tag}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                          <span className="text-[9px] font-mono text-on-surface-variant/70 bg-surface-container-high px-2 py-0.5 rounded-md">
                            {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {/* Items list */}
                        <div className="mt-3 text-xs text-on-surface-variant space-y-1 font-medium bg-surface-container-lowest p-2 rounded-xl border border-outline-variant/5">
                          {items.map((item, idx) => {
                            const isObj = typeof item === "object" && item !== null;
                            const name = isObj ? ((item as unknown) as Record<string, unknown>).name as string : String(item);
                            const qty = isObj ? ((item as unknown) as Record<string, unknown>).quantity as number : 1;
                            const price = isObj ? ((item as unknown) as Record<string, unknown>).price as number : 0;
                            return (
                              <div key={idx} className="flex justify-between">
                                <span className="truncate max-w-[150px]">{qty}x {name}</span>
                                <span className="opacity-70 font-mono">R {Number(price || 0).toFixed(2)}</span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Gated Dispatch Action & Rider details */}
                        {isOrderDelivery(order) && order.status !== "dispatched" && (
                          <div className="mt-2.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!order.rider_id && connectedRiders.length === 0 && !currentShop?.linked_rider_id) {
                                  setUnlinkedModalOrder(order);
                                } else if (connectedRiders.length === 1 && onDispatchToRider) {
                                  const r = connectedRiders[0];
                                  void onDispatchToRider(order.id, r.rider_id || String(r.id), r.rider_name || undefined, r.rider_phone || undefined);
                                } else {
                                  setShowRiderPicker(order.id);
                                }
                              }}
                              className="w-full py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                            >
                              <Rocket size={12} className="animate-pulse text-amber-200" />
                              <span>Send Rider (Dispatch)</span>
                            </button>
                          </div>
                        )}

                        {canNudge && (
                          <div className="mt-2">
                            <button
                              onClick={() => {
                                const nudgeMessage = order.delivery_status === 'picked_up' ? "Your delivery is almost there!" : "Order ready for pickup!";
                                sendRiderNudge(order.rider_id!, nudgeMessage);
                                toast.success("Rider nudged successfully!");
                              }}
                              className="w-full py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 text-[10px] font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Zap size={11} className="text-amber-600" />
                              <span>Nudge Rider</span>
                            </button>
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="mt-3 pt-3 border-t border-outline-variant/5 flex items-center justify-between gap-2">
                          <span className="font-mono font-black text-xs text-primary">R {Number(order.total_price || 0).toFixed(2)}</span>
                          <button
                            onClick={() => onUpdateStatus(order.id, "completed")}
                            className="px-3 py-1.5 bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white text-[10px] font-black uppercase tracking-wider rounded-lg shadow-sm hover:opacity-95 active:scale-95 transition-all cursor-pointer flex-1 text-center"
                          >
                            Complete
                          </button>
                        </div>

                        {/* Quick Tag Toggles */}
                        <div className="mt-2.5 flex items-center justify-between gap-1.5 border-t border-dashed border-outline-variant/10 pt-2 text-[9px]">
                          <span className="text-on-surface-variant/40 font-bold uppercase tracking-wider">Quick Tags:</span>
                          <div className="flex items-center gap-1">
                            {(["Rush", "VIP", "Special"] as const).map((tag) => {
                              const isActive = (orderTags[order.id] || []).includes(tag);
                              const icons = { Rush: "⚡", VIP: "⭐", Special: "📝" };
                              return (
                                <button
                                  key={tag}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleOrderTag(order.id, tag);
                                  }}
                                  title={`Toggle ${tag}`}
                                  className={cn(
                                    "px-1.5 py-0.5 rounded-md font-bold transition-all cursor-pointer select-none text-[8px]",
                                    isActive
                                      ? tag === "Rush"
                                        ? "bg-rose-500 text-white"
                                        : tag === "VIP"
                                          ? "bg-amber-500 text-white"
                                          : "bg-teal-500 text-white"
                                      : "bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500 hover:text-stone-600"
                                  )}
                                >
                                  {icons[tag]} {tag === "Special" ? "Spec" : tag}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                  {displayedOrders.filter(o => o.status === "ready").length === 0 && (
                    <div className="text-center py-8 text-xs text-on-surface-variant/50 font-bold">None ready</div>
                  )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Column 4: Picked Up / Completed */}
              <div className="bg-surface-container-low/60 rounded-[2.5rem] p-5 border border-outline-variant/10 flex flex-col gap-4 min-h-[500px] w-[85vw] md:w-[360px] xl:w-[400px] shrink-0 snap-center">
                <div className="flex items-center justify-between px-2 pb-2 border-b border-outline-variant/10">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-zinc-400" />
                    <h3 className="font-headline font-black text-xs uppercase tracking-wider text-on-surface">Fulfilled</h3>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-zinc-500/10 text-zinc-600 font-bold text-[10px]">
                    {fulfilledOrdersToday.length}
                  </span>
                </div>

                <div className="flex flex-col gap-3 overflow-y-auto max-h-[45vh] xl:max-h-[65vh] pr-1 scroll-smooth [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-on-surface/15 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-on-surface/30">
                  <AnimatePresence mode="popLayout">
                  {fulfilledOrdersToday.map((order) => {
                    const items = safeGetOrderItems(order.items);
                    return (
                      <motion.div
                        layoutId={order.id}
                        key={order.id}
                        className="order-card bg-white dark:bg-zinc-900 border border-outline-variant/10 rounded-2xl p-4 shadow-xs relative overflow-hidden group opacity-75"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <span className="text-[10px] font-mono font-black text-primary uppercase">
                              #{order.id.slice(-4).toUpperCase()}
                            </span>
                            <h4 className="font-bold text-sm text-on-surface mt-0.5">{order.customer_name}</h4>
                            {/* Custom Tags display */}
                            <div className="flex flex-wrap gap-1 mt-1">
                              {getOrderTags(order).map((tag) => {
                                const colors: Record<string, string> = {
                                  "Rush": "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
                                  "VIP": "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                                  "Large Order": "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
                                  "Special": "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
                                };
                                return (
                                  <span
                                    key={tag}
                                    className={cn(
                                      "px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-md border whitespace-nowrap",
                                      colors[tag] || "bg-zinc-100 text-zinc-600 border-zinc-200"
                                    )}
                                  >
                                    {tag === "Rush" && "⚡ "}{tag === "VIP" && "⭐ "}{tag === "Large Order" && "📦 "}{tag}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                          <span className={cn(
                            "text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-md",
                            order.status === "completed" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                          )}>
                            {order.status}
                          </span>
                        </div>

                        {/* Items list */}
                        <div className="mt-3 text-xs text-on-surface-variant space-y-1 font-medium bg-surface-container-lowest p-2 rounded-xl border border-outline-variant/5">
                          {items.map((item, idx) => {
                            const isObj = typeof item === "object" && item !== null;
                            const name = isObj ? ((item as unknown) as Record<string, unknown>).name as string : String(item);
                            const qty = isObj ? ((item as unknown) as Record<string, unknown>).quantity as number : 1;
                            const price = isObj ? ((item as unknown) as Record<string, unknown>).price as number : 0;
                            return (
                              <div key={idx} className="flex justify-between">
                                <span className="truncate max-w-[150px]">{qty}x {name}</span>
                                <span className="opacity-70 font-mono">R {Number(price || 0).toFixed(2)}</span>
                              </div>
                            );
                          })}
                        </div>

                        <div className="mt-3 pt-3 border-t border-outline-variant/5 flex items-center justify-between">
                          <span className="font-mono font-black text-xs text-primary">R {Number(order.total_price || 0).toFixed(2)}</span>
                          <span className="text-[9px] font-bold text-zinc-500 font-mono uppercase">Done</span>
                        </div>

                        {/* Quick Tag Toggles */}
                        <div className="mt-2.5 flex items-center justify-between gap-1.5 border-t border-dashed border-outline-variant/10 pt-2 text-[9px]">
                          <span className="text-on-surface-variant/40 font-bold uppercase tracking-wider">Quick Tags:</span>
                          <div className="flex items-center gap-1">
                            {(["Rush", "VIP", "Special"] as const).map((tag) => {
                              const isActive = (orderTags[order.id] || []).includes(tag);
                              const icons = { Rush: "⚡", VIP: "⭐", Special: "📝" };
                              return (
                                <button
                                  key={tag}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleOrderTag(order.id, tag);
                                  }}
                                  title={`Toggle ${tag}`}
                                  className={cn(
                                    "px-1.5 py-0.5 rounded-md font-bold transition-all cursor-pointer select-none text-[8px]",
                                    isActive
                                      ? tag === "Rush"
                                        ? "bg-rose-500 text-white"
                                        : tag === "VIP"
                                          ? "bg-amber-500 text-white"
                                          : "bg-teal-500 text-white"
                                      : "bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500 hover:text-stone-600"
                                  )}
                                >
                                  {icons[tag]} {tag === "Special" ? "Spec" : tag}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                  {fulfilledOrdersToday.length === 0 && (
                    <div className="text-center py-8 text-xs text-on-surface-variant/50 font-bold">None fulfilled today</div>
                  )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          ) : (
            <>
              {viewMode === "active" && selectedPendingOrders.length > 0 && (
                <div className="flex justify-end mb-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const ordersToPrint = paginatedOrders.filter((o) => selectedPendingOrders.includes(o.id));
                      handleBulkPrint(ordersToPrint, printingFormat, printingIncludeAddr);
                      setSelectedPendingOrders([]);
                    }}
                    className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs rounded-full transition-colors flex items-center gap-2"
                  >
                    <Printer size={14} /> Print Selected ({selectedPendingOrders.length})
                  </button>
                </div>
              )}
              <div
                className={cn(
                  "grid gap-4 sm:gap-6 w-full min-w-0",
                  kitchenMode
                    ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
                    : "grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3"
                )}
              >
                <AnimatePresence mode="popLayout">
                  {paginatedOrders.map((order, i) => renderOrderCard(order, i))}
                </AnimatePresence>
              </div>
            <Pagination
              currentPage={ordersPage}
              totalPages={totalOrdersPages}
              onPageChange={setOrdersPage}
            />
          </>
          )}
        </div>

        {!kitchenMode && (
          <div className="lg:col-span-4 space-y-8">
            <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-3xl p-6 shadow-sm">
              <h4 className="font-headline text-base font-bold text-on-surface mb-6 flex items-center gap-2">
                <Bell size={18} className="text-primary" />
                Notification Settings
              </h4>
              <div className="space-y-4">
                <div className="flex flex-col gap-2 p-4 bg-surface-container-low rounded-2xl">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold">Sound Alerts</span>
                      <span className="text-[10px] text-on-surface-variant">
                        Play sound for new orders
                      </span>
                    </div>
                                  <button
                onClick={() => toast.info("Notification Center coming soon.")}
                className="p-2 text-on-surface-variant hover:text-primary transition-colors relative"
                title="Notification Center"
              >
                <Inbox size={18} className="md:w-5 md:h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full border border-white"></span>
              </button>
              <button
                onClick={() => setSoundAlerts(!soundAlerts)}
                      className={cn(
                        "w-12 h-6 rounded-full relative transition-all duration-300",
                        soundAlerts
                          ? "bg-primary"
                          : "bg-surface-container-highest",
                      )}
                    >
                      <div
                        className={cn(
                          "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300",
                          soundAlerts ? "right-1" : "left-1",
                        )}
                      ></div>
                    </button>
                  </div>
                  {soundAlerts && (
                    <button
                      onClick={() => {
                        try {
                          const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
                          if (AudioCtx) {
                            const ctx = new AudioCtx();
                            const osc = ctx.createOscillator();
                            const gain = ctx.createGain();
                            osc.connect(gain);
                            gain.connect(ctx.destination);
                            osc.type = "sine";
                            osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5 chime
                            gain.gain.setValueAtTime(0.08, ctx.currentTime);
                            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
                            osc.start();
                            osc.stop(ctx.currentTime + 0.5);
                            toast.success("Sound test: Speaker alerts are active!");
                          } else {
                            toast.info("Web Audio API not supported in this browser.");
                          }
                        } catch (err) {
                          console.error("Audio trigger failed: ", err);
                        }
                      }}
                      className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 bg-primary/5 hover:bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wider rounded-lg border border-primary/10 transition-all active:scale-[0.98]"
                    >
                      <Volume2 size={12} className="animate-pulse" />
                      Test Alert Speaker
                    </button>
                  )}
                </div>

                <div className="p-4 bg-surface-container-low rounded-2xl space-y-3">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold">Order Limit</span>
                    <span className="text-[10px] text-on-surface-variant">
                      Max concurrent active orders
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="1"
                      max="50"
                      value={maxConcurrentOrders}
                      onChange={(e) =>
                        setMaxConcurrentOrders(Number(e.target.value))
                      }
                      className="flex-1 accent-primary"
                    />
                    <span className="bg-primary/10 text-primary px-3 py-1 rounded-lg text-sm font-bold min-w-[3rem] text-center">
                      {maxConcurrentOrders}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-surface-container-high rounded-3xl p-8 relative overflow-hidden">
              <div className="relative z-10">
                <h4 className="font-headline text-lg font-bold text-on-surface mb-6">
                  Status Overview
                </h4>
                <div className="space-y-5">
                  {[
                    {
                      label: "New Orders",
                      count: orders.filter((o) => o.status === "pending")
                        .length,
                      color: "bg-primary-fixed",
                    },
                    {
                      label: "Preparing",
                      count: orders.filter((o) => o.status === "preparing")
                        .length,
                      color: "bg-primary",
                    },
                    {
                      label: "Ready for Pickup",
                      count: orders.filter((o) => o.status === "ready").length,
                      color: "bg-tertiary",
                    },
                    {
                      label: "Completed",
                      count: orders.filter((o) => o.status === "completed")
                        .length,
                      color: "bg-secondary",
                    },
                    {
                      label: "Cancelled",
                      count: orders.filter((o) => o.status === "cancelled")
                        .length,
                      color: "bg-error",
                    },
                  ].map((stat, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn("w-1.5 h-1.5 rounded-full", stat.color)}
                        ></div>
                        <span className="text-sm font-semibold text-on-surface-variant">
                          {stat.label}
                        </span>
                      </div>
                      <span className="font-headline font-bold">
                        {stat.count}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-8 pt-8 border-t border-on-surface/5">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                    Avg. Prep Time
                  </div>
                  <div className="text-3xl font-headline font-extrabold text-primary">
                    {avgPrepTime} min
                  </div>
                  <div className="text-xs text-on-surface-variant mt-1">
                    Based on current load
                  </div>
                </div>
              </div>
              <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-primary/5 rounded-full blur-3xl"></div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-3xl p-6">
              <h4 className="font-headline text-base font-bold text-on-surface mb-4">
                Kitchen Hub
              </h4>
              <div className="space-y-3">
                <button
                  onClick={() => {
                    setAlertsEnabled(!alertsEnabled);
                    toast.success(
                      `Order alerts ${!alertsEnabled ? "enabled" : "disabled"}`,
                    );
                  }}
                  className="w-full flex items-center justify-between p-4 bg-surface-container-low rounded-2xl hover:bg-surface-container-high transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <Bell
                      size={20}
                      className={
                        alertsEnabled
                          ? "text-primary"
                          : "text-on-surface-variant/40"
                      }
                    />
                    <span className="text-sm font-bold">New Order Alerts</span>
                  </div>
                  <div
                    className={cn(
                      "w-10 h-6 rounded-full relative transition-colors",
                      alertsEnabled
                        ? "bg-primary"
                        : "bg-surface-container-highest",
                    )}
                  >
                    <div
                      className={cn(
                        "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                        alertsEnabled ? "right-1" : "left-1",
                      )}
                    ></div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setOrdersPaused(!ordersPaused);
                    toast.warning(
                      `Kitchen is now ${!ordersPaused ? "PAUSED" : "ACTIVE"}`,
                    );
                  }}
                  className="w-full flex items-center justify-between p-4 bg-surface-container-low rounded-2xl hover:bg-surface-container-high transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <PauseCircle
                      size={20}
                      className={
                        ordersPaused ? "text-error" : "text-on-surface-variant"
                      }
                    />
                    <span className="text-sm font-bold">
                      {ordersPaused ? "Resume Orders" : "Pause New Orders"}
                    </span>
                  </div>
                  <ChevronRight
                    size={20}
                    className={cn(
                      "text-on-surface-variant transition-transform",
                      ordersPaused && "rotate-90",
                    )}
                  />
                </button>
                <button
                  onClick={() => console.log("Opening printer settings...")}
                  className="w-full flex items-center justify-between p-4 bg-surface-container-low rounded-2xl hover:bg-surface-container-high transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Printer size={20} className="text-on-surface-variant" />
                    <span className="text-sm font-bold">Printer Settings</span>
                  </div>
                  <span className="text-xs font-bold text-tertiary">
                    Online
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cancellation reasons Modal */}
        <AnimatePresence>
          {cancellingOrder && (
            <motion.div key="cancellingOrder-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="bg-surface-container-lowest max-w-lg w-full rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden border border-outline-variant/15"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2 text-error">
                    <AlertCircle size={24} />
                    <h3 className="font-headline text-lg font-bold text-on-surface">Cancel Order #LE-{cancellingOrder.id}</h3>
                  </div>
                  <button
                    onClick={() => setCancellingOrder(null)}
                    className="p-1.5 hover:bg-surface-container-high rounded-full text-on-surface-variant transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>

                <p className="text-xs text-on-surface-variant mb-4">
                  Please select a reason for cancelling this order. This message will be sent directly to the customer so they are kept informed.
                </p>

                <div className="space-y-2 mb-6">
                  {[
                    "Out of ingredients / Items unavailable",
                    "Kitchen is overloaded / Queue times are too high",
                    "Rider/Delivery team unavailable or radius is too far",
                    "Shop is closing / After business hours",
                    "Incorrect customer details (address or phone number)",
                    "Other (Write custom message below)"
                  ].map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => {
                        setCancelReasonPreset(reason);
                        if (reason !== "Other (Write custom message below)") {
                          setCustomCancelExplanation(`We are sorry, but we had to cancel your order because: ${reason.toLowerCase()}`);
                        } else {
                          setCustomCancelExplanation("");
                        }
                      }}
                      className={cn(
                        "w-full text-left p-3 text-xs font-semibold rounded-xl border-2 transition-all flex items-center justify-between",
                        cancelReasonPreset === reason
                          ? "bg-error/5 border-error/50 text-error-container"
                          : "bg-surface-container-low border-transparent text-on-surface-variant hover:border-outline-variant/20"
                      )}
                    >
                      <span>{reason}</span>
                      <div className={cn(
                        "w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ml-3",
                        cancelReasonPreset === reason ? "border-error bg-error text-white" : "border-outline"
                      )}>
                        {cancelReasonPreset === reason && <Check size={10} strokeWidth={3} />}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5 mb-6">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/70">
                    Custom Notification Explanation
                  </label>
                  <textarea
                    rows={3}
                    value={customCancelExplanation}
                    onChange={(e) => setCustomCancelExplanation(e.target.value)}
                    className="w-full bg-surface-container-low focus:bg-surface-container-lowest border border-outline-variant/30 focus:border-error/45 focus:ring-1 focus:ring-error/20 rounded-xl p-3 text-xs outline-none transition-all resize-none text-on-surface"
                    placeholder="Tell the customer more about why their order was rejected..."
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setCancellingOrder(null)}
                    className="flex-1 py-3 bg-surface-container-high hover:bg-surface-container-highest text-on-surface hover:text-on-surface-variant font-bold rounded-full text-xs transition-all active:scale-[0.98]"
                  >
                    Keep Order Active
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const finalReason = cancelReasonPreset === "Other (Write custom message below)"
                        ? (customCancelExplanation.trim() || "Order cancelled by kitchen supervisor.")
                        : customCancelExplanation;
                      void onUpdateStatus(cancellingOrder.id, "cancelled", finalReason);
                      setCancellingOrder(null);
                      toast.success("Order status updated to Cancelled");
                    }}
                    className="flex-1 py-3 bg-error text-white font-black rounded-full text-xs hover:bg-error-container hover:shadow-lg shadow-error/10 transition-all active:scale-[0.98]"
                  >
                    Confirm Cancellation
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pop-up Free Thermal Printed Receipt Live Mockup Modal */}
        <AnimatePresence>
          {printingOrder && (
            <motion.div key="printingOrder-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-surface-container-lowest max-w-2xl w-full rounded-3xl p-6 md:p-8 shadow-2xl relative border border-outline-variant/15 grid grid-cols-1 md:grid-cols-12 gap-6 items-start text-on-surface"
              >
                {/* Receipt controller pane */}
                <div className="md:col-span-12 lg:col-span-5 space-y-5">
                  <div>
                    <h3 className="font-headline text-lg font-bold text-on-surface mb-1 flex items-center gap-2">
                      <Printer size={20} className="text-primary" />
                      Kitchen Ticket
                    </h3>
                    <p className="text-xs text-on-surface-variant">
                      Configured with advanced standard widths to support standard POS thermal paper roles.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/80 block">
                        Thermal Width Format
                      </label>
                      <div className="grid grid-cols-2 gap-2 bg-surface-container-low p-1.5 rounded-xl border border-outline-variant/10">
                        {(["80mm", "58mm"] as const).map((fmt) => (
                          <button
                            key={fmt}
                            type="button"
                            onClick={() => setPrintingFormat(fmt)}
                            className={cn(
                              "py-1.5 text-xs font-bold rounded-lg transition-all",
                              printingFormat === fmt
                                ? "bg-primary text-white shadow-sm"
                                : "text-on-surface-variant hover:bg-surface-container-highest"
                            )}
                          >
                            {fmt === "80mm" ? "80mm (Wide)" : "58mm (Narrow)"}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/80 block">
                        Options & Fields
                      </label>
                      <button
                        type="button"
                        onClick={() => setPrintingIncludeAddr(!printingIncludeAddr)}
                        className="w-full flex items-center justify-between p-3 bg-surface-container-low hover:bg-surface-container-high rounded-xl text-left transition-all text-xs"
                      >
                        <span className="font-bold text-on-surface">Include Customer Address</span>
                        <div className={cn(
                          "w-4 h-4 rounded-sm border flex items-center justify-center shrink-0",
                          printingIncludeAddr ? "border-primary bg-primary text-on-primary" : "border-outline"
                        )}>
                          {printingIncludeAddr && <Check size={12} strokeWidth={3} />}
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    {/* Printer Diagnostic Check */}
                    <div className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/15 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant flex items-center gap-1">
                          <Activity size={12} className="text-primary" /> Connectivity Diagnostic
                        </span>
                        <button
                          type="button"
                          onClick={async () => {
                            const bt = await checkPrinterConnectivity("bluetooth");
                            const usb = await checkPrinterConnectivity("usb");
                            setPrinterDiagStatus({ bt, usb });
                            toast.info(`Diagnostic complete: BT (${bt.statusText}), USB (${usb.statusText})`);
                          }}
                          className="text-[9px] font-extrabold text-primary hover:underline cursor-pointer"
                        >
                          Verify Hardware
                        </button>
                      </div>
                      {printerDiagStatus ? (
                        <div className="text-[10px] space-y-0.5 text-on-surface-variant font-mono">
                          <p className="flex items-center gap-1.5">
                            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", printerDiagStatus.bt.connected ? "bg-emerald-500" : "bg-amber-500")} />
                            BT: {printerDiagStatus.bt.statusText}
                          </p>
                          <p className="flex items-center gap-1.5">
                            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", printerDiagStatus.usb.connected ? "bg-emerald-500" : "bg-amber-500")} />
                            USB: {printerDiagStatus.usb.statusText}
                          </p>
                        </div>
                      ) : (
                        <p className="text-[9px] text-on-surface-variant/80 italic">
                          Pre-flight check verifies POS printer connectivity before printing bytes.
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={printingHardwareLoading}
                        onClick={() => printingOrder && handlePrintBluetoothDirect?.(printingOrder)}
                        className="py-3 px-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Wifi size={14} />
                        Bluetooth POS
                      </button>
                      <button
                        type="button"
                        disabled={printingHardwareLoading}
                        onClick={() => printingOrder && handlePrintUSBDirect?.(printingOrder)}
                        className="py-3 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Database size={14} />
                        USB POS
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleIframePrint(printingOrder, printingFormat, printingIncludeAddr)}
                      className="w-full py-2.5 bg-primary text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-md shadow-primary/20 hover:scale-[1.02] transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Printer size={15} />
                      Standard System Print
                    </button>
                    <button
                      type="button"
                      onClick={() => copyReceiptToClipboard(printingOrder)}
                      className="w-full py-2.5 bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant font-bold text-xs uppercase tracking-widest rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 border border-outline-variant/15 cursor-pointer"
                    >
                      <Copy size={15} />
                      Copy Plain-Text Receipt
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrintingOrder(null)}
                      className="w-full py-2.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-bold text-xs uppercase tracking-widest rounded-xl transition-all active:scale-[0.98] cursor-pointer"
                    >
                      Close Preview
                    </button>

                    {/* Offline Fail Queue Panel */}
                    <div className="border border-outline-variant/20 rounded-2xl p-4 bg-surface-container-low/50 space-y-3 mt-4">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">
                          Offline Print Queue ({failedPrints.length})
                        </span>
                        {failedPrints.length > 0 && (
                          <button
                            type="button"
                            onClick={() => clearPrintQueue?.()}
                            className="text-[9px] text-red-500 hover:underline font-bold cursor-pointer"
                          >
                            Clear Queue
                          </button>
                        )}
                      </div>

                      {failedPrints.length === 0 ? (
                        <p className="text-[10px] text-zinc-500 italic">No failed print jobs queued.</p>
                      ) : (
                        <div className="max-h-[140px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                          {failedPrints.map((job) => (
                            <div key={job.id} className="p-2.5 bg-white dark:bg-zinc-900 border border-outline-variant/15 rounded-xl flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-[10px] font-black truncate text-on-surface">
                                  #{job.orderId.slice(0, 8).toUpperCase()} - {job.customerName}
                                </p>
                                <p className="text-[8px] text-on-surface-variant">
                                  {new Date(job.createdAt).toLocaleTimeString()}
                                </p>
                              </div>
                              <button
                                type="button"
                                disabled={printingHardwareLoading}
                                onClick={() => retryQueuedPrintDirect?.(job.id)}
                                className="px-2 py-1 bg-[#FF5A36] text-white text-[9px] font-black uppercase tracking-wider rounded-lg hover:opacity-90 active:scale-95 disabled:opacity-50 transition-all shrink-0 cursor-pointer"
                              >
                                Retry
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Receipt preview pane */}
                <div className="md:col-span-12 lg:col-span-7 flex flex-col items-center bg-stone-950 border border-stone-800 rounded-2xl p-4 gap-3 self-stretch min-w-[260px]">
                  <span className="text-[9px] font-black tracking-widest text-white/40 uppercase">
                    Hardware Virtualizer Mockup
                  </span>

                  {/* Visual Thermal paper preview */}
                  <div 
                    className={cn(
                      "bg-[#fafaf8] text-stone-900 p-6 font-mono text-xs shadow-2xl relative border-t-4 border-b-4 border-dashed border-stone-300 leading-relaxed font-semibold transition-all duration-300 mx-auto w-full",
                      printingFormat === "58mm" ? "max-w-[220px] text-[10px]" : "max-w-[280px] text-xs"
                    )}
                    style={{
                      boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
                      backgroundImage: "radial-gradient(#ebeae4 10%, transparent 11%)",
                      backgroundSize: "6px 6px"
                    }}
                  >
                    {/* Decorative side gaps of paper */}
                    <div className="absolute top-0 bottom-0 left-0 w-1 bg-stone-200/20 shadow-inner"></div>
                    <div className="absolute top-0 bottom-0 right-0 w-1 bg-stone-200/20 shadow-inner"></div>

                    <div className="text-center font-bold mb-4">
                      <h4 className="text-sm font-extrabold tracking-wider uppercase m-0 leading-tight">LOCALEATS</h4>
                      <p className="text-[9px] text-stone-500 m-1">EATS WITH LOCAL ROOTS</p>
                      <div className="border-b border-dashed border-stone-400 my-2"></div>
                      <p className="m-1">Order #LE-{printingOrder.id}</p>
                      <p className="m-1 text-[10px] text-stone-500 m-1 font-medium">{new Date(printingOrder.created_at).toLocaleString()}</p>
                      <p className="m-1 uppercase font-extrabold text-[10px] bg-stone-200 rounded px-1.5 py-0.5 inline-block mt-1">Fulfillment: {!isOrderDelivery(printingOrder) ? "Collection" : "Delivery"}</p>
                    </div>

                    <div className="space-y-2 my-4">
                      {(printingOrder.items || []).length > 0 ? (
                        (printingOrder.items || []).map((item: unknown, idx: number) => {
                          const isObj = typeof item === "object" && item !== null;
                          const typedItem = item as Record<string, unknown>;
                          const p = isObj && "price" in typedItem ? Number(typedItem.price) || 0 : (Number(printingOrder.total_price) || 0);
                          const q = isObj && "quantity" in typedItem ? Number(typedItem.quantity) || 1 : 1;
                          const n = isObj && "name" in typedItem ? String(typedItem.name) : String(item);
                          return (
                            <div key={idx} className="flex justify-between items-start gap-2">
                              <span>{q}x {n}</span>
                              <span className="shrink-0">R{(p * q).toFixed(2)}</span>
                            </div>
                          );
                        })
                      ) : (
                        <div className="flex justify-between items-start">
                          <span>1x {printingOrder.product_name}</span>
                          <span className="shrink-0">R{Number(printingOrder.total_price || 0).toFixed(2)}</span>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-dashed border-stone-400 pt-2 my-2 mt-4 font-bold">
                      <div className="flex justify-between text-sm">
                        <span>GRAND TOTAL</span>
                        <span>R{Number(printingOrder.total_price || 0).toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="text-center text-[10px] mt-6 border-t border-dashed border-stone-400 pt-3 space-y-1">
                      <p className="m-0 font-bold">Customer: {printingOrder.customer_name || "Guest"}</p>
                      {printingOrder.phone && <p className="m-0">Tel: {printingOrder.phone}</p>}
                      {printingIncludeAddr && printingOrder.address && (
                        <p className="m-0 italic leading-snug font-medium text-stone-600">Addr: {printingOrder.address}, {printingOrder.city}</p>
                      )}
                      {printingOrder.notes && (
                        <p className="m-1 mt-2 text-left bg-stone-100 p-2 border border-stone-200 rounded text-stone-700 italic leading-normal">
                          Notes: "{printingOrder.notes}"
                        </p>
                      )}
                      <p className="m-0 font-extrabold text-[10px] text-stone-500 tracking-wider pt-2 border-t border-dotted border-stone-300">*** THANK YOU ***</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {acceptingOrderId && (() => {
            const orderToAccept = orders.find(o => o.id === acceptingOrderId);
            if (!orderToAccept) return null;
            const items = safeGetOrderItems(orderToAccept.items);

            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="bg-surface-container-lowest dark:bg-zinc-900 rounded-[2rem] w-full max-w-xl overflow-hidden border border-outline-variant/10 shadow-2xl flex flex-col max-h-[90vh]"
                >
                  {/* Modal Header */}
                  <div className="p-6 border-b border-outline-variant/10 flex justify-between items-center bg-primary/[0.02]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <UtensilsCrossed size={20} className="animate-pulse" />
                      </div>
                      <div>
                        <h3 className="font-headline font-black text-sm uppercase tracking-wider text-on-surface">Accept Order for Kitchen</h3>
                        <p className="text-[10px] text-on-surface-variant font-bold uppercase mt-0.5">Order ID: #{orderToAccept.id}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setAcceptingOrderId(null);
                        setOrderNotes("");
                      }}
                      className="w-10 h-10 rounded-full hover:bg-surface-container-high flex items-center justify-center transition-colors text-on-surface-variant cursor-pointer"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  {/* Modal Content */}
                  <div className="p-6 overflow-y-auto space-y-5 flex-1 text-left">
                    {/* Customer Details */}
                    <div className="grid grid-cols-2 gap-4 p-4 bg-surface-container-low rounded-2xl border border-outline-variant/5">
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/60">Customer Name</span>
                        <p className="text-sm font-extrabold text-on-surface mt-0.5">{orderToAccept.customer_name || "Guest "}</p>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/60">Payment Method</span>
                        <p className="text-sm font-extrabold text-on-surface mt-0.5 flex items-center gap-1.5">
                          <CreditCard size={14} className="text-primary" />
                          {orderToAccept.payment_method === "cod" ? "Cash on Arrival" : "Online Paid"}
                        </p>
                      </div>
                    </div>

                    {/* Items List */}
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 block mb-2 text-left">Order Items ({items.length})</span>
                      <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                        {items.map((item, idx) => {
                          const name = typeof item === "string" ? item : item.name;
                          const quantity = typeof item === "string" ? 1 : item.quantity;
                          const price = typeof item === "string" ? 0 : item.price;
                          return (
                            <div key={idx} className="flex justify-between items-center p-3 bg-surface-container-high/40 rounded-xl border border-outline-variant/5">
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 bg-primary/10 text-primary text-[10px] font-black rounded-full flex items-center justify-center">x{quantity}</span>
                                <span className="text-xs font-bold text-on-surface">{name}</span>
                              </div>
                              <span className="text-xs font-black text-on-surface-variant">R {(price * quantity).toFixed(2)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Customer Notes */}
                    {orderToAccept.notes && (
                      <div className="p-3.5 bg-red-500/[0.02] border border-red-500/10 rounded-2xl text-left">
                        <span className="text-[9px] font-black uppercase tracking-widest text-red-600 dark:text-red-400 block mb-1">Customer-Provided Notes</span>
                        <p className="text-xs italic text-on-surface-variant font-medium">"{orderToAccept.notes}"</p>
                      </div>
                    )}

                    {/* Internal Notes (Text Area for Vendors) */}
                    <div className="space-y-1.5 text-left">
                      <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/70 flex items-center gap-1.5">
                        <UtensilsCrossed size={12} className="text-primary" />
                        Internal Notes
                      </span>
                      <textarea
                        value={orderNotes}
                        onChange={(e) => setOrderNotes(e.target.value)}
                        className="w-full px-4 py-3 text-xs bg-surface-container-low border border-outline-variant/15 rounded-xl focus:ring-1 focus:ring-primary outline-none text-on-surface font-semibold placeholder:text-on-surface-variant/40"
                        rows={3}
                        placeholder="e.g. Extra sauce, no onions, pack napkins separately, rush this order..."
                        autoFocus
                      />
                    </div>

                    {/* Customer message */}
                    <div className="space-y-1.5 text-left">
                      <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/70">Customer Notification Receipt Message</span>
                      <input
                        type="text"
                        value={customMessage}
                        onChange={(e) => setCustomMessage(e.target.value)}
                        className="w-full px-4 py-2.5 text-xs bg-surface-container-low border border-outline-variant/15 rounded-xl focus:ring-1 focus:ring-primary outline-none text-on-surface font-semibold placeholder:text-on-surface-variant/40"
                        placeholder="Your order has been accepted and is being prepared with care!"
                      />
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="p-6 border-t border-outline-variant/10 bg-surface-container-low/50 flex gap-3">
                    <button
                      onClick={() => {
                        setAcceptingOrderId(null);
                        setOrderNotes("");
                      }}
                      className="flex-1 py-3 bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer text-center"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        // Save kitchen notes locally
                        if (orderNotes.trim()) {
                          setKitchenNotes(prev => ({
                            ...prev,
                            [orderToAccept.id]: orderNotes.trim()
                          }));
                        }
                        const finalMsg = orderNotes ? `Notes: ${orderNotes} | Msg: ${customMessage}` : customMessage;
                        onUpdateStatus(orderToAccept.id, "preparing", finalMsg);
                        setAcceptingOrderId(null);
                        setOrderNotes("");
                      }}
                      className="flex-1 py-3 bg-primary text-on-primary text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-95 transition-all cursor-pointer text-center"
                    >
                      Accept & Start Preparing
                    </button>
                  </div>
                </motion.div>
              </div>
            );
          })()}
        </AnimatePresence>

        {/* Gated Dispatch - No Linked Rider Warning Modal */}
        <NoLinkedRiderModal
          isOpen={!!unlinkedModalOrder}
          onClose={() => setUnlinkedModalOrder(null)}
          order={unlinkedModalOrder}
          connectedRiders={connectedRiders}
          pairingCode={currentShop?.pairing_code || "LOCAL-EATS-PASS"}
          onDispatchToRider={onDispatchToRider}
          onAcceptOrder={async (orderId) => {
            await onUpdateStatus(orderId, "preparing", "Order accepted & dispatched to rider");
          }}
          onPromptCustomerForPickup={async (orderId) => {
            if (onConvertOrderToPickup) {
              await onConvertOrderToPickup(orderId);
            }
          }}
          onOpenPairingCenter={() => {
            onTabChange("riders");
          }}
        />

        {/* SMS & WhatsApp Dispatch Studio Modal */}
        <DispatchAlertModal
          isOpen={!!dispatchAlertOrder}
          onClose={() => setDispatchAlertOrder(null)}
          order={dispatchAlertOrder}
          riderName={
            connectedRiders.find(
              (r) => r.rider_id === dispatchAlertOrder?.rider_id || String(r.id) === dispatchAlertOrder?.rider_id
            )?.rider_name || dispatchAlertOrder?.rider_phone || "Rider"
          }
          riderPhone={
            connectedRiders.find(
              (r) => r.rider_id === dispatchAlertOrder?.rider_id || String(r.id) === dispatchAlertOrder?.rider_id
            )?.rider_phone || dispatchAlertOrder?.rider_phone || ""
          }
          currentShop={currentShop}
          type={dispatchAlertType}
        />
      </div>
    </div>
  );
};




// --- Subscription Components ---

// --- Main App ---

