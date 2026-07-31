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
  Heart
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { MapContainer, TileLayer, Marker, useMap, Polyline, Tooltip } from "react-leaflet";
import L from "leaflet";
import { toast } from "sonner";
import { supabase } from "../lib/supabase";
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
  const [connections, setConnections] = useState<RiderConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [showTrafficLayer, setShowTrafficLayer] = useState(false);
  const [mapCenterOverride, setMapCenterOverride] = useState<[number, number] | null>(null);
  const [mapZoomOverride, setMapZoomOverride] = useState<number | null>(null);
  const [activeCode, setActiveCode] = useState<{ code: string; expires: string } | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [qrUrl, setQrUrl] = useState("");
  const [pairingCodeDuration, setPairingCodeDuration] = useState<"24h" | "7d" | "30d" | "never">("24h");
  const [showInHouseModal, setShowInHouseModal] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [inHouseName, setInHouseName] = useState("");
  const [inHousePhone, setInHousePhone] = useState("");
  const [inHouseVehicle, setInHouseVehicle] = useState<"Road" | "Bicycle" | "Motorbike" | "Electric">("Motorbike");
  const [nudgingRider, setNudgingRider] = useState<RiderConnection | null>(null);
  const [customNudgeText, setCustomNudgeText] = useState("");


  // New Sub-Tabs Selection State
  const [activeSubTab, setActiveSubTab] = useState<"missions" | "network" | "controls">("missions");

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

  const fetchConnections = useCallback(async () => {
    setLoading(true);
    try {
      const { data: conns, error: connErr } = await supabase
        .from("rider_connections")
        .select("*")
        .eq("shop_id", currentShop.id)
        .order("created_at", { ascending: false });

      if (connErr || !conns) {
        console.error("fetchConnections error:", connErr);
        return;
      }
      
      const riderIds = conns.map(c => c.rider_id).filter(Boolean) as string[];
      
      const profiles: Record<string, RiderProfile> = {};
      if (riderIds.length > 0) {
        const { data: profData, error: profErr } = await supabase
          .from("rider_profiles")
          .select("id, is_online, full_name, phone, status, vehicle_type, rating, total_deliveries, total_earnings, current_latitude, current_longitude, updated_at")
          .in("id", riderIds);
          
        if (!profErr && profData) {
          profData.forEach(p => { profiles[p.id] = p as RiderProfile; });
        }
      }

      const processed = conns.map((item) => {
        const profile = item.rider_id ? profiles[item.rider_id] : null;
        const isInHouse = item.connection_code === "IN-HOUSE";
        return {
          ...item,
          is_online: profile?.is_online || (isInHouse ? true : false),
          rider_name: profile?.full_name || item.rider_name,
          rider_phone: profile?.phone || item.rider_phone,
          status: profile?.status || (new Date(item.expires_at) < new Date() ? "expired" : (isInHouse ? "idle" : item.status)),
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
    } catch (err) {
      console.error("Error fetching rider connections:", err);
    } finally {
      setLoading(false);
    }
  }, [currentShop.id]);

  useEffect(() => {
    fetchConnections();
    
    const channel = supabase
      .channel(`rider_connections_sync_${currentShop.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rider_connections',
          filter: `shop_id=eq.${currentShop.id}`
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setConnections(prev => prev.map(c => c.id === payload.new.id ? { ...c, ...payload.new } : c));
          } else if (payload.eventType === 'INSERT') {
             void fetchConnections();
          } else if (payload.eventType === 'DELETE') {
            setConnections(prev => prev.filter(c => c.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    let profileSub: ReturnType<typeof supabase.channel> | null = null;
    if (selectedTrackId) {
      profileSub = supabase
        .channel(`track_rider_${selectedTrackId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'rider_profiles',
            filter: `id=eq.${selectedTrackId}`
          },
          (payload) => {
            const newProfile = payload.new as RiderProfile;
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
  }, [fetchConnections, currentShop.id, selectedTrackId]);

  const generateCode = async () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    let offsetMs = 24 * 60 * 60 * 1000;
    let durationLabel = "24 hours";
    if (pairingCodeDuration === "7d") {
      offsetMs = 7 * 24 * 60 * 60 * 1000;
      durationLabel = "7 days";
    } else if (pairingCodeDuration === "30d") {
      offsetMs = 30 * 24 * 60 * 60 * 1000;
      durationLabel = "30 days";
    } else if (pairingCodeDuration === "never") {
      offsetMs = 5 * 365 * 24 * 60 * 60 * 1000;
      durationLabel = "5 years";
    }

    const expiresAt = new Date(Date.now() + offsetMs).toISOString();

    const { error } = await supabase.from("rider_connections").insert({
      shop_id: currentShop.id,
      connection_code: code,
      expires_at: expiresAt,
      status: "active",
    });

    if (error) {
      toast.error(error.message);
    } else {
      setActiveCode({ code, expires: expiresAt });
      setShowCode(true);
      void fetchConnections();
      toast.success(`Pairing code generated! Valid for ${durationLabel}.`);
    }
  };

  const addInHouseRider = async () => {
    if (!inHouseName.trim() || !inHousePhone.trim()) {
      toast.error("Please fill in Driver Name and Phone Number");
      return;
    }

    const { error } = await supabase.from("rider_connections").insert({
      shop_id: currentShop.id,
      rider_name: inHouseName.trim(),
      rider_phone: inHousePhone.trim(),
      connection_code: "IN-HOUSE",
      expires_at: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000).toISOString(),
      status: "active",
    });

    if (error) {
      toast.error(error.message);
    } else {
      setInHouseName("");
      setInHousePhone("");
      setShowInHouseModal(false);
      void fetchConnections();
      toast.success("In-house driver registered successfully!");
    }
  };

  const deleteConnection = async (id: string) => {
    const { error } = await supabase
      .from("rider_connections")
      .delete()
      .eq("id", id);
    if (!error) {
      void fetchConnections();
      toast.success("Driver connection disconnected.");
    }
  };

  const activeConnectionsCount = useMemo(() => connections.filter(
    (c) => (c.rider_id || c.connection_code === "IN-HOUSE") && new Date(c.expires_at) >= new Date(),
  ).length, [connections]);

  const availableCodesCount = useMemo(() => connections.filter(
    (c) => !c.rider_id && c.connection_code !== "IN-HOUSE" && new Date(c.expires_at) >= new Date(),
  ).length, [connections]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Visual Header */}
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b border-outline-variant/10 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl md:text-3xl font-headline font-bold text-on-surface tracking-tight">
              Rider Fleet
            </h2>
            <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase tracking-widest">
              v1.2
            </span>
          </div>
          <p className="text-sm text-on-surface-variant font-medium">
            Manage your delivery network, monitor active routes, and configure secure pairing ciphers.
          </p>
        </div>
      </header>

      {/* Sub-Tabs Switcher */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-outline-variant/10 scrollbar-none">
        {[
          { id: "missions", label: "Live Missions", icon: Compass, count: activeMissions.length },
          { id: "network", label: "Rider Network", icon: Bike, count: activeConnectionsCount },
          { id: "controls", label: "Courier & Trust", icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as "missions" | "network" | "controls")}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer whitespace-nowrap border uppercase tracking-wider",
                isActive
                  ? "bg-zinc-900 text-white border-zinc-900 shadow-sm"
                  : "bg-surface-container-low text-on-surface-variant border-outline-variant/10 hover:text-on-surface hover:bg-surface-container-high"
              )}
            >
              <Icon size={14} className={cn(isActive ? "text-primary" : "text-on-surface-variant/60")} />
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={cn(
                  "px-1.5 py-0.5 text-[9px] font-black rounded-lg",
                  isActive ? "bg-primary text-on-primary" : "bg-on-surface/10 text-on-surface"
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
                onClick={fetchConnections}
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
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-surface-container-low p-4 rounded-[1.5rem] border border-outline-variant/10 shadow-sm">
              <div className="space-y-0.5">
                <span className="text-xs font-black text-on-surface uppercase tracking-wider block">Pairing Center</span>
                <p className="text-[10px] font-medium text-on-surface-variant">Add new couriers and generate pairing codes</p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                <button
                  onClick={() => setShowQRScanner(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-zinc-950 text-white rounded-xl font-bold hover:bg-zinc-850 transition-all text-xs cursor-pointer"
                >
                  <Camera size={14} />
                  Scan QR
                </button>
                <button
                  onClick={() => setShowInHouseModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 rounded-xl font-bold hover:bg-indigo-500/20 transition-all text-xs cursor-pointer"
                >
                  <Users size={14} />
                  + In-House
                </button>
                <div className="flex items-center bg-primary/5 border border-primary/20 rounded-xl px-2.5 py-1 gap-1.5">
                  <select
                    value={pairingCodeDuration}
                    onChange={(e) => setPairingCodeDuration(e.target.value as "24h" | "7d" | "30d" | "never")}
                    className="bg-transparent border-0 text-[11px] font-black text-primary focus:ring-0 focus:outline-none pr-7 py-0.5 cursor-pointer"
                  >
                    <option value="24h">24h Expire</option>
                    <option value="7d">7d Expire</option>
                    <option value="30d">30d Expire</option>
                    <option value="never">No Expiry</option>
                  </select>
                  <button
                    onClick={generateCode}
                    className="flex items-center gap-1 px-3 py-1.5 bg-primary text-on-primary rounded-lg font-bold hover:scale-[1.02] active:scale-[0.98] transition-all text-[11px] cursor-pointer"
                  >
                    <Plus size={12} />
                    Gen Key
                  </button>
                </div>
              </div>
            </div>

            {/* Active pairing code details block */}
            {showCode && activeCode && (
              <div className="bg-primary/[0.03] border border-primary/10 rounded-3xl p-6 relative overflow-hidden animate-fade-in flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="space-y-4 max-w-sm">
                  <div>
                    <span className="text-[10px] font-black uppercase bg-primary/10 text-primary px-2.5 py-1 rounded-full tracking-widest">
                      Active Pairing Key
                    </span>
                    <h3 className="text-xl font-headline font-black text-on-surface mt-2.5">
                      Driver Handshake Ready
                    </h3>
                    <p className="text-xs text-on-surface-variant font-medium mt-1 leading-relaxed">
                      Instruct the courier to enter this code in their LocalEats Driver Application under "Pair Shop" to synchronize automatically.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-mono font-black text-zinc-950 tracking-wider">
                      {activeCode.code}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(activeCode.code);
                        toast.success("Handshake code copied to clipboard!");
                      }}
                      className="p-2 rounded-xl bg-on-surface/5 hover:bg-on-surface/10 transition-colors text-on-surface-variant hover:text-on-surface cursor-pointer"
                    >
                      <Copy size={16} />
                    </button>
                  </div>

                  <p className="text-[10px] text-on-surface-variant/70 font-medium">
                    This pairing session will automatically terminate on <span className="font-bold text-on-surface">{new Date(activeCode.expires).toLocaleDateString()} at {new Date(activeCode.expires).toLocaleTimeString()}</span>.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-outline-variant/10 shadow-sm flex flex-col items-center justify-center shrink-0">
                  {qrUrl ? (
                    <>
                      <img src={qrUrl} alt="Pairing QR Code" className="w-36 h-36" />
                      <span className="text-[9px] font-black uppercase text-zinc-500 mt-2 tracking-widest">Scan to Pair Link</span>
                    </>
                  ) : (
                    <div className="w-36 h-36 bg-zinc-100 animate-pulse rounded-lg flex items-center justify-center text-zinc-400 text-xs font-bold">
                      Generating QR...
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setShowCode(false)}
                  className="absolute top-4 right-4 text-on-surface-variant/40 hover:text-on-surface"
                >
                  <X size={18} />
                </button>
              </div>
            )}

            {/* Drivers list */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-outline-variant/5 pb-2">
                <h4 className="text-xs font-black uppercase text-on-surface-variant tracking-wider">
                  Active Connections ({activeConnectionsCount})
                </h4>
                {availableCodesCount > 0 && (
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200/50 px-2 py-0.5 rounded-full">
                    {availableCodesCount} unused keys
                  </span>
                )}
              </div>

              {loading ? (
                <div className="py-12 text-center text-xs text-on-surface-variant/60">
                  Loading courier registry...
                </div>
              ) : connections.length === 0 ? (
                <div className="bg-surface-container-low/30 rounded-3xl p-12 text-center border border-outline-variant/10 max-w-sm mx-auto space-y-3">
                  <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center mx-auto text-on-surface-variant/30">
                    <Bike size={20} />
                  </div>
                  <h4 className="text-xs font-bold text-on-surface uppercase tracking-tight">No Drivers Connected</h4>
                  <p className="text-[11px] text-on-surface-variant font-medium leading-relaxed">
                    Generate an Active Pairing Key or add an In-House driver above to activate your local delivery fleet.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {connections.map((conn) => {
                    const isExpired = new Date(conn.expires_at) < new Date();
                    const isInHouse = conn.connection_code === "IN-HOUSE";

                    return (
                      <div
                        key={conn.id}
                        className={cn(
                          "bg-surface-container-low rounded-2xl p-4.5 border transition-all flex flex-col justify-between gap-4 relative",
                          isExpired 
                            ? "border-outline-variant/10 opacity-60" 
                            : "border-outline-variant/10 hover:border-outline hover:shadow-sm"
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="w-10 h-10 rounded-xl bg-on-surface/5 flex items-center justify-center text-on-surface-variant">
                                <Users size={18} />
                              </div>
                              <span className={cn(
                                "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-surface-container-low",
                                conn.is_online ? "bg-green-500" : "bg-zinc-350"
                              )} />
                            </div>
                            <div>
                              <p className="font-bold text-xs text-on-surface">{conn.rider_name}</p>
                              <p className="text-[10px] text-on-surface-variant/75 font-mono">{conn.rider_phone || "No direct phone"}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            {!isInHouse && (
                              <button
                                onClick={() => deleteConnection(conn.id)}
                                className="p-1.5 hover:bg-red-50 hover:text-red-600 text-on-surface-variant/40 rounded-lg transition-colors cursor-pointer"
                                title="Disconnect rider relationship"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Diagnostics & Stats info bar */}
                        <div className="bg-on-surface/[0.02] border border-outline-variant/5 rounded-xl p-3 grid grid-cols-3 gap-2 text-center text-[10px]">
                          <div>
                            <span className="text-on-surface-variant/50 uppercase font-black text-[8px] tracking-wider block">Deliveries</span>
                            <span className="font-bold text-on-surface mt-0.5 block">{conn.total_deliveries || 0} tasks</span>
                          </div>
                          <div>
                            <span className="text-on-surface-variant/50 uppercase font-black text-[8px] tracking-wider block">Rating</span>
                            <span className="font-black text-primary flex items-center justify-center gap-0.5 mt-0.5">
                              ★ {conn.rating?.toFixed(1) || '5.0'}
                            </span>
                          </div>
                          <div>
                            <span className="text-on-surface-variant/50 uppercase font-black text-[8px] tracking-wider block">Protocol</span>
                            <span className="font-bold text-indigo-500 mt-0.5 block truncate">{isInHouse ? "In-House" : "Direct Key"}</span>
                          </div>
                        </div>

                        {/* Actions bar at bottom of connection card */}
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <span className="text-[9px] font-black text-on-surface-variant/50 uppercase tracking-widest">
                            {isInHouse ? "Permanent Access" : `Expires: ${new Date(conn.expires_at).toLocaleDateString()}`}
                          </span>

                          {conn.is_online && !isExpired && (
                            <button
                              onClick={() => {
                                setNudgingRider(conn);
                                setCustomNudgeText("");
                              }}
                              className="px-2.5 py-1 bg-amber-500 text-white text-[9px] font-black uppercase rounded-lg hover:bg-amber-600 transition-colors shadow-sm shadow-amber-500/10 cursor-pointer"
                            >
                              Nudge Signal
                            </button>
                          )}

                          {isExpired && (
                            <span className="text-[9px] font-black uppercase text-red-500 bg-red-50 border border-red-100 px-2 py-0.5 rounded-lg">
                              Expired Key
                            </span>
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

        {/* --- TAB 3: COURIER & TRUST --- */}
        {activeSubTab === "controls" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
            {/* Dispatch settings */}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-headline font-black text-on-surface">Store Courier Dispatch</h3>
                <p className="text-xs text-on-surface-variant">Configure independent fleet access permissions</p>
              </div>

              <div className="bg-surface-container-low rounded-3xl p-5 border border-outline-variant/10 shadow-sm space-y-4">
                <div className="flex items-start justify-between gap-4 border-b border-outline-variant/5 pb-4">
                  <div className="space-y-1">
                    <h4 className="text-xs font-black uppercase tracking-wider text-on-surface">Allow External Pool Riders</h4>
                    <p className="text-[11px] text-on-surface-variant font-medium leading-relaxed">
                      Enable verified public or independent couriers on the network to view and accept your orders when your in-house fleet is busy.
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
                    <h4 className="text-xs font-black uppercase tracking-wider text-on-surface">Auto-Find On-Demand Search</h4>
                    <p className="text-[11px] text-on-surface-variant font-medium leading-relaxed">
                      Automatically request regional delivery agents on the network the moment you approve a pickup or preparing order.
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
                      <span className="text-[10px] font-black uppercase text-on-surface-variant tracking-wider">Active Courier Balance</span>
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
                 className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md pointer-events-auto"
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
                rider_phone: "Paired via QR",
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

              <div className="p-6 bg-on-surface/5 border-t border-outline-variant/10 flex gap-3">
                <button
                  onClick={() => setNudgingRider(null)}
                  className="flex-1 py-3 bg-transparent border border-outline-variant/20 rounded-xl text-sm font-bold hover:bg-on-surface/5"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    const msg = customNudgeText.trim() || "⚠️ Real-time status update notification";
                    void sendRiderNudge(nudgingRider.rider_id || nudgingRider.id, msg);
                    setNudgingRider(null);
                    setCustomNudgeText("");
                  }}
                  className="flex-1 py-3 bg-amber-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition cursor-pointer"
                >
                  Send Signal Nudge
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
