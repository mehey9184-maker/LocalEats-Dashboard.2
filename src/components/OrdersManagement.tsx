import {PickupOrderActions} from "./PickupOrderActions";
import {merchantPickupReadCurrent,type MerchantOrderReadState} from "../services/merchantDashboardFreshness";
import {merchantOrderMoney,merchantOrderTotal,merchantReceiptLineAmount,safeOrderExportCsv,recordedDeliveryETA,safeReceiptHtml} from "../services/merchantOrdersTrust";
import {summarizeKitchenQueue,merchantJohannesburgDayKey,merchantOrderHistoryInSastRange,merchantOrderCompletedOnSastDay,merchantJohannesburgClock} from "../services/merchantDashboardLayout";
import {isPickupOrder,pickupPaymentLabel,pickupOrderingEnabled,pickupItemLineTotal} from "../services/merchantPickupPolicy";
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
  Send,
  Bell,
  MapPin,
  Zap,
  Calendar,
  Eye,
  AlertTriangle,
  Volume2,
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
import { Order, Shop, OrderStatus, RiderProfile, RiderConnection } from "../types";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { Pagination } from "./Pagination";
import { useAuthGuard } from "../hooks/useAuthGuard";
import { AddressDisplay } from "./AddressDisplay";
import { Skeleton } from "./ui/Skeleton";
import { OperationFeedback, type OperationFeedbackStatus } from "./ui/OperationFeedback";
import { DispatchAlertModal } from "./DispatchAlertModal";
import { format } from "date-fns";

export const isOrderDelivery = (order: Order): boolean => {
  if(isPickupOrder(order))return false;
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
  ordersReadState?: MerchantOrderReadState;
  ordersVerifiedAt?: number | null;
  onUpdateStatus: (id: string, status: OrderStatus, message?: string) => Promise<void> | void;
  onDispatchToRider?: (id: string, riderId: string, riderName?: string, riderPhone?: string) => Promise<void> | void;
  onConvertOrderToPickup?: (id: string) => Promise<void> | void;
  loading: boolean;
  onRefresh: () => void | Promise<void>;
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

// Chat requires a verified participant-scoped API, not direct browser table access.
const ChatWindow = ({ orderId, onClose }: { orderId: string; onClose: () => void }) => (
  <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl overflow-hidden flex flex-col h-[220px] shadow-xl mt-4">
    <div className="p-4 bg-primary text-on-primary flex justify-between items-center">
      <div className="flex items-center gap-2">
        <MessageCircle size={18} />
        <span className="font-bold text-sm">Customer Chat - #LE-{orderId}</span>
      </div>
      <button type="button" onClick={onClose} aria-label="Close customer chat" className="p-1 hover:bg-white/20 rounded-full"><X size={18} /></button>
    </div>
    <div className="flex-1 p-5 flex flex-col justify-center space-y-2" role="status">
      <p className="text-sm font-bold text-on-surface">In-app chat is unavailable in this Preview.</p>
      <p className="text-xs text-on-surface-variant">Messages cannot yet be read or sent through a verified order-participant API. Use the order's Call or WhatsApp contact options for manual communication. External messages are not tracked here.</p>
    </div>
  </div>
);


export const OrdersManagement: React.FC<OrdersManagementProps> = ({
  orders,
  ordersReadState = "checking",
  ordersVerifiedAt = null,
  onUpdateStatus,
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
  const handleRiderNudge=async(riderId:string,message:string)=>{
    try{
      await sendRiderNudge(riderId,message);
      toast.info("Rider nudge request saved. Device delivery is not confirmed.");
    }catch{
      toast.error("Rider nudge was not confirmed. Please retry from a connected session.");
    }
  };
  const [viewMode, setViewMode] = useState<"active" | "history">("active");
  
  const [printerDiagStatus, setPrinterDiagStatus] = useState<{
    bt: PrinterDiagnosticResult;
    usb: PrinterDiagnosticResult;
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [phoneSearch, setPhoneSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showOrderFilters, setShowOrderFilters] = useState(false);
  const [acceptingOrderId, setAcceptingOrderId] = useState<string | null>(null);
  const [orderNotes, setOrderNotes] = useState(""); // Added for Order Notes
  const [selectedPendingOrders, setSelectedPendingOrders] = useState<string[]>([]); // Added for Bulk Actions
  const [preparingOrderId, setPreparingOrderId] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [readyOrderId, setReadyOrderId] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const inFlightStatusRef = useRef<string | null>(null);
  // The API confirms only the status action, not messages, ETAs, or rider dispatch.
  const confirmOrderStatus = async (
    orderId: string,
    status: OrderStatus,
    onConfirmed?: () => void,
  ): Promise<boolean> => {
    if (inFlightStatusRef.current !== null) return false;
    if (orders.some(order => String(order.id)===String(orderId) && isPickupOrder(order))) {
      toast.error("Use the dedicated customer-collection actions for pickup orders.");
      return false;
    }
    inFlightStatusRef.current = orderId;
    setUpdatingOrderId(orderId);
    try {
      await Promise.resolve(onUpdateStatus(orderId, status));
      onConfirmed?.();
      return true;
    } catch {
      // The parent workflow displays the actual error; retain the form for retry.
      return false;
    } finally {
      inFlightStatusRef.current = null;
      setUpdatingOrderId(null);
    }
  };
  const [chatOrderId, setChatOrderId] = useState<string | null>(null);
  const [showRiderPicker, setShowRiderPicker] = useState<string | null>(null);
  const [connectedRiders, setConnectedRiders] = useState<RiderConnection[]>([]);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const [isRefreshingOrders, setIsRefreshingOrders] = useState(false);
  const [orderRefreshFeedback, setOrderRefreshFeedback] = useState<OperationFeedbackStatus>("idle");
  const [verifiedBeforeRefresh, setVerifiedBeforeRefresh] = useState<number | null>(null);
  const handleRefreshOrders = async () => {
    if (isRefreshingOrders) return;
    setVerifiedBeforeRefresh(ordersVerifiedAt);
    setIsRefreshingOrders(true);
    setOrderRefreshFeedback("loading");
    try {
      await Promise.resolve(onRefresh());
      // Resolving an API read is not proof of freshness: the parent may catch errors.
      setOrderRefreshFeedback("unverified");
    } catch {
      setOrderRefreshFeedback("error");
    } finally {
      setIsRefreshingOrders(false);
    }
  };
  const refreshedOrdersVerified = orderRefreshFeedback === "unverified" &&
    ordersReadState === "confirmed" && ordersVerifiedAt !== null &&
    (verifiedBeforeRefresh === null || ordersVerifiedAt > verifiedBeforeRefresh);
  const orderRefreshStatus: OperationFeedbackStatus = refreshedOrdersVerified ? "success" : orderRefreshFeedback;
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
    if (isPickupOrder(order)) return <PickupOrderActions order={order} mode="summary"/>;
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
          <button disabled={isPickupOrder(order)}
            onClick={(e) => {
              e.stopPropagation();
              onTabChange("riders");
            }}
            className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-white text-[8px] font-black uppercase rounded-lg transition-transform active:scale-95 flex items-center gap-0.5 cursor-pointer shrink-0 shadow-xs"
          >
            <Rocket size={10} />
            <span>Riders</span>
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
              void handleRiderNudge(order.rider_id, "Order update: Please check your active delivery mission!");
            } else {
              toast.error("No rider assigned to nudge");
            }
          }}
          className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-[8px] font-black uppercase tracking-wider rounded-lg transition-transform flex items-center gap-0.5 cursor-pointer shrink-0 shadow-xs"
          title="Request a rider nudge; device delivery is not guaranteed"
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
  // No rider profile/location reads for shops serving only customer collection.
  const hasDeliveryOrders = orders.some((order) => isOrderDelivery(order));

  useEffect(() => {
    if (currentShopId && hasDeliveryOrders) {
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
  }, [currentShopId, currentShopPhone, hasDeliveryOrders, subscribeWithAuthGuard]);

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
        toast.error("Browser printing is unavailable. You can copy the receipt text instead.");
        copyReceiptToClipboard(order);
        return;
      }

      const formattedItems = safeGetOrderItems(order.items)
        .map((i) => {
          const isObj = typeof i === "object" && i !== null;
          const p = isObj && "price" in i ? (i as { price?: unknown }).price : null;
          const q = isObj && "quantity" in i ? (i as { quantity?: unknown }).quantity : 1;
          const n = isObj && "name" in i ? (i as { name: string }).name : String(i);
          return `
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span>${safeReceiptHtml(q)}x ${safeReceiptHtml(n)}</span>
              <span>${safeReceiptHtml(merchantReceiptLineAmount(p, q))}</span>
            </div>
          `;
        })
        .join("") ||
        `<div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>1x ${safeReceiptHtml(order.product_name)}</span><span>Amount unavailable</span></div>`;

      const widthOfText = formatOption === "58mm" ? "54mm" : "76mm";
      const printingPageSize = formatOption === "58mm" ? "58mm auto" : "80mm auto";

      doc.write(`
        <html>
          <head>
            <title>Receipt #LE-${safeReceiptHtml(order.id)}</title>
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
              <p style="margin: 4px 0 2px 0;">Order ID: #LE-${safeReceiptHtml(order.id)}</p>
              <p style="margin: 2px 0;">${new Date(order.created_at).toLocaleString()}</p>
              <p style="margin: 2px 0; font-weight: bold; text-transform: uppercase;">Fulfillment: ${!isOrderDelivery(order) ? "COLLECTION" : "DELIVERY"}</p>
            </div>
            <div class="items">
              ${formattedItems}
            </div>
            <div class="total">
              <div style="display: flex; justify-content: space-between;">
                <span>GRAND TOTAL</span>
                <span>${safeReceiptHtml(merchantOrderMoney(order.total_price))}</span>
              </div>
            </div>
            <div class="footer">
              <p style="margin: 2px 0; font-weight: bold;">Customer: ${safeReceiptHtml(order.customer_name || "Guest")}</p>
              ${order.phone ? `<p style="margin: 2px 0;">Phone: ${safeReceiptHtml(order.phone)}</p>` : ""}
              ${includeAddress && order.address ? `<p style="margin: 3px 0; font-style: italic;">Addr: ${safeReceiptHtml(order.address)}, ${safeReceiptHtml(order.city)}</p>` : ""}
              ${order.notes ? `<p style="margin: 5px 0; font-style: italic; background: #f2f2f2; padding: 6px; border-radius: 4px;">Notes: "${safeReceiptHtml(order.notes)}"</p>` : ""}
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
        toast.error("Browser printing is unavailable.");
        return;
      }

      const widthOfText = formatOption === "58mm" ? "54mm" : "76mm";
      const printingPageSize = formatOption === "58mm" ? "58mm auto" : "80mm auto";

      const allReceiptsHTML = ordersToPrint.map((order) => {
        const formattedItems = safeGetOrderItems(order.items)
          .map((i) => {
            const isObj = typeof i === "object" && i !== null;
            const p = isObj && "price" in i ? (i as { price?: unknown }).price : null;
            const q = isObj && "quantity" in i ? (i as { quantity?: unknown }).quantity : 1;
            const n = isObj && "name" in i ? (i as { name: string }).name : String(i);
            return `
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span>${safeReceiptHtml(q)}x ${safeReceiptHtml(n)}</span>
                <span>${safeReceiptHtml(merchantReceiptLineAmount(p, q))}</span>
              </div>
            `;
          })
          .join("") ||
          `<div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>1x ${safeReceiptHtml(order.product_name)}</span><span>Amount unavailable</span></div>`;

        return `
          <div class="receipt">
            <div class="header">
              <h3 style="margin: 0 0 4px 0; text-transform: uppercase; font-size: 16px; letter-spacing: 1px;">LOCALEATS</h3>
              <p style="margin: 2px 0; font-size: 11px;">EATS WITH LOCAL ROOTS</p>
              <p style="margin: 4px 0 2px 0;">Order ID: #LE-${safeReceiptHtml(order.id)}</p>
              <p style="margin: 2px 0;">${new Date(order.created_at).toLocaleString()}</p>
              <p style="margin: 2px 0; font-weight: bold; text-transform: uppercase;">Fulfillment: ${!isOrderDelivery(order) ? "COLLECTION" : "DELIVERY"}</p>
            </div>

            <div class="items">
              ${formattedItems}
            </div>

            <div class="total">
              <div style="display: flex; justify-content: space-between;">
                <span>GRAND TOTAL</span>
                <span>${safeReceiptHtml(merchantOrderMoney(order.total_price))}</span>
              </div>
            </div>

            <div class="footer">
              <p style="margin: 2px 0; font-weight: bold;">Customer: ${safeReceiptHtml(order.customer_name || "Guest")}</p>
              ${order.phone ? `<p style="margin: 2px 0;">Phone: ${safeReceiptHtml(order.phone)}</p>` : ""}
              ${includeAddress && order.address ? `<p style="margin: 3px 0; font-style: italic;">Addr: ${safeReceiptHtml(order.address)}, ${safeReceiptHtml(order.city)}</p>` : ""}
              ${order.notes ? `<p style="margin: 5px 0; font-style: italic; background: #f2f2f2; padding: 6px; border-radius: 4px;">Notes: "${safeReceiptHtml(order.notes)}"</p>` : ""}
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
      .map((item) => {
        const entry = typeof item === "object" && item !== null
          ? item as { name?: unknown; price?: unknown; quantity?: unknown }
          : null;
        const name = String(entry?.name ?? item);
        const quantity = Number(entry?.quantity ?? 1);
        const price = entry?.price == null ? NaN : Number(entry.price);
        const validQuantity = Number.isFinite(quantity) && quantity > 0;
        const lineTotal = validQuantity && Number.isFinite(price) && price >= 0
          ? merchantOrderMoney(price * quantity)
          : "Amount unavailable";
        return `${validQuantity ? quantity : "?"}x ${name} ${lineTotal}`;
      })
      .join("\n") || `1x ${order.product_name} ${merchantOrderMoney(order.total_price)}`;

    const textReceipt = `
========================================
           LOCALEATS ORDER
Order ID: #LE-${order.id}
Date: ${new Date(order.created_at).toLocaleString()}
Type: ${!isOrderDelivery(order) ? "COLLECTION" : "DELIVERY"}
----------------------------------------
${itemsText}
----------------------------------------
TOTAL: ${merchantOrderMoney(order.total_price)}
========================================
Customer: ${order.customer_name || "Guest"}
Phone: ${order.phone || "N/A"}
Address: ${order.address || ""}, ${order.city || ""}
Notes: "${order.notes || "None"}"
========================================
    `.trim();

    navigator.clipboard.writeText(textReceipt)
      .then(() => toast.success("Receipt copied as plain text."))
      .catch(() => toast.error("Failed to copy receipt to clipboard"));
  };

  // Do not invent GPS tracking or travel-time estimates from an assumed speed.
  const calculateDynamicETA=(order:Order)=>recordedDeliveryETA(order.estimated_delivery_time);

  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [expandedNotesOrderIds, setExpandedNotesOrderIds] = useState<Record<string, boolean>>({});
  // Device-only notes must never bleed between shops on a shared browser.
  const kitchenNotesShopId = currentShop?.id == null ? "" : String(currentShop.id);
  const [scopedKitchenNotes, setScopedKitchenNotes] = useState<{
    shopId: string;
    notes: Record<string, string>;
  }>({shopId: "", notes: {}});
  const kitchenNotes = scopedKitchenNotes.shopId === kitchenNotesShopId
    ? scopedKitchenNotes.notes : {};
  useEffect(() => {
    if (!kitchenNotesShopId) {
      setScopedKitchenNotes({shopId: "", notes: {}});
      return;
    }
    let notes: Record<string, string> = {};
    try {
      const saved = localStorage.getItem(`le_kitchen_notes_shop_${kitchenNotesShopId}`);
      const parsed: unknown = saved ? JSON.parse(saved) : {};
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        notes = Object.fromEntries(Object.entries(parsed).filter(([id, value]) =>
          id.length > 0 && typeof value === "string"
        )) as Record<string, string>;
      }
    } catch {
      notes = {};
    }
    setScopedKitchenNotes({shopId: kitchenNotesShopId, notes});
  }, [kitchenNotesShopId]);
  const saveDeviceKitchenNote = (orderId: string, note: string) => {
    if (!kitchenNotesShopId || !note.trim()) return;
    const notes = {...kitchenNotes, [orderId]: note.trim()};
    try {
      localStorage.setItem(`le_kitchen_notes_shop_${kitchenNotesShopId}`, JSON.stringify(notes));
      setScopedKitchenNotes({shopId: kitchenNotesShopId, notes});
    } catch {
      toast.error("The private kitchen note could not be saved on this device.");
    }
  };

  const getPastDateStr = (daysAgo: number) =>
    merchantJohannesburgDayKey(new Date(Date.now() - daysAgo * 86400000)) ?? "";

  const [recentlyChangedOrders, setRecentlyChangedOrders] = useState<
    Record<string, boolean>
  >({});
  const prevOrdersRef = useRef<Order[]>([]);
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

  // Calculate customer loyalty
  const customerOrderCounts = orders.reduce(
    (acc: Record<string, number>, order) => {
      acc[order.user_id] = (acc[order.user_id] || 0) + 1;
      return acc;
    },
    {},
  );

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
        (o.product_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.id.toString().includes(searchTerm);
      const matchesCustomer =
        !customerSearch ||
        o.customer_name?.toLowerCase().includes(customerSearch.toLowerCase());
      const matchesPhone = !phoneSearch || o.phone?.includes(phoneSearch);
      const matchesFilter = filterStatus === "All" || o.status === filterStatus;
      const matchesOrderType = orderTypeFilter === "All" || (orderTypeFilter === "collection" ? isPickupOrder(o) : isOrderDelivery(o));

      // History is filtered by the recorded order PLACED date in SAST, never by
      // the viewer's timezone or a guessed paid/collected timestamp.
      const matchesDate = viewMode !== "history" ||
        merchantOrderHistoryInSastRange(o,startDate,endDate);

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
    const today=merchantJohannesburgDayKey(new Date()) ?? "";
    return orders.filter((o) => {
      const completedToday = merchantOrderCompletedOnSastDay(o,today);
      const matchesSearch =
        (o.product_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.id.toString().includes(searchTerm);
      const matchesCustomer = !customerSearch ||
        o.customer_name?.toLowerCase().includes(customerSearch.toLowerCase());
      const matchesPhone = !phoneSearch || o.phone?.includes(phoneSearch);
      const matchesFulfillment=orderTypeFilter === "All" ||
        (orderTypeFilter === "collection" ? isPickupOrder(o) : isOrderDelivery(o));
      return completedToday && matchesSearch && matchesCustomer && matchesPhone && matchesFulfillment;
    });
  }, [orders,searchTerm,customerSearch,phoneSearch,orderTypeFilter]);

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
    if(displayedOrders.length===0){toast.info("No orders match these filters to export.");return;}
    if(!window.confirm("Export filtered order data including customer contact details? Keep the spreadsheet private.")) return;
    const csvContent=safeOrderExportCsv(displayedOrders);
    const blob=new Blob(["\uFEFF",csvContent],{type:"text/csv;charset=utf-8;"});
    const link=document.createElement("a");
    const url=URL.createObjectURL(blob);
    link.href=url;
    link.download=`orders_export_${format(new Date(),"yyyyMMdd_HHmmss")}.csv`;
    link.style.visibility="hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Filtered order records exported. Totals are not proof of payment.");
  };

  const exportToJSON = () => {
    if (orders.length===0) { toast.info("No loaded orders to export."); return; }
    if (!window.confirm("Export loaded order records including customer contact details? This is not a database backup. Keep the file private.")) return;
    const jsonContent = JSON.stringify(orders, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `orders_export_${format(new Date(), "yyyyMMdd_HHmmss")}.json`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.info("Loaded order records exported as JSON. This is not a recoverable backup and may contain customer details.");
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
      // Show "Nudge Rider" button UI or similar
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
                    {isPickupOrder(order) && <PickupOrderActions order={order} mode="summary" />}

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
                              isPickupOrder(order)
                                ? order.payment_status === "paid"
                                  ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border-emerald-200/50"
                                  : "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border-amber-200/50"
                                : (order.payment_method === "cod" || order.payment_method === "Cash" || order.payment_method === "cash_on_delivery")
                                  ? "bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 border-rose-200/50"
                                  : "bg-surface-container-high text-on-surface-variant border-outline-variant/20"
                            )}>
                              <CreditCard size={11} fill="currentColor" />
                              {pickupPaymentLabel(order)}
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
                            {isOrderDelivery(order) && order.delivery_status === "picked_up" && (
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
                                  setDispatchAlertType(isPickupOrder(order) ? "customer_status" : (order.rider_id ? "rider_dispatch" : "customer_status"));
                                }}
                                className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300 font-extrabold bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-2 rounded-xl transition-colors border border-emerald-500/30 min-h-[40px] cursor-pointer"
                                title="Open SMS & WhatsApp Dispatch Studio"
                              >
                                <Send size={13} />
                                <span>{isPickupOrder(order) ? "Message Customer" : "Dispatch Alert"}</span>
                              </button>
                            </div>
                          <div className="flex flex-col gap-1 text-xs text-on-surface-variant">
                            <div className="flex items-center gap-2">
                              <MapPin size={12} className="text-primary/60" />
                              {isPickupOrder(order) ? <span>Customer collects at the shop</span> : <AddressDisplay address={order.address} city={order.city} className="italic font-medium text-xs max-sm:text-xs" maxParts={2} />}
                            </div>
                            {isOrderDelivery(order) && order.lat && order.lng && (
                              <div className="ml-5 text-[9px] text-primary/60 font-mono">
                                {order.lat.toFixed(5)}, {order.lng.toFixed(5)}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {isOrderDelivery(order) && calculateDynamicETA(order) ? (
                              <div className="flex items-center gap-2 text-xs text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded-lg">
                                <Timer size={12} />
                                <span>ETA: {calculateDynamicETA(order)}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-xs text-zinc-500 font-bold bg-zinc-50 px-2 py-1 rounded-lg">
                                <Timer size={12} />
                                <span>ETA unavailable</span>
                              </div>
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
                          {merchantJohannesburgClock(order.created_at)}
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
                          {merchantOrderMoney(order.total_price)}
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
                                    safeGetOrderItems(order.items).map((item, idx) => {
                                      const fields: Record<string, unknown> =
                                        typeof item === "object" && item !== null ? item as Record<string, unknown> : {};
                                      const quantity = fields.quantity === undefined ? 1 : Number(fields.quantity);
                                      const count = Number.isSafeInteger(quantity) && quantity > 0 ? quantity : null;
                                      const rawUnitPrice = isPickupOrder(order) ? fields.unit_price : fields.price;
                                      const unitPrice = merchantOrderTotal(rawUnitPrice);
                                      // Use the API's saved pickup line snapshot, not today's menu price.
                                      const lineTotal = isPickupOrder(order)
                                        ? pickupItemLineTotal(item)
                                        : unitPrice !== null && count !== null
                                          ? merchantOrderTotal(unitPrice * count) : null;
                                      return (
                                        <tr key={idx} className="hover:bg-surface-container-highest/30 transition-colors">
                                          <td className="px-4 py-3 font-medium text-on-surface">{String(fields.name ?? item)}</td>
                                          <td className="px-4 py-3 text-center text-on-surface-variant">{count ?? "Unavailable"}</td>
                                          <td className="px-4 py-3 text-right text-on-surface-variant">{unitPrice === null ? "Price unavailable" : merchantOrderMoney(unitPrice)}</td>
                                          <td className="px-4 py-3 text-right font-bold text-on-surface">{lineTotal === null ? "Amount unavailable" : merchantOrderMoney(lineTotal)}</td>
                                        </tr>
                                      );
                                    })
                                  ) : (
                                    <tr>
                                      <td className="px-4 py-3 font-medium text-on-surface">
                                        {order.product_name}
                                      </td>
                                      <td className="px-4 py-3 text-center text-on-surface-variant">
                                        1
                                      </td>
                                      <td className="px-4 py-3 text-right text-on-surface-variant">
                                        Amount unavailable
                                      </td>
                                      <td className="px-4 py-3 text-right font-bold text-on-surface">
                                        Amount unavailable
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
                                      {merchantOrderMoney(order.total_price)}
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
                                  {pickupPaymentLabel(order)}
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
                                  {isPickupOrder(order) ? "Collection at shop" : "Delivery Address"}
                                </span>
                                {isOrderDelivery(order) && order.lat && order.lng && (
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
                              {isPickupOrder(order) ? <p className="text-sm font-semibold text-on-surface">Customer collects at this shop. No delivery address required.</p> : <AddressDisplay address={order.address} city={order.city} className="text-sm font-semibold text-on-surface max-sm:text-xs" maxParts={3} />}
                              {isOrderDelivery(order) && order.lat && order.lng && (
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
                            {calculateDynamicETA(order) && (
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
                                  Private note on this device
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
                                        <button disabled title="Rider reassignment requires server authorization"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onUnassignRider(order.id);
                                          }}
                                          className={cn("text-[10px] px-2 py-1.5 rounded font-bold w-full text-center transition-colors",
                                            isRiderTimeout ? "bg-red-500 text-white shadow hover:bg-red-600" : "bg-red-100 text-red-600 hover:bg-red-200"
                                          )}
                                        >
                                          Rider reassignment unavailable
                                        </button>
                                      )}
                                  </div>
                                </div>
                                <div className="bg-surface-container p-3 rounded-xl border border-outline-variant/5">
                                  <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1">
                                    Delivery Status
                                  </span>
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs font-bold text-on-surface-variant">
                                      {order.delivery_status
                                        ? "Status Recorded"
                                        : "Status Unavailable"}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {order.delivery_status && (
                                <div className="mt-4 rounded-xl bg-surface-container p-3 border border-outline-variant/10" role="status">
                                  <p className="text-[10px] font-extrabold uppercase text-on-surface-variant">Delivery status from order record</p>
                                  <p className="mt-1 font-bold text-xs text-on-surface capitalize">{order.delivery_status.replaceAll("_"," ")}</p>
                                  <p className="text-[10px] text-on-surface-variant mt-1">Changes must be confirmed through the authorized rider/order workflow. Live rider tracking is not available on this screen.</p>
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
                                                        void handleRiderNudge(
                                                          rider.rider_id!,
                                                          "Order update: Please check the Rider app.",
                                                        );
                                                      }}
                                                      className="flex items-center gap-1 px-2 py-1 bg-amber-500 text-white text-[9px] font-black rounded-lg uppercase hover:scale-105 transition-transform"
                                                    >
                                                      <Zap size={10} />
                                                      Nudge Rider
                                                    </button>
                                                  ) : (
                                                    <button disabled={isPickupOrder(order)}
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
                                          <button disabled={isPickupOrder(order)}
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
                                      <button disabled title="Rider assignment requires a server-authorized workflow"
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
                                        Rider assignment unavailable
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
                              
                              {acceptingOrderId === order.id ? (
                                <motion.div
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="space-y-2"
                                >
                                  <p className="text-xs text-on-surface-variant">This confirms order status only; no ETA or custom customer message is sent.</p>
                                  <div className="flex gap-2">
                                    <button disabled={isPickupOrder(order)}
                                      onClick={() => { void confirmOrderStatus(order.id,"preparing",()=>{setAcceptingOrderId(null);setOrderNotes("");}); }}
                                      className="flex-1 py-2 bg-primary text-white text-xs font-bold rounded-full"
                                    >
                                      Confirm Accept
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
                                  <button
                                    onClick={() =>
                                      setAcceptingOrderId(order.id)
                                    }
                                    disabled={isPickupOrder(order)}
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
                              
                              {order.status === "accepted" && (
                                preparingOrderId === order.id ? (
                                  <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="space-y-2 mb-2 p-3 bg-primary/5 rounded-xl border border-primary/10"
                                  >
                                    <p className="text-xs text-on-surface-variant">Status only. Estimated delivery time is not changed by this button.</p>
                                    <div className="flex gap-2">
                                      <button disabled={isPickupOrder(order)}
                                        onClick={() => { void confirmOrderStatus(order.id,"preparing",()=>setPreparingOrderId(null)); }}
                                        className="flex-1 py-2 bg-primary text-white text-xs font-bold rounded-lg"
                                      >
                                        Start Preparing
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
                                  <p className="text-xs text-on-surface-variant">Status only. Estimated delivery time is not changed by this button.</p>
                                  <div className="flex gap-2">
                                    <button
                                      disabled={isPickupOrder(order) || (updatingOrderId === order.id)}
                                      onClick={() => { void confirmOrderStatus(order.id,"ready",()=>setReadyOrderId(null)); }}
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
                                  disabled={isPickupOrder(order) || (updatingOrderId === order.id)}
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
                          
                          <div className="flex gap-2">
                            {order.rider_id && order.status !== "completed" && (
                              <button
                                onClick={() => {
                                  const nudgeMessage = order.delivery_status === 'picked_up' ? "Your delivery is almost there!" : "Order update: Please check your delivery mission!";
                                  void handleRiderNudge(order.rider_id!,nudgeMessage);
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
                                  <p className="text-xs text-on-surface-variant" role="status">
                                    Rider rating is unavailable until the authorized API supports saving it.
                                  </p>
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
    <div className="space-y-4">
      <p role="status" className="text-xs text-on-surface-variant mb-3">{pickupOrderingEnabled() ? "Pickup actions are API-authorized. Confirm actual payment before food handover and Collected. Historical delivery records remain available." : "Pickup order, payment and collection changes are disabled pending separately approved database activation. Existing management and historical delivery records remain available."}</p>
      {!merchantPickupReadCurrent(ordersReadState, ordersVerifiedAt) && (
        <div role="status" className="flex flex-wrap items-center gap-2 px-4 py-3 rounded-xl border border-amber-500/25 bg-amber-500/5 text-xs text-on-surface-variant">
          <AlertTriangle size={15} className="text-amber-600" />
          <span>Orders are not recently verified by the API. Refresh before confirming customer payment or handover.</span>
          <button type="button" className="font-bold underline text-primary" onClick={() => { void handleRefreshOrders(); }}>Refresh Orders</button>
        </div>
      )}
      {/* Compact workspace toolbar: put order cards ahead of secondary controls. */}
      <section aria-label="Orders workspace" className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest/80 p-3 md:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-headline text-xl md:text-2xl font-bold tracking-tight text-on-surface">
            Orders
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Orders view" className="inline-flex items-center gap-1 rounded-full bg-surface-container-low p-1">
              <button type="button" onClick={() => setViewMode("active")} aria-pressed={viewMode === "active"}
                className={cn("px-3 py-1.5 rounded-full text-xs font-bold transition-colors", viewMode === "active" ? "bg-surface-container-lowest text-primary shadow-sm" : "text-on-surface-variant hover:bg-surface-container-high")}>
                Current Orders
              </button>
              <button type="button" onClick={() => setViewMode("history")} aria-pressed={viewMode === "history"}
                className={cn("px-3 py-1.5 rounded-full text-xs font-bold transition-colors", viewMode === "history" ? "bg-surface-container-lowest text-primary shadow-sm" : "text-on-surface-variant hover:bg-surface-container-high")}>
                History
              </button>
            </div>
            <button type="button" onClick={() => { void handleRefreshOrders(); }}
              disabled={isRefreshingOrders} aria-busy={isRefreshingOrders}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-bold text-on-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-70 disabled:cursor-wait">
              <RefreshCw size={15} className={isRefreshingOrders ? "animate-spin motion-reduce:animate-none" : ""} />
              {isRefreshingOrders ? "Refreshing…" : "Refresh"}
            </button>
            <button type="button" aria-expanded={showMobileActions} aria-controls="orders-extra-tools"
              onClick={() => setShowMobileActions(!showMobileActions)}
              className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-3 py-2 text-xs font-bold text-on-surface hover:bg-surface-container-highest">
              <Settings size={15} /> Tools
            </button>
          </div>
        </div>
        {showMobileActions && (
          <div id="orders-extra-tools" className="flex flex-wrap items-center gap-2 border-t border-outline-variant/15 pt-3">
            <button type="button" onClick={() => setKitchenMode(!kitchenMode)}
              aria-pressed={kitchenMode}
              className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold", kitchenMode ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface")}>
              <UtensilsCrossed size={15} /> Kitchen Mode {kitchenMode ? "ON" : "OFF"}
            </button>
            <button type="button" onClick={exportToCSV}
              className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-3 py-2 text-xs font-bold text-on-surface">
              <FileDown size={15} /> Spreadsheet
            </button>
            <button type="button" onClick={exportToJSON}
              className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-3 py-2 text-xs font-bold text-on-surface">
              <FileDown size={15} /> Export JSON
            </button>
          </div>
        )}
        <OperationFeedback
          status={orderRefreshStatus}
          message={orderRefreshStatus === "loading" ? "Checking orders…" :
            orderRefreshStatus === "success" ? "Orders verified after refresh" :
            orderRefreshStatus === "error" ? "Could not refresh orders" :
            "Refresh finished; new order verification not confirmed"}
          detail={orderRefreshStatus === "unverified" ? "The previous list may be out of date. Order actions still require current API verification." :
            orderRefreshStatus === "error" ? "Check the connection, then retry." : undefined}
          onRetry={orderRefreshStatus === "unverified" || orderRefreshStatus === "error" ? () => { void handleRefreshOrders(); } : undefined}
        />
      </section>

      <div
        className={cn(
          "grid grid-cols-1 gap-5 items-start",
          !kitchenMode && "lg:grid-cols-12",
        )}
      >
        <div
          className={cn(
            kitchenMode ? "col-span-full" : "lg:col-span-8",
            "space-y-3",
          )}
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-headline text-lg font-bold flex items-center gap-2">
                {viewMode === "active" ? "Active Queue" : "Order History"}
                <span className="bg-primary-fixed text-on-primary-fixed text-xs px-2.5 py-1 rounded-full">
                  {displayedOrders.length} Orders
                </span>
              </h3>
              <div className="flex items-center gap-2">
                <button type="button"
                  aria-label="Search orders" aria-expanded={showSearch}
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
                <button type="button" onClick={() => setShowOrderFilters(!showOrderFilters)}
                  aria-expanded={showOrderFilters} aria-controls="orders-filter-panel"
                  className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors", showOrderFilters ? "border-primary bg-primary/10 text-primary" : "border-outline-variant/20 bg-surface-container-low text-on-surface-variant hover:border-primary/30")}>
                  <SlidersHorizontal size={14} /> Filters &amp; sort
                  {(filterStatus !== "All" || orderTypeFilter !== "All" || startDate || endDate || searchTerm || customerSearch || phoneSearch) && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-label="Filters active" />}
                </button>
              </div>
            </div>


            {showOrderFilters && (
              <div id="orders-filter-panel" className="space-y-3 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-3">
            <div className="flex flex-wrap gap-2 items-center" role="group" aria-label="Order fulfillment filter">
              <span className="text-xs font-bold text-on-surface-variant">Fulfillment:</span>
              {([
                ["All", "All orders"],
                ["collection", "Customer collection"],
                ["delivery", "Delivery (later phase)"],
              ] as const).map(([value, label]) => (
                <button key={value} type="button" aria-pressed={orderTypeFilter === value}
                  onClick={() => setOrderTypeFilter(value)}
                  className={cn("px-3 py-2 rounded-xl border text-xs font-bold transition-colors",
                    orderTypeFilter === value ? "bg-primary/10 text-primary border-primary" :
                      "bg-surface-container-low text-on-surface-variant border-outline-variant/20 hover:border-primary/30")}>
                  {label}
                </button>
              ))}
            </div>
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
                    <h4 className="text-xs font-black uppercase tracking-wider text-on-surface">Filter by Order Placed Date</h4>
                    <p className="text-[10px] text-on-surface-variant font-semibold">Dates use South African time · Not a payment or completion date</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { label: "All Time", start: "", end: "" },
                    { label: "Today", start: (merchantJohannesburgDayKey(new Date()) ?? ""), end: (merchantJohannesburgDayKey(new Date()) ?? "") },
                    { label: "Yesterday", start: getPastDateStr(1), end: getPastDateStr(1) },
                    { label: "7 Days", start: getPastDateStr(7), end: (merchantJohannesburgDayKey(new Date()) ?? "") },
                    { label: "30 Days", start: getPastDateStr(30), end: (merchantJohannesburgDayKey(new Date()) ?? "") },
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
            )}
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
                    : "Completed and cancelled orders appear here. The date filter uses when each order was placed."}
                </p>
              </div>
              {viewMode === "active" && (
                <button
                  onClick={() => { void handleRefreshOrders(); }}
                  className="px-8 py-3 bg-surface-container-lowest text-primary font-bold rounded-full shadow-sm hover:scale-105 transition-all border border-primary/10"
                >
                  Check for New Orders
                </button>
              )}
            </div>
          ) : viewMode === "active" && true ? (
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
                        onDragStart={(e: any) => {
                          setDraggedPendingId(order.id);
                          if (e.dataTransfer) {
                            e.dataTransfer.setData("text/plain", order.id);
                            e.dataTransfer.effectAllowed = "move";
                          }
                        }}
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
                            {merchantJohannesburgClock(order.created_at)}
                          </span>
                        </div>

                        {/* Items list */}
                        <div className="mt-4 text-base text-on-surface space-y-3 font-bold bg-surface-container-lowest p-4 rounded-xl border-2 border-outline-variant/10 shadow-inner">
                          {items.map((item, idx) => {
                            const isObj = typeof item === "object" && item !== null;
                            const name = isObj ? ((item as unknown) as Record<string, unknown>).name as string : String(item);
                            const qty = isObj ? ((item as unknown) as Record<string, unknown>).quantity as number : 1;
                            const fields = isObj ? (item as Record<string, unknown>) : {};
                            const price = isPickupOrder(order) ? pickupItemLineTotal(item) : merchantOrderTotal(fields.price);
                            return (
                              <div key={idx} className="flex justify-between">
                                <span className="whitespace-pre-wrap break-words pr-2">{qty}x {name}</span>
                                <span className="opacity-90 font-mono text-primary font-black shrink-0">{price === null ? "Price unavailable" : merchantOrderMoney(price)}</span>
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
                          {isPickupOrder(order) ? <span>Collect at shop</span> : <AddressDisplay address={order.address} city={order.city} className="text-[10px] max-sm:text-[9px] font-medium max-w-[170px]" maxParts={2} />}
                        </div>

                        {/* Action buttons with inline input forms */}
                        {acceptingOrderId === order.id ? (
                          <div className="space-y-2 mt-3 pt-3 border-t border-outline-variant/5">
                            <p className="text-xs text-on-surface-variant">This confirms order status only; no ETA or custom customer message is sent.</p>
                            <div className="flex gap-2">
                              <button disabled={isPickupOrder(order)}
                                onClick={() => { void confirmOrderStatus(order.id,"preparing",()=>{setAcceptingOrderId(null);setOrderNotes("");}); }}
                                className="flex-1 py-1.5 bg-primary text-white text-[10px] font-black uppercase tracking-wider rounded-lg shadow-sm hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                              >
                                Confirm Accept
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
                          <div className="mt-4 pt-4 border-t-2 border-dashed border-outline-variant/20 flex flex-col items-stretch gap-4">
                            <div className="text-center font-mono font-black text-2xl text-on-surface bg-surface-container-high py-2 rounded-xl">TOTAL: {merchantOrderMoney(order.total_price)}</div>
                            <div className="flex flex-col items-stretch w-full gap-2">
                              {isPickupOrder(order) ? (
                                <PickupOrderActions order={order} mode="actions"
                                  readState={ordersReadState} verifiedAt={ordersVerifiedAt} />
                              ) : (
                              <button
                                                                disabled={updatingOrderId !== null} onClick={(e) => {e.stopPropagation();void confirmOrderStatus(order.id,"preparing");}}
                                className="w-full mt-4 py-5 bg-emerald-600 text-white text-lg md:text-xl font-black uppercase tracking-widest rounded-2xl shadow-xl hover:bg-emerald-500 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none text-center block"
                              >
                                Accept
                              </button>
                              )}
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
                            {merchantJohannesburgClock(order.created_at)}
                          </span>
                        </div>

                        {/* Items list */}
                        <div className="mt-4 text-base text-on-surface space-y-3 font-bold bg-surface-container-lowest p-4 rounded-xl border-2 border-outline-variant/10 shadow-inner">
                          {items.map((item, idx) => {
                            const isObj = typeof item === "object" && item !== null;
                            const name = isObj ? ((item as unknown) as Record<string, unknown>).name as string : String(item);
                            const qty = isObj ? ((item as unknown) as Record<string, unknown>).quantity as number : 1;
                            const fields = isObj ? (item as Record<string, unknown>) : {};
                            const price = isPickupOrder(order) ? pickupItemLineTotal(item) : merchantOrderTotal(fields.price);
                            return (
                              <div key={idx} className="flex justify-between">
                                <span className="whitespace-pre-wrap break-words pr-2">{qty}x {name}</span>
                                <span className="opacity-90 font-mono text-primary font-black shrink-0">{price === null ? "Price unavailable" : merchantOrderMoney(price)}</span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Delivery Track Badge & Gated Dispatch Action */}
                        <div className="mt-2.5 space-y-1.5">
                          {isDelivery && order.status !== "dispatched" && (
                            <p role="status" className="w-full py-2 px-3 rounded-xl bg-surface-container border border-outline-variant/10 text-xs font-semibold text-on-surface-variant">
                              Rider assignment is handled by the authorized rider workflow.
                            </p>
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
                              <p className="text-xs text-on-surface-variant">Status only. No preparation or delivery time is saved by this button.</p>
                              <div className="flex gap-2">
                                <button disabled={isPickupOrder(order)}
                                  onClick={() => { void confirmOrderStatus(order.id,"preparing",()=>setPreparingOrderId(null)); }}
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
                            <div className="mt-4 pt-4 border-t-2 border-dashed border-outline-variant/20 flex flex-col items-stretch gap-4">
                              <div className="text-center font-mono font-black text-2xl text-on-surface bg-surface-container-high py-2 rounded-xl">TOTAL: {merchantOrderMoney(order.total_price)}</div>
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
                              <p className="text-xs text-on-surface-variant">Status only. No preparation or delivery time is saved by this button.</p>
                              <div className="flex gap-2">
                                <button disabled={isPickupOrder(order)}
                                  onClick={() => { void confirmOrderStatus(order.id,"ready",()=>setReadyOrderId(null)); }}
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
                            <div className="mt-4 pt-4 border-t-2 border-dashed border-outline-variant/20 flex flex-col items-stretch gap-4">
                              <div className="text-center font-mono font-black text-2xl text-on-surface bg-surface-container-high py-2 rounded-xl">TOTAL: {merchantOrderMoney(order.total_price)}</div>
                              {isPickupOrder(order) ? (
                                <PickupOrderActions order={order} mode="actions"
                                  readState={ordersReadState} verifiedAt={ordersVerifiedAt} />
                              ) : (
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
                                className="w-full mt-4 py-5 bg-teal-500 text-white text-lg md:text-xl font-black uppercase tracking-widest rounded-2xl shadow-xl hover:bg-teal-400 active:scale-95 transition-all cursor-pointer text-center block"
                              >
                                Mark Ready
                              </button>
                              )}
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
                            {merchantJohannesburgClock(order.created_at)}
                          </span>
                        </div>

                        {/* Items list */}
                        <div className="mt-4 text-base text-on-surface space-y-3 font-bold bg-surface-container-lowest p-4 rounded-xl border-2 border-outline-variant/10 shadow-inner">
                          {items.map((item, idx) => {
                            const isObj = typeof item === "object" && item !== null;
                            const name = isObj ? ((item as unknown) as Record<string, unknown>).name as string : String(item);
                            const qty = isObj ? ((item as unknown) as Record<string, unknown>).quantity as number : 1;
                            const fields = isObj ? (item as Record<string, unknown>) : {};
                            const price = isPickupOrder(order) ? pickupItemLineTotal(item) : merchantOrderTotal(fields.price);
                            return (
                              <div key={idx} className="flex justify-between">
                                <span className="whitespace-pre-wrap break-words pr-2">{qty}x {name}</span>
                                <span className="opacity-90 font-mono text-primary font-black shrink-0">{price === null ? "Price unavailable" : merchantOrderMoney(price)}</span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Gated Dispatch Action & Rider details */}
                        {isOrderDelivery(order) && order.status !== "dispatched" && (
                          <div className="mt-2.5">
                            <p role="status" className="w-full py-2 px-3 rounded-xl bg-surface-container border border-outline-variant/10 text-xs font-semibold text-on-surface-variant">
                              Rider assignment is handled by the authorized rider workflow.
                            </p>
                          </div>
                        )}

                        {canNudge && (
                          <div className="mt-2">
                            <button
                              onClick={() => {
                                const nudgeMessage = order.delivery_status === 'picked_up' ? "Your delivery is almost there!" : "Order update: Please check your delivery mission!";
                                void handleRiderNudge(order.rider_id!,nudgeMessage);
                              }}
                              className="w-full py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 text-[10px] font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Zap size={11} className="text-amber-600" />
                              <span>Nudge Rider</span>
                            </button>
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="mt-4 pt-4 border-t-2 border-dashed border-outline-variant/20 flex flex-col items-stretch gap-4">
                          <div className="text-center font-mono font-black text-2xl text-on-surface bg-surface-container-high py-2 rounded-xl">TOTAL: {merchantOrderMoney(order.total_price)}</div>
                          {isPickupOrder(order) ? (
                            <PickupOrderActions order={order} mode="actions"
                                  readState={ordersReadState} verifiedAt={ordersVerifiedAt} />
                          ) : (
                            <p role="status" className="text-xs text-on-surface-variant">
                              Delivery completion is confirmed by the authorized rider workflow, not from this screen.
                            </p>
                          )}
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
                    <h3 className="font-headline font-black text-xs uppercase tracking-wider text-on-surface">Completed Today</h3>
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
                            {isPickupOrder(order) && order.status === "completed" ? "Collected" : order.status}
                          </span>
                        </div>

                        {/* Items list */}
                        <div className="mt-4 text-base text-on-surface space-y-3 font-bold bg-surface-container-lowest p-4 rounded-xl border-2 border-outline-variant/10 shadow-inner">
                          {items.map((item, idx) => {
                            const isObj = typeof item === "object" && item !== null;
                            const name = isObj ? ((item as unknown) as Record<string, unknown>).name as string : String(item);
                            const qty = isObj ? ((item as unknown) as Record<string, unknown>).quantity as number : 1;
                            const fields = isObj ? (item as Record<string, unknown>) : {};
                            const price = isPickupOrder(order) ? pickupItemLineTotal(item) : merchantOrderTotal(fields.price);
                            return (
                              <div key={idx} className="flex justify-between">
                                <span className="whitespace-pre-wrap break-words pr-2">{qty}x {name}</span>
                                <span className="opacity-90 font-mono text-primary font-black shrink-0">{price === null ? "Price unavailable" : merchantOrderMoney(price)}</span>
                              </div>
                            );
                          })}
                        </div>

                        <div className="mt-3 pt-3 border-t border-outline-variant/5 flex items-center justify-between">
                          <div className="text-center font-mono font-black text-2xl text-on-surface bg-surface-container-high py-2 rounded-xl">TOTAL: {merchantOrderMoney(order.total_price)}</div>
                          <span className="text-[9px] font-bold text-zinc-500 font-mono uppercase">{isPickupOrder(order) ? pickupPaymentLabel(order) : "Completed (payment unverified here)"}</span>
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
                    <div className="text-center py-8 text-xs text-on-surface-variant/50 font-bold">No time-confirmed completions today</div>
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
                      count: summarizeKitchenQueue(orders).readyForPickup,
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
                    Preparing Orders
                  </div>
                  <div className="text-3xl font-headline font-extrabold text-primary">
                    {orders.filter(o=>o.status==="preparing").length}
                  </div>
                  <div className="text-xs text-on-surface-variant mt-1">
                    Orders currently marked preparing
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


                <p className="text-xs text-on-surface-variant px-2 py-2">Printer connection is not verified. Open an order and use its Print options to check supported devices.</p>
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
                    onClick={async () => {
                      const finalReason = cancelReasonPreset === "Other (Write custom message below)"
                        ? (customCancelExplanation.trim() || "Order cancelled by kitchen supervisor.")
                        : customCancelExplanation;
                      try {
                        await Promise.resolve(onUpdateStatus(cancellingOrder.id, "cancelled", finalReason));
                        setCancellingOrder(null);
                        // The parent workflow owns server-confirmed status feedback.
                        // Do not create a second success toast based on a local button click.
                      } catch {
                        toast.error("Cancellation was not confirmed. Please refresh the order status.");
                      }
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
                          const p = isObj && "price" in typedItem ? typedItem.price : null;
                          const q = isObj && "quantity" in typedItem ? typedItem.quantity : 1;
                          const n = isObj && "name" in typedItem ? String(typedItem.name) : String(item);
                          return (
                            <div key={idx} className="flex justify-between items-start gap-2">
                              <span>{String(q)}x {n}</span>
                              <span className="shrink-0">{merchantReceiptLineAmount(p, q)}</span>
                            </div>
                          );
                        })
                      ) : (
                        <div className="flex justify-between items-start">
                          <span>1x {printingOrder.product_name}</span>
                          <span className="shrink-0">Amount unavailable</span>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-dashed border-stone-400 pt-2 my-2 mt-4 font-bold">
                      <div className="flex justify-between text-sm">
                        <span>GRAND TOTAL</span>
                        <span>{merchantOrderMoney(printingOrder.total_price)}</span>
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
                          {pickupPaymentLabel(orderToAccept)}
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
                          const price = typeof item === "string" ? null : item.price;
                          return (
                            <div key={idx} className="flex justify-between items-center p-3 bg-surface-container-high/40 rounded-xl border border-outline-variant/5">
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 bg-primary/10 text-primary text-[10px] font-black rounded-full flex items-center justify-center">x{quantity}</span>
                                <span className="text-xs font-bold text-on-surface">{name}</span>
                              </div>
                              <span className="text-xs font-black text-on-surface-variant">{merchantReceiptLineAmount(price, quantity)}</span>
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
                        Private note (on this device only)
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

                    <p className="text-xs text-on-surface-variant text-left" role="note">Accepting changes the order status only. No custom customer message or ETA is sent.</p>
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
                      disabled={isPickupOrder(orderToAccept) || updatingOrderId!==null}
                      title={isPickupOrder(orderToAccept) ? "Use the dedicated pickup acceptance button" : "Accept through the order API"}
                      onClick={() => {void confirmOrderStatus(orderToAccept.id,"preparing",()=>{if(orderNotes.trim())saveDeviceKitchenNote(orderToAccept.id,orderNotes);setAcceptingOrderId(null);setOrderNotes("");});}}
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

        {/* SMS & WhatsApp Dispatch Studio Modal */}
        <DispatchAlertModal
          key={dispatchAlertOrder?.id ? `${dispatchAlertOrder.id}-${dispatchAlertType}-${currentShop?.id ?? ""}` : "closed"}
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

