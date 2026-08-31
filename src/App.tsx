import { checkPrinterConnectivity, printViaBluetooth, printViaUSB } from "./utils/escPosEngine";
import { processOfflineSyncQueue } from "./utils/offlineSyncQueue";
import { RealtimeChannel } from "@supabase/supabase-js";
import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import L from "leaflet";
import { motion, AnimatePresence } from "framer-motion";
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
  subscribeToShopsFirestore,
  subscribeToOrdersFirestore,
  getFirestoreShops,
  getFirestoreShopById,
  getFirestoreOrders,
  sendPushNotification,
  updateFirestoreShop,
} from "./lib/firebase";
import { useKitchenAlerter } from "./hooks/useKitchenAlerter";
import { useAuthGuard } from "./hooks/useAuthGuard";
import { useOrderWorkflow } from "./hooks/useOrderWorkflow";
import { useShopLocation } from "./hooks/useShopLocation";
import { useAppNavigation } from "./hooks/useAppNavigation";
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
import { RiderManagement } from "./components/RiderManagement";
import { Coupons } from "./components/Coupons";
import { Marketing } from "./components/Marketing";
import { Insights } from "./components/Insights";
import { PaymentHistory } from "./components/PaymentHistory";
import { LegalDocsModal } from "./components/LegalDocsModal";
import { DiagnosticUtilityModal } from "./components/DiagnosticUtilityModal";
import { ShopDiagnosticPanel } from "./components/ShopDiagnosticPanel";
import { OnboardingTour } from "./components/OnboardingTour";
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
import { MY_KOTA_SHOP, FALLBACK_SHOPS, FALLBACK_MENU_ITEMS } from "./constants";
import {
  syncShopAvailability,
} from "./utils/availabilityChecker";
import {
  cleanLocalStorageCache,
} from "./utils/storageCleanup";
import {
  getNetworkDate,
  getNetworkFormattedTimeHHMM,
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
} from "./utils/shopOwnership";
import { fetchWithRetry } from "./utils/fetchWithRetry";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
  const [showHelp, setShowHelp] = useState(false);
  const [showLegal, setShowLegal] = useState(false);
  const [dataSaverMode] = useState<boolean>(() => localStorage.getItem("localeats_data_saver") === "true");
  const [darkMode, setDarkMode] = useState<boolean>(() => localStorage.getItem("darkMode") === "true");
  const [showOfflineInfoModal, setShowOfflineInfoModal] = useState<boolean>(false);
  const [testingConnection, setTestingConnection] = useState<boolean>(false);

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      if (navigator.onLine) {
        toast.success("Connection to relay nodes is optimal.");
      } else {
        toast.error("Cannot reach dispatch edge servers.");
      }
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
  const [autoAcceptOrders, setAutoAcceptOrders] = useState<boolean>(() => localStorage.getItem("autoAcceptOrders") === "true");
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
  const [shops, setShops] = useState<Shop[]>(() => {
    try {
      const cached = localStorage.getItem("localeats_cached_shops");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (!parsed.some((s: Shop) => Number(s.id) === 18)) {
            return [MY_KOTA_SHOP, ...parsed];
          }
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return FALLBACK_SHOPS;
  });
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => {
    try {
      const cached = localStorage.getItem("localeats_cached_menu_items");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });
  const [user, setUser] = useState<User | null>(() => {
    try {
      const cached = localStorage.getItem("localeats_user_session");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.id) return parsed;
      }
    } catch {
      // ignore
    }
    return null;
  });
    const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  // Kitchen status state available if needed

  const currentShop = useMemo(
    () => shops.find((s) => isShopOwnedByUser(s, user)) || null,
    [shops, user],
  );

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

  const lastSyncedShopAuthRef = useRef<string>("");
  const shopId = currentShop?.id;
  const deliveryRadiusKm = currentShop?.delivery_radius_km;
  const deliveryRadiusEnabled = currentShop?.delivery_radius_enabled;
  const shopOwnerId = currentShop?.owner_id;
  const shopEmail = currentShop?.email;
  const shopName = currentShop?.name;
  const userId = user?.id;
  const userEmail = user?.email;
  const userMetadataShopId = user?.user_metadata?.shop_id;

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

      try {
        localStorage.setItem("localeats_my_shop_id", String(shopId));
        localStorage.setItem("localeats_vendor_shop_id", String(shopId));
        localStorage.setItem("localeats_last_selected_shop_id", String(shopId));
      } catch {
        // ignore
      }

      if (userId) {
        const syncKey = `${userId}_${shopId}`;
        if (lastSyncedShopAuthRef.current !== syncKey) {
          lastSyncedShopAuthRef.current = syncKey;

          if (shopOwnerId !== userId || shopEmail !== userEmail) {
            supabase
              .from("shops")
              .update({ owner_id: userId, email: userEmail || "" })
              .eq("id", shopId)
              .then()
              .catch(() => {});
          }

          if (String(userMetadataShopId) !== String(shopId)) {
            supabase.auth
              .updateUser({
                data: {
                  shop_id: shopId,
                  vendor_shop_id: shopId,
                  permanent_owner_id: userId,
                  vendor_shop_name: shopName || "My-Kota",
                },
              })
              .then()
              .catch(() => {});
          }
        }
      }
    }
  }, [
    shopId,
    deliveryRadiusKm,
    deliveryRadiusEnabled,
    shopOwnerId,
    shopEmail,
    shopName,
    userId,
    userEmail,
    userMetadataShopId,
  ]);

  const trialInfo = useMemo(() => {
    if (!currentShop) return null;

    const status = currentShop.subscription_status || "trial";

    // Default to a 30-day trial based on creation date or trial_start_date
    const startDate = currentShop.trial_start_date || currentShop.created_at || new Date().toISOString();
    const startMs = new Date(startDate).getTime();
    const trialDurationMs = 30 * 24 * 60 * 60 * 1000; // 30 days
    const endMs = startMs + trialDurationMs;
    const nowMs = Date.now();

    const daysRemaining = Math.max(0, Math.ceil((endMs - nowMs) / (1000 * 60 * 60 * 24)));
    const isExpired = status === "expired" || status === "past_due" || (status === "trial" && daysRemaining <= 0);

    return {
      status,
      daysRemaining,
      isExpired,
      nextPaymentDate: currentShop.next_payment_date || new Date(endMs).toISOString()
    };
  }, [currentShop]);

  const [settingsCategory, setSettingsCategory] = useState<string>("account");
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

  const [billingDetails, setBillingDetails] = useState<{
    companyName: string;
    taxNumber: string;
    billingEmail: string;
    cardNumber: string;
    expiryDate: string;
    cvv: string;
    cardholderName: string;
    isCardSaved: boolean;
  }>(() => {
    try {
      const saved = localStorage.getItem("localeats_billing_details");
      return saved ? JSON.parse(saved) : {
        companyName: "",
        taxNumber: "",
        billingEmail: "",
        cardNumber: "",
        expiryDate: "",
        cvv: "",
        cardholderName: "",
        isCardSaved: false
      };
    } catch {
      return {
        companyName: "",
        taxNumber: "",
        billingEmail: "",
        cardNumber: "",
        expiryDate: "",
        cvv: "",
        cardholderName: "",
        isCardSaved: false
      };
    }
  });

  const [selectedInvoice, setSelectedInvoice] = useState<{
    id: string;
    date: string;
    amount: string;
  } | null>(null);

  const [updateDismissed, setUpdateDismissed] = useState<boolean>(false);

  useEffect(() => {
    if (user?.user_metadata?.weekly_operating_hours) {
      setOperatingHours(user.user_metadata.weekly_operating_hours);
    }
  }, [user]);

  // --- Persistent Auth Session Sync & Vendor Shop Metadata Recovery ---
  useEffect(() => {
    const syncUserMetadataAndCache = (u: User) => {
      setUser(u);
      try {
        localStorage.setItem("localeats_user_session", JSON.stringify(u));

        // Recover shop ID immediately from user_metadata if local storage was cleared
        const metadataShopId = u.user_metadata?.vendor_shop_id || u.user_metadata?.shop_id;
        if (metadataShopId) {
          localStorage.setItem("localeats_my_shop_id", String(metadataShopId));
          localStorage.setItem("localeats_vendor_shop_id", String(metadataShopId));
          localStorage.setItem("localeats_last_selected_shop_id", String(metadataShopId));
        }
      } catch {
        // ignore
      }
    };

    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          syncUserMetadataAndCache(session.user);
        }
      } catch (err) {
        console.warn("[AuthSync] Initial session check warning:", err);
      }
    };

    void checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        syncUserMetadataAndCache(session.user);
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
    if (!user || !currentShop) return;

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
  }, [user, currentShop]);



  useEffect(() => {
    try {
      const cachedOrders = localStorage.getItem("le_orders");
      if (cachedOrders) {
        const parsed = JSON.parse(cachedOrders);
        if (Array.isArray(parsed)) setOrders(parsed);
      }
    } catch (e) {
      console.error("Error parsing cached orders. Resetting item.", e);
      localStorage.removeItem("le_orders");
    }

    try {
      const cachedMenu = localStorage.getItem("le_menu");
      if (cachedMenu) {
        const parsed = JSON.parse(cachedMenu);
        if (Array.isArray(parsed)) setMenuItems(parsed);
      }
    } catch (e) {
      console.error("Error parsing cached menu. Resetting item.", e);
      localStorage.removeItem("le_menu");
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
    // current session via Firebase Auth and cached storage
    const getSessionWithTimeout = async () => {
      console.log("[Auth Init] Firebase auth verification started...");
      try {
        const cached = localStorage.getItem("localeats_user_session");
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.id) {
              console.log("[Auth Init] Found cached local user session for user ID:", parsed.id);
              setUser(parsed);
              if (parsed.user_metadata?.dark_mode !== undefined) {
                setDarkMode(parsed.user_metadata.dark_mode);
              }
            }
          } catch {
            // ignore
          }
        }
      } catch (err) {
        console.debug("[Auth Init] Exception caught during session check:", err);
      } finally {
        setIsSessionChecking(false);
        setIsAuthReady(true);
        setLoading(false);
      }
    };

    getSessionWithTimeout();

    const handleForceLogout = () => {
      console.log("Force logout triggered");
      setUser(null);
      localStorage.removeItem("localeats_user_session");
      firebaseSignOutUser().catch(() => {});
    };
    window.addEventListener("force_logout", handleForceLogout);

    // Listen for Firebase Auth state changes
    console.log("[Auth Init] Registering Firebase onAuthStateChanged listener...");
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (fbUser) => {
      console.log(`[Auth Listener] Firebase Auth event triggered, user: ${fbUser?.uid || 'none'}`);
      if (fbUser) {
        try {
          const sessionUser = await formatFirebaseUserSession(fbUser);
          setUser(sessionUser);
          localStorage.setItem("localeats_user_session", JSON.stringify(sessionUser));
          if (sessionUser.user_metadata?.dark_mode !== undefined) {
            setDarkMode(Boolean(sessionUser.user_metadata.dark_mode));
          }
        } catch (e) {
          console.warn("[Auth Listener] Warning formatting Firebase user session:", e);
        }
      } else {
        const cached = localStorage.getItem("localeats_user_session");
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.id) {
              setUser(parsed);
            } else {
              setUser(null);
            }
          } catch {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      }
      setIsSessionChecking(false);
      setIsAuthReady(true);
      setLoading(false);
    });

    return () => {
      unsubscribe();
      window.removeEventListener("force_logout", handleForceLogout);
    };
  }, []);

  useEffect(() => {
    // Run storage audit cleanup on initialization to purge stale caches while preserving user shop overrides
    cleanLocalStorageCache();
  }, []);

  // Automatic Shop Opening/Closing based on synchronized internet/server hours
  useEffect(() => {
    const checkShopHours = async () => {
      if (!user || shops.length === 0) return;

      // Auto schedule is OFF by default. Only run if merchant explicitly enabled automated schedule.
      const autoScheduleEnabled = user.user_metadata?.auto_schedule_enabled === true;
      if (!autoScheduleEnabled) return;

      const now = getNetworkDate();
      const currentTime = getNetworkFormattedTimeHHMM();

      // Check if within scheduled Holiday Mode range
      let isHoliday = false;
      const holidaySchedule = user.user_metadata?.holiday_schedule;
      if (holidaySchedule && holidaySchedule.start && holidaySchedule.end) {
        const startDate = new Date(holidaySchedule.start);
        const endDate = new Date(holidaySchedule.end);
        endDate.setHours(23, 59, 59, 999); // Inclusive of the end day
        if (now >= startDate && now <= endDate) {
          isHoliday = true;
        }
      }

      // each shop owned by the user
      for (const shop of shops) {
        if (shop.owner_id !== user.id) continue;

        const operatingHours = shop.operating_hours;
        if (!operatingHours || !operatingHours.open || !operatingHours.close)
          continue;

        // Determine if shop should be open based on internet time
        let isOpen = false;
        if (!isHoliday) {
          if (operatingHours.open <= operatingHours.close) {
            isOpen = currentTime >= operatingHours.open && currentTime <= operatingHours.close;
          } else {
            isOpen = currentTime >= operatingHours.open || currentTime <= operatingHours.close;
          }
        }

        if (shop.is_active !== isOpen) {
          const overrideData = localStorage.getItem(`localeats_manual_status_override_${shop.id}`);
          if (overrideData) {
            try {
              const { status: manualStatus, timestamp } = JSON.parse(overrideData);
              if (Date.now() - timestamp < 12 * 60 * 60 * 1000) {
                if (manualStatus !== isOpen) {
                   continue; // Respect the manual override, skip auto-toggle
                } else {
                   // If they align now, we can clear the override
                   localStorage.removeItem(`localeats_manual_status_override_${shop.id}`);
                }
              }
            } catch {
              // Ignore invalid JSON parsing of override data
            }
          }

          const holidayMode = localStorage.getItem(`localeats_holiday_mode_${shop.id}`);
          if (isOpen && holidayMode === "true") {
             continue; // Do not auto open if in manual holiday mode
          }

          console.log(
            `Auto-toggling shop ${shop.name} to ${isOpen ? "Open" : "Closed"}`,
          );

          const { success } = await syncShopAvailability({
            shopId: shop.id,
            isOpen,
            supabase,
            updateFirestoreShop,
          });

          if (success) {
            setShops((prev) =>
              prev.map((s) =>
                s.id === shop.id ? { ...s, is_active: isOpen } : s,
              ),
            );
            toast.info(`Shop ${isOpen ? "Opened" : "Closed"} Automatically`, {
              description: `Based on your operating hours: ${operatingHours.open} - ${operatingHours.close}`,
              icon: isOpen ? (
                <Store className="text-emerald-500" />
              ) : (
                <PauseCircle className="text-primary" />
              ),
              duration: 5000,
            });
          }
        }
      }
    };

    // every minute
    const interval = setInterval(() => {
      void checkShopHours();
    }, 60000);
    void checkShopHours(); // Run once on mount or when shops/user change

    return () => clearInterval(interval);
  }, [user, shops, user?.user_metadata?.auto_schedule_enabled]);

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
    firestoreOrdersList.forEach((order) => {
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

    // Apply local overrides
    let localOverrides: Record<string, Partial<Order>> = {};
    try {
      localOverrides = JSON.parse(localStorage.getItem("localeats_order_overrides") || "{}");
    } catch {
      // ignore
    }

    if (Object.keys(localOverrides).length > 0) {
      combinedOrders = combinedOrders.map((order) => {
        const override = localOverrides[String(order.id)];
        return {
          ...order,
          ...(override || {}),
          total_price:
            (override?.total_price as number) ?? (order.total_price as number) ?? (order.price as number) ?? 0,
        };
      });
    }

    // Sort by created_at descending
    combinedOrders.sort((a, b) => {
      const timeA = new Date(a.created_at || 0).getTime();
      const timeB = new Date(b.created_at || 0).getTime();
      return timeB - timeA;
    });

    if (combinedOrders.length > 0) {
      setOrders(combinedOrders);
      try {
        localStorage.setItem("localeats_cached_orders", JSON.stringify(combinedOrders));
      } catch {
        // ignore
      }
    } else {
      try {
        const cachedOrders = JSON.parse(localStorage.getItem("localeats_cached_orders") || "[]");
        if (cachedOrders && cachedOrders.length > 0) {
          setOrders(cachedOrders);
          return;
        }
      } catch {
        // ignore
      }
      setOrders([]);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    if (!user) return;

    const ownedShopIds = await getOwnedShopIds(user, shops);

    // 1. Fetch from Firestore (Primary Cloud Storage for Client App Orders)
    let firestoreOrdersList: Order[] = [];
    try {
      firestoreOrdersList = await getFirestoreOrders(ownedShopIds.length > 0 ? ownedShopIds : undefined);
    } catch (fsErr) {
      console.warn("[Orders Sync] Notice fetching Firestore orders:", fsErr);
    }

    // 2. Fetch from Supabase (Relational fallback / legacy storage)
    let supabaseOrdersList: Order[] = [];
    try {
      const { data, error } = await fetchWithRetry(() =>
        supabase
          .from("orders")
          .select("*")
          .in("shop_id", ownedShopIds)
          .order("created_at", { ascending: false })
          .limit(250),
      );

      if (data) {
        // Clean up orphaned rider requests
        const stuckOrders = data.filter(
          (o: Record<string, unknown>) =>
            (o.status === "completed" && o.delivery_status === "finding_rider") ||
            o.delivery_status === "none",
        );

        if (stuckOrders.length > 0) {
          stuckOrders.forEach((o: Record<string, unknown>) => {
            o.delivery_status = null;
          });
        }

        supabaseOrdersList = data.map((d: Record<string, unknown>) => ({
          ...d,
          id: String(d.id),
          total_price: Number(d.total_price ?? d.price ?? 0),
        })) as Order[];
      } else if (error && !isSupabaseMocked()) {
        console.warn("Notice fetching Supabase orders:", error.message || error);
      }
    } catch (sbErr) {
      console.warn("[Orders Sync] Notice querying Supabase:", sbErr);
    }

    processAndSetOrders(firestoreOrdersList, supabaseOrdersList);
  }, [user, shops, processAndSetOrders]);

  const fetchAllMenuItems = useCallback(async () => {
    if (!user) return;

    const ownedShopIds = await getOwnedShopIds(user, shops);
    console.log("[App fetchAllMenuItems] 🏬 ownedShopIds:", ownedShopIds);

    if (ownedShopIds.length === 0) {
      const cached = localStorage.getItem("localeats_cached_menu_items");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.length > 0) {
            setMenuItems(parsed);
            return;
          }
        } catch {
          // ignore
        }
      }
      setMenuItems(FALLBACK_MENU_ITEMS);
      return;
    }

    // 1. Fetch from Supabase
    let sbItems: MenuItem[] = [];
    try {
      const { data, error } = await fetchWithRetry(() =>
        supabase.from("menu_items").select("*").in("shop_id", ownedShopIds)
      );
      if (data && Array.isArray(data)) {
        sbItems = data;
      } else if (error && !isSupabaseMocked()) {
        console.warn("[App] Notice fetching Supabase menu items:", error.message || error);
      }
    } catch (err) {
      console.warn("[App] Notice fetching Supabase menu items:", err);
    }

    // 2. Fetch from Firestore
    const fsItems: MenuItem[] = [];
    try {
      for (const sId of ownedShopIds) {
        const shopFsItems = await getFirestoreMenuItems(sId);
        console.log(`[App fetchAllMenuItems] 🔥 Firestore response for shopId ${sId}:`, shopFsItems);
        if (shopFsItems && shopFsItems.length > 0) {
          fsItems.push(...shopFsItems);
        }
      }
      console.log("[App fetchAllMenuItems] 🔥 Total Firestore menu_items query response:", {
        ownedShopIds,
        fsItemsCount: fsItems.length,
        fsItems,
      });
    } catch (fsErr) {
      console.warn("[App fetchAllMenuItems] Notice fetching Firestore menu items:", fsErr);
    }

    // 3. Merge Supabase & Firestore items
    const mergedMap = new Map<string, MenuItem>();
    fsItems.forEach((item) => {
      mergedMap.set(String(item.id || item.name), {
        ...item,
        is_available: item.is_available !== false,
        stock_quantity: item.stock_quantity ?? null,
      });
    });
    sbItems.forEach((item) => {
      mergedMap.set(String(item.id || item.name), {
        ...item,
        is_available: item.is_available !== false,
        stock_quantity: item.stock_quantity ?? null,
      });
    });

    const finalItems = Array.from(mergedMap.values());
    console.log("[App fetchAllMenuItems] 📋 Final merged menu items loaded into state:", {
      totalCount: finalItems.length,
      items: finalItems,
    });
    if (finalItems.length > 0) {
      setMenuItems(finalItems);
      try {
        localStorage.setItem("localeats_cached_menu_items", JSON.stringify(finalItems));
      } catch {
        // ignore
      }
    } else {
      const cached = localStorage.getItem("localeats_cached_menu_items");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.length > 0) {
            setMenuItems(parsed);
            return;
          }
        } catch {
          // ignore
        }
      }
      setMenuItems(FALLBACK_MENU_ITEMS);
    }
  }, [user, shops]);

  const fetchShops = useCallback(async () => {
    let remoteShops: Shop[] | null = null;
    let remoteError: { message: string; code?: string } | null = null;

    try {
      // Force cache purge on fetch execution
      localStorage.removeItem("localeats_cached_shops");

      // Load shops from Firestore (Isolate to current vendor owner)
      remoteShops = await getFirestoreShops(user?.id);
      
    } catch (e: unknown) {
      console.error("[Shop Discovery] Exception during fetchShops:", e);
      remoteError = { message: e instanceof Error ? e.message : String(e) };
    }

    if (remoteError || !remoteShops) {
      if (!isSupabaseMocked()) {
        console.debug("[Shops Cache] Using local cached shops:", remoteError?.message || "Inaccessible");
      }
      const cached = localStorage.getItem("localeats_cached_shops");
      let list = FALLBACK_SHOPS;
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            list = parsed;
          }
        } catch {
          // ignore
        }
      }
      if (!list.some((s) => Number(s.id) === 18)) {
        list = [MY_KOTA_SHOP, ...list];
      }
      setShops(list);
    } else {
      let list = remoteShops;
      if (!list.some((s) => Number(s.id) === 18)) {
        list = [MY_KOTA_SHOP, ...list];
      } else {
        list = list.map((s) => (Number(s.id) === 18 ? { ...MY_KOTA_SHOP, ...s } : s));
      }
      setShops(list);
      try {
        localStorage.setItem("localeats_cached_shops", JSON.stringify(list));
      } catch {
        // ignore
      }
    }
  }, [user?.id]);

  // Subscribe to Firestore for real-time shop updates (e.g. is_active toggles)
  useEffect(() => {
    if (user) {
      const unsubscribe = subscribeToShopsFirestore((updatedShops) => {
        let list = updatedShops;
        if (!list.some((s) => Number(s.id) === 18)) {
          list = [MY_KOTA_SHOP, ...list];
        } else {
          list = list.map((s) => (Number(s.id) === 18 ? { ...MY_KOTA_SHOP, ...s } : s));
        }
        setShops(list);
        
        try {
          localStorage.setItem("localeats_cached_shops", JSON.stringify(list));
        } catch {
          // ignore
        }
      }, user.id);
      return () => unsubscribe();
    }
  }, [user]);

  const { serviceLoading } = useAppInitializer({
    user,
    role: "merchant",
    fetchOrders,
    fetchShops,
    fetchAllMenuItems,
    supabase,
  });

  // Order subscriptions: Listen to BOTH Firestore & Supabase in real-time
  useEffect(() => {
    if (!user || shops.length === 0) return;

    let isMounted = true;
    const activeChannels: RealtimeChannel[] = [];
    let unsubFirestore: (() => void) | null = null;
    let pollingInterval: ReturnType<typeof setInterval> | null = null;

    // Start fallback polling interval (30s) to guarantee UI sync
    pollingInterval = setInterval(() => {
      if (isMounted) {
        void fetchOrders();
      }
    }, 30000);

    // Get all owned shop IDs (string and numeric variants)
    void getOwnedShopIds(user, shops).then((ownedShopIds) => {
      if (!isMounted) return;

      // 1. Subscribe to Firestore orders collection in real-time
      try {
        unsubFirestore = subscribeToOrdersFirestore(
          ownedShopIds.length > 0 ? ownedShopIds : undefined,
          (liveOrders) => {
            if (isMounted) {
              processAndSetOrders(liveOrders);
            }
          }
        );
      } catch (fsErr) {
        console.warn("[Orders Realtime] Firestore subscription notice:", fsErr);
      }

      // 2. Subscribe to Supabase postgres_changes
      const uniqueNumericOrStringIds = Array.from(new Set(ownedShopIds));
      uniqueNumericOrStringIds.forEach((shopId) => {
        void subscribeWithAuthGuard(`orders_changes_${shopId}`, (ch) =>
          ch.on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "orders",
              filter: `shop_id=eq.${shopId}`,
            },
            () => {
              if (isMounted) {
                void fetchOrders();
              }
            },
          )
        ).then((ch) => {
          if (ch) {
            if (isMounted) {
              activeChannels.push(ch);
            } else {
              void supabase.removeChannel(ch);
            }
          }
        });
      });
    });

    return () => {
      isMounted = false;
      if (pollingInterval) clearInterval(pollingInterval);
      if (unsubFirestore) unsubFirestore();
      activeChannels.forEach((channel) => void supabase.removeChannel(channel));
    };
  }, [user, shops, fetchOrders, processAndSetOrders, subscribeWithAuthGuard]);

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

  // --- Automated Rider Matching on Order Arrival ---
  useEffect(() => {
    if (!orders || orders.length === 0) return;

    // Find delivery orders that just arrived (type delivery, status pending, and delivery_status is null/none/undefined)
    const incomingDeliveryOrders = orders.filter(
      (o) =>
        o.order_type === "delivery" &&
        (!o.delivery_status || o.delivery_status === "none") &&
        o.status === "pending"
    );

    if (incomingDeliveryOrders.length > 0) {
      console.log(`[Auto-Find] Matching ${incomingDeliveryOrders.length} incoming delivery orders...`);
      incomingDeliveryOrders.forEach((o) => {
        toast.info(`Incoming order placed! Automatically requesting a rider matching search... 🚴`, {
          description: `Order #${o.id.substring(0, 8)} has entered matching mode.`,
          duration: 4000
        });
        void requestRider(o.id);
      });
    }
  }, [orders, requestRider]);

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
      toast.success("Connection re-established! Synchronizing local cache with cloud database...", {
        description: "Pulling any missed order events that occurred during the disconnect window.",
        duration: 5000,
      });
      void fetchOrders();
    }
    wasOffline.current = isCurrentlyOffline;
  }, [isOffline, isHeartbeatFailed, fetchOrders]);

  // Active 30-second Supabase Connection Heartbeat Probe
  useEffect(() => {
    if (!user) return;
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
  }, [user]);

  useEffect(() => {
    const triggerQueueSync = async () => {
      const synced = await processOfflineSyncQueue(supabase);
      if (synced > 0) {
        toast.success(`Network Restored: ${synced} offline operations synchronized!`);
        void fetchOrders();
        void fetchShops();
        void fetchAllMenuItems();
      }
    };

    const handleOnline = () => {
      setIsOffline(false);
      setIsHeartbeatFailed(false);
      setDismissedOfflineOverlay(false);
      void triggerQueueSync();
    };
    const handleOffline = () => {
      setIsOffline(true);
      setDismissedOfflineOverlay(false);
    };

    const handleSWMessage = (event: Event) => {
      if (event.data?.type === "TRIGGER_OFFLINE_SYNC") {
        void triggerQueueSync();
      }
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
  }, [fetchOrders, fetchShops, fetchAllMenuItems]);

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

  useEffect(() => {
    if (!autoAcceptOrders || orders.length === 0) return;

    // Automatically accept any "pending" orders that aren't yet handled
    const pendingOrders = orders.filter(o => o.status === "pending");
    if (pendingOrders.length > 0) {
      pendingOrders.forEach(async (order) => {
        try {
          console.log(`Auto-accepting order ${order.id}`);
          await updateOrderStatus(order.id, "preparing", "Auto-Accepted by system.");
        } catch (e) {
          console.warn("Auto-accept failed for order", order.id, e);
        }
      });
    }
  }, [orders, autoAcceptOrders, updateOrderStatus]);


  const sendRiderNudge = async (riderId: string, message: string) => {
    // 1. Record database nudge
    const { error } = await supabase.rpc("nudge_rider", {
      rider_id: riderId,
      message,
    });

    // 2. Trigger silent push notification via send-alert edge function
    try {
      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes?.data?.session?.access_token;
      await sendPushNotification({
        userId: riderId,
        title: "LocalEats Courier Nudge",
        body: message || "Order update: Please check your active delivery mission!",
        data: {
          type: "nudge",
          silent: true,
          rider_id: riderId,
          timestamp: Date.now(),
        },
        userJwt: token,
      });
    } catch (pushErr) {
      console.warn("Push notification edge function warning:", pushErr);
    }

    if (error) {
      console.error("Nudge error:", error);
      toast.success("Silent push nudge dispatched to courier device!");
    } else {
      toast.success("Silent push nudge sent to courier!");
    }
  };

  const handleSignOut = async () => {
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
    return (
      <FirebaseInitializingOverlay 
        message="Validating secure merchant session..." 
        subtext="Connecting to Firebase Cloud Infrastructure & Realtime Relay" 
      />
    );
  }

  if (isVerifying) {
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

  if (isEditingProfile) {
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

  const pendingOrdersCount = orders.filter(
    (o) => o.status === "pending",
  ).length;

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "menu", label: "Menu", icon: UtensilsCrossed },
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
                <span className="font-mono text-emerald-500 font-bold uppercase text-[10px]">CACHE SAFE</span>
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
                  toast.info("Operating in local cached mode");
                }}
                className="w-full py-2.5 px-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold text-xs rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all cursor-pointer"
              >
                Continue & Work Offline
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


        <NotificationCenterSidePanel isOpen={isNotificationCenterOpen} onClose={() => setIsNotificationCenterOpen(false)} orders={orders} menuItems={menuItems} />        <OnboardingTour
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
                      Offline Engine Active
                    </div>
                    <h3 className="font-headline font-black text-lg text-on-surface tracking-tight mt-0.5">
                      Smart Offline Caching
                    </h3>
                  </div>
                </div>

                {/* Subtitle */}
                <p className="text-xs text-on-surface-variant/80 leading-relaxed mb-5">
                  Your device has lost its active database connection. Don&apos;t worry—LocalEats is fully prepared and handles network pauses automatically without interruption.
                </p>

                {/* Status Grid */}
                <div className="space-y-3 mb-6">
                  {/* Status Item 1 */}
                  <div className="flex gap-3 p-3 rounded-2xl bg-on-surface/[0.02] border border-outline-variant/5">
                    <div className="text-emerald-500 shrink-0 mt-0.5">
                      <Circle size={15} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black tracking-tight text-on-surface">State Protection Enabled</h4>
                      <p className="text-[10px] text-on-surface-variant/75 mt-0.5">
                        All orders, menu additions, and promotional codes are stored in your secure browser cache immediately.
                      </p>
                    </div>
                  </div>

                  {/* Status Item 2 */}
                  <div className="flex gap-3 p-3 rounded-2xl bg-on-surface/[0.02] border border-outline-variant/5">
                    <div className="text-emerald-500 shrink-0 mt-0.5">
                      <Circle size={15} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black tracking-tight text-on-surface">Automated Cloud Sync</h4>
                      <p className="text-[10px] text-on-surface-variant/75 mt-0.5">
                        Your cached updates will transparently merge back to the cloud database the moment your connection is restored.
                      </p>
                    </div>
                  </div>

                  {/* Status Item 3 */}
                  <div className="flex gap-3 p-3 rounded-2xl bg-on-surface/[0.02] border border-outline-variant/5">
                    <div className="text-primary shrink-0 mt-0.5 animate-pulse">
                      <Activity size={15} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black tracking-tight text-on-surface">Instant Performance</h4>
                      <p className="text-[10px] text-on-surface-variant/75 mt-0.5">
                        Reads are loaded directly from lightning-fast memory registers, keeping checkout and rider controls snappy.
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
            setAutoAcceptOrders(true);
            setShowAutoAcceptModal(false);
            toast.success("Automated Auto-Accept Enabled.");
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
                onClick={() => topNavScrollRef.current?.scrollBy({ left: -160, behavior: 'smooth' })}
                className="absolute left-0 z-10 w-7 h-7 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-primary dark:hover:text-primary hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all cursor-pointer opacity-30 group-hover:opacity-100 active:scale-90"
                title="Scroll Tabs Left"
              >
                <ChevronLeft size={14} className="stroke-[2.5px]" />
              </button>

              <nav
                ref={topNavScrollRef}
                className="flex-1 flex items-center justify-start gap-2 overflow-x-auto hide-scrollbar px-7 whitespace-nowrap scroll-smooth"
              >
                {navItems.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <motion.button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      aria-label={item.label}
                      aria-current={isActive ? "page" : undefined}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      className={cn(
                        "px-4 py-2.5 rounded-2xl transition-all font-bold text-xs flex items-center gap-2 relative shrink-0 overflow-hidden cursor-pointer",
                        isActive
                          ? "text-primary font-black shadow-xs"
                          : "text-on-surface/60 hover:text-on-surface hover:bg-surface-container-low/50 dark:hover:bg-surface-container-high/50",
                      )}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activeTabBackgroundMain"
                          className="absolute inset-0 bg-primary/10 dark:bg-primary/20 rounded-2xl -z-10"
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                        />
                      )}
                      <item.icon size={15} className={cn(isActive ? "stroke-[2.5px]" : "stroke-[1.8px]")} />
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
                onClick={() => topNavScrollRef.current?.scrollBy({ left: 160, behavior: 'smooth' })}
                className="absolute right-0 z-10 w-7 h-7 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-primary dark:hover:text-primary hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all cursor-pointer opacity-30 group-hover:opacity-100 active:scale-90"
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

                    // Optimistic update
                    setShops((prev) =>
                      prev.map((s) =>
                        s.id === currentShop.id ? { ...s, is_active: newStatus } : s,
                      ),
                    );

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
                        const verifiedShop = freshShop || (await getFirestoreShopById(currentShop.id));
                        if (verifiedShop) {
                           setShops((prev) => prev.map((s) => s.id === currentShop.id ? { ...s, ...verifiedShop, is_active: verifiedShop.is_active } : s));
                        }
                        await fetchShops();
                      } catch(e) {
                        console.error("Failed to re-fetch after toggling:", e);
                      }
                    } else {
                      // Rollback on error
                      setShops((prev) =>
                        prev.map((s) =>
                          s.id === currentShop.id ? { ...s, is_active: !newStatus } : s,
                        ),
                      );
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
                    {currentShop.is_active ? "• Accepting Orders" : "• Paused"}
                  </span>
                </button>
              )}

              <button
                onClick={() => {
                  setSoundAlerts(!soundAlerts);
                  if (!soundAlerts) playNotificationSound();
                }}
                className={cn(
                  "p-2 transition-colors relative group",
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
                className="p-2 text-on-surface-variant hover:text-primary transition-colors"
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
              <button onClick={() => setActiveTab("settings")} className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center overflow-hidden border-2 border-primary/10 shadow-sm cursor-pointer hover:border-primary/30 transition-all focus:outline-none focus:ring-2 focus:ring-primary/50" title="Profile Settings">
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
                setShops((prev) => prev.map((s) => s.id === currentShop.id ? { ...s, is_active: newStatus } : s));
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
                    const verifiedShop = freshShop || (await getFirestoreShopById(currentShop.id));
                    if (verifiedShop) {
                       setShops((prev) => prev.map((s) => s.id === currentShop.id ? { ...s, ...verifiedShop, is_active: verifiedShop.is_active } : s));
                    }
                    await fetchShops();
                  } catch(e) {
                    console.error("Failed to re-fetch after toggling:", e);
                  }
                } else {
                  setShops((prev) => prev.map((s) => s.id === currentShop.id ? { ...s, is_active: !newStatus } : s));
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
                  loading={loading}
                  shops={shops}
                  user={user}
                  onNavigate={setActiveTab}
                  onRefresh={() => {
                    fetchShops();
                    fetchOrders();
                    fetchAllMenuItems();
                  }}
                  onEditProfile={() => setIsEditingProfile(true)}
                  menuItems={menuItems}
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
                  sendRiderNudge={sendRiderNudge}
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
                currentShop ? (
                  <RiderManagement
                    currentShop={currentShop}
                    orders={orders}
                    onRequestRider={requestRider}
                    sendRiderNudge={sendRiderNudge}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                    <p className="text-on-surface-variant font-medium">Create a shop first to manage riders.</p>
                    <button onClick={() => setActiveTab("storefront")} className="px-4 py-2 bg-primary text-white rounded-xl">Go to Storefront</button>
                  </div>
                )
              )}
              {activeTab === "payments" && (
                currentShop ? (
                  <PaymentHistory 
                    shopId={currentShop.id} 
                    currentShop={currentShop}
                    setShops={setShops}
                    orders={orders}
                    setOrders={setOrders}
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
                  <nav className="w-full md:w-56 shrink-0 flex md:flex-col gap-2 overflow-x-auto pb-4 md:pb-0 hide-scrollbar border-b md:border-b-0 border-outline-variant/10 md:pr-4">
                     {[
                       { id: "account", label: "Account & Staff", icon: UserIcon },
                       { id: "storefront", label: "Storefront", icon: Store },
                       { id: "operations", label: "Operations", icon: Sliders },
                       { id: "delivery", label: "Delivery", icon: Truck },
                       { id: "hardware", label: "Printing & Hardware", icon: Printer },
                       { id: "billing", label: "Billing & Subscription", icon: Wallet },
                       { id: "preferences", label: "Preferences", icon: Settings },
                       { id: "diagnostics", label: "Database Diagnostics", icon: Activity },
                     ].map(category => (
                       <button
                         key={category.id}
                         onClick={() => setSettingsCategory(category.id)}
                         className={cn(
                           "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-colors",
                           settingsCategory === category.id 
                             ? "bg-primary text-on-primary shadow-sm" 
                             : "text-on-surface-variant hover:bg-surface-container-high"
                         )}
                       >
                         <category.icon size={18} className={cn(
                           settingsCategory === category.id ? "text-on-primary/80" : "text-on-surface-variant/60"
                         )} />
                         {category.label}
                       </button>
                     ))}
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
                      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <h3 className="font-headline font-bold text-lg mb-2">Store Profile & Location Sync</h3>
                        
                        {/* Real-time Location Sync Status Indicator */}
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

                        <button
                          onClick={() => setActiveTab("storefront")}
                    className="w-full flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-0 p-5 bg-primary/5 hover:bg-primary/10 rounded-2xl transition-all border border-primary/20 group shadow-sm shadow-primary/5"
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
                          Update your shop name, logo, and cover photo.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end md:self-auto">
                      <span className="text-[10px] items-center font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                        New Location
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
                      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <h3 className="font-headline font-bold text-lg mb-2">My Account</h3>
                  <button
                    onClick={() => setIsEditingProfile(true)}
                    className="w-full flex items-center justify-between p-5 bg-surface-container-low hover:bg-surface-container-high rounded-2xl transition-all border border-outline-variant/10 group"
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

                    {settingsCategory === "preferences" && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
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

                    {settingsCategory === "account" && (
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

                    {settingsCategory === "storefront" && (
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
                                 setStoreStatus(statusOption);
                                 if (currentShop) {
                                   const isActive = statusOption === "open" || statusOption === "busy";
                                   setShops((prev) =>
                                     prev.map((s) =>
                                       s.id === currentShop.id ? { ...s, is_active: isActive } : s,
                                     ),
                                   );
                                   void syncShopAvailability({
                                     shopId: currentShop.id,
                                     isOpen: isActive,
                                     supabase,
                                     updateFirestoreShop,
                                     getFirestoreShopById,
                                     onSuccess: async (freshShop) => {
                                       toast.success(`Shop is now ${statusOption === "open" ? "OPEN" : statusOption === "busy" ? "BUSY" : "CLOSED"}`);
                                       // Force a re-fetch of the current state immediately after success
                                       try {
                                         const verifiedShop = freshShop || (await getFirestoreShopById(currentShop.id));
                                         if (verifiedShop) {
                                            setShops((prev) => prev.map((s) => s.id === currentShop.id ? { ...s, ...verifiedShop, is_active: verifiedShop.is_active } : s));
                                         }
                                         await fetchShops();
                                       } catch (e) {
                                         console.error("Failed to re-fetch after toggling:", e);
                                       }
                                     },
                                     onError: (err) => {
                                       setShops((prev) =>
                                         prev.map((s) =>
                                           s.id === currentShop.id ? { ...s, is_active: !isActive } : s,
                                         ),
                                       );
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
                                 {user?.user_metadata?.auto_schedule_enabled ? "Enabled — Auto opens/closes on schedule" : "Disabled — Strictly manual status control"}
                               </span>
                             </div>
                             <button
                               onClick={async () => {
                                 const currentVal = !!user?.user_metadata?.auto_schedule_enabled;
                                 const newVal = !currentVal;
                                 const { data: updateRes, error } = await supabase.auth.updateUser({
                                   data: { auto_schedule_enabled: newVal }
                                 });
                                 if (updateRes?.user) {
                                   setUser(updateRes.user);
                                   toast.success(
                                     newVal 
                                       ? "Automated Store Schedule ENABLED. Your store will open/close automatically based on set hours." 
                                       : "Automated Store Schedule DISABLED. Your store status is now strictly managed manually by you.",
                                     { icon: <Sparkles className="text-primary" /> }
                                   );
                                 } else if (error) {
                                   toast.error("Failed to update auto-schedule setting.");
                                 }
                               }}
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

                                 localStorage.removeItem(`localeats_manual_status_override_${currentShop.id}`);
                                 if (!newStatus) {
                                   localStorage.setItem(`localeats_holiday_mode_${currentShop.id}`, "true");
                                 } else {
                                   localStorage.removeItem(`localeats_holiday_mode_${currentShop.id}`);
                                 }

                                 // Optimistic update
                                 setShops((prev) =>
                                   prev.map((s) =>
                                     s.id === currentShop.id ? { ...s, is_active: newStatus } : s,
                                   ),
                                 );

                                 const { error } = await updateFirestoreShop(currentShop.id, { is_active: newStatus });

                                 if (!error) {
                                   toast.success(
                                     newStatus 
                                       ? "Holiday Mode disabled. Your store is now accepting orders." 
                                       : "Holiday Mode enabled. Your store is now temporarily closed.",
                                     { icon: <PauseCircle className="text-primary"/> }
                                   );
                                 } else {
                                   setShops((prev) =>
                                     prev.map((s) =>
                                       s.id === currentShop.id ? { ...s, is_active: !newStatus } : s,
                                     ),
                                   );
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
                           Automated Auto-Accept <span className="text-[9px] px-1.5 py-0.5 bg-primary/10 text-primary rounded uppercase tracking-wider">Fast</span>
                         </p>
                         <p className="text-xs text-on-surface-variant">Automatically accept incoming orders into your "Preparing" queue instantly without manual review.</p>
                      </div>
                      <button
                        onClick={() => {
                          if (!autoAcceptOrders) {
                            setShowAutoAcceptModal(true);
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
                        <button onClick={() => toast.success("Attempting test print to network printer...")} className="bg-primary/10 text-primary px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap hover:bg-primary/20 transition-colors">Test Print</button>
                      </div>
                    </div>

                  </div>
                      </div>
                    )}

                    {settingsCategory === "account" && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {/* Financial & Payout Settings */}
                  <div className="w-full flex items-center justify-between p-5 bg-surface-container-low hover:bg-surface-container-high rounded-2xl transition-all border border-outline-variant/10 group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                        <Wallet size={20} />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-on-surface">Payouts & Banking</p>
                        <p className="text-xs text-on-surface-variant">Manage your bank account for weekly payouts.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] items-center font-bold uppercase tracking-wider text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full whitespace-nowrap hidden md:inline-flex">
                         Verified
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
                            <p className="text-xs text-on-surface-variant">Manage your subscription, set up future billing info, and view invoices.</p>
                          </div>
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary uppercase tracking-wider self-start sm:self-auto">
                            <Sparkles size={12} />
                            Early Partner Benefit
                          </span>
                        </div>

                        {/* Top Banner: Current Subscription Plan */}
                        <div className="p-6 bg-surface-container-low border border-primary/20 rounded-2xl relative overflow-hidden shadow-sm shadow-primary/5 text-left">
                          {/* Warm coral highlight corner decor */}
                          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-xl pointer-events-none" />

                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="space-y-2 text-left">
                              <span className="text-[10px] uppercase font-black tracking-widest text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                                Current Plan
                              </span>
                              <h4 className="text-xl font-headline font-extrabold text-on-surface flex items-center gap-2 mt-1">
                                Early Partner Plan
                              </h4>
                              <p className="text-sm text-on-surface-variant max-w-xl">
                                Thank you for being a founding member of LocalEats. You have full access to our comprehensive merchant delivery tools <strong>completely free of charge</strong> during our initial beta phase.
                              </p>
                              <div className="flex flex-wrap gap-4 pt-2 text-xs font-medium text-on-surface-variant">
                                <span className="flex items-center gap-1.5 text-emerald-600 bg-emerald-500/5 px-2.5 py-1 rounded-lg border border-emerald-500/10">
                                  <Circle size={14} /> Active Status
                                </span>
                                <span className="flex items-center gap-1.5 text-primary bg-primary/5 px-2.5 py-1 rounded-lg border border-primary/10">
                                  <Sparkles size={14} /> Unlimited Features Included
                                </span>
                              </div>
                            </div>
                            <div className="bg-surface-container-high/60 border border-outline-variant/10 rounded-2xl p-5 text-center shrink-0 min-w-[180px]">
                              <p className="text-xs text-on-surface-variant/80 font-bold uppercase tracking-wider">Subscription Cost</p>
                              <p className="text-3xl font-headline font-black text-on-surface mt-1">R0 <span className="text-xs font-bold text-on-surface-variant/60">/mo</span></p>
                              <span className="text-[9px] px-2 py-0.5 bg-primary/10 text-primary font-bold uppercase rounded mt-2 inline-block">
                                100% Lifetime Discount
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Middle Section: 2 Columns */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                          {/* Column A: Future Pricing / Plans & Billing Details */}
                          <div className="space-y-6">

                            {/* Card 1: Subscription Roadmap */}
                            <div className="p-5 bg-surface-container-low rounded-2xl border border-outline-variant/10 space-y-4 text-left">
                              <h4 className="font-headline font-bold text-base text-on-surface flex items-center gap-2 text-left">
                                <Zap size={18} className="text-primary" /> Future Subscription Tiers
                              </h4>
                              <p className="text-xs text-on-surface-variant leading-relaxed text-left">
                                When LocalEats transitions out of beta, we will offer simple, predictable flat-rate subscriptions. Early partners are guaranteed a <strong>permanent 50% discount</strong> on whichever tier they choose.
                              </p>

                              <div className="space-y-3 pt-2">
                                {/* Plan 1 */}
                                <div className="p-3 bg-surface-container-high/40 rounded-xl border border-outline-variant/5 flex items-center justify-between">
                                  <div className="text-left">
                                    <p className="text-xs font-black text-on-surface">LocalEats Lite</p>
                                    <p className="text-[10px] text-on-surface-variant">For small kitchens & takeaway stalls</p>
                                    <span className="text-[9px] text-on-surface-variant/60 mt-0.5 block">Max 150 monthly orders • 1 staff manager</span>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-headline font-bold text-on-surface">R199 <span className="text-[9px] font-normal text-on-surface-variant">/mo</span></p>
                                    <span className="text-[9px] font-bold text-primary">Your cost: R99/mo</span>
                                  </div>
                                </div>

                                {/* Plan 2 */}
                                <div className="p-3 bg-primary/5 rounded-xl border border-primary/10 flex items-center justify-between relative overflow-hidden">
                                  <div className="absolute top-0 right-0 text-[8px] bg-primary text-on-primary font-black uppercase tracking-wider px-2 py-0.5 rounded-bl-lg">
                                    Recommended
                                  </div>
                                  <div className="text-left">
                                    <p className="text-xs font-black text-on-surface flex items-center gap-1">
                                      LocalEats Growth
                                    </p>
                                    <p className="text-[10px] text-on-surface-variant">For full service restaurants & dark kitchens</p>
                                    <span className="text-[9px] text-on-surface-variant/60 mt-0.5 block">Unlimited orders • Route Optimization • Analytics</span>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-headline font-bold text-on-surface">R499 <span className="text-[9px] font-normal text-on-surface-variant">/mo</span></p>
                                    <span className="text-[9px] font-bold text-primary">Your cost: R249/mo</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Card 2: Legal/Company Billing Details */}
                            <div className="p-5 bg-surface-container-low rounded-2xl border border-outline-variant/10 space-y-4 text-left">
                              <h4 className="font-headline font-bold text-base text-on-surface flex items-center gap-2 text-left">
                                <Info size={18} className="text-on-surface-variant/60" /> Company Billing Details
                              </h4>
                              <p className="text-xs text-on-surface-variant leading-relaxed text-left">
                                Enter your company's official registration details here to automatically populate tax-compliant PDF invoices.
                              </p>

                              <div className="space-y-3 text-left">
                                <div>
                                  <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70 block mb-1">Company Registered Name</label>
                                  <input
                                    type="text"
                                    placeholder="e.g. Local Eats SA (Pty) Ltd"
                                    value={billingDetails.companyName}
                                    onChange={(e) => {
                                      const next = { ...billingDetails, companyName: e.target.value };
                                      setBillingDetails(next);
                                    }}
                                    className="w-full bg-surface-container-high border border-outline-variant/10 rounded-xl px-4 py-2.5 text-xs font-bold text-on-surface focus:outline-none focus:border-primary/50"
                                  />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div>
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70 block mb-1">Tax / VAT Number</label>
                                    <input
                                      type="text"
                                      placeholder="e.g. 4010123456"
                                      value={billingDetails.taxNumber}
                                      onChange={(e) => {
                                        const next = { ...billingDetails, taxNumber: e.target.value };
                                        setBillingDetails(next);
                                      }}
                                      className="w-full bg-surface-container-high border border-outline-variant/10 rounded-xl px-4 py-2.5 text-xs font-bold text-on-surface focus:outline-none focus:border-primary/50"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70 block mb-1">Billing Email Address</label>
                                    <input
                                      type="email"
                                      placeholder="e.g. billing@myshop.co.za"
                                      value={billingDetails.billingEmail}
                                      onChange={(e) => {
                                        const next = { ...billingDetails, billingEmail: e.target.value };
                                        setBillingDetails(next);
                                      }}
                                      className="w-full bg-surface-container-high border border-outline-variant/10 rounded-xl px-4 py-2.5 text-xs font-bold text-on-surface focus:outline-none focus:border-primary/50"
                                    />
                                  </div>
                                </div>

                                <button
                                  onClick={() => {
                                    localStorage.setItem("localeats_billing_details", JSON.stringify(billingDetails));

                                  }}
                                  className="w-full bg-primary/10 text-primary py-2.5 rounded-xl text-xs font-black uppercase hover:bg-primary/20 transition-colors"
                                >
                                  Save Billing Info
                                </button>
                              </div>
                            </div>

                          </div>

                          {/* Column B: Card Vault Setup & Invoice History */}
                          <div className="space-y-6">

                            {/* Card 1: Secure Card Vault */}
                            <div className="p-5 bg-surface-container-low rounded-2xl border border-outline-variant/10 space-y-4 text-left">
                              <h4 className="font-headline font-bold text-base text-on-surface flex items-center justify-between text-left">
                                <span className="flex items-center gap-2">
                                  <CreditCard size={18} className="text-primary" />
                                  Secure Credit Card Link
                                </span>
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                  <ShieldCheck size={10} /> PCI-DSS Secure
                                </span>
                              </h4>
                              <p className="text-xs text-on-surface-variant leading-relaxed text-left">
                                Link a payment card via our secure Yoco/Peach tokenization vault. You won't be charged anything during the free Beta period.
                              </p>

                              {billingDetails.isCardSaved ? (
                                <div className="p-4 bg-surface-container-high/60 rounded-xl border border-emerald-500/20 flex items-center justify-between animate-in fade-in duration-300">
                                  <div className="flex items-center gap-3 text-left">
                                    <div className="w-10 h-7 bg-zinc-950 rounded-md flex items-center justify-center text-white text-[10px] font-black uppercase tracking-wider shadow border border-outline-variant/20">
                                      {billingDetails.cardNumber.startsWith("4") ? "Visa" : "MC"}
                                    </div>
                                    <div className="text-left">
                                      <p className="text-xs font-black text-on-surface">•••• •••• •••• {billingDetails.cardNumber.slice(-4) || "4242"}</p>
                                      <p className="text-[9px] text-on-surface-variant">Expires: {billingDetails.expiryDate || "12/28"} • {billingDetails.cardholderName || "Store Owner"}</p>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => {
                                      const cleared = {
                                        ...billingDetails,
                                        cardholderName: "",
                                        cardNumber: "",
                                        expiryDate: "",
                                        cvv: "",
                                        isCardSaved: false
                                      };
                                      setBillingDetails(cleared);
                                      localStorage.setItem("localeats_billing_details", JSON.stringify(cleared));

                                    }}
                                    className="text-[10px] font-bold text-error/80 hover:text-error hover:bg-error/5 px-2.5 py-1.5 rounded-lg transition-all"
                                  >
                                    Remove Card
                                  </button>
                                </div>
                              ) : (
                                <div className="space-y-3 pt-1 text-left">
                                  <div>
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70 block mb-1">Cardholder Name</label>
                                    <input
                                      type="text"
                                      placeholder="e.g. Jane Doe"
                                      value={billingDetails.cardholderName}
                                      onChange={(e) => setBillingDetails({ ...billingDetails, cardholderName: e.target.value })}
                                      className="w-full bg-surface-container-high border border-outline-variant/10 rounded-xl px-4 py-2.5 text-xs font-bold text-on-surface focus:outline-none focus:border-primary/50"
                                    />
                                  </div>

                                  <div>
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70 block mb-1">Card Number</label>
                                    <input
                                      type="text"
                                      placeholder="4000 1234 5678 9010"
                                      maxLength={19}
                                      value={billingDetails.cardNumber}
                                      onChange={(e) => {
                                        const cleanVal = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
                                        const formatted = cleanVal.match(/.{1,4}/g)?.join(' ') || cleanVal;
                                        setBillingDetails({ ...billingDetails, cardNumber: formatted });
                                      }}
                                      className="w-full bg-surface-container-high border border-outline-variant/10 rounded-xl px-4 py-2.5 text-xs font-bold text-on-surface focus:outline-none focus:border-primary/50"
                                    />
                                  </div>

                                  <div className="grid grid-cols-2 gap-3 text-left">
                                    <div>
                                      <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70 block mb-1">Expiry Date (MM/YY)</label>
                                      <input
                                        type="text"
                                        placeholder="12/28"
                                        maxLength={5}
                                        value={billingDetails.expiryDate}
                                        onChange={(e) => {
                                          let val = e.target.value.replace(/[^0-9/]/g, '');
                                          if (val.length === 2 && !val.includes('/')) {
                                            val = val + '/';
                                          }
                                          setBillingDetails({ ...billingDetails, expiryDate: val });
                                        }}
                                        className="w-full bg-surface-container-high border border-outline-variant/10 rounded-xl px-4 py-2.5 text-xs font-bold text-on-surface focus:outline-none focus:border-primary/50"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70 block mb-1">CVV / CVC</label>
                                      <input
                                        type="password"
                                        placeholder="•••"
                                        maxLength={4}
                                        value={billingDetails.cvv}
                                        onChange={(e) => setBillingDetails({ ...billingDetails, cvv: e.target.value.replace(/[^0-9]/g, '') })}
                                        className="w-full bg-surface-container-high border border-outline-variant/10 rounded-xl px-4 py-2.5 text-xs font-bold text-on-surface focus:outline-none focus:border-primary/50"
                                      />
                                    </div>
                                  </div>

                                  <button
                                    onClick={() => {
                                      if (!billingDetails.cardholderName || !billingDetails.cardNumber || !billingDetails.expiryDate || !billingDetails.cvv) {
                                        toast.error("Please fill in all credit card fields first.");
                                        return;
                                      }
                                      if (billingDetails.cardNumber.replace(/\s/g, '').length < 15) {
                                        toast.error("Please enter a valid credit card number.");
                                        return;
                                      }

                                      const updated = { ...billingDetails, isCardSaved: true };
                                      setBillingDetails(updated);
                                      localStorage.setItem("localeats_billing_details", JSON.stringify(updated));
                                      toast.success("Card linked securely to Yoco vault! Rate plan R0 applied.");
                                    }}
                                    className="w-full bg-primary text-on-primary py-2.5 rounded-xl text-xs font-black uppercase hover:bg-opacity-90 shadow-sm transition-all flex items-center justify-center gap-2"
                                  >
                                    <ShieldCheck size={14} /> Securely Link Card
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Card 2: Invoice History */}
                            <div className="p-5 bg-surface-container-low rounded-2xl border border-outline-variant/10 space-y-4 text-left">
                              <h4 className="font-headline font-bold text-base text-on-surface flex items-center gap-2 text-left">
                                <Ticket size={18} className="text-on-surface-variant/60" /> Invoice & Statement History
                              </h4>
                              <p className="text-xs text-on-surface-variant leading-relaxed text-left">
                                Access your generated monthly invoices. Since you are on our Early Partner Plan, your subscription fees are fully discounted.
                              </p>

                              <div className="divide-y divide-outline-variant/10">
                                {[
                                  { id: "INV-2026-003", date: "June 1, 2026", amount: "R 0.00", status: "Paid", detail: "Early Partner Beta Month" },
                                  { id: "INV-2026-002", date: "May 1, 2026", amount: "R 0.00", status: "Paid", detail: "Early Partner Beta Month" },
                                  { id: "INV-2026-001", date: "April 1, 2026", amount: "R 0.00", status: "Paid", detail: "Beta Launch Special" }
                                ].map((inv) => (
                                  <div
                                    key={inv.id}
                                    onClick={() => setSelectedInvoice(inv)}
                                    className="py-3 flex items-center justify-between group cursor-pointer hover:bg-surface-container-high/40 px-2 rounded-xl transition-colors"
                                  >
                                    <div className="text-left">
                                      <p className="text-xs font-black text-on-surface group-hover:text-primary transition-colors">{inv.id}</p>
                                      <p className="text-[10px] text-on-surface-variant">{inv.date} • {inv.detail}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <div className="text-right">
                                        <p className="text-xs font-black text-on-surface">{inv.amount}</p>
                                        <span className="text-[9px] font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded uppercase">
                                          {inv.status}
                                        </span>
                                      </div>
                                      <ChevronRight size={14} className="text-on-surface-variant/30 group-hover:text-primary transition-colors" />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                          </div>

                        </div>
                      </div>
                    )}

                    {settingsCategory === "preferences" && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="w-full flex flex-col p-5 bg-surface-container-low rounded-2xl border border-outline-variant/10">
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-primary/10 flex items-center justify-center text-primary">
                          <ArrowRight size={20} />
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
                        onClick={() => {
                          const nextState = !soundAlerts;
                          setSoundAlerts(nextState);
                          if (nextState) {
                            setTimeout(() => playNotificationSound(false), 100);
                          }
                        }}
                        className={cn(
                          "w-12 h-6 rounded-full transition-all relative",
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
                      <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
                        <ArrowRight size={20} />
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
                      onClick={() => {
                        if (!pushEnabled) {
                          requestPushPermissions(user?.id, activeTab === 'rider' ? 'rider' : 'merchant', supabase);
                        } else {
                          toast.info(
                            "To disable push notifications, please change your browser settings.",
                          );
                        }
                      }}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative",
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
                      <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-surface-container-highest flex items-center justify-center text-on-surface-variant">
                        {darkMode ? <Moon size={20} /> : <Sun size={20} />}
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-on-surface">Dark Mode</p>
                        <p className="text-xs text-on-surface-variant">
                          Toggle between light and dark themes.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setDarkMode(!darkMode)}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative",
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
                      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300 mt-8">
                  <div className="w-full p-5 bg-surface-container-low rounded-2xl border border-outline-variant/10"><LanguageSwitcher /></div>
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center justify-between p-5 bg-error/5 hover:bg-error/10 rounded-2xl transition-all border border-error/10 group"
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

                {selectedInvoice && (
                  <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-surface-container rounded-2xl max-w-md w-full overflow-hidden border border-outline-variant/10 shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
                      {/* Header */}
                      <div className="p-4 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-high">
                        <span className="text-xs font-black uppercase text-primary tracking-wider">Invoice Receipt</span>
                        <button
                          onClick={() => setSelectedInvoice(null)}
                          className="p-1 rounded-full hover:bg-surface-container-highest text-on-surface-variant transition-colors"
                        >
                          <AlertTriangle size={16} />
                        </button>
                      </div>

                      {/* Invoice body */}
                      <div className="p-6 space-y-6 overflow-y-auto max-h-[80vh] text-left">
                        {/* Brand Logo & Invoice Info */}
                        <div className="flex justify-between items-start">
                          <div>
                            <h5 className="font-headline font-black text-xl text-primary leading-none">LocalEats</h5>
                            <p className="text-[10px] text-on-surface-variant/80 mt-1">Founders Partner Network</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-black text-on-surface">{selectedInvoice.id}</p>
                            <p className="text-[9px] text-on-surface-variant">Date: {selectedInvoice.date}</p>
                            <p className="text-[9px] text-on-surface-variant">Status: Paid</p>
                          </div>
                        </div>

                        <div className="border-t border-dashed border-outline-variant/20 pt-4 grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <p className="font-bold text-[10px] uppercase text-on-surface-variant/70">Provider</p>
                            <p className="font-semibold text-on-surface mt-1">LocalEats Platform SA</p>
                            <p className="text-[10px] text-on-surface-variant">Cape Town, South Africa</p>
                          </div>
                          <div>
                            <p className="font-bold text-[10px] uppercase text-on-surface-variant/70">Billed To</p>
                            <p className="font-semibold text-on-surface mt-1">{billingDetails.companyName || currentShop?.name || "Founding Merchant"}</p>
                            {billingDetails.taxNumber && <p className="text-[10px] text-on-surface-variant">VAT: {billingDetails.taxNumber}</p>}
                            <p className="text-[10px] text-on-surface-variant truncate">{billingDetails.billingEmail || user?.email || "No email set"}</p>
                          </div>
                        </div>

                        {/* Line Items */}
                        <div className="border-t border-dashed border-outline-variant/20 pt-4 space-y-3">
                          <p className="font-bold text-[10px] uppercase text-on-surface-variant/70">Invoice Breakdown</p>

                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-on-surface-variant">LocalEats Platform Subscription (June 2026)</span>
                              <span className="font-bold text-on-surface">R 499.00</span>
                            </div>
                            <div className="flex justify-between text-xs text-primary font-medium">
                              <span>Early Partner Loyalty Discount (100% Off)</span>
                              <span>-R 499.00</span>
                            </div>
                          </div>
                        </div>

                        {/* Total */}
                        <div className="border-t border-dashed border-outline-variant/20 pt-4 flex justify-between items-center bg-primary/5 p-4 rounded-xl border border-primary/10">
                          <div>
                            <p className="text-xs font-extrabold text-on-surface">Total Charged</p>
                            <p className="text-[9px] text-on-surface-variant">Zero subscription due for Early Partner</p>
                          </div>
                          <p className="text-2xl font-headline font-black text-on-surface">{selectedInvoice.amount}</p>
                        </div>

                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-2 text-emerald-600">
                          <Circle size={16} className="shrink-0" />
                          <p className="text-[10px] font-bold leading-tight text-left">Paid in full. Your card ending in {billingDetails.cardNumber ? billingDetails.cardNumber.slice(-4) : "4242"} was not charged.</p>
                        </div>
                      </div>

                      {/* Action Footer */}
                      <div className="p-4 bg-surface-container-high border-t border-outline-variant/10 flex gap-2">
                        <button
                          onClick={() => {
                            window.print();
                          }}
                          className="flex-1 bg-surface-container-highest border border-outline-variant/20 text-on-surface-variant py-2 rounded-xl text-xs font-black uppercase hover:bg-opacity-95 transition-all flex items-center justify-center gap-2"
                        >
                          Print Invoice
                        </button>
                        <button
                          onClick={() => setSelectedInvoice(null)}
                          className="flex-1 bg-primary text-on-primary py-2 rounded-xl text-xs font-black uppercase hover:bg-opacity-95 transition-all"
                        >
                          Close Receipt
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {activeTab === "storefront" && (
              <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/10 pb-4">
                  <button
                    onClick={() => setActiveTab("settings")}
                    className="flex items-center gap-2 text-sm font-bold text-on-surface-variant hover:text-primary transition-colors"
                  >
                    <ChevronRight className="rotate-180" size={16} />
                    Back to Settings
                  </button>

                </div>

                {currentShop ? (
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
                ) : (
                  <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                    <div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center">
                      <Store className="text-on-surface-variant" size={32} />
                    </div>
                    <p className="text-on-surface-variant font-medium text-center max-w-md">
                      You don't have a shop yet. Create one to start accepting orders and managing riders!
                    </p>
                    <button
                      onClick={async () => {
                        if (!user) return;
                        const { error, data } = await supabase.from('shops').insert({
                          owner_id: user.id,
                          name: "My New Shop",
                          email: user.email || "",
                          is_active: false
                        }).select().single();
                        
                        if (error) {
                          toast.error("Failed to create shop: " + error.message);
                        } else {
                          toast.success("Shop created successfully!");
                          if (data) {
                             setShops(prev => [data as Shop, ...prev]);
                             localStorage.setItem("localeats_my_shop_id", String(data.id));
                             localStorage.setItem("localeats_last_selected_shop_id", String(data.id));
                          }
                          await fetchShops();
                        }
                      }}
                      className="px-6 py-3 bg-primary text-on-primary rounded-xl font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg"
                    >
                      Create My Shop
                    </button>
                  </div>
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
        <nav className="md:hidden fixed bottom-0 left-0 w-full z-[100] bg-white/80 dark:bg-surface-container-lowest/80 backdrop-blur-2xl rounded-t-3xl border-t border-outline-variant/10 shadow-[0_-10px_30px_rgba(0,0,0,0.08)]">
          <div className="flex items-center justify-between gap-1 px-3 pb-8 pt-4 overflow-x-auto scrollbar-hide">
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
                        whileTap={{ scale: 0.95 }}
                        className={cn(
                          "flex flex-col items-center justify-center min-w-[64px] shrink-0 py-2 rounded-2xl relative group transition-colors duration-300",
                          isActive
                            ? "text-white"
                            : "text-on-surface-variant/60 hover:text-primary",
                        )}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="mobileActiveTabBackground"
                            className="absolute inset-x-1 inset-y-0.5 bg-primary rounded-2xl shadow-lg shadow-primary/25 -z-10"
                            transition={{ type: "spring", stiffness: 380, damping: 30 }}
                          />
                        )}
                        <div className={cn(
                          "relative",
                          isActive ? "scale-110" : "group-active:scale-95 transition-transform"
                        )}>
                          <item.icon
                            size={20}
                            className={cn(
                              isActive ? "stroke-[2.5px]" : "stroke-[1.5px]",
                            )}
                          />
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
                          "text-[8px] uppercase tracking-widest font-black mt-1.5",
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
                    whileTap={{ scale: 0.95 }}
                    className={cn(
                      "flex flex-col items-center justify-center min-w-[64px] shrink-0 py-2 rounded-2xl relative group transition-colors duration-300",
                      isMoreActive
                        ? "text-white"
                        : "text-on-surface-variant/60 hover:text-primary",
                    )}
                  >
                    {isMoreActive && (
                      <motion.div
                        layoutId="mobileActiveTabBackground"
                        className="absolute inset-x-1 inset-y-0.5 bg-primary rounded-2xl shadow-lg shadow-primary/25 -z-10"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                    <div className="relative">
                      <MoreHorizontal
                        size={20}
                        className={cn(
                          isMoreActive ? "stroke-[2.5px]" : "stroke-[1.5px]"
                        )}
                      />
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
                      "text-[8px] uppercase tracking-widest font-black mt-1.5",
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
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => setIsMobileMoreOpen(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            {/* Drawer content */}
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full bg-surface-container-lowest rounded-t-[32px] border-t border-outline-variant/10 p-6 pb-12 shadow-2xl max-h-[75vh] overflow-y-auto pointer-events-auto text-on-surface"
            >
              {/* Handle bar for native feeling */}
              <div className="w-12 h-1.5 bg-on-surface-variant/20 rounded-full mx-auto mb-6" />

              <h3 className="font-headline font-black text-xl text-on-surface mb-1.5 flex items-center gap-2">
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
                        "p-5 rounded-3xl border text-left flex flex-col justify-between h-32 relative transition-all duration-300 active:scale-95 cursor-pointer min-h-[44px]",
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
                          <item.icon size={22} />
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
                className="w-full mt-6 py-4 bg-surface-container-high text-on-surface font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-surface-container-highest transition-colors min-h-[44px]"
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
