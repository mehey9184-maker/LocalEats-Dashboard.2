# LocalEats Client (Customer) App - Update Prompt

Use this prompt to update the existing Customer-facing LocalEats application in AI Studio.

---

**Project Name:** LocalEats Client (applies to localeatssa.co.za)
**Context:** I already have an existing web application built. I am NOT starting from scratch. I need to integrate new dynamic features that sync with the merchant courier configurations.

## 🚀 The Mission
Update my existing storefront app to read the newly added configuration fields from the `shops` table. It must dynamically present payment trust badges and courier ETA layers based on what the merchant has configured.

## 🛠 Tech Stack
- **Framework:** React 18+ (Vite)
- **Styling:** Tailwind CSS (Clean, warm light theme by default)
- **Database:** Supabase (PostgreSQL + Realtime matching)
- **Animations:** `motion/react` (Smooth, high-fidelity gesture sheet transitions)
- **Icons:** `lucide-react`

## 📊 Shared Database Integration (`shops` and `orders`)
Your app reads from the existing public database schema:
- **`shops` Table Fields:**
  - `id`: uuid/int64
  - `name`: text
  - `image_url`: text
  - `cash_trust_enabled`: boolean (Dynamic trust configuration flag)
  - `allow_external_riders`: boolean
  - `auto_look_for_rider`: boolean
- **`orders` Table Fields:**
  - `id`: uuid (Primary Key)
  - `shop_id`: bigInt
  - `status`: text ('pending', 'accepted', 'preparing', 'completed', 'cancelled')
  - `delivery_status`: text (null, 'finding_rider', 'accepted', 'picked_up', 'delivered')
  - `order_type`: text ('delivery', 'pickup')
  - `payment_method`: text ('cash', 'card_online')

---

## 💎 Core Features & High-Trust UI Specs

### 1. Storefront Detail view & "Trust-Builder" Broadcast (CRITICAL ALIGNMENT)
- **Check dynamic conditions:** When loading a shop's menu screen, query `cash_trust_enabled` from that shop's database row.
- **Micro-Copy Trust Banner:** If `cash_trust_enabled` is **`true`**, display a high-visibility, cozy confidence badge right below the restaurant name:
  - **Visual:** A soft, high-contrast amber/green banner (`bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 px-3 py-2.5 rounded-xl flex items-center gap-2.5`).
  - **Copy:** **"💵 Pay safely with Cash on Arrival! First-time customer? Pay only when your food is safely in hand. Trust-Builder Active."**
  - **Benefit:** Instantly lowers friction for cautious shoppers, driving massive conversions.

### 2. Multi-Tiered Courier ETA & Trackers
- When an order is placed, query `allow_external_riders` and `auto_look_for_rider` to set expectation layers:
  - If the store utilizes **both in-house and public-fleet on-demand search**, show: *"📡 Linked directly to LocalEats Public Fleet — nearby rider search activates on prep completion."*
  - If locked to in-house: *"🚴 Serviced exclusively by {Shop Name}'s dedicated private couriers."*

### 3. Bulletproof Presentation Fallbacks (Zero-Downtime Guarantee)
- **Offline / Sandbox Guardrails:** In test previews, database connections can occasionally block due to third-party frames or sleep status.
- **Rule:** Implement a dual-write fallback.
  - If reading `shops` returns a network error, search `localStorage` for cached shop stats, or fall back to pre-populated high-fidelity local templates rather than presenting an empty screen or throwing crash popups!
  - Always fail silently with graceful user-facing suggestions (e.g. *"Optimizing network coverage... displaying cached local menu"*).

### 4. Interactive Cart & Township Checkout Flow
- Simple checkout sheet that slides up from the bottom.
- Toggle between Payment Methods:
  - **Instant EFT / Card** (Simulated or Paystack gateway)
  - **Cash on Arrival** (Highlighted with a green trust lock if enabled by merchant)

---

## 🎨 Visual Identity
- **Style:** Minimalist Swiss Modernism. Generous off-whites (`#F9F9FB`), refined charcoal headings, and rich orange/coral (`#FF5A36`) action elements.
- **Layout Rhythm:** Large card blocks, spacious layout paddings, distinct touch targets (minimum 46px), and crisp border separators.

---

**Initial Action:**
"Please review my current storefront and checkout components, and implement the dynamic Trust-Builder badges and Courier ETA trackers based on the merchant's configuration (`cash_trust_enabled`, `allow_external_riders`, `auto_look_for_rider`)."
