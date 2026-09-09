# LocalEats Rider App — Integration Guide & Prompt

Use this file to update the Rider/Courier application. It contains a copy-pasteable LLM prompt, a standard React component template, and Supabase interaction snippets to synchronize with the new automatic matching system.

---

## 📋 1. Copy-Paste LLM Prompt (Mission Feed & Accept Flow)

Copy and paste this entire prompt directly into the AI Studio agent representing the **Rider/Courier App**:

```text
Update the Rider delivery mission feed and accept protocol to support the dynamic merchant routing system:

1. REAL-TIME MISSION FEED QUERY (CRITICAL MATCHING RULE):
   - Query available delivery orders where "delivery_status" is equal to 'finding_rider' AND "rider_id" is null, empty, or 'null'.
   - BUT, enforce the Merchant Fleet Filter:
     - Allow the rider to see the order IF the associated shop has "allow_external_riders" set to true (external fleet).
     - OR, allow the rider to see the order if they are linked to the shop (i.e. they have an active record inside the "rider_connections" table matching the order's shop_id and the current rider's auth ID).
     - Filter out any other orders.

2. MISSION CARDS WITH BRAND SIGNALING:
   - If "cash_trust_enabled" is true on the merchant shop, render a "TRUSTED LOCAL PARTNER" badge in warning orange or neon green. This alerts the courier that cash-on-arrival handling is verified and safe.
   - If "allow_external_riders" is true, show a "📡 Public Fleet" tag. If false, show a "🔒 Private Contract" tag.

3. OPTIMISTIC MUTUAL HANDSHAKE ON ACCEPT:
   - When a rider clicks "ACCEPT DELIVERY MISSION":
     - Update the order in Supabase: Set "rider_id" to the logged-in rider's auth.uid(), update "rider_name", "rider_phone", set "delivery_status" to 'accepted', and set the order's main "status" to 'preparing'!
     - Doing this automatically boots the merchant app kitchen into active cooking state immediately, minimizing courier wait times at the shop!
     - If the write fails because another rider already updated it, show a clear brutalist warning toast: "SIGNAL HIJACKED - MISSION TAKEN BY ANOTHER COURIER!" and instantly wipe it from the screen.
```

---

## 🎨 2. Standard React Component Template (`RiderMissionCard.tsx`)

This cyberpunk-themed, high-contrast React component demonstrates how to handle the courier-facing active list with standard Tailwind CSS and Lucide Icons.

```tsx
import React, { useState } from "react";
import { Bike, ShieldAlert, Zap, Compass, CheckCircle2 } from "lucide-react";

interface Mission {
  id: string;
  shop_id: string | number;
  restaurant_name: string;
  address: string;
  delivery_fee: number;
  price: number;
  payment_method: string;
}

interface ShopMetadata {
  id: string | number;
  cash_trust_enabled: boolean;
  allow_external_riders: boolean;
}

interface RiderMissionCardProps {
  mission: Mission;
  shopMeta: ShopMetadata;
  onAccept: (missionId: string) => Promise<boolean>;
}

export const RiderMissionCard: React.FC<RiderMissionCardProps> = ({
  mission,
  shopMeta,
  onAccept,
}) => {
  const [isAccepting, setIsAccepting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const handleAccept = async () => {
    setIsAccepting(true);
    setErrorText(null);
    try {
      const success = await onAccept(mission.id);
      if (!success) {
        setErrorText("SIGNAL HIJACKED - MISSION NO LONGER AVAILABLE");
      }
    } catch {
      setErrorText("TRANSMISSION ERROR - PLEASE TRY AGAIN");
    } finally {
      setIsAccepting(false);
    }
  };

  return (
    <div className="w-full bg-[#0d0d0d] border-2 border-zinc-800 rounded-3xl p-5 font-sans space-y-4 shadow-lg text-white hover:border-[#39FF14]/30 transition-all duration-300">
      
      {/* Top Banner Row */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-full text-zinc-400">
          <Zap size={10} className="text-[#39FF14]" />
          Unassigned Mission
        </span>
        <span className="text-sm font-black text-[#39FF14] tracking-tight">
          +R {mission.delivery_fee.toFixed(2)}
        </span>
      </div>

      {/* Main Details */}
      <div className="space-y-1.5">
        <h4 className="text-lg font-black tracking-tight text-zinc-100">
          {mission.restaurant_name}
        </h4>
        <p className="text-xs text-zinc-400 font-medium leading-relaxed flex items-center gap-1.5">
          <Compass size={14} className="text-zinc-500" />
          {mission.address}
        </p>
      </div>

      {/* Sub-Badges Row */}
      <div className="flex flex-wrap gap-2 pt-1">
        {/* Public Fleet status banner */}
        {shopMeta.allow_external_riders ? (
          <span className="text-[9px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded">
            📡 Public Fleet
          </span>
        ) : (
          <span className="text-[9px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded">
            🔒 Private Contract
          </span>
        )}

        {/* Trusted local partner - Cash Safety indicator */}
        {shopMeta.cash_trust_enabled && (
          <span className="text-[9px] font-bold uppercase tracking-wider bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded flex items-center gap-1">
            ⚡ Trusted Local Partner
          </span>
        )}
      </div>

      {/* Cash Warning Panel */}
      {mission.payment_method === "Cash" && (
        <div className="p-3 bg-orange-500/5 border border-orange-500/20 rounded-xl text-[10px] font-medium text-orange-400/90 leading-relaxed">
          ⚠️ Collect **R {(mission.price + mission.delivery_fee).toFixed(2)}** in cash directly from client on hand-over. Handshake limits apply.
        </div>
      )}

      {/* Error / Hijacked notification */}
      {errorText && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-2 items-center text-[10px] text-red-400 font-bold tracking-tight animate-bounce">
          <ShieldAlert size={14} className="shrink-0" />
          <span>{errorText}</span>
        </div>
      )}

      {/* Accept Button */}
      <button
        onClick={handleAccept}
        disabled={isAccepting || !!errorText}
        className="w-full bg-[#39FF14] hover:bg-[#32e011] text-black font-black uppercase text-xs tracking-widest py-3 px-4 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(57,255,20,0.15)] active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
      >
        {isAccepting ? (
          <div className="w-4.5 h-4.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <CheckCircle2 size={15} />
            Accept Delivery Mission
          </>
        )}
      </button>

    </div>
  );
};
```

---

## 🗄️ 3. Supabase Interaction Snippets (Rider App)

Use this TypeScript snippet inside your Rider/Courier dashboard hooks to fetch open missions and bind real-time acceptance transactions with optimistic lock protection:

```typescript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient("YOUR_SUPABASE_URL", "YOUR_SUPABASE_ANON_KEY");

/**
 * 1. Query available unassigned missions matching multi-tiered rules.
 * This should feed the Rider Feed list.
 */
export async function queryAvailableMissions(riderId: string) {
  try {
    // We select orders needing riders
    const { data: orders, error } = await supabase
      .from("orders")
      .select(`
        *,
        shops (
          cash_trust_enabled,
          allow_external_riders
        )
      `)
      .eq("delivery_status", "finding_rider")
      .or("rider_id.is.null,rider_id.eq.,rider_id.eq.null")
      .order("created_at", { ascending: false });

    if (error) throw error;
    if (!orders) return [];

    // Filter list client-side to enforce rider-connections rule in case PostgreSQL RLS is sleeping
    // Get rider's shop connection records
    const { data: connections } = await supabase
      .from("rider_connections")
      .select("shop_id")
      .eq("rider_id", riderId);

    const connectedShopIds = new Set(connections?.map((c) => c.shop_id) || []);

    return orders.filter((order: any) => {
      const shop = order.shops;
      // Allow if shop has allow_external_riders set to true
      if (shop?.allow_external_riders === true || shop?.allow_external_riders === null) {
        return true;
      }
      // Or allow if rider is linked/connected to this shop
      if (connectedShopIds.has(order.shop_id)) {
        return true;
      }
      return false;
    });
  } catch (err) {
    console.error("Error loading open delivery feed:", err);
    return [];
  }
}

/**
 * 2. Optimistic mutual accept function.
 * Sets the rider_id and pushes BOTH status fields at once.
 */
export async function acceptDeliveryMission(
  orderId: string,
  riderId: string,
  riderName: string,
  riderPhone: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("orders")
      .update({
        rider_id: riderId,
        rider_name: riderName,
        rider_phone: riderPhone,
        delivery_status: "accepted",
        // Crucial: Set main status to 'preparing' to notify the merchant kitchen and client immediately!
        status: "preparing",
      })
      .eq("id", orderId)
      .eq("delivery_status", "finding_rider") // Optimistic lock protection
      .select();

    if (error || !data || data.length === 0) {
      console.warn("Optimistic update failed - Order already claimed or locked.");
      return false;
    }

    return true;
  } catch (err) {
    console.error("Transmission error accepting mission:", err);
    return false;
  }
}
```
