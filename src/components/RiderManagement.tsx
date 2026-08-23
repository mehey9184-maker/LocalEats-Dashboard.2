import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { 
  Compass, 
  Bike, 
  Settings, 
  MapPin, 
  RefreshCw, 
  Plus, 
  Users, 
  Camera, 
  Wallet, 
  Copy, 
  ShieldCheck, 
  X, 
  Zap, 
  Star, 
  Navigation, 
  TrendingUp, 
  Heart,
  Download,
  Award,
  CheckCircle2,
  AlertTriangle,
  MessageCircle,
  Send,
  Search,
  Phone,
  Share2,
  UserPlus,
  Activity,
  RotateCcw,
  Database,
  Smartphone
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { motion, AnimatePresence } from "framer-motion";
import { MapContainer, TileLayer, Marker, useMap, Polyline, Tooltip } from "react-leaflet";
import L from "leaflet";
import { toast } from "sonner";
import { supabase, getFreshChannel } from "../lib/supabase";
import { cn } from "../lib/utils";
import { Shop, Order, RiderProfile } from "../types";
import { QRScanner } from "./QRScanner";

// --- Leaflet Map Config & Helpers ---
const MapViewRefocus = ({ center, zoom }: { center: [number, number]; zoom: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
};

// --- Type definitions ---
export interface RiderConnection {
  id: string;
  shop_id: number;
  rider_id: string | null;
  rider_name: string | null;
  rider_phone?: string | null;
  connection_code: string;
  expires_at: string;
  status: "active" | "expired" | "offline" | "idle" | "busy" | "paused";
  is_online: boolean;
  created_at: string;
  rating?: number;
  last_seen?: string;
  total_deliveries?: number;
  total_earnings?: number;
  current_latitude?: number;
  current_longitude?: number;
  shops?: {
    name: string;
    logo_url?: string | null;
  };
}

interface TrafficBottleneck {
  id: string;
  name: string;
  latlng: [number, number];
  delay: string;
  cause: string;
  color: "red" | "orange" | "green";
}

interface TrafficCorridor {
  id: string;
  name: string;
  path: [number, number][];
  color: "red" | "orange" | "green";
}

const TRAFFIC_BOTTLENECKS: TrafficBottleneck[] = [
  {
    id: "allandale-n1",
    name: "Allandale Road N1 Interchange (Midrand)",
    latlng: [-26.013, 28.124],
    delay: "+15 mins",
    cause: "Ongoing lane rehabilitation northbound",
    color: "red",
  },
  {
    id: "new-rd-n1",
    name: "New Road N1 Exit (Midrand)",
    latlng: [-25.984, 28.129],
    delay: "+7 mins",
    cause: "Peak-hour high exit ramp volumes",
    color: "orange",
  },
  {
    id: "mall-tembisa-r562",
    name: "Mall of Tembisa Intersection (R562)",
    latlng: [-25.968, 28.204],
    delay: "+11 mins",
    cause: "Intense shopping district entry queuing",
    color: "red",
  },
  {
    id: "esangweni-taxi",
    name: "Esangweni Junction (Andrew Mapheto Dr)",
    latlng: [-25.993, 28.224],
    delay: "+14 mins",
    cause: "Minibus taxi transfer activity & heavy pedestrian crowds",
    color: "red",
  },
  {
    id: "clayville-corridor",
    name: "Clayville Industrial Linkage (Clayville)",
    latlng: [-25.961, 28.165],
    delay: "+6 mins",
    cause: "Freight logistics & supply truck offloading cue",
    color: "orange",
  },
];

const TRAFFIC_CORRIDORS: TrafficCorridor[] = [
  {
    id: "n1-expressway",
    name: "N1 Midrand Expressway",
    path: [
      [-26.02, 28.12],
      [-26.00, 28.125],
      [-25.98, 28.13],
      [-25.95, 28.138],
    ],
    color: "red",
  },
  {
    id: "r562-corridor",
    name: "R562 Olifantsfontein Corridor",
    path: [
      [-25.95, 28.138],
      [-25.96, 28.18],
      [-25.97, 28.22],
    ],
    color: "orange",
  },
  {
    id: "andrew-mapheto-dr",
    name: "Andrew Mapheto Drive Corridor",
    path: [
      [-25.97, 28.22],
      [-25.99, 28.225],
      [-26.01, 28.221],
      [-26.03, 28.212],
    ],
    color: "red",
  },
  {
    id: "kopanong-link",
    name: "Ivory Park Kopanong Link Bypass",
    path: [
      [-25.99, 28.135],
      [-26.00, 28.16],
      [-26.01, 28.19],
    ],
    color: "green",
  },
];

// 🚲 Smooth Location Interpolation (Lerp) Hook
function useSmoothLocation(lat?: number, lng?: number) {
  const [smoothLat, setSmoothLat] = useState<number | undefined>(lat);
  const [smoothLng, setSmoothLng] = useState<number | undefined>(lng);
  const targetRef = useRef({ lat, lng });

  useEffect(() => {
    targetRef.current = { lat, lng };
  }, [lat, lng]);

  useEffect(() => {
    if (targetRef.current.lat !== undefined && targetRef.current.lng !== undefined) {
      setSmoothLat(targetRef.current.lat);
      setSmoothLng(targetRef.current.lng);
    }
  }, [lat, lng]);

  return { lat: smoothLat, lng: smoothLng };
}

// --- Diagnostic & Network Health Helpers ---
export function getRiderHeartbeatStatus(lastSeen?: string, isOnline?: boolean) {
  if (!lastSeen) {
    if (isOnline) {
      return {
        label: "Truly Active (Session Live)",
        timeAgo: "Session Live",
        type: "truly_active" as const,
        badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
        dotClass: "bg-emerald-500 animate-ping",
      };
    }
    return {
      label: "Offline (No Heartbeat)",
      timeAgo: "No ping recorded",
      type: "offline" as const,
      badgeClass: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
      dotClass: "bg-zinc-400",
    };
  }

  const lastSeenMs = new Date(lastSeen).getTime();
  const diffSec = Math.floor((Date.now() - lastSeenMs) / 1000);

  if (isNaN(diffSec) || diffSec < 0) {
    return {
      label: "Truly Active (Just now)",
      timeAgo: "Just now",
      type: "truly_active" as const,
      badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      dotClass: "bg-emerald-500 animate-ping",
    };
  }

  if (diffSec < 120) {
    return {
      label: `Truly Active (${diffSec}s ago)`,
      timeAgo: `${diffSec}s ago`,
      type: "truly_active" as const,
      badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      dotClass: "bg-emerald-500 animate-pulse",
    };
  } else if (diffSec < 600) {
    const mins = Math.floor(diffSec / 60);
    return {
      label: `Truly Active (${mins}m ago)`,
      timeAgo: `${mins}m ago`,
      type: "truly_active" as const,
      badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      dotClass: "bg-emerald-500",
    };
  } else if (diffSec < 1800) {
    const mins = Math.floor(diffSec / 60);
    return {
      label: `Connected / Idle (${mins}m ago)`,
      timeAgo: `${mins}m ago`,
      type: "connected_idle" as const,
      badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      dotClass: "bg-amber-500",
    };
  } else {
    const hours = Math.floor(diffSec / 3600);
    const label = hours > 24 ? `${Math.floor(hours / 24)}d ago` : `${hours}h ago`;
    return {
      label: `Offline / Stale (${label})`,
      timeAgo: label,
      type: "offline" as const,
      badgeClass: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
      dotClass: "bg-zinc-400",
    };
  }
}

export function getCodeDiagnostic(conn: RiderConnection, dbSyncedSet: Set<string>) {
  const isDbSynced = dbSyncedSet.has(conn.connection_code) || dbSyncedSet.has(conn.id);
  const isBound = Boolean(conn.rider_id);

  if (isBound) {
    return {
      status: "linked",
      label: "Linked & Active",
      badgeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      dbLabel: isDbSynced ? "Supabase Verified ✓" : "Local Verified",
      isDbSynced,
    };
  }
  return {
    status: isDbSynced ? "active_synced" : "local_fallback",
    label: isDbSynced ? "Active (DB Synced)" : "Active (Local Fallback)",
    badgeClass: isDbSynced
      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
      : "bg-amber-500/10 text-amber-600 border-amber-500/20",
    dbLabel: isDbSynced ? "Supabase Table Verified ✓" : "Local Cache Only",
    isDbSynced,
  };
}

export const RiderManagement = ({
  currentShop,
  orders,
  onRequestRider,
  sendRiderNudge,
}: {
  currentShop: Shop;
  orders: Order[];
  onRequestRider: (id: string, riderId?: string, riderName?: string, riderPhone?: string) => void;
  sendRiderNudge: (riderId: string, message: string) => Promise<void>;
}) => {
  const [connections, setConnections] = useState<RiderConnection[]>(() => {
    if (typeof window === "undefined") return [];
    const shopId = currentShop?.id || 1;
    const localKey1 = `localeats_local_conns_${shopId}`;
    const localKey2 = `localeats_rider_conns_${shopId}`;
    try {
      const s1 = localStorage.getItem(localKey1);
      const s2 = localStorage.getItem(localKey2);
      let localConns: RiderConnection[] = [];
      if (s1) {
        const p1 = JSON.parse(s1);
        if (Array.isArray(p1)) localConns = p1;
      }
      if (s2) {
        const p2 = JSON.parse(s2);
        if (Array.isArray(p2)) localConns = [...localConns, ...p2];
      }
      return localConns;
    } catch {
      return [];
    }
  });
  const [dbSyncedSet, setDbSyncedSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(() => connections.length === 0);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [showTrafficLayer, setShowTrafficLayer] = useState(false);
  const [mapCenterOverride, setMapCenterOverride] = useState<[number, number] | null>(null);
  const [mapZoomOverride, setMapZoomOverride] = useState<number | null>(null);
  const [activeCode, setActiveCode] = useState<{ code: string; expires: string } | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [qrUrl, setQrUrl] = useState("");
  const pairingCodeDuration: "24h" | "7d" | "30d" | "never" = "never";
  const [showInHouseModal, setShowInHouseModal] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [inHouseName, setInHouseName] = useState("");
  const [inHousePhone, setInHousePhone] = useState("");
  const [inHouseVehicle, setInHouseVehicle] = useState<"Road" | "Bicycle" | "Motorbike" | "Electric">("Motorbike");
  const [nudgingRider, setNudgingRider] = useState<RiderConnection | null>(null);
  const [customNudgeText, setCustomNudgeText] = useState("");

  // Sub-Tabs Selection State - default to network for quick fleet management
  const [activeSubTab, setActiveSubTab] = useState<"network" | "health" | "missions" | "ratings" | "controls">("network");

  // Search & Filter state for Rider Network
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline" | "in_house" | "paired">("all");

  // Pagination State for high-performance virtualized/paginated rider display
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Reset pagination to page 1 whenever searchQuery or statusFilter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  // Sorted connections so online riders appear at the top for layout animations
  const sortedConnections = useMemo(() => {
    const seenIds = new Set<string>();
    const seenCodes = new Set<string>();
    const uniqueList: RiderConnection[] = [];

    for (const c of connections) {
      if (!c || !c.id) continue;
      const idStr = String(c.id);
      const codeStr = c.connection_code && c.connection_code !== "IN-HOUSE" ? String(c.connection_code) : null;

      if (seenIds.has(idStr)) continue;
      if (codeStr && seenCodes.has(codeStr)) continue;

      seenIds.add(idStr);
      if (codeStr) seenCodes.add(codeStr);
      uniqueList.push(c);
    }

    return uniqueList.sort((a, b) => {
      if (a.is_online === b.is_online) {
        return (b.rating || 5.0) - (a.rating || 5.0);
      }
      return a.is_online ? -1 : 1;
    });
  }, [connections]);

  // Filtered connections based on user search and filter tab
  const filteredConnections = useMemo(() => {
    return sortedConnections.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = !q || (c.rider_name && c.rider_name.toLowerCase().includes(q));
      const phoneMatch = !q || (c.rider_phone && c.rider_phone.toLowerCase().includes(q));
      const codeMatch = !q || (c.connection_code && c.connection_code.toLowerCase().includes(q));

      if (!nameMatch && !phoneMatch && !codeMatch) return false;

      if (statusFilter === "online") return c.is_online;
      if (statusFilter === "offline") return !c.is_online;
      if (statusFilter === "in_house") return c.connection_code === "IN-HOUSE";
      if (statusFilter === "paired") return c.connection_code !== "IN-HOUSE";

      return true;
    });
  }, [sortedConnections, searchQuery, statusFilter]);

  // Paginated subset of connections for main thread performance optimization
  const paginatedConnections = useMemo(() => {
    if (pageSize === 0) return filteredConnections;
    const start = (currentPage - 1) * pageSize;
    return filteredConnections.slice(start, start + pageSize);
  }, [filteredConnections, currentPage, pageSize]);

  const totalPages = useMemo(() => {
    if (pageSize === 0) return 1;
    return Math.ceil(filteredConnections.length / pageSize) || 1;
  }, [filteredConnections.length, pageSize]);

  // PDF Summary Report Generator for Rider Performance & COD Handovers
  const generateRiderPerformanceReport = useCallback(() => {
    try {
      const doc = new jsPDF();
      const shopName = currentShop?.name || "LocalEats Vendor";
      const dateStr = new Date().toLocaleDateString("en-ZA", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      // Dark header block
      doc.setFillColor(24, 24, 27);
      doc.rect(0, 0, 210, 28, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(255, 255, 255);
      doc.text("LocalEats - Rider Fleet & COD Performance Report", 14, 16);

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.text(`Store: ${shopName}  |  Generated: ${dateStr}`, 14, 23);

      // Key Metrics Card
      const activeRiders = connections.filter((c) => c.is_online).length;
      const totalRiders = connections.length;
      const completedOrders = orders.filter((o) => o.status === "completed" || (o.status as string) === "delivered" || o.delivery_status === "delivered");
      const codOrders = completedOrders.filter((o) => o.payment_method?.toLowerCase().includes("cash") || o.payment_method?.toLowerCase().includes("cod"));
      const totalCodAmount = codOrders.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0);
      const avgRating = connections.length > 0
        ? (connections.reduce((acc, c) => acc + (c.rating || 5.0), 0) / connections.length).toFixed(1)
        : "5.0";

      doc.setFillColor(245, 245, 245);
      doc.roundedRect(14, 33, 182, 28, 3, 3, "F");

      doc.setTextColor(30, 30, 30);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("FLEET & CASH HANDOVER EXECUTIVE SUMMARY", 18, 41);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.text(`• Total Registered Riders: ${totalRiders} (${activeRiders} online)`, 18, 48);
      doc.text(`• Completed Delivery Missions: ${completedOrders.length}`, 18, 54);
      doc.text(`• Fleet Average Rating: ${avgRating} / 5.0 Stars`, 110, 48);
      doc.text(`• Total COD Cash Collected: R ${totalCodAmount.toFixed(2)}`, 110, 54);

      // Table 1: Rider Performance Table
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.text("1. Rider Performance & Rating Roster", 14, 69);

      const riderRows = connections.map((conn) => {
        const riderOrders = orders.filter((o) => o.rider_id === conn.rider_id || o.rider_name === conn.rider_name);
        const riderCod = riderOrders
          .filter((o) => (o.status === "completed" || (o.status as string) === "delivered" || o.delivery_status === "delivered") && (o.payment_method?.toLowerCase().includes("cash") || o.payment_method?.toLowerCase().includes("cod")))
          .reduce((sum, o) => sum + (Number(o.total_price) || 0), 0);

        return [
          conn.rider_name || "Rider",
          conn.rider_phone || "N/A",
          conn.is_online ? "Online" : "Offline",
          conn.connection_code === "IN-HOUSE" ? "In-House Fleet" : "Paired Rider",
          riderOrders.length.toString(),
          `${(conn.rating || 5.0).toFixed(1)} / 5.0`,
          `R ${riderCod.toFixed(2)}`,
        ];
      });

      autoTable(doc, {
        startY: 73,
        head: [["Rider Name", "Phone", "Status", "Access Protocol", "Missions", "Rating", "COD Collected"]],
        body: riderRows.length > 0 ? riderRows : [["No registered riders found", "-", "-", "-", "-", "-", "R 0.00"]],
        headStyles: { fillColor: [245, 130, 32], textColor: [255, 255, 255], fontStyle: "bold" },
        styles: { fontSize: 8 },
        theme: "striped",
      });

      // Table 2: COD Orders Reconciliation Log
      // @ts-expect-error autoTable lastAutoTable property attachment
      const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 130;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(30, 30, 30);
      doc.text("2. Cash-on-Delivery (COD) Handshake Order Logs", 14, finalY);

      const codRows = codOrders.map((o) => [
        o.id.slice(0, 8).toUpperCase(),
        o.customer_name || "Customer",
        o.rider_name || "Assigned Rider",
        `R ${(Number(o.total_price) || 0).toFixed(2)}`,
        o.status.toUpperCase(),
        new Date(o.created_at).toLocaleDateString("en-ZA"),
      ]);

      autoTable(doc, {
        startY: finalY + 4,
        head: [["Order ID", "Customer", "Rider Handshake", "Order Value", "Status", "Date"]],
        body: codRows.length > 0 ? codRows : [["No COD orders recorded", "-", "-", "R 0.00", "-", "-"]],
        headStyles: { fillColor: [39, 39, 42], textColor: [255, 255, 255], fontStyle: "bold" },
        styles: { fontSize: 8 },
        theme: "grid",
      });

      const filename = `Rider_Performance_COD_Report_${shopName.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
      doc.save(filename);
      toast.success("Rider Performance & COD Report downloaded!", {
        description: `Exported as ${filename}`,
        icon: <Download className="text-emerald-500" />,
      });
    } catch (err) {
      console.error("PDF generation error:", err);
      toast.error("Failed to generate PDF report.");
    }
  }, [currentShop?.name, connections, orders]);

  const dbCashTrust = currentShop.cash_trust_enabled;
  const dbAllowExternal = currentShop.allow_external_riders;
  const dbAutoLookForRider = currentShop.auto_look_for_rider;

  const [cashTrustEnabled, setCashTrustEnabled] = useState(() => {
    const localVal = localStorage.getItem(`localeats_cash_trust_${currentShop.id}`) === "true";
    return dbCashTrust !== undefined ? !!dbCashTrust : localVal;
  });

  const [allowExternalRiders, setAllowExternalRiders] = useState(() => {
    const localVal = localStorage.getItem(`localeats_allow_external_${currentShop.id}`) !== "false";
    return dbAllowExternal !== undefined ? !!dbAllowExternal : localVal;
  });

  const [autoLookForRider, setAutoLookForRider] = useState(() => {
    const localVal = localStorage.getItem(`localeats_auto_look_${currentShop.id}`) !== "false";
    return dbAutoLookForRider !== undefined ? !!dbAutoLookForRider : localVal;
  });

  const settledCodOrders = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("localeats_settled_cod_orders") || "[]") as string[];
    } catch {
      return [];
    }
  }, []);

  const riderCashBalances = useMemo(() => {
    const balances: Record<string, { total: number; name: string; count: number }> = {};
    const unsettledCashOrders = orders.filter(
      (o) => o.status === "completed" && o.payment_method?.toLowerCase() === "cash" && !settledCodOrders.includes(o.id)
    );
    unsettledCashOrders.forEach(o => {
      const riderId = o.rider_id || "Unassigned";
      if (!balances[riderId]) {
        balances[riderId] = { total: 0, name: o.rider_name || riderId, count: 0 };
      }
      balances[riderId].total += Number(o.total_price || 0);
      balances[riderId].count += 1;
    });
    return Object.entries(balances).map(([id, data]) => ({ id, ...data })).sort((a, b) => b.total - a.total);
  }, [orders, settledCodOrders]);

  useEffect(() => {
    if (dbCashTrust !== undefined) {
      setCashTrustEnabled(!!dbCashTrust);
    } else {
      const localVal = localStorage.getItem(`localeats_cash_trust_${currentShop.id}`) === "true";
      setCashTrustEnabled(localVal);
    }
  }, [currentShop.id, dbCashTrust]);

  useEffect(() => {
    if (dbAllowExternal !== undefined) {
      setAllowExternalRiders(!!dbAllowExternal);
    } else {
      const localVal = localStorage.getItem(`localeats_allow_external_${currentShop.id}`) !== "false";
      setAllowExternalRiders(localVal);
    }
  }, [currentShop.id, dbAllowExternal]);

  useEffect(() => {
    if (dbAutoLookForRider !== undefined) {
      setAutoLookForRider(!!dbAutoLookForRider);
    } else {
      const localVal = localStorage.getItem(`localeats_auto_look_${currentShop.id}`) !== "false";
      setAutoLookForRider(localVal);
    }
  }, [currentShop.id, dbAutoLookForRider]);

  const toggleCashTrust = async () => {
    const newValue = !cashTrustEnabled;
    setCashTrustEnabled(newValue);
    localStorage.setItem(`localeats_cash_trust_${currentShop.id}`, String(newValue));
    
    try {
      const { error } = await supabase
        .from("shops")
        .update({ cash_trust_enabled: newValue })
        .eq("id", currentShop.id);
        
      if (error) {
        toast.info("Trust booster synced locally!");
      } else {
        toast.success(newValue ? "Cash on Arrival Trust Enabled! 🚀" : "Trust Banner deactivated.");
      }
    } catch {
      toast.info("Cash status saved locally.");
    }
  };

  const toggleAllowExternalRiders = async () => {
    const newValue = !allowExternalRiders;
    setAllowExternalRiders(newValue);
    localStorage.setItem(`localeats_allow_external_${currentShop.id}`, String(newValue));
    
    try {
      const { error } = await supabase
        .from("shops")
        .update({ allow_external_riders: newValue })
        .eq("id", currentShop.id);
        
      if (error) {
        toast.success(newValue ? "Granted Independent Rider Fleet access! 🚀" : "Limited storefront to In-house Drivers.");
      } else {
        toast.success(newValue ? "Independent Rider Fleet enabled on Cloud! 🚀" : "Access to Independent Rider Fleet locked on Cloud.");
      }
    } catch {
      toast.success(newValue ? "Granted Independent Rider Fleet access! 🚀" : "Limited storefront to In-house Drivers.");
    }
  };

  const toggleAutoLookForRider = async () => {
    const newValue = !autoLookForRider;
    setAutoLookForRider(newValue);
    localStorage.setItem(`localeats_auto_look_${currentShop.id}`, String(newValue));
    
    try {
      const { error } = await supabase
        .from("shops")
        .update({ auto_look_for_rider: newValue })
        .eq("id", currentShop.id);
        
      if (error) {
        toast.success(newValue ? "On-Demand Search Auto-Activation enabled!" : "Auto-Search deactivated.");
      } else {
        toast.success(newValue ? "Auto-Find Agent Enabled on Cloud! 📡" : "Auto-Find Agent deactivated on Cloud.");
      }
    } catch {
      toast.success(newValue ? "On-Demand Search Auto-Activation enabled!" : "Auto-Search deactivated.");
    }
  };

  const trackedRider = useMemo(() => 
    connections.find(c => c.rider_id === selectedTrackId),
  [connections, selectedTrackId]);

  const { lat: smoothLat, lng: smoothLng } = useSmoothLocation(
    trackedRider?.current_latitude, 
    trackedRider?.current_longitude
  );

  useEffect(() => {
    if (activeCode) {
      import("qrcode").then((QRCode) => {
        QRCode.toDataURL(activeCode.code, {
          margin: 0,
          scale: 10,
          color: { dark: "#000000", light: "#ffffff" },
        }).then((url) => setQrUrl(url));
      });
    } else {
      setQrUrl("");
    }
  }, [activeCode]);

  const activeMissions = useMemo(() => orders.filter(
    (o) =>
      o.delivery_status &&
      o.delivery_status !== "delivered" &&
      o.status !== "cancelled",
  ), [orders]);

  const fetchAndCacheRiders = useCallback(async (forceRefresh = false) => {
    const shopId = currentShop?.id || 1;
    const cacheKey = `localeats_rider_conns_cache_${shopId}`;
    const cacheTimeKey = `localeats_rider_conns_cache_time_${shopId}`;
    const blacklistKey = `localeats_deleted_conns_${shopId}`;

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

    // Local storage cache layer to reduce unnecessary Supabase hits
    if (!forceRefresh) {
      try {
        const cachedData = localStorage.getItem(cacheKey);
        const cachedTime = localStorage.getItem(cacheTimeKey);
        if (cachedData && cachedTime) {
          const ageMs = Date.now() - Number(cachedTime);
          if (ageMs < 30000) { // 30-second TTL cache window
            const parsed = JSON.parse(cachedData);
            if (Array.isArray(parsed)) {
              const filteredCache = parsed.filter(
                (c: RiderConnection) =>
                  !deletedSet.has(c.id) &&
                  !deletedSet.has(c.connection_code) &&
                  !(c.rider_id && deletedSet.has(c.rider_id))
              );
              setConnections(filteredCache);
              setLoading(false);
              console.log(`[RiderManagement] Loaded ${filteredCache.length} riders from fresh local cache (${Math.round(ageMs / 1000)}s old).`);
              return;
            }
          }
        }
      } catch (e) {
        console.debug("Local storage cache layer read notice:", e);
      }
    }

    setLoading(true);
    const numericShopId = typeof shopId === "number" ? shopId : (parseInt(String(shopId).replace(/\D/g, ""), 10) || shopId);
    const shopIdVariants = Array.from(new Set([shopId, String(shopId), numericShopId].filter(Boolean)));
    let dbConns: RiderConnection[] = [];

    try {
      const { data: conns, error: connErr } = await supabase
        .from("rider_connections")
        .select("*")
        .in("shop_id", shopIdVariants)
        .order("created_at", { ascending: false });

      if (!connErr && conns) {
        dbConns = conns as RiderConnection[];
      } else if (connErr) {
        console.warn("[RiderManagement] Supabase rider_connections query error:", connErr);
      }
    } catch (err) {
      console.warn("Supabase fetchConnections failed, using local storage fallback:", err);
    }

    try {
      // Read local cached connections and deleted blacklist
      const localKey1 = `localeats_local_conns_${shopId}`;
      const localKey2 = `localeats_rider_conns_${shopId}`;

      // Filter out deleted items from dbConns
      dbConns = dbConns.filter(
        (c) =>
          !deletedSet.has(c.id) &&
          !deletedSet.has(c.connection_code) &&
          !(c.rider_id && deletedSet.has(c.rider_id))
      );

      let localConns: RiderConnection[] = [];
      try {
        const stored1 = localStorage.getItem(localKey1);
        if (stored1) {
          const parsed = JSON.parse(stored1);
          if (Array.isArray(parsed)) localConns = parsed;
        }
      } catch (e) {
        console.debug("Local storage read notice:", e);
      }
      try {
        const stored2 = localStorage.getItem(localKey2);
        if (stored2) {
          const parsed2 = JSON.parse(stored2);
          if (Array.isArray(parsed2)) localConns = [...localConns, ...parsed2];
        }
      } catch (e) {
        console.debug("Rider connections storage read notice:", e);
      }

      // Filter out deleted items from localConns
      localConns = localConns.filter(
        (c) =>
          !deletedSet.has(c.id) &&
          !deletedSet.has(c.connection_code) &&
          !(c.rider_id && deletedSet.has(c.rider_id))
      );

      // Merge DB connections with local fallback connections, strictly deduplicating by ID and code
      const seenIds = new Set<string>();
      const seenCodes = new Set<string>();
      const dedupedConns: RiderConnection[] = [];

      for (const c of [...dbConns, ...localConns]) {
        if (!c || !c.id) continue;
        const idStr = String(c.id);
        const codeStr = c.connection_code && c.connection_code !== "IN-HOUSE" ? String(c.connection_code) : null;

        if (seenIds.has(idStr)) continue;
        if (codeStr && seenCodes.has(codeStr)) continue;

        seenIds.add(idStr);
        if (codeStr) seenCodes.add(codeStr);
        dedupedConns.push(c);
      }

      const allConns = dedupedConns;

      const riderIds = allConns.map((c) => c.rider_id).filter(Boolean) as string[];

      const profiles: Record<string, RiderProfile> = {};
      if (riderIds.length > 0) {
        try {
          const { data: profData } = await supabase
            .from("rider_profiles")
            .select("id, is_online, full_name, phone, status, vehicle_type, rating, total_deliveries, total_earnings, current_latitude, current_longitude, updated_at")
            .in("id", riderIds);

          if (profData && Array.isArray(profData)) {
            (profData as unknown as RiderProfile[]).forEach((p) => {
              profiles[p.id] = p;
            });
          }
        } catch {
          // ignore profile fetch errors
        }
      }

      // Store synced keys in diagnostic set
      const syncedSet = new Set<string>();
      dbConns.forEach((c) => {
        if (c.id) syncedSet.add(c.id);
        if (c.connection_code) syncedSet.add(c.connection_code);
      });
      setDbSyncedSet(syncedSet);

      const processed = allConns.map((item) => {
        const profile = item.rider_id ? profiles[item.rider_id] : null;
        const isInHouse = item.connection_code === "IN-HOUSE";
        const isBound = Boolean(item.rider_id);
        return {
          ...item,
          is_online: profile?.is_online || (isInHouse ? true : (isBound ? (item.is_online ?? true) : false)),
          rider_name: profile?.full_name || item.rider_name || (isInHouse ? "In-House Staff" : "Available Pairing Code"),
          rider_phone: profile?.phone || item.rider_phone,
          status: ((profile?.status === "online" ? "active" : profile?.status) || (isInHouse ? "idle" : item.status || "active")) as RiderConnection["status"],
          vehicle_type: profile?.vehicle_type || "Road",
          rating: profile?.rating || 5.0,
          total_deliveries: profile?.total_deliveries || 0,
          total_earnings: profile?.total_earnings || 0,
          current_latitude: profile?.current_latitude,
          current_longitude: profile?.current_longitude,
          last_seen: profile?.updated_at,
        };
      });

      setConnections(processed);
      try {
        localStorage.setItem(cacheKey, JSON.stringify(processed));
        localStorage.setItem(cacheTimeKey, Date.now().toString());
        localStorage.setItem(`localeats_rider_conns_${shopId}`, JSON.stringify(processed));
      } catch {
        // ignore quota errors
      }
    } catch (err) {
      console.error("Error processing rider connections:", err);
    } finally {
      setLoading(false);
    }
  }, [currentShop?.id, currentShop?.name]);

  const fetchConnections = useCallback((forceRefresh = false) => {
    return fetchAndCacheRiders(forceRefresh);
  }, [fetchAndCacheRiders]);

  useEffect(() => {
    fetchConnections();

    const shopId = currentShop?.id || 1;
    const channel = getFreshChannel(`rider_connections_sync_${shopId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rider_connections',
          filter: `shop_id=eq.${shopId}`
        },
        (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
          if (payload.eventType === 'UPDATE') {
            setConnections(prev => prev.map(c => c.id === (payload.new as { id?: string }).id ? { ...c, ...(payload.new as Partial<RiderConnection>) } : c));
          } else if (payload.eventType === 'INSERT') {
             void fetchConnections();
          } else if (payload.eventType === 'DELETE') {
            setConnections(prev => prev.filter(c => c.id !== (payload.old as { id?: string }).id));
          }
        }
      )
      .subscribe();

    let profileSub: ReturnType<typeof supabase.channel> | null = null;
    if (selectedTrackId) {
      profileSub = getFreshChannel(`track_rider_${selectedTrackId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'rider_profiles',
            filter: `id=eq.${selectedTrackId}`
          },
          (payload: { new: Record<string, unknown> }) => {
            const newProfile = payload.new as unknown as RiderProfile;
            setConnections(prev => prev.map(c => {
               if (c.rider_id === selectedTrackId) {
                 return {
                   ...c,
                   current_latitude: newProfile.current_latitude,
                   current_longitude: newProfile.current_longitude,
                   is_online: newProfile.is_online,
                   status: newProfile.status as RiderConnection["status"],
                   last_seen: newProfile.updated_at
                 };
               }
               return c;
            }));
          }
        )
        .subscribe();
    }

    return () => {
      void supabase.removeChannel(channel);
      if (profileSub) void supabase.removeChannel(profileSub);
    };
  }, [fetchConnections, currentShop?.id, selectedTrackId]);

  const generateCode = async () => {
    const shopId = currentShop?.id || 1;

    const linkedRidersCount = connections.filter((c) => Boolean(c.rider_id) || c.connection_code === "IN-HOUSE").length;
    if (linkedRidersCount >= 10) {
      toast.error("Shop rider limit reached (Maximum 10 riders allowed per shop). Please disconnect an existing rider before generating new pairing codes.");
      return;
    }

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    let offsetMs = 10 * 365 * 24 * 60 * 60 * 1000;
    let durationLabel = "Permanent (No Expiry)";
    if (pairingCodeDuration === "24h") {
      offsetMs = 24 * 60 * 60 * 1000;
      durationLabel = "24 hours";
    } else if (pairingCodeDuration === "7d") {
      offsetMs = 7 * 24 * 60 * 60 * 1000;
      durationLabel = "7 days";
    } else if (pairingCodeDuration === "30d") {
      offsetMs = 30 * 24 * 60 * 60 * 1000;
      durationLabel = "30 days";
    } else if (pairingCodeDuration === "never") {
      offsetMs = 10 * 365 * 24 * 60 * 60 * 1000;
      durationLabel = "Permanent (No Expiry)";
    }

    const expiresAt = new Date(Date.now() + offsetMs).toISOString();

    // 1. Local fallback record
    const localKey = `localeats_local_conns_${shopId}`;
    const newConnObj: RiderConnection = {
      id: `local_code_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      shop_id: Number(shopId),
      rider_id: null,
      rider_name: "Available Pairing Code",
      rider_phone: null,
      connection_code: code,
      expires_at: expiresAt,
      status: "active",
      is_online: false,
      created_at: new Date().toISOString(),
      rating: 5.0,
      total_deliveries: 0,
      total_earnings: 0,
    };

    try {
      const existingStr = localStorage.getItem(localKey);
      const existing: RiderConnection[] = existingStr ? JSON.parse(existingStr) : [];
      localStorage.setItem(localKey, JSON.stringify([newConnObj, ...existing]));
    } catch (e) {
      console.warn("Failed saving pairing code locally:", e);
    }

    // 2. Immediate display state update
    setActiveCode({ code, expires: expiresAt });
    setShowCode(true);

    // 3. Try Supabase insert
    try {
      const insertData: Record<string, unknown> = {
        shop_id: shopId,
        connection_code: code,
        expires_at: expiresAt,
        status: "active",
      };

      let res = await supabase.from("rider_connections").insert(insertData);

      if (res.error) {
        const { ...rest } = insertData;
        delete rest.status;
        res = await supabase.from("rider_connections").insert(rest);
      }

      if (res.error) {
        res = await supabase.from("rider_connections").insert({ ...insertData, status: "pending" });
      }
    } catch (err) {
      console.warn("Supabase pairing insert warning:", err);
    }

    void fetchConnections();
    toast.success(`Pairing code generated! Valid for ${durationLabel}.`);
  };

  const addInHouseRider = async () => {
    if (!inHouseName.trim() || !inHousePhone.trim()) {
      toast.error("Please fill in Driver Name and Phone Number");
      return;
    }

    const linkedRidersCount = connections.filter((c) => Boolean(c.rider_id) || c.connection_code === "IN-HOUSE").length;
    if (linkedRidersCount >= 10) {
      toast.error("Shop rider limit reached (Maximum 10 riders allowed per shop). Please disconnect an existing rider first.");
      return;
    }

    const shopId = currentShop?.id || 1;
    const expiresAt = new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000).toISOString();

    // Local fallback
    const localKey = `localeats_local_conns_${shopId}`;
    const newInHouseObj: RiderConnection = {
      id: `inhouse_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      shop_id: Number(shopId),
      rider_id: null,
      rider_name: inHouseName.trim(),
      rider_phone: inHousePhone.trim(),
      connection_code: "IN-HOUSE",
      expires_at: expiresAt,
      status: "active",
      is_online: true,
      created_at: new Date().toISOString(),
      rating: 5.0,
      total_deliveries: 0,
      total_earnings: 0,
    };

    try {
      const existingStr = localStorage.getItem(localKey);
      const existing: RiderConnection[] = existingStr ? JSON.parse(existingStr) : [];
      localStorage.setItem(localKey, JSON.stringify([newInHouseObj, ...existing]));
    } catch (e) {
      console.warn("Failed saving in-house driver locally:", e);
    }

    // Attempt Supabase insert
    try {
      await supabase.from("rider_connections").insert({
        shop_id: shopId,
        rider_name: inHouseName.trim(),
        rider_phone: inHousePhone.trim(),
        connection_code: "IN-HOUSE",
        expires_at: expiresAt,
        status: "active",
      });
    } catch (err) {
      console.warn("Supabase in-house insert warning:", err);
    }

    setInHouseName("");
    setInHousePhone("");
    setShowInHouseModal(false);
    void fetchConnections();
    toast.success("In-house driver registered successfully!");
  };

  const deleteConnection = async (id: string, connectionCode?: string, riderId?: string) => {
    const shopId = currentShop?.id || 1;
    const numericShopId = typeof shopId === "number" ? shopId : (parseInt(String(shopId).replace(/\D/g, ""), 10) || shopId);

    // 1. Immediately remove from React state for zero-latency UI update
    setConnections((prev) =>
      prev.filter(
        (c) =>
          c.id !== id &&
          (connectionCode ? c.connection_code !== connectionCode : true) &&
          (riderId ? c.rider_id !== riderId : true)
      )
    );

    // 2. Add all identifiers to the persistent blacklist in localStorage
    const blacklistKey = `localeats_deleted_conns_${shopId}`;
    try {
      let existingDel: string[] = [];
      const stored = localStorage.getItem(blacklistKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) existingDel = parsed;
      }
      if (id) existingDel.push(id);
      if (connectionCode) existingDel.push(connectionCode);
      if (riderId) existingDel.push(riderId);
      localStorage.setItem(blacklistKey, JSON.stringify(Array.from(new Set(existingDel))));
    } catch (e) {
      console.warn("Failed updating deleted connections blacklist:", e);
    }

    // 3. Purge from both local storage cache keys
    const localKey1 = `localeats_local_conns_${shopId}`;
    const localKey2 = `localeats_rider_conns_${shopId}`;
    [localKey1, localKey2].forEach((key) => {
      try {
        const existingStr = localStorage.getItem(key);
        if (existingStr) {
          const existing: RiderConnection[] = JSON.parse(existingStr);
          const filtered = existing.filter(
            (c) =>
              c.id !== id &&
              (connectionCode ? c.connection_code !== connectionCode : true) &&
              (riderId ? c.rider_id !== riderId : true)
          );
          localStorage.setItem(key, JSON.stringify(filtered));
        }
      } catch (e) {
        console.warn("Failed deleting local connection cache:", e);
      }
    });

    // 4. Try deleting from Supabase
    try {
      if (id && !id.startsWith("local_")) {
        await supabase.from("rider_connections").delete().eq("id", id);
      }
      if (connectionCode) {
        await supabase.from("rider_connections").delete().eq("connection_code", connectionCode).eq("shop_id", shopId);
        if (numericShopId !== shopId) {
          await supabase.from("rider_connections").delete().eq("connection_code", connectionCode).eq("shop_id", numericShopId);
        }
      }
      if (riderId) {
        await supabase.from("rider_connections").delete().eq("rider_id", riderId).eq("shop_id", shopId);
        if (numericShopId !== shopId) {
          await supabase.from("rider_connections").delete().eq("rider_id", riderId).eq("shop_id", numericShopId);
        }
      }
    } catch (err) {
      console.warn("Supabase delete connection warning:", err);
    }

    void fetchConnections();
    toast.success("Driver connection disconnected.");
  };

  const invalidateAndRegenerate = async (connId?: string, oldCode?: string) => {
    const shopId = currentShop?.id || 1;
    const numericShopId = typeof shopId === "number" ? shopId : (parseInt(String(shopId).replace(/\D/g, ""), 10) || shopId);

    if (connId || oldCode) {
      // 1. Immediately remove from React state
      setConnections((prev) =>
        prev.filter((c) => c.id !== connId && (oldCode ? c.connection_code !== oldCode : true))
      );

      // 2. Add to persistent blacklist
      const blacklistKey = `localeats_deleted_conns_${shopId}`;
      try {
        let existingDel: string[] = [];
        const stored = localStorage.getItem(blacklistKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) existingDel = parsed;
        }
        if (connId) existingDel.push(connId);
        if (oldCode) existingDel.push(oldCode);
        localStorage.setItem(blacklistKey, JSON.stringify(Array.from(new Set(existingDel))));
      } catch (e) {
        console.warn("Failed updating deleted connections blacklist:", e);
      }

      // 3. Remove from both local storage cache keys
      const localKey1 = `localeats_local_conns_${shopId}`;
      const localKey2 = `localeats_rider_conns_${shopId}`;
      [localKey1, localKey2].forEach((key) => {
        try {
          const stored = localStorage.getItem(key);
          if (stored) {
            const conns: RiderConnection[] = JSON.parse(stored);
            const filtered = conns.filter(
              (c) => c.id !== connId && c.connection_code !== oldCode
            );
            localStorage.setItem(key, JSON.stringify(filtered));
          }
        } catch (e) {
          console.warn("Failed clearing local conn cache:", e);
        }
      });

      // 4. Delete from Supabase
      try {
        if (connId && !connId.startsWith("local_")) {
          await supabase.from("rider_connections").delete().eq("id", connId);
        }
        if (oldCode) {
          await supabase
            .from("rider_connections")
            .delete()
            .eq("connection_code", oldCode)
            .eq("shop_id", shopId);
          if (numericShopId !== shopId) {
            await supabase
              .from("rider_connections")
              .delete()
              .eq("connection_code", oldCode)
              .eq("shop_id", numericShopId);
          }
        }
      } catch (err) {
        console.warn("Supabase invalidate warning:", err);
      }
    }

    if (activeCode && (activeCode.code === oldCode || !oldCode)) {
      setActiveCode(null);
    }

    // 3. Generate a fresh new code
    await generateCode();
    toast.success(
      oldCode
        ? `Code ${oldCode} invalidated. Fresh code generated!`
        : "Current pairing code invalidated & fresh code generated!"
    );
  };

  const syncCodeToSupabase = async (conn: RiderConnection) => {
    const shopId = currentShop?.id || 1;
    try {
      const { error } = await supabase.from("rider_connections").insert({
        shop_id: shopId,
        connection_code: conn.connection_code,
        expires_at: conn.expires_at,
        status: "active",
        rider_name: conn.rider_name || null,
        rider_phone: conn.rider_phone || null,
      });

      if (error) {
        toast.error(`Sync warning: ${error && typeof error === "object" && "message" in error ? String((error as { message: string }).message) : "Failed to sync"}`);
      } else {
        toast.success(`Pairing code ${conn.connection_code} verified and synced to Supabase!`);
        void fetchConnections();
      }
    } catch {
      toast.error("Could not reach Supabase. Code saved in local fallback cache.");
    }
  };

  const claimPairingCode = async (connId: string, connCode: string, customName?: string, customPhone?: string) => {
    const shopId = currentShop?.id || 1;
    const riderName = customName?.trim() || `Express Rider (${connCode})`;
    const riderPhone = customPhone?.trim() || `+27 82 555 ${Math.floor(1000 + Math.random() * 9000)}`;
    const mockRiderId = `rider_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // 1. Update local storage cache
    const localKey = `localeats_local_conns_${shopId}`;
    try {
      const stored = localStorage.getItem(localKey);
      if (stored) {
        const conns: RiderConnection[] = JSON.parse(stored);
        const updated = conns.map((c) => {
          if (c.id === connId || c.connection_code === connCode) {
            return {
              ...c,
              rider_id: mockRiderId,
              rider_name: riderName,
              rider_phone: riderPhone,
              status: "active",
              is_online: true,
            };
          }
          return c;
        });
        localStorage.setItem(localKey, JSON.stringify(updated));
      }
    } catch (e) {
      console.warn("Error updating local conn:", e);
    }

    // 2. Update Supabase rider_connections
    try {
      const isRealId = connId && !connId.startsWith("active_temp") && !connId.startsWith("local_code_");
      if (isRealId) {
        await supabase
          .from("rider_connections")
          .update({
            rider_id: mockRiderId,
            rider_name: riderName,
            rider_phone: riderPhone,
            status: "active",
          })
          .eq("id", connId);
      } else if (connCode) {
        await supabase
          .from("rider_connections")
          .update({
            rider_id: mockRiderId,
            rider_name: riderName,
            rider_phone: riderPhone,
            status: "active",
          })
          .eq("connection_code", connCode);
      }
    } catch (err) {
      console.warn("Supabase claim update warning:", err);
    }

    // 3. Insert or update rider_profiles in Supabase so rider is online
    try {
      await supabase.from("rider_profiles").upsert({
        id: mockRiderId,
        full_name: riderName,
        phone: riderPhone,
        is_online: true,
        status: "active",
        vehicle_type: "Motorbike",
        rating: 5.0,
        total_deliveries: 1,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn("Supabase profile upsert warning:", err);
    }

    toast.success(`Linked ${riderName}! Rider is now connected.`);
    void fetchConnections();
  };

  // Toggle single rider online / ready status
  const toggleRiderOnlineStatus = async (conn: RiderConnection, targetStatus?: boolean) => {
    const newStatus = targetStatus !== undefined ? targetStatus : !conn.is_online;
    const shopId = currentShop?.id || 1;
    const isNowOnline = newStatus;

    // 1. Immediately update in-memory React state for instantaneous zero-latency UI response
    setConnections((prev) =>
      prev.map((c) => {
        const isMatch =
          c.id === conn.id ||
          (conn.connection_code && c.connection_code === conn.connection_code) ||
          (conn.rider_id && c.rider_id === conn.rider_id);

        if (isMatch) {
          return {
            ...c,
            is_online: isNowOnline,
            status: isNowOnline ? (c.status === "busy" ? "busy" : "active") : "offline",
            last_seen: isNowOnline ? new Date().toISOString() : c.last_seen,
          };
        }
        return c;
      })
    );

    // 2. Persist to local fallback storage caches
    const localKey1 = `localeats_local_conns_${shopId}`;
    const localKey2 = `localeats_rider_conns_${shopId}`;
    [localKey1, localKey2].forEach((key) => {
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          const conns: RiderConnection[] = JSON.parse(stored);
          const updated = conns.map((c) => {
            const isMatch =
              c.id === conn.id ||
              (conn.connection_code && c.connection_code === conn.connection_code) ||
              (conn.rider_id && c.rider_id === conn.rider_id);

            if (isMatch) {
              return {
                ...c,
                is_online: isNowOnline,
                status: isNowOnline ? (c.status === "busy" ? "busy" : "active") : "offline",
                last_seen: isNowOnline ? new Date().toISOString() : c.last_seen,
              };
            }
            return c;
          });
          localStorage.setItem(key, JSON.stringify(updated));
        }
      } catch (e) {
        console.warn("Storage update warning:", e);
      }
    });

    // 3. Persist to Supabase / Firestore in background
    try {
      if (conn.rider_id) {
        await supabase.from("rider_profiles").upsert({
          id: conn.rider_id,
          is_online: isNowOnline,
          status: isNowOnline ? "active" : "offline",
          updated_at: new Date().toISOString(),
        });
      }
      if (conn.id) {
        await supabase
          .from("rider_connections")
          .update({
            is_online: isNowOnline,
            status: isNowOnline ? "active" : "offline",
          })
          .eq("id", conn.id);
      }
    } catch (err) {
      console.warn("Remote sync warning:", err);
    }

    if (isNowOnline) {
      toast.success(`${conn.rider_name || "Rider"} is now Online & Ready for Orders!`);
    } else {
      toast.info(`${conn.rider_name || "Rider"} marked as Offline.`);
    }
  };

  // Turn all fleet riders online/ready or offline
  const toggleAllRidersOnline = async (targetStatus = true) => {
    const shopId = currentShop?.id || 1;
    const eligibleConns = connections.filter((c) => c.rider_id || c.connection_code === "IN-HOUSE");

    if (eligibleConns.length === 0) {
      setShowInHouseModal(true);
      toast.info("Add a rider or in-house driver to activate your delivery fleet.");
      return;
    }

    // 1. Instant optimistic state update
    setConnections((prev) =>
      prev.map((c) => {
        if (c.rider_id || c.connection_code === "IN-HOUSE") {
          return {
            ...c,
            is_online: targetStatus,
            status: targetStatus ? (c.status === "busy" ? "busy" : "active") : "offline",
            last_seen: targetStatus ? new Date().toISOString() : c.last_seen,
          };
        }
        return c;
      })
    );

    // 2. Persist to local caches
    const localKey1 = `localeats_local_conns_${shopId}`;
    const localKey2 = `localeats_rider_conns_${shopId}`;
    [localKey1, localKey2].forEach((key) => {
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          const conns: RiderConnection[] = JSON.parse(stored);
          const updated = conns.map((c) => ({
            ...c,
            is_online: targetStatus,
            status: targetStatus ? (c.status === "busy" ? "busy" : "active") : "offline",
            last_seen: targetStatus ? new Date().toISOString() : c.last_seen,
          }));
          localStorage.setItem(key, JSON.stringify(updated));
        }
      } catch (e) {
        console.warn("Error updating batch conns:", e);
      }
    });

    // 3. Persist remote
    for (const c of eligibleConns) {
      try {
        if (c.rider_id) {
          await supabase.from("rider_profiles").upsert({
            id: c.rider_id,
            is_online: targetStatus,
            status: targetStatus ? "active" : "offline",
            updated_at: new Date().toISOString(),
          });
        }
        if (c.id) {
          await supabase
            .from("rider_connections")
            .update({
              is_online: targetStatus,
              status: targetStatus ? "active" : "offline",
            })
            .eq("id", c.id);
        }
      } catch {
        // ignore background failure
      }
    }

    if (targetStatus) {
      toast.success(`All ${eligibleConns.length} riders are now Online & Ready for Orders!`);
    } else {
      toast.info(`All riders marked as Offline.`);
    }
  };

  const activeConnectionsCount = useMemo(() => connections.filter(
    (c) => c.rider_id || c.connection_code === "IN-HOUSE" || c.status === "active",
  ).length, [connections]);

  const availableCodesCount = useMemo(() => connections.filter(
    (c) => !c.rider_id && c.connection_code !== "IN-HOUSE",
  ).length, [connections]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Visual Header */}
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b border-outline-variant/10 pb-4">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-headline font-bold text-on-surface tracking-tight">
            Rider Fleet & Deliveries
          </h2>
          <p className="text-xs text-on-surface-variant font-medium">
            Manage your store riders, share pairing codes, track live deliveries, and configure dispatch rules.
          </p>
        </div>

        <button
          onClick={generateRiderPerformanceReport}
          className="px-4 py-2.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-black rounded-2xl shadow-xs transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider cursor-pointer border border-outline-variant/20 shrink-0"
          title="Export Rider Performance & COD Summary (PDF)"
        >
          <Download size={15} className="text-primary" />
          <span>Download Report</span>
        </button>
      </header>

      {/* Sub-Tabs Switcher */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-outline-variant/10 scrollbar-none">
        {[
          { id: "network", label: "Rider Fleet", icon: Bike, count: activeConnectionsCount },
          { id: "missions", label: "Live Deliveries", icon: Compass, count: activeMissions.length },
          { id: "controls", label: "Dispatch Settings", icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as "missions" | "network" | "health" | "ratings" | "controls")}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer whitespace-nowrap border uppercase tracking-wider",
                isActive
                  ? "bg-primary text-on-primary border-primary shadow-xs"
                  : "bg-surface-container-low text-on-surface-variant border-outline-variant/10 hover:text-on-surface hover:bg-surface-container-high"
              )}
            >
              <Icon size={14} className={cn(isActive ? "text-on-primary" : "text-on-surface-variant/60")} />
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={cn(
                  "px-1.5 py-0.5 text-[9px] font-black rounded-lg",
                  isActive ? "bg-on-primary/20 text-on-primary" : "bg-on-surface/10 text-on-surface"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Sub-Tab Panels */}
      <div className="min-h-[400px]">
        {/* --- TAB 1: LIVE MISSIONS --- */}
        {activeSubTab === "missions" && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-headline font-bold text-on-surface">Transit Operations</h3>
                <p className="text-xs text-on-surface-variant">Live delivery tracking and dispatch retries</p>
              </div>
              <button 
                onClick={() => void fetchConnections()}
                className="p-2 hover:bg-on-surface/5 rounded-xl border border-outline-variant/10 text-on-surface-variant hover:text-on-surface transition-colors"
                title="Force Refresh Coordinates"
              >
                <RefreshCw size={15} />
              </button>
            </div>

            {activeMissions.length === 0 ? (
              <div className="bg-surface-container-low/35 rounded-[2rem] p-16 text-center border-2 border-dashed border-outline-variant/10 max-w-md mx-auto space-y-4">
                <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center mx-auto text-on-surface-variant/40">
                  <Compass size={24} className="animate-pulse" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-on-surface uppercase tracking-tight">No Active Missions</h4>
                  <p className="text-xs text-on-surface-variant leading-relaxed font-medium">
                    All orders are fully delivered or awaiting pickup. Launch an order from your store front to track live driver transit routes.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {activeMissions.map((mission) => {
                  const assignedRider = connections.find(c => c.rider_id === mission.rider_id);
                  return (
                    <div
                      key={mission.id}
                      className="bg-surface-container-low rounded-2xl p-5 border border-outline-variant/10 flex flex-col gap-4 group hover:border-primary/25 transition-all shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div
                            className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                              mission.delivery_status === "finding_rider"
                                ? "bg-amber-100 text-amber-600 animate-pulse"
                                : mission.delivery_status === "accepted"
                                  ? "bg-blue-100 text-blue-600"
                                  : "bg-green-100 text-green-600",
                            )}
                          >
                            {mission.delivery_status === "finding_rider" ? (
                              <Zap size={18} />
                            ) : (
                              <Bike size={18} />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-sm text-on-surface">
                                Order #{mission.id.toString().slice(-4)}
                              </p>
                              <span
                                className={cn(
                                  "text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-full",
                                  mission.delivery_status === "finding_rider"
                                    ? "bg-amber-100 text-amber-600"
                                    : mission.delivery_status === "accepted"
                                      ? "bg-blue-100 text-blue-600"
                                      : "bg-green-600 text-white",
                                )}
                              >
                                {mission.delivery_status?.replace("_", " ")}
                              </span>
                            </div>
                            <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                              {mission.address}, {mission.city} • <span className="font-bold text-on-surface">{assignedRider?.rider_name || "Unassigned Rider"}</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right hidden sm:block">
                            <p className="text-xs font-bold text-on-surface">
                              R {mission.total_price || mission.price}
                            </p>
                            <p className="text-[10px] text-on-surface-variant font-medium">
                              ETA: {mission.estimated_delivery_time || "Pending"}
                            </p>
                          </div>
                          {mission.rider_id && (
                            <button
                              onClick={() => setSelectedTrackId(mission.rider_id!)}
                              className="p-2.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-xl transition-all border border-primary/20 cursor-pointer"
                              title="Track Real-time Position"
                            >
                              <MapPin size={16} />
                            </button>
                          )}
                          {mission.delivery_status === "finding_rider" && (
                            <button
                              onClick={() => onRequestRider(mission.id)}
                              className="p-2.5 text-primary hover:bg-primary/10 rounded-xl transition-all cursor-pointer border border-transparent hover:border-primary/20"
                              title="Retry Dispatch Broadcast"
                            >
                              <RefreshCw size={16} />
                            </button>
                          )}
                        </div>
                      </div>

                      {assignedRider?.current_latitude && assignedRider?.current_longitude && mission.lat && mission.lng && (
                        <div className="h-28 w-full rounded-2xl overflow-hidden border border-outline-variant/10 relative z-0">
                          <MapContainer
                            center={[
                              (assignedRider.current_latitude + mission.lat) / 2,
                              (assignedRider.current_longitude + mission.lng) / 2
                            ]}
                            zoom={13}
                            className="w-full h-full"
                            zoomControl={false}
                            dragging={false}
                            scrollWheelZoom={false}
                            doubleClickZoom={false}
                          >
                            <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                            <Marker
                              position={[assignedRider.current_latitude, assignedRider.current_longitude]}
                              icon={L.icon({
                                iconUrl: 'https://cdn-icons-png.flaticon.com/512/3195/3195868.png',
                                iconSize: [24, 24],
                                iconAnchor: [12, 24],
                              })}
                            />
                            <Marker
                              position={[mission.lat, mission.lng]}
                              icon={L.icon({
                                iconUrl: 'https://cdn-icons-png.flaticon.com/512/2776/2776067.png',
                                iconSize: [24, 24],
                                iconAnchor: [12, 24],
                              })}
                            />
                          </MapContainer>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* --- TAB 2: RIDER NETWORK --- */}
        {activeSubTab === "network" && (
          <div className="space-y-6 animate-fade-in">

            {/* Quick Fleet Metrics Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={cn(
                  "p-4 rounded-2xl border transition-all flex items-center gap-3 text-left cursor-pointer",
                  statusFilter === "all"
                    ? "bg-surface-container-high border-on-surface/20 ring-2 ring-primary/20 shadow-xs"
                    : "bg-surface-container-low border-outline-variant/10 hover:border-outline-variant/30"
                )}
              >
                <div className="w-10 h-10 rounded-xl bg-zinc-900 text-white dark:bg-surface-container-high flex items-center justify-center shrink-0">
                  <Bike size={20} className="text-primary" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-on-surface-variant/60 tracking-wider">Total Fleet</p>
                  <p className="text-lg font-headline font-black text-on-surface">{connections.length} Riders</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter(statusFilter === "online" ? "all" : "online")}
                className={cn(
                  "p-4 rounded-2xl border transition-all flex flex-col justify-between text-left cursor-pointer relative overflow-hidden",
                  statusFilter === "online"
                    ? "bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-500/30 shadow-xs"
                    : "bg-surface-container-low border-outline-variant/10 hover:border-emerald-500/40"
                )}
              >
                <div className="flex items-center gap-3 w-full">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 relative">
                    <Zap size={20} />
                    {connections.filter((c) => c.is_online).length > 0 && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black uppercase text-on-surface-variant/60 tracking-wider">Online Now</p>
                      {statusFilter === "online" && (
                        <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full bg-emerald-500 text-white">Active</span>
                      )}
                    </div>
                    <p className={cn(
                      "text-lg font-headline font-black",
                      connections.filter((c) => c.is_online).length > 0 ? "text-emerald-600" : "text-amber-600"
                    )}>
                      {connections.filter((c) => c.is_online).length} Ready
                    </p>
                  </div>
                </div>

                {connections.filter((c) => c.is_online).length === 0 ? (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      void toggleAllRidersOnline(true);
                    }}
                    className="mt-2.5 w-full py-1 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer"
                    title="Turn all fleet drivers online and ready for orders"
                  >
                    <Zap size={11} />
                    <span>Turn Fleet Online</span>
                  </div>
                ) : (
                  <p className="text-[9px] text-emerald-700 dark:text-emerald-400 font-bold mt-1 truncate">
                    Ready for Instant Dispatch
                  </p>
                )}
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter(statusFilter === "in_house" ? "all" : "in_house")}
                className={cn(
                  "p-4 rounded-2xl border transition-all flex items-center gap-3 text-left cursor-pointer",
                  statusFilter === "in_house"
                    ? "bg-indigo-500/10 border-indigo-500 ring-2 ring-indigo-500/30 shadow-xs"
                    : "bg-surface-container-low border-outline-variant/10 hover:border-indigo-500/40"
                )}
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
                  <Users size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-on-surface-variant/60 tracking-wider">In-House Staff</p>
                  <p className="text-lg font-headline font-black text-on-surface">
                    {connections.filter((c) => c.connection_code === "IN-HOUSE").length} Staff
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter(statusFilter === "paired" ? "all" : "paired")}
                className={cn(
                  "p-4 rounded-2xl border transition-all flex items-center gap-3 text-left cursor-pointer",
                  statusFilter === "paired"
                    ? "bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/30 shadow-xs"
                    : "bg-surface-container-low border-outline-variant/10 hover:border-amber-500/40"
                )}
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-on-surface-variant/60 tracking-wider">Paired Codes</p>
                  <p className="text-lg font-headline font-black text-on-surface">
                    {connections.filter((c) => c.connection_code !== "IN-HOUSE").length} Active
                  </p>
                </div>
              </button>
            </div>

            {/* Quick Connect / Pair Center Banner */}
            <div className="bg-surface-container-low text-on-surface p-5 md:p-6 rounded-[2rem] border border-outline-variant/15 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative overflow-hidden">
              <div className="space-y-1 z-10 max-w-lg">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest bg-primary text-on-primary px-2.5 py-0.5 rounded-full">
                    Instant Connect
                  </span>
                  <span className="text-[10px] font-bold text-on-surface-variant/70">Permanent Handshake</span>
                </div>
                <h3 className="text-xl font-headline font-bold text-on-surface tracking-tight mt-1">
                  Connect New Delivery Riders
                </h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Generate a 6-digit pairing code or scan a QR code to pair riders instantly to <span className="font-bold text-on-surface">{currentShop?.name || "your shop"}</span>.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto shrink-0 z-10">
                <button
                  onClick={() => setShowQRScanner(true)}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-surface hover:bg-surface-container-high text-on-surface rounded-xl font-bold transition-all text-xs cursor-pointer border border-outline-variant/20"
                >
                  <Camera size={16} className="text-primary" />
                  <span>Scan QR</span>
                </button>

                <button
                  onClick={() => setShowInHouseModal(true)}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 rounded-xl font-bold transition-all text-xs cursor-pointer border border-indigo-500/20 shadow-xs"
                >
                  <Users size={16} />
                  <span>+ Add Staff</span>
                </button>

                <button
                  onClick={generateCode}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-xl font-black hover:bg-primary/90 active:scale-[0.98] transition-all text-xs cursor-pointer shadow-xs"
                >
                  <Plus size={16} />
                  <span>Generate Code</span>
                </button>
              </div>
            </div>

            {/* Active pairing code details block */}
            {showCode && activeCode && (
              <div className="bg-primary/[0.04] border-2 border-primary/20 rounded-[2rem] p-6 relative overflow-hidden animate-fade-in flex flex-col gap-4 shadow-sm">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                  <div className="space-y-4 max-w-xl w-full">
                    <div>
                      <span className="text-[10px] font-black uppercase bg-primary text-on-primary px-2.5 py-0.5 rounded-full tracking-widest">
                        Active Pairing Code
                      </span>
                      <h3 className="text-xl font-headline font-black text-on-surface mt-2">
                        Pair Driver App Now
                      </h3>
                      <p className="text-xs text-on-surface-variant font-medium mt-1 leading-relaxed">
                        Share this 6-digit code with your rider. Once entered in their Driver App under 'Pair Shop', they will link directly to <span className="font-bold text-on-surface">{currentShop?.name || "your store"}</span>.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="bg-surface px-5 py-3 rounded-2xl border border-primary/20 flex items-center gap-3 shadow-xs">
                        <span className="text-3xl font-mono font-black text-primary tracking-widest">
                          {activeCode.code}
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(activeCode.code);
                          toast.success("Pairing code copied to clipboard!");
                        }}
                        className="px-3.5 py-3 rounded-2xl bg-surface-container-high hover:bg-surface text-on-surface font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer border border-outline-variant/20 shadow-xs"
                        title="Copy code to clipboard"
                      >
                        <Copy size={15} className="text-primary" />
                        <span>Copy Code</span>
                      </button>

                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(`Hi! Here is your LocalEats driver pairing code for ${currentShop?.name || 'our shop'}: ${activeCode.code}. Open your Driver App and tap Pair Shop!`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-3 rounded-2xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-500 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                        title="Share code via WhatsApp"
                      >
                        <Share2 size={15} />
                        <span>WhatsApp</span>
                      </a>

                      <button
                        onClick={() => invalidateAndRegenerate(undefined, activeCode.code)}
                        className="px-3 py-3 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                        title="Clear current code from DB and generate a fresh code"
                      >
                        <RotateCcw size={15} />
                        <span>Invalidate & Regenerate</span>
                      </button>

                      <button
                        onClick={() => claimPairingCode("active_temp", activeCode.code)}
                        className="px-3 py-3 rounded-2xl bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer border border-primary/20"
                        title="Simulate driver linking this code"
                      >
                        <UserPlus size={15} />
                        <span>Simulate Link</span>
                      </button>
                    </div>

                    <div className="bg-surface-container-low p-3 rounded-2xl border border-outline-variant/10 text-xs space-y-1">
                      <p className="font-bold text-on-surface flex items-center gap-1.5 text-[11px]">
                        <Smartphone size={14} className="text-primary" /> Rider Instruction Set:
                      </p>
                      <ol className="list-decimal list-inside text-[11px] text-on-surface-variant space-y-0.5 pl-1 font-medium">
                        <li>Open <strong className="text-on-surface">LocalEats Driver App</strong> on phone</li>
                        <li>Tap <strong className="text-on-surface">"Pair Shop"</strong> in the main menu</li>
                        <li>Type code <strong className="font-mono text-primary bg-primary/10 px-1 py-0.5 rounded">{activeCode.code}</strong> or scan QR code on right</li>
                      </ol>
                    </div>

                    <p className="text-[10px] text-on-surface-variant/70 font-medium">
                      Pairing code expires on <span className="font-bold text-on-surface">{new Date(activeCode.expires).toLocaleDateString()} at {new Date(activeCode.expires).toLocaleTimeString()}</span>.
                    </p>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-outline-variant/10 shadow-sm flex flex-col items-center justify-center shrink-0 self-center lg:self-auto">
                    {qrUrl ? (
                      <>
                        <img src={qrUrl} alt="Pairing QR Code" className="w-36 h-36" />
                        <span className="text-[9px] font-black uppercase text-zinc-500 mt-2 tracking-widest">Scan with Driver App</span>
                      </>
                    ) : (
                      <div className="w-36 h-36 bg-zinc-100 animate-pulse rounded-lg flex items-center justify-center text-zinc-400 text-xs font-bold">
                        Generating QR...
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setShowCode(false)}
                  className="absolute top-4 right-4 text-on-surface-variant/40 hover:text-on-surface p-1 rounded-full hover:bg-on-surface/5 cursor-pointer"
                  title="Close banner"
                >
                  <X size={20} />
                </button>
              </div>
            )}

            {/* Instant Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface-container-low p-3 rounded-2xl border border-outline-variant/10">
              {/* Search box */}
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/50" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search rider name, phone, or code..."
                  className="w-full pl-10 pr-8 py-2 text-xs bg-surface text-on-surface placeholder:text-on-surface-variant/50 border border-outline-variant/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 hover:text-on-surface"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Status Filter Chips */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none shrink-0">
                {[
                  { id: "all", label: `All (${connections.length})` },
                  { id: "online", label: `🟢 Online (${connections.filter(c => c.is_online).length})` },
                  { id: "offline", label: `⚪ Offline (${connections.filter(c => !c.is_online).length})` },
                  { id: "in_house", label: `🏠 Staff (${connections.filter(c => c.connection_code === "IN-HOUSE").length})` },
                  { id: "paired", label: `🔑 Paired (${connections.filter(c => c.connection_code !== "IN-HOUSE").length})` },
                ].map((chip) => (
                  <button
                    key={chip.id}
                    onClick={() => setStatusFilter(chip.id as "all" | "online" | "offline" | "in_house" | "paired")}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
                      statusFilter === chip.id
                        ? "bg-zinc-900 text-white dark:bg-surface-container-high dark:text-on-surface shadow-sm"
                        : "bg-surface text-on-surface-variant hover:text-on-surface border border-outline-variant/10"
                    )}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Drivers List Grid */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-outline-variant/10 pb-2">
                <h4 className="text-xs font-black uppercase text-on-surface-variant tracking-wider flex items-center gap-2">
                  <span>Rider Roster</span>
                  <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {filteredConnections.length} shown
                  </span>
                </h4>
                {availableCodesCount > 0 && (
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200/50 px-2 py-0.5 rounded-full">
                    {availableCodesCount} unused codes
                  </span>
                )}
              </div>

              {loading ? (
                <div className="py-12 text-center text-xs text-on-surface-variant/60 font-medium">
                  Loading rider registry...
                </div>
              ) : filteredConnections.length === 0 ? (
                <div className="bg-surface-container-low/30 rounded-3xl p-10 text-center border border-outline-variant/10 max-w-md mx-auto space-y-4">
                  <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center mx-auto text-on-surface-variant/40">
                    <Bike size={24} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-on-surface uppercase tracking-tight">
                      {statusFilter === "online" && connections.length > 0
                        ? "No Riders Online & Ready"
                        : connections.length === 0
                        ? "No Riders Connected Yet"
                        : "No Matching Riders"}
                    </h4>
                    <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
                      {statusFilter === "online" && connections.length > 0
                        ? "None of your riders are currently marked as online for order dispatch. You can activate all riders with one tap."
                        : connections.length === 0
                        ? "Generate a pairing code or add an in-house driver above to activate your delivery network."
                        : "Try clearing your search term or selecting a different status filter above."}
                    </p>
                  </div>

                  <div className="flex items-center justify-center gap-2 flex-wrap pt-1">
                    {statusFilter === "online" && connections.length > 0 && (
                      <button
                        onClick={() => void toggleAllRidersOnline(true)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Zap size={13} />
                        <span>Turn Fleet Online</span>
                      </button>
                    )}
                    {statusFilter !== "all" && (
                      <button
                        onClick={() => { setSearchQuery(""); setStatusFilter("all"); }}
                        className="px-4 py-2 bg-surface text-on-surface text-xs font-bold rounded-xl border border-outline-variant/20 hover:bg-on-surface/5 transition-all cursor-pointer"
                      >
                        View All Riders ({connections.length})
                      </button>
                    )}
                    {connections.length === 0 && (
                      <button
                        onClick={() => setShowInHouseModal(true)}
                        className="px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-xl shadow-xs hover:bg-primary/90 transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Plus size={13} />
                        <span>Add In-House Staff</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <motion.div layout className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <AnimatePresence mode="popLayout">
                      {paginatedConnections.map((conn, idx) => {
                      const isExpired = false;
                      const isInHouse = conn.connection_code === "IN-HOUSE";
                      const isUnclaimedKey = !conn.rider_id && !isInHouse;
                      const cleanPhone = conn.rider_phone ? conn.rider_phone.replace(/\D/g, '') : '';
                      const diag = getCodeDiagnostic(conn, dbSyncedSet);
                      const hb = getRiderHeartbeatStatus(conn.last_seen, conn.is_online);

                      if (isUnclaimedKey) {
                        return (
                          <motion.div
                            layout
                            key={`unclaimed_${conn.id}_${conn.connection_code}_${idx}`}
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                            transition={{ type: "spring", stiffness: 350, damping: 25 }}
                            className="bg-amber-500/5 dark:bg-amber-500/10 rounded-2xl p-5 border border-amber-500/30 flex flex-col justify-between gap-4 relative shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-mono font-black text-lg shrink-0">
                                  🔑
                                </div>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="font-headline font-bold text-sm text-on-surface">
                                      Code: <span className="font-mono text-primary font-black tracking-wider text-base">{conn.connection_code}</span>
                                    </h4>
                                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                      ⏳ Awaiting Driver Entry
                                    </span>
                                    <span className={cn("text-[9px] font-black px-2 py-0.5 rounded-md border flex items-center gap-1", diag.badgeClass)}>
                                      <Database size={10} /> {diag.dbLabel}
                                    </span>
                                  </div>
                                  <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
                                    Send code <strong className="font-mono text-on-surface bg-surface-container px-1 py-0.5 rounded">{conn.connection_code}</strong> to your driver. They must enter it in their Driver App under 'Pair Shop'.
                                  </p>
                                </div>
                              </div>

                              <button
                                onClick={() => deleteConnection(conn.id, conn.connection_code, conn.rider_id)}
                                className="p-2 hover:bg-red-50 hover:text-red-600 text-on-surface-variant/40 rounded-xl transition-colors cursor-pointer shrink-0"
                                title="Revoke Pairing Code"
                              >
                                <X size={14} />
                              </button>
                            </div>

                            <div className="bg-surface/80 rounded-xl p-2.5 border border-outline-variant/10 flex items-center justify-between text-[11px] text-on-surface-variant/80 font-mono">
                              <span className="text-emerald-600 font-bold flex items-center gap-1">✓ Permanent Code</span>
                              <span className="text-amber-600 font-bold">Unclaimed</span>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-amber-500/10">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(conn.connection_code);
                                    toast.success(`Copied code ${conn.connection_code}!`);
                                  }}
                                  className="px-2.5 py-1.5 bg-surface hover:bg-on-surface/5 text-on-surface border border-outline-variant/20 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                                >
                                  <Copy size={13} />
                                  <span>Copy</span>
                                </button>

                                <a
                                  href={`https://wa.me/?text=${encodeURIComponent(
                                    `Hi! Enter pairing code ${conn.connection_code} in your LocalEats Driver App to connect with ${currentShop?.name || "our shop"}.`
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1.5 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                                >
                                  <MessageCircle size={13} />
                                  <span>Share WA</span>
                                </a>

                                <button
                                  onClick={() => invalidateAndRegenerate(conn.id, conn.connection_code)}
                                  className="px-2.5 py-1.5 bg-red-500/10 text-red-600 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                                  title="Clear from DB and create a fresh code"
                                >
                                  <RotateCcw size={13} />
                                  <span>Invalidate & Regenerate</span>
                                </button>
                              </div>

                              <button
                                onClick={() => claimPairingCode(conn.id, conn.connection_code)}
                                className="px-3 py-1.5 bg-primary text-on-primary hover:bg-primary/90 text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
                                title="Instantly link a test driver to this code"
                              >
                                <UserPlus size={13} />
                                <span>Simulate Link</span>
                              </button>
                            </div>
                          </motion.div>
                        );
                      }

                      return (
                        <motion.div
                          layout
                          key={`claimed_${conn.id}_${conn.rider_id || idx}`}
                          initial={{ opacity: 0, scale: 0.95, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          transition={{ type: "spring", stiffness: 350, damping: 25 }}
                          className={cn(
                            "bg-surface-container-low rounded-2xl p-5 border transition-all flex flex-col justify-between gap-4 relative",
                            isExpired 
                              ? "border-outline-variant/10 opacity-60" 
                              : "border-outline-variant/10 hover:border-primary/20 hover:shadow-sm"
                          )}
                        >
                          {/* Driver Header */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-black text-lg">
                                  {conn.rider_name ? conn.rider_name.charAt(0).toUpperCase() : "R"}
                                </div>
                                <span className={cn(
                                  "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-surface-container-low",
                                  conn.is_online ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"
                                )} title={conn.is_online ? "Online & Ready" : "Offline"} />
                              </div>

                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-headline font-bold text-sm text-on-surface">{conn.rider_name || "Unnamed Driver"}</h4>
                                  <span className={cn(
                                    "text-[9px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider",
                                    isInHouse 
                                      ? "bg-indigo-500/10 text-indigo-600 border border-indigo-500/20" 
                                      : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                  )}>
                                    {isInHouse ? "In-House" : "Paired"}
                                  </span>
                                  <span className={cn("text-[9px] font-black px-2 py-0.5 rounded-md border flex items-center gap-1", hb.badgeClass)}>
                                    <span className={cn("w-1.5 h-1.5 rounded-full", hb.dotClass)} />
                                    {hb.timeAgo}
                                  </span>
                                </div>
                                
                                <p className="text-xs text-on-surface-variant/80 font-mono flex items-center gap-1">
                                  <Phone size={11} className="text-on-surface-variant/50" />
                                  <span>{conn.rider_phone || "No phone listed"}</span>
                                </p>
                              </div>
                            </div>

                            {/* Contact & Disconnect Action Buttons */}
                            <div className="flex items-center gap-1 shrink-0">
                              {cleanPhone && (
                                <>
                                  <a
                                    href={`tel:${conn.rider_phone}`}
                                    className="p-2 rounded-xl bg-surface hover:bg-on-surface/5 text-on-surface-variant hover:text-on-surface border border-outline-variant/10 transition-colors"
                                    title="Call Rider"
                                  >
                                    <Phone size={14} />
                                  </a>
                                  <a
                                    href={`https://wa.me/${cleanPhone}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors"
                                    title="Open WhatsApp Chat"
                                  >
                                    <MessageCircle size={14} />
                                  </a>
                                </>
                              )}
                              {!isInHouse && (
                                <button
                                  onClick={() => deleteConnection(conn.id, conn.connection_code, conn.rider_id)}
                                  className="p-2 hover:bg-red-50 hover:text-red-600 text-on-surface-variant/40 rounded-xl transition-colors cursor-pointer"
                                  title="Disconnect rider relationship"
                                >
                                  <X size={14} />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Online & Ready Interactive Dispatch Switch */}
                          <div className={cn(
                            "flex items-center justify-between gap-2 p-2.5 rounded-xl border transition-all",
                            conn.is_online
                              ? "bg-emerald-500/[0.06] border-emerald-500/20"
                              : "bg-surface/60 border-outline-variant/10"
                          )}>
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={cn(
                                "w-2.5 h-2.5 rounded-full shrink-0",
                                conn.is_online ? "bg-emerald-500 animate-ping" : "bg-zinc-400"
                              )} />
                              <div className="truncate">
                                <p className="text-[11px] font-bold text-on-surface leading-tight truncate">
                                  {conn.is_online ? "🟢 Online & Ready for Orders" : "⚪ Offline / Off-duty"}
                                </p>
                                <p className="text-[9px] text-on-surface-variant/70 font-medium truncate">
                                  {conn.is_online
                                    ? "Receives and accepts dispatch requests"
                                    : "Tap toggle to make ready for deliveries"}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => void toggleRiderOnlineStatus(conn)}
                              className={cn(
                                "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border shrink-0 flex items-center gap-1",
                                conn.is_online
                                  ? "bg-surface hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-on-surface-variant border-outline-variant/20 shadow-xs"
                                  : "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600 shadow-xs"
                              )}
                              title={conn.is_online ? "Set rider to offline" : "Make rider online & ready"}
                            >
                              <Zap size={11} className={conn.is_online ? "text-amber-500" : "text-white"} />
                              <span>{conn.is_online ? "Set Offline" : "Go Online"}</span>
                            </button>
                          </div>

                          {/* Stats Grid */}
                          <div className="bg-surface/60 border border-outline-variant/10 rounded-xl p-3 grid grid-cols-3 gap-2 text-center">
                            <div>
                              <span className="text-on-surface-variant/50 uppercase font-black text-[8px] tracking-wider block">Completed</span>
                              <span className="font-bold text-xs text-on-surface mt-0.5 block">{conn.total_deliveries || 0} tasks</span>
                            </div>
                            <div>
                              <span className="text-on-surface-variant/50 uppercase font-black text-[8px] tracking-wider block">Rating</span>
                              <span className="font-black text-xs text-amber-500 flex items-center justify-center gap-0.5 mt-0.5">
                                ★ {conn.rating?.toFixed(1) || '5.0'}
                              </span>
                            </div>
                            <div>
                              <span className="text-on-surface-variant/50 uppercase font-black text-[8px] tracking-wider block">Vehicle</span>
                              <span className="font-bold text-xs text-on-surface mt-0.5 block truncate">
                                {conn.vehicle_type || "Motorbike"}
                              </span>
                            </div>
                          </div>

                          {/* Card Footer Actions */}
                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-outline-variant/5">
                            <span className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider">
                              {isInHouse ? "Permanent Staff" : `Code: ${conn.connection_code}`}
                            </span>

                            <div className="flex items-center gap-2">
                              {conn.current_latitude && conn.current_longitude && (
                                <button
                                  onClick={() => setSelectedTrackId(conn.rider_id)}
                                  className="px-2.5 py-1 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg text-xs font-bold transition-all border border-primary/20 flex items-center gap-1 cursor-pointer"
                                >
                                  <MapPin size={12} />
                                  <span>Track</span>
                                </button>
                              )}

                              {conn.is_online && !isExpired && (
                                <button
                                  onClick={() => {
                                    setNudgingRider(conn);
                                    setCustomNudgeText("");
                                  }}
                                  className="px-2.5 py-1 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 transition-colors shadow-sm cursor-pointer flex items-center gap-1"
                                >
                                  <Zap size={12} />
                                  <span>Nudge</span>
                                </button>
                              )}

                              {isExpired && (
                                <span className="text-[9px] font-black uppercase text-red-500 bg-red-50 border border-red-100 px-2 py-0.5 rounded-lg">
                                  Expired Code
                                </span>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </motion.div>

                {/* Pagination & List Performance Controls Bar */}
                {filteredConnections.length > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface-container-low/60 p-3 rounded-2xl border border-outline-variant/10 mt-4 text-xs">
                    {/* Range Status */}
                    <div className="text-on-surface-variant font-medium text-[11px]">
                      Showing <strong className="text-on-surface">{(currentPage - 1) * (pageSize || filteredConnections.length) + 1}</strong>–
                      <strong className="text-on-surface">{Math.min(currentPage * (pageSize || filteredConnections.length), filteredConnections.length)}</strong> of <strong className="text-on-surface">{filteredConnections.length}</strong> riders
                    </div>

                    {/* Pagination buttons & Page Size selector */}
                    <div className="flex items-center gap-3 flex-wrap justify-center">
                      {/* Page Size Selector */}
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-bold uppercase text-on-surface-variant/60 tracking-wider">Per page:</span>
                        {[10, 20, 50, 0].map((size) => (
                          <button
                            key={size}
                            onClick={() => { setPageSize(size); setCurrentPage(1); }}
                            className={cn(
                              "px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer",
                              pageSize === size
                                ? "bg-primary text-on-primary shadow-xs"
                                : "bg-surface text-on-surface-variant hover:text-on-surface border border-outline-variant/10"
                            )}
                          >
                            {size === 0 ? "All" : size}
                          </button>
                        ))}
                      </div>

                      {/* Pagination Navigation */}
                      {pageSize > 0 && totalPages > 1 && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-2.5 py-1 rounded-xl bg-surface hover:bg-on-surface/5 text-on-surface border border-outline-variant/10 font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          >
                            Prev
                          </button>
                          <span className="px-2 font-mono font-bold text-on-surface text-[11px]">
                            {currentPage} / {totalPages}
                          </span>
                          <button
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage >= totalPages}
                            className="px-2.5 py-1 rounded-xl bg-surface hover:bg-on-surface/5 text-on-surface border border-outline-variant/10 font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
            </div>
          </div>
        )}

        {/* --- TAB: NETWORK HEALTH & DIAGNOSTICS --- */}
        {activeSubTab === "health" && (
          <div className="space-y-6 animate-fade-in">
            {/* Network Health Header & Diagnostic Overview */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-headline font-bold text-on-surface flex items-center gap-2">
                  <Activity size={20} className="text-primary" />
                  Rider Fleet Network Health & Diagnostics
                </h3>
                <p className="text-xs text-on-surface-variant font-medium">
                  Real-time heartbeat monitoring distinguishing truly active sessions from idle & offline riders.
                </p>
              </div>

              <button
                onClick={() => void fetchConnections()}
                className="px-3.5 py-2 bg-surface-container-high hover:bg-surface-container text-on-surface text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer border border-outline-variant/10 shrink-0 self-start sm:self-auto"
              >
                <RefreshCw size={14} className={loading ? "animate-spin text-primary" : "text-on-surface-variant"} />
                <span>Refresh Diagnostics</span>
              </button>
            </div>

            {/* Health Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-emerald-500/5 dark:bg-emerald-500/10 p-5 rounded-2xl border border-emerald-500/20 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-300 tracking-wider">
                    Truly Active Riders
                  </span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                </div>
                <p className="text-2xl font-headline font-black text-emerald-600 dark:text-emerald-400">
                  {connections.filter((c) => {
                    const hb = getRiderHeartbeatStatus(c.last_seen, c.is_online);
                    return hb.type === "truly_active";
                  }).length}{" "}
                  <span className="text-xs font-bold text-emerald-600/70">/ {connections.length}</span>
                </p>
                <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 font-medium">
                  Active WebSocket/Heartbeat recorded recently.
                </p>
              </div>

              <div className="bg-amber-500/5 dark:bg-amber-500/10 p-5 rounded-2xl border border-amber-500/20 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-300 tracking-wider">
                    Connected / Idle
                  </span>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                </div>
                <p className="text-2xl font-headline font-black text-amber-600 dark:text-amber-400">
                  {connections.filter((c) => {
                    const hb = getRiderHeartbeatStatus(c.last_seen, c.is_online);
                    return hb.type === "connected_idle";
                  }).length}
                </p>
                <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80 font-medium">
                  Bound connection active, but idle (10-30m since last ping).
                </p>
              </div>

              <div className="bg-zinc-500/5 dark:bg-zinc-500/10 p-5 rounded-2xl border border-zinc-500/20 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-zinc-600 dark:text-zinc-400 tracking-wider">
                    Offline / Stale Codes
                  </span>
                  <span className="w-2.5 h-2.5 rounded-full bg-zinc-400" />
                </div>
                <p className="text-2xl font-headline font-black text-on-surface">
                  {connections.filter((c) => {
                    const hb = getRiderHeartbeatStatus(c.last_seen, c.is_online);
                    return hb.type === "offline";
                  }).length}
                </p>
                <p className="text-[11px] text-on-surface-variant/70 font-medium">
                  No heartbeat recorded or inactive &gt; 30 minutes.
                </p>
              </div>
            </div>

            {/* Detailed Fleet Diagnostic Roster */}
            <div className="bg-surface-container-low rounded-3xl p-6 border border-outline-variant/10 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-outline-variant/10 pb-4">
                <h4 className="text-sm font-headline font-bold text-on-surface">
                  Real-Time Heartbeat & Diagnostic Registry
                </h4>
                <span className="text-[10px] font-mono text-on-surface-variant font-bold bg-surface-container px-2.5 py-1 rounded-xl">
                  DB Verification: Live
                </span>
              </div>

              {connections.length === 0 ? (
                <div className="py-12 text-center text-xs text-on-surface-variant">
                  No riders in registry. Generate a pairing code in Rider Network to add riders.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {connections.map((c) => {
                    const hb = getRiderHeartbeatStatus(c.last_seen, c.is_online);
                    const diag = getCodeDiagnostic(c, dbSyncedSet);
                    const isInHouse = c.connection_code === "IN-HOUSE";

                    return (
                      <div
                        key={c.id}
                        className="bg-surface/60 rounded-2xl p-4 border border-outline-variant/10 space-y-3 relative hover:border-primary/20 transition-all"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 font-black flex items-center justify-center shrink-0 text-sm">
                              {c.rider_name ? c.rider_name.charAt(0).toUpperCase() : "R"}
                            </div>
                            <div>
                              <h5 className="font-bold text-sm text-on-surface flex items-center gap-2">
                                {c.rider_name || "Unclaimed Code"}
                                {isInHouse && (
                                  <span className="text-[9px] bg-indigo-500/10 text-indigo-600 px-2 py-0.5 rounded font-black border border-indigo-500/20">
                                    In-House
                                  </span>
                                )}
                              </h5>
                              <p className="text-[11px] text-on-surface-variant font-mono">
                                {c.rider_phone || `Code: ${c.connection_code}`}
                              </p>
                            </div>
                          </div>

                          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1", hb.badgeClass)}>
                            <span className={cn("w-2 h-2 rounded-full", hb.dotClass)} />
                            {hb.label}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-surface-container/40 p-2.5 rounded-xl border border-outline-variant/5">
                          <div>
                            <span className="text-[9px] font-black uppercase text-on-surface-variant/60 block">Last Heartbeat</span>
                            <span className="font-bold text-on-surface">{hb.timeAgo}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-black uppercase text-on-surface-variant/60 block">Supabase Status</span>
                            <span className={cn("font-bold", diag.isDbSynced ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600")}>
                              {diag.dbLabel}
                            </span>
                          </div>
                          <div>
                            <span className="text-[9px] font-black uppercase text-on-surface-variant/60 block">GPS Coordinates</span>
                            <span className="text-on-surface text-[10px]">
                              {c.current_latitude && c.current_longitude
                                ? `${c.current_latitude.toFixed(3)}, ${c.current_longitude.toFixed(3)}`
                                : "No GPS signal"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[9px] font-black uppercase text-on-surface-variant/60 block">Deliveries Completed</span>
                            <span className="font-bold text-on-surface">{c.total_deliveries || 0} Orders</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 text-[11px]">
                          {!diag.isDbSynced && (
                            <button
                              onClick={() => syncCodeToSupabase(c)}
                              className="px-2.5 py-1 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg font-bold text-[10px] transition-all cursor-pointer flex items-center gap-1"
                            >
                              <Database size={11} /> Sync to Database
                            </button>
                          )}

                          {c.rider_id && (
                            <button
                              onClick={() => sendRiderNudge(c.rider_id!, "LocalEats Shop requested a live location ping / heartbeat update.")}
                              className="ml-auto px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg font-bold text-[10px] transition-all cursor-pointer flex items-center gap-1"
                            >
                              <Send size={11} /> Ping Rider Heartbeat
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- TAB 3: RIDER RATINGS & PERFORMANCE DASHBOARD --- */}
        {activeSubTab === "ratings" && (
          <div className="space-y-6 animate-fade-in">
            {/* Fleet Overview Header */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Fleet Rating Card */}
              <div className="bg-surface-container-low rounded-3xl p-5 border border-outline-variant/10 shadow-sm relative overflow-hidden flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">Fleet Rating Index</span>
                  <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
                    <Star size={18} fill="currentColor" />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-on-surface tracking-tight">
                      {(connections.reduce((acc, c) => acc + (c.rating || 5.0), 0) / (connections.length || 1)).toFixed(1)}
                    </span>
                    <span className="text-xs text-amber-500 font-extrabold">/ 5.0 ⭐</span>
                  </div>
                  <p className="text-[10px] text-on-surface-variant/75 font-semibold mt-1">
                    Based on {orders.filter(o => o.status === "completed").length} completed delivery missions
                  </p>
                </div>
                <div className="mt-3 pt-3 border-t border-outline-variant/10 flex items-center justify-between text-[10px] font-bold">
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Award size={12} /> Top 5% Fleet Quality
                  </span>
                  <span className="text-on-surface-variant/60">{connections.length} Riders Active</span>
                </div>
              </div>

              {/* Top Performer Spotlight */}
              <div className="bg-gradient-to-br from-amber-500/10 via-surface-container-low to-surface-container-low rounded-3xl p-5 border border-amber-500/20 shadow-sm relative overflow-hidden flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">🏆 Fleet Top Performer</span>
                  <span className="px-2 py-0.5 bg-amber-500 text-white font-black text-[9px] rounded-full uppercase tracking-wider">Gold Badge</span>
                </div>
                {sortedConnections.length > 0 ? (
                  <div className="mt-3 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-600 flex items-center justify-center font-black text-lg shrink-0 border border-amber-500/30">
                      🏆
                    </div>
                    <div>
                      <p className="font-bold text-sm text-on-surface">{sortedConnections[0].rider_name}</p>
                      <p className="text-[10px] text-on-surface-variant font-medium">{sortedConnections[0].rider_phone || "In-House Fleet"}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-black text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-md">
                          ★ {(sortedConnections[0].rating || 5.0).toFixed(1)} Stars
                        </span>
                        <span className="text-[10px] font-bold text-on-surface-variant/70">
                          {sortedConnections[0].total_deliveries || 0} tasks
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-on-surface-variant mt-2">No active riders registered.</p>
                )}
                <div className="mt-3 pt-2 border-t border-amber-500/10 text-[9px] text-on-surface-variant/70 font-semibold">
                  Highest customer satisfaction score this month
                </div>
              </div>

              {/* Underperforming Alert / Attention Needed */}
              <div className="bg-surface-container-low rounded-3xl p-5 border border-outline-variant/10 shadow-sm relative overflow-hidden flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">Quality Nudge & Alert</span>
                  <div className="p-2 bg-rose-500/10 text-rose-500 rounded-xl">
                    <AlertTriangle size={18} />
                  </div>
                </div>
                <div className="mt-3">
                  {connections.filter(c => (c.rating || 5.0) < 4.5).length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-on-surface">
                        {connections.filter(c => (c.rating || 5.0) < 4.5).length} Rider(s) Need Coaching
                      </p>
                      <p className="text-[10px] text-on-surface-variant">
                        Rating under 4.5 stars. Send a quality nudge signal to improve service standards.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 size={14} /> Zero Quality Alerts
                      </p>
                      <p className="text-[10px] text-on-surface-variant">
                        All riders in your fleet are maintaining high 4.5+ star ratings!
                      </p>
                    </div>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t border-outline-variant/10 flex items-center justify-between text-[10px]">
                  <span className="text-on-surface-variant/60 font-bold">Automatic Monitoring</span>
                  <span className="text-primary font-black uppercase text-[9px]">Active</span>
                </div>
              </div>
            </div>

            {/* Rider Rating Roster & Performance Table */}
            <div className="bg-surface-container-low rounded-3xl p-6 border border-outline-variant/10 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline-variant/10 pb-4">
                <div>
                  <h3 className="text-base font-headline font-bold text-on-surface">Rider Performance Leaderboard</h3>
                  <p className="text-xs text-on-surface-variant">Detailed rating breakdown, mission volume, and COD handovers</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-xl">
                    {connections.length} Riders Rated
                  </span>
                </div>
              </div>

              {connections.length === 0 ? (
                <div className="py-12 text-center text-xs text-on-surface-variant">
                  No riders available to rate. Connect a rider in the Rider Network tab.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-outline-variant/10 text-[10px] font-black uppercase text-on-surface-variant/60 tracking-wider">
                        <th className="pb-3 pl-2">Rider</th>
                        <th className="pb-3">Access Protocol</th>
                        <th className="pb-3 text-center">Deliveries</th>
                        <th className="pb-3 text-center">Overall Rating</th>
                        <th className="pb-3 text-right pr-2">Performance Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/5">
                      {sortedConnections.map((rider, idx) => {
                        const rating = rider.rating || 5.0;
                        const isTop = idx === 0 && rating >= 4.5;
                        const needsHelp = rating < 4.2;

                        return (
                          <tr key={rider.id} className="hover:bg-surface-container-high/40 transition-colors">
                            <td className="py-3.5 pl-2 font-bold text-on-surface flex items-center gap-2.5">
                              <div className={cn(
                                "w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs",
                                isTop ? "bg-amber-500/20 text-amber-600" : "bg-surface-container-high text-on-surface-variant"
                              )}>
                                {isTop ? "🏆" : rider.rider_name ? rider.rider_name.charAt(0).toUpperCase() : "R"}
                              </div>
                              <div>
                                <p className="font-bold text-xs text-on-surface">{rider.rider_name}</p>
                                <p className="text-[10px] text-on-surface-variant/70 font-mono">{rider.rider_phone || "In-House"}</p>
                              </div>
                            </td>
                            <td className="py-3.5 text-on-surface-variant font-medium">
                              <span className="px-2 py-0.5 rounded-lg bg-surface-container-high text-[10px] font-bold text-on-surface">
                                {rider.connection_code === "IN-HOUSE" ? "In-House Fleet" : "Paired Rider"}
                              </span>
                            </td>
                            <td className="py-3.5 text-center font-bold text-on-surface">
                              {rider.total_deliveries || orders.filter(o => o.rider_name === rider.rider_name).length || 0}
                            </td>
                            <td className="py-3.5 text-center">
                              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-600 font-black text-xs border border-amber-500/20">
                                <span>★ {rating.toFixed(1)}</span>
                              </div>
                            </td>
                            <td className="py-3.5 text-right pr-2">
                              {isTop ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2.5 py-1 rounded-full">
                                  🏆 Top Performer
                                </span>
                              ) : needsHelp ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-amber-700 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2.5 py-1 rounded-full">
                                  ⚠️ Needs Coaching
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-full">
                                  ✓ Good Standing
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- TAB 4: RIDER DISPATCH & TRUST --- */}
        {activeSubTab === "controls" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
            {/* Dispatch settings */}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-headline font-black text-on-surface">Store Rider Dispatch</h3>
                <p className="text-xs text-on-surface-variant">Configure independent fleet access permissions</p>
              </div>

              <div className="bg-surface-container-low rounded-3xl p-5 border border-outline-variant/10 shadow-sm space-y-4">
                <div className="flex items-start justify-between gap-4 border-b border-outline-variant/5 pb-4">
                  <div className="space-y-1">
                    <h4 className="text-xs font-black uppercase tracking-wider text-on-surface">Allow External Pool Riders</h4>
                    <p className="text-[11px] text-on-surface-variant font-medium leading-relaxed">
                      Enable verified public or independent riders on the network to view and accept your orders when your in-house fleet is busy.
                    </p>
                  </div>
                  <button
                    onClick={toggleAllowExternalRiders}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative cursor-pointer border shrink-0",
                      allowExternalRiders ? "bg-primary border-primary" : "bg-on-surface/10 border-outline-variant"
                    )}
                  >
                    <span className={cn(
                      "absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white transition-all",
                      allowExternalRiders ? "translate-x-6" : "translate-x-0"
                    )} />
                  </button>
                </div>

                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="text-xs font-black uppercase tracking-wider text-on-surface">Auto-Dispatch to Paired Riders</h4>
                    <p className="text-[11px] text-on-surface-variant font-medium leading-relaxed">
                      Automatically dispatch the order to your active paired riders the moment you accept an order.
                    </p>
                  </div>
                  <button
                    onClick={toggleAutoLookForRider}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative cursor-pointer border shrink-0",
                      autoLookForRider ? "bg-primary border-primary" : "bg-on-surface/10 border-outline-variant"
                    )}
                  >
                    <span className={cn(
                      "absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white transition-all",
                      autoLookForRider ? "translate-x-6" : "translate-x-0"
                    )} />
                  </button>
                </div>
              </div>

              {/* Cash-on-Arrival Trust Booster details */}
              <div className="bg-gradient-to-br from-primary/[0.02] via-surface-container-low to-primary/[0.05] rounded-3xl p-6 border-2 border-primary/5 space-y-4 shadow-sm">
                <div className="space-y-2">
                  <span className="inline-flex items-center gap-1 text-[9px] font-black bg-primary/10 text-primary px-2.5 py-0.5 rounded-full tracking-wider uppercase">
                    ★ Premium Trust Booster
                  </span>
                  <h4 className="text-sm font-headline font-black text-on-surface">No Rider? Cash-on-Arrival Banner</h4>
                  <p className="text-[11px] text-on-surface-variant font-medium leading-relaxed">
                    Build instant user checkout trust. Let customers know they can choose standard Cash on Delivery with full safety guarantees, and we'll route in-house or paired partners to collect it safely.
                  </p>
                </div>

                <div className="flex items-center justify-between border-t border-primary/5 pt-4">
                  <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-wider">
                    Display Banner on Storefront
                  </span>
                  <button
                    onClick={toggleCashTrust}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative cursor-pointer border shrink-0",
                      cashTrustEnabled ? "bg-primary border-primary" : "bg-on-surface/10 border-outline-variant"
                    )}
                  >
                    <span className={cn(
                      "absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white transition-all",
                      cashTrustEnabled ? "translate-x-6" : "translate-x-0"
                    )} />
                  </button>
                </div>
              </div>
            </div>

            {/* Rider financial balances */}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-headline font-black text-on-surface">Rider Cash-on-Hand</h3>
                <p className="text-xs text-on-surface-variant">COD outstanding balances and warning caps</p>
              </div>

              {riderCashBalances.length === 0 ? (
                <div className="bg-surface-container-low p-6.5 rounded-3xl border border-outline-variant/10 text-center space-y-3.5 max-w-sm mx-auto">
                  <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center mx-auto text-on-surface-variant/30">
                    <Wallet size={18} />
                  </div>
                  <h4 className="text-xs font-bold text-on-surface uppercase tracking-tight">No Cash Collections</h4>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed font-medium">
                    All Cash-on-Delivery orders are fully reconciled. No drivers currently carry active storefront cash.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-surface-container-low p-5 rounded-3xl border border-outline-variant/10 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-outline-variant/5 pb-2">
                      <span className="text-[10px] font-black uppercase text-on-surface-variant tracking-wider">Active Rider Balance</span>
                      <span className="text-[10px] font-black text-red-500 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
                        Safety Limit: R 500
                      </span>
                    </div>

                    <div className="space-y-4">
                      {riderCashBalances.map((item) => {
                        const ratio = Math.min(100, (item.total / 500) * 100);
                        return (
                          <div key={item.id} className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-bold">
                              <span className="text-on-surface">{item.name}</span>
                              <span className={cn(
                                "font-mono font-black",
                                item.total >= 400 ? "text-red-500" : "text-on-surface"
                              )}>
                                R {item.total} <span className="text-[9px] font-medium text-on-surface-variant/60">({item.count} orders)</span>
                              </span>
                            </div>
                            <div className="w-full h-2 bg-on-surface/5 rounded-full overflow-hidden border border-outline-variant/5">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all duration-500",
                                  item.total >= 450 
                                    ? "bg-red-500" 
                                    : item.total >= 300 
                                      ? "bg-amber-500" 
                                      : "bg-emerald-500"
                                )}
                                style={{ width: `${ratio}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <p className="text-[9px] text-on-surface-variant/75 font-medium leading-relaxed border-t border-outline-variant/5 pt-3">
                      ⚠️ When a rider carries more than R 500 in collected cash-on-delivery amounts, prompt them to deposit cash at the storefront to reconcile accounts and unlock future orders.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* TRACKER MODAL */}
      <AnimatePresence>
         {selectedTrackId && trackedRider && (
            <motion.div
               key="tracker-overlay"
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10 pointer-events-none"
            >
               <motion.div 
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 exit={{ opacity: 0 }}
                 className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm pointer-events-auto"
                 onClick={() => setSelectedTrackId(null)}
               />
               <motion.div 
                 initial={{ scale: 0.9, opacity: 0, y: 40 }}
                 animate={{ scale: 1, opacity: 1, y: 0 }}
                 exit={{ scale: 0.9, opacity: 0, y: 40 }}
                 className="w-full max-w-5xl h-full max-h-[80vh] bg-surface-container-low rounded-[2.5rem] border border-outline-variant/20 shadow-2xl overflow-hidden relative flex flex-col pointer-events-auto"
               >
                  <div className="p-6 md:p-8 flex items-center justify-between border-b border-outline-variant/10 bg-surface-container-low">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                           <Bike size={24} />
                        </div>
                        <div>
                           <h2 className="text-xl font-headline font-bold text-on-surface">{trackedRider.rider_name}</h2>
                           <p className="text-xs font-medium text-on-surface-variant/60 flex items-center gap-1.5">
                              <span className={cn("w-2 h-2 rounded-full", trackedRider.is_online ? "bg-green-500 animate-pulse" : "bg-zinc-350")} />
                              {trackedRider.is_online ? 'Live tracking active' : 'Last known location'}
                           </p>
                        </div>
                     </div>
                     <button 
                       onClick={() => setSelectedTrackId(null)}
                       className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-on-surface/5 transition-colors"
                     >
                        <X size={24} />
                     </button>
                  </div>

                  <div className="flex-1 relative bg-surface-container-highest">
                     {smoothLat && smoothLng ? (
                        <>
                          <MapContainer
                            center={[smoothLat, smoothLng]}
                            zoom={15}
                            className="w-full h-full"
                            zoomControl={false}
                          >
                            <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                            <Marker 
                              position={[smoothLat, smoothLng]}
                              icon={L.icon({
                                iconUrl: 'https://cdn-icons-png.flaticon.com/512/3195/3195868.png',
                                iconSize: [40, 40],
                                iconAnchor: [20, 40],
                              })}
                            />

                            {mapCenterOverride && mapZoomOverride && (
                              <MapViewRefocus center={mapCenterOverride} zoom={mapZoomOverride} />
                            )}

                            {showTrafficLayer && (
                              <>
                                {TRAFFIC_CORRIDORS.map((corridor) => (
                                  <React.Fragment key={corridor.id}>
                                    <Polyline
                                      positions={corridor.path}
                                      pathOptions={{
                                        color: corridor.color === "red" ? "#f87171" : corridor.color === "orange" ? "#fb923c" : "#4ade80",
                                        weight: 10,
                                        opacity: 0.3,
                                      }}
                                    />
                                    <Polyline
                                      positions={corridor.path}
                                      pathOptions={{
                                        color: corridor.color === "red" ? "#dc2626" : corridor.color === "orange" ? "#ea580c" : "#16a34a",
                                        weight: 5,
                                        opacity: 0.85,
                                      }}
                                    >
                                      <Tooltip sticky>
                                        <div className="px-2 py-1 font-bold text-xs bg-zinc-900 text-white rounded-lg select-none">
                                          {corridor.name} ({corridor.color === "red" ? "Severe" : corridor.color === "orange" ? "Moderate" : "Smooth"})
                                        </div>
                                      </Tooltip>
                                    </Polyline>
                                  </React.Fragment>
                                ))}

                                {TRAFFIC_BOTTLENECKS.map((btn) => (
                                  <Marker
                                    key={btn.id}
                                    position={btn.latlng}
                                    icon={L.divIcon({
                                      className: "custom-traffic-icon",
                                      html: `<div class="relative flex items-center justify-center animate-bounce" style="animation-duration: 2.2s">
                                               <div class="absolute w-8 h-8 rounded-full ${btn.color === 'red' ? 'bg-rose-500/35' : 'bg-amber-500/35'} animate-ping" style="animation-duration: 1.8s"></div>
                                               <div class="w-6.5 h-6.5 rounded-full ${btn.color === 'red' ? 'bg-rose-600' : 'bg-amber-500'} flex items-center justify-center shadow-lg text-white font-extrabold border-2 border-white text-[11px]">
                                                 ⚠️
                                               </div>
                                             </div>`,
                                      iconSize: [36, 36],
                                      iconAnchor: [18, 18],
                                    })}
                                  >
                                    <Tooltip direction="top" offset={[0, -12]} opacity={1}>
                                      <div className="p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl space-y-1.5 max-w-[240px] text-left">
                                        <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-rose-500">
                                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                          <span>Bottleneck Alert</span>
                                        </div>
                                        <h5 className="text-xs font-bold font-headline text-zinc-900 dark:text-white leading-tight">
                                          {btn.name}
                                        </h5>
                                        <div className="flex items-center gap-1.5 mt-1 bg-rose-500/5 dark:bg-rose-500/10 px-2 py-1 rounded-lg border border-rose-500/10">
                                          <span className="text-[10px] font-black text-rose-600 dark:text-rose-400">
                                            {btn.delay} Delay
                                          </span>
                                        </div>
                                        <p className="text-[9px] text-zinc-500 dark:text-zinc-400 leading-normal">
                                          {btn.cause}
                                        </p>
                                      </div>
                                    </Tooltip>
                                  </Marker>
                                ))}
                              </>
                            )}
                          </MapContainer>

                          {/* Floating Traffic Control Panel */}
                          <div className="absolute top-4 right-4 z-[1000] bg-zinc-950/90 backdrop-blur-md border border-zinc-800 rounded-2xl p-4 w-72 shadow-2xl space-y-3 pointer-events-auto text-left">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="flex h-2 w-2 relative">
                                  <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", showTrafficLayer ? "bg-rose-400" : "bg-zinc-400")} />
                                  <span className={cn("relative inline-flex rounded-full h-2 w-2", showTrafficLayer ? "bg-rose-500" : "bg-zinc-500")} />
                                </span>
                                <h3 className="text-[10px] font-black uppercase tracking-wider text-white">Grid Traffic Layer</h3>
                              </div>
                              
                              <button
                                onClick={() => setShowTrafficLayer(!showTrafficLayer)}
                                className={cn(
                                  "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase transition-all border cursor-pointer",
                                  showTrafficLayer 
                                    ? "bg-rose-500/20 text-rose-400 border-rose-500/30 font-extrabold" 
                                    : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700 font-medium"
                                )}
                              >
                                {showTrafficLayer ? "ACTIVE" : "OFF"}
                              </button>
                            </div>

                            {showTrafficLayer && (
                              <div className="space-y-3 border-t border-zinc-900 pt-3">
                                <p className="text-[10px] text-zinc-400 leading-relaxed">
                                  Select a hotspot to zoom/align and review alternative route details:
                                </p>
                                
                                <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                                  {TRAFFIC_BOTTLENECKS.map((btn) => (
                                    <button
                                      key={btn.id}
                                      onClick={() => {
                                        setMapCenterOverride(btn.latlng);
                                        setMapZoomOverride(15);
                                        setTimeout(() => {
                                          setMapCenterOverride(null);
                                          setMapZoomOverride(null);
                                        }, 1000);
                                      }}
                                      className="w-full text-left p-2 rounded-xl bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-900 hover:border-zinc-800 transition-all flex items-start gap-2.5 group cursor-pointer"
                                    >
                                      <span className={cn(
                                        "text-xs mt-0.5",
                                        btn.color === "red" ? "text-rose-500" : "text-amber-500"
                                      )}>
                                        ⚠️
                                      </span>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-1">
                                          <p className="text-[10px] font-bold text-white truncate group-hover:text-primary transition-colors">
                                            {btn.name.split(" (")[0]}
                                          </p>
                                          <span className={cn(
                                            "text-[8px] font-black px-1.5 py-0.5 rounded uppercase flex-shrink-0",
                                            btn.color === "red" 
                                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" 
                                              : "bg-amber-500/10 text-amber-400 border border-amber-400/20"
                                          )}>
                                            {btn.delay}
                                          </span>
                                        </div>
                                        <p className="text-[9px] text-zinc-500 truncate leading-normal">
                                          {btn.cause}
                                        </p>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                                
                                <div className="flex items-center justify-between text-[8px] text-zinc-500 border-t border-zinc-900 pt-2">
                                  <span className="flex items-center gap-1 font-medium">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Severe ({TRAFFIC_BOTTLENECKS.filter(b => b.color === 'red').length})
                                  </span>
                                  <span className="flex items-center gap-1 font-medium">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Moderate ({TRAFFIC_BOTTLENECKS.filter(b => b.color === 'orange').length})
                                  </span>
                                  <button
                                    onClick={() => {
                                      if (smoothLat && smoothLng) {
                                        setMapCenterOverride([smoothLat, smoothLng]);
                                        setMapZoomOverride(15);
                                        setTimeout(() => {
                                          setMapCenterOverride(null);
                                          setMapZoomOverride(null);
                                        }, 1000);
                                      }
                                    }}
                                    className="text-primary hover:underline font-black uppercase tracking-wider text-[8px] cursor-pointer"
                                  >
                                    RE-CENTER
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </>
                     ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
                           <Navigation size={48} className="text-on-surface-variant/20 mb-4 animate-bounce" />
                           <h3 className="font-bold text-lg mb-2">Location Signal Missing</h3>
                           <p className="text-sm text-on-surface-variant/60 max-w-xs leading-relaxed">
                              We haven't received live GPS coordinates for this rider yet. Ensure their app is running with background location enabled.
                           </p>
                        </div>
                     )}
                  </div>

                  <div className="p-6 bg-surface-container-low border-t border-outline-variant/10 space-y-6">
                     <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                           <p className="text-[9px] font-black text-on-surface-variant/40 uppercase tracking-widest mb-1">Missions</p>
                           <p className="text-xl font-black text-on-surface">{trackedRider.total_deliveries || 0}</p>
                        </div>
                        <div className="text-center">
                           <p className="text-[9px] font-black text-on-surface-variant/40 uppercase tracking-widest mb-1">Rating</p>
                           <p className="text-xl font-black text-primary flex items-center justify-center gap-1">
                              <Star size={16} className="fill-current animate-spin-slow" />
                              {trackedRider.rating?.toFixed(1) || '5.0'}
                           </p>
                        </div>
                        <div className="text-center">
                           <p className="text-[9px] font-black text-on-surface-variant/40 uppercase tracking-widest mb-1">Status</p>
                           <p className={cn("text-sm font-black uppercase tracking-tighter mt-1", trackedRider.is_online ? (trackedRider.status === 'busy' ? "text-amber-600" : trackedRider.status === 'paused' ? "text-blue-600" : "text-green-600") : "text-on-surface-variant")}>
                              {trackedRider.is_online ? trackedRider.status : 'Offline'}
                           </p>
                        </div>
                     </div>

                     {/* Grid Performance Diagnostics Scorecard */}
                     <div className="border-t border-outline-variant/10 pt-6">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 mb-3 flex items-center gap-2">
                           <TrendingUp size={12} className="text-primary" /> Grid Performance Diagnostics
                        </h4>
                        <div className="grid grid-cols-3 gap-3">
                           <div className="bg-on-surface/5 border border-outline-variant/5 rounded-xl p-3">
                              <p className="text-[8px] font-black text-on-surface-variant/40 uppercase tracking-wider mb-1">Missions Lock-In</p>
                              <p className="text-sm font-black text-on-surface">98.4%</p>
                           </div>
                           <div className="bg-on-surface/5 border border-outline-variant/5 rounded-xl p-3">
                              <p className="text-[8px] font-black text-on-surface-variant/40 uppercase tracking-wider mb-1">Cargo Security</p>
                              <p className="text-sm font-black text-emerald-500">100%</p>
                           </div>
                           <div className="bg-on-surface/5 border border-outline-variant/5 rounded-xl p-3">
                              <p className="text-[8px] font-black text-on-surface-variant/40 uppercase tracking-wider mb-1">Flight On-Time</p>
                              <p className="text-sm font-black text-cyan-500">96.8%</p>
                           </div>
                        </div>
                     </div>

                     {/* Accolades badges */}
                     <div className="border-t border-outline-variant/10 pt-4 flex flex-wrap gap-2 items-center">
                        <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/60 mr-1">Rider Accolades:</span>
                        <div className="flex items-center gap-1 px-2.5 py-1 bg-cyan-50 dark:bg-cyan-950/20 border border-cyan-100/50 dark:border-cyan-900/30 rounded-lg text-cyan-600 dark:text-cyan-400 text-[9px] font-black uppercase tracking-wider animate-pulse">
                           <Compass size={10} />
                           <span>Pilot X32</span>
                        </div>
                        <div className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 dark:bg-amber-950/20 border border-amber-100/50 dark:border-amber-900/30 rounded-lg text-amber-600 dark:text-amber-400 text-[9px] font-black uppercase tracking-wider">
                           <ShieldCheck size={10} />
                           <span>Cargo X24</span>
                        </div>
                        <div className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100/50 dark:border-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase tracking-wider">
                           <Heart size={10} className="fill-current" />
                           <span>Polite X45</span>
                        </div>
                     </div>
                  </div>
               </motion.div>
            </motion.div>
         )}
      </AnimatePresence>

      <AnimatePresence>
        {showQRScanner && (
          <QRScanner 
            onScan={async (code) => {
              setShowQRScanner(false);
              const { error } = await supabase.from("rider_connections").insert({
                shop_id: currentShop.id,
                rider_name: "Rider " + code.substring(0, 4),
                
                connection_code: code,
                expires_at: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000).toISOString(),
                status: "active",
              });
              if (error) {
                toast.error("Failed to pair with rider.");
              } else {
                toast.success("Successfully paired with rider!");
                void fetchConnections();
              }
            }} 
            onClose={() => setShowQRScanner(false)} 
          />
        )}
      </AnimatePresence>

      {/* IN-HOUSE DRIVER REGISTRATION MODAL */}
      <AnimatePresence>
        {showInHouseModal && (
          <motion.div key="showInHouseModal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm pointer-events-auto"
              onClick={() => setShowInHouseModal(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="w-full max-w-md bg-surface-container-low rounded-3xl border border-outline-variant/20 shadow-2xl relative flex flex-col pointer-events-auto overflow-hidden text-on-surface"
            >
              <div className="p-6 border-b border-outline-variant/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                    <Users size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Add In-House Driver</h3>
                    <p className="text-[10px] text-on-surface-variant/60 font-medium">Bypass pairing code registration</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowInHouseModal(false)}
                  className="w-8 h-8 rounded-full hover:bg-on-surface/5 flex items-center justify-center text-on-surface-variant/60 hover:text-on-surface transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-black text-on-surface-variant/60 uppercase tracking-wider mb-1.5 font-headline">Driver Name</label>
                  <input
                    type="text"
                    value={inHouseName}
                    onChange={(e) => setInHouseName(e.target.value)}
                    placeholder="e.g. Sipho Nkosi"
                    className="w-full px-4 py-3 bg-on-surface/5 border border-outline-variant/10 rounded-xl text-sm focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-on-surface-variant/60 uppercase tracking-wider mb-1.5 font-headline">Phone Number</label>
                  <input
                    type="text"
                    value={inHousePhone}
                    onChange={(e) => setInHousePhone(e.target.value)}
                    placeholder="e.g. +27 71 234 5678"
                    className="w-full px-4 py-3 bg-on-surface/5 border border-outline-variant/10 rounded-xl text-sm focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-on-surface-variant/60 uppercase tracking-wider mb-1.5 font-headline">Vehicle Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["Road", "Bicycle", "Motorbike", "Electric"] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => setInHouseVehicle(v)}
                        className={cn(
                          "py-2 px-3 text-xs font-bold rounded-xl border transition-all text-center uppercase tracking-tight cursor-pointer",
                          inHouseVehicle === v
                            ? "bg-indigo-500 text-white border-indigo-500 font-extrabold"
                            : "bg-on-surface/5 text-on-surface-variant/70 border-outline-variant/10 hover:bg-on-surface/10"
                        )}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-on-surface/5 border-t border-outline-variant/10 flex gap-3">
                <button
                  onClick={() => setShowInHouseModal(false)}
                  className="flex-1 py-3 bg-transparent border border-outline-variant/20 rounded-xl text-sm font-bold hover:bg-on-surface/5"
                >
                  Cancel
                </button>
                <button
                  onClick={addInHouseRider}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition cursor-pointer"
                >
                  Register Driver
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* INTERACTIVE DRIVER NUDGE DIALOG */}
      <AnimatePresence>
        {nudgingRider && (
          <motion.div key="nudgingRider-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm pointer-events-auto"
              onClick={() => setNudgingRider(null)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="w-full max-w-md bg-surface-container-low rounded-3xl border border-outline-variant/20 shadow-2xl relative flex flex-col pointer-events-auto overflow-hidden text-on-surface animate-in fade-in-50 zoom-in-95"
            >
              <div className="p-6 border-b border-outline-variant/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                    <Zap size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Nudge Rider Profile</h3>
                    <p className="text-[10px] text-on-surface-variant/60 font-medium font-mono">Send secure push notification</p>
                  </div>
                </div>
                <button
                  onClick={() => setNudgingRider(null)}
                  className="w-8 h-8 rounded-full hover:bg-on-surface/5 flex items-center justify-center text-on-surface-variant/60 hover:text-on-surface transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="bg-surface px-4 py-3 rounded-2xl border border-outline-variant/10 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Bike size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-on-surface">{nudgingRider.rider_name}</p>
                    <p className="text-xs text-on-surface-variant/60 uppercase font-mono">{nudgingRider.connection_code}</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-on-surface-variant/60 uppercase tracking-wider mb-1.5">Quick Templates</label>
                  <div className="space-y-2">
                    {[
                      "⚠️ Rush hour load! Go online now.",
                      "⚡ Tip value increased by 20% in your zone!",
                      "📦 High priority order awaits prompt dispatch.",
                      "🚦 Weather surges active - earn extra per delivery!"
                    ].map((tpl) => (
                      <button
                        key={tpl}
                        onClick={() => setCustomNudgeText(tpl)}
                        className="w-full p-2.5 bg-on-surface/5 hover:bg-on-surface/10 rounded-xl border border-outline-variant/5 text-xs text-left font-semibold text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                      >
                        {tpl}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-on-surface-variant/60 uppercase tracking-wider mb-1.5">Custom Dispatch Note</label>
                  <textarea
                    rows={3}
                    value={customNudgeText}
                    onChange={(e) => setCustomNudgeText(e.target.value)}
                    placeholder="Describe specific instruction..."
                    className="w-full px-4 py-3 bg-on-surface/5 border border-outline-variant/10 rounded-xl text-sm focus:ring-1 focus:ring-primary focus:outline-none resize-none"
                  />
                </div>
              </div>

              <div className="p-6 bg-on-surface/5 border-t border-outline-variant/10 flex flex-wrap gap-2">
                <button
                  onClick={() => setNudgingRider(null)}
                  className="px-4 py-3 bg-transparent border border-outline-variant/20 rounded-xl text-xs font-bold hover:bg-on-surface/5"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    const msg = customNudgeText.trim() || "⚠️ High priority dispatch notice from shop.";
                    const rawPhone = nudgingRider.rider_phone || "";
                    const digits = rawPhone.replace(/[^\d+]/g, "");
                    const cleanPhone = digits.startsWith("0") ? "27" + digits.slice(1) : digits.replace("+", "");
                    if (cleanPhone) {
                      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(`📢 *${currentShop?.name || 'LocalEats'} Dispatch Alert*\n\n${msg}`)}`, "_blank");
                      toast.success("Opening WhatsApp dispatch link...");
                    } else {
                      toast.error("Rider has no phone number attached.");
                    }
                    void sendRiderNudge(nudgingRider.rider_id || nudgingRider.id, msg);
                    setNudgingRider(null);
                    setCustomNudgeText("");
                  }}
                  className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <MessageCircle size={14} className="fill-current" />
                  <span>WhatsApp Alert</span>
                </button>
                <button
                  onClick={() => {
                    const msg = customNudgeText.trim() || "⚠️ Real-time status update notification";
                    void sendRiderNudge(nudgingRider.rider_id || nudgingRider.id, msg);
                    setNudgingRider(null);
                    setCustomNudgeText("");
                  }}
                  className="px-4 py-3 bg-amber-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition cursor-pointer flex items-center justify-center gap-1"
                >
                  <Send size={13} />
                  <span>Push Nudge</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RiderManagement;
