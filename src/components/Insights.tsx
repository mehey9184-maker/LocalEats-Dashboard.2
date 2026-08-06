import React, { useState, useEffect, useMemo } from "react";
import { TrendingUp, ShoppingBag, DollarSign, Star, BarChart2 } from "lucide-react";
import { Order, MenuItem, Shop, Review } from "../types";
import { supabase } from "../lib/supabase";

interface InsightsProps {
  orders: Order[];
  menuItems?: MenuItem[];
  loading?: boolean;
  currentShop: Shop | undefined;
}

export const Insights: React.FC<InsightsProps> = ({
  orders,
  currentShop,
}) => {

  const [reviews, setReviews] = useState<Review[]>([]);
  const [timeFilter, setTimeFilter] = useState<"today" | "7d" | "30d" | "all">("7d");

  const filteredOrders = useMemo(() => {
    const now = new Date();
    if (timeFilter === "today") {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      return orders.filter((o) => new Date(o.created_at) >= startOfToday);
    } else if (timeFilter === "7d") {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return orders.filter((o) => new Date(o.created_at) >= sevenDaysAgo);
    } else if (timeFilter === "30d") {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return orders.filter((o) => new Date(o.created_at) >= thirtyDaysAgo);
    }
    return orders;
  }, [orders, timeFilter]);

  useEffect(() => {
    const fetchReviews = async () => {
      if (!currentShop?.id) return;
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .eq("shop_id", currentShop.id)
        .order("created_at", { ascending: false });

      if (!error && data) setReviews(data);
    };
    fetchReviews();
  }, [currentShop?.id]);

  const totalRevenue = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0);
  }, [filteredOrders]);

  const completedOrdersCount = useMemo(() => {
    return filteredOrders.filter((o) => o.status === "completed").length;
  }, [filteredOrders]);

  const averageOrderValue = useMemo(() => {
    if (filteredOrders.length === 0) return 0;
    return totalRevenue / filteredOrders.length;
  }, [totalRevenue, filteredOrders]);

  return (
    <div className="w-full space-y-6">
      {/* Top Banner & Time Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-on-surface flex items-center gap-2">
            <BarChart2 className="text-primary" size={22} />
            <span>Store Performance Analytics</span>
          </h2>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Real-time revenue, order metrics, customer trends, and review analysis.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-2xl border border-outline-variant/15">
          {(["today", "7d", "30d", "all"] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setTimeFilter(filter)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer capitalize ${
                timeFilter === filter ? "bg-primary text-on-primary shadow-xs" : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {filter === "today" ? "Today" : filter === "7d" ? "7 Days" : filter === "30d" ? "30 Days" : "All Time"}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest p-5 rounded-3xl border border-outline-variant/15 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600">
            <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Gross Revenue</span>
            <DollarSign size={20} />
          </div>
          <h3 className="text-2xl font-black text-on-surface">R {totalRevenue.toFixed(2)}</h3>
          <p className="text-[10px] text-on-surface-variant">Total sales volume in period</p>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-3xl border border-outline-variant/15 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-primary">
            <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant font-mono">Total Orders</span>
            <ShoppingBag size={20} />
          </div>
          <h3 className="text-2xl font-black text-on-surface">{filteredOrders.length}</h3>
          <p className="text-[10px] text-emerald-600 font-bold">{completedOrdersCount} Completed</p>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-3xl border border-outline-variant/15 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-indigo-500">
            <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Avg Order Value</span>
            <TrendingUp size={20} />
          </div>
          <h3 className="text-2xl font-black text-on-surface">R {averageOrderValue.toFixed(2)}</h3>
          <p className="text-[10px] text-on-surface-variant">Average spend per basket</p>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-3xl border border-outline-variant/15 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-amber-500">
            <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Store Rating</span>
            <Star size={20} className="fill-amber-500 text-amber-500" />
          </div>
          <h3 className="text-2xl font-black text-on-surface">{currentShop?.rating || 4.8} / 5.0</h3>
          <p className="text-[10px] text-on-surface-variant">{reviews.length} Verified Customer Reviews</p>
        </div>
      </div>
    </div>
  );
};

export default Insights;
