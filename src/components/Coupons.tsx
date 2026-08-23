import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Ticket,
  Zap,
  TrendingUp,
  Search,
  Clock,
  Sparkles,
  Calendar,
  AlertCircle,
  FileDown,
  Info
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { supabase } from "../lib/supabase";
import { Shop, Order, Coupon } from "../types";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CouponsProps {
  currentShop: Shop | undefined;
  orders: Order[];
}

export const Coupons: React.FC<CouponsProps> = ({
  currentShop,
  orders,
}) => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [couponsAlertDismissed, setCouponsAlertDismissed] = useState(false);
  const [newCoupon, setNewCoupon] = useState({
    code: "",
    discount_type: "percentage" as "percentage" | "fixed",
    discount_value: "",
    min_order_value: "",
    expiry_date: "",
  });

  // Advanced search/filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "expired">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "percentage" | "fixed">("all");

  // Edit modal states
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);

  // Delete safety check states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    const fetchCoupons = async () => {
      if (!currentShop?.id) return;
      try {
        const { data, error } = await supabase
          .from("coupons")
          .select("*")
          .eq("shop_id", currentShop.id)
          .order("created_at", { ascending: false });

        if (!error && data) setCoupons(data as Coupon[]);
      } catch (err) {
        console.error("Error fetching coupons:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchCoupons();
  }, [currentShop?.id]);

  const handleCreateCoupon = async (formData: {
    code: string;
    discount_type: "percentage" | "fixed";
    discount_value: string;
    min_order_value: string;
    expiry_date: string;
    is_active?: boolean;
  }) => {
    if (!currentShop?.id) return;

    // Guardrail: Duplicate check
    const isDuplicate = coupons.some(
      (c) => c.code.toUpperCase() === formData.code.toUpperCase()
    );
    if (isDuplicate) {
      toast.error(`A coupon with the code "${formData.code.toUpperCase()}" already exists. Please choose a different code.`);
      return;
    }

    // Safety check on value ratios
    const val = parseFloat(formData.discount_value);
    if (isNaN(val) || val <= 0) {
      toast.error("Please enter a valid discount value greater than zero.");
      return;
    }
    if (formData.discount_type === "percentage" && val > 95) {
      toast.error("Margin override blocked: Percentage discounts cannot exceed 95% off.");
      return;
    }

    const { error } = await supabase.from("coupons").insert([
      {
        shop_id: currentShop.id,
        code: formData.code.toUpperCase(),
        discount_type: formData.discount_type,
        discount_value: val,
        min_order_value: parseFloat(formData.min_order_value) || 0,
        expiry_date: formData.expiry_date || null,
        is_active: true,
      },
    ]);

    if (error) {
      toast.error("Failed to create coupon");
    } else {
      setShowCreateModal(false);
      setNewCoupon({
        code: "",
        discount_type: "percentage",
        discount_value: "",
        min_order_value: "",
        expiry_date: "",
      });
      // Refresh
      const { data } = await supabase
        .from("coupons")
        .select("*")
        .eq("shop_id", currentShop.id)
        .order("created_at", { ascending: false });
      if (data) setCoupons(data as Coupon[]);
      toast.success(`Coupon ${formData.code.toUpperCase()} created successfully!`);
    }
  };

  const handleUpdateCoupon = async (formData: {
    code: string;
    discount_type: "percentage" | "fixed";
    discount_value: string;
    min_order_value: string;
    expiry_date: string;
    is_active: boolean;
  }) => {
    if (!currentShop?.id || !editingCoupon) return;

    // Duplicate Check
    const isDuplicate = coupons.some(
      (c) => c.code.toUpperCase() === formData.code.toUpperCase() && c.id !== editingCoupon.id
    );
    if (isDuplicate) {
      toast.error(`A coupon with code "${formData.code.toUpperCase()}" already exists elsewhere.`);
      return;
    }

    const val = parseFloat(formData.discount_value);
    // Safeguard validation
    if (isNaN(val) || val <= 0) {
      toast.error("Discount value must be greater than zero.");
      return;
    }
    if (formData.discount_type === "percentage" && val > 95) {
      toast.error("Margin protection warning: Maximum discount rate is limited to 95%.");
      return;
    }

    const { error } = await supabase
      .from("coupons")
      .update({
        code: formData.code.toUpperCase(),
        discount_type: formData.discount_type,
        discount_value: val,
        min_order_value: parseFloat(formData.min_order_value) || 0,
        expiry_date: formData.expiry_date || null,
        is_active: formData.is_active,
      })
      .eq("id", editingCoupon.id);

    if (error) {
      toast.error("Failed to update coupon details");
    } else {
      setEditingCoupon(null);
      // Refresh
      const { data } = await supabase
        .from("coupons")
        .select("*")
        .eq("shop_id", currentShop.id)
        .order("created_at", { ascending: false });
      if (data) setCoupons(data as Coupon[]);
      toast.success("Coupon updated successfully!");
    }
  };

  const toggleCoupon = async (id: string, isActive: boolean) => {
    setCoupons((prev) =>
      prev.map((c) => (c.id === id ? { ...c, is_active: !isActive } : c)),
    );
  };

  const handleDeleteCoupon = async (id: string) => {
    const { error } = await supabase
      .from("coupons")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Failed to delete coupon (it may already be associated with old order transactions). Try pausing it instead.");
    } else {
      setCoupons((prev) => prev.filter((c) => c.id !== id));
      setShowDeleteConfirm(null);
    }
  };

  const handleApplyPreset = (preset: {
    code: string;
    discount_type: "percentage" | "fixed";
    discount_value: string;
    min_order_value: string;
    expiry_date: string;
  }) => {
    setNewCoupon(preset);
    setShowCreateModal(true);
    toast.success(`Preset "${preset.code}" auto-loaded! Feel free to edit values before saving.`);
  };

  const getPerformance = useCallback((code: string) => {
    const redemptions = orders.filter((o) => o.coupon_code === code);
    const totalDiscount = redemptions.reduce(
      (acc, curr) => acc + (curr.discount_amount || 0),
      0,
    );
    const totalSales = redemptions.reduce(
      (acc, curr) => acc + Number(curr.total_price),
      0,
    );
    return {
      count: redemptions.length,
      discount: totalDiscount,
      sales: totalSales,
    };
  }, [orders]);

  const exportToCSV = () => {
    if (coupons.length === 0) {
      toast.error("No promo codes to export.");
      return;
    }

    const headers = ["ID", "Code", "Type", "Value", "Min Order Value (R)", "Status", "Expiry Date", "Redemptions", "Saved Value (R)", "Sales Value (R)"];

    const rows = coupons.map((c) => {
      const perf = getPerformance(c.code);
      const isExpired = c.expiry_date && new Date(c.expiry_date) < new Date();
      const statusStr = isExpired ? "Expired" : c.is_active ? "Active" : "Inactive";
      return [
        c.id,
        c.code,
        c.discount_type,
        c.discount_value,
        c.min_order_value,
        statusStr,
        c.expiry_date || "No Expiry",
        perf.count,
        perf.discount.toFixed(2),
        perf.sales.toFixed(2)
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${currentShop?.name || "LocalEats"}_CouponsData_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Coupon performance report downloaded successfully!");
  };

  // Filter & Search logic
  const filteredCoupons = useMemo(() => {
    return coupons.filter((coupon) => {
      // 1. Search Query Match
      if (searchQuery.trim() !== "") {
        const queryText = searchQuery.toLowerCase();
        if (!coupon.code.toLowerCase().includes(queryText)) {
          return false;
        }
      }

      // 2. Type Filter Match
      if (typeFilter !== "all" && coupon.discount_type !== typeFilter) {
        return false;
      }

      // 3. Status Filter Match
      const isExpired = coupon.expiry_date && new Date(coupon.expiry_date) < new Date();
      if (statusFilter === "active") {
        return coupon.is_active && !isExpired;
      }
      if (statusFilter === "inactive") {
        return !coupon.is_active;
      }
      if (statusFilter === "expired") {
        return !!isExpired;
      }

      return true;
    });
  }, [coupons, searchQuery, statusFilter, typeFilter]);

  // Find top performer coupon by generated customer sales volume
  const topCouponCode = useMemo(() => {
    let maxSales = 0;
    let topCode = "";
    coupons.forEach((c) => {
      const perf = getPerformance(c.code);
      if (perf.sales > maxSales && perf.count > 0) {
        maxSales = perf.sales;
        topCode = c.code;
      }
    });
    return topCode;
  }, [coupons, getPerformance]);

  // Active coupons expiring in the next 48 hours (2 days)
  const expiringSoonCoupons = useMemo(() => {
    return coupons.filter((c) => {
      if (!c.is_active || !c.expiry_date) return false;
      const remainingMs = new Date(c.expiry_date).getTime() - Date.now();
      const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
      return remainingDays > 0 && remainingDays <= 2;
    });
  }, [coupons]);

  // Campaign inspiration formulas
  const CAMPAIGN_PRESETS = [
    {
      code: "WELCOME10",
      discount_type: "percentage" as const,
      discount_value: "10",
      min_order_value: "100",
      expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      title: "New Customer Match",
      badge: "User Base Grow",
      desc: "Perfect initial low friction voucher with a standard basket size requirement."
    },
    {
      code: "FRIDAYRUSH50",
      discount_type: "fixed" as const,
      discount_value: "50",
      min_order_value: "250",
      expiry_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      title: "High Basket Driver",
      badge: "Friday Boost",
      desc: "Reward large lunch baskets with direct flat value discount to bypass third-party platforms."
    },
    {
      code: "LOVETACO25",
      discount_type: "percentage" as const,
      discount_value: "25",
      min_order_value: "150",
      expiry_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      title: "Apology & Winback",
      badge: "Customer Retention",
      desc: "A highly persuasive 25% discount to Win Back cold users with an attractive rate."
    }
  ];

  return (
    <div className="space-y-8" id="coupons_studio_tab">
      <AnimatePresence>
        {expiringSoonCoupons.length > 0 && !couponsAlertDismissed && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: 200 }}
            drag="x"
            dragConstraints={{ left: -100, right: 100 }}
            dragElastic={0.15}
            onDragEnd={(_event, info) => {
              if (Math.abs(info.offset.x) > 60) {
                setCouponsAlertDismissed(true);
              }
            }}
            title="Swipe left/right or click X to dismiss notice"
            className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 anim-pulse cursor-grab active:cursor-grabbing select-none"
            id="coupons_expiring_soon_global_alert"
          >
            <div className="flex items-start gap-3 flex-1">
              <div className="p-2 bg-amber-500/10 rounded-xl text-amber-600 dark:text-amber-400 shrink-0">
                <Clock size={18} />
              </div>
              <div>
                <h4 className="text-xs font-black text-amber-800 dark:text-amber-300 uppercase tracking-widest">At-Risk Campaigns</h4>
                <p className="text-xs text-amber-700 dark:text-amber-400/80 mt-0.5 font-medium">
                  You have <strong>{expiringSoonCoupons.length} coupon{expiringSoonCoupons.length > 1 ? "s" : ""}</strong> expiring within 48 hours. Consider extending their validity or activating preset campaigns!
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <button
                onClick={() => {
                  const el = document.getElementById("coupons_quick_suggest_panel");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black uppercase rounded-lg transition shrink-0 tracking-wider text-center cursor-pointer pointer-events-auto"
              >
                Review Templates
              </button>
              <button
                onClick={() => {
                  setCouponsAlertDismissed(true);
                }}
                className="p-1.5 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg transition shrink-0 cursor-pointer pointer-events-auto"
                title="Dismiss Notice"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-headline font-bold text-on-surface tracking-tight" id="coupons_main_title">
            Merchant Coupon Studio
          </h2>
          <p className="text-sm text-on-surface-variant font-medium">
            Deploy codes, configure profit boundaries, edit conditions, and track redemption flow.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface-container border border-outline-variant/10 text-on-surface text-xs font-bold rounded-xl hover:bg-surface-container-high transition"
            id="coupons_export_csv_btn"
          >
            <FileDown size={14} />
            Export Spreadsheet
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary font-bold rounded-xl shadow-md hover:scale-[1.01] transition-transform text-xs"
            id="coupons_create_btn"
          >
            <Plus size={14} />
            New Code
          </button>
        </div>
      </header>

      {/* Performance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="coupons_stats_row">
        {[
          {
            label: "Total Redemptions",
            value: orders.filter((o) => o.coupon_code).length,
            icon: Ticket,
            color: "text-blue-500 bg-blue-500/10",
          },
          {
            label: "Total Discounts Given",
            value: `R${Number(orders.reduce((acc, curr) => acc + (curr.discount_amount || 0), 0)).toFixed(2)}`,
            icon: Zap,
            color: "text-orange-500 bg-orange-500/10",
          },
          {
            label: "Coupon-Driven Sales",
            value: `R${Number(orders.filter((o) => o.coupon_code).reduce((acc, curr) => acc + Number(curr.total_price), 0)).toFixed(2)}`,
            icon: TrendingUp,
            color: "text-green-500 bg-green-500/10",
          },
        ].map((stat, i) => (
          <div
            key={i}
            className="bg-surface-container-lowest p-5 rounded-3xl border border-outline-variant/10 shadow-sm flex items-center gap-4"
          >
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center font-bold", stat.color)}>
              <stat.icon size={22} />
            </div>
            <div>
              <p className="text-[10px] font-black text-on-surface-variant/70 uppercase tracking-widest leading-none mb-1">
                {stat.label}
              </p>
              <p className="text-xl font-black text-on-surface">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* WORKSPACE TOOLS: SEARCH & FILTERS CONTROLS */}
      <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/10 flex flex-col sm:flex-row items-center gap-3">
        <div className="relative w-full sm:flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/40" />
          <input
            type="text"
            placeholder="Search by coupon code (e.g. WELCOME...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-on-surface/5 text-xs font-bold rounded-xl border-none focus:ring-1 focus:ring-primary focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-on-surface-variant hover:text-on-surface"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0 select-none">
          <div className="flex items-center gap-1.5 bg-on-surface/5 px-2 py-1.5 rounded-xl border border-outline-variant/10">
            <span className="text-[10px] uppercase font-black text-on-surface-variant/60">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive" | "expired")}
              className="bg-transparent border-none text-[11px] font-bold text-on-surface focus:outline-none cursor-pointer"
            >
              <option value="all">All Promo Codes</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
              <option value="expired">Expired Only</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-on-surface/5 px-2 py-1.5 rounded-xl border border-outline-variant/10">
            <span className="text-[10px] uppercase font-black text-on-surface-variant/60">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as "all" | "percentage" | "fixed")}
              className="bg-transparent border-none text-[11px] font-bold text-on-surface focus:outline-none cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed Flat Basket (R)</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-32 bg-surface-container animate-pulse rounded-3xl"
            />
          ))}
        </div>
      ) : filteredCoupons.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="coupons_grid_container">
          {filteredCoupons.map((coupon) => {
            const perf = getPerformance(coupon.code);
            const isExpired = coupon.expiry_date && new Date(coupon.expiry_date) < new Date();

            let isExpiringSoon = false;
            let expiryString = "";
            if (coupon.expiry_date && !isExpired) {
              const remainingMs = new Date(coupon.expiry_date).getTime() - Date.now();
              const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
              isExpiringSoon = remainingDays <= 2;
              expiryString = remainingDays === 0 ? "Expires TODAY" : remainingDays === 1 ? "Expires TOMORROW" : `Expires in ${remainingDays} days`;
            }

            return (
              <div
                key={coupon.id}
                className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10 shadow-sm flex flex-col justify-between group relative overflow-hidden"
              >
                {isExpiringSoon && (
                  <div className="absolute top-0 left-0 right-0 bg-amber-500 text-white text-[9px] font-black uppercase text-center py-0.5 tracking-wider flex items-center justify-center gap-1">
                    <Clock size={10} />
                    {expiryString}
                  </div>
                )}

                <div className={cn("space-y-4", isExpiringSoon ? "pt-2" : "")}>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black font-mono text-primary tracking-wider select-all">
                          {coupon.code}
                        </span>
                        <span
                          className={cn(
                            "text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest",
                            isExpired
                              ? "bg-red-500/10 text-red-600"
                              : coupon.is_active
                                ? "bg-emerald-500/10 text-emerald-600"
                                : "bg-zinc-500/10 text-zinc-500",
                          )}
                        >
                          {isExpired
                            ? "Expired"
                            : coupon.is_active
                              ? "Active"
                              : "Inactive"}
                        </span>
                        {coupon.code === topCouponCode && (
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest bg-amber-500/10 text-amber-600 flex items-center gap-1 select-none animate-pulse">
                            <Sparkles size={8} className="text-amber-500 fill-amber-500 animate-spin" style={{ animationDuration: '3s' }} />
                            TOP PERFORMER
                          </span>
                        )}
                      </div>
                      <p className="text-base font-black text-on-surface">
                        {coupon.discount_type === "percentage"
                          ? `${coupon.discount_value}% OFF`
                          : `R${coupon.discount_value} OFF`}
                      </p>
                      <p className="text-[10px] text-on-surface-variant/80 font-bold">
                        Min. Order requirement: <span className="text-on-surface text-xs font-semibold">R{coupon.min_order_value || 0}</span>
                      </p>
                      {coupon.expiry_date && (
                        <p
                          className={cn(
                            "text-[10px] font-bold flex items-center gap-1 mt-1",
                            isExpired
                              ? "text-red-500"
                              : isExpiringSoon
                                ? "text-amber-500"
                                : "text-on-surface-variant/60",
                          )}
                        >
                          <Calendar size={12} />
                          Ends:{" "}
                          {format(new Date(coupon.expiry_date), "MMM dd, yyyy")}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setEditingCoupon(coupon)}
                        className="p-2 text-on-surface-variant/70 hover:text-on-surface hover:bg-on-surface/5 rounded-xl transition-colors"
                        title="Edit Code Parameters"
                      >
                        <Edit2 size={16} />
                      </button>

                      <button
                        onClick={() => toggleCoupon(coupon.id, coupon.is_active)}
                        disabled={!!isExpired}
                        className={cn(
                          "p-2 rounded-xl transition-colors",
                          isExpired
                            ? "text-on-surface-variant/20 cursor-not-allowed"
                            : coupon.is_active
                              ? "text-emerald-500 hover:bg-emerald-500/10"
                              : "text-zinc-400 hover:bg-zinc-500/10",
                        )}
                        title={coupon.is_active ? "Pause Code" : "Activate Code"}
                      >
                        {coupon.is_active ? <Check size={18} /> : <X size={18} />}
                      </button>

                      <button
                        onClick={() => setShowDeleteConfirm(coupon.id)}
                        className="p-2 text-red-500/70 hover:text-red-600 hover:bg-red-500/10 rounded-xl transition-colors"
                        title="Delete Permanently"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* MINI PERFORMANCE SECTION */}
                  <div className="pt-3 border-t border-outline-variant/10 grid grid-cols-3 gap-2 bg-on-surface/5 p-3 rounded-2xl">
                    <div className="text-center">
                      <p className="text-[9px] font-black text-on-surface-variant/60 uppercase">
                        Redeemed
                      </p>
                      <p className="text-sm font-black text-on-surface mt-0.5">
                        {perf.count} times
                      </p>
                    </div>
                    <div className="text-center border-x border-outline-variant/10">
                      <p className="text-[9px] font-black text-on-surface-variant/60 uppercase">
                        Deducted
                      </p>
                      <p className="text-sm font-black text-orange-600 mt-0.5">
                        R{Number(perf.discount || 0).toFixed(0)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] font-black text-on-surface-variant/60 uppercase font-sans">
                        Driven Sales
                      </p>
                      <p className="text-sm font-black text-emerald-600 mt-0.5">
                        R{Number(perf.sales || 0).toFixed(0)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Confirm Delete Overlay inside card */}
                <AnimatePresence>
                  {showDeleteConfirm === coupon.id && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-surface-container backdrop-blur-sm z-30 flex flex-col items-center justify-center p-4 text-center"
                    >
                      <AlertCircle size={28} className="text-red-500 mb-2 animate-bounce" />
                      <p className="text-xs font-black text-on-surface">Delete {coupon.code}?</p>
                      <p className="text-[10px] text-on-surface-variant/80 mt-1 max-w-[220px]">This operation is irreversible. Safe metrics will retain.</p>
                      <div className="flex gap-2 mt-3 select-none">
                        <button
                          onClick={() => setShowDeleteConfirm(null)}
                          className="px-3 py-1 bg-surface-container-high text-[10px] text-on-surface font-bold rounded-lg"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDeleteCoupon(coupon.id)}
                          className="px-3 py-1 bg-red-600 text-[10px] text-white font-bold rounded-lg"
                        >
                          Delete
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-surface-container-low/30 rounded-3xl p-12 text-center border-2 border-dashed border-outline-variant/10">
          <Ticket
            size={48}
            className="mx-auto text-on-surface-variant/20 mb-4"
          />
          <h3 className="text-base font-bold text-on-surface">No matching promo codes found</h3>
          <p className="text-xs text-on-surface-variant max-w-xs mx-auto mt-2">
            Try adjusting your search criteria, clearing your filters, or use one of our templates below.
          </p>
          <button
            onClick={() => {
              setSearchQuery("");
              setStatusFilter("all");
              setTypeFilter("all");
            }}
            className="mt-4 px-4 py-2 bg-on-surface/5 hover:bg-on-surface/10 text-on-surface font-bold rounded-xl text-xs transition"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* QUICK INSPIRATION IDEAS DESK SECTION */}
      <div className="bg-primary/5 rounded-3xl p-6 border border-primary/10 space-y-4" id="coupons_quick_suggest_panel">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <h4 className="text-sm font-black text-primary flex items-center gap-1.5 uppercase tracking-wider">
              <Sparkles size={16} />
              Pre-Vetted Campaign Formulas
            </h4>
            <p className="text-xs text-on-surface-variant">Click to instantaneous loading standard restaurant growth templates.</p>
          </div>
          <span className="text-[10px] font-bold text-on-surface-variant/70 border border-outline-variant/20 px-2 py-1 rounded-lg">
            3 High-Performance Defaults
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {CAMPAIGN_PRESETS.map((preset, idx) => (
            <div
              key={idx}
              className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/10 hover:border-primary/20 transition flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-2">
                  <span className="font-mono text-xs font-black text-primary bg-primary/5 px-2 py-0.5 rounded-lg">
                    {preset.code}
                  </span>
                  <span className="text-[8px] font-black uppercase text-on-surface-variant/60 bg-on-surface/5 px-1.5 py-0.5 rounded-md">
                    {preset.badge}
                  </span>
                </div>
                <h5 className="text-xs font-bold text-on-surface">{preset.title}</h5>
                <p className="text-[10px] text-on-surface-variant/80 mt-1 mb-3 leading-relaxed">{preset.desc}</p>
              </div>

              <button
                onClick={() => handleApplyPreset(preset)}
                className="w-full py-1.5 bg-primary/10 text-primary text-[10px] font-black rounded-lg hover:bg-primary hover:text-white transition leading-none"
              >
                Apply Preset Template
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Create Coupon Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div key="showCreateModal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-surface-container-lowest rounded-[32px] shadow-2xl overflow-hidden border border-outline-variant/10 z-50"
            >
              <CouponForm
                key={newCoupon.code || "new-coupon"}
                mode="create"
                initialData={newCoupon}
                onSubmit={handleCreateCoupon}
                onClose={() => setShowCreateModal(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* EDIT COUPON MODAL */}
      <AnimatePresence>
        {editingCoupon && (
          <motion.div key="editingCoupon-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingCoupon(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm shadow-2xl"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-surface-container-lowest rounded-[32px] shadow-2xl overflow-hidden border border-outline-variant/10 z-50 text-left"
            >
              <CouponForm
                key={editingCoupon.id}
                mode="edit"
                initialData={{
                  code: editingCoupon.code,
                  discount_type: editingCoupon.discount_type,
                  discount_value: editingCoupon.discount_value,
                  min_order_value: editingCoupon.min_order_value || "",
                  expiry_date: editingCoupon.expiry_date || "",
                  is_active: editingCoupon.is_active,
                }}
                onSubmit={handleUpdateCoupon}
                onClose={() => setEditingCoupon(null)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export interface CouponFormProps {
  mode: "create" | "edit";
  initialData: {
    code: string;
    discount_type: "percentage" | "fixed";
    discount_value: string | number;
    min_order_value: string | number;
    expiry_date: string | null;
    is_active?: boolean;
  };
  onSubmit: (formData: {
    code: string;
    discount_type: "percentage" | "fixed";
    discount_value: string;
    min_order_value: string;
    expiry_date: string;
    is_active: boolean;
  }) => void | Promise<void>;
  onClose: () => void;
}

export const CouponForm: React.FC<CouponFormProps> = ({
  mode,
  initialData,
  onSubmit,
  onClose,
}) => {
  const [formData, setFormData] = useState({
    code: initialData.code || "",
    discount_type: initialData.discount_type || "percentage",
    discount_value:
      initialData.discount_value !== undefined && initialData.discount_value !== null
        ? String(initialData.discount_value)
        : "",
    min_order_value:
      initialData.min_order_value !== undefined && initialData.min_order_value !== null
        ? String(initialData.min_order_value)
        : "",
    expiry_date: initialData.expiry_date || "",
    is_active: initialData.is_active !== undefined ? initialData.is_active : true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void onSubmit(formData);
  };

  const discountVal = parseFloat(formData.discount_value);
  const hasValidDiscount = !isNaN(discountVal) && discountVal > 0;

  return (
    <form onSubmit={handleSubmit} className="p-8 space-y-6">
      <header className="flex justify-between items-center">
        <h3 className="text-2xl font-headline font-black text-on-surface tracking-tight">
          {mode === "create" ? "New Coupon Setup" : "Edit App Coupon Parameters"}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="p-2 hover:bg-surface-container rounded-full transition-colors cursor-pointer"
        >
          <X size={20} />
        </button>
      </header>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest ml-1">
            {mode === "create" ? "Voucher Code" : "Coupon Code Name (Static)"}
          </label>
          <input
            required
            type="text"
            placeholder="e.g. WELCOME10"
            value={formData.code}
            readOnly={mode === "edit"}
            onChange={(e) =>
              setFormData({
                ...formData,
                code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""),
              })
            }
            className={cn(
              "w-full px-4 py-3 rounded-2xl border border-outline-variant/10 outline-none transition-all font-mono font-bold uppercase",
              mode === "create"
                ? "bg-surface-container-low focus:border-primary/20"
                : "bg-on-surface/5 text-on-surface-variant/80 cursor-not-allowed select-none"
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest ml-1">
              Discount Type
            </label>
            <select
              value={formData.discount_type}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  discount_type: e.target.value as "percentage" | "fixed",
                })
              }
              className="w-full px-4 py-3 bg-surface-container-low rounded-2xl border border-outline-variant/10 outline-none transition-all font-bold appearance-none cursor-pointer"
            >
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed Flat R</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest ml-1">
              {mode === "create" ? "Discount Rate value" : "Discount Value rate"}
            </label>
            <input
              required
              type="number"
              placeholder={formData.discount_type === "percentage" ? "10" : "50"}
              value={formData.discount_value}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  discount_value: e.target.value,
                })
              }
              className="w-full px-4 py-3 bg-surface-container-low rounded-2xl border border-outline-variant/10 outline-none transition-all font-bold"
            />
          </div>
        </div>

        {/* Warning alerts */}
        {hasValidDiscount && formData.discount_type === "percentage" && discountVal > 50 && (
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 text-[10px] font-bold p-3 rounded-xl flex items-start gap-2 leading-relaxed">
            <Info size={16} className="shrink-0 text-amber-500 mt-0.5" />
            <span>
              <strong>High discount caution:</strong> A discount rate above 50% may result in net negative transaction fees. We suggest pairing this code with a higher minimum order threshold.
            </span>
          </div>
        )}

        {hasValidDiscount && formData.discount_type === "fixed" && discountVal > 150 && (
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 text-[10px] font-bold p-3 rounded-xl flex items-start gap-2 leading-relaxed">
            <Info size={16} className="shrink-0 text-amber-500 mt-0.5" />
            <span>
              <strong>Large Cash Back caution:</strong> R{discountVal} flat discounts can deplete margins quickly if the actual order totals are low. A min order limit of R300+ is advised.
            </span>
          </div>
        )}

        {/* Live Cart Scenario Estimate */}
        {hasValidDiscount && (
          (() => {
            const baseCart = 200;
            let saved = 0;
            if (formData.discount_type === "percentage") {
              saved = (baseCart * Math.min(100, discountVal)) / 100;
            } else {
              saved = discountVal;
            }
            const customerPays = Math.max(0, baseCart - saved);
            return (
              <div className="bg-surface-container-low p-3.5 rounded-2xl border border-outline-variant/10 text-[11px] space-y-1.5 label-card select-none">
                <p className="font-bold text-on-surface text-[10px] uppercase tracking-wider text-primary">
                  Live Cart Scenario Estimate (R200 Basket Size)
                </p>
                <div className="grid grid-cols-2 gap-1 text-on-surface-variant font-medium">
                  <div>Customer Discount:</div>
                  <div className="text-right font-black text-orange-600">-R{saved.toFixed(2)}</div>
                  <div>Estimated Basket Total:</div>
                  <div className="text-right font-black text-emerald-600">R{customerPays.toFixed(2)}</div>
                </div>
              </div>
            );
          })()
        )}

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest ml-1">
            {mode === "create" ? "Min Order Value (R)" : "Minimum order requirement (R)"}
          </label>
          <input
            type="number"
            placeholder={mode === "create" ? "0.00" : "e.g. 150"}
            value={formData.min_order_value}
            onChange={(e) =>
              setFormData({
                ...formData,
                min_order_value: e.target.value,
              })
            }
            className="w-full px-4 py-3 bg-surface-container-low rounded-2xl border border-outline-variant/10 focus:border-primary/20 outline-none transition-all font-bold"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest ml-1">
            {mode === "create" ? "Expiry Date (Optional)" : "Adjust expiration date (Optional)"}
          </label>
          <input
            type="date"
            value={formData.expiry_date}
            onChange={(e) =>
              setFormData({
                ...formData,
                expiry_date: e.target.value,
              })
            }
            className="w-full px-4 py-3 bg-surface-container-low rounded-2xl border border-outline-variant/10 focus:border-primary/20 outline-none transition-all font-bold cursor-pointer"
          />
        </div>

        {/* Active Slide switch toggler inside edit screen */}
        {mode === "edit" && (
          <div className="flex items-center justify-between p-3 bg-on-surface/5 rounded-2xl select-none">
            <div>
              <span className="text-xs font-bold text-on-surface block">Coupon is Active</span>
              <span className="text-[9px] text-on-surface-variant/80">Allows customers to apply this code on checkout.</span>
            </div>
            <button
              type="button"
              onClick={() =>
                setFormData({
                  ...formData,
                  is_active: !formData.is_active,
                })
              }
              className={cn(
                "font-black px-3 py-1.5 text-[9px] uppercase rounded-xl transition-all tracking-wider cursor-pointer",
                formData.is_active ? "bg-emerald-500 text-white" : "bg-zinc-300 text-zinc-700"
              )}
            >
              {formData.is_active ? "Active" : "Paused"}
            </button>
          </div>
        )}
      </div>

      {mode === "create" ? (
        <button
          type="submit"
          className="w-full py-3.5 bg-primary text-on-primary font-black rounded-xl shadow-lg hover:scale-[0.99] active:scale-95 transition-all text-xs cursor-pointer"
        >
          Create Coupon Code
        </button>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 bg-surface-container text-on-surface text-xs font-bold rounded-xl cursor-pointer hover:bg-surface-container-high transition"
          >
            Discard Changes
          </button>
          <button
            type="submit"
            className="flex-1 py-3 bg-primary text-on-primary text-xs font-bold rounded-xl shadow-lg cursor-pointer hover:bg-primary/90 transition"
          >
            Save Changes
          </button>
        </div>
      )}
    </form>
  );
};
