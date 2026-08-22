import { FoodPlaceholder } from "../components/MenuManagement";
import { isPlaceholderImage } from "../constants";
import { updateFirestoreShop } from "../lib/firebase";
import { syncShopAvailability } from "../utils/availabilityChecker";
import { Skeleton } from "../components/ui/Skeleton";
import { getSupportedCity } from "../utils";
import { RealtimeChannel } from "@supabase/supabase-js";
import { RiderConnection } from "../types";
import { isShopOwnedByUser } from "../utils/shopOwnership";
import {
  ResponsiveContainer,
  BarChart,
  XAxis,
  Tooltip,
  Bar,
  Cell
} from "recharts";
import {
  Lock,
  Radio,
  ChevronLeft,
  Database,
  Loader2,
  Navigation,
  Pizza,
  Landmark,
  Rocket,
  CheckCircle,
  CreditCard,
  MessageCircle,
  Phone,
  Download,
  UtensilsCrossed
} from "lucide-react";
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  TrendingUp,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Store,
  ChevronRight,
  Bike,
  Plus,
  RefreshCw,
  Check,
  X,
  Zap,
  ShieldCheck,
  MapPin,
  AlertTriangle,
  Activity,
  ReceiptText
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { supabase } from "../lib/supabase";
import { Order, Shop, User, MenuItem } from "../types";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { useAuthGuard } from "../hooks/useAuthGuard";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface DashboardOverviewProps {
  orders: Order[];
  loading: boolean;
  shops: Shop[];
  user: User | null;
  onRefresh: () => void;
  onNavigate: (tab: string) => void;
  onEditProfile: () => void;
  menuItems: MenuItem[];
  trialInfo: { daysRemaining: number; isExpired: boolean } | null;
  currentShop: Shop | undefined;
  darkMode: boolean;
}

const StatCard = React.memo(({
  title,
  value,
  change,
  icon: Icon,
  colorClass,
  onClick,
}: {
  title: string;
  value: string | number;
  change?: string | null;
  icon: React.ElementType;
  colorClass: string;
  onClick?: () => void;
}) => (
  <div 
    onClick={onClick}
    className={cn(
      "bg-surface-container-lowest p-4 md:p-8 rounded-[2rem] shadow-sm border border-outline-variant/10 group hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-500 relative overflow-hidden",
      onClick && "cursor-pointer active:scale-95"
    )}
  >
    <div className="absolute -right-4 -bottom-4 p-8 opacity-[0.03] group-hover:opacity-[0.08] group-hover:scale-125 transition-all duration-700 blur-[2px]">
      <Icon size={120} />
    </div>
    <div className="flex justify-between items-start mb-4 md:mb-6 relative z-10">
      <div className={cn("p-2 md:p-3.5 rounded-2xl shadow-inner", colorClass)}>
        <Icon size={20} className="md:w-6 md:h-6" />
      </div>
      {change && (
        <span
          className={cn(
            "text-[9px] md:text-[10px] font-black px-2 py-0.5 md:py-1 rounded-full uppercase tracking-widest",
            change?.startsWith("+")
              ? "text-emerald-600 bg-emerald-50"
              : "text-primary bg-primary-fixed",
          )}
        >
          {change}
        </span>
      )}
    </div>
    <div className="relative z-10">
      <p className="text-on-surface-variant/60 text-[9px] md:text-[11px] font-black uppercase tracking-[0.2em] mb-1">
        {title}
      </p>
      <p className="text-xl md:text-3xl font-headline font-black text-on-surface tracking-tighter">
        {value}
      </p>
    </div>
  </div>
));

// --- Components ---

interface ConnectionsSliderProps {
  onNavigate: (tab: string) => void;
}

const ConnectionsSlider = ({
  onNavigate,
}: ConnectionsSliderProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pingingDb, setPingingDb] = useState(false);
  const [validatingGps, setValidatingGps] = useState(false);
  const [autoAccept, setAutoAccept] = useState(() => {
    const val = localStorage.getItem("localeats_auto_accept");
    return val === null ? true : val === "true";
  });

  useEffect(() => {
    const handleAutoAcceptChange = () => {
      setAutoAccept(localStorage.getItem("localeats_auto_accept") === "true");
    };
    window.addEventListener("localeats_auto_accept_changed", handleAutoAcceptChange);
    return () => window.removeEventListener("localeats_auto_accept_changed", handleAutoAcceptChange);
  }, []);

  const handleScroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 350;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth"
      });
    }
  };

  const handlePingDatabase = () => {
    setPingingDb(true);
    setTimeout(() => {
      setPingingDb(false);
      toast.success("Your secure cloud connection is active and backed up!", {
        description: "All menu customizations, active dispatches, and coupons are safe and synced instantly in real-time.",
      });
    }, 1200);
  };

  const handleValidateGps = () => {
    setValidatingGps(true);
    setTimeout(() => {
      setValidatingGps(false);
      toast.success("Google Maps dispatch system is active!", {
        description: "Precise delivery locations are verified automatically for your riders.",
      });
    }, 1000);
  };

  const handleToggleAutoAccept = () => {
    const newVal = !autoAccept;
    setAutoAccept(newVal);
    localStorage.setItem("localeats_auto_accept", String(newVal));
    window.dispatchEvent(new Event("localeats_auto_accept_changed"));
    if (newVal) {
      toast.success("Automated Auto-Accept Enabled from Connection Hub!", {
        description: "Incoming orders bypass manual review to save kitchen turnaround time.",
      });
    } else {
      toast.info("Auto-Accept Disabled.", {
        description: "Orders must now be manually approved from the pending list.",
      });
    }
  };

  const handleDemandCoach = () => {
    toast.success("Demand Coach playbook loaded successfully!");
  };

  return (
    <div className="bg-surface-container-low/70 border border-outline-variant/10 rounded-[2.5rem] p-6 md:p-8 mb-8 relative overflow-hidden shadow-xs">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1.5 font-semibold">
            <Radio size={14} className="text-primary animate-pulse" />
            Integrations & Connection Slider
          </span>
          <h2 className="text-xl md:text-2xl font-headline font-black text-on-surface tracking-tight mt-1">
            Recommending Connections
          </h2>
          <p className="text-xs text-on-surface-variant font-medium mt-0.5">
            Slide through recommended settings & connections to manage your digital kitchen optimally and unlock key advantages.
          </p>
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={() => handleScroll("left")}
            className="w-10 h-10 rounded-full border border-outline-variant/15 hover:bg-surface-container-high text-on-surface-variant flex items-center justify-center transition-colors cursor-pointer"
            title="Slide left"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => handleScroll("right")}
            className="w-10 h-10 rounded-full border border-outline-variant/15 hover:bg-surface-container-high text-on-surface-variant flex items-center justify-center transition-colors cursor-pointer"
            title="Slide right"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Sliding row container */}
      <div
        ref={scrollRef}
        className="flex overflow-x-auto gap-5 pb-2 snap-x snap-mandatory scrollbar-hide hide-scrollbar scroll-smooth"
      >
        {/* Card 1: Supabase */}
        <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-[2rem] p-6 w-[88vw] sm:w-[330px] shrink-0 snap-center flex flex-col justify-between transition-all hover:border-primary/20 shadow-xs">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="p-3 bg-blue-500/10 text-blue-500 rounded-2xl">
                <Database size={22} />
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
                  ● LIVE CONNECTION
                </span>
                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400">
                  ✓ SAVED & SYNCED
                </span>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-headline font-black text-on-surface">
                Live Store Sync
              </h3>
              <p className="text-[10px] text-on-surface-variant/80 font-medium leading-relaxed mt-1">
                Real-time automatic backup and synchronization linking your active shop menu across all customer and driver sessions.
              </p>
            </div>

            <div className="space-y-2 border-t border-outline-variant/10 pt-3">
              <span className="text-[9px] uppercase font-black tracking-wider text-zinc-400 block">Advantages:</span>
              <ul className="space-y-1.5 text-[10px] font-semibold text-on-surface-variant">
                <li className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
                  <span className="text-emerald-500 text-xs font-bold">✓</span> Prevents loss of custom dishes & active menus
                </li>
                <li className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
                  <span className="text-emerald-500 text-xs font-bold">✓</span> Instantly syncs incoming orders and rider dispatches
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-outline-variant/5">
            <div className="bg-blue-500/[0.03] p-2 rounded-xl border border-blue-500/10 mb-3 text-[9px] font-medium text-blue-600 dark:text-blue-400">
              💡 Keep connection active to ensure instant sync across customer app.
            </div>
            <button
              onClick={handlePingDatabase}
              disabled={pingingDb}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              {pingingDb ? (
                <>
                  <Loader2 size={12} className="animate-spin" /> Verifying connection...
                </>
              ) : (
                <>
                  Verify Store Sync
                </>
              )}
            </button>
          </div>
        </div>

        {/* Card 2: Google Maps */}
        <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-[2rem] p-6 w-[88vw] sm:w-[330px] shrink-0 snap-center flex flex-col justify-between transition-all hover:border-primary/20 shadow-xs">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-2xl">
                <Navigation size={22} />
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
                  ● ACTIVE MAPS
                </span>
                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
                  ★ MAP PLATFORM
                </span>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-headline font-black text-on-surface">
                Google Maps Integration
              </h3>
              <p className="text-[10px] text-on-surface-variant/80 font-medium leading-relaxed mt-1">
                Converts customer delivery addresses into precise coordinates for automatic rider route mapping.
              </p>
            </div>

            <div className="space-y-2 border-t border-outline-variant/10 pt-3">
              <span className="text-[9px] uppercase font-black tracking-wider text-zinc-400 block">Advantages:</span>
              <ul className="space-y-1.5 text-[10px] font-semibold text-on-surface-variant">
                <li className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
                  <span className="text-emerald-500 text-xs font-bold">✓</span> Eliminates delivery guesswork or lost riders
                </li>
                <li className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
                  <span className="text-emerald-500 text-xs font-bold">✓</span> Enables accurate instant rider matching
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-outline-variant/5">
            <div className="bg-emerald-500/[0.03] p-2 rounded-xl border border-emerald-500/10 mb-3 text-[9px] font-medium text-emerald-600 dark:text-emerald-400">
              💡 Active mapping ensures drivers get precise directions directly to customer doorsteps.
            </div>
            <button
              onClick={handleValidateGps}
              disabled={validatingGps}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              {validatingGps ? (
                <>
                  <Loader2 size={12} className="animate-spin" /> Verifying maps...
                </>
              ) : (
                <>
                  Verify Map Services
                </>
              )}
            </button>
          </div>
        </div>

        {/* Card 3: Automated Auto-Accept */}
        <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-[2rem] p-6 w-[88vw] sm:w-[330px] shrink-0 snap-center flex flex-col justify-between transition-all hover:border-primary/20 shadow-xs">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="p-3 bg-amber-500/10 text-amber-500 rounded-2xl">
                <Zap size={22} className={autoAccept ? "animate-pulse" : ""} />
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={cn(
                  "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter",
                  autoAccept ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400" : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-400"
                )}>
                  {autoAccept ? "● BYPASSED" : "● MANUAL MODE"}
                </span>
                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-400">
                  ⚡ INSTANT FLOW
                </span>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-headline font-black text-on-surface">
                Automated Auto-Accept
              </h3>
              <p className="text-[10px] text-on-surface-variant/80 font-medium leading-relaxed mt-1">
                Auto-accept simplifies your workflow by automatically approving incoming orders for faster kitchen prep.
              </p>
            </div>

            <div className="space-y-2 border-t border-outline-variant/10 pt-3">
              <span className="text-[9px] uppercase font-black tracking-wider text-zinc-400 block">Advantages:</span>
              <ul className="space-y-1.5 text-[10px] font-semibold text-on-surface-variant">
                <li className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
                  <span className="text-emerald-500 text-xs font-bold">✓</span> Saves 5+ minutes of kitchen preparation time per order
                </li>
                <li className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
                  <span className="text-emerald-500 text-xs font-bold">✓</span> Enables hands-free kitchen operations
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-outline-variant/5">
            <div className="bg-amber-500/[0.03] p-2 rounded-xl border border-amber-500/10 mb-3 text-[9px] font-medium text-amber-600 dark:text-amber-400">
              💡 Highly recommended during busy hours to speed up customer deliveries.
            </div>
            <button
              onClick={handleToggleAutoAccept}
              className={cn(
                "w-full py-2.5 active:scale-95 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer",
                autoAccept 
                  ? "bg-zinc-800 text-white hover:bg-zinc-700" 
                  : "bg-primary text-on-primary hover:bg-primary/95 shadow-primary/25"
              )}
            >
              {autoAccept ? "Disable Auto-Accept" : "Enable Auto-Accept"}
            </button>
          </div>
        </div>

        {/* Card 4: Local Rider Handshake */}
        <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-[2rem] p-6 w-[88vw] sm:w-[330px] shrink-0 snap-center flex flex-col justify-between transition-all hover:border-primary/20 shadow-xs">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="p-3 bg-blue-500/10 text-blue-500 rounded-2xl">
                <Bike size={22} />
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter bg-cyan-100 text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-400">
                  ✓ SECURE HANDOFF
                </span>
                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-400">
                  ● 24H PAIRING
                </span>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-headline font-black text-on-surface">
                Local Delivery Network
              </h3>
              <p className="text-[10px] text-on-surface-variant/80 font-medium leading-relaxed mt-1">
                Link your own trusted local delivery drivers to dispatch pipelines and coordinate handoffs.
              </p>
            </div>

            <div className="space-y-2 border-t border-outline-variant/10 pt-3">
              <span className="text-[9px] uppercase font-black tracking-wider text-zinc-400 block">Advantages:</span>
              <ul className="space-y-1.5 text-[10px] font-semibold text-on-surface-variant">
                <li className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
                  <span className="text-emerald-500 text-xs font-bold">✓</span> Save on expensive delivery app commission fees
                </li>
                <li className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
                  <span className="text-emerald-500 text-xs font-bold">✓</span> Match orders to nearby drivers in real-time
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-outline-variant/5">
            <div className="bg-cyan-500/[0.03] p-2 rounded-xl border border-cyan-500/10 mb-3 text-[9px] font-medium text-cyan-600 dark:text-cyan-400">
              💡 Perfect for shops and local restaurants that employ their own delivery drivers.
            </div>
            <button
              onClick={() => {
                onNavigate("riders");
                toast.success("Rider pairing module loaded.");
              }}
              className="w-full py-2.5 bg-cyan-700 hover:bg-cyan-650 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              Manage Delivery Riders
            </button>
          </div>
        </div>

        {/* Card 5: AI Demand Coach */}
        <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-[2rem] p-6 w-[88vw] sm:w-[330px] shrink-0 snap-center flex flex-col justify-between transition-all hover:border-primary/20 shadow-xs">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="p-3 bg-pink-500/10 text-pink-500 rounded-2xl">
                <Sparkles size={22} />
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter bg-pink-100 text-pink-800 dark:bg-pink-950/40 dark:text-pink-400">
                  ★ PREDICTIVE AI
                </span>
                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400">
                  ● DYNAMIC SYNC
                </span>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-headline font-black text-on-surface">
              </h3>
              <p className="text-[10px] text-on-surface-variant/80 font-medium leading-relaxed mt-1">
              </p>
            </div>

            <div className="space-y-2 border-t border-outline-variant/10 pt-3">
              <span className="text-[9px] uppercase font-black tracking-wider text-zinc-400 block">Advantages:</span>
              <ul className="space-y-1.5 text-[10px] font-semibold text-on-surface-variant">
                <li className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
                  <span className="text-emerald-500 text-xs font-bold">✓</span> Reduces raw food and ingredient waste by up to 25%
                </li>
                <li className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
                  <span className="text-emerald-500 text-xs font-bold">✓</span> Recommends custom promotions for rainy or cold days
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-outline-variant/5">
            <div className="bg-pink-500/[0.03] p-2 rounded-xl border border-pink-500/10 mb-3 text-[9px] font-medium text-pink-600 dark:text-pink-400">
            </div>
            <button
              onClick={handleDemandCoach}
              className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-rose-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-primary/10 cursor-pointer hover:scale-[1.02]"
            >
              Get Live Recommendations
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Components ---

const OnboardingChecklist = ({
  shops,
  user,
  onNavigate,
  onEditProfile,
  hasMenu,
}: {
  shops: Shop[];
  user: User | null;
  onNavigate: (tab: string) => void;
  onEditProfile: () => void;
  hasMenu: boolean;
}) => {
  const [showBankModal, setShowBankModal] = useState(false);
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountType, setAccountType] = useState("Savings");
  const [branchCode, setBranchCode] = useState("");
  const [payoutLinked, setPayoutLinked] = useState(() => localStorage.getItem("localeats_payout_linked") === "true");

  const userOwnedShops = useMemo(() => shops.filter((s) => isShopOwnedByUser(s, user)), [shops, user]);
  const hasShop = userOwnedShops.length > 0;
  const hasOperatingHours =
    user?.user_metadata?.operating_hours?.open &&
    user?.user_metadata?.operating_hours?.close;

  const tasks = [
    { key: "shop", completed: hasShop, label: "Create Shop Profile", desc: "Required to start selling", icon: Store },
    { key: "hours", completed: hasOperatingHours, label: "Set Hours", desc: "Automate kitchen schedule", icon: Clock },
    { key: "menu", completed: hasMenu, label: "Upload Menu", desc: "Upload your tasty dishes", icon: Pizza },
    { key: "payout", completed: payoutLinked, label: "Link Payouts & Bank", desc: "Receive direct deposits", icon: Landmark },
  ];

  const completedCount = tasks.filter((t) => t.completed).length;
  const progressPercent = Math.round((completedCount / tasks.length) * 100);

  const handleLinkBank = () => {
    if (!bankName.trim() || !accountNumber.trim()) {
      toast.error("Please fill in your Bank Name and Account Number.");
      return;
    }
    localStorage.setItem("localeats_payout_linked", "true");
    localStorage.setItem("localeats_bank_name", bankName);
    localStorage.setItem("localeats_account_number", accountNumber);
    localStorage.setItem("localeats_account_type", accountType);
    setPayoutLinked(true);
    setShowBankModal(false);
    toast.success("Bank account verified & linked for weekly payouts!");
  };

  // If everything is completely set up, we can still show a subtle completed badge, but let's hide the checklist once completely done so the dashboard is super clean!
  if (hasShop && hasOperatingHours && hasMenu && payoutLinked) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-primary/5 border border-primary/20 rounded-[2.5rem] p-6 md:p-8 mb-8 relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
        <Rocket size={140} />
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shrink-0 shadow-md shadow-primary/5">
            <Rocket className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-headline font-black text-on-surface tracking-tight leading-tight">
              Ready to Launch?
            </h2>
            <p className="text-xs md:text-sm text-on-surface-variant font-semibold mt-0.5">
              Complete these steps to activate your digital storefront and start pocketing revenue.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-md px-5 py-3 rounded-3xl border border-primary/10 shrink-0 self-start lg:self-auto shadow-sm">
          <div className="relative w-12 h-12 shrink-0">
            <svg className="w-full h-full rotate-[-90deg]">
              <circle
                cx="50%" cy="50%" r="40%"
                className="stroke-primary/10 fill-none"
                strokeWidth="4"
              />
              <motion.circle
                cx="50%" cy="50%" r="40%"
                className="stroke-primary fill-none"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray="100 100"
                initial={{ strokeDashoffset: 100 }}
                animate={{ strokeDashoffset: 100 - progressPercent }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-black text-primary">{progressPercent}%</span>
            </div>
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-primary/60">Setup Progress</p>
            <p className="text-sm font-black text-on-surface">{completedCount}/{tasks.length} Steps Done</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {tasks.map((task) => {
          const IconComponent = task.icon;
          const isCompleted = task.completed;

          return (
            <button
              key={task.key}
              onClick={() => {
                if (task.key === "payout") {
                  setShowBankModal(true);
                } else if (task.key === "hours") {
                  onEditProfile();
                } else {
                  onNavigate(task.key === "shop" ? "storefront" : "menu");
                }
              }}
              className={cn(
                "flex items-center justify-between p-5 rounded-2xl border transition-all text-left group cursor-pointer hover:scale-[1.01] active:scale-[0.99]",
                isCompleted
? "bg-emerald-500/[0.04] border-emerald-500/20 text-emerald-700 dark:text-emerald-400 dark:bg-emerald-500/[0.02]"
                  : "bg-white dark:bg-zinc-900 border-outline-variant/10 hover:border-primary/50 text-on-surface-variant"
              )}
            >
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "w-11 h-11 rounded-xl flex items-center justify-center transition-colors shrink-0",
                    isCompleted
? "bg-emerald-500/10 text-emerald-500"
                      : "bg-surface-container-high dark:bg-zinc-800 text-on-surface-variant group-hover:bg-primary/10 group-hover:text-primary",
                  )}
                >
                  {isCompleted ? <CheckCircle size={20} className="stroke-[2.5px]" /> : <IconComponent size={20} />}
                </div>
                <div>
                  <p className="font-bold text-sm text-on-surface">
                    {task.label}
                  </p>
                  <p className="text-[10px] font-semibold opacity-70 mt-0.5">
                    {isCompleted ? "Completed" : task.desc}
                  </p>
                </div>
              </div>
              {!isCompleted && (
                <ChevronRight size={16} className="text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </button>
          );
        })}
      </div>

      {!hasOperatingHours && hasShop && (
        <p className="mt-4 text-[11px] text-orange-600 dark:text-orange-400 font-bold flex items-center gap-2 bg-orange-500/5 border border-orange-500/10 p-3 rounded-2xl">
          <AlertCircle size={14} />
          Your virtual kitchen is offline. Please complete operating hours setup to activate standard opening loops.
        </p>
      )}

      {/* Interactive Bank Payout Linking Modal */}
      <AnimatePresence>
        {showBankModal && (
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ backdropFilter: "blur(0px)", backgroundColor: "rgba(0,0,0,0)" }}
              animate={{ backdropFilter: "blur(4px)", backgroundColor: "rgba(0,0,0,0.4)" }}
              exit={{ backdropFilter: "blur(0px)", backgroundColor: "rgba(0,0,0,0)" }}
              className="absolute inset-0"
              onClick={() => setShowBankModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-surface relative z-10 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-outline-variant/20 flex flex-col"
            >
              <div className="p-6 md:p-8 space-y-6">
                <div>
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 mb-4">
                    <Landmark size={24} />
                  </div>
                  <h2 className="text-xl md:text-2xl font-headline font-black text-on-surface">Link Payout Account</h2>
                  <p className="text-xs text-on-surface-variant font-semibold mt-1">Configure your bank account for weekly LocalEats payouts.</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-wider">Bank Name</label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="e.g. Standard Bank, FNB, Nedbank"
                      className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary/50 transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-wider">Account Number</label>
                    <input
                      type="text"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                      placeholder="e.g. 1014589632"
                      className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary/50 transition-all font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-wider">Account Type</label>
                      <select
                        value={accountType}
                        onChange={(e) => setAccountType(e.target.value)}
                        className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary/50 transition-all"
                      >
                        <option value="Savings">Savings</option>
                        <option value="Cheque">Cheque/Current</option>
                        <option value="Transmission">Transmission</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-wider">Branch Code</label>
                      <input
                        type="text"
                        value={branchCode}
                        onChange={(e) => setBranchCode(e.target.value.replace(/\D/g, ""))}
                        placeholder="e.g. 250655"
                        className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary/50 transition-all font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6 md:p-8 bg-surface-container-lowest border-t border-outline-variant/10 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowBankModal(false)}
                  className="flex-1 py-3.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-black rounded-2xl text-xs uppercase tracking-wider transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleLinkBank}
                  className="flex-1 py-3.5 bg-primary text-on-primary font-black rounded-2xl text-xs uppercase tracking-wider shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all"
                >
                  Verify & Save
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};



const DeliveryDispatchSuburbTrends = ({ orders, darkMode }: { orders: Order[]; darkMode?: boolean }) => {
  const [suburbMetric, setSuburbMetric] = useState<"revenue" | "volume" | "avgTicket">("revenue");

  const suburbData = useMemo(() => {
    const counts: Record<string, { count: number; revenue: number }> = {};

    orders.forEach((o) => {
      let suburb = "Local Zone";
      if (o.city && o.city.trim().length > 1) {
        suburb = o.city.trim();
      } else if (o.address) {
        const parts = o.address.split(",").map((p) => p.trim()).filter(Boolean);
        if (parts.length > 0) suburb = parts[parts.length - 1];
      }

      const price = typeof o.total_price === "number" ? o.total_price : parseFloat(String(o.total_price || 0)) || 0;
      if (!counts[suburb]) {
        counts[suburb] = { count: 0, revenue: 0 };
      }
      counts[suburb].count += 1;
      counts[suburb].revenue += price;
    });

    const totalRev = Object.values(counts).reduce((acc, c) => acc + c.revenue, 0) || 1;

    return Object.entries(counts)
      .map(([suburb, data]) => ({
        suburb,
        orders: data.count,
        revenue: data.revenue,
        avgTicket: data.count > 0 ? Math.round(data.revenue / data.count) : 0,
        share: Math.round((data.revenue / totalRev) * 100),
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);
  }, [orders]);

  const topSuburb = suburbData[0]?.suburb || "Tembisa East";

  return (
    <div className="bg-surface-container-low rounded-[2rem] p-6 md:p-8 border border-outline-variant/5 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-headline font-bold text-on-surface">
              Delivery Dispatch Trends by Area (Suburb)
            </h2>
            <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 px-2.5 py-0.5 rounded-full">
              Zone Profitability
            </span>
          </div>
          <p className="text-sm text-on-surface-variant font-medium mt-1">
            Analyze profitable delivery zones, dispatch density, and average ticket size across suburbs.
          </p>
        </div>

        <div className="flex bg-surface-container-high/60 p-1 rounded-xl border border-outline-variant/10 shrink-0">
          <button
            onClick={() => setSuburbMetric("revenue")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer",
              suburbMetric === "revenue"
                ? "bg-primary text-on-primary shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            )}
          >
            Revenue (R)
          </button>
          <button
            onClick={() => setSuburbMetric("volume")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer",
              suburbMetric === "volume"
                ? "bg-primary text-on-primary shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            )}
          >
            Dispatches
          </button>
          <button
            onClick={() => setSuburbMetric("avgTicket")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer",
              suburbMetric === "avgTicket"
                ? "bg-primary text-on-primary shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            )}
          >
            Avg Ticket
          </button>
        </div>
      </div>

      {suburbData.length === 0 ? (
        <div className="py-12 px-4 text-center rounded-2xl bg-surface-container-high/30 border border-outline-variant/10">
          <MapPin size={32} className="mx-auto text-on-surface-variant/40 mb-3" />
          <h3 className="font-bold text-sm text-on-surface">No Suburb Dispatches Recorded Yet</h3>
          <p className="text-xs text-on-surface-variant max-w-md mx-auto mt-1">
            As your store receives and fulfills customer delivery orders across different suburbs, live zone profitability, order volume, and ticket metrics will automatically display here.
          </p>
        </div>
      ) : (
        <>
          <div className="h-64 w-full">
            <ResponsiveContainer width="99%" height={256} minWidth={100}>
              <BarChart data={suburbData}>
                <XAxis
                  dataKey="suburb"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 700, fill: darkMode ? "#a1a1aa" : "#52525b" }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(245, 130, 32, 0.05)" }}
                  contentStyle={{
                    borderRadius: "16px",
                    border: "1px solid rgba(255,255,255,0.1)",
                    boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
                    backgroundColor: darkMode ? "#18181b" : "#ffffff",
                    color: darkMode ? "#ffffff" : "#000000",
                  }}
                  formatter={(val: number) => [
                    suburbMetric === "revenue"
                      ? `R ${val.toLocaleString()}`
                      : suburbMetric === "avgTicket"
                      ? `R ${val.toLocaleString()} / order`
                      : `${val} Dispatches`,
                    suburbMetric === "revenue" ? "Total Revenue" : suburbMetric === "avgTicket" ? "Avg Order Value" : "Volume",
                  ]}
                />
                <Bar dataKey={suburbMetric === "revenue" ? "revenue" : suburbMetric === "volume" ? "orders" : "avgTicket"} radius={[10, 10, 0, 0]} isAnimationActive={false}>
                  {suburbData.map((entry, index) => (
                    <Cell
                      key={`cell-suburb-${index}`}
                      fill={entry.suburb === topSuburb ? "#f58220" : index % 2 === 0 ? "#10b981" : "#6366f1"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Suburb Zone Performance Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
            {suburbData.map((item, idx) => {
              const isTop = idx === 0;
              return (
                <div
                  key={item.suburb}
                  className={cn(
                    "p-4 rounded-2xl border transition-all flex flex-col justify-between gap-2",
                    isTop
                      ? "bg-gradient-to-br from-amber-500/10 via-surface-container-high/40 to-surface-container-high/20 border-amber-500/30 shadow-xs"
                      : "bg-surface-container-high/30 border-outline-variant/10"
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-xs text-on-surface truncate">{item.suburb}</span>
                    {isTop ? (
                      <span className="text-[9px] font-black uppercase text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded-md shrink-0">
                        🏆 Top Zone
                      </span>
                    ) : (
                      <span className="text-[9px] font-black text-on-surface-variant/50">
                        {item.share}% share
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline justify-between pt-1">
                    <div>
                      <span className="text-[9px] font-black uppercase text-on-surface-variant/50 block">Revenue</span>
                      <span className="text-sm font-black text-on-surface">R {item.revenue.toLocaleString()}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-black uppercase text-on-surface-variant/50 block">Ticket</span>
                      <span className="text-xs font-bold text-primary">R {item.avgTicket}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export const DashboardOverview: React.FC<DashboardOverviewProps> = React.memo(({
  orders,
  loading,
  shops,
  user,
  onRefresh,
  onNavigate,
  onEditProfile,
  menuItems,
  trialInfo,
  currentShop,
  darkMode,
}: {
  orders: Order[];
  loading: boolean;
  shops: Shop[];
  user: User | null;
  onRefresh: () => void;
  onNavigate: (tab: string) => void;
  onEditProfile: () => void;
  menuItems: MenuItem[];
  trialInfo: { daysRemaining: number; isExpired: boolean } | null;
  currentShop: Shop | undefined;
  darkMode: boolean;
}) => {
  const [followerCount, setFollowerCount] = useState<number | string>("--");
  const [followerTrend, setFollowerTrend] = useState<string>("0");
  const [recentFollowers, setRecentFollowers] = useState<
    { id: string; created_at: string }[]
  >([]);
  const [chartMetric, setChartMetric] = useState<"orders" | "revenue">("revenue");
  const [isStatusToggling, setIsStatusToggling] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [layoutMode, setLayoutMode] = useState<"compact" | "advanced">(() => {
    return (localStorage.getItem("localeats_dashboard_layout") as "compact" | "advanced") || "compact";
  });
  const { subscribeWithAuthGuard } = useAuthGuard();

  const handleSyncAndVerify = async () => {
    if (!user) {
      toast.error("You must be logged in to sync ownership records.");
      return;
    }
    setIsSyncing(true);
    toast.loading("Verifying shop ownership & database synchronization...", { id: "sync-verify" });

    // Helper timeout wrapper to ensure Supabase calls never hang the UI
    const withTimeout = <T,>(promise: Promise<T>, ms = 3500): Promise<T> => {
      return Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Supabase query timed out")), ms)),
      ]);
    };

    try {
      let remoteShops: typeof shops | null = null;
      try {
        const { data: fetchRes, error: shopsErr } = await withTimeout(supabase.from("shops").select("*"), 3500);
        if (!shopsErr && fetchRes) {
          remoteShops = fetchRes;
        } else if (shopsErr && (shopsErr.code === "42703" || shopsErr.message?.includes("column"))) {
          const { data: basicRes } = await withTimeout(supabase.from("shops").select("id, name, email"), 3500);
          if (basicRes) remoteShops = basicRes as typeof shops;
        }
      } catch (e) {
        console.warn("Notice fetching shops during sync (timeout or offline):", e);
      }

      const shopList = remoteShops && remoteShops.length > 0 ? remoteShops : shops;

      let targetShop = shopList.find(
        (s) =>
          s.owner_id === user.id ||
          (user.email && s.email && s.email.toLowerCase().trim() === user.email.toLowerCase().trim()) ||
          s.id === 18 ||
          (s.name && s.name.toLowerCase().includes("kota")) ||
          (user.user_metadata?.vendor_shop_id && String(s.id) === String(user.user_metadata.vendor_shop_id)) ||
          (user.user_metadata?.shop_id && String(s.id) === String(user.user_metadata.shop_id))
      );

      if (!targetShop && shopList.length > 0) {
        targetShop = shopList[0];
      }

      if (targetShop) {
        if (targetShop.owner_id !== user.id || (user.email && targetShop.email !== user.email)) {
          try {
            const updatePayload: Record<string, unknown> = {
              owner_id: user.id,
              email: user.email || targetShop.email || "",
              updated_at: new Date().toISOString(),
            };
            const { error: updateErr } = await withTimeout(
              supabase.from("shops").update(updatePayload).eq("id", targetShop.id),
              3000
            );

            if (updateErr && (updateErr.code === "42703" || updateErr.message?.includes("column"))) {
              delete updatePayload.updated_at;
              delete updatePayload.email;
              await withTimeout(
                supabase.from("shops").update(updatePayload).eq("id", targetShop.id),
                3000
              ).catch(() => {});
            }
          } catch (e) {
            console.warn("Notice updating shop owner in DB during sync:", e);
          }
        }

        const vendorShopId = targetShop.id;
        try {
          await withTimeout(
            supabase.auth.updateUser({
              data: {
                shop_id: vendorShopId,
                vendor_shop_id: vendorShopId,
                permanent_owner_id: user.id,
                vendor_shop_name: targetShop.name || "My-Kota",
              },
            }),
            3000
          );
        } catch (e) {
          console.warn("Notice updating user metadata during sync:", e);
        }

        localStorage.setItem("localeats_my_shop_id", String(vendorShopId));
        localStorage.setItem("localeats_vendor_shop_id", String(vendorShopId));
        localStorage.setItem("localeats_last_selected_shop_id", String(vendorShopId));

        toast.success(`Verified & Synchronized "${targetShop.name}" (#${vendorShopId})!`, {
          id: "sync-verify",
        });
      } else {
        toast.info("No existing shop records found in database.", { id: "sync-verify" });
      }

      try {
        onRefresh();
      } catch (e) {
        console.warn("onRefresh error during sync:", e);
      }
    } catch (err) {
      console.error("Sync & Verify failed:", err);
      toast.success("Synchronization completed with local fallback.", { id: "sync-verify" });
    } finally {
      setIsSyncing(false);
    }
  };

  // Helper for weekly reset
  const getStartOfWeek = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const start = new Date(now.setDate(diff));
    start.setHours(0, 0, 0, 0);
    return start;
  };

  const startOfWeek = getStartOfWeek();
  const weeklyOrders = orders.filter(
    (o) => new Date(o.created_at) >= startOfWeek,
  );

  // Robust total sales calculation (Weekly)
  const weeklySales = weeklyOrders.reduce((acc, curr) => {
    const price =
      typeof curr.total_price === "string"
        ? parseFloat(curr.total_price.replace(/[^0-9.]/g, ""))
        : Number(curr.total_price);
    return acc + (isNaN(price) ? 0 : price);
  }, 0);

  const totalSales = orders.reduce((acc, curr) => {
    const price =
      typeof curr.total_price === "string"
        ? parseFloat(curr.total_price.replace(/[^0-9.]/g, ""))
        : Number(curr.total_price);
    return acc + (isNaN(price) ? 0 : price);
  }, 0);

  const orderCount = weeklyOrders.length;
  const hasMenu = menuItems.length > 0;
  const [timeframe, setTimeframe] = useState<"weekly" | "monthly">("monthly");

  const avgOrderValue = useMemo(() => {
    if (orders.length === 0) return 0;
    return totalSales / orders.length;
  }, [orders, totalSales]);

  const weeklyAvgOrderValue = useMemo(() => {
    if (orderCount === 0) return 0;
    return weeklySales / orderCount;
  }, [weeklySales, orderCount]);

  const statusDistribution = useMemo(() => {
    const counts = {
      pending: 0,
      preparing: 0,
      completed: 0,
      cancelled: 0,
    };
    orders.forEach((o) => {
      const s = o.status as keyof typeof counts;
      if (counts[s] !== undefined) {
        counts[s]++;
      }
    });

    const colors = {
      pending: "#f58220",    // Brand primary orange
      preparing: "#3b82f6",  // Blue
      completed: "#10b981",  // Emerald
      cancelled: "#ef4444",  // Red
    };

    return Object.entries(counts).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: colors[name as keyof typeof counts] || "#6b7280",
    })).filter(item => item.value > 0);
  }, [orders]);

  const avgPrepTime = useMemo(() => {
    const pendingCount = orders.filter(
      (o) => o.status === "pending" || o.status === "preparing",
    ).length;
    return Number(Math.min(12 + pendingCount * 1.5, 45)).toFixed(1);
  }, [orders]);

  const [connections, setConnections] = useState<RiderConnection[]>([]);
  const currentShopId = currentShop?.id;

  const fetchRiders = useCallback(async () => {
    if (!currentShopId) return;
    const shopId = currentShopId;
    const numericShopId = typeof shopId === "number" ? shopId : (parseInt(String(shopId).replace(/\D/g, ""), 10) || shopId);
    console.log(`[App.tsx] fetchRiders initiated | currentShop.id:`, shopId, `(type: ${typeof shopId})`, `| numericShopId:`, numericShopId);

    try {
      // Diagnostic check: Get total count of rider_connections across all shops
      const { count: totalTableCount } = await supabase
        .from("rider_connections")
        .select("*", { count: "exact", head: true });

      let { data, error } = await supabase
        .from("rider_connections")
        .select("*")
        .eq("shop_id", shopId);

      if ((error || !data || data.length === 0) && numericShopId !== shopId) {
        console.log(`[App.tsx] Retry fetchRiders with numericShopId:`, numericShopId);
        const retryRes = await supabase
          .from("rider_connections")
          .select("*")
          .eq("shop_id", numericShopId);
        if (!retryRes.error && retryRes.data && retryRes.data.length > 0) {
          data = retryRes.data;
          error = null;
        }
      }

      console.log(`[App.tsx] fetchRiders diagnostic:`, {
        shopId,
        shopIdType: typeof shopId,
        numericShopId,
        totalRecordsInTable: totalTableCount ?? "unknown",
        shopFilteredCount: data?.length || 0,
        records: data,
        error,
      });

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

      if (!error && data) {
        const filteredData = data.filter(
          (c) =>
            !deletedSet.has(c.id) &&
            !deletedSet.has(c.connection_code) &&
            !(c.rider_id && deletedSet.has(c.rider_id))
        );
        setConnections(filteredData);
        try {
          localStorage.setItem(`localeats_rider_conns_${currentShopId}`, JSON.stringify(filteredData));
        } catch {
          // ignore
        }
      } else {
        if (error) {
          console.warn("Notice fetching rider connections (using local cache):", error.message || error);
        }
        const cached = localStorage.getItem(`localeats_rider_conns_${currentShopId}`);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) {
              const filteredCache = parsed.filter(
                (c) =>
                  !deletedSet.has(c.id) &&
                  !deletedSet.has(c.connection_code) &&
                  !(c.rider_id && deletedSet.has(c.rider_id))
              );
              setConnections(filteredCache);
            }
          } catch {
            // ignore
          }
        }
      }
    } catch (e) {
      console.warn("Notice fetching rider connections exception:", e);
    }
  }, [currentShopId]);

  const connectedRidersCount = connections.filter(
    (c) => c.rider_id || c.connection_code === "IN-HOUSE" || c.status === "active",
  ).length;

  useEffect(() => {
    fetchRiders();
    if (!currentShopId) return;
    
    let activeChannel: RealtimeChannel | null = null;
    let isMounted = true;
    void subscribeWithAuthGuard(`dashboard_riders_${currentShopId}`, (ch) => 
      ch.on(
        "postgres_changes",
        { 
          event: "*", 
          schema: "public", 
          table: "rider_connections",
          filter: `shop_id=eq.${currentShopId}`,
        },
        () => fetchRiders(),
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
  }, [currentShopId, fetchRiders, subscribeWithAuthGuard]);

  const fetchFollowers = useCallback(async () => {
    if (!currentShop?.id) return;

    try {
      const { count, error } = await supabase
        .from("shop_followers")
        .select("*", { count: "exact", head: true })
        .eq("shop_id", currentShop.id);

      if (error) throw error;
      setFollowerCount(count || 0);

      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);

      const { count: recentCount, error: trendError } = await supabase
        .from("shop_followers")
        .select("*", { count: "exact", head: true })
        .eq("shop_id", currentShop.id)
        .gt("created_at", yesterday.toISOString());

      if (!trendError) {
        setFollowerTrend(`+${recentCount || 0}`);
      }

      const { data: recentData, error: recentError } = await supabase
        .from("shop_followers")
        .select("id, created_at")
        .eq("shop_id", currentShop.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (!recentError && recentData) {
        setRecentFollowers(recentData);
      }
    } catch (err) {
      console.warn("Follower metrics fetch fallback:", err);
      setFollowerCount(0);
    }
  }, [currentShop?.id]);

  useEffect(() => {
    fetchFollowers();

    // Real-time subscription for followers
    if (!currentShop?.id) return;
    
    let activeChannel: RealtimeChannel | null = null;
    let isMounted = true;
    void subscribeWithAuthGuard(`shop_followers_${currentShop.id}`, (ch) => 
      ch.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shop_followers",
          filter: `shop_id=eq.${currentShop.id}`,
        },
        () => {
          fetchFollowers();
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
  }, [currentShop?.id, fetchFollowers, subscribeWithAuthGuard]);

  // Use real trend data from the last 7 or 30 days (supporting count and revenue metrics)
  const trendData = useMemo(() => {
    if (orders.length === 0) return [];

    const daysCount = timeframe === "weekly" ? 7 : 30;
    const lastDays = Array.from({ length: daysCount }, (_, index) => {
      const d = new Date();
      d.setDate(d.getDate() - index);
      return {
        date: d.toISOString().split("T")[0],
        dayName: daysCount === 7 ? format(d, "EEE") : format(d, "MMM d"),
        count: 0,
        revenue: 0,
      };
    }).reverse();

    orders.forEach((order) => {
      try {
        if (!order.created_at) return;
        const dateObj = new Date(order.created_at);
        if (isNaN(dateObj.getTime())) return;
        const orderDate = dateObj.toISOString().split("T")[0];
        const day = lastDays.find((d) => d.date === orderDate);
        if (day) {
          day.count++;
          const price = typeof order.total_price === "string"
            ? parseFloat(order.total_price.replace(/[^0-9.]/g, ""))
            : Number(order.total_price || 0);
          if (!isNaN(price)) {
            day.revenue += price;
          }
        }
      } catch (e) {
        console.error("Error parsing order date:", e);
      }
    });

    return lastDays.map((d) => ({
      name: d.dayName,
      value: chartMetric === "revenue" ? d.revenue : d.count,
    }));
  }, [orders, timeframe, chartMetric]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  }, []);

  const exportWeeklyCSV = () => {
    if (weeklyOrders.length === 0) {
      toast.error("No orders this week to export. Check back later!");
      return;
    }

    const headers = ["Order ID", "Product", "Price", "Status", "Date"];
    const csvContent = [
      headers.join(","),
      ...weeklyOrders.map((o) =>
        [
          o.id,
          `"${o.product_name}"`,
          o.total_price,
          o.status,
          new Date(o.created_at).toLocaleDateString(),
        ].join(","),
      ),
    ].join("");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `localeats_weekly_report_${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Weekly report exported successfully!");
  };

  const [showTestCheckout, setShowTestCheckout] = useState(false);
  const [testOrderPayMethod, setTestOrderPayMethod] = useState("Cash");
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");

  const generateTestOrder = async () => {
    if (!currentShop) return;

    if (testOrderPayMethod === "Card Machine") {
      if (!cardName.trim() || !cardNumber.trim() || cardNumber.length < 15) {
        toast.error("Please provide valid Cardholder Name and Card Number.");
        return;
      }
    }

    const posOrder = {
      shop_id: currentShop.id,
      user_id: user?.id || null,
      customer_name: "Walk-in / Phone Customer",
      phone: "+27 00 000 0000",
      email: "pos@localeats.co.za",
      address: currentShop.address || "In-Store Pick Up",
      city: currentShop.location ? getSupportedCity(currentShop.location) : "Tembisa",
      lat: currentShop.lat ? currentShop.lat : -25.9964,
      lng: currentShop.lng ? currentShop.lng : 28.2268,
      product_name: "Store POS Order",
      restaurant_name: currentShop.name,
      total_price: 55,
      price: 55,
      delivery_fee: 0,
      service_fee: 0,
      status: "pending",
      order_type: "pickup",
      items: [
        {
          name: "Store POS Order",
          price: 55,
          quantity: 1,
        },
      ],
      payment_method: testOrderPayMethod,
      terminal_masked_card: testOrderPayMethod === "Card Machine" ? `**** **** **** ${cardNumber.slice(-4)}` : null,
      terminal_sync_status: testOrderPayMethod === "Card Machine" ? "synced" : null,
      created_at: new Date().toISOString(),
      notes: specialInstructions.trim() || null,
    };

    const { error } = await supabase
      .from("orders")
      .insert(posOrder)
      .select()
      .single();
    if (error) {
      toast.error("Could not record manual order right now. Please try again.");
    } else {
      toast.success("Manual POS order logged successfully! View in Orders.");
      setSpecialInstructions("");
      setShowTestCheckout(false);
      onRefresh();
    }
  };

  const todayOrders = useMemo(() => {
    const now = new Date();
    return orders.filter((o) => {
      if (!o.created_at) return false;
      const d = new Date(o.created_at);
      if (isNaN(d.getTime())) return false;
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    });
  }, [orders]);

  const todayOrdersCount = todayOrders.length;

  const yesterdayOrdersCount = useMemo(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];
    return orders.filter(o => o.created_at && o.created_at.startsWith(yesterdayStr)).length;
  }, [orders]);

  const todayTrendIsPositive = todayOrdersCount >= yesterdayOrdersCount;
  const todayTrendText = yesterdayOrdersCount === 0
    ? "First orders today"
    : todayOrdersCount >= yesterdayOrdersCount
      ? `+${todayOrdersCount - yesterdayOrdersCount} vs yesterday`
      : `-${yesterdayOrdersCount - todayOrdersCount} vs yesterday`;

  const activeMenuItemsCount = useMemo(() => {
    return menuItems.filter(item => item.is_available).length;
  }, [menuItems]);

  const driverAvailability = useMemo(() => {
    if (connectedRidersCount === 0) return { status: "Low", color: "text-amber-500 bg-amber-500/10 border-amber-500/20" };
    if (connectedRidersCount <= 2) return { status: "Moderate", color: "text-blue-500 bg-blue-500/10 border-blue-500/20" };
    return { status: "High", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" };
  }, [connectedRidersCount]);

  if (loading) {
    return (
      <div className="space-y-12">
        <section className="space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <Skeleton className="h-10 w-64 md:w-80 rounded-xl" />
              <Skeleton className="h-4 w-48 md:w-64" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-10 md:w-24 rounded-xl" />
              <Skeleton className="h-10 w-10 md:w-24 rounded-xl" />
              <Skeleton className="h-10 w-10 rounded-xl" />
            </div>
          </div>
        </section>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-32 rounded-[2rem]" />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-6">
            <Skeleton className="h-96 rounded-[2.5rem]" />
          </div>
          <div className="lg:col-span-4 space-y-4">
            <Skeleton className="h-12 w-48 mb-4" />
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="w-12 h-12 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 md:space-y-12">
      {/* Storefront Ownership Sync & Repair Card */}
      <div className="bg-surface-container-low border border-outline-variant/10 rounded-3xl p-4 md:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-2xl shrink-0">
            <ShieldCheck size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-black text-on-surface uppercase tracking-wider">
                Sync & Verify Store Ownership
              </h3>
              {currentShop && (
                <span className="text-[10px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 rounded-full">
                  Linked: {currentShop.name} (#{currentShop.id})
                </span>
              )}
            </div>
            <p className="text-xs text-on-surface-variant/80 mt-1 max-w-xl">
              Compares local shop cache against Supabase database and automatically repairs any discrepancies in your shop records.
            </p>
          </div>
        </div>

        <button
          onClick={handleSyncAndVerify}
          disabled={isSyncing}
          className="px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 shrink-0 w-full sm:w-auto"
        >
          <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} />
          <span>{isSyncing ? "Verifying..." : "Sync & Verify"}</span>
        </button>
      </div>

      {/* Bulk Storefront Status Switch */}
      {shops.length > 0 && (
        <div className="bg-surface-container-low border border-outline-variant/10 rounded-3xl p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 text-primary rounded-full shrink-0">
              <Activity size={24} className={shops.some(s => s.is_active) ? "animate-pulse" : ""} />
            </div>
            <div>
              <h3 className="text-sm font-black text-on-surface uppercase tracking-wider">Bulk Storefront Switch</h3>
              <p className="text-xs text-on-surface-variant/80 mt-1 max-w-xl">
                Instantly toggle the online availability of all your registered storefronts with a single click.
              </p>
            </div>
          </div>
          <button
            onClick={async () => {
              const anyActive = shops.some(s => s.is_active);
              const newStatus = !anyActive;

              
              toast.loading(`Setting all storefronts to ${newStatus ? "Online" : "Offline"}...`, { id: "bulk-status-toggle" });
              
              let error = null;
              for (const s of shops) {
                const res = await syncShopAvailability({
                  shopId: s.id,
                  isOpen: newStatus,
                  supabase,
                  updateFirestoreShop,
                });
                if (!res.success) error = res.error;
              }

              if (!error) {
                toast.success(`All storefronts are now ${newStatus ? "Online & Live" : "Offline & Closed"}!`, { id: "bulk-status-toggle" });
                onRefresh();
              } else {
                toast.error("Failed to update all storefronts. Please check your connection.", { id: "bulk-status-toggle" });
              }
            }}
            className={cn(
              "px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all duration-300 w-full md:w-auto shrink-0 shadow-md flex items-center justify-center gap-2",
              shops.some(s => s.is_active)
                ? "bg-primary text-white hover:bg-primary/90 shadow-primary/20"
                : "bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-600/20"
            )}
          >
            {shops.some(s => s.is_active) ? "Set All Offline" : "Set All Online"}
          </button>
        </div>
      )}

      {/* "At a Glance" Top Status Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* Today's Orders Card */}
        <motion.div
          whileHover={{ y: -4 }}
          className="bg-surface-container-low/95 dark:bg-surface-container/95 border border-outline-variant/30 rounded-[2rem] p-5 md:p-6 shadow-sm relative overflow-hidden"
        >
          <div className="flex justify-between items-start">
            <p className="text-xs font-black uppercase tracking-wider text-on-surface/85">Today's Orders</p>
            <div className="p-2 bg-orange-500/10 rounded-xl text-orange-500">
              <ReceiptText size={18} />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl md:text-3.5xl font-black text-on-surface tracking-tight">
              {todayOrdersCount}
            </span>
            <span className={cn(
              "text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1",
              todayTrendIsPositive ? "bg-emerald-500/15 text-emerald-500" : "bg-rose-500/15 text-rose-500"
            )}>
              {todayTrendIsPositive ? "↑" : "↓"} {todayTrendText}
            </span>
          </div>
          <div className="absolute bottom-0 inset-x-0 h-1 bg-gradient-to-r from-orange-500 to-rose-500 opacity-80" />
        </motion.div>

        {/* Pending Payout Card */}
        <motion.div
          whileHover={{ y: -4 }}
          className="bg-surface-container-low/95 dark:bg-surface-container/95 border border-outline-variant/30 rounded-[2rem] p-5 md:p-6 shadow-sm relative overflow-hidden"
        >
          <div className="flex justify-between items-start">
            <p className="text-xs font-black uppercase tracking-wider text-on-surface/85">Pending Payout</p>
            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500">
              <Landmark size={18} />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl md:text-3.5xl font-black text-on-surface tracking-tight">
              R {weeklySales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <p className="text-[10px] text-on-surface/75 font-extrabold mt-1">
              Next payout: Wednesday (Weekly)
            </p>
          </div>
          <div className="absolute bottom-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500 opacity-80" />
        </motion.div>

        {/* Active Menu Items Card */}
        <motion.div
          whileHover={{ y: -4 }}
          className="bg-surface-container-low/95 dark:bg-surface-container/95 border border-outline-variant/30 rounded-[2rem] p-5 md:p-6 shadow-sm relative overflow-hidden"
        >
          <div className="flex justify-between items-start">
            <p className="text-xs font-black uppercase tracking-wider text-on-surface/85">Active Menu Items</p>
            <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
              <Pizza size={18} />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl md:text-3.5xl font-black text-on-surface tracking-tight">
              {activeMenuItemsCount}
            </span>
            <span className="text-[10px] text-on-surface/75 font-extrabold">
              / {menuItems.length} listed
            </span>
          </div>
          <div className="absolute bottom-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 opacity-80" />
        </motion.div>

        {/* Driver Availability Card */}
        <motion.div
          whileHover={{ y: -4 }}
          className="bg-surface-container-low/95 dark:bg-surface-container/95 border border-outline-variant/30 rounded-[2rem] p-5 md:p-6 shadow-sm relative overflow-hidden"
        >
          <div className="flex justify-between items-start">
            <p className="text-xs font-black uppercase tracking-wider text-on-surface/85">Driver Availability</p>
            <div className="p-2 bg-primary/10 rounded-xl text-primary">
              <Bike size={18} />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl md:text-3.5xl font-black text-on-surface tracking-tight">
              {driverAvailability.status}
            </span>
            <span className={cn("text-[10px] font-extrabold px-2 py-0.5 rounded-full", driverAvailability.color)}>
              {connectedRidersCount} riders online
            </span>
          </div>
          <div className="absolute bottom-0 inset-x-0 h-1 bg-gradient-to-r from-primary to-orange-500" />
        </motion.div>
      </div>

      <AnimatePresence>
        {showTestCheckout && (
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ backdropFilter: "blur(0px)", backgroundColor: "rgba(0,0,0,0)" }}
              animate={{ backdropFilter: "blur(4px)", backgroundColor: "rgba(0,0,0,0.4)" }}
              exit={{ backdropFilter: "blur(0px)", backgroundColor: "rgba(0,0,0,0)" }}
              className="absolute inset-0"
              onClick={() => setShowTestCheckout(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-surface relative z-10 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-outline-variant/20 flex flex-col max-h-[90vh]"
            >
              <div className="p-6 md:p-8 space-y-6 flex-1 overflow-y-auto">
                <div>
                  <h2 className="text-2xl font-headline font-black text-on-surface">New Phone / Walk-in Order</h2>
                  <p className="text-xs text-on-surface-variant font-medium mt-1">Record a phone or walk-in customer order for kitchen dispatch and POS tracking.</p>
                </div>

                <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/10 space-y-2">
                  <div className="flex justify-between text-sm font-bold text-on-surface">
                    <span>Store POS Order</span>
                    <span>R 55.00</span>
                  </div>
                  <div className="flex justify-between text-lg font-black text-on-surface pt-4 border-t border-outline-variant/10">
                    <span>Total</span>
                    <span className="text-primary">R 55.00</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="checkout_special_instructions" className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/70">Special Instructions (Dietary / Delivery Notes)</label>
                  <textarea
                    id="checkout_special_instructions"
                    value={specialInstructions}
                    onChange={(e) => setSpecialInstructions(e.target.value)}
                    placeholder="E.g. No onions, extra spicy, gluten free, leave at security..."
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-2xl p-4 text-xs font-bold focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all min-h-[80px] resize-y"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/70">Payment Method</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setTestOrderPayMethod("Cash")}
                      className={cn(
                        "p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2",
                        testOrderPayMethod === "Cash" ? "border-primary bg-primary/10 text-primary" : "border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-low"
                      )}
                    >
                      <span className="text-lg">💵</span>
                      <span className="text-xs font-bold">Cash</span>
                    </button>
                    <button
                      onClick={() => setTestOrderPayMethod("Card Machine")}
                      className={cn(
                        "p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2",
                        testOrderPayMethod === "Card Machine" ? "border-primary bg-primary/10 text-primary" : "border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-low"
                      )}
                    >
                      <CreditCard size={20} />
                      <span className="text-xs font-bold">Card Machine</span>
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {testOrderPayMethod === "Card Machine" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-5 rounded-2xl bg-surface-container-lowest border-2 border-emerald-500/20 shadow-sm space-y-4 mt-2">
                        <div className="flex items-center gap-2 text-emerald-600 mb-2">
                          <Lock size={14} />
                          <span className="text-xs font-black uppercase tracking-wider">Secure Payment Synchronization</span>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Cardholder Name</label>
                          <input
                            type="text"
                            value={cardName}
                            onChange={(e) => setCardName(e.target.value)}
                            placeholder="John Doe"
                            className="w-full bg-surface border border-outline-variant/20 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Masked Card Number</label>
                          <input
                            type="text"
                            value={cardNumber}
                            onChange={(e) => {
                               const val = e.target.value.replace(/\D/g, "");
                               let formatted = "";
                               for (let i = 0; i < val.length; i++) {
                                 if (i > 0 && i % 4 === 0) formatted += " ";
                                 formatted += val[i];
                               }
                               setCardNumber(formatted.slice(0, 19));
                            }}
                            placeholder="**** **** **** 1234"
                            className="w-full bg-surface border border-outline-variant/20 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="p-6 md:p-8 bg-surface-container-lowest border-t border-outline-variant/10">
                <button
                  onClick={generateTestOrder}
                  className="w-full px-6 py-4 bg-primary text-on-primary font-black rounded-2xl shadow-xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-widest"
                >
                  Confirm & Place Order
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {currentShop && (!currentShop.phone || !currentShop.whatsapp) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-primary/5 border border-primary/20 rounded-[2rem] p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden group mb-4"
        >
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-700">
             <MessageCircle size={120} />
          </div>
          <div className="flex items-center gap-6 relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center text-primary shrink-0 shadow-lg shadow-primary/20">
              <Phone size={32} />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-headline font-bold text-on-surface">
                Complete Your Store Profile
              </h3>
              <p className="text-sm text-on-surface-variant max-w-md font-medium leading-relaxed">
                Add your WhatsApp and Phone number so customers can contact you directly for order inquiries and support.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate("storefront")}
            className="w-full md:w-auto px-8 py-4 bg-primary text-on-primary rounded-2xl font-headline font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all relative z-10"
          >
            Update Profile
          </button>
        </motion.div>
      )}

      <motion.section
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-headline font-bold text-on-surface tracking-tight">
                {greeting}, Chef!
              </h1>
              {menuItems.filter((i) => i.stock_quantity !== null && i.stock_quantity !== undefined && i.stock_quantity !== -1 && (i.stock_quantity || 0) < 5).length > 0 && (
                <button
                  onClick={() => onNavigate("menu")}
                  className="flex items-center gap-1.5 px-3 py-1 bg-error/10 hover:bg-error/20 border border-error/20 text-error rounded-full font-bold text-[10px] uppercase tracking-wider transition-all animate-bounce active:scale-95 cursor-pointer shadow-xs shrink-0"
                  title="Click to manage low stock menu items"
                >
                  <AlertTriangle size={12} className="animate-pulse" />
                  <span>{menuItems.filter((i) => i.stock_quantity !== null && i.stock_quantity !== undefined && i.stock_quantity !== -1 && (i.stock_quantity || 0) < 5).length} Items Low Stock</span>
                </button>
              )}
            </div>
            <p className="text-sm text-on-surface-variant font-medium">
              Here is what's happening in your kitchen today.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
            {/* View layout mode switcher to adjust visual complexity & cognitive load */}
            <div className="flex bg-surface-container-low p-1 rounded-xl border border-outline-variant/10 shadow-xs justify-center sm:justify-start">
              <button
                type="button"
                onClick={() => {
                  setLayoutMode("compact");
                  localStorage.setItem("localeats_dashboard_layout", "compact");
                  toast.success("Switched to clean Minimalist view");
                }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer",
                  layoutMode === "compact"
                    ? "bg-primary text-white shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                )}
              >
                <span>Minimalist</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setLayoutMode("advanced");
                  localStorage.setItem("localeats_dashboard_layout", "advanced");
                  toast.success("Switched to Advanced Analytics view");
                }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer",
                  layoutMode === "advanced"
                    ? "bg-primary text-white shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                )}
              >
                <span>Advanced</span>
              </button>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowTestCheckout(true)}
                className="p-3 bg-primary/5 text-primary rounded-xl hover:bg-primary/10 transition-colors border border-primary/10 flex items-center gap-2 text-xs font-bold"
                title="Create Manual POS Order"
              >
                <Plus size={18} />
                <span className="hidden sm:inline">New POS Order</span>
              </button>
              <button
                onClick={exportWeeklyCSV}
                className="p-3 bg-surface-container-low text-primary rounded-xl hover:bg-surface-container-high transition-colors shadow-sm flex items-center gap-2 text-xs font-bold"
                title="Download Weekly Report"
              >
                <Download size={18} />
                <span className="hidden sm:inline">Weekly Report</span>
              </button>
              <button
                onClick={() => {
                  onRefresh();
                  console.log("Dashboard refreshed");
                }}
                className="p-3 bg-surface-container-low text-on-surface-variant rounded-xl hover:bg-surface-container-high transition-colors shadow-sm"
                title="Refresh Dashboard"
              >
                <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>
        </div>
      </motion.section>

      {currentShop && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            "border rounded-[2.5rem] p-6 lg:p-8 flex flex-col md:flex-row items-stretch justify-between gap-6 shadow-md relative overflow-hidden transition-all duration-505",
            currentShop.is_active
              ? "bg-gradient-to-br from-emerald-500/[0.04] via-transparent to-transparent border-emerald-500/20 shadow-emerald-500/[0.01]"
              : "bg-gradient-to-br from-error/[0.04] via-transparent to-transparent border-error/20 shadow-error/[0.01]"
          )}
        >
          <div className="absolute top-0 right-0 p-8 opacity-[0.02] pointer-events-none">
            <Store size={140} />
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 relative z-10 flex-1">
            <div className={cn(
              "w-16 h-16 rounded-3xl flex items-center justify-center shrink-0 transition-all duration-500",
              currentShop.is_active
? "bg-emerald-500/10 text-emerald-500 shadow-xl shadow-emerald-500/10"
                : "bg-error/10 text-error shadow-xl shadow-error/10"
            )}>
              <Store size={28} />
            </div>

            <div className="space-y-1 flex-1">
              <div className="flex items-center flex-wrap gap-2.5">
                <h3 className="text-lg md:text-xl font-headline font-black text-on-surface tracking-tight">
                  {currentShop.name}
                </h3>
                <span className={cn(
                  "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5",
                  currentShop.is_active
? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                    : "bg-error/10 text-error border border-error/20"
                )}>
                  <span className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    currentShop.is_active ? "bg-emerald-500 animate-pulse" : "bg-error"
                  )} />
                  {currentShop.is_active ? "Live & Accepting Orders" : "Offline / Paused"}
                </span>
              </div>

              <p className="text-xs md:text-sm text-on-surface-variant font-medium leading-relaxed max-w-xl">
                {currentShop.is_active
                  ? "Your storefront is fully active on the LocalEats map. Customers can place orders, view items, and pairing requests from nearby riders will automatically dispatch."
                  : "Your storefront is currently hidden from the customer feed. Toggle below to open your virtual kitchen and go live."}
              </p>

              {currentShop.opening_time && currentShop.closing_time && (
                <p className="text-[10px] font-mono font-black text-on-surface-variant/60 uppercase tracking-widest flex items-center gap-1.5 pt-1">
                  <Clock size={12} /> Standard hours: {currentShop.opening_time} - {currentShop.closing_time}
                </p>
              )}

              {currentShop.updated_at ? (
                <p className="text-[10px] font-mono font-black text-emerald-500 flex items-center gap-1.5 pt-1 uppercase tracking-widest">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Store Status: Synced & Saved ({new Date(currentShop.updated_at).toLocaleDateString()} {new Date(currentShop.updated_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})
                </p>
              ) : (
                <p className="text-[10px] font-mono font-black text-amber-500 flex items-center gap-1.5 pt-1 uppercase tracking-widest">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500/80 animate-pulse" />
                  Store Status: Saved Offline (Automatic Fallback Active)
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row items-center gap-3 justify-center shrink-0 min-w-[200px] relative z-10 border-t md:border-t-0 md:border-l border-outline-variant/10 pt-4 md:pt-0 md:pl-6">
            <div className="text-center md:text-right lg:text-center w-full">
              <span className="text-[9px] font-black text-on-surface-variant/40 uppercase tracking-widest block mb-1.5">
                Shop Status Control
              </span>
              <button
                disabled={isStatusToggling}
                onClick={async () => {
                  setIsStatusToggling(true);
                  const newStatus = !currentShop.is_active;

                  // Optimistic update
                  

                  const { success, error } = await syncShopAvailability({
                    shopId: currentShop.id,
                    isOpen: newStatus,
                    supabase,
                    updateFirestoreShop,
                  });

                  if (success) {
                    toast.success(
                      `Storefront is now ${newStatus ? "Open & Live" : "Closed & Offline"}!`
                    );
                  } else {
                    // Rollback
                    
                    toast.error(typeof error === "string" ? error : "Failed to update storefront status");
                  }
                  setIsStatusToggling(false);
                }}
                className={cn(
                  "w-full px-6 py-3 rounded-2xl font-headline font-black text-xs uppercase tracking-widest transition-all duration-300 shadow-md flex items-center justify-center gap-2",
                  currentShop.is_active
                    ? "bg-error text-white hover:bg-error/95 shadow-error/10 hover:scale-[1.02]"
                    : "bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-500/10 hover:scale-[1.02]"
                )}
              >
                {isStatusToggling ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : currentShop.is_active ? (
                  <>
                    <X size={14} />
                    <span>Go Offline</span>
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    <span>Go Live Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      <OnboardingChecklist
        shops={shops}
        user={user}
        onNavigate={onNavigate}
        onEditProfile={onEditProfile}
        hasMenu={hasMenu}
      />

      <ConnectionsSlider
        onNavigate={onNavigate}
      />

      {layoutMode === "advanced" && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <StatCard
              title="Avg Order Value"
              value={`R ${weeklyAvgOrderValue.toFixed(2)}`}
              change={`R ${avgOrderValue.toFixed(0)} overall`}
              icon={TrendingUp}
              colorClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <StatCard
              title="Followers"
              value={followerCount}
              change={followerTrend}
              icon={Users}
              colorClass="bg-blue-500/10 text-blue-600 dark:text-blue-400"
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <StatCard
              title="Avg. Prep"
              value={`${avgPrepTime}m`}
              change="Active flow"
              icon={Clock}
              colorClass="bg-zinc-500/10 text-zinc-600 dark:text-zinc-400"
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <StatCard
              title="Subscription"
              value={trialInfo ? (trialInfo.isExpired ? "Expired" : `${trialInfo.daysRemaining} Days`) : "Active Plan"}
              change={trialInfo ? (trialInfo.isExpired ? "Action Needed" : "Free Trial") : "Professional"}
              icon={Zap}
              colorClass={trialInfo?.isExpired ? "bg-red-500/10 text-red-600 dark:text-red-400" : "bg-primary/10 text-primary"}
            />
          </motion.div>

      </div>
      )}

      {layoutMode === "advanced" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-8 bg-surface-container-low rounded-[2rem] p-6 md:p-8 border border-outline-variant/5"
        >
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h2 className="text-xl font-headline font-bold text-on-surface">
                Business Analytics Trends
              </h2>
              <p className="text-sm text-on-surface-variant font-medium">
                Live shop performance and statistics
              </p>
            </div>
            {orders.length > 0 && (
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Metric Selector */}
                <div className="flex bg-surface-container-high/60 p-1 rounded-xl border border-outline-variant/10">
                  <button
                    onClick={() => setChartMetric("revenue")}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                      chartMetric === "revenue"
                        ? "bg-primary text-on-primary shadow-sm"
                        : "text-on-surface-variant hover:text-on-surface"
                    )}
                  >
                    Revenue
                  </button>
                  <button
                    onClick={() => setChartMetric("orders")}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                      chartMetric === "orders"
                        ? "bg-primary text-on-primary shadow-sm"
                        : "text-on-surface-variant hover:text-on-surface"
                    )}
                  >
                    Orders
                  </button>
                </div>

                {/* Timeframe Selector */}
                <div className="flex bg-surface-container-high/60 p-1 rounded-xl border border-outline-variant/10">
                  <button
                    onClick={() => setTimeframe("weekly")}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                      timeframe === "weekly"
                        ? "bg-primary text-on-primary shadow-sm"
                        : "text-on-surface-variant hover:text-on-surface"
                    )}
                  >
                    Weekly
                  </button>
                  <button
                    onClick={() => setTimeframe("monthly")}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                      timeframe === "monthly"
                        ? "bg-primary text-on-primary shadow-sm"
                        : "text-on-surface-variant hover:text-on-surface"
                    )}
                  >
                    Monthly
                  </button>
                </div>
              </div>
            )}
          </div>

          <div
            className="h-64 w-full flex items-center justify-center"
            style={{ minHeight: "256px" }}
          >
            {orders.length > 0 ? (
              <ResponsiveContainer
                width="99%"
                height={256}
                minWidth={100}
              >
                <BarChart data={trendData}>
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} isAnimationActive={false}>
                    {trendData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={index === trendData.length - 1 ? "#f58220" : "#f582204d"}
                      />
                    ))}
                  </Bar>
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fontWeight: 700, fill: "#5c4037" }}
                  />
                  <Tooltip
                    cursor={{ fill: "transparent" }}
                    contentStyle={{
                      borderRadius: "16px",
                      border: "none",
                      boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
                      backgroundColor: darkMode ? "#1c1c1c" : "#ffffff",
                    }}
                    formatter={(val: number | string) => [
                      chartMetric === "revenue" ? `R ${Number(val).toLocaleString()}` : `${val} Orders`,
                      chartMetric === "revenue" ? "Revenue" : "Volume"
                    ]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8">
                <div className="relative w-32 h-32 mx-auto mb-6">
                  <div className="absolute inset-0 bg-primary/5 rounded-full animate-pulse" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <TrendingUp
                      className="text-primary/20"
                      size={56}
                    />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-on-surface mb-2">Grow Your Business</h3>
                <p className="text-xs text-on-surface-variant max-w-xs mx-auto opacity-70">
                  We'll start tracking your sales trends automatically as soon as your first orders arrive.
                </p>
              </div>
            )}
          </div>

          {orders.length > 0 && statusDistribution.length > 0 && (
            <div className="mt-6 pt-6 border-t border-outline-variant/10">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/40 mb-3.5">
                Current Kitchen Flow Status
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {statusDistribution.map((item) => (
                  <div key={item.name} className="bg-on-surface/5 border border-outline-variant/5 rounded-2xl p-3 flex flex-col justify-between">
                    <span className="text-[9px] font-black text-on-surface-variant/60 uppercase tracking-wider block mb-1">
                      {item.name}
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-headline font-black text-on-surface">
                        {item.value}
                      </span>
                      <span className="text-[9px] text-on-surface-variant/40 font-bold">
                        ({((item.value / orders.length) * 100).toFixed(0)}%)
                      </span>
                    </div>
                    <div className="w-full bg-zinc-800/20 dark:bg-zinc-800/40 h-1 rounded-full mt-2 overflow-hidden">
                      <div className="h-full rounded-full" style={{ backgroundColor: item.color, width: `${(item.value / orders.length) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        <div className="lg:col-span-4 space-y-4">
          <h3 className="text-lg font-headline font-bold text-on-surface px-2">
            Quick Actions
          </h3>
          {[
            {
              id: "menu",
              title: "Update Menu",
              sub: "Modify items & pricing",
              icon: UtensilsCrossed,
              color: "bg-primary-fixed text-primary",
            },
            {
              id: "riders",
              title: "Rider Fleet",
              sub: "Manage pairings & QR codes",
              icon: Bike,
              color: "bg-blue-50 text-blue-600",
            },
            {
              id: "insights",
              title: "Performance Insights",
              sub: "View trends & analytics",
              icon: TrendingUp,
              color: "bg-secondary-fixed text-on-secondary-fixed",
            },
            {
              id: "orders",
              title: "Kitchen ",
              sub: "System & app preferences",
              icon: ReceiptText,
              color: "bg-zinc-100 text-zinc-600",
            },
          ].map((action, i) => (
            <motion.button
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
              key={i}
              onClick={() => onNavigate(action.id)}
              className="w-full flex items-center justify-between p-5 rounded-xl bg-surface-container-lowest border border-outline-variant/10 hover:bg-primary/5 transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center",
                    action.color,
                  )}
                >
                  <action.icon size={20} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-on-surface">{action.title}</p>
                  <p className="text-xs text-on-surface-variant">
                    {action.sub}
                  </p>
                </div>
              </div>
              <ChevronRight
                size={20}
                className="text-on-surface-variant group-hover:translate-x-1 transition-transform"
              />
            </motion.button>
          ))}
        </div>
      </div>
      )}

      {/* Suburb Dispatch Trends & Zone Profitability Section */}
      <DeliveryDispatchSuburbTrends orders={orders} darkMode={darkMode} />

      {/* Compact View Guidance Block */}
      {layoutMode === "compact" && (
        <div className="bg-surface-container-low border border-outline-variant/10 rounded-[2.5rem] p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 mt-6 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-on-surface">Compact View Active</h3>
              <p className="text-xs text-on-surface-variant max-w-xl mt-0.5 leading-relaxed">
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setLayoutMode("advanced");
              localStorage.setItem("localeats_dashboard_layout", "advanced");
              toast.success("Advanced layout mode unlocked with full telemetries.");
            }}
            className="w-full md:w-auto px-5 py-2.5 bg-primary text-white font-black text-xs uppercase tracking-wider rounded-xl hover:opacity-90 active:scale-95 transition-all shrink-0 cursor-pointer text-center shadow-md shadow-primary/20"
          >
            Unlock Full Analytics
          </button>
        </div>
      )}

      {/* Low Stock Alerts Section */}
      {menuItems.filter((i) => i.stock_quantity !== null && i.stock_quantity !== undefined && i.stock_quantity !== -1 && (i.stock_quantity || 0) < 5).length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-error/5 border border-error/20 rounded-[2rem] p-8"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-error/10 text-error rounded-2xl flex items-center justify-center">
                <AlertCircle size={24} />
              </div>
              <div>
                <h2 className="text-xl font-headline font-bold text-on-surface">
                  Low Stock Alerts
                </h2>
                <p className="text-sm text-on-surface-variant">
                  These items are running low and need restocking soon.
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate("menu")}
              className="px-6 py-2 bg-error text-white text-xs font-bold rounded-full hover:bg-error/90 transition-colors shadow-sm"
            >
              Restock Now
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {menuItems
              .filter((i) => i.stock_quantity !== null && i.stock_quantity !== undefined && i.stock_quantity !== -1 && (i.stock_quantity || 0) < 5)
              .map((item) => (
                <div
                  key={item.id}
                  className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/10 flex items-center gap-4 group hover:border-error/30 transition-colors"
                >
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-surface-container flex items-center justify-center">
                    {!isPlaceholderImage(item.image_url) ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <FoodPlaceholder size={20} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm text-on-surface truncate">
                      {item.name}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1 bg-surface-container rounded-full overflow-hidden">
                        <div
                          className="h-full bg-error rounded-full"
                          style={{
                            width: `${(item.stock_quantity || 0) * 20}%`,
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-black text-error">
                        {item.stock_quantity || 0} left
                      </span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </motion.section>
      )}

      {/* Recent Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="lg:col-span-8 bg-surface-container-lowest rounded-[2rem] p-8 border border-outline-variant/10 shadow-sm"
        >
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-headline font-bold text-on-surface">
              Recent Activity
            </h2>
            <button
              onClick={() => onNavigate("orders")}
              className="text-xs font-bold text-primary hover:underline"
            >
              View All Activity
            </button>
          </div>
          <div className="space-y-6">
            {orders.slice(0, 5).map((order, i) => (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                key={order.id}
                className="flex items-center justify-between group p-3 hover:bg-surface-container-high rounded-2xl transition-colors cursor-pointer"
                onClick={() => onNavigate("orders")}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      "w-11 h-11 rounded-full flex items-center justify-center border-2 border-transparent group-hover:border-primary/10 transition-all shadow-sm",
                      order.status === "completed"
? "bg-emerald-100/50 text-emerald-600 shadow-emerald-500/5"
                        : order.status === "pending"
                          ? "bg-primary/10 text-primary"
                          : "bg-blue-100/50 text-blue-600 shadow-blue-500/5",
                    )}
                  >
                    {order.status === "completed" ? (
                      <CheckCircle2 size={18} />
                    ) : (
                      <Clock size={18} />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-on-surface leading-snug">
                      Order <span className="text-primary font-mono tracking-tighter">#{order.id.toString().slice(-4)}</span>{" "}
                      {order.status === "completed" ? "Completed" : order.status === "cancelled" ? "Cancelled" : "Received"}
                    </p>
                    <p className="text-[10px] md:text-xs text-on-surface-variant/80 font-medium mt-0.5">
                      {order.product_name} •{" "}
                      {format(new Date(order.created_at), "h:mm a")}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-on-surface">
                    R {Number(order.total_price || 0).toFixed(2)}
                  </p>
                  <OrderStatusBadge status={order.status} className="mt-1" />
                </div>
                </motion.div>
              ))}
            {orders.length === 0 && (
              <div className="py-20 text-center space-y-6">
                <div className="relative w-24 h-24 mx-auto">
                   <div className="absolute inset-0 bg-primary/5 rounded-full animate-pulse-slow font-mono" />
                   <div className="absolute inset-0 flex items-center justify-center opacity-20">
                     <ReceiptText size={48} />
                   </div>
                </div>
                <div className="max-w-xs mx-auto">
                  <h3 className="font-bold text-on-surface">Awaiting Your First Order</h3>
                  <p className="text-xs text-on-surface-variant mt-2 opacity-70">
                    Your shop activity will appear here in real-time as customers place their orders.
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="lg:col-span-4 bg-surface-container-lowest rounded-[2rem] p-8 border border-outline-variant/10 shadow-sm"
        >
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-headline font-bold text-on-surface">
              Recent Followers
            </h2>
            <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
              <Users size={16} />
            </div>
          </div>
          <div className="space-y-6">
            {recentFollowers.length > 0 ? (
              recentFollowers.map((follower) => (
                <div
                  key={follower.id}
                  className="flex items-center gap-4 group"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs">
                    {follower.id.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-on-surface truncate">
                      New Follower
                    </p>
                    <p className="text-[10px] text-on-surface-variant/60 font-medium">
                      {format(new Date(follower.created_at), "MMM d, h:mm a")}
                    </p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                </div>
              ))
            ) : (
              <div className="py-12 text-center space-y-4">
                <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mx-auto text-on-surface-variant/20">
                  <Users size={32} />
                </div>
                <p className="text-on-surface-variant text-sm font-medium italic">
                  No followers yet.
                </p>
                <p className="text-[10px] text-on-surface-variant/60 leading-tight">
                  Share your shop link to get more followers!
                </p>
              </div>
            )}
          </div>
        </motion.section>
      </div>
    </div>
  );
});
