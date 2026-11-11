import {pickupOrderingEnabled} from "./services/merchantPickupPolicy";
import {isPickupOrder} from "./services/merchantPickupPolicy";
import { checkPrinterConnectivity, printViaBluetooth, printViaUSB } from "./utils/escPosEngine";
import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import L from "leaflet";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { toast, Toaster } from "sonner";
import {
  Store,
  TrendingUp,
  DollarSign,
  Users,
  Sparkles,
  Bike,
  RefreshCw,
  Settings,
  HelpCircle,
  Check,
  Zap,
  ShieldCheck,
  Sliders,
  MapPin,
  AlertTriangle,
  Sun,
  Moon,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Volume2,
  Volume1,
  WifiOff,
  Activity,
  Megaphone,
  CreditCard,
  Truck,
  Copy,
  Wallet,
  Ticket,
  Info,
  Rocket,
  Bell,
  BellRing,
  CalendarClock,
  UserRound,
  Clock3,
  BellOff,
  UtensilsCrossed,
  ReceiptText,
  Printer,
  User as UserIcon,
  LayoutDashboard,
  PauseCircle,
  Circle,
  Loader2,
  ArrowRight,
  MoreHorizontal,
  Heart,
  QrCode
} from "lucide-react";
import { supabase, isSupabaseMocked } from "./lib/supabase";
import {
  auth as firebaseAuth,
  firebaseSignOutUser,
  formatFirebaseUserSession,
  onAuthStateChanged,
  getFirestoreShopById,
  getFirestoreOrders,
  updateFirestoreShop,
  getFirestoreMenuItems,
} from "./lib/firebase";
import { useKitchenAlerter } from "./hooks/useKitchenAlerter";
import { useAuthGuard } from "./hooks/useAuthGuard";
import { useOrderWorkflow } from "./hooks/useOrderWorkflow";
import { useShopLocation } from "./hooks/useShopLocation";
import { useAppNavigation } from "./hooks/useAppNavigation";
import { usePageNotificationAttention } from "./hooks/usePageNotificationAttention";
import { isMerchantPreviewSimulatorEnabled } from "./services/merchantPreviewSimulator";
import { useAppInitializer } from "./hooks/useAppInitializer";
import { usePushNotifications } from "./hooks/usePushNotifications";
import {
  Order,
  Shop,
  User,
  MenuItem,
} from "./types";
import { LocalEatsLogo } from "./components/LocalEatsLogo";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { DashboardOverview } from "./components/DashboardOverview";
import { ShopProfile } from "./components/ShopProfile";
import { OrdersManagement } from "./components/OrdersManagement";
import { MenuManagement } from "./components/MenuManagement";
import { Coupons } from "./components/Coupons";
import { Marketing } from "./components/Marketing";
import { Insights } from "./components/Insights";
import { PaymentHistory } from "./components/PaymentHistory";
import {MerchantSubscriptionPlans,parsePlanExpiry} from "./components/MerchantSubscriptionPlans";
import {SimpleOpeningHours} from "./components/SimpleOpeningHours";
import {purgeLegacyBillingDraft} from "./services/legacyBillingSafety";
import { LegalDocsModal } from "./components/LegalDocsModal";
import { DiagnosticUtilityModal } from "./components/DiagnosticUtilityModal";
import { ShopDiagnosticPanel } from "./components/ShopDiagnosticPanel";
import { OnboardingTour } from "./components/OnboardingTour";
import { InstallAppInvite } from "./components/InstallAppInvite";
import { CreateShopOnboarding } from "./components/CreateShopOnboarding";
import { PendingShopApproval } from "./components/PendingShopApproval";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ConnectivityMonitor } from "./components/ConnectivityMonitor";
import { LocationSyncIndicator } from "./components/LocationSyncIndicator";
import { ConfirmModal } from "./components/ui/ConfirmModal";
import { FirebaseInitializingOverlay } from "./components/ui/FirebaseInitializingOverlay";
import { SavingOverlay } from "./components/ui/SavingOverlay";
import { Skeleton, DashboardSkeleton } from "./components/ui/Skeleton";
import { SignIn } from "./components/SignIn";
import { SignUp } from "./components/SignUp";
import { VerificationPending } from "./components/VerificationPending";
import { EditProfile, ProfileData } from "./components/EditProfile";
import { NotificationCenterSidePanel } from "./components/NotificationCenterSidePanel";
import {
  syncShopAvailability,
} from "./utils/availabilityChecker";
import {
  cleanLocalStorageCache,
} from "./utils/storageCleanup";
import {
} from "./utils/timeSync";
import {
  QueuedPrintJob,
  generateReceiptBytes,
  getFailedPrints,
  queueFailedPrint,
  deleteFailedPrint,
} from "./utils/escPosEngine";
import {
  isValidUUID,
  isShopOwnedByUser,
  getOwnedShopIds,
  registerVerifiedShopId,
  clearVerifiedShopOwnership,
} from "./utils/shopOwnership";
import { MerchantApi, MerchantApiError } from "./services/MerchantApi";
import { createMerchantOrderReadCoordinator } from "./services/merchantOrderRecovery";
import { fetchWithRetry } from "./utils/fetchWithRetry";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const clearMerchantShopOperationalCache = () => {
  [
    "localeats_cached_shops",
    "localeats_cached_menu_items",
    "localeats_my_shop_id",
    "localeats_vendor_shop_id",
    "localeats_last_selected_shop_id",
    "le_menu",
  ].forEach((key) => localStorage.removeItem(key));
};

type MerchantShopGateState =
  | { status: "checking" }
  | { status: "no-shop" }
  | { status: "ready"; shop: Shop }
  | { status: "approval-required"; shop: Shop }
  | { status: "error"; message: string };

const getMerchantShopErrorMessage = (error: unknown): string => {
  if (error instanceof MerchantApiError) {
    if (error.status === 401 || error.status === 403) {
      return "Your merchant session could not be verified. Please sign out and sign in again.";
    }
    if (error.status === null) {
      return "Please check your connection and try again.";
    }
  }
  return "The merchant verification service is temporarily unavailable. Please try again.";
};

// Fix Leaflet marker icons
// @ts-expect-error - Leaflet Default Icon prototype doesn't have _getIconUrl type
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

function App() {
  const reduceMotion = useReducedMotion();
  console.log("[App] App component function executing");
  const { subscribeWithAuthGuard } = useAuthGuard();
  const [isSessionChecking, setIsSessionChecking] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const [loading, setLoading] = useState(true);
  const [authView, setAuthView] = useState<"signin" | "signup">("signin");
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [signupEmail] = useState<string>("");
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSaveSuccess, setIsSaveSuccess] = useState<boolean>(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const confirmAction = (title: string, message: string, onConfirm: () => void, confirmText = "Delete") => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm, confirmText });
  };

  const { activeTab, setActiveTab } = useAppNavigation("dashboard");
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
  const mobileMoreDrawerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isMobileMoreOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    mobileMoreDrawerRef.current?.focus();
    // Lock background scrolling while the mobile drawer is open; restore the prior style.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [isMobileMoreOpen]);
  const [showHelp, setShowHelp] = useState(false);
  const [showLegal, setShowLegal] = useState(false);
  const [dataSaverMode] = useState<boolean>(() => localStorage.getItem("localeats_data_saver") === "true");
  const [darkMode, setDarkMode] = useState<boolean>(() => localStorage.getItem("darkMode") === "true");
  const [showOfflineInfoModal, setShowOfflineInfoModal] = useState<boolean>(false);
  const [testingConnection, setTestingConnection] = useState<boolean>(false);

  const handleTestConnection = async () => {
    if (testingConnection) return;
    setTestingConnection(true);
    try {
      // navigator.onLine does not prove our merchant API responds.
      const verified = await MerchantApi.getMerchantShop();
      if (verified && user?.id && String(verified.owner_id) === String(user.id)) {
        toast.success("Merchant API and your shop connection were verified.");
      } else {
        toast.error("Merchant API responded, but your shop could not be verified.");
      }
    } catch {
      toast.error("Merchant API connection could not be verified. Please retry.");
    } finally {
      setTestingConnection(false);
    }
  };
  const [isOffline, setIsOffline] = useState<boolean>(() => typeof navigator !== "undefined" ? !navigator.onLine : false);

  // --- Real-Time Heartbeat Telemetry & State Re-hydration ---
  const [isHeartbeatFailed, setIsHeartbeatFailed] = useState<boolean>(false);
  const [dismissedOfflineOverlay, setDismissedOfflineOverlay] = useState<boolean>(false);
  const wasOffline = useRef(false);

  // --- ESC/POS Failed Printing Queue ---
  const [failedPrints, setFailedPrints] = useState<QueuedPrintJob[]>([]);
  const [printingHardwareLoading, setPrintingHardwareLoading] = useState<boolean>(false);

  const [showAutoAcceptModal, setShowAutoAcceptModal] = useState<boolean>(false);
  const [soundAlerts, setSoundAlerts] = useState<boolean>(() => localStorage.getItem("soundAlerts") !== "false");
  const [soundStyle, setSoundStyle] = useState<string>(() => localStorage.getItem("soundStyle") || "modern");
  const [soundVolume, setSoundVolume] = useState<number>(() => Number(localStorage.getItem("soundVolume") || "70"));
  // Client-side automatic acceptance remains safety-locked. It must not accept
  // old orders after reconnection or based solely on a browser-stored toggle.
  const [autoAcceptOrders, setAutoAcceptOrders] = useState<boolean>(false);
  const [autoPrint, setAutoPrint] = useState<boolean>(() => localStorage.getItem("autoPrint") === "true");
  const [printingFormat, setPrintingFormat] = useState<"80mm" | "58mm">(() => (localStorage.getItem("printingFormat") as "80mm" | "58mm") || "80mm");
  const [deliverySettings, setDeliverySettings] = useState({ 
    type: "fixed", 
    baseFee: 15, 
    freeDeliveryOver: 200, 
    minOrderAmount: 0, 
    maxDistanceKm: 10,
    radiusEnabled: true,
  });
  const [kitchenMode, setKitchenMode] = useState<boolean>(() => localStorage.getItem("localeats_kitchen_mode") === "true");

  useEffect(() => {
    localStorage.setItem("localeats_kitchen_mode", kitchenMode ? "true" : "false");
  }, [kitchenMode]);


  // Version Polling for Updates
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isDiagnosticOpen, setIsDiagnosticOpen] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<string>("");
  const currentBuildVersion = useRef(19); // Moving to v5.4 tracker
  const topNavScrollRef = useRef<HTMLDivElement>(null);
  const shopsRef = useRef<Shop[]>([]);
  const prevPendingCount = useRef<number>(0);
  const activeSoundRef = useRef<{ pause: () => void } | null>(null);

  useEffect(() => {
    if (dataSaverMode) return;
    const checkVersion = async () => {
      setLastCheckTime(new Date().toLocaleTimeString());
      try {
        const response = await fetch("/version.json?t=" + Date.now());
        if (response.ok) {
          const data = await response.json();
          if (data.version > currentBuildVersion.current) {
            setUpdateAvailable(true);
          }
        }
      } catch {
        // Quiet fail
      }
    };

    // once on mount and then every 30s
    checkVersion();
    const interval = setInterval(checkVersion, 30000);
    return () => clearInterval(interval);
  }, [dataSaverMode]);

  const [orders, setOrders] = useState<Order[]>([]);

  // --- Live Kitchen Alerter & Screen Wake ---
  const {
    isAudioEnabled,
    enableAudio,
  } = useKitchenAlerter(orders);
  const [shops, setShops] = useState<Shop[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [merchantShopGate, setMerchantShopGate] = useState<MerchantShopGateState>({ status: "checking" });
    const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  // Kitchen status state available if needed

  const currentShop = useMemo(
    () => shops.find((s) => isShopOwnedByUser(s, user)) || null,
    [shops, user],
  );

  const merchantShopRequest=useRef(0);
  const verifiedMerchantUid=useRef<string|null>(null);
  const acceptAuthoritativeMerchantShop = useCallback((firebaseUid: string, shop: Shop) => {
    if(firebaseAuth.currentUser?.uid!==firebaseUid)return;
    if(shop.owner_id!==firebaseUid)throw Error("Shop ownership could not be verified for this account.");
    registerVerifiedShopId(firebaseUid, shop.id);
    setShops([shop]);
    if (shop.approval_status === "approved") {
      verifiedMerchantUid.current=firebaseUid;
      setMerchantShopGate({ status: "ready", shop });
      return;
    }

    setOrders([]);
    setMenuItems([]);
    verifiedMerchantUid.current=null;
    setMerchantShopGate({ status: "approval-required", shop });
  }, []);

  const resolveMerchantShop = useCallback(async (firebaseUid: string,background=false): Promise<Shop | null> => {
    if(firebaseAuth.currentUser?.uid!==firebaseUid)return null;
    const request=++merchantShopRequest.current;
    const sameVerifiedAccount=background && verifiedMerchantUid.current===firebaseUid && firebaseAuth.currentUser?.uid===firebaseUid;
    if(!sameVerifiedAccount){setOrders([]);setMerchantShopGate({ status: "checking" });}
    const current=()=>request===merchantShopRequest.current && firebaseAuth.currentUser?.uid===firebaseUid;
    let deadline:ReturnType<typeof setTimeout>|undefined;
    try {
      const verifiedShop = await Promise.race([MerchantApi.getMerchantShop(),new Promise<never>((_resolve,reject)=>{deadline=setTimeout(()=>reject(Error("Shop verification timed out. Retry verification.")),15000);})]);
      if(!current())return null;
      if (!verifiedShop || verifiedShop.id === null || verifiedShop.id === undefined) {
        verifiedMerchantUid.current=null;
        clearVerifiedShopOwnership();
        clearMerchantShopOperationalCache();
        setShops([]);
        setMenuItems([]);
        setOrders([]);
        setMerchantShopGate({ status: "no-shop" });
        return null;
      }

      const shop = verifiedShop as Shop;
      acceptAuthoritativeMerchantShop(firebaseUid, shop);
      return shop;
    } catch (error) {
      if(!current())return null;
      verifiedMerchantUid.current=null;
      console.warn("[Shop Discovery] API verification failed closed:", error);
      clearVerifiedShopOwnership();
      clearMerchantShopOperationalCache();
      setShops([]);
      setMenuItems([]);
      setOrders([]);
      setMerchantShopGate({ status: "error", message: getMerchantShopErrorMessage(error) });
      return null;
    }finally{clearTimeout(deadline);}
  }, [acceptAuthoritativeMerchantShop]);

  const handleCreatedMerchantShop = useCallback(async (shop: Shop) => {
    const firebaseUid = firebaseAuth.currentUser?.uid;
    if (!firebaseUid) {
      setOrders([]);
      setMenuItems([]);
      setMerchantShopGate({
        status: "error",
        message: "Your merchant session could not be verified. Please sign out and sign in again.",
      });
      throw new Error("Authenticated Firebase user is required to accept a created shop.");
    }

    acceptAuthoritativeMerchantShop(firebaseUid, shop);
  }, [acceptAuthoritativeMerchantShop]);

  const refreshAuthoritativeMerchantShop = useCallback(async () => {
    const firebaseUid = firebaseAuth.currentUser?.uid;
    if (!firebaseUid) {
      setOrders([]);
      setMenuItems([]);
      setMerchantShopGate({
        status: "error",
        message: "Your merchant session could not be verified. Please sign out and sign in again.",
      });
      return;
    }
    await resolveMerchantShop(firebaseUid,true);
  }, [resolveMerchantShop]);

  // Centralized Shop Location & Sync State Engine
  const {
    locationState: currentShopLocation,
    syncAnalysis: currentShopLocationSync,
    isLocating: isLocatingShopGPS,
    isSaving: isSavingShopLocation,
    detectCurrentGPS: detectShopGPS,
    autoAlignWithCoordinates: autoAlignShopCity,
    saveLocation: saveShopLocationSettings,
  } = useShopLocation({
    shop: currentShop,
    onLocationSaved: (updated) => {
      setShops((prev) =>
        prev.map((s) => (s.id === currentShop?.id ? { ...s, ...updated } : s))
      );
    },
  });

  const shopId = currentShop?.id;
  const deliveryRadiusKm = currentShop?.delivery_radius_km;
  const deliveryRadiusEnabled = currentShop?.delivery_radius_enabled;

  useEffect(() => {
    if (shopId) {
      setDeliverySettings((prev) => {
        const nextDist = deliveryRadiusKm ?? prev.maxDistanceKm ?? 10;
        const nextEnabled = deliveryRadiusEnabled ?? prev.radiusEnabled ?? true;
        if (prev.maxDistanceKm === nextDist && prev.radiusEnabled === nextEnabled) {
          return prev;
        }
        return {
          ...prev,
          maxDistanceKm: nextDist,
          radiusEnabled: nextEnabled,
        };
      });

    }
  }, [
    shopId,
    deliveryRadiusKm,
    deliveryRadiusEnabled,
  ]);

  // Never synthesize 30-day trials or billing deadlines from shop creation.
  // The approved three-month offer only gets a countdown once the merchant API
  // returns an explicit timezone-aware trial_end_date for the verified shop.
  const trialInfo=useMemo(()=>{
    if(!currentShop||currentShop.subscription_status!=="trial")return null;
    const expiry=parsePlanExpiry(currentShop.trial_end_date);
    if(expiry===null)return null;
    const daysRemaining=Math.max(0,Math.ceil((expiry-Date.now())/86400000));
    return {daysRemaining,isExpired:expiry<=Date.now()};
  },[currentShop]);

  const [settingsCategory, setSettingsCategory] = useState<string>("storefront");
  const [storeStatus, setStoreStatus] = useState<"open" | "busy" | "closed">("open");
  const [prepTime, setPrepTime] = useState<number>(20);
  const [operatingHours, setOperatingHours] = useState<Array<{ day: string; open: string; close: string; active: boolean }>>([
    { day: "Mon", open: "08:00", close: "17:00", active: true },
    { day: "Tue", open: "08:00", close: "17:00", active: true },
    { day: "Wed", open: "08:00", close: "17:00", active: true },
    { day: "Thu", open: "08:00", close: "17:00", active: true },
    { day: "Fri", open: "08:00", close: "17:00", active: true },
    { day: "Sat", open: "08:00", close: "17:00", active: true },
    { day: "Sun", open: "08:00", close: "17:00", active: false },
  ]);

  // Legacy Settings once saved raw PAN/CVV in localStorage. Do not ever read
  // that draft into React; discard the whole legacy key on this device.
  const [legacyBillingCleanupFailed,setLegacyBillingCleanupFailed]=useState(false);
  useEffect(()=>{
    if(!purgeLegacyBillingDraft())setLegacyBillingCleanupFailed(true);
  },[]);

  const [updateDismissed, setUpdateDismissed] = useState<boolean>(false);

  useEffect(() => {
    if (user?.user_metadata?.weekly_operating_hours) {
      setOperatingHours(user.user_metadata.weekly_operating_hours);
    }
  }, [user]);

  // --- Persistent Auth Session Sync ---
  useEffect(() => {
    const syncUserSession = (u: User) => {
      setUser(u);
      try {
        localStorage.setItem("localeats_user_session", JSON.stringify(u));
      } catch {
        // ignore
      }
    };

    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          syncUserSession(session.user);
        }
      } catch (err) {
        console.warn("[AuthSync] Initial session check warning:", err);
      }
    };

    void checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        syncUserSession(session.user);
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (currentShop) {
      setStoreStatus(currentShop.is_active ? "open" : "closed");
    }
  }, [currentShop]);

  // --- Shop Live Heartbeat & Inactivity Tracker ---
  useEffect(() => {
    // Preview may reuse Production Supabase credentials. Opening a read-only
    // Preview must not update shops.updated_at in the live database.
    if (import.meta.env.VITE_MERCHANT_PREVIEW_READ_ONLY === "true") return;
    if (merchantShopGate.status !== "ready" || !user || !currentShop) return;

    const syncHeartbeat = async () => {
      try {
        const timeNow = new Date().toISOString();
        const lastUpdated = currentShop.updated_at ? new Date(currentShop.updated_at).getTime() : 0;
        const oneHourMs = 60 * 60 * 1000;
        const fourDaysMs = 4 * 24 * 60 * 60 * 1000;

        // Custom welcoming alerts if they were offline or inactive for more than 4 days
        if (currentShop.updated_at && (Date.now() - lastUpdated > fourDaysMs)) {
          toast.warning("⚠️ Welcome Back! Dashboard Inactive for 4+ Days", {
            description: "We've synchronized your cloud connection status and verified that your online storefront is active and ready for orders!",
            duration: 12000,
          });
        }

        // Defensive check: only update if current local state is outdated by at least 1 hour, to prevent excessive DB writes
        if (Date.now() - lastUpdated < oneHourMs) {
          return;
        }

        // Quietly update the database
        const { error } = await supabase
          .from("shops")
          .update({ updated_at: timeNow })
          .eq("id", currentShop.id);

        if (error) {
          if (error.code === '42703' || error.message?.includes('column "updated_at" of relation "shops" does not exist')) {
            console.warn("Telemetry warning: updated_at column is not yet provisioned in your shops table.", error.message);
          } else {
            console.warn("Telemetry warning: Failed to push storefront heartbeat.", error.message);
          }
        } else {
          // Update local state smoothly
          setShops((prev) =>
            prev.map((s) => (s.id === currentShop.id ? { ...s, updated_at: timeNow } : s))
          );
        }
      } catch (err) {
        console.warn("Defensive catch: Failed to push storefront heartbeat. internet or Supabase schema:", err);
      }
    };

    // Trigger heartbeat check
    void syncHeartbeat();

    // every 10 minutes to maintain active signal in active session
    const interval = setInterval(() => {
      void syncHeartbeat();
    }, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user, currentShop, merchantShopGate.status]);



  useEffect(() => {
    try {
      const cachedOrders = localStorage.getItem("le_orders");
      if (cachedOrders) {
        const parsed = JSON.parse(cachedOrders);
        // Cached orders cannot establish API pickup authority; load them only from authenticated reads.
      }
    } catch (e) {
      console.error("Error parsing cached orders. Resetting item.", e);
      localStorage.removeItem("le_orders");
    }

  }, []);

  useEffect(() => {
    shopsRef.current = shops;
  }, [shops]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("darkMode", "true");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("darkMode", "false");
    }
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem("soundAlerts", soundAlerts.toString());
  }, [soundAlerts]);

  useEffect(() => {
    localStorage.setItem("soundStyle", soundStyle);
  }, [soundStyle]);

  useEffect(() => {
    localStorage.setItem("soundVolume", soundVolume.toString());
  }, [soundVolume]);

  useEffect(() => {
    // Read cached UX preferences (like dark mode) without restoring the user session
    try {
      const cached = localStorage.getItem("localeats_user_session");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.user_metadata?.dark_mode !== undefined) {
          setDarkMode(parsed.user_metadata.dark_mode);
        }
      }
    } catch {
      // ignore
    }

    const handleForceLogout = () => {
      console.log("Force logout triggered");
      clearVerifiedShopOwnership();
      clearMerchantShopOperationalCache();
      setShops([]);
      setMenuItems([]);
      setOrders([]);
      setMerchantShopGate({ status: "checking" });
      setUser(null);
      localStorage.removeItem("localeats_user_session");
      firebaseSignOutUser().catch(() => {});
    };
    window.addEventListener("force_logout", handleForceLogout);

    // Listen for Firebase Auth state changes
    console.log("[Auth Init] Registering Firebase onAuthStateChanged listener...");
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (fbUser) => {
      if((fbUser?.uid ?? null)!==(firebaseAuth.currentUser?.uid ?? null))return;
      console.log(`[Auth Listener] Firebase Auth event triggered, user: ${fbUser?.uid || 'none'}`);
      if (fbUser) {
        try {
          const sessionUser = await formatFirebaseUserSession(fbUser);
          if(firebaseAuth.currentUser?.uid!==fbUser.uid)return;
          
          await resolveMerchantShop(fbUser.uid);
          if(firebaseAuth.currentUser?.uid!==fbUser.uid)return;

          setUser(sessionUser);
          localStorage.setItem("localeats_user_session", JSON.stringify(sessionUser));
          if (sessionUser.user_metadata?.dark_mode !== undefined) {
            setDarkMode(Boolean(sessionUser.user_metadata.dark_mode));
          }
        } catch (e) {
          if(firebaseAuth.currentUser?.uid!==fbUser.uid)return;
          console.warn("[Auth Listener] Warning formatting Firebase user session:", e);
          clearVerifiedShopOwnership();
          clearMerchantShopOperationalCache();
          setShops([]);
          setMenuItems([]);
          setOrders([]);
          setMerchantShopGate({
            status: "error",
            message: "Your merchant session could not be verified. Please sign out and sign in again.",
          });
        }
      } else {
        // Phase 3.1: Clear ownership and properly clear session when unauthenticated
        clearVerifiedShopOwnership();
        clearMerchantShopOperationalCache();
        setShops([]);
        setMenuItems([]);
        setOrders([]);
        setMerchantShopGate({ status: "checking" });
        setUser(null);
        localStorage.removeItem("localeats_user_session");
      }
      setIsSessionChecking(false);
      setIsAuthReady(true);
      setLoading(false);
    });

    return () => {
      unsubscribe();
      window.removeEventListener("force_logout", handleForceLogout);
    };
  }, [resolveMerchantShop]);

  useEffect(() => {
    // Run storage audit cleanup on initialization to purge stale caches while preserving user shop overrides
    cleanLocalStorageCache();
  }, []);

  // Availability is evaluated by Postgres; a dashboard must never auto-write a schedule.
  useEffect(() => {
    const confirmed=(event:Event)=>{const shop=(event as CustomEvent<Shop>).detail;setShops(prev=>prev.map(s=>String(s.id)===String(shop.id)?{...s,...shop}:s));};
    window.addEventListener("localeats:availability-confirmed",confirmed);
    return ()=>window.removeEventListener("localeats:availability-confirmed",confirmed);
  },[]);


  // VAPID Push configuration moved to custom hook usePushNotifications
  const { pushEnabled, requestPushPermissions } = usePushNotifications(false);

  const playNotificationSound = useCallback((isRepeating = false, styleOverride?: "calm" | "friendly" | "sparkle") => {
    // Stop previous playing sound if active
    if (activeSoundRef.current) {
      try {
        activeSoundRef.current.pause();
      } catch (err) {
        console.warn("Error pausing previous audio ref:", err);
      }
      activeSoundRef.current = null;
    }

    // Vibrate if supported
    if ("vibrate" in navigator) {
      navigator.vibrate([200, 100, 200, 100, 200]);
    }

    const style = styleOverride || soundStyle;
    const vol = soundVolume / 100; // 0.0 to 1.0

    let audioControl: { pause: () => void } = { pause: () => {} };

    try {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) {
        // Fallback to Mixkit URL if Web Audio API not supported
        const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3");
        audio.volume = vol;
        if (isRepeating) {
          audio.loop = true;
          setTimeout(() => { audio.pause(); }, 10000);
        }
        audio.play().catch((e) => console.log("Audio play blocked or failed:", e));
        audioControl = { pause: () => audio.pause() };
        activeSoundRef.current = audioControl;
        return audioControl;
      }

      const ctx = new AudioContextClass();
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(vol * 0.15, ctx.currentTime); // Node scale volume for comfort
      masterGain.connect(ctx.destination);

      const now = ctx.currentTime;

      if (style === "calm") {
        // High-end dual glass chime
        const notes = [
          { freq: 659.25, time: 0 },   // E5
          { freq: 830.61, time: 0.1 },  // G#5
          { freq: 987.77, time: 0.2 }   // B5
        ];

        notes.forEach(({ freq, time }) => {
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();

          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, now + time);

          gainNode.gain.setValueAtTime(0, now + time);
          gainNode.gain.linearRampToValueAtTime(0.8, now + time + 0.04);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + time + 0.8);

          osc.connect(gainNode);
          gainNode.connect(masterGain);

          osc.start(now + time);
          osc.stop(now + time + 0.8);
        });
      } else if (style === "friendly") {
        // Cozy organic bubble pop (marimba tap)
        const notes = [
          { freq: 440.00, time: 0, dur: 0.15 },
          { freq: 554.37, time: 0.05, dur: 0.2 }
        ];

        notes.forEach(({ freq, time, dur }) => {
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();
          const filter = ctx.createBiquadFilter();

          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now + time);
          osc.frequency.exponentialRampToValueAtTime(freq * 0.9, now + time + dur);

          filter.type = "lowpass";
          filter.frequency.setValueAtTime(1200, now + time);

          gainNode.gain.setValueAtTime(0, now + time);
          gainNode.gain.linearRampToValueAtTime(1.0, now + time + 0.01);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + time + dur);

          osc.connect(filter);
          filter.connect(gainNode);
          gainNode.connect(masterGain);

          osc.start(now + time);
          osc.stop(now + time + dur);
        });
      } else if (style === "sparkle") {
        // Bright shining cascading glockenspiel
        const notes = [
          { freq: 523.25, time: 0 },
          { freq: 659.25, time: 0.06 },
          { freq: 783.99, time: 0.12 },
          { freq: 1046.50, time: 0.18 }
        ];

        notes.forEach(({ freq, time }) => {
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();

          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now + time);

          gainNode.gain.setValueAtTime(0, now + time);
          gainNode.gain.linearRampToValueAtTime(0.6, now + time + 0.01);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + time + 0.6);

          osc.connect(gainNode);
          gainNode.connect(masterGain);

          const subOsc = ctx.createOscillator();
          const subGain = ctx.createGain();
          subOsc.type = "triangle";
          subOsc.frequency.setValueAtTime(freq / 2, now + time);
          subGain.gain.setValueAtTime(0, now + time);
          subGain.gain.linearRampToValueAtTime(0.2, now + time + 0.01);
          subGain.gain.exponentialRampToValueAtTime(0.001, now + time + 0.3);

          subOsc.connect(subGain);
          subGain.connect(masterGain);

          osc.start(now + time);
          osc.stop(now + time + 0.6);
          subOsc.start(now + time);
          subOsc.stop(now + time + 0.3);
        });
      }

      // If repeating is true, schedule recurring oscillator runs
      let repeatInterval: ReturnType<typeof setInterval> | null = null;
      if (isRepeating) {
        let count = 0;
        repeatInterval = setInterval(() => {
          count++;
          if (count >= 5) { // Stop repeating after 10-12s
            if (repeatInterval) clearInterval(repeatInterval);
            return;
          }
          const repNow = ctx.currentTime;
          if (style === "calm") {
            const notes = [{ freq: 659.25, time: 0 }, { freq: 830.61, time: 0.1 }, { freq: 987.77, time: 0.2 }];
            notes.forEach(({ freq, time }) => {
              const osc = ctx.createOscillator();
              const gainNode = ctx.createGain();
              osc.type = "triangle";
              osc.frequency.setValueAtTime(freq, repNow + time);
              gainNode.gain.setValueAtTime(0, repNow + time);
              gainNode.gain.linearRampToValueAtTime(0.8, repNow + time + 0.04);
              gainNode.gain.exponentialRampToValueAtTime(0.001, repNow + time + 0.8);
              osc.connect(gainNode); gainNode.connect(masterGain);
              osc.start(repNow + time); osc.stop(repNow + time + 0.8);
            });
          } else if (style === "friendly") {
            const notes = [{ freq: 440.00, time: 0, dur: 0.15 }, { freq: 554.37, time: 0.05, dur: 0.2 }];
            notes.forEach(({ freq, time, dur }) => {
              const osc = ctx.createOscillator();
              const gainNode = ctx.createGain();
              const filter = ctx.createBiquadFilter();
              osc.type = "sine";
              osc.frequency.setValueAtTime(freq, repNow + time);
              osc.frequency.exponentialRampToValueAtTime(freq * 0.9, repNow + time + dur);
              filter.type = "lowpass"; filter.frequency.setValueAtTime(1200, repNow + time);
              gainNode.gain.setValueAtTime(0, repNow + time);
              gainNode.gain.linearRampToValueAtTime(1.0, repNow + time + 0.01);
              gainNode.gain.exponentialRampToValueAtTime(0.001, repNow + time + dur);
              osc.connect(filter); filter.connect(gainNode); gainNode.connect(masterGain);
              osc.start(repNow + time); osc.stop(repNow + time + dur);
            });
          } else if (style === "sparkle") {
            const notes = [{ freq: 523.25, time: 0 }, { freq: 659.25, time: 0.06 }, { freq: 783.99, time: 0.12 }, { freq: 1046.50, time: 0.18 }];
            notes.forEach(({ freq, time }) => {
              const osc = ctx.createOscillator();
              const gainNode = ctx.createGain();
              osc.type = "sine";
              osc.frequency.setValueAtTime(freq, repNow + time);
              gainNode.gain.setValueAtTime(0, repNow + time);
              gainNode.gain.linearRampToValueAtTime(0.6, repNow + time + 0.01);
              gainNode.gain.exponentialRampToValueAtTime(0.001, repNow + time + 0.6);
              osc.connect(gainNode); gainNode.connect(masterGain);

              const subOsc = ctx.createOscillator();
              const subGain = ctx.createGain();
              subOsc.type = "triangle";
              subOsc.frequency.setValueAtTime(freq / 2, repNow + time);
              subGain.gain.setValueAtTime(0, repNow + time);
              subGain.gain.linearRampToValueAtTime(0.2, repNow + time + 0.01);
              subGain.gain.exponentialRampToValueAtTime(0.001, repNow + time + 0.3);
              subOsc.connect(subGain); subGain.connect(masterGain);

              osc.start(repNow + time); osc.stop(repNow + time + 0.6);
              subOsc.start(repNow + time); subOsc.stop(repNow + time + 0.3);
            });
          }
        }, 2200);
      }

      audioControl = {
        pause: () => {
          if (repeatInterval) {
            clearInterval(repeatInterval);
          }
          try {
            if (ctx.state !== "closed") {
              ctx.suspend().catch(() => {});
            }
          } catch (err) {
            console.warn("Error stopping synth:", err);
          }
        }
      };

      activeSoundRef.current = audioControl;
      return audioControl;
    } catch (e) {
      console.warn("Synthesizer error, fallback:", e);
      return { pause: () => {} };
    }
  }, [soundStyle, soundVolume]);

  // Sound alert logic for new orders
  useEffect(() => {
    if (!user) return;
    const currentPendingCount = orders.filter(
      (o) => o.status === "pending",
    ).length;

    // Only trigger if count increased and sound is enabled
    if (soundAlerts && currentPendingCount > prevPendingCount.current) {
      const audio = playNotificationSound(true); // Enable repeating for new orders

      const stopSound = () => {
        audio.pause();
        if (activeSoundRef.current) {
          activeSoundRef.current.pause();
          activeSoundRef.current = null;
        }
      };

      toast.success("NEW ORDER RECEIVED!", {
        description: `CRITICAL: You have ${currentPendingCount} pending ${currentPendingCount === 1 ? "order" : "orders"}.`,
        duration: 15000,
        important: true,
        icon: <Bell className="text-primary animate-bounce" />,
        action: {
          label: "DISMISS ALERT",
          onClick: () => {
            stopSound();
            setActiveTab("orders");
          },
        },
        onDismiss: () => stopSound(),
        onAutoClose: () => stopSound(),
      });
    }

    prevPendingCount.current = currentPendingCount;
  }, [orders, soundAlerts, user, playNotificationSound, setActiveTab]);

  const processAndSetOrders = useCallback((firestoreOrdersList: Order[], supabaseOrdersList: Order[] = []) => {
    // Merge Orders by unique string ID, prioritizing latest updated_at or created_at
    const orderMap = new Map<string, Order>();
    
    // Insert Supabase orders first
    supabaseOrdersList.forEach((order) => {
      orderMap.set(String(order.id), order);
    });

    // Insert Firestore orders (merges or adds new orders from client app)
    firestoreOrdersList.filter(order=>!isPickupOrder(order)).forEach((order) => {
      const existing = orderMap.get(String(order.id));
      if (!existing) {
        orderMap.set(String(order.id), order);
      } else {
        const existingTime = new Date(existing.updated_at || existing.created_at || 0).getTime();
        const incomingTime = new Date(order.updated_at || order.created_at || 0).getTime();
        if (incomingTime >= existingTime) {
          orderMap.set(String(order.id), { ...existing, ...order });
        }
      }
    });

    let combinedOrders = Array.from(orderMap.values());

    // Sort by created_at descending
    combinedOrders.sort((a, b) => {
      const timeA = new Date(a.created_at || 0).getTime();
      const timeB = new Date(b.created_at || 0).getTime();
      return timeB - timeA;
    });

    // Confirmed orders stay only in component memory; customer details must not
    // survive logout or shop-switch in shared-browser localStorage.
    setOrders(combinedOrders);
  }, []);

  // Orders are always read from the authenticated API. Keep only the current
  // shop's verified rows, in component memory, never in browser storage.
  const orderReadCoordinator = useRef(createMerchantOrderReadCoordinator<Record<string, unknown>>());
  const orderReadShopId = currentShop?.id == null ? null : String(currentShop.id);
  const orderReadScope = user && merchantShopGate.status === "ready" && orderReadShopId
    ? `${user.id}:${orderReadShopId}` : null;
  const [orderReadStatus,setOrderReadStatus] = useState<{
    state:"unverified"|"fresh"|"failed";lastSuccessAt:number|null;
  }>({state:"unverified",lastSuccessAt:null});

  // Invalidate and clear prior shop/account orders before the browser paints.
  // A stale inbox can stay visible only during a failed refresh of the SAME scope.
  useLayoutEffect(()=>{
    orderReadCoordinator.current.activate(orderReadScope);
    setOrders([]);
    setOrderReadStatus({state:"unverified",lastSuccessAt:null});
    return ()=>orderReadCoordinator.current.activate(null);
  },[orderReadScope]);

  const fetchOrders = useCallback(async () => {
    if (!orderReadScope || !orderReadShopId) {
      setOrders([]);
      return;
    }

    const result = await orderReadCoordinator.current.refresh(orderReadScope, async()=>{
      const data = await MerchantApi.getOrders();
      return data;
    });
    if (result.kind === "stale") return;
    if (result.kind === "failed") {
      // Keep the last verified rows visible, but clearly label them stale.
      // Polling must not flood the merchant with a new toast every 15 seconds.
      console.warn("[Orders Sync] Authoritative API unavailable:", result.error);
      setOrderReadStatus(previous => ({...previous,state:"failed"}));
      return;
    }
    const apiOrders = result.rows
      .filter(d=>String(d.shop_id)===orderReadShopId)
      .map((d: Record<string, unknown>) => ({
        ...d,
        id: String(d.id),
        total_price: Number(d.total_price ?? d.price ?? 0),
      })) as Order[];
    processAndSetOrders([], apiOrders);
    setOrderReadStatus({state:"fresh",lastSuccessAt:Date.now()});
  }, [orderReadScope,orderReadShopId,processAndSetOrders]);

  const menuReadShopId=merchantShopGate.status==="ready" && currentShop?.id != null
    ? String(currentShop.id) : null;
  const menuReadScope=user?.id && menuReadShopId ? `${user.id}:${menuReadShopId}` : null;
  const [menuReadStatus,setMenuReadStatus]=useState<{scope:string|null;state:"loading"|"ready"|"failed"}>({scope:null,state:"loading"});
  const menuReadRequest = useRef(0);

  // A merchant account/shop change clears the previous menu before paint.
  // Replacing the same shop object during heartbeat must NOT reset the menu.
  useLayoutEffect(()=>{
    ++menuReadRequest.current;
    setMenuItems([]);
    setMenuReadStatus({scope:menuReadScope,state:"loading"});
  },[menuReadScope]);

  useEffect(()=>{const refresh=()=>{void fetchOrders();};window.addEventListener("merchant-pickup-order-confirmed",refresh);return()=>window.removeEventListener("merchant-pickup-order-confirmed",refresh);},[fetchOrders]);
  const fetchAllMenuItems = useCallback(async () => {
    const request = ++menuReadRequest.current;
    if (!menuReadScope || !menuReadShopId) {
      setMenuItems([]);
      setMenuReadStatus({scope:null,state:"loading"});
      return;
    }
    // Same-shop reads preserve verified rows during refresh or API failure.
    // Only a new account/shop scope may clear the previous array.
    setMenuReadStatus(previous=>previous.scope===menuReadScope && previous.state!=="loading"
      ? previous : {scope:menuReadScope,state:"loading"});
    let deadline:ReturnType<typeof setTimeout>|undefined;
    try {
      const rows = await Promise.race([
        MerchantApi.getMenuItems(menuReadShopId),
        new Promise<never>((_resolve,reject)=>{
          deadline=setTimeout(()=>reject(Error("Menu read timed out")),15000);
        })
      ]);
      if (request === menuReadRequest.current) {
        setMenuItems(rows);
        setMenuReadStatus({scope:menuReadScope,state:"ready"});
      }
    } catch {
      if (request === menuReadRequest.current) {
        // Keep last same-scope snapshot; never represent a failed read as an empty menu.
        setMenuReadStatus({scope:menuReadScope,state:"failed"});
      }
    } finally { clearTimeout(deadline); }
  }, [menuReadShopId,menuReadScope]);
  useEffect(()=>{void fetchAllMenuItems();return ()=>{menuReadRequest.current++;};},[fetchAllMenuItems]);

  const fetchShops = useCallback(async () => {
    if (!user) {
      clearVerifiedShopOwnership();
      clearMerchantShopOperationalCache();
      setShops([]);
      setMenuItems([]);
      setOrders([]);
      setMerchantShopGate({ status: "checking" });
      return;
    }

    await refreshAuthoritativeMerchantShop();
  }, [user, refreshAuthoritativeMerchantShop]);

  useEffect(()=>{
    if(!user) return;
    const refresh=()=>{if(document.visibilityState==="visible")void fetchShops();};
    const timer=setInterval(refresh,30000);
    window.addEventListener("focus",refresh);
    return ()=>{clearInterval(timer);window.removeEventListener("focus",refresh);};
  },[user,fetchShops]);

  // Animate only the icon for the page to which a verified new alert belongs.
  // The cue is visual only; it never acknowledges messages or changes data.
  const {pulses:navAttention,pulseForTopic:pulseNavNotice}=usePageNotificationAttention({
    scope:orderReadScope && menuReadScope===orderReadScope && merchantShopGate.status==="ready" ? orderReadScope : null,
    ordersFresh:orderReadStatus.state==="fresh",
    orders,
    menuFresh:menuReadStatus.scope===menuReadScope && menuReadStatus.state==="ready",
    menuItems,
    activeTab,
  });

  const { serviceLoading } = useAppInitializer({
    user,
    role: "merchant",
    fetchOrders,
    fetchShops,
    fetchAllMenuItems,
    supabase,
    authReady: isAuthReady,
    initializeShops: false,
    operationalReady: merchantShopGate.status === "ready" && Boolean(currentShop),
  });

  // Polling is a recovery mechanism, not an alternative order authority.
  // Read only while the app is visible/online, and reconcile on focus or
  // visibility return. The coordinator coalesces overlapping triggers.
  useEffect(() => {
    if (!orderReadScope) return;
    const refreshVisibleOrders = () => {
      if (document.visibilityState === "visible" && navigator.onLine) void fetchOrders();
    };
    refreshVisibleOrders();
    const pollingInterval = setInterval(refreshVisibleOrders, 15000);
    window.addEventListener("focus", refreshVisibleOrders);
    document.addEventListener("visibilitychange", refreshVisibleOrders);
    window.addEventListener("online", refreshVisibleOrders);
    return () => {
      clearInterval(pollingInterval);
      window.removeEventListener("focus", refreshVisibleOrders);
      document.removeEventListener("visibilitychange", refreshVisibleOrders);
      window.removeEventListener("online", refreshVisibleOrders);
    };
  }, [orderReadScope,fetchOrders]);

  const deleteAllOrders = async () => {
    if (!user) return;

    confirmAction(
      "Confirm Delete All",
      "Are you sure you want to delete ALL orders? This action cannot be undone.",
      async () => {
        setConfirmDialog(p => ({...p, isOpen: false}));

        if (!isValidUUID(user.id)) {
          if (!isSupabaseMocked()) {
            console.warn("Skipping confirmDeleteAll - user ID is not a valid UUID:", user.id);
          }
          toast.info("No orders to delete.");
          return;
        }

        // First, get the shops owned by this user
        const { data: ownedShops, error: shopsError } = await supabase
          .from("shops")
          .select("id")
          .eq("owner_id", user.id);

        if (shopsError) {
          if (!isSupabaseMocked()) {
            console.warn("Notice fetching owned shops for deletion:", shopsError.message || shopsError);
          }
          return;
        }

        const ownedShopIds = ownedShops?.map((s) => s.id) || [];

        if (ownedShopIds.length === 0) {
          toast.info("No orders to delete.");
          return;
        }

        // Delete only orders belonging to these shops
        let error = null;
        try {
          await OrderService.deleteAllOrdersForShops(ownedShopIds);
        } catch (err) {
          error = err;
        }

        if (error) {
          console.error("Delete All Orders Error:", error);
          toast.error("We couldn't delete these orders right now. Please try again.");
        } else {

          fetchOrders();
        }
      }
    );
  };

  const { updateOrderStatus, requestRider, dispatchOrderToRider, convertOrderToPickup, unassignRider } = useOrderWorkflow({
    orders,
    setOrders,
    menuItems,
    setMenuItems,
    currentShop,
    supabase,
    fetchOrders,
  });

  // --- Real-Time Connection Heartbeat & Print Queue Manager ---
  const loadFailedPrints = useCallback(async () => {
    const list = await getFailedPrints();
    setFailedPrints(list);
  }, []);

  useEffect(() => {
    loadFailedPrints();
  }, [loadFailedPrints]);

  // Handle automatic database connection re-hydration upon recovery
  useEffect(() => {
    const isCurrentlyOffline = isOffline || isHeartbeatFailed;
    if (!isCurrentlyOffline && wasOffline.current) {
      toast.info("Connection detected. Verifying orders with LocalEats...", {
        description: "The order list remains unverified until a successful API refresh. Old offline edits are not replayed.",
        duration: 5000,
      });
      void fetchOrders();
    }
    wasOffline.current = isCurrentlyOffline;
  }, [isOffline, isHeartbeatFailed, fetchOrders]);

  // Active 30-second Supabase Connection Heartbeat Probe
  useEffect(() => {
    if (merchantShopGate.status !== "ready" || !currentShop || !user) return;
    if (isSupabaseMocked()) {
      setIsHeartbeatFailed(false);
      return;
    }
    
    let intervalId: NodeJS.Timeout | null = null;
    
    const runHeartbeatCheck = async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setIsHeartbeatFailed(true);
        return;
      }

      try {
        const { error } = await supabase.from("shops").select("id").limit(1);
        if (error) {
          const isFetchError =
            error.message?.includes("Failed to fetch") ||
            error.message?.includes("NetworkError") ||
            error.message?.includes("network");
          if (isFetchError) {
            setIsHeartbeatFailed(true);
          } else {
            setIsHeartbeatFailed(false);
          }
        } else {
          setIsHeartbeatFailed(false);
        }
      } catch (err: unknown) {
        const errStr = String(err);
        if (errStr.includes("Failed to fetch") || errStr.includes("NetworkError") || !navigator.onLine) {
          setIsHeartbeatFailed(true);
        } else {
          setIsHeartbeatFailed(false);
        }
      }
    };

    runHeartbeatCheck();
    intervalId = setInterval(runHeartbeatCheck, 60000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [user, merchantShopGate.status, currentShop]);

  // Recover authoritative server state only. Never replay legacy IndexedDB
  // order/menu commands directly into Firestore on reconnect or SW messages.
  useEffect(() => {
    const reconcileFromServer = () => {
      if (merchantShopGate.status !== "ready" || !currentShop) return;
      void fetchOrders();
      void fetchShops();
      void fetchAllMenuItems();
    };
    const handleOnline = () => {
      setIsOffline(false);
      setIsHeartbeatFailed(false);
      setDismissedOfflineOverlay(false);
      reconcileFromServer();
    };
    const handleOffline = () => {
      setIsOffline(true);
      setDismissedOfflineOverlay(false);
    };
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === "TRIGGER_OFFLINE_SYNC") reconcileFromServer();
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", handleSWMessage);
    }
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", handleSWMessage);
      }
    };
  }, [fetchOrders, fetchShops, fetchAllMenuItems, merchantShopGate.status, currentShop]);

  // --- ESC/POS Printing Actions ---
  const handlePrintBluetoothDirect = async (order: Order) => {
    toast.info("Running pre-flight printer diagnostic...");
    setPrintingHardwareLoading(true);
    try {
      const diag = await checkPrinterConnectivity("bluetooth");
      if (!diag.supported) {
        toast.error(`Diagnostic: ${diag.statusText}`);
        setPrintingHardwareLoading(false);
        return;
      }
      const bytes = generateReceiptBytes(order, currentShop?.name || "LocalEats Merchant", printingFormat === "58mm" ? 58 : 80);
      await printViaBluetooth(bytes);
      toast.success("Receipt printed successfully via Web Bluetooth!");
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("Direct bluetooth printing failed:", err);
      toast.error(`Web Bluetooth print failed: ${errorMsg}. Saved to offline queue.`);
      
      // Queue failed print
      await queueFailedPrint({
        id: `print-${Date.now()}-${order.id}`,
        orderId: order.id,
        customerName: order.customer_name || "Guest",
        createdAt: new Date().toISOString(),
        binaryData: Array.from(generateReceiptBytes(order, currentShop?.name || "LocalEats Merchant", printingFormat === "58mm" ? 58 : 80)),
      });
      // Trigger reload of failed queue
      void loadFailedPrints();
    } finally {
      setPrintingHardwareLoading(false);
    }
  };

  const handlePrintUSBDirect = async (order: Order) => {
    toast.info("Running pre-flight printer diagnostic...");
    setPrintingHardwareLoading(true);
    try {
      const diag = await checkPrinterConnectivity("usb");
      if (!diag.supported) {
        toast.error(`Diagnostic: ${diag.statusText}`);
        setPrintingHardwareLoading(false);
        return;
      }
      const bytes = generateReceiptBytes(order, currentShop?.name || "LocalEats Merchant", printingFormat === "58mm" ? 58 : 80);
      await printViaUSB(bytes);
      toast.success("Receipt printed successfully via Web USB!");
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("Direct USB printing failed:", err);
      toast.error(`Web USB print failed: ${errorMsg}. Saved to offline queue.`);
      
      // Queue failed print
      await queueFailedPrint({
        id: `print-${Date.now()}-${order.id}`,
        orderId: order.id,
        customerName: order.customer_name || "Guest",
        createdAt: new Date().toISOString(),
        binaryData: Array.from(generateReceiptBytes(order, currentShop?.name || "LocalEats Merchant", printingFormat === "58mm" ? 58 : 80)),
      });
      // Trigger reload of failed queue
      void loadFailedPrints();
    } finally {
      setPrintingHardwareLoading(false);
    }
  };

  const retryQueuedPrintDirect = async (job: QueuedPrintJob) => {
    toast.info("Receipt Printing Requested");
    setPrintingHardwareLoading(true);
    try {
      const bytes = new Uint8Array(job.binaryData);
      // Attempt Web Bluetooth or Web USB fallback
      if (navigator.bluetooth) {
        toast.info("Attempting print retry over Bluetooth...");
        await printViaBluetooth(bytes);
      } else {
        toast.info("Attempting print retry over USB...");
        await printViaUSB(bytes);
      }
      toast.success("Retry Print Succeeded! Removing job from queue.");
      await deleteFailedPrint(job.id);
      void loadFailedPrints();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("Failed to retry print job:", err);
      toast.error(`Print retry failed: ${errorMsg}. Retaining in queue.`);
    } finally {
      setPrintingHardwareLoading(false);
    }
  };

  const clearPrintQueue = async () => {
    try {
      for (const job of failedPrints) {
        await deleteFailedPrint(job.id);
      }
      toast.info("Offline failed print queue cleared completely.");
      void loadFailedPrints();
    } catch (err) {
      console.error("Clear queue error:", err);
    }
  };

  // Never auto-accept from browser memory, including after a stale reconnect.
  // Future auto-accept requires a separately approved server-authoritative policy.


  const handleSignOut = async () => {
    setOrders([]);
    await supabase.auth.signOut();
  };

  if (isSessionChecking || loading || !isAuthReady) {
    return (
      <div className="min-h-screen bg-surface p-6 font-body flex flex-col xl:flex-row gap-6 animate-in fade-in duration-350">
        <div className="hidden xl:flex flex-col w-72 h-[calc(100vh-3rem)] rounded-[2.5rem] bg-surface-container-lowest border border-outline-variant/10 p-6 space-y-8">
          <Skeleton className="h-10 w-3/4 rounded-xl" />
          <div className="space-y-4 pt-4">
            <Skeleton className="h-12 w-full rounded-2xl" />
            <Skeleton className="h-12 w-full rounded-2xl" />
            <Skeleton className="h-12 w-full rounded-2xl" />
            <Skeleton className="h-12 w-full rounded-2xl" />
          </div>
        </div>
        <div className="flex-1 rounded-[2.5rem] flex flex-col space-y-12">
          <div className="space-y-6 pt-6 xl:pt-0">
            <div className="flex justify-between items-start">
               <div className="space-y-3">
                 <Skeleton className="h-12 w-64 md:w-80 rounded-2xl" />
                 <Skeleton className="h-4 w-48 rounded-lg" />
               </div>
               <Skeleton className="h-12 w-12 rounded-full" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <Skeleton className="h-40 rounded-[2rem]" />
               <Skeleton className="h-40 rounded-[2rem]" />
               <Skeleton className="h-40 rounded-[2rem]" />
            </div>
            <Skeleton className="h-[400px] rounded-[2.5rem]" />
          </div>
        </div>
      </div>
    );
  }

  const handleSaveProfile = async (data: ProfileData) => {
    if (import.meta.env.VITE_MERCHANT_PREVIEW_READ_ONLY === "true") {
      toast.info("Preview is read-only. No account details were saved.");
      return;
    }
    setIsSaving(true);
    setIsSaveSuccess(false);
    try {
      const { data: updateRes, error } = await supabase.auth.updateUser({
        data: {
          full_name: data.fullName,
          phone: data.phone,
          marketing_preferences: data.marketing,
          dark_mode: data.darkMode,
          avatar_url: data.avatarUrl,
        },
      });

      if (error) throw error;
      if (updateRes?.user) {
        setUser(updateRes.user);
      }

      if (data.darkMode !== undefined) {
        setDarkMode(data.darkMode);
      }

      // Show success state
      setIsSaving(false);
      setIsSaveSuccess(true);

      // Close after delay
      setTimeout(() => {
        setIsSaveSuccess(false);
        setIsEditingProfile(false);
      }, 1200);
    } catch (err: unknown) {
      console.error("Save profile error:", err);
      setIsSaving(false);
      setIsSaveSuccess(false);
      toast.error(
        err instanceof Error ? err.message : "Failed to update profile settings.",
      );
    }
  };

  if (isSessionChecking && !user) {
    console.log("[Render] loading-screen (session checking)", { isSessionChecking, isAuthReady, loading, userId: user?.id });
    return (
      <FirebaseInitializingOverlay 
        message="Validating secure merchant session..." 
        subtext="Connecting to Firebase Cloud Infrastructure & Realtime Relay" 
      />
    );
  }

  if (isVerifying) {
    console.log("[Render] verification-pending", { isSessionChecking, isAuthReady, loading, userId: user?.id });
    return (
      <VerificationPending
        email={signupEmail}
        onBack={() => setIsVerifying(false)}
        onVerified={() => {
          setIsVerifying(false);
          setIsEditingProfile(true);
        }}
        onSupport={() => {
          window.location.href = "mailto:support@localeats.com";
        }}
      />
    );
  }

  if (user && merchantShopGate.status === "checking") {
    return (
      <FirebaseInitializingOverlay
        message="Verifying your merchant shop..."
        subtext="Please wait while we securely confirm your storefront."
      />
    );
  }

  if (user && merchantShopGate.status === "no-shop") {
    return (
      <CreateShopOnboarding
        onCreated={handleCreatedMerchantShop}
        onSignOut={handleSignOut}
      />
    );
  }

  if (user && merchantShopGate.status === "approval-required") {
    return (
      <PendingShopApproval
        shop={merchantShopGate.shop}
        onRefresh={refreshAuthoritativeMerchantShop}
        onSignOut={handleSignOut}
      />
    );
  }

  if (user && merchantShopGate.status === "error") {
    return (
      <div className="min-h-screen bg-surface px-4 py-10 text-on-surface">
        <div className="mx-auto flex min-h-[80vh] max-w-xl items-center justify-center">
          <section className="w-full rounded-[2rem] border border-error/15 bg-surface-container-lowest p-8 text-center shadow-xl">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-error/10 text-error">
              <AlertTriangle size={30} />
            </div>
            <h1 className="font-headline text-2xl font-black">We couldn't verify your merchant shop.</h1>
            <p className="mt-3 text-sm font-medium leading-6 text-on-surface-variant">{merchantShopGate.message}</p>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => void refreshAuthoritativeMerchantShop()} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black text-on-primary">
                <RefreshCw size={18} /> Retry
              </button>
              <button type="button" onClick={() => void handleSignOut()} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-outline-variant/30 px-5 py-3 text-sm font-black text-on-surface-variant hover:bg-surface-container">
                <LogOut size={18} /> Sign Out
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (isEditingProfile) {
    console.log("[Render] editing-profile", { isSessionChecking, isAuthReady, loading, userId: user?.id });
    return (
      <>
        <EditProfile
          onBack={() => setIsEditingProfile(false)}
          onSave={handleSaveProfile}
          userId={user?.id || ""}
          isSaving={isSaving}
          isSuccess={isSaveSuccess}
          initialData={{
            fullName: user?.user_metadata?.full_name || "",
            email: user?.email || signupEmail,
            phone: user?.user_metadata?.phone || "",
            avatarUrl: user?.user_metadata?.avatar_url || "",
            marketing: user?.user_metadata?.marketing_preferences ?? true,
            darkMode: user?.user_metadata?.dark_mode ?? darkMode,
          }}
        />
        <SavingOverlay isSaving={isSaving} isSuccess={isSaveSuccess} />
      </>
    );
  }

  if (!user) {
    console.log("[Render] sign-in/sign-up", { authView, isSessionChecking, isAuthReady, loading, userId: user?.id });
    return authView === "signin" ? (
      <SignIn
        onSignUpClick={() => setAuthView("signup")}
        onSuccess={(signedUser) => {
          if (signedUser) {
            setUser(signedUser);
            localStorage.setItem("localeats_user_session", JSON.stringify(signedUser));
          }
        }}
      />
    ) : (
      <SignUp
        onSignInClick={() => setAuthView("signin")}
        onSuccess={(signedUser) => {
          if (signedUser) {
            setUser(signedUser);
            localStorage.setItem("localeats_user_session", JSON.stringify(signedUser));
            setIsEditingProfile(true);
          }
        }}
      />
    );
  }

  console.log("[Render] authenticated-dashboard", { isSessionChecking, isAuthReady, loading, userId: user?.id, shopId: currentShop?.id });

  const pendingOrdersCount = orders.filter(
    (o) => o.status === "pending",
  ).length;
  const lowStockMenuCount = menuReadScope && menuReadStatus.scope===menuReadScope && menuReadStatus.state==="ready"
    ? menuItems.filter(item=>typeof item.stock_quantity==="number" && item.stock_quantity<5).length : 0;

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "menu", label: "Menu", icon: UtensilsCrossed, badge: lowStockMenuCount>0 ? lowStockMenuCount : null },
    {
      id: "orders",
      label: "Orders",
      icon: ReceiptText,
      badge: pendingOrdersCount > 0 ? pendingOrdersCount : null,
    },
    { id: "riders", label: "Riders", icon: Bike },
    { id: "marketing", label: "Marketing", icon: Megaphone },
    { id: "payments", label: "Payments", icon: CreditCard },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <div
      className={cn(
        "min-h-screen bg-surface selection:bg-primary-fixed selection:text-on-primary-fixed transition-colors duration-300",
        darkMode && "dark",
      )}
    >
      {/* 1. Autoplay Audio & Wake whitelisting entry lock screen */}
      {!isAudioEnabled && (
        <div className="fixed inset-0 bg-zinc-950/95 backdrop-blur-md z-[10000] flex flex-col items-center justify-center p-4 select-none">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 max-w-md w-full shadow-2xl text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center text-[#FF5A36]">
              <Volume2 size={32} className="stroke-[2.5px] animate-bounce" />
            </div>
            <div className="space-y-2">
              <h2 className="font-headline font-black text-2xl text-zinc-900 dark:text-zinc-50 tracking-tight">
                LocalEatsSA Kitchen Dashboard
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Authorize high-reliability kitchen alarms, prevent screen auto-locking, and register ESC/POS direct thermal print handshakes.
              </p>
            </div>
            
            <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-900 text-left space-y-3">
              <div className="flex gap-3 text-xs">
                <span className="text-[#FF5A36] font-bold">●</span>
                <p className="text-zinc-600 dark:text-zinc-300">
                  <strong>Acoustic Siren Alerter:</strong> Plays a high-volume, dual-tone alarm pattern that halts only on manual resolution of `PENDING` orders.
                </p>
              </div>
              <div className="flex gap-3 text-xs">
                <span className="text-[#FF5A36] font-bold">●</span>
                <p className="text-zinc-600 dark:text-zinc-300">
                  <strong>Screen Wake :</strong> Safeguards continuous screen illumination during busy, high-noise kitchen shifts.
                </p>
              </div>
              <div className="flex gap-3 text-xs">
                <span className="text-[#FF5A36] font-bold">●</span>
                <p className="text-zinc-600 dark:text-zinc-300">
                  <strong>Direct s Interface:</strong> Streams byte-aligned ESC/POS receipts directly over Web Bluetooth and Web USB with IndexedDB queueing.
                </p>
              </div>
            </div>

            <button
              onClick={enableAudio}
              className="w-full py-4 bg-[#FF5A36] hover:bg-[#e04f2f] text-white font-bold rounded-2xl tracking-wider uppercase text-xs shadow-xl shadow-orange-500/10 transition-all duration-200 cursor-pointer active:scale-95"
            >
              Go Online & Initialize Dashboard
            </button>
          </div>
        </div>
      )}

      {/* 2. Real-Time Connection Lost / Database Uplink Overlay */}
      {(!dismissedOfflineOverlay && (isOffline || (isHeartbeatFailed && !currentShop && shops.length === 0 && orders.length === 0))) && (
        <div className="fixed inset-0 bg-zinc-950/95 backdrop-blur-md z-[9999] flex flex-col items-center justify-center p-4 select-none">
          <div className="bg-white dark:bg-zinc-900 border border-amber-500/30 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500">
              <WifiOff size={32} className="stroke-[2.5px] animate-pulse" />
            </div>
            <div className="space-y-2">
              <h2 className="font-headline font-black text-xl text-zinc-900 dark:text-zinc-50 tracking-tight">
                {isOffline ? "No Internet Connection" : "Database Server Unreachable"}
              </h2>
              <p className="text-xs text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider animate-pulse">
                {isOffline ? "Device network connection lost" : "Internet is connected • Cloud database probe slow"}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed pt-1">
                {isOffline
                  ? "Your device is not connected to Wi-Fi or mobile data. We are actively attempting to reconnect."
                  : "Your Wi-Fi or mobile data is active, but the cloud backend is currently taking longer than expected to respond."}
              </p>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 text-left space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500 font-bold">Network Link:</span>
                <span className={`font-mono font-black text-[10px] ${isOffline ? "text-red-500" : "text-emerald-500"}`}>
                  {isOffline ? "OFFLINE" : "CONNECTED"}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500 font-bold">Cloud Database:</span>
                <span className="font-mono text-amber-500 font-bold uppercase text-[10px] animate-pulse">
                  RETRYING PROBE...
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500 font-bold">Local Data:</span>
                <span className="font-mono text-emerald-500 font-bold uppercase text-[10px]">NOT SAVED</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  toast.info("Retrying connection probe...");
                  setIsHeartbeatFailed(false);
                  void fetchOrders();
                }}
                className="w-full py-3 px-4 bg-[#FF5A36] hover:bg-[#e04f2f] text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md tracking-wide uppercase"
              >
                Retry Connection
              </button>
              <button
                type="button"
                onClick={() => {
                  setDismissedOfflineOverlay(true);
                  toast.info("Offline view only. Orders and changes require server confirmation.");
                }}
                className="w-full py-2.5 px-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold text-xs rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all cursor-pointer"
              >
                Continue in Read-only View
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(p => ({...p, isOpen: false}))}
      />
        {/* Existing Toaster */}
        <Toaster
          position="top-center"
          richColors
          theme={darkMode ? "dark" : "light"}
          closeButton
          expand={true}
        />
        <SavingOverlay isSaving={isSaving} isSuccess={isSaveSuccess} />
        <InstallAppInvite
          eligible={Boolean(user?.id && currentShop?.id && merchantShopGate.status === "ready" &&
            !isSessionChecking && isAuthReady && isAudioEnabled &&
            !onboardingOpen && !isNotificationCenterOpen && !isSaving)}
          appName="LocalEats Merchant"
          storageKey="localeats_merchant_install_defer_v1"
          variant="merchant"
        />

        <NotificationCenterSidePanel isOpen={isNotificationCenterOpen} onClose={() => setIsNotificationCenterOpen(false)}
          orders={orders} menuItems={menuItems}
          ordersVerified={merchantShopGate.status === "ready"
            && orderReadStatus.state === "fresh"
            && orderReadScope === `${user?.id}:${currentShop?.id}`}
          menuVerified={merchantShopGate.status === "ready"
            && menuReadStatus.state === "ready"
            && menuReadScope === `${user?.id}:${currentShop?.id}`}
          onPreviewTestNotice={isMerchantPreviewSimulatorEnabled()
            ? (topic)=>{setIsNotificationCenterOpen(false);pulseNavNotice(topic);}
            : undefined}
        />        <OnboardingTour
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isOpen={onboardingOpen}
          onComplete={() => {
            setOnboardingOpen(false);
            localStorage.setItem("localeats_onboard_v1", "true");
            toast.success("🎉 Guided onboarding completed! You are fully configured.");
          }}
        />

        {/* Offline Info Modal */}
        <AnimatePresence>
          {showOfflineInfoModal && (
            <div role="dialog" aria-modal="true" className="fixed inset-0 z-[160] flex items-center justify-center p-4">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowOfflineInfoModal(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
              />

              {/* Modal Box */}
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 15 }}
                className="relative bg-white dark:bg-zinc-900 border border-outline-variant/15 rounded-3xl p-6 shadow-2xl max-w-md w-full pointer-events-auto text-on-surface"
              >
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500">
                    <WifiOff size={24} />
                  </div>
                  <div>
                    <div className="text-[10px] font-mono font-black text-amber-500 uppercase tracking-widest flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                      Connection Unavailable
                    </div>
                    <h3 className="font-headline font-black text-lg text-on-surface tracking-tight mt-0.5">
                      Safe Connection Recovery
                    </h3>
                  </div>
                </div>

                {/* Subtitle */}
                <p className="text-xs text-on-surface-variant/80 leading-relaxed mb-5">
                  Your device cannot reach the ordering service. You can review this screen, but business changes need online server confirmation.
                </p>

                {/* Status Grid */}
                <div className="space-y-3 mb-6">
                  {/* Status Item 1 */}
                  <div className="flex gap-3 p-3 rounded-2xl bg-on-surface/[0.02] border border-outline-variant/5">
                    <div className="text-emerald-500 shrink-0 mt-0.5">
                      <Circle size={15} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black tracking-tight text-on-surface">No Offline Order Writes</h4>
                      <p className="text-[10px] text-on-surface-variant/75 mt-0.5">
                        Orders and menu changes are never considered saved without a successful server response.
                      </p>
                    </div>
                  </div>

                  {/* Status Item 2 */}
                  <div className="flex gap-3 p-3 rounded-2xl bg-on-surface/[0.02] border border-outline-variant/5">
                    <div className="text-emerald-500 shrink-0 mt-0.5">
                      <Circle size={15} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black tracking-tight text-on-surface">Fresh Server Confirmation</h4>
                      <p className="text-[10px] text-on-surface-variant/75 mt-0.5">
                        Reconnect and refresh to verify current orders, menu changes and shop status. Offline actions are not automatically submitted.
                      </p>
                    </div>
                  </div>

                  {/* Status Item 3 */}
                  <div className="flex gap-3 p-3 rounded-2xl bg-on-surface/[0.02] border border-outline-variant/5">
                    <div className="text-primary shrink-0 mt-0.5 animate-pulse">
                      <Activity size={15} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black tracking-tight text-on-surface">Verified Data on Reconnect</h4>
                      <p className="text-[10px] text-on-surface-variant/75 mt-0.5">
                        The latest order and payment status must come from an authenticated server read after reconnecting.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2.5">
                  <button
                    onClick={handleTestConnection}
                    disabled={testingConnection}
                    className="w-full py-3.5 bg-primary text-on-primary font-black rounded-xl text-xs uppercase tracking-widest hover:bg-opacity-90 active:scale-98 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-primary/10"
                  >
                    {testingConnection ? (
                      <>
                        <Loader2 className="animate-spin" size={14} />
                        Testing Connection...
                      </>
                    ) : (
                      "Perform Connection Diagnosis"
                    )}
                  </button>

                  <button
                    onClick={() => setShowOfflineInfoModal(false)}
                    className="w-full py-3 bg-on-surface/5 text-on-surface-variant hover:text-on-surface hover:bg-on-surface/10 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Dismiss Information
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Auto-Accept Orders Confirm Modal */}
        <ConfirmModal
          isOpen={showAutoAcceptModal}
          title="Enable Automated Auto-Accept?"
          message="Enabling Auto-Accept will cause all incoming orders to instantly bypass manual review and move directly into your Preparing queue. Customer notes will not be shown before accepting, and you will not have the chance to adjust delivery estimated times. Please ensure you are ready to fulfill all incoming orders."
          confirmText="Yes, Enable Auto-Accept"
          cancelText="Cancel"
          onConfirm={() => {
            setAutoAcceptOrders(false);
            setShowAutoAcceptModal(false);
            toast.info("Auto-Accept is unavailable until server-authorized acceptance is approved.");
          }}
          onCancel={() => setShowAutoAcceptModal(false)}
          isDestructive={false}
        />

        {/* TopAppBar */}
        {!kitchenMode && (
          <header className="fixed top-0 w-full z-50 bg-white/70 dark:bg-surface-container-lowest/70 backdrop-blur-xl shadow-sm shadow-orange-900/5">
          <div className="flex justify-between items-center px-4 md:px-6 h-16 max-w-7xl mx-auto">
            <div className="flex items-center gap-2 md:gap-3 shrink-0">
              <button
                onClick={() => setActiveTab("dashboard")}
                className="focus:outline-none cursor-pointer hover:opacity-85 active:scale-95 transition-all duration-200 flex items-center"
                title="Go to Dashboard"
              >
                <LocalEatsLogo width={160} height={42} />
              </button>

            </div>



            {/* Scrollable Tab Container with Arrow Buttons */}
            <div className="hidden md:flex items-center flex-1 min-w-0 relative mx-2 group">
              {/* Left Arrow Button */}
              <button
                type="button"
                onClick={() => topNavScrollRef.current?.scrollBy({ left: -160, behavior: reduceMotion ? 'auto' : 'smooth' })}
                aria-label="Scroll navigation left"
                className="absolute left-0 z-10 w-11 h-11 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-primary dark:hover:text-primary hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all cursor-pointer opacity-30 group-hover:opacity-100 active:scale-90"
                title="Scroll Tabs Left"
              >
                <ChevronLeft size={14} className="stroke-[2.5px]" />
              </button>

              <nav
                aria-label="Main dashboard navigation"
                ref={topNavScrollRef}
                className="flex-1 flex items-center justify-start gap-2 overflow-x-auto hide-scrollbar px-12 whitespace-nowrap scroll-smooth"
              >
                {navItems.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <motion.button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      aria-label={item.label}
                      aria-current={isActive ? "page" : undefined}
                      whileHover={reduceMotion ? undefined : { scale: 1.015 }}
                       whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                      className={cn(
                        "min-h-11 px-4 py-2.5 rounded-2xl transition-all font-bold text-xs flex items-center gap-2 relative shrink-0 overflow-hidden cursor-pointer",
                        isActive
                          ? "text-primary font-black shadow-xs"
                          : "text-on-surface/60 hover:text-on-surface hover:bg-surface-container-low/50 dark:hover:bg-surface-container-high/50",
                      )}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activeTabBackgroundMain"
                          className="absolute inset-0 bg-primary/10 dark:bg-primary/20 rounded-2xl -z-10"
                          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 30 }}
                        />
                      )}
                      <span key={`desktop-${item.id}-${navAttention[item.id as keyof typeof navAttention]??0}`}
                        className={cn("inline-flex shrink-0",navAttention[item.id as keyof typeof navAttention]&&"localeats-nav-notice-wiggle")}>
                        <item.icon size={15} className={cn(isActive ? "stroke-[2.5px]" : "stroke-[1.8px]")} />
                      </span>
                      {item.label}
                      {item.badge && (
                        <span className="relative flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-white animate-pulse shrink-0 ml-0.5 font-bold">
                          {item.badge}
                        </span>
                      )}
                    </motion.button>
                  );
                })}
              </nav>

              {/* Right Arrow Button */}
              <button
                type="button"
                onClick={() => topNavScrollRef.current?.scrollBy({ left: 160, behavior: reduceMotion ? 'auto' : 'smooth' })}
                aria-label="Scroll navigation right"
                className="absolute right-0 z-10 w-11 h-11 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-primary dark:hover:text-primary hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all cursor-pointer opacity-30 group-hover:opacity-100 active:scale-90"
                title="Scroll Tabs Right"
              >
                <ChevronRight size={14} className="stroke-[2.5px]" />
              </button>
            </div>

            <div className="flex items-center gap-1 md:gap-4 shrink-0">
              <ConnectivityMonitor
                supabase={supabase}
                onOpenDiagnostics={() => setIsDiagnosticOpen(true)}
              />
              {currentShop && (
                <button
                  onClick={async () => {
                    if (!currentShop) return;
                    const newStatus = !currentShop.is_active;

                    const { success, error, freshShop } = await syncShopAvailability({
                      shopId: currentShop.id,
                      isOpen: newStatus,
                      supabase,
                      updateFirestoreShop,
                      getFirestoreShopById,
                    });

                    if (success) {
                      toast.success(
                        `Shop is now ${newStatus ? "Open & Live" : "Closed & Offline"}`,
                      );
                      // Force a re-fetch of the current state immediately after success
                      try {
                        const verifiedShop = freshShop;
                        if (verifiedShop) {
                           setShops((prev) => prev.map((s) => s.id === currentShop.id ? { ...s, ...verifiedShop, is_active: verifiedShop.is_active } : s));
                        }
                        await fetchShops();
                      } catch(e) {
                        console.error("Failed to re-fetch after toggling:", e);
                      }
                    } else {
                      // Rollback on error
                      toast.error(typeof error === "string" ? error : "Failed to update shop status");
                    }
                  }}
                  className={cn(
                    "hidden sm:flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs font-bold transition-all border",
                    currentShop.is_active
? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800"
                      : "bg-error/10 text-error border-error/20 hover:bg-error/20 shadow-lg shadow-error/10",
                    localStorage.getItem(`localeats_holiday_mode_${currentShop.id}`) === "true" && "animate-pulse ring-2 ring-error/50 ring-offset-2 ring-offset-surface"
                  )}
                >
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full",
                      currentShop.is_active
? "bg-emerald-500 animate-pulse"
                        : "bg-error",
                    )}
                  />
                  <span className="hidden xs:inline">
                    {currentShop.is_active ? "Open" : "Closed"}
                  </span>
                  <span className="hidden sm:inline ml-1 opacity-70">
                    {currentShop.is_active ? pickupOrderingEnabled() ? "• Shop available · Pickup pilot" : "• Shop available · Pickup checkout disabled" : "• Shop unavailable"}
                  </span>
                </button>
              )}

              <button
                onClick={() => {
                  setSoundAlerts(!soundAlerts);
                  if (!soundAlerts) playNotificationSound();
                }}
                className={cn(
                  "le-press-feedback min-w-11 min-h-11 p-2 rounded-full flex items-center justify-center transition-colors relative group",
                  soundAlerts ? "text-primary" : "text-on-surface-variant/40",
                )}
                title={
                  soundAlerts ? "Mute Order Alerts" : "Unmute Order Alerts"
                }
              >
                {soundAlerts ? (
                  <Bell size={18} className="md:w-5 md:h-5" />
                ) : (
                  <BellOff size={18} className="md:w-5 md:h-5" />
                )}
              </button>

              <button
                onClick={() => setDarkMode(!darkMode)}
                className="le-press-feedback min-w-11 min-h-11 p-2 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors"
                title={
                  darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"
                }
              >
                {darkMode ? (
                  <Sun size={18} className="md:w-5 md:h-5" />
                ) : (
                  <Moon size={18} className="md:w-5 md:h-5" />
                )}
              </button>
              <button onClick={() => setActiveTab("settings")} className="le-press-feedback w-11 h-11 rounded-full flex items-center justify-center overflow-hidden border-2 border-primary/10 shadow-sm cursor-pointer hover:border-primary/30 transition-all focus:outline-none focus:ring-2 focus:ring-primary/50" title="Profile Settings">
                {user?.user_metadata?.avatar_url ? (
                  <img
                    alt="Profile"
                    className="w-full h-full object-cover"
                    src={user.user_metadata.avatar_url}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center bg-primary"
                    style={{
                      background:
                        "radial-gradient(circle at 30% 30%, #ff9d4d 0%, #f58220 100%)",
                    }}
                  >
                    <UserIcon
                      size={20}
                      className="text-white drop-shadow-sm"
                      strokeWidth={2.5}
                    />
                  </div>
                )}
              </button>
            </div>
          </div>
        </header>
      )}

      {currentShop && !currentShop.is_active && !kitchenMode && (
        <div className="fixed top-16 left-0 w-full bg-error/95 backdrop-blur-md text-white py-2 px-4 z-40 flex flex-wrap items-center justify-center gap-3 shadow-md border-b border-error shadow-error/20">
           <div className="flex items-center gap-2 font-black uppercase tracking-widest text-[10px] md:text-xs">
             <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-white animate-pulse" />
             Store Offline - Not Receiving Orders
           </div>
           <button
             onClick={async () => {
                const newStatus = true;

                const { success, error, freshShop } = await syncShopAvailability({
                  shopId: currentShop.id,
                  isOpen: newStatus,
                  supabase,
                  updateFirestoreShop,
                  getFirestoreShopById,
                });
                if (success) {
                  toast.success("Shop is now Open and accepting customer orders!");
                  // Force a re-fetch of the current state immediately after success
                  try {
                    const verifiedShop = freshShop;
                    if (verifiedShop) {
                       setShops((prev) => prev.map((s) => s.id === currentShop.id ? { ...s, ...verifiedShop, is_active: verifiedShop.is_active } : s));
                    }
                    await fetchShops();
                  } catch(e) {
                    console.error("Failed to re-fetch after toggling:", e);
                  }
                } else {

                  toast.error(typeof error === "string" ? error : "Failed to go online");
                }
             }}
             className="px-4 py-1 bg-white text-error rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-zinc-100 transition-colors ml-2 shadow-xs cursor-pointer active:scale-95 border border-white"
           >
             Go Online Now
           </button>
        </div>
      )}

      <main
        className={cn(
          "px-4 md:px-6 max-w-7xl mx-auto",
          kitchenMode ? "pt-6 pb-6" : (currentShop && !currentShop.is_active) ? "pt-28 md:pt-32 pb-32" : "pt-20 md:pt-24 pb-32",
        )}
      >
        <div className="w-full">
            <React.Suspense fallback={<DashboardSkeleton />}>
              {activeTab === "dashboard" && (
                <DashboardOverview
                  orders={orders}
                  orderReadState={orderReadStatus.state}
                  loading={loading}
                  shops={shops}
                  user={user}
                  onNavigate={setActiveTab}
                  onRefresh={async () => {
                    await fetchShops();
                    await Promise.all([fetchOrders(), fetchAllMenuItems()]);
                  }}
                  onEditProfile={() => setIsEditingProfile(true)}
                  menuItems={menuItems}
                  menuReadState={menuReadStatus.scope===menuReadScope ? menuReadStatus.state : "loading"}
                  trialInfo={trialInfo}
                  currentShop={currentShop}
                  darkMode={darkMode}
                />
              )}
              {activeTab === "menu" && (
                <MenuManagement
                  shops={shops}
                  loading={loading}
                  user={user}
                  onRefreshMenu={() => {
                    fetchAllMenuItems();
                    fetchShops();
                  }}
                  setIsSaving={setIsSaving}
                  setIsSaveSuccess={setIsSaveSuccess}
                  isSaving={isSaving}
                  dataSaverMode={dataSaverMode}
                />
              )}
              {activeTab === "orders" && (
                <>
                  {orderReadStatus.state === "failed" && (
                    <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
                      <span>Order list could not be verified. It may be out of date; do not assume there are no new orders. {orderReadStatus.lastSuccessAt ? `Last confirmed sync: ${new Date(orderReadStatus.lastSuccessAt).toLocaleTimeString()}.` : "No confirmed order sync yet."}</span>
                      <button type="button" className="rounded-lg border border-current px-3 py-2 font-bold" onClick={() => void fetchOrders()}>Retry order sync</button>
                    </div>
                  )}
                <OrdersManagement
                  orders={orders}
                  onUpdateStatus={updateOrderStatus}
                  onDispatchToRider={dispatchOrderToRider}
                  onConvertOrderToPickup={convertOrderToPickup}
                  onDeleteAllOrders={deleteAllOrders}
                  loading={loading}
                  onRefresh={fetchOrders}
                  kitchenMode={kitchenMode}
                  setKitchenMode={setKitchenMode}
                  soundAlerts={soundAlerts}
                  setSoundAlerts={setSoundAlerts}
                  onRequestRider={requestRider}
                  onUnassignRider={unassignRider}
                  onTabChange={setActiveTab}
                  currentShop={currentShop}
                  printingFormat={printingFormat}
                  setPrintingFormat={setPrintingFormat}
                  failedPrints={failedPrints}
                  printingHardwareLoading={printingHardwareLoading}
                  handlePrintBluetoothDirect={handlePrintBluetoothDirect}
                  handlePrintUSBDirect={handlePrintUSBDirect}
                  retryQueuedPrintDirect={retryQueuedPrintDirect}
                  clearPrintQueue={clearPrintQueue}
                />
                </>
              )}
              {activeTab === "marketing" && (
                <Marketing
                  currentShop={currentShop}
                  setShops={setShops}
                  shops={shops}
                  menuItems={menuItems}
                  orders={orders}
                  user={user}
                  onNavigateTab={setActiveTab}
                />
              )}
              {activeTab === "coupons" && (
                <Coupons currentShop={currentShop} orders={orders} />
              )}
              {activeTab === "insights" && (
                <Insights
                  orders={orders}
                  menuItems={menuItems}
                  loading={loading}
                  currentShop={currentShop}
                />
              )}
              {activeTab === "riders" && (
                <section aria-labelledby="riders-coming-soon-title" className="min-h-[60vh] flex items-center justify-center px-4">
                  <div className="w-full max-w-lg rounded-3xl border border-outline-variant/20 bg-surface-container-low p-8 md:p-12 text-center shadow-sm">
                    <div aria-hidden="true" className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Bike size={30} />
                    </div>
                    <p className="mb-2 text-xs font-black uppercase tracking-widest text-primary">Riders</p>
                    <h1 id="riders-coming-soon-title" className="font-headline text-3xl font-black text-on-surface">Coming Soon</h1>
                    <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
                      Rider management is not available yet. Pairing, dispatch, and deliveries are disabled.
                    </p>
                  </div>
                </section>
              )}
              {activeTab === "payments" && (
                currentShop ? (
                  <PaymentHistory
                    shopId={currentShop.id}
                    currentShop={currentShop}
                    shopVerified={merchantShopGate.status==="ready"
                      && !!user?.id
                      && currentShop.owner_id===user.id}
                    orders={orders}
                    ordersVerified={merchantShopGate.status==="ready"
                      && orderReadStatus.state==="fresh"
                      && orderReadScope===`${user?.id}:${currentShop.id}`}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                    <p className="text-on-surface-variant font-medium">Create a shop first to view payments.</p>
                    <button onClick={() => setActiveTab("storefront")} className="px-4 py-2 bg-primary text-white rounded-xl font-bold">Go to Storefront</button>
                  </div>
                )
              )}
            </React.Suspense>

            {activeTab === "settings" && (
              <div className="max-w-5xl mx-auto space-y-6 md:space-y-8">
                <header className="space-y-1 px-4 md:px-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl md:text-3xl font-headline font-bold text-on-surface tracking-tight">
                      Settings
                    </h2>
                  </div>
                  <p className="text-sm text-on-surface-variant font-medium">
                    Manage your account and storefront preferences.
                  </p>
                </header>

                <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start px-4 md:px-0">
                  {/* Sidebar */}
                  <nav aria-label="Merchant settings sections" className="w-full md:w-60 shrink-0 flex md:flex-col gap-2 overflow-x-auto pb-4 md:pb-0 hide-scrollbar border-b md:border-b-0 border-outline-variant/10 md:pr-4">
                     {[
                       { id: "storefront", label: "My Shop", icon: Store, iconTone: "bg-primary/10 text-primary" },
                       { id: "operations", label: "Opening Hours", icon: CalendarClock, iconTone: "bg-sky-500/10 text-sky-700 dark:text-sky-300" },
                       { id: "preferences", label: "Notifications & Appearance", icon: BellRing, iconTone: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
                       { id: "account", label: "My Account", icon: UserRound, iconTone: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" },
                     ].map(category => {
                       const selected = settingsCategory === category.id;
                       return (
                       <button
                         key={category.id}
                         type="button"
                         aria-current={selected ? "page" : undefined}
                         aria-pressed={selected}
                         onClick={() => setSettingsCategory(category.id)}
                         className={cn(
                           "le-press-feedback group flex items-center gap-3 min-h-14 px-3 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                           selected
                             ? "bg-primary text-on-primary shadow-sm"
                             : "text-on-surface-variant hover:bg-surface-container-high"
                         )}
                       >
                         <span aria-hidden="true" className={cn(
                           "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                           selected ? "bg-white/20 text-on-primary" : category.iconTone
                         )}>
                           <category.icon size={21} strokeWidth={2.2} aria-hidden="true"/>
                         </span>
                         <span className={cn("flex-1", selected ? "text-on-primary" : "text-on-surface")}>{category.label}</span>
                       </button>
                       );
                     })}
                  </nav>

                  {/* Settings Content Panels */}
                  <div className="flex-1 w-full space-y-4 max-w-3xl pb-16">
                    {settingsCategory === "diagnostics" && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <h3 className="font-headline font-bold text-lg mb-2">Firestore Diagnostics</h3>
                        <ShopDiagnosticPanel currentShop={currentShop} />
                      </div>
                    )}
                    
                    {settingsCategory === "storefront" && (
                      <div className="space-y-4 le-panel-enter">
                        <h3 className="font-headline font-bold text-lg mb-2">My Shop</h3>
                        
                        {/* The full location diagnostic and location editor are retained
                            on Storefront Profile, not duplicated in owner Settings. */}
                        <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low px-4 py-4 space-y-2 text-left">
                          <p className="text-xs font-semibold text-on-surface-variant">Your shop</p>
                          {merchantShopGate.status==="ready" && !!user?.id && currentShop?.owner_id===user.id ? (
                            <>
                              <p className="text-base font-bold text-on-surface break-words">{currentShop?.name || "Shop"}</p>
                              <p className="flex items-start gap-2 text-xs text-on-surface-variant">
                                <MapPin size={14} className="shrink-0 mt-0.5" aria-hidden="true"/>
                                <span className="break-words">{currentShop?.address || currentShop?.location || currentShop?.city || "Shop location not yet provided"}</span>
                              </p>
                            </>
                          ) : (
                            <p role="status" className="text-xs text-on-surface-variant">Shop information is being verified.</p>
                          )}
                        </div>

                        <button
                          onClick={() => setActiveTab("storefront")}
                    className="le-press-feedback w-full flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-0 p-5 bg-primary/5 hover:bg-primary/10 rounded-2xl transition-all border border-primary/20 group shadow-sm shadow-primary/5"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform shrink-0">
                        <Store size={20} />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-on-surface">
                          Storefront Profile
                        </p>
                        <p className="text-xs text-on-surface-variant line-clamp-1 md:line-clamp-none">
                          Change your shop name, photos and address in Storefront Profile.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end md:self-auto">
                      <span className="text-[10px] items-center font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                        Edit profile
                      </span>
                      <ChevronRight
                        size={18}
                        className="text-on-surface-variant/40"
                      />
                    </div>
                  </button>
                      </div>
                    )}

                    {settingsCategory === "account" && (
                      <div className="space-y-4 le-panel-enter">
                        <h3 className="font-headline font-bold text-lg mb-2">My Account</h3>
                  <button
                    onClick={() => setIsEditingProfile(true)}
                    className="le-press-feedback w-full flex items-center justify-between p-5 bg-surface-container-low hover:bg-surface-container-high rounded-2xl transition-all border border-outline-variant/10 group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                        <UserIcon size={20} />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-on-surface">
                          Edit Profile
                        </p>
                        <p className="text-xs text-on-surface-variant">
                          Change your name, email, and photo.
                        </p>
                      </div>
                    </div>
                    <ChevronRight
                      size={18}
                      className="text-on-surface-variant/40"
                    />
                  </button>
                      </div>
                    )}

                    {settingsCategory === "account" && (
                      <div className="space-y-4 le-panel-enter">
                        <h3 className="font-headline font-bold text-lg mb-2">App Preferences</h3>
                  <button
                    onClick={() => {
                      setActiveTab("dashboard");
                      setOnboardingOpen(true);
                      toast.success("✨ Starting interactive walkthrough tour...");
                    }}
                    className="w-full flex items-center justify-between p-5 bg-gradient-to-r from-primary/[0.04] to-transparent hover:from-primary/[0.08] hover:to-primary/[0.02] rounded-2xl transition-all border border-primary/10 group shadow-sm shadow-primary/[0.02]"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                        <Sparkles size={18} className="animate-pulse" />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-on-surface">
                          App Walkthrough Tour
                        </p>
                        <p className="text-xs text-on-surface-variant">
                          Restart the guided interactive manual tour of your workspace resources.
                        </p>
                      </div>
                    </div>
                    <ChevronRight
                      size={18}
                      className="text-primary/60"
                    />
                  </button>
                      </div>
                    )}

                    {settingsCategory === "future-staff" && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <button
                    onClick={() =>
                      toast.info("Staff Accounts coming soon!", {
                        description:
                          "You will be able to add staff members with limited access (e.g., cannot view revenue or delete menu items).",
                      })
                    }
                    className="w-full flex items-center justify-between p-5 bg-surface-container-low hover:bg-surface-container-high rounded-2xl transition-all border border-outline-variant/10 group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                        <Users size={20} />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-on-surface">
                          Staff Accounts
                        </p>
                        <p className="text-xs text-on-surface-variant">
                          Manage roles and permissions for your team.
                        </p>
                      </div>
                    </div>
                    <ChevronRight
                      size={18}
                      className="text-on-surface-variant/40"
                    />
                  </button>
                      </div>
                    )}

                    {settingsCategory === "future-riders" && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <a
                    href="https://rider.localeatssa.co.za/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-between p-5 bg-blue-500/5 hover:bg-blue-500/10 rounded-2xl transition-all border border-blue-500/20 group shadow-sm shadow-blue-500/5"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                        <TrendingUp size={24} />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-on-surface">
                          Rider Marketplace
                        </p>
                        <p className="text-xs text-on-surface-variant">
                          Access the dedicated platform for deliveries and
                          missions.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase text-blue-500/60 bg-blue-500/10 px-2 py-0.5 rounded-md">
                        External
                      </span>
                      <DollarSign size={18} className="text-blue-500" />
                    </div>
                  </a>
                      </div>
                    )}

                    {settingsCategory === "operations" && (
                      <SimpleOpeningHours
                        shop={currentShop}
                        verified={merchantShopGate.status==="ready"
                          && !!user?.id
                          && currentShop?.owner_id===user.id}
                        onEditShop={()=>setActiveTab("storefront")}
                      />
                    )}

                    {/* Legacy hours editor preserved for future API verification.
                        Its direct metadata Save Hours is not mounted in S2. */}
                    {settingsCategory === "future-operations" && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <h3 className="font-headline font-bold text-lg mb-2">Operations Center</h3>
                  {/* Order Operations Section */}
                  <div className="w-full flex flex-col p-5 bg-surface-container-low rounded-2xl border border-outline-variant/10 space-y-6">
                    <div className="flex items-center gap-2 border-b border-outline-variant/10 pb-4">
                      <Store size={18} className="text-on-surface-variant" />
                      <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider">Order Operations</h3>
                    </div>

                    {/* Store Status Toggle */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="text-left">
                        <p className="font-bold text-on-surface">Store Status</p>
                        <p className="text-xs text-on-surface-variant">Are you currently accepting new orders?</p>
                      </div>
                      <div className="flex bg-surface-container-high p-1 rounded-xl border border-outline-variant/10">
                         {(["open", "busy", "closed"] as const).map((statusOption) => {
                           const labels = { open: "Open", busy: "Busy", closed: "Closed" };
                           const activeClass = 
                             statusOption === "open" ? "bg-emerald-500 text-white shadow-sm" : 
                             statusOption === "busy" ? "bg-amber-500 text-white shadow-sm" :
                             "bg-rose-500 text-white shadow-sm";

                           return (
                             <button
                               key={statusOption}
                               onClick={() => {

                                 if (currentShop) {
                                   const isActive = statusOption === "open" || statusOption === "busy";
                                   void syncShopAvailability({
                                     shopId: currentShop.id,
                                     isOpen: isActive,
                                     supabase,
                                     updateFirestoreShop,
                                     getFirestoreShopById,
                                     onSuccess: async (freshShop) => {
                                       setStoreStatus(statusOption);
                                       toast.success(`Shop is now ${statusOption === "open" ? "OPEN" : statusOption === "busy" ? "BUSY" : "CLOSED"}`);
                                       // Force a re-fetch of the current state immediately after success
                                       try {
                                         const verifiedShop = freshShop;
                                         if (verifiedShop) {
                                            setShops((prev) => prev.map((s) => s.id === currentShop.id ? { ...s, ...verifiedShop, is_active: verifiedShop.is_active } : s));
                                         }
                                         await fetchShops();
                                       } catch (e) {
                                         console.error("Failed to re-fetch after toggling:", e);
                                       }
                                     },
                                     onError: (err) => {
                                       toast.error(typeof err === "string" ? err : "Failed to update status");
                                     },
                                   });
                                 }
                               }}
                               className={cn(
                                 "px-4 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all",
                                 storeStatus === statusOption ? activeClass : "text-on-surface-variant hover:bg-surface-container-highest"
                               )}
                             >
                               {labels[statusOption]}
                             </button>
                           );
                         })}
                      </div>
                    </div>

                    {/* Default Prep Time */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="text-left">
                        <p className="font-bold text-on-surface">Default Prep Time</p>
                        <p className="text-xs text-on-surface-variant">Estimated minutes to prepare an average order.</p>
                      </div>
                      <div className="flex items-center gap-3">
                         <input 
                           type="range" 
                           min="5" 
                           max="60" 
                           step="5"
                           value={prepTime}
                           onChange={(e) => setPrepTime(Number(e.target.value))}
                           className="w-24 accent-primary h-1.5 bg-outline-variant/20 rounded-lg appearance-none cursor-pointer"
                         />
                         <span className="w-12 text-right text-xs font-black text-primary font-mono">{prepTime} min</span>
                      </div>
                    </div>
                  </div>

                  {/* Operational Hours */}
                  <div className="w-full flex flex-col p-5 bg-surface-container-low rounded-2xl border border-outline-variant/10 space-y-6">
                    <div className="flex flex-col gap-4 border-b border-outline-variant/10 pb-4">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <MapPin size={18} className="text-on-surface-variant" />
                          <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider">Operating Hours</h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-4">
                           {/* Auto Schedule Store Hours Toggle */}
                           <div className="flex items-center gap-2 bg-surface-container-highest/30 px-3 py-1.5 rounded-xl border border-outline-variant/10">
                             <div className="flex flex-col">
                               <span className="text-xs font-bold text-on-surface">Auto-Schedule Opening</span>
                               <span className="text-[9px] text-on-surface-variant font-medium">
                                 {"Server-managed in South African time; manual close takes priority"}
                               </span>
                             </div>
                             <button
                               disabled title="Schedule is evaluated by the LocalEats server in South African time."
                               className={cn(
                                 "w-10 h-5 rounded-full transition-all relative shrink-0 cursor-pointer ml-1",
                                 user?.user_metadata?.auto_schedule_enabled ? "bg-emerald-500" : "bg-outline-variant/40"
                               )}
                             >
                               <div className={cn("absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-all", user?.user_metadata?.auto_schedule_enabled ? "translate-x-5" : "translate-x-0")} />
                             </button>
                           </div>

                           <div className="flex items-center gap-2">
                             <span className="text-xs font-bold text-on-surface-variant">Manual Holiday Mode</span>
                             <button
                               onClick={async () => {
                                 if (!currentShop) return;
                                 const newStatus = !currentShop.is_active; // If we're toggling, newStatus is the opposite of currentShop.is_active

                                 const { success, error } = await syncShopAvailability({shopId:currentShop.id,isOpen:newStatus});

                                 if (success) {
                                   toast.success(
                                     newStatus 
                                       ? "Holiday Mode disabled. Your store is now accepting orders." 
                                       : "Holiday Mode enabled. Your store is now temporarily closed.",
                                     { icon: <PauseCircle className="text-primary"/> }
                                   );
                                 } else {
                                   toast.error("Failed to toggle Holiday Mode.");
                                 }
                               }}
                               className={cn(
                                 "w-10 h-5 rounded-full transition-all relative shrink-0",
                                 !currentShop?.is_active ? "bg-primary" : "bg-outline-variant/40"
                               )}
                             >
                               <div className={cn("absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-all", !currentShop?.is_active ? "translate-x-5" : "translate-x-0")} />
                             </button>
                           </div>
                        </div>
                      </div>

                      {/* Scheduled Holiday Range */}
                      <div className="flex flex-col gap-2 bg-surface-container-highest/20 p-3.5 rounded-xl border border-outline-variant/5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">Scheduled Holiday Range</label>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                           <input 
                              type="date" 
                              className="bg-surface-container-low text-xs border border-outline-variant/20 rounded-lg px-3 py-2 focus:outline-none focus:border-primary/50 font-mono"
                              value={user?.user_metadata?.holiday_schedule?.start || ''} 
                              onChange={async (e) => {
                                const currentSchedule = user?.user_metadata?.holiday_schedule || {};
                                const { data: updateRes, error } = await supabase.auth.updateUser({
                                  data: { holiday_schedule: { ...currentSchedule, start: e.target.value } }
                                });
                                if (updateRes?.user) {
                                  setUser(updateRes.user);
                                  toast.success("Holiday start date saved.");
                                } else if (error) {
                                  toast.error("Failed to save start date.");
                                }
                              }} 
                           />
                           <span className="text-xs font-bold text-on-surface-variant text-center sm:text-left">to</span>
                           <input 
                              type="date" 
                              className="bg-surface-container-low text-xs border border-outline-variant/20 rounded-lg px-3 py-2 focus:outline-none focus:border-primary/50 font-mono"
                              value={user?.user_metadata?.holiday_schedule?.end || ''} 
                              onChange={async (e) => {
                                const currentSchedule = user?.user_metadata?.holiday_schedule || {};
                                const { data: updateRes, error } = await supabase.auth.updateUser({
                                  data: { holiday_schedule: { ...currentSchedule, end: e.target.value } }
                                });
                                if (updateRes?.user) {
                                  setUser(updateRes.user);
                                  toast.success("Holiday end date saved.");
                                } else if (error) {
                                  toast.error("Failed to save end date.");
                                }
                              }} 
                           />
                           {(user?.user_metadata?.holiday_schedule?.start || user?.user_metadata?.holiday_schedule?.end) && (
                             <button 
                               onClick={async () => {
                                 const { data: updateRes, error } = await supabase.auth.updateUser({
                                   data: { holiday_schedule: null }
                                 });
                                 if (error) console.error(error);
                                 if (updateRes?.user) {
                                   setUser(updateRes.user);
                                   toast.success("Holiday schedule cleared.");
                                 }
                               }} 
                               className="text-xs text-error hover:underline mt-2 sm:mt-0 font-bold tracking-wide"
                             >
                               Clear Schedule
                             </button>
                           )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-end">
                        <button
                          onClick={() => {
                            const monday = operatingHours[0];
                            const newHours = operatingHours.map(d => 
                              ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(d.day) 
                                ? { ...d, open: monday.open, close: monday.close, active: monday.active }
                                : d
                            );
                            setOperatingHours(newHours);

                          }}
                          className="text-xs font-black uppercase text-primary hover:bg-primary/5 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <Copy size={14} /> Copy Monday to Mon-Fri
                        </button>
                      </div>
                      {operatingHours.map((dayObj, index) => (
                        <div key={dayObj.day} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-surface-container-highest/20 rounded-xl border border-outline-variant/5">
                          <div className="flex items-center gap-3 w-32">
                             <input 
                               type="checkbox"
                               checked={dayObj.active}
                               onChange={(e) => {
                                 const newHours = [...operatingHours];
                                 newHours[index].active = e.target.checked;
                                 setOperatingHours(newHours);
                               }}
                               className="w-4 h-4 text-primary rounded border-outline-variant/30 focus:ring-primary focus:ring-2 bg-transparent"
                             />
                             <span className={cn("text-xs font-black uppercase tracking-wider", dayObj.active ? "text-on-surface" : "text-on-surface-variant/50")}>
                               {dayObj.day}
                             </span>
                          </div>

                          {dayObj.active ? (
                            <div className="flex items-center gap-3 flex-1">
                              <input 
                                type="time"
                                value={dayObj.open}
                                onChange={(e) => {
                                  const newHours = [...operatingHours];
                                  newHours[index].open = e.target.value;
                                  setOperatingHours(newHours);
                                }}
                                className="bg-surface-container-low text-xs border border-outline-variant/20 rounded-lg px-2 py-1.5 focus:outline-none focus:border-primary/50 font-mono"
                              />
                              <span className="text-on-surface-variant text-xs font-bold">to</span>
                              <input 
                                type="time"
                                value={dayObj.close}
                                onChange={(e) => {
                                  const newHours = [...operatingHours];
                                  newHours[index].close = e.target.value;
                                  setOperatingHours(newHours);
                                }}
                                className="bg-surface-container-low text-xs border border-outline-variant/20 rounded-lg px-2 py-1.5 focus:outline-none focus:border-primary/50 font-mono"
                              />
                            </div>
                          ) : (
                            <div className="flex-1">
                              <span className="text-[10px] font-black uppercase tracking-widest text-rose-500/70 bg-rose-500/10 px-2 py-1 rounded-md">Closed</span>
                            </div>
                          )}
                        </div>
                      ))}
                      <div className="flex justify-end pt-2">
                        <button 
                          onClick={async () => {
                            const { data: updateRes, error } = await supabase.auth.updateUser({
                              data: { weekly_operating_hours: operatingHours }
                            });
                            if (error) {
                              toast.error("Failed to save operating hours: " + error.message);
                            } else if (updateRes?.user) {
                              setUser(updateRes.user);
                              toast.success("Weekly operating hours saved successfully!");
                            }
                          }}
                          className="px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold shadow-sm"
                        >
                          Save Hours
                        </button>
                      </div>
                    </div>
                  </div>
                      </div>
                    )}

                    {settingsCategory === "delivery" && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <h3 className="font-headline font-bold text-lg mb-2">Delivery & Logistics Settings</h3>

                        {/* Location Sync & Boundary Alignment Indicator */}
                        {currentShop && (
                          <LocationSyncIndicator
                            locationState={currentShopLocation}
                            syncAnalysis={currentShopLocationSync}
                            isLocating={isLocatingShopGPS}
                            isSaving={isSavingShopLocation}
                            onDetectGPS={detectShopGPS}
                            onAutoAlign={autoAlignShopCity}
                            onSave={() => saveShopLocationSettings()}
                            onOpenStorefrontMap={() => setActiveTab("storefront")}
                          />
                        )}

                  {/* Delivery & Dispatch Settings */}
                  <div className="w-full flex flex-col p-5 bg-surface-container-low rounded-2xl border border-outline-variant/10 space-y-6">
                    <div className="flex items-center justify-between border-b border-outline-variant/10 pb-4">
                      <div className="flex items-center gap-2">
                        <Truck size={18} className="text-primary" />
                        <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider">Delivery Logistics</h3>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                        Live Radius Engine
                      </span>
                    </div>

                    {/* Delivery Radius Restriction Card */}
                    <div className="p-4 bg-surface-container rounded-xl border border-primary/20 space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-on-surface">Enforce Maximum Delivery Radius</span>
                            {deliverySettings.radiusEnabled ? (
                              <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded">Active</span>
                            ) : (
                              <span className="text-[10px] font-black uppercase tracking-wider bg-surface-container-highest text-on-surface-variant/70 px-2 py-0.5 rounded">Disabled</span>
                            )}
                          </div>
                          <p className="text-xs text-on-surface-variant leading-relaxed">
                            Restrict incoming orders to customers within a specific straight-line distance (KM) from your shop pin to preserve food freshness and delivery speeds.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDeliverySettings({ ...deliverySettings, radiusEnabled: !deliverySettings.radiusEnabled })}
                          className={cn(
                            "w-12 h-6 rounded-full transition-all relative shrink-0",
                            deliverySettings.radiusEnabled ? "bg-primary" : "bg-surface-container-highest border border-outline-variant/30"
                          )}
                        >
                          <div
                            className={cn(
                              "absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm",
                              deliverySettings.radiusEnabled ? "left-7" : "left-1"
                            )}
                          />
                        </button>
                      </div>

                      {deliverySettings.radiusEnabled && (
                        <div className="pt-3 border-t border-outline-variant/10 space-y-3 animate-in fade-in duration-200">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-black uppercase tracking-wider text-on-surface-variant/80">
                              Maximum Delivery Distance (KM)
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="1"
                                max="50"
                                value={deliverySettings.maxDistanceKm}
                                onChange={(e) => setDeliverySettings({ ...deliverySettings, maxDistanceKm: Math.max(1, Number(e.target.value)) })}
                                className="w-16 text-right text-xs font-black text-primary font-mono bg-surface-container-high border border-outline-variant/20 rounded-lg px-2 py-1 focus:outline-none focus:border-primary"
                              />
                              <span className="text-xs font-bold text-on-surface-variant">KM</span>
                            </div>
                          </div>
                          <input 
                            type="range" 
                            min="1" 
                            max="30" 
                            value={deliverySettings.maxDistanceKm}
                            onChange={(e) => setDeliverySettings({ ...deliverySettings, maxDistanceKm: Number(e.target.value) })}
                            className="w-full accent-primary h-2 bg-outline-variant/20 rounded-lg appearance-none cursor-pointer"
                          />
                          <p className="text-[11px] font-medium text-on-surface-variant/70 italic">
                            Map view in Storefront Profile will display a {deliverySettings.maxDistanceKm} KM circular boundary overlay.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <label className="text-xs font-black uppercase tracking-wider text-on-surface-variant/70">
                          Delivery Fee Model
                        </label>
                        <div className="flex bg-surface-container-high p-1 rounded-xl border border-outline-variant/5">
                          {(["fixed", "distance"] as const).map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setDeliverySettings({...deliverySettings, type})}
                              className={cn(
                                "flex-1 px-4 py-2 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all",
                                deliverySettings.type === type ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:bg-surface-container-highest"
                              )}
                            >
                              {type === "fixed" ? "Fixed Rate" : "Per KM"}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                         <label className="text-xs font-black uppercase tracking-wider text-on-surface-variant/70">
                           {deliverySettings.type === "fixed" ? "Base Delivery Fee (R)" : "Rate Per KM (R)"}
                         </label>
                         <input 
                           type="number" 
                           value={deliverySettings.baseFee}
                           onChange={(e) => setDeliverySettings({...deliverySettings, baseFee: Number(e.target.value)})}
                           className="w-full bg-surface-container-high border border-outline-variant/10 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:border-primary/50"
                         />
                      </div>

                      <div className="space-y-3">
                         <label className="text-xs font-black uppercase tracking-wider text-on-surface-variant/70">
                           Free Delivery Threshold (R)
                         </label>
                         <input 
                           type="number" 
                           value={deliverySettings.freeDeliveryOver}
                           onChange={(e) => setDeliverySettings({...deliverySettings, freeDeliveryOver: Number(e.target.value)})}
                           className="w-full bg-surface-container-high border border-outline-variant/10 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:border-primary/50"
                           placeholder="e.g. 300 (0 for no free delivery)"
                         />
                      </div>

                      <div className="space-y-3">
                         <label className="text-xs font-black uppercase tracking-wider text-on-surface-variant/70">
                           Minimum Order Amount (R)
                         </label>
                         <input 
                           type="number" 
                           value={deliverySettings.minOrderAmount}
                           onChange={(e) => setDeliverySettings({...deliverySettings, minOrderAmount: Number(e.target.value)})}
                           className="w-full bg-surface-container-high border border-outline-variant/10 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:border-primary/50"
                           placeholder="e.g. 50"
                         />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-outline-variant/10 flex justify-end">
                      <button
                        type="button"
                        onClick={async () => {
                          if (!currentShop?.id) {
                            toast.error("No active shop found to save delivery settings.");
                            return;
                          }
                          const nowISO = new Date().toISOString();
                          try {
                            // Update Firestore
                            try {
                              await updateFirestoreShop(currentShop.id, {
                                delivery_radius_enabled: deliverySettings.radiusEnabled,
                                delivery_radius_km: deliverySettings.maxDistanceKm,
                                updated_at: nowISO,
                              });
                            } catch (fsErr) {
                              console.warn("Firestore delivery settings update warning:", fsErr);
                            }

                            const { error } = await supabase
                              .from("shops")
                              .update({
                                delivery_radius_enabled: deliverySettings.radiusEnabled,
                                delivery_radius_km: deliverySettings.maxDistanceKm,
                                updated_at: nowISO,
                              })
                              .eq("id", currentShop.id);

                            if (error && error.code !== "42703") {
                              console.warn("Supabase delivery settings update warning:", error.message);
                            }

                            setShops((prev) => {
                              const updated = prev.map((s) =>
                                s.id === currentShop.id
                                  ? {
                                      ...s,
                                      delivery_radius_enabled: deliverySettings.radiusEnabled,
                                      delivery_radius_km: deliverySettings.maxDistanceKm,
                                      updated_at: nowISO,
                                    }
                                  : s
                              );
                              try {
                                localStorage.setItem("localeats_cached_shops", JSON.stringify(updated));
                              } catch {
                                // ignore
                              }
                              return updated;
                            });

                            toast.success(`Delivery settings saved! (${deliverySettings.radiusEnabled ? `${deliverySettings.maxDistanceKm} KM radius active` : "Radius restriction disabled"})`);
                          } catch (err: unknown) {
                            const e = err as Error;
                            toast.error("Error saving delivery settings: " + e.message);
                          }
                        }}
                        className="px-6 py-2.5 bg-primary text-on-primary font-bold text-xs uppercase tracking-wider rounded-xl shadow-md active:scale-95 transition-all hover:bg-primary/90"
                      >
                        Save Delivery Settings
                      </button>
                    </div>

                  </div>
                      </div>
                    )}

                    {settingsCategory === "hardware" && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <h3 className="font-headline font-bold text-lg mb-2">Hardware & POS Integrations</h3>
                  {/* Direct Terminal Integration */}
                  <div className="w-full flex flex-col p-5 bg-surface-container-low rounded-2xl border border-outline-variant/10 space-y-6">
                    <div className="flex items-center gap-2 border-b border-outline-variant/10 pb-4">
                      <CreditCard size={18} className="text-on-surface-variant" />
                      <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider">Direct Terminal Integration</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="flex flex-col space-y-2">
                         <label className="text-xs font-black uppercase tracking-wider text-on-surface-variant/70">
                            Require Card Linking
                         </label>
                         <label className="flex items-center gap-3 mt-2 cursor-pointer bg-surface-container-high p-3 rounded-xl border border-outline-variant/5">
                           <input
                             type="checkbox"
                             checked={currentShop?.require_terminal_sync || false}
                             onChange={async (e) => {
                               const newValue = e.target.checked;
                               setShops(prev => prev.map(s => s.id === currentShop?.id ? { ...s, require_terminal_sync: newValue } : s));
                               try {
                                 const { error } = await supabase.from("shops").update({ require_terminal_sync: newValue }).eq("id", currentShop?.id);
                                 if (error) throw error;
                                 toast.success(newValue ? "Terminal sync now required for card payments" : "Terminal sync requirement disabled");
                               } catch {
                                 toast.error("Failed to update terminal sync requirement");
                                 setShops(prev => prev.map(s => s.id === currentShop?.id ? { ...s, require_terminal_sync: !newValue } : s));
                               }
                             }}
                             className="w-5 h-5 rounded accent-primary border-outline-variant/30 text-primary focus:ring-primary focus:ring-offset-surface-container-high"
                           />
                           <span className="text-sm font-bold text-on-surface select-none">Require Card Number Match</span>
                         </label>
                      </div>

                      <div className="flex flex-col space-y-2">
                         <label className="text-xs font-black uppercase tracking-wider text-on-surface-variant/70">
                            Terminal Provider
                         </label>
                         <select
                           value={currentShop?.terminal_provider || ""}
                           onChange={async (e) => {
                             const newValue = e.target.value;
                             setShops(prev => prev.map(s => s.id === currentShop?.id ? { ...s, terminal_provider: newValue } : s));
                             try {
                               await supabase.from("shops").update({ terminal_provider: newValue }).eq("id", currentShop?.id);
                             } catch (error) {
                               console.error(error);
                             }
                           }}
                           className="bg-surface-container-high border border-outline-variant/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary/50"
                         >
                           <option value="" disabled>Select Provider...</option>
                           <option value="Yoco">Yoco</option>
                           <option value="Adyen">Adyen</option>
                           <option value="Peach Payments">Peach Payments</option>
                         </select>
                      </div>

                      <div className="flex flex-col space-y-2 md:col-span-2">
                         <label className="text-xs font-black uppercase tracking-wider text-on-surface-variant/70">
                            Terminal Serial Number
                         </label>
                         <input
                           type="text"
                           placeholder="e.g. SN-12345678"
                           value={currentShop?.terminal_serial || ""}
                           onChange={(e) => {
                             const newValue = e.target.value;
                             setShops(prev => prev.map(s => s.id === currentShop?.id ? { ...s, terminal_serial: newValue } : s));
                           }}
                           onBlur={async (e) => {
                             const newValue = e.target.value;
                             try {
                               await supabase.from("shops").update({ terminal_serial: newValue }).eq("id", currentShop?.id);
                             } catch (error) {
                               console.error(error);
                             }
                           }}
                           className="bg-surface-container-high border border-outline-variant/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary/50"
                         />
                      </div>
                    </div>

                    {/* Auto-Accept Orders */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-6 mt-6 border-t border-outline-variant/10">
                      <div className="text-left">
                         <p className="font-bold text-on-surface flex items-center gap-2">
                           Automated Auto-Accept <span className="text-[9px] px-1.5 py-0.5 bg-primary/10 text-primary rounded uppercase tracking-wider">Paused</span>
                         </p>
                         <p className="text-xs text-on-surface-variant">Paused for safety. Orders must be accepted through the verified LocalEats API; old offline orders are never auto-accepted.</p>
                      </div>
                      <button
                        onClick={() => {
                          if (!autoAcceptOrders) {
                            toast.info("Auto-Accept is paused until server-side acceptance is approved.");
                          } else {
                            setAutoAcceptOrders(false);
                            toast.success("Auto-Accept disabled.");
                          }
                        }}
                        className={cn(
                          "w-12 h-6 rounded-full transition-all relative shrink-0",
                          autoAcceptOrders ? "bg-primary" : "bg-outline-variant",
                        )}
                      >
                        <div
                          className={cn(
                            "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                            autoAcceptOrders ? "left-7" : "left-1",
                          )}
                        />
                      </button>
                    </div>

                    {/* Auto-print Receipts */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-6 mt-6 border-t border-outline-variant/10">
                      <div className="text-left">
                         <p className="font-bold text-on-surface flex items-center gap-2">
                           ESC/POS Receipt Auto-Print <span className="text-[9px] px-1.5 py-0.5 bg-primary/10 text-primary rounded uppercase tracking-wider">Beta</span>
                         </p>
                         <p className="text-xs text-on-surface-variant">Automatically print the receipt when order is accepted. Requires connection to local ESC/POS network printer.</p>
                      </div>
                      <button
                        onClick={() => {
                          const nextState = !autoPrint;
                          setAutoPrint(nextState);
                          if (nextState) toast.success("Auto-print enabled. Please ensure your POS printer is connected.");
                        }}
                        className={cn(
                          "w-12 h-6 rounded-full transition-all relative shrink-0",
                          autoPrint ? "bg-primary" : "bg-outline-variant",
                        )}
                      >
                        <div
                          className={cn(
                            "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                            autoPrint ? "left-7" : "left-1",
                          )}
                        />
                      </button>
                    </div>

                    {/* Receipt Layout Toggle */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-6 mt-2 border-t border-outline-variant/5">
                      <div className="text-left">
                        <p className="font-bold text-on-surface flex items-center gap-2">
                          Default Paper Width
                        </p>
                        <p className="text-xs text-on-surface-variant">
                          Select the width of your thermal printer paper roll (58mm or 80mm).
                        </p>
                      </div>
                      <div className="flex bg-surface-container-high p-1 rounded-xl border border-outline-variant/5 text-xs font-black uppercase">
                        <button
                          onClick={() => setPrintingFormat("80mm")}
                          className={cn(
                            "px-3 py-1.5 rounded-lg transition-colors",
                            printingFormat === "80mm" ? "bg-zinc-800 text-white" : "text-on-surface-variant hover:bg-surface-container-highest"
                          )}
                        >
                          80mm
                        </button>
                        <button
                          onClick={() => setPrintingFormat("58mm")}
                          className={cn(
                            "px-3 py-1.5 rounded-lg transition-colors",
                            printingFormat === "58mm" ? "bg-zinc-800 text-white" : "text-on-surface-variant hover:bg-surface-container-highest"
                          )}
                        >
                          58mm
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-6 mt-2 border-t border-outline-variant/5">
                      <div className="text-left">
                        <p className="font-bold text-on-surface flex items-center gap-2">
                          Receipt Template Format
                        </p>
                        <p className="text-xs text-on-surface-variant">
                          Toggle between large-text Kitchen dispatch dockets vs customer stylized thermal receipts.
                        </p>
                      </div>
                      <div className="flex bg-surface-container-high p-1 rounded-xl border border-outline-variant/5 text-xs font-black uppercase">
                        <button className="px-3 py-1.5 bg-zinc-800 text-white rounded-lg">Standard</button>
                        <button className="px-3 py-1.5 text-on-surface-variant hover:bg-surface-container-highest rounded-lg transition-colors">Kitchen</button>
                      </div>
                    </div>

                    {/* IP Address */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-6 mt-2 border-t border-outline-variant/5">
                      <div className="text-left w-full md:w-auto">
                        <p className="font-bold text-on-surface">
                          Network IP
                        </p>
                        <p className="text-xs text-on-surface-variant">
                          Local IP address of your receipt printer on the WiFi network.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 w-full md:w-auto">
                        <input
                           type="text"
                           placeholder="e.g. 192.168.1.100"
                           className="bg-surface-container-high border border-outline-variant/10 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:border-primary/50 w-full md:w-48"
                        />
                        <button type="button" disabled aria-disabled="true" title="A verified printer connection is required before test printing."
                           className="min-h-11 bg-primary/10 text-primary px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap opacity-60 cursor-not-allowed">Test Print (Unavailable)</button>
                      </div>
                    </div>

                  </div>
                      </div>
                    )}

                    {settingsCategory === "future-banking" && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {/* Financial & Payout Settings */}
                  <div className="w-full flex items-center justify-between p-5 bg-surface-container-low hover:bg-surface-container-high rounded-2xl transition-all border border-outline-variant/10 group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                        <Wallet size={20} />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-on-surface">Payouts & Banking</p>
                        <p className="text-xs text-on-surface-variant">Bank payouts aren't active for the pickup-first pilot.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] items-center font-bold uppercase tracking-wider text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-full whitespace-nowrap hidden md:inline-flex">
                         Not active
                       </span>
                       <ChevronRight size={18} className="text-on-surface-variant/40" />
                    </div>
                  </div>

                  {/* Staff & Access Control */}
                  <div className="w-full flex items-center justify-between p-5 bg-surface-container-low hover:bg-surface-container-high rounded-2xl transition-all border border-outline-variant/10 group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-orange-600 group-hover:scale-110 transition-transform">
                        <Users size={20} />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-on-surface">Staff & Managers</p>
                        <p className="text-xs text-on-surface-variant">Add staff accounts and configure permission roles.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] items-center font-bold uppercase tracking-wider text-orange-600 bg-orange-500/10 px-2 py-0.5 rounded-full whitespace-nowrap hidden md:inline-flex">
                         1 Active
                       </span>
                       <ChevronRight size={18} className="text-on-surface-variant/40" />
                    </div>
                  </div>
                      </div>
                    )}

                    {settingsCategory === "billing" && (
                      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 w-full">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/10 pb-4">
                          <div className="text-left">
                            <h3 className="font-headline font-bold text-lg text-on-surface">Billing & App Subscription</h3>
                            <p className="text-xs text-on-surface-variant">Your current plan and planned merchant subscription options.</p>
                          </div>
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary self-start sm:self-auto">
                            <Wallet size={14} aria-hidden="true" /> Billing inactive
                          </span>
                        </div>

                        <MerchantSubscriptionPlans
                          shop={currentShop}
                          verified={merchantShopGate.status==="ready"
                            && !!user?.id
                            && currentShop?.owner_id===user.id}
                        />

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <section className="p-5 bg-surface-container-low rounded-2xl border border-outline-variant/10 space-y-4 text-left">
                            <h4 className="font-headline font-bold text-base text-on-surface flex items-center gap-2">
                              <Wallet size={18} className="text-primary" aria-hidden="true"/> Payment details
                            </h4>
                            <p className="text-sm text-on-surface-variant leading-relaxed">
                              No card linking or recurring subscription payments are available yet. You do not need to enter a card number, expiry date or security code.
                            </p>
                            <div role="note" className="rounded-xl bg-primary/5 border border-primary/15 p-3 text-xs leading-5 text-on-surface">
                              For your safety, the old browser-only billing form was retired. Any legacy billing draft on this device is removed when the updated app loads, if browser storage permits it.
                            </div>
                            {legacyBillingCleanupFailed&&(
                              <p role="alert" className="rounded-xl border border-error/30 bg-error/5 p-3 text-xs text-error leading-5">
                                This browser blocked automatic removal of the old billing draft. Clear this site's stored data using your browser settings; doing so may sign you out.
                              </p>
                            )}
                            <button type="button" onClick={()=>setActiveTab("payments")}
                              className="min-h-11 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-on-primary text-sm font-bold hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                              <ReceiptText size={17} aria-hidden="true"/> View Payments
                            </button>
                          </section>

                          <section className="p-5 bg-surface-container-low rounded-2xl border border-outline-variant/10 space-y-3 text-left">
                            <h4 className="font-headline font-bold text-base text-on-surface flex items-center gap-2">
                              <Ticket size={18} className="text-primary" aria-hidden="true"/> Invoices & receipts
                            </h4>
                            <div role="status" className="rounded-xl bg-surface-container-high/40 border border-outline-variant/10 p-4 space-y-2">
                              <p className="font-semibold text-sm text-on-surface">No verified subscription invoices available</p>
                              <p className="text-xs leading-5 text-on-surface-variant">
                                Subscription billing and invoice generation are not active. This page does not show mock invoices as paid or produce receipts without an authorized billing service.
                              </p>
                            </div>
                            <p className="text-xs text-on-surface-variant">
                              LocalEats plans and the proposed three-month introductory period can be reviewed above; the billing start date has not been assigned.
                            </p>
                          </section>
                        </div>
                      </div>
                    )}

                    {settingsCategory === "preferences" && (
                      <div className="space-y-4 le-panel-enter">
                        <h3 className="font-headline font-bold text-lg text-on-surface">Notifications & Appearance</h3>
                  <div className="w-full flex flex-col p-5 bg-surface-container-low rounded-2xl border border-outline-variant/10">
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-4">
                        <div aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Volume2 size={21} strokeWidth={2.2} aria-hidden="true"/>
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-on-surface">
                            Sound Alerts
                          </p>
                          <p className="text-xs text-on-surface-variant">
                            Play a sound when new orders arrive.
                          </p>
                        </div>
                      </div>
                      <button
                       type="button"
                       role="switch"
                       aria-label="Sound alerts"
                       aria-checked={soundAlerts}
                        onClick={() => {
                          const nextState = !soundAlerts;
                          setSoundAlerts(nextState);
                          if (nextState) {
                            setTimeout(() => playNotificationSound(false), 100);
                          }
                        }}
                        className={cn(
                          "le-settings-switch w-12 h-6 rounded-full transition-colors relative",
                          soundAlerts ? "bg-primary" : "bg-outline-variant",
                        )}
                      >
                        <div
                          className={cn(
                            "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                            soundAlerts ? "left-7" : "left-1",
                          )}
                        />
                      </button>
                    </div>

                    {soundAlerts && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 pt-4 border-t border-outline-variant/10 space-y-4 overflow-hidden"
                      >
                        {/* Tone style selection */}
                        <div className="space-y-2">
                          <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant/70">
                            Selected Alert Melody
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {[
                              { id: "calm" as const, label: "Calm Chime", desc: "Warm glass chords" },
                              { id: "friendly" as const, label: "Cozy Bubble", desc: "Cozy organic pop" },
                              { id: "sparkle" as const, label: "Success Sparkle", desc: "Shimmering glock" }
                            ].map((theme) => {
                              const isSelected = soundStyle === theme.id;
                              return (
                                <button
                                  key={theme.id}
                                  onClick={() => {
                                    setSoundStyle(theme.id);
                                    playNotificationSound(false, theme.id);
                                  }}
                                  className={cn(
                                    "p-3 rounded-xl border text-left flex flex-col justify-between transition-all duration-200 group relative overflow-hidden",
                                    isSelected
                                      ? "bg-primary/5 border-primary shadow-sm"
                                      : "bg-surface-container-high/40 border-outline-variant/25 hover:bg-surface-container-high"
                                  )}
                                >
                                  <div>
                                    <p className={cn(
                                      "text-xs font-bold transition-colors",
                                      isSelected ? "text-primary" : "text-on-surface"
                                    )}>
                                      {theme.label}
                                    </p>
                                    <p className="text-[10px] text-on-surface-variant/80 mt-1 line-clamp-1">
                                      {theme.desc}
                                    </p>
                                  </div>
                                  <div className="self-end mt-2 flex items-center justify-center w-6 h-6 rounded-full bg-surface-container-highest group-hover:bg-primary/10 text-on-surface-variant group-hover:text-primary transition-all">
                                    <Volume2 size={12} className={cn(isSelected ? "text-primary" : "")} />
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Volume Slider */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant/70">
                              Alert Volume
                            </label>
                            <span className="text-xs font-bold text-primary font-mono">{soundVolume}%</span>
                          </div>
                          <div className="flex items-center gap-3 bg-surface-container-high/20 p-3 rounded-xl border border-outline-variant/10">
                            <Volume1 size={16} className="text-on-surface-variant" />
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={soundVolume}
                              onChange={(e) => {
                                const v = parseInt(e.target.value);
                                setSoundVolume(v);
                              }}
                              onMouseUp={() => {
                                playNotificationSound(false, soundStyle);
                              }}
                              onTouchEnd={() => {
                                playNotificationSound(false, soundStyle);
                              }}
                              className="flex-1 accent-primary h-1.5 rounded-lg appearance-none bg-outline-variant/40 cursor-pointer"
                            />
                            <Volume2 size={16} className="text-on-surface-variant" />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  <div className="w-full flex items-center justify-between p-5 bg-surface-container-low rounded-2xl border border-outline-variant/10">
                    <div className="flex items-center gap-4">
                      <div aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-700 dark:text-sky-300">
                        <BellRing size={21} strokeWidth={2.2} aria-hidden="true"/>
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-on-surface">
                          Push Notifications
                        </p>
                        <p className="text-xs text-on-surface-variant">
                          Get browser alerts even when the app is closed.
                        </p>
                      </div>
                    </div>
                    <button
                       type="button"
                       role="switch"
                       aria-label="Push notifications"
                       aria-checked={pushEnabled}
                      onClick={() => {
                        if (!pushEnabled) {
                          if (import.meta.env.VITE_MERCHANT_PREVIEW_READ_ONLY === "true") {
                            toast.info("Read-only Preview: push registration is disabled.");
                            return;
                          }
                          requestPushPermissions(user?.id, activeTab === 'rider' ? 'rider' : 'merchant', supabase);
                        } else {
                          toast.info(
                            "To disable push notifications, please change your browser settings.",
                          );
                        }
                      }}
                      className={cn(
                        "le-settings-switch w-12 h-6 rounded-full transition-colors relative",
                        pushEnabled ? "bg-primary" : "bg-outline-variant",
                      )}
                    >
                      <div
                        className={cn(
                          "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                          pushEnabled ? "left-7" : "left-1",
                        )}
                      />
                    </button>
                  </div>

                  <div className="w-full flex items-center justify-between p-5 bg-surface-container-low rounded-2xl border border-outline-variant/10">
                    <div className="flex items-center gap-4">
                      <div aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container-high text-on-surface">
                        {darkMode ? <Moon size={21} strokeWidth={2.2} aria-hidden="true"/> : <Sun size={21} strokeWidth={2.2} aria-hidden="true"/>}
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-on-surface">Dark Mode</p>
                        <p className="text-xs text-on-surface-variant">
                          Toggle between light and dark themes.
                        </p>
                      </div>
                    </div>
                    <button
                       type="button"
                       role="switch"
                       aria-label="Dark mode"
                       aria-checked={darkMode}
                      onClick={() => setDarkMode(!darkMode)}
                      className={cn(
                        "le-settings-switch w-12 h-6 rounded-full transition-colors relative",
                        darkMode ? "bg-primary" : "bg-outline-variant",
                      )}
                    >
                      <div
                        className={cn(
                          "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                          darkMode ? "left-7" : "left-1",
                        )}
                      />
                    </button>
                  </div>
                      </div>
                    )}

                    {settingsCategory === "account" && (
                      <button type="button" onClick={()=>setActiveTab("payments")}
                        className="w-full min-h-11 flex items-center justify-between gap-3 p-5 bg-surface-container-low hover:bg-surface-container-high rounded-2xl border border-outline-variant/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                        <span className="flex items-center gap-3">
                          <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Wallet size={20} aria-hidden="true"/></span>
                          <span className="text-left">
                            <span className="block font-bold text-on-surface">Payments & Plans</span>
                            <span className="block text-xs text-on-surface-variant">View your plan and future subscription options</span>
                          </span>
                        </span>
                        <ChevronRight size={18} className="text-on-surface-variant/60" aria-hidden="true"/>
                      </button>
                    )}

                    {settingsCategory === "account" && (
                      <div className="space-y-4 le-panel-enter mt-8">
                  <div className="w-full p-5 bg-surface-container-low rounded-2xl border border-outline-variant/10"><LanguageSwitcher /></div>
                  <button
                    onClick={handleSignOut}
                    className="le-press-feedback w-full flex items-center justify-between p-5 bg-error/5 hover:bg-error/10 rounded-2xl transition-all border border-error/10 group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-error/10 flex items-center justify-center text-error group-hover:scale-110 transition-transform">
                        <LogOut size={20} />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-error">Sign Out</p>
                        <p className="text-xs text-error/60">
                          Logout from your account.
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-error/40" />
                  </button>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}
            {activeTab === "storefront" && (
              <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/10 pb-4">
                  <button
                    onClick={() => setActiveTab("settings")}
                    className="le-press-feedback min-h-11 flex items-center gap-2 text-sm font-bold text-on-surface-variant hover:text-primary transition-colors"
                  >
                    <ChevronRight className="rotate-180" size={16} />
                    Back to Settings
                  </button>

                </div>

                {currentShop && (
                  <>
                    
                    <ShopProfile
                      shop={currentShop}
                    onRefresh={fetchShops}
                    user={user}
                    setIsSaving={setIsSaving}
                    setIsSaveSuccess={setIsSaveSuccess}
                    isSaving={isSaving}
                    isSuccess={isSaveSuccess}
                    onFinished={() => setActiveTab("dashboard")}
                  />
                  </>
                )}
              </div>
            )}
          </div>
      </main>

      {/* Floating Help Button */}
      <button
        onClick={() => setShowHelp(true)}
        className={cn(
          "fixed z-[60] w-14 h-14 bg-primary text-on-primary rounded-full shadow-2xl shadow-primary/40 flex items-center justify-center hover:scale-110 active:scale-95 transition-all group",
          kitchenMode ? "bottom-8 right-6" : "bottom-24 md:bottom-8 right-6"
        )}
        title="Help & Tips"
      >
        <HelpCircle
          size={28}
          className="group-hover:rotate-12 transition-transform"
        />
        <span className="absolute right-full mr-4 px-3 py-1.5 bg-surface-container-highest text-on-surface text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl border border-outline-variant/10">
          Need help?
        </span>
      </button>

      {/* Help Modal */}
      <AnimatePresence>
        {showHelp && (
            <motion.div key="showHelp-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHelp(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-surface-container-lowest rounded-[32px] shadow-2xl overflow-hidden border border-outline-variant/10"
            >
              <div className="p-6 md:p-8 space-y-8 max-h-[80vh] overflow-y-auto scrollbar-hide">
                <header className="flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-primary">
                      <ArrowRight size={20} />
                      <span className="text-xs font-black uppercase tracking-widest">
                        Guide
                      </span>
                    </div>
                    <h2 className="text-3xl font-headline font-black text-on-surface tracking-tight">
                      How LocalEats Works
                    </h2>
                  </div>
                  <button
                    onClick={() => setShowHelp(false)}
                    className="p-2 hover:bg-surface-container rounded-full transition-colors"
                  >
                    <TrendingUp size={24} />
                  </button>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    {
                      title: "Dashboard",
                      desc: "Your command center. Track total sales, order volume, and follower growth at a glance.",
                      icon: LayoutDashboard,
                      color: "text-blue-500 bg-blue-50",
                    },
                    {
                      title: "Menu Management",
                      desc: "Add items, set prices, and upload mouth-watering photos. Toggle availability instantly.",
                      icon: UtensilsCrossed,
                      color: "text-orange-500 bg-orange-50",
                    },
                    {
                      title: "Real-time Orders",
                      desc: "Never miss a beat. Orders pop up instantly with sound alerts. Use Kitchen Mode for focus.",
                      icon: ReceiptText,
                      color: "text-green-500 bg-green-50",
                    },
                    {
                      title: "Marketing & Coupons",
                      desc: "Grow your reach. Create discount codes and use AI to craft perfect campaigns.",
                      icon: Megaphone,
                      color: "text-purple-500 bg-purple-50",
                    },
                    {
                      title: "Insights",
                      desc: "Understand your customers. View reviews and analyze performance trends.",
                      icon: TrendingUp,
                      color: "text-indigo-500 bg-indigo-50",
                    },
                    {
                      title: "Storefront",
                      desc: "Customize how customers see your shop. Update your bio, location, and social links.",
                      icon: Store,
                      color: "text-pink-500 bg-pink-50",
                    },
                    {
                      title: "Delivery & Logistics",
                      desc: "Set your delivery radius, monitor rider progress on the live map, and manage dispatching.",
                      icon: Truck,
                      color: "text-cyan-500 bg-cyan-50",
                    },
                    {
                      title: "Earnings & Payouts",
                      desc: "Monitor your revenue in real-time and manage your weekly payout schedule securely.",
                      icon: Wallet,
                      color: "text-emerald-500 bg-emerald-50",
                    },
                    {
                      title: "Customer Engagement",
                      desc: "Respond to reviews, track repeat customers, and build loyalty with tailored rewards.",
                      icon: Heart,
                      color: "text-rose-500 bg-rose-50",
                    },
                    {
                      title: "Rider Network",
                      desc: "Access a fleet of on-demand riders. Real-time GPS tracking ensures your food reaches customers hot and fresh.",
                      icon: Bike,
                      color: "text-blue-600 bg-blue-50",
                    },
                    {
                      title: "QR Verification",
                      desc: "The gold standard for security. QR codes ensure the right order goes to the right person every single time.",
                      icon: QrCode,
                      color: "text-amber-600 bg-amber-50",
                    },
                    {
                      title: "Growth Support",
                      desc: "Get help when you need it. Our automated tools and community forum are here to help you grow your business.",
                      icon: HelpCircle,
                      color: "text-teal-600 bg-teal-50",
                    },
                    {
                      title: "Marketplace Tips",
                      desc: "Optimize your menu for search, use high-quality photos, and respond to feedback to improve your rankings.",
                      icon: Sparkles,
                      color: "text-amber-500 bg-amber-50",
                    },
                    {
                      title: "Community Forum",
                      desc: "Connect with other vendors, share success stories, and get advice from the LocalEats community.",
                      icon: Users,
                      color: "text-indigo-600 bg-indigo-50",
                    },
                  ].map((tip, i) => (
                    <div
                      key={i}
                      className="flex gap-4 p-4 rounded-2xl border border-outline-variant/5 hover:border-primary/20 transition-colors group"
                    >
                      <div
                        className={cn(
                          "w-12 h-12 shrink-0 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110",
                          tip.color,
                        )}
                      >
                        <tip.icon size={24} />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-bold text-on-surface">
                          {tip.title}
                        </h3>
                        <p className="text-sm text-on-surface-variant leading-relaxed">
                          {tip.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-primary/5 rounded-2xl p-6 border border-primary/10 space-y-3">
                  <h4 className="font-bold text-primary flex items-center gap-2">
                    <Rocket size={18} />
                    Pro Tip
                  </h4>
                  <p className="text-sm text-on-surface-variant">
                    Enable <b>Sound Alerts</b> in Settings to ensure you hear
                    every new order even when the tab is in the background.
                  </p>
                </div>

                <div className="bg-emerald-500/5 rounded-2xl p-6 border border-emerald-500/10 space-y-3">
                  <h4 className="font-bold text-emerald-600 flex items-center gap-2">
                    <ShieldCheck size={18} />
                    Safety & Trust
                  </h4>
                  <p className="text-sm text-on-surface-variant">
                    All transactions are encrypted and secured. We use multi-factor verification for payouts and location data is only shared with active delivery participants.
                  </p>
                </div>

                <button
                  onClick={() => setShowHelp(false)}
                  className="w-full py-4 bg-primary text-on-primary font-black rounded-2xl shadow-lg shadow-primary/20 hover:scale-[0.99] active:scale-95 transition-all"
                >
                  Got it, let's go!
                </button>
              </div>
            </motion.div>
          </motion.div>
          )}
        </AnimatePresence>

      {/* BottomNavBar */}
      {!kitchenMode && (
        <nav aria-label="Mobile dashboard navigation" className="md:hidden fixed bottom-0 left-0 w-full z-[100] bg-white/80 dark:bg-surface-container-lowest/80 backdrop-blur-2xl rounded-t-3xl border-t border-outline-variant/10 shadow-[0_-10px_30px_rgba(0,0,0,0.08)]">
          <div className="flex items-center justify-between gap-1 px-3 pb-[max(2rem,env(safe-area-inset-bottom))] pt-4 overflow-x-auto scrollbar-hide">
            {(() => {
              const primaryMobileTabIds = ["dashboard", "orders", "menu", "riders"];
              const primaryMobileNavItems = navItems.filter((item) => primaryMobileTabIds.includes(item.id));
              const secondaryMobileNavItems = navItems.filter((item) => !primaryMobileTabIds.includes(item.id));
              const isMoreActive = !primaryMobileTabIds.includes(activeTab);

              return (
                <>
                  {primaryMobileNavItems.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                      <motion.button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                    aria-label={item.label}
                    aria-current={isActive ? "page" : undefined}
                        whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                        className={cn(
                          "flex flex-col items-center justify-center min-w-[64px] min-h-12 shrink-0 py-2 rounded-2xl relative group transition-colors duration-150",
                          isActive
                            ? "text-white"
                            : "text-on-surface-variant/60 hover:text-primary",
                        )}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="mobileActiveTabBackground"
                            className="absolute inset-x-1 inset-y-0.5 bg-primary rounded-2xl shadow-lg shadow-primary/25 -z-10"
                            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 30 }}
                          />
                        )}
                        <div className={cn(
                          "relative",
                          isActive ? "scale-110" : "group-active:scale-95 transition-transform"
                        )}>
                          <span key={`mobile-${item.id}-${navAttention[item.id as keyof typeof navAttention]??0}`}
                            className={cn("inline-flex",navAttention[item.id as keyof typeof navAttention]&&"localeats-nav-notice-wiggle")}>
                            <item.icon size={20} className={cn(isActive ? "stroke-[2.5px]" : "stroke-[1.5px]")} />
                          </span>
                          {item.badge && (
                            <span className={cn(
                              "absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black border-2 border-white dark:border-zinc-950",
                              isActive ? "bg-white text-primary" : "bg-primary text-white"
                            )}>
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <span className={cn(
                          "text-[10px] uppercase tracking-wider font-black mt-1.5",
                          isActive ? "text-white" : "text-inherit"
                        )}>
                          {item.label === "Dashboard" ? "Home" : item.label}
                        </span>
                      </motion.button>
                    );
                  })}

                  {/* More Button */}
                  <motion.button
                    onClick={() => setIsMobileMoreOpen(true)}
                     aria-label="More dashboard sections"
                     aria-expanded={isMobileMoreOpen}
                     aria-controls="localeats-mobile-more-drawer"
                    whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                    className={cn(
                      "flex flex-col items-center justify-center min-w-[64px] min-h-12 shrink-0 py-2 rounded-2xl relative group transition-colors duration-150",
                      isMoreActive
                        ? "text-white"
                        : "text-on-surface-variant/60 hover:text-primary",
                    )}
                  >
                    {isMoreActive && (
                      <motion.div
                        layoutId="mobileActiveTabBackground"
                        className="absolute inset-x-1 inset-y-0.5 bg-primary rounded-2xl shadow-lg shadow-primary/25 -z-10"
                        transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                    <div className="relative">
                      <span key={`mobile-more-${secondaryMobileNavItems.map(item=>navAttention[item.id as keyof typeof navAttention]??0).join("-")}`}
                        className={cn("inline-flex",secondaryMobileNavItems.some(item=>navAttention[item.id as keyof typeof navAttention])&&"localeats-nav-notice-wiggle")}>
                        <MoreHorizontal size={20} className={cn(isMoreActive ? "stroke-[2.5px]" : "stroke-[1.5px]")}/>
                      </span>
                      {secondaryMobileNavItems.some(item => item.badge) && (
                        <span className={cn(
                          "absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black border-2 border-white animate-pulse",
                          isMoreActive ? "bg-white text-primary" : "bg-primary text-white"
                        )}>
                          {secondaryMobileNavItems.reduce((acc, curr) => acc + (typeof curr.badge === 'number' ? curr.badge : curr.badge ? 1 : 0), 0)}
                        </span>
                      )}
                    </div>
                    <span className={cn(
                      "text-[10px] uppercase tracking-wider font-black mt-1.5",
                      isMoreActive ? "text-white" : "text-inherit"
                    )}>
                      More
                    </span>
                  </motion.button>
                </>
              );
            })()}
          </div>
        </nav>
      )}

      {/* More Features Bottom Drawer on Mobile */}
      <AnimatePresence>
        {isMobileMoreOpen && (
          <div className="md:hidden fixed inset-0 z-[150] flex items-end justify-center">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => setIsMobileMoreOpen(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            {/* Drawer content */}
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              id="localeats-mobile-more-drawer"
               role="dialog"
               aria-modal="true"
               aria-labelledby="localeats-mobile-more-title"
               tabIndex={-1}
               ref={mobileMoreDrawerRef}
               onKeyDown={(e) => {
                 if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setIsMobileMoreOpen(false); }
                 if (e.key === "Tab") {
                   const buttons = mobileMoreDrawerRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
                   if (!buttons?.length) return;
                   const first = buttons[0];
                   const last = buttons[buttons.length - 1];
                   if (e.shiftKey && (document.activeElement === first || document.activeElement === mobileMoreDrawerRef.current)) {
                     e.preventDefault(); last.focus();
                   } else if (!e.shiftKey && document.activeElement === last) {
                     e.preventDefault(); first.focus();
                   }
                 }
               }}
               className="relative w-full bg-surface-container-lowest rounded-t-[32px] border-t border-outline-variant/10 p-6 pb-12 shadow-2xl max-h-[75vh] overflow-y-auto pointer-events-auto text-on-surface"
            >
              {/* Handle bar for native feeling */}
              <div className="w-12 h-1.5 bg-on-surface-variant/20 rounded-full mx-auto mb-6" />

              <h3 id="localeats-mobile-more-title" className="font-headline font-black text-xl text-on-surface mb-1.5 flex items-center gap-2">
                <span>More Features</span>
                <span className="text-[10px] font-mono py-0.5 px-2 rounded-full bg-primary/10 text-primary uppercase font-bold tracking-widest">LocalEats</span>
              </h3>
              <p className="text-xs text-on-surface-variant/80 mb-6 font-medium leading-relaxed">Access secondary storefront tools, promotional engines, and dashboard settings.</p>

              {/* Bento Grid */}
              <div className="grid grid-cols-2 gap-4">
                {navItems.filter(item => !["dashboard", "orders", "menu", "riders"].includes(item.id)).map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setIsMobileMoreOpen(false);
                      }}
                      className={cn(
                        "le-press-feedback p-5 rounded-3xl border text-left flex flex-col justify-between h-32 relative cursor-pointer min-h-[44px]",
                        isActive
                          ? "border-primary bg-primary/10 text-primary shadow-sm"
                          : "border-outline-variant/10 bg-surface-container-low hover:bg-surface-container text-on-surface"
                      )}
                    >
                      <div className="flex justify-between items-start w-full">
                        <div className={cn(
                          "p-3 rounded-2xl transition-colors",
                          isActive ? "bg-primary text-white" : "bg-on-surface/5 text-on-surface-variant"
                        )}>
                          <span key={`mobile-drawer-${item.id}-${navAttention[item.id as keyof typeof navAttention]??0}`}
                            className={cn("inline-flex",navAttention[item.id as keyof typeof navAttention]&&"localeats-nav-notice-wiggle")}>
                            <item.icon size={22} />
                          </span>
                        </div>
                        {item.badge && (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-white font-black animate-pulse shadow-sm shadow-primary/30">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="font-black text-sm md:text-base tracking-tight mb-0.5">{item.label}</div>
                        <div className="text-[9px] text-on-surface-variant/80 font-bold uppercase tracking-widest">Configure</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setIsMobileMoreOpen(false)}
                className="le-press-feedback w-full mt-6 py-4 bg-surface-container-high text-on-surface font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-surface-container-highest transition-colors min-h-[44px]"
              >
                Close Panel
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Update Notifier Floating Button */}
      <AnimatePresence>
        {updateAvailable && !updateDismissed && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 150, scale: 0.8 }}
            drag="x"
            dragConstraints={{ left: -50, right: 150 }}
            dragElastic={0.15}
            onDragEnd={(event, info) => {
              if (Math.abs(info.offset.x) > 50) {
                setUpdateDismissed(true);

              }
            }}
            title="Swipe left/right or click to dismiss update notice"
            className={cn(
              "fixed z-[60] cursor-grab active:cursor-grabbing select-none flex items-center gap-1.5 bg-[#FF5400] text-white pl-5 pr-3 py-3 rounded-full shadow-2xl shadow-orange-500/60 border-2 border-white/20 transition-all font-body active:scale-95 hover:scale-102",
              kitchenMode ? "bottom-8 left-6" : "bottom-24 md:bottom-8 left-6"
            )}
          >
            <button
              onClick={async () => {
                try {
                  if ("serviceWorker" in navigator) {
                    const registrations =
                      await navigator.serviceWorker.getRegistrations();
                    for (const registration of registrations) {
                      await registration.unregister();
                    }
                  }
                  // Clear all caches
                  if ("caches" in window) {
                    const keys = await caches.keys();
                    for (const key of keys) {
                      await caches.delete(key);
                    }
                  }
                } catch (e) {
                  console.error("Force reload error:", e);
                }
                // Force reload without cache
                window.location.href =
                  window.location.origin +
                  window.location.pathname +
                  "?v=" +
                  Date.now();
              }}
              className="flex items-center gap-3 text-left cursor-pointer"
            >
              <div className="relative shrink-0">
                <RefreshCw size={18} className="animate-spin text-white" />
                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-80 leading-none mb-0.5">
                  New update ({lastCheckTime})
                </p>
                <p className="text-xs font-black leading-none">
                  Refresh to See Changes
                </p>
              </div>
            </button>

            <div className="h-4 w-[1px] bg-white/25 mx-1 shrink-0" />

            <button
              onClick={() => {
                setUpdateDismissed(true);

              }}
              className="p-1 hover:bg-white/10 rounded-full transition-colors shrink-0 cursor-pointer"
              title="Dismiss list"
            >
              <Check size={14} className="text-white" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Legal & Privacy POPIA Trigger */}
      <div className="fixed bottom-2 left-2 z-[9900]">
        <button 
          onClick={() => setShowLegal(true)}
          className="text-[9px] text-zinc-500 hover:text-zinc-300 font-medium tracking-wide transition-colors bg-zinc-950/40 px-2.5 py-1 rounded-md backdrop-blur-md cursor-pointer border border-zinc-800/30"
        >
          Legal & Privacy (POPIA)
        </button>
      </div>
      <LegalDocsModal isOpen={showLegal} onClose={() => setShowLegal(false)} />

      {/* Network & System Diagnostics Trigger Button */}
      <button
        onClick={() => setIsDiagnosticOpen(true)}
        className={cn(
          "fixed z-[55] right-6 p-3 bg-surface-container-high border border-outline-variant/20 text-on-surface rounded-full shadow-lg hover:shadow-xl hover:bg-surface-container-highest transition-all duration-200 cursor-pointer flex items-center gap-2 group active:scale-95",
          kitchenMode ? "bottom-8" : "bottom-24 md:bottom-8"
        )}
        title="Open Network & System Diagnostics"
      >
        <div className="p-1.5 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
          <Activity size={16} />
        </div>
        <span className="text-xs font-bold pr-1 hidden sm:inline">Diagnostics</span>
      </button>

      <DiagnosticUtilityModal
        isOpen={isDiagnosticOpen}
        onClose={() => setIsDiagnosticOpen(false)}
        supabase={supabase}
        serviceLoading={serviceLoading}
      />

      <SavingOverlay isSaving={isSaving} isSuccess={isSaveSuccess} />
    </div>
  );
}

export default function AppWrapper() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
