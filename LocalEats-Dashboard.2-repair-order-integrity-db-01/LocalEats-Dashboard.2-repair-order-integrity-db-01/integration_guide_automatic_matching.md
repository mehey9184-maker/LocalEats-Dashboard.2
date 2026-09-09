# LocalEats Automated Rider Matching — Integration & Prompting Guide

This document defines the end-to-end automated rider-matching protocol implemented on the LocalEats platform. It details how the **Merchant Dashboard (this app)**, **Client Storefront**, and **Rider Courier App** sync seamlessly via Supabase database state, RLS policies, and real-time updates.

---

## 🧭 System Architecture & Order States

An order's state is governed by two fields in the `orders` table:
1. `status`: `'pending'` | `'accepted'` | `'preparing'` | `'completed'` | `'cancelled'` (Main business state)
2. `delivery_status`: `null` | `'finding_rider'` | `'accepted'` | `'picked_up'` | `'delivered'` | `'cancelled'` (Logistic dispatch state)

### State Lifecycle Workflow:
1. **Order Creation (Client App)**:
   - Status defaults to `'pending'`.
   - `delivery_status` is initialized as `null` (or `'none'`).
   - `order_type` is `'delivery'`.
2. **Automated Matching Kick-off (Merchant/Backend)**:
   - As soon as the order arrives, the system automatically runs the matchmaker: `delivery_status` transitions to `'finding_rider'`.
   - The main order `status` remains `'pending'`.
   - *Client UI displays*: `"Pending: Looking for a Rider."`
3. **Rider Acceptance (Rider App)**:
   - A rider claims the mission: sets `rider_id = auth.uid()` and transitions `delivery_status` to `'accepted'`.
   - At the same time, the main order `status` automatically transitions to `'preparing'` to notify the merchant kitchen and the customer that food preparation has officially started!
   - *Client UI displays*: `"Preparing: Rider Assigned."`

---

## 🔒 1. Updated Database RLS Policies

To enforce strict, automated privacy and visibility (only making missions visible to authorized/linked riders and ensuring they instantly disappear once accepted), apply these rules to your Supabase PostgreSQL instance:

```sql
-- 1. Allow any authenticated rider to VIEW unassigned "finding_rider" missions
DROP POLICY IF EXISTS "Riders can view unassigned live missions" ON orders;
CREATE POLICY "Riders can view unassigned live missions"
ON orders FOR SELECT
TO authenticated
USING (
  delivery_status = 'finding_rider' 
  AND (rider_id IS NULL OR rider_id::text = '' OR rider_id::text = 'null')
  AND (status = 'pending' OR status = 'accepted' OR status = 'preparing')
  AND (
    -- Case A: The shop allows external/public riders
    EXISTS (
      SELECT 1 FROM shops 
      WHERE shops.id = orders.shop_id 
      AND (shops.allow_external_riders = true OR shops.allow_external_riders IS NULL)
    )
    OR
    -- Case B: The rider is linked to the shop
    EXISTS (
      SELECT 1 FROM rider_connections 
      WHERE rider_connections.shop_id = orders.shop_id 
      AND rider_connections.rider_id::text = auth.uid()::text
    )
  )
);
```

### 💡 Why this is Bulletproof:
- **Automatic Multi-Tier Visibility**: If a merchant toggles off "Independent Rider Fleet" (`allow_external_riders = false`), the order is *strictly private*—only riders connected via `rider_connections` can see or accept it. If enabled, any public/fleet courier can accept it.
- **Instant Auto-Disappear**: As soon as a rider updates the order and sets themselves as `rider_id`, the `rider_id IS NULL` check fails. The order instantly disappears from all other riders' feeds automatically.

---

## 📱 2. Client Storefront App — Integration Prompt & Code

Use this prompt to update the **LocalEats Client/Customer App** so it reads the merchant's configurations and shows the correct high-trust states.

### Copy-Paste Prompt for Client App:
```text
Update the customer order tracking UI to support multi-tiered automated courier ETAs and trust indicators:
1. When fetching the active order, query "allow_external_riders" and "auto_look_for_rider" from the associated "shops" table:
   - If the merchant has both enabled, show the ETA label: "📡 Linked directly to LocalEats Public Fleet — nearby rider search activates on prep completion."
   - If only in-house is allowed: "🚴 Serviced exclusively by [Shop Name]'s dedicated private couriers."
2. Handle the "Pending" order state elegantly:
   - If "delivery_status" is 'finding_rider' and the main "status" is 'pending', display a prominent status card: "Pending: Looking for a Rider. 📡"
3. Read the shop's "cash_trust_enabled" flag. If true, display a warm green confidence badge below the checkout summary:
   - "💵 Pay safely with Cash on Arrival! First-time customer? Pay only when your food is safely in hand. Trust-Builder Active."
```

### React Implementation Snippet (Client App):
```tsx
import React from 'react';
import { ShieldCheck, Truck, Clock } from 'lucide-react';

interface OrderTrackingProps {
  order: {
    status: string;
    delivery_status: string;
    order_type: string;
    restaurant_name: string;
  };
  shop: {
    cash_trust_enabled: boolean;
    allow_external_riders: boolean;
  };
}

export const OrderTrackingCard: React.FC<OrderTrackingProps> = ({ order, shop }) => {
  const isFindingRider = order.delivery_status === 'finding_rider';
  
  return (
    <div className="space-y-4 p-6 bg-white rounded-3xl border border-gray-100 shadow-sm">
      {/* 1. Pending / Looking for Rider Status Indicator */}
      {order.status === 'pending' && isFindingRider && (
        <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3">
          <Clock className="text-amber-500 shrink-0 mt-0.5 animate-pulse" size={18} />
          <div>
            <h4 className="font-bold text-amber-900 text-sm">Looking for a Rider</h4>
            <p className="text-xs text-amber-700 mt-0.5">
              The platform is automatically matching your order with the nearest available courier.
            </p>
          </div>
        </div>
      )}

      {/* 2. Multi-Tiered Courier ETA Text */}
      <div className="flex items-center gap-2.5 text-xs text-gray-500 font-medium">
        <Truck size={14} className="text-gray-400" />
        <span>
          {shop.allow_external_riders 
            ? `📡 Linked directly to LocalEats Public Fleet — nearby rider search active.`
            : `🚴 Serviced exclusively by ${order.restaurant_name}'s dedicated private couriers.`
          }
        </span>
      </div>

      {/* 3. Cash on Arrival Trust Booster Banner */}
      {shop.cash_trust_enabled && (
        <div className="p-3 bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 rounded-xl flex items-center gap-2.5">
          <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
          <p className="text-[11px] font-medium leading-relaxed">
            <strong>💵 Pay safely with Cash on Arrival!</strong> Pay only when your food is safely in hand. Trust-Builder Active.
          </p>
        </div>
      )}
    </div>
  );
};
```

---

## 🚴 3. Rider App — Integration Prompt & Code

Use this prompt to update the **LocalEats Rider App** to support instant accepting, filtering, and real-time feed removal.

### Copy-Paste Prompt for Rider App:
```text
Update the Rider delivery mission feed and accept protocol to support the dynamic merchant routing system:
1. Real-time Mission Feed: Query from the "orders" table where "delivery_status" equals 'finding_rider' and "rider_id" is null/empty.
2. In the "orders" query, filter so the rider can only see the order if the shop allows public fleet ("allow_external_riders" is true) OR if the rider has an active connection record inside the "rider_connections" table for that shop.
3. Accept Request Action: When a rider clicks "Accept Delivery":
   - Update the order in Supabase: set "rider_id" to the authenticated rider's ID, change "delivery_status" to 'accepted', and automatically transition the main order "status" to 'preparing'.
   - This ensures the merchant dashboard immediately starts cooking as soon as the courier commits!
```

### React Implementation Snippet (Rider App Accept Action):
```typescript
import { SupabaseClient } from '@supabase/supabase-js';

export const acceptDeliveryMission = async (
  supabase: SupabaseClient,
  orderId: string,
  riderId: string,
  riderName: string,
  riderPhone: string
) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .update({
        rider_id: riderId,
        rider_name: riderName,
        rider_phone: riderPhone,
        delivery_status: 'accepted',
        // Auto-triggers merchant kitchen preparation state!
        status: 'preparing' 
      })
      .eq('id', orderId)
      .eq('delivery_status', 'finding_rider') // Optimistic lock protection
      .select()
      .single();

    if (error) throw error;
    return { success: true, order: data };
  } catch (error) {
    console.error('Error accepting delivery mission:', error);
    return { success: false, error };
  }
};
```

---

## 🧪 4. End-to-End Validation Plan

To test this complete automated loop end-to-end:
1. **Toggle Settings**: On the merchant app's *Rider Network* tab, toggle **Auto-Find On-Demand Search** to `ON`.
2. **Place Order**: Create a test order (type `delivery`) using the sandbox panel.
3. **Automatic Search**: Observe that the moment the order is added, the merchant receives a toast notification stating that the order has automatically entered rider-matching mode (`delivery_status` changes to `'finding_rider'`, but `status` remains `'pending'`).
4. **Rider Visibility**: Logs and network tabs will show the order appearing in the active feed for linked riders (and public riders, if allowed).
5. **Accept Handshake**: Simulate a rider accepting the trip. Once accepted, the dashboard automatically transitions to the `preparing` tab and food production begins instantly!
