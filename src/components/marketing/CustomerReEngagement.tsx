import React, { useState, useMemo } from "react";
import {
  Users,
  Search,
  MessageSquare,
  Sparkles,
  Phone,
  Copy,
  Check,
  Star,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { Shop, Order, MenuItem } from "../../types";

interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  email?: string;
  orderCount: number;
  totalSpent: number;
  lastOrderDate: string;
  lastOrderId: string;
  lastOrderItems: string[];
  daysSinceLastOrder: number;
  isVip: boolean;
  isRecent: boolean;
  isInactive: boolean;
}

interface CustomerReEngagementProps {
  activeShop: Shop | undefined;
  orders: Order[];
  menuItems: MenuItem[];
  storeUrl: string;
}

function sanitizeWhatsAppPhone(phoneStr: string): string {
  const digits = phoneStr.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 10) {
    return "27" + digits.slice(1);
  }
  if (digits.startsWith("27")) {
    return digits;
  }
  return digits;
}

function formatDisplayPhone(phoneStr: string): string {
  const digits = phoneStr.replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("0")) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  return phoneStr;
}

export const CustomerReEngagement: React.FC<CustomerReEngagementProps> = ({
  activeShop,
  orders = [],
  menuItems = [],
  storeUrl,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "vip" | "recent" | "inactive">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [customOfferText, setCustomOfferText] = useState("10% OFF with code LOYAL10");

  const shopName = activeShop?.name || "LocalEats";
  const now = new Date().getTime();

  // Compile unique customer profiles from past orders
  const customers: CustomerProfile[] = useMemo(() => {
    const map = new Map<string, CustomerProfile>();

    // Sort orders from oldest to newest to build accurate cumulative stats
    const sortedOrders = [...orders].sort(
      (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
    );

    for (const order of sortedOrders) {
      const phone = (order.phone || "").trim();
      const name = (order.customer_name || "Valued Diner").trim();
      const key = phone || order.user_id || name;

      if (!key) continue;

      const orderTotal = Number(order.total_price || order.price || 0);
      const orderDateStr = order.created_at || new Date().toISOString();
      const orderTime = new Date(orderDateStr).getTime();
      const daysAgo = Math.max(0, Math.floor((now - orderTime) / (1000 * 60 * 60 * 24)));

      const itemNames: string[] = [];
      if (Array.isArray(order.items)) {
        order.items.forEach((it) => {
          if (typeof it === "string") itemNames.push(it);
          else if (it && it.name) itemNames.push(it.name);
        });
      } else if (order.product_name) {
        itemNames.push(order.product_name);
      }

      const existing = map.get(key);
      if (existing) {
        existing.orderCount += 1;
        existing.totalSpent += orderTotal;
        existing.lastOrderDate = orderDateStr;
        existing.lastOrderId = order.id;
        existing.daysSinceLastOrder = daysAgo;
        existing.name = name !== "Valued Diner" ? name : existing.name;
        if (itemNames.length > 0) {
          existing.lastOrderItems = itemNames;
        }
      } else {
        map.set(key, {
          id: key,
          name,
          phone,
          email: order.email,
          orderCount: 1,
          totalSpent: orderTotal,
          lastOrderDate: orderDateStr,
          lastOrderId: order.id,
          lastOrderItems: itemNames,
          daysSinceLastOrder: daysAgo,
          isVip: false,
          isRecent: daysAgo <= 14,
          isInactive: daysAgo > 14,
        });
      }
    }

    // Mark VIPs: either 3+ orders OR > R300 total spent
    const list = Array.from(map.values()).map((c) => ({
      ...c,
      isVip: c.orderCount >= 3 || c.totalSpent >= 300,
      isRecent: c.daysSinceLastOrder <= 14,
      isInactive: c.daysSinceLastOrder > 14,
    }));

    // Sort by most recent or highest spend
    return list.sort((a, b) => b.totalSpent - a.totalSpent);
  }, [orders, now]);

  // Executive Metrics
  const metrics = useMemo(() => {
    const totalDiners = customers.length;
    const repeatDiners = customers.filter((c) => c.orderCount >= 2).length;
    const activePast14Days = customers.filter((c) => c.isRecent).length;
    const vipDiners = customers.filter((c) => c.isVip).length;
    const totalRevenue = customers.reduce((sum, c) => sum + c.totalSpent, 0);
    const avgSpend = totalDiners > 0 ? totalRevenue / totalDiners : 0;

    return {
      totalDiners,
      repeatDiners,
      activePast14Days,
      vipDiners,
      totalRevenue,
      avgSpend,
      repeatRate: totalDiners > 0 ? Math.round((repeatDiners / totalDiners) * 100) : 0,
    };
  }, [customers]);

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      // Search
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.lastOrderItems.some((item) => item.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      // Filter type
      if (filterType === "vip") return c.isVip;
      if (filterType === "recent") return c.isRecent;
      if (filterType === "inactive") return c.isInactive;
      return true;
    });
  }, [customers, searchQuery, filterType]);

  // Generate personalized WhatsApp Re-Engagement message
  const getPersonalizedMessage = (customer: CustomerProfile) => {
    const firstName = customer.name.split(" ")[0] || "Valued Diner";
    const favItem = customer.lastOrderItems[0] || (menuItems[0]?.name ?? "our daily specials");

    if (customer.isVip) {
      return `🌟 *VIP SPECIAL FOR YOU, ${firstName.toUpperCase()}!* 👑\n\nHi ${firstName}, thank you for being one of *${shopName}'s* most loyal customers! ❤️\n\nWe're cooking fresh batches of ${favItem} today. Treat yourself and enjoy ${customOfferText} on your order!\n\n👉 *Order Online in 30 Seconds:*\n${storeUrl}\n\n🛵 Fast local delivery & cash/card accepted!`;
    }

    if (customer.isInactive) {
      return `👋 *WE MISS YOU AT ${shopName.toUpperCase()}!* 😋\n\nHi ${firstName}! It's been a little while since your last order of ${favItem}.\n\nSkip the kitchen today! Order your township favorites online with ${customOfferText}:\n\n👉 *View Live Menu & Order:*\n${storeUrl}\n\n🛵 Hot & fresh delivery right to your door!`;
    }

    return `🔥 *HELLO ${firstName.toUpperCase()} FROM ${shopName.toUpperCase()}!* 🍔\n\nCraving fresh food today? We're ready for your order!\n\n👉 *Order Online Here:*\n${storeUrl}\n\n⚡ Instant pickup or fast local delivery!`;
  };

  const handleSendWhatsApp = (customer: CustomerProfile) => {
    const phone = sanitizeWhatsAppPhone(customer.phone);
    if (!phone) {
      toast.error(`No valid phone number found for ${customer.name}`);
      return;
    }

    const message = getPersonalizedMessage(customer);
    const encoded = encodeURIComponent(message);
    const waUrl = `https://wa.me/${phone}?text=${encoded}`;
    window.open(waUrl, "_blank");
    toast.success(`Opening WhatsApp chat for ${customer.name}...`);
  };

  const handleCopyPhone = (customer: CustomerProfile) => {
    navigator.clipboard.writeText(customer.phone);
    setCopiedId(customer.id);
    toast.success(`Copied phone: ${customer.phone}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* 1. Executive Diner Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-surface-container-lowest p-5 rounded-3xl border border-outline-variant/15 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/70">
              Total Diners Reached
            </span>
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Users size={16} />
            </div>
          </div>
          <p className="text-2xl font-black font-headline text-on-surface mt-2">
            {metrics.totalDiners}
          </p>
          <p className="text-[11px] text-on-surface-variant/70 mt-0.5">
            Unique phone contacts compiled
          </p>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-3xl border border-outline-variant/15 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/70">
              Repeat Loyal Diners
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Star size={16} />
            </div>
          </div>
          <p className="text-2xl font-black font-headline text-emerald-600 mt-2">
            {metrics.repeatDiners}
          </p>
          <p className="text-[11px] text-on-surface-variant/70 mt-0.5">
            {metrics.repeatRate}% repeat customer rate
          </p>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-3xl border border-outline-variant/15 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/70">
              Active Past 14 Days
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <Clock size={16} />
            </div>
          </div>
          <p className="text-2xl font-black font-headline text-on-surface mt-2">
            {metrics.activePast14Days}
          </p>
          <p className="text-[11px] text-on-surface-variant/70 mt-0.5">
            Recent active buyers
          </p>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-3xl border border-outline-variant/15 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/70">
              Avg Diner Spend
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Sparkles size={16} />
            </div>
          </div>
          <p className="text-2xl font-black font-headline text-amber-600 mt-2">
            R {metrics.avgSpend.toFixed(0)}
          </p>
          <p className="text-[11px] text-on-surface-variant/70 mt-0.5">
            R {metrics.totalRevenue.toFixed(0)} lifetime volume
          </p>
        </div>
      </div>

      {/* 2. Re-Engagement Pitch Customizer Bar */}
      <div className="bg-surface-container-lowest p-5 rounded-3xl border border-outline-variant/15 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-black text-[10px] uppercase tracking-wider">
              1-Tap WhatsApp Re-Engagement
            </span>
          </div>
          <h4 className="text-sm font-black text-on-surface">
            Re-engage past customers with customized incentives
          </h4>
          <p className="text-xs text-on-surface-variant">
            Tap the WhatsApp button on any diner card to send a pre-filled invitation with your live store menu link.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <input
            type="text"
            value={customOfferText}
            onChange={(e) => setCustomOfferText(e.target.value)}
            placeholder="e.g. 10% OFF with code VIP10"
            className="w-full md:w-64 bg-surface-container-high border-none rounded-xl px-3.5 py-2 text-xs font-bold text-on-surface focus:ring-2 focus:ring-primary outline-none"
            title="Incentive added into WhatsApp re-engagement message"
          />
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/60" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search diners by name, phone, or past meals..."
            className="w-full pl-9 pr-4 py-2.5 bg-surface-container-lowest rounded-2xl border border-outline-variant/15 text-xs text-on-surface font-medium focus:ring-2 focus:ring-primary outline-none shadow-2xs"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shrink-0 overflow-x-auto">
          <button
            onClick={() => setFilterType("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterType === "all"
                ? "bg-primary text-on-primary shadow-xs"
                : "text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            All ({customers.length})
          </button>

          <button
            onClick={() => setFilterType("vip")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
              filterType === "vip"
                ? "bg-amber-500 text-white shadow-xs"
                : "text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            <Star size={12} />
            <span>VIPs ({metrics.vipDiners})</span>
          </button>

          <button
            onClick={() => setFilterType("recent")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterType === "recent"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            Active 14d ({metrics.activePast14Days})
          </button>

          <button
            onClick={() => setFilterType("inactive")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterType === "inactive"
                ? "bg-purple-600 text-white shadow-xs"
                : "text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            Lapsed 14d+ ({customers.length - metrics.activePast14Days})
          </button>
        </div>
      </div>

      {/* 4. Diners List Cards */}
      {filteredCustomers.length === 0 ? (
        <div className="bg-surface-container-lowest p-12 rounded-3xl border border-outline-variant/15 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-on-surface/5 flex items-center justify-center mx-auto text-on-surface-variant">
            <Users size={24} />
          </div>
          <h4 className="text-base font-bold text-on-surface">No Diners Found</h4>
          <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
            {searchQuery
              ? "No customers matched your search query. Try typing a different name or phone number."
              : "When customers order from your online storefront, their contact profiles will automatically compile here."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map((customer) => {
            const initials = customer.name
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")
              .toUpperCase() || "D";

            return (
              <div
                key={customer.id}
                className="bg-surface-container-lowest p-5 rounded-3xl border border-outline-variant/15 shadow-2xs hover:border-outline-variant/30 transition-all flex flex-col justify-between space-y-4"
              >
                {/* Header: Avatar, Name, VIP Pill */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 ${
                        customer.isVip
                          ? "bg-amber-500/15 text-amber-600 border border-amber-500/20"
                          : "bg-surface-container-high text-on-surface font-bold"
                      }`}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-sm text-on-surface truncate">
                          {customer.name}
                        </h4>
                        {customer.isVip && (
                          <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0" title="VIP Loyal Diner">
                            <Star size={10} className="fill-white" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-on-surface-variant font-mono truncate">
                        {formatDisplayPhone(customer.phone)}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 ${
                      customer.isRecent
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-purple-500/10 text-purple-600"
                    }`}
                  >
                    {customer.daysSinceLastOrder === 0
                      ? "Today"
                      : customer.daysSinceLastOrder === 1
                      ? "Yesterday"
                      : `${customer.daysSinceLastOrder}d ago`}
                  </span>
                </div>

                {/* Metrics row */}
                <div className="grid grid-cols-2 gap-2 p-2.5 bg-surface-container-low rounded-2xl border border-outline-variant/10 text-center">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-on-surface-variant/60 block">
                      Orders
                    </span>
                    <span className="text-xs font-black font-headline text-on-surface">
                      {customer.orderCount} {customer.orderCount === 1 ? "order" : "orders"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-on-surface-variant/60 block">
                      Total Spend
                    </span>
                    <span className="text-xs font-black font-headline text-emerald-600">
                      R {customer.totalSpent.toFixed(0)}
                    </span>
                  </div>
                </div>

                {/* Past favorites / items preview */}
                {customer.lastOrderItems.length > 0 && (
                  <div className="text-[11px] text-on-surface-variant truncate">
                    <span className="font-bold text-on-surface">Last order: </span>
                    <span>{customer.lastOrderItems.slice(0, 2).join(", ")}</span>
                  </div>
                )}

                {/* Actions: Send WhatsApp, Copy, Call */}
                <div className="flex items-center gap-2 pt-1 border-t border-outline-variant/10">
                  <button
                    onClick={() => handleSendWhatsApp(customer)}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                    title="Open WhatsApp chat with pre-written re-engagement message"
                  >
                    <MessageSquare size={14} />
                    <span>Send WhatsApp</span>
                  </button>

                  <button
                    onClick={() => handleCopyPhone(customer)}
                    className="w-9 h-9 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface flex items-center justify-center border border-outline-variant/20 transition-all cursor-pointer"
                    title="Copy phone number"
                  >
                    {copiedId === customer.id ? (
                      <Check size={14} className="text-emerald-500" />
                    ) : (
                      <Copy size={14} />
                    )}
                  </button>

                  {customer.phone && (
                    <a
                      href={`tel:${customer.phone}`}
                      className="w-9 h-9 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface flex items-center justify-center border border-outline-variant/20 transition-all cursor-pointer"
                      title="Call customer"
                    >
                      <Phone size={14} />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
export default CustomerReEngagement;
