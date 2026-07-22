# LocalEats Client (Customer) App — Integration Guide & Prompt

Use this file to update the Customer-facing LocalEats application. It contains a copy-pasteable LLM prompt, a standard React component template, and Supabase interaction snippets to synchronize with the new automatic matching system.

---

## 📋 1. Copy-Paste LLM Prompt (Storefront UI & Trackers)

Copy and paste this entire prompt directly into the AI Studio agent representing the **Client/Storefront App**:

```text
Update the customer order tracking UI to support multi-tiered automated courier ETAs, pending states, and trust indicators:

1. READ DATABASE CONFIGURATIONS:
   Query "allow_external_riders", "auto_look_for_rider", and "cash_trust_enabled" from the "shops" table associated with the current order's shop_id.

2. HANDLE THE PENDING ORDER STATE ELEGANTLY:
   - When the order's "status" is 'pending' AND "delivery_status" is 'finding_rider', display a prominent, active search status card: "Pending: Looking for a Rider. 📡"
   - Explain to the customer that the system has automatically dispatched a regional courier search and will begin food preparation as soon as a rider claims the trip.

3. MULTI-TIERED COURIER ETA & LABELS:
   - If the store has "allow_external_riders" enabled (true), show the ETA tag: "📡 Linked directly to LocalEats Public Fleet — nearby rider search active."
   - If "allow_external_riders" is disabled (false), show: "🚴 Serviced exclusively by [Shop Name]'s dedicated private couriers."

4. CASH ON ARRIVAL TRUST BOOSTER BANNER:
   - Check the shop's "cash_trust_enabled" flag. If true, display a warm emerald/teal trust badge in the checkout summary and active order details:
   - "💵 Pay safely with Cash on Arrival! First-time customer? Pay only when your food is safely in hand. Trust-Builder Active."
```

---

## 🎨 2. Standard React Component Template (`OrderTrackingCard.tsx`)

This high-fidelity, responsive React component demonstrates how to handle the customer-facing views cleanly with standard Tailwind CSS and Lucide Icons.

```tsx
import React from "react";
import { ShieldCheck, Truck, Clock, Sparkles } from "lucide-react";

interface Order {
  id: string;
  status: "pending" | "accepted" | "preparing" | "completed" | "cancelled";
  delivery_status: "finding_rider" | "accepted" | "picked_up" | "delivered" | "cancelled" | null;
  order_type: "delivery" | "collection";
  restaurant_name: string;
  total_price: number;
}

interface ShopConfig {
  id: string | number;
  name: string;
  cash_trust_enabled: boolean;
  allow_external_riders: boolean;
  auto_look_for_rider: boolean;
}

interface OrderTrackingCardProps {
  order: Order;
  shop: ShopConfig;
}

export const OrderTrackingCard: React.FC<OrderTrackingCardProps> = ({ order, shop }) => {
  const isFindingRider = order.delivery_status === "finding_rider";
  const isPending = order.status === "pending";

  return (
    <div className="w-full max-w-xl mx-auto space-y-5 p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm transition-all duration-300">
      
      {/* HEADER: Dynamic Status Indicator */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
          Order Status
        </span>
        <span className="text-xs font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2.5 py-1 rounded-lg">
          #{order.id.slice(0, 8)}
        </span>
      </div>

      {/* 1. Pending: Looking for a Rider matching state */}
      {isPending && isFindingRider && (
        <div className="p-5 bg-amber-500/10 border-2 border-amber-500/20 rounded-2xl flex gap-4 items-start animate-pulse">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-600 shrink-0">
            <Clock size={20} />
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-sm text-amber-800 dark:text-amber-400">
              Pending: Looking for a Rider
            </h4>
            <p className="text-xs text-amber-700/80 dark:text-amber-500/80 leading-relaxed font-medium">
              We have automatically dispatched a regional courier match request. Your food preparation begins immediately when a driver accepts!
            </p>
          </div>
        </div>
      )}

      {/* 2. Logistic Dispatch Classification Label */}
      <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl space-y-3">
        <div className="flex items-center gap-3 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          <Truck size={16} className="text-zinc-400 shrink-0" />
          <span>
            {shop.allow_external_riders ? (
              <span className="flex items-center gap-1.5 text-coral">
                📡 Linked directly to <strong className="font-bold">LocalEats Public Fleet</strong>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                🚴 Serviced by <strong className="font-bold">{shop.name}'s private team</strong>
              </span>
            )}
          </span>
        </div>
        
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium pl-7 leading-normal">
          {shop.allow_external_riders 
            ? "Your order is broadcasted to our public courier pool for rapid fulfillment."
            : "This shop processes its own deliveries to guarantee personal care."
          }
        </p>
      </div>

      {/* 3. Cash on Arrival Trust Booster Banner */}
      {shop.cash_trust_enabled && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex gap-3.5 items-start">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-600 shrink-0 mt-0.5">
            <ShieldCheck size={18} />
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-1">
              <Sparkles size={12} /> Cash-on-Arrival Trust Active
            </p>
            <p className="text-[11px] text-emerald-700/90 dark:text-emerald-500/90 font-medium leading-relaxed">
              Pay safely in cash once your hot Kota or Braai is in your hands. No prior upfront risk.
            </p>
          </div>
        </div>
      )}
      
    </div>
  );
};
```

---

## 🗄️ 3. Supabase Interaction Snippets (Client App)

Use this TypeScript snippet inside your storefront hooks or services to fetch the order and its linked shop configurations in a single lookup:

```typescript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient("YOUR_SUPABASE_URL", "YOUR_SUPABASE_ANON_KEY");

export async function fetchOrderWithShopConfig(orderId: string) {
  try {
    // 1. Fetch the active order details
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError) throw orderError;
    if (!order) return null;

    // 2. Fetch the corresponding shop configuration
    const { data: shop, error: shopError } = await supabase
      .from("shops")
      .select("id, name, cash_trust_enabled, allow_external_riders, auto_look_for_rider")
      .eq("id", order.shop_id)
      .single();

    if (shopError) {
      console.warn("Shop metadata fetch failed, using safe defaults:", shopError);
      return {
        order,
        shop: {
          id: order.shop_id,
          name: order.restaurant_name || "Local Shop",
          cash_trust_enabled: false,
          allow_external_riders: true,
          auto_look_for_rider: true,
        },
      };
    }

    return { order, shop };
  } catch (err) {
    console.error("Failed to load active tracking state:", err);
    throw err;
  }
}

/**
 * Hook up a Real-time listener for client tracking
 */
export function subscribeToOrderUpdates(orderId: string, onUpdate: (payload: any) => void) {
  const channel = supabase
    .channel(`client_order_tracking_${orderId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "orders",
        filter: `id=eq.${orderId}`,
      },
      (payload) => {
        console.log("Real-time order sync received:", payload.new);
        onUpdate(payload.new);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
```
