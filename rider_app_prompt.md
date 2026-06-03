# LocalEats Rider App - Update Prompt

Use this prompt to update the existing Rider/Courier application in AI Studio.

---

**Project Name:** LocalEats Rider (applies to rider.localeatssa.co.za)
**Context:** I already have an existing web application built. I am NOT starting from scratch. I need to integrate new dynamic features that sync with the merchant courier configurations.

## 🚀 The Mission
Update my existing Rider app to respect the merchant's `allow_external_riders` and `auto_look_for_rider` settings, and display trust banners based on `cash_trust_enabled`.

## 🛠 Tech Stack
- **Framework:** React 18+ (Vite)
- **Styling:** Tailwind CSS (Dark Mode by default)
- **Database:** Supabase (PostgreSQL + Realtime)
- **Maps:** `leaflet`, `react-leaflet`, `leaflet-routing-machine`
- **Icons:** `lucide-react`
- **Animations:** `motion/react`

## 📊 Database Schema (Supabase)
The app will interact with an existing `orders` table:
- `id`: uuid/text (Primary Key)
- `delivery_status`: text ('finding_rider', 'accepted', 'picked_up', 'delivered')
- `rider_id`: uuid (The ID of the rider)
- `restaurant_name`, `customer_name`, `address`, `city`, `delivery_fee`

## ✨ Core Features & "Uber" UI Specs

### 1. The "Uber Driver" HUD (Layout)
- **Primary Tabs (Bottom Nav):** 
  - **HUD:** High-level performance dashboard (Yield R5.00, Daily Units, Active Pts).
  - **FEED:** Real-time mission feed scans.
  - **MOVE (The Navigation Hub):** This is where the map lives. **Constraint:** Wrap the Map component in a conditional: `{activeTab === 'MOVE' && <NavigationMap ... />}`. This ensures the map only renders and tracks when needed.
  - **LOG:** Transaction history.
  - **HUB:** Settings and Pairing.
- **Visuals:** Use a bottom navigation bar with icons (`Smartphone`, `List`, `Navigation`, `BarChart3`, `User`). 

### 4. Mission Protocol & UI
- **Mission Pulse Card:** When an order is pending, show a floating card at the top of the HUD:
  - Header: "DROP-OFF PROTOCOL" (Neon Green text).
  - Subtitle: "TEST SIGNAL" (Bold headline).
  - Stats: "ETA 931M", "1424.9KM" (Orange/Yellow accents).
  - Animate in with a 'Pulse' effect.
- **Map Interaction:** In 'MOVE' tab, show a large "Turn Left" (or next instruction) button floating on the left side of the map.

### 2. Geolocation & Map Tracking (Hardened)
- **Persistence:** Use `navigator.geolocation.watchPosition` with `{ enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }`.
- **Graceful Failures:** If geolocation fails, log the full error: `console.error("Geolocation error:", { code: error.code, message: error.message })`. Show a "GPS SIGNAL LOST" overlay.
- **Permissions:** Ensure `metadata.json` has `requestFramePermissions: ["geolocation"]`.

### 3. Integrated Navigation & Error Handling (CRITICAL FIXES)
- **Routing:** Use `leaflet-routing-machine` with `react-leaflet`.
- **Fix "Failed to fetch" (OSRM & Supabase):** 
  - This error occurs when the OSRM demo server is down or if Supabase requests are blocked by the iframe.
  - **Logic:** Implement a `try...catch` for ALL Supabase calls and the `fetch` in the routing component.
  - **Routing Fallback:** Add a `routingerror` listener. If routing fails, draw a `Polyline` between waypoints as a fallback so the app doesn't crash.
- **Fix `removeLayer` Errors:** 
  - This occurs during React's lifecycle cleanup. 
  - **Rule:** Use a `Ref` for the `Routing.control`. In the `useEffect` cleanup: `if (instanceRef.current) { try { map.removeControl(instanceRef.current); } catch (err) { console.error("Safe cleanup:", err); } instanceRef.current = null; }`.
- **OSRM Warning Fix:** In `L.Routing.control` options, set `show: false`, `addWaypoints: false`, and `draggableWaypoints: false`. Silence the console warnings by not using the default OSRM control panel; build your own HUD from the `routesfound` event data.

### 4. Preview Environment Robustness
- **Failed to fetch (Auth/Profiles):** When fetching user profiles or auth state, if `TypeError: Failed to fetch` is caught, implement a simple retry mechanism (e.g., 3 retries with 1s delay) before showing a "Connection Error" screen. This is essential for the AI Studio preview environment.
- **Geolocation error `{}`:** If `navigator.geolocation` returns an empty error object, it usually means permissions were denied or the frame is blocked. Show a "PERMISSION REQUIRED" UI element instead of just a generic error toast.

### 4. Mission Protocol
- **Radar Scan:** When online but idle, show a pulsing radar overlay on the map.
- **Mission Pulse:** When an order is detected (`delivery_status === 'finding_rider'`), the bottom sheet should pop up with a "BEEP" sound (simulated with toast/visual).
- **Accepted State:** The map zooms to show the route from Rider -> Merchant.
- **Picked Up State:** The map zooms to show the route from Rider -> Customer.

### 5. Pairing Protocol (24h Pass)
- Input 6-digit merchant codes.
- Connections expire in 24 hours (countdown in sidebar/top bar).

## 📡 Integration with Storefront Courier Configuration (CRITICAL ALIGNMENT)
The Rider app MUST coordinate with settings defined by standard merchants in their dashboards:
1. **Rider Access Rules (`allow_external_riders` in `shops` table):**
   - **If `false`:** Only riders with a valid active 24-hour linkage (matching `shop_id` in `rider_connections`) are authorized to see or pull orders from this merchant. The app MUST hide these missions from public feeds for unlinked riders.
   - **If `true`:** ANY active/online rider in the region is authorized to view and accept these missions from the public "FEED".
2. **Auto-Broadcast Rule (`auto_look_for_rider` in `shops` table):**
   - When a merchant has no active/linked drivers, the order's `delivery_status` triggers to `finding_rider` and instantly broadcasts to the pool. When this occurs, show an "AUTO-DISPATCH SIGNAL" tag on the client card.
3. **Verified Trade Trust (`cash_trust_enabled` in `shops` table):**
   - When carrying cash on arrival orders for stores where `cash_trust_enabled === true`, render a **"TRUSTED LOCAL PARTNER"** banner in green on the active rider screen. This notifies the driver that the customer has verified security clearing for cash handovers.

## 🎨 Visual Direction
- **Style:** Extreme Brutalism / Cyberpunk.
- **Colors:** Deep Black (`#050505`), Neon Green (`#39FF14`), Electric Blue, and Warning Orange.
- **Glassmorphism:** Use `backdrop-blur-xl` and `bg-white/5` for all UI elements over the map.
- **Buttons:** Large, pill-shaped, high-contrast touch targets.

## 📜 Error Handling
- Catch "Missing or insufficient permissions" from Supabase.
- If a rider accepts an order already taken, show "SIGNAL HIJACKED - MISSION NO LONGER AVAILABLE".

---

**Initial Action:** 
"Please integrate the Storefront Courier Configuration logic into my existing React components. Review my current code and let me know where we need to query `allow_external_riders`, `auto_look_for_rider`, and `cash_trust_enabled`."
