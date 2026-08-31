# LocalEats Vendor App - Functionality & Architecture Documentation

**Application Name**: LocalEats Vendor (Merchant Dashboard & Operations Platform)  
**Platform**: React 18+ (Vite, TypeScript, Tailwind CSS, Framer Motion, Lucide React)  
**Backend & Persistence**: Google Cloud Firestore & Firebase Authentication (`src/lib/firebase.ts`) with Firestore Compatibility Bridge (`src/lib/supabase.ts`)

---

## 1. Executive Summary & Business Stakeholder Directives

LocalEats Vendor is the mission-critical merchant operating system for local food establishments and restaurants. Designed with Swiss-Modern aesthetics and high operational ergonomics, the app provides real-time order fulfillment, instant inventory controls, rider dispatch/handshake management, sales analytics, and thermal printer integration.

### Core Directives:
1. **Zero-Guesswork Location Engine**: All maps and shop locations prioritize numeric latitude (`lat`) and longitude (`lng`) floats over plain text addresses.
2. **Defensive Database & Cache Resilience**: Automatic fallback to local storage cache (`localStorage`) ensuring the vendor interface never crashes or stalls during intermittent network connectivity.
3. **High-Contrast Touch & Responsive UI**: Minimum 44-46px touch targets, warm coral accents (`#FF5A36`), bold charcoal typography, instant haptic and audible kitchen alerts.
4. **Autonomous Operational Reliability**: Self-contained background workflows for audio kitchen alarms, ESC/POS Bluetooth/USB thermal printing, and multi-channel notification systems.
5. **Stabilized Crash Recovery Protocol**: Max recovery attempts capped at 1; delegates fatal render errors directly to React's `ErrorBoundary` to prevent infinite reload loops and DOM manipulation clashes.

---

## 2. Verified Firebase Infrastructure & Persistence Architecture

The application is natively integrated with Google Cloud Firebase:
* **Firebase Project ID**: `localeats-5e26e`
* **Firestore Database Instance**: `ai-studio-localeatsvendord-a61b068b-3029-4d93-ba41-626b03a23bbe`
* **Firebase Authentication**: Email/password and Google provider sessions, with user profiles hydrated from `/users/{userId}`.
* **Firestore Security Rules**: Deployed version 2 security rules enforcing strict relational access control and default-deny policies.
* **Server-Authoritative Operations**: Authoritative mutations (e.g., `createOrder`, mission dispatch, payment settlement) run through server-side Cloud Functions / Admin SDK to guarantee financial integrity.

---

## 3. Core Data Models & Relational Ownership Architecture

### 3.1 Canonical User Model (`/users/{userId}`)
* Document path: `/users/{userId}` where `{userId}` equals the authenticated Firebase Auth `uid`.
* Users have exclusive read/write access to their own user profile document.
* Arbitrary public listing of user documents is blocked by default.

### 3.2 Shop Ownership Model (`/shops/{shopId}`)
* Document path: `/shops/{shopId}` (e.g. `/shops/18` for *My-Kota*).
* Schema stores `owner_id: string` matching the merchant's Firebase Auth `uid`.
* **Relational Ownership Resolution (`isShopOwner(shopId)`)**: Evaluates `exists(/databases/.../shops/$(string(shopId)))` and verifies `get(...).data.owner_id == request.auth.uid`.
* **Type-Cast Robustness**: Uses `string(shopId)` to seamlessly support both numeric (`18`) and string (`"18"`) identifiers.
* **Access Rules**: Public read for customer storefront discovery and vendor profile loading; write/update/delete restricted to the verified shop owner (`owner_id == auth.uid`).

### 3.3 Menu Items Model (`/menu_items/{itemId}`)
* Child documents storing `shop_id` (numeric or string) pointing to the parent `/shops/{shopId}`, `name`, `price`, `category`, `description` (unmodified plain text), `dietary_tags` (array of string tags, e.g. `["Vegetarian", "Spicy"]`), `stock_quantity`, `is_available`, and `image_url`.
* Does **not** require an `owner_id` field on the menu item itself.
* **Access Rules**:
  * `read`: Public read (`if true;`) enabling client app browsing and rider pickup inspection.
  * `create`: Restricted to the owner of the referenced shop via `isShopOwner(request.resource.data.shop_id)`.
  * `update`: Restricted to the shop owner with `unchanged('shop_id')` immobility.
  * `delete`: Restricted to the shop owner (`isShopOwner(resource.data.shop_id)`).
* **Realtime Sync**: Connected via Firestore `onSnapshot` channel `menu_items_{shopId}` for live item toggles.

### 3.4 Orders Model (`/orders/{orderId}`)
* Central fulfillment collection storing `shop_id`, `user_id` (customer), `rider_id` (assigned courier), `delivery_status`, and financial fields (`total_price`, `subtotal`, `delivery_fee`, `service_fee`, `payment_status`).
* **Creation Security**: Direct client creation is blocked (`allow create: if false;`). Order creation is strictly server-authoritative via the `createOrder` Cloud Function.
* **Read Access**: Authenticated customer reads own orders (`user_id == auth.uid`); merchant reads own shop orders (`isShopOwner(shop_id)`); riders read unassigned pool orders (`delivery_status == "finding_rider"`) or assigned orders (`rider_id == auth.uid`).
* **Update Security**: Operational transitions permitted (kitchen workflow `accepted` / `preparing` / `ready_for_pickup`) while financial fields, payment status, customer ID, and shop ID are strictly immutable (`orderFinancialsAndCoreUnchanged()`).

### 3.5 Rider Profiles Model (`/rider_profiles/{riderId}`)
* Stores courier operational fields: `id`, `full_name`, `phone`, `vehicle_type`, `status`, `is_online`, `current_latitude`, `current_longitude`, and `updated_at`.
* Stores server-managed fields: `total_earnings`, `total_deliveries`, `active_points`, `rating`, `verification_status`.
* **Current Authenticated-Read Architecture**: 
  * The Merchant Dashboard queries connected drivers via `supabase.from("rider_profiles").in("id", riderIds)` to render live map telemetry and driver contact cards.
  * `allow read: if isAuthenticated();` allows authenticated platform users to access active courier operational profiles.
  * *Security/Privacy Trade-off*: Documented known architectural trade-off necessary to support the current multi-ID query without breaking live map tracking.
  * *Future Planned Architecture (NOT CURRENT)*: Active delivery coordinates will be mirrored into `orders/{orderId}.rider_location` and driver display metadata embedded into `rider_connections`, enabling `/rider_profiles` to be locked to self-only reads.
* **Write Security**: Couriers can only update their own profile (`auth.uid == riderId`); server-managed financial, rating, and verification fields remain immutable (`riderFinancialsAndRatingsUnchanged()`).

### 3.6 Rider Connections Model (`/rider_connections/{connectionId}`)
* Manages merchant fleet pairings, handshake links, and Pairing Ciphers.
* Stores `shop_id`, `rider_id`, `status`, `is_verified`, and timestamps.
* **Access Rules**:
  * `read`: Permitted for the shop owner (`isShopOwner(shop_id)`) and the connected rider (`rider_id == auth.uid`).
  * `create`: Restricted to the shop owner inviting/pairing couriers.
  * `update`: Merchants manage full connection; riders may only update operational presence (`status`, `active_mission_id`, `updated_at`) with `shop_id` and `rider_id` locked.
  * `delete`: Restricted to the shop owner.

### 3.7 Chat Messages Model (`/chat_messages/{messageId}`)
* Order-scoped direct communication between customer, merchant, and assigned courier.
* Stores `order_id`, `shop_id`, `user_id`, `sender_id`, `sender_type`, `content`, `is_read`, `read_at`, `created_at`.
* **Access Rules**:
  * `read`: Restricted to verified order participants (`isOrderParticipant(resource.data.order_id)`).
  * `create`: Evaluates incoming payload (`isOrderParticipant(request.resource.data.order_id)`).
  * `update`: Strictly restricted to read-receipt timestamps via affected keys whitelist (`['is_read', 'read_at', 'updated_at']`).
  * `delete`: Blocked (`allow delete: if false;`).

---

## 4. Deployed Firestore Security Ruleset

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthenticated() {
      return request.auth != null;
    }

    function isShopOwner(shopId) {
      return isAuthenticated() &&
        exists(/databases/$(database)/documents/shops/$(string(shopId))) &&
        get(/databases/$(database)/documents/shops/$(string(shopId))).data.owner_id == request.auth.uid;
    }

    function isOrderParticipant(orderId) {
      let orderPath = /databases/$(database)/documents/orders/$(string(orderId));
      let orderData = exists(orderPath) ? get(orderPath).data : null;
      return isAuthenticated() && orderData != null && (
        orderData.user_id == request.auth.uid ||
        orderData.rider_id == request.auth.uid ||
        isShopOwner(orderData.shop_id)
      );
    }

    function unchanged(field) {
      return !(field in request.resource.data) || request.resource.data[field] == resource.data[field];
    }

    function orderFinancialsAndCoreUnchanged() {
      return unchanged('total_price') &&
             unchanged('subtotal') &&
             unchanged('delivery_fee') &&
             unchanged('service_fee') &&
             unchanged('payment_status') &&
             unchanged('payment_method') &&
             unchanged('user_id') &&
             unchanged('shop_id');
    }

    function riderFinancialsAndRatingsUnchanged() {
      return unchanged('total_earnings') &&
             unchanged('total_deliveries') &&
             unchanged('active_points') &&
             unchanged('rating') &&
             unchanged('verification_status');
    }

    match /{document=**} {
      allow read, write: if false;
    }

    match /shops/{shopId} {
      allow read: if true;
      allow create: if isAuthenticated() && request.resource.data.owner_id == request.auth.uid;
      allow update, delete: if isAuthenticated() && resource.data.owner_id == request.auth.uid;
    }

    match /menu_items/{itemId} {
      allow read: if true;
      allow create: if isShopOwner(request.resource.data.shop_id);
      allow update: if isShopOwner(resource.data.shop_id) && unchanged('shop_id');
      allow delete: if isShopOwner(resource.data.shop_id);
    }

    match /orders/{orderId} {
      allow read: if isAuthenticated() && (
        resource.data.user_id == request.auth.uid ||
        resource.data.rider_id == request.auth.uid ||
        resource.data.delivery_status == "finding_rider" ||
        isShopOwner(resource.data.shop_id)
      );
      allow create: if false;
      allow update: if isAuthenticated() && (
        (resource.data.user_id == request.auth.uid &&
         orderFinancialsAndCoreUnchanged() &&
         unchanged('rider_id') &&
         unchanged('delivery_status')) ||
        (isShopOwner(resource.data.shop_id) &&
         orderFinancialsAndCoreUnchanged() &&
         unchanged('rider_id'))
      );
      allow delete: if false;
    }

    match /users/{userId} {
      allow read, write: if isAuthenticated() && request.auth.uid == userId;
    }

    match /rider_profiles/{riderId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() && (request.auth.uid == riderId || request.auth.uid == request.resource.data.id);
      allow update: if isAuthenticated() && (request.auth.uid == riderId || request.auth.uid == resource.data.id) &&
                    riderFinancialsAndRatingsUnchanged();
      allow delete: if false;
    }

    match /rider_connections/{connId} {
      allow read: if isAuthenticated() && (
        resource.data.rider_id == request.auth.uid ||
        isShopOwner(resource.data.shop_id)
      );
      allow create: if isShopOwner(request.resource.data.shop_id);
      allow update: if (isShopOwner(resource.data.shop_id) && unchanged('shop_id')) ||
        (isAuthenticated() && resource.data.rider_id == request.auth.uid &&
         unchanged('shop_id') &&
         unchanged('rider_id') &&
         request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'active_mission_id', 'updated_at']));
      allow delete: if isShopOwner(resource.data.shop_id);
    }

    match /chat_messages/{messageId} {
      allow read: if isAuthenticated() && isOrderParticipant(resource.data.order_id);
      allow create: if isAuthenticated() && isOrderParticipant(request.resource.data.order_id);
      allow update: if isAuthenticated() && isOrderParticipant(resource.data.order_id) &&
                    unchanged('order_id') &&
                    unchanged('sender_id') &&
                    unchanged('content') &&
                    request.resource.data.diff(resource.data).affectedKeys().hasOnly(['is_read', 'read_at', 'updated_at']);
      allow delete: if false;
    }

    match /shop_followers/{followId} {
      allow read: if isAuthenticated() && (
        resource.data.user_id == request.auth.uid ||
        isShopOwner(resource.data.shop_id)
      );
      allow create: if isAuthenticated() && request.resource.data.user_id == request.auth.uid;
      allow update, delete: if isAuthenticated() && resource.data.user_id == request.auth.uid;
    }

    match /payments/{paymentId} {
      allow read: if isAuthenticated() && isShopOwner(resource.data.shop_id);
      allow write: if false;
    }
  }
}
```

---

## 5. Recovery History & Resolution

During initial environment audits, the Merchant Dashboard experienced runtime permission failures (`Missing or insufficient permissions`) across `users/{uid}`, `menu_items`, and `orders`.

### Root Cause:
* **Deployment Drift**: The cloud database was enforcing an older default-deny ruleset because updated relational rules had not yet been deployed to the live named database instance (`ai-studio-localeatsvendord-a61b068b-3029-4d93-ba41-626b03a23bbe`).
* **Schema Alignment**: `menu_items` does not store `owner_id`; rules were aligned relationally to look up `shops/{shopId}.owner_id`.

### Resolution:
1. Synchronized `firestore.rules` locally with relational shop lookup helper `isShopOwner(shopId)`, order immutability guards, and participant chat scopes.
2. Successfully executed `deploy_firebase` to deploy the ruleset to the target project.
3. Verified zero permission errors across all application modules.

---

## 6. Post-Deployment Verification & Smoke Test Results

All post-deployment operations have been empirically verified with 100% pass rates:

| Verification Scope | Operation / Target Query | Result |
|---|---|---|
| **Authentication & Hydration** | Read `/users/IVWdBC0coNXJGTF9aySjnd4JGSm1` | **PASS** |
| **Shop Metadata** | Read `/shops/18` (*My-Kota*) | **PASS** |
| **Menu Catalog Query** | `where("shop_id", "in", [18, "18"])` | **PASS** (1 item retrieved) |
| **Menu Realtime Listener** | `onSnapshot(menu_items_18)` | **PASS** (Connected & live) |
| **Orders Query** | `where("shop_id", "in", [18, "18"])` | **PASS** (Accepted by rules) |
| **Rider Profiles List** | `where("id", "in", riderIds)` | **PASS** |
| **Rider Connections** | `where("shop_id", "==", 18)` | **PASS** |
| **Chat Messages** | `where("order_id", "==", orderId)` | **PASS** |
| **Menu Item Mutation** | Toggle `is_available` & restore | **PASS** |
| **Order Workflow Transition** | Kitchen status update with financial fields locked | **PASS** |
| **Chat Send Mutation** | Append message with `order_id` & `sender_type` | **PASS** |
| **Security Negative Tests** | Direct `/orders` create blocked; price change blocked | **PASS** (Correctly denied) |
| **Production Build** | `npm run build` | **PASS** (0 errors) |

---

## 7. Known Non-Blocking Environmental & Architectural Notices

1. **Rider Profiles Authenticated-Read Architecture (Known Trade-Off)**:
   * *Status*: Working by design for current UI.
   * *Context*: `match /rider_profiles/{riderId}` permits authenticated reads (`allow read: if isAuthenticated();`) so the Merchant Dashboard can perform multi-ID `IN` queries for live driver telemetry without requiring cross-collection rules joins.
2. **Development Sandbox HMR Notices**:
   * *Status*: Informational only.
   * *Context*: `DISABLE_HMR=true` is standard in the development container, resulting in benign `[vite] failed to connect to websocket` console logs that do not affect runtime behavior or production builds.
3. **Screen Wake Lock API Policy**:
   * *Status*: Environmental browser feature.
   * *Context*: Kitchen display wake lock gracefully handles unsupported or un-permissioned browser environments without blocking dashboard operations.

---

## 8. Modular Directory Map

```
src/
├── main.tsx                           # Application entry point
├── App.tsx                            # Root application view orchestrator & layout dispatcher
├── types.ts                           # Global TypeScript types (Shop, MenuItem, Order, Rider, etc.)
├── constants.ts                       # System constants, fallback shops & fallback menu items
│
├── components/                        # Modular UI Views & Feature Panels
│   ├── DashboardOverview.tsx          # Real-time metrics, active orders feed & revenue summary
│   ├── OrdersManagement.tsx           # Order kanban/table, order status workflow & receipt printing
│   ├── MenuManagement.tsx             # Menu catalog, pricing, category filters & image uploads
│   ├── RiderManagement.tsx            # Nearby rider pairing ciphers & active dispatch tracker
│   ├── ShopProfile.tsx                # Storefront hours, operational toggles, trust badges & GPS
│   ├── Coupons.tsx                    # Promotion builder, discount codes & campaign schedules
│   ├── Marketing.tsx                  # Promotional campaigns & customer reach tools
│   ├── Insights.tsx                   # Business intelligence, peak hours & conversion charts
│   ├── PaymentHistory.tsx             # Payout statements, transaction history & bank details
│   ├── SignIn.tsx                     # Authentication sign-in with email/password & Google
│   ├── SignUp.tsx                     # Vendor registration with password strength validation
│   ├── VerificationPending.tsx        # OTP code verification & email confirmation workflow
│   ├── EditProfile.tsx                # Merchant profile editor with coordinates picker
│   ├── NotificationCenterSidePanel.tsx# Slide-over real-time alert notifications & inventory warnings
│   ├── ShopDiagnosticPanel.tsx        # System diagnostics, cache inspection & sync status
│   ├── DiagnosticUtilityModal.tsx     # Hardware and database debug suite
│   ├── LegalDocsModal.tsx             # Terms of service, privacy policy & merchant agreement
│   ├── OnboardingTour.tsx             # Interactive guided walkthrough for new vendors
│   ├── ConnectivityMonitor.tsx        # Live internet connectivity & offline warning banner
│   ├── LeafletMap.tsx                 # Interactive GPS map for shop & customer coordinates
│   ├── LocationSyncIndicator.tsx      # GPS sync state badge with precision indicator
│   ├── LocalEatsLogo.tsx              # Vector branded logo
│   ├── LanguageSwitcher.tsx           # Multilingual localization switcher
│   ├── ErrorBoundary.tsx              # Top-level React error boundary with safe interactive recovery UI
│   └── ui/                            # Shared reusable primitives
│       ├── ConfirmModal.tsx           # Generic confirmation dialog
│       ├── SavingOverlay.tsx          # Non-blocking loading state overlay
│       ├── FirebaseInitializingOverlay.tsx # Auth & sync bootstrap spinner
│       └── Skeleton.tsx               # Shimmer loading skeletons & DashboardSkeleton layout
│
├── hooks/                             # Custom React State & Business Logic Hooks
│   ├── useKitchenAlerter.ts           # Web Audio API kitchen bell and siren generator
│   ├── useAuthGuard.ts                # Session state validator & token refresher
│   ├── useOrderWorkflow.ts            # Order transition state machine
│   ├── useShopLocation.ts             # Browser Geolocation & reverse geocoding manager
│   ├── useAppNavigation.ts            # View routing, tab switching & query parameter sync
│   ├── useAppInitializer.ts           # Initial auth bootstrap & local cache rehydration
│   └── usePushNotifications.ts        # Browser Push API & permission coordinator
│
├── utils/                             # Pure Utility Functions & Helpers
│   ├── availabilityChecker.ts         # Shop operational schedule & automatic open/close calculator
│   ├── storageCleanup.ts              # LocalStorage cache sanitizer & migration guard
│   ├── timeSync.ts                    # Network NTP time synchronization helper
│   ├── escPosEngine.ts                # ESC/POS thermal printer byte stream generator (Bluetooth & USB)
│   ├── errorHandler.ts                # Centralized error mapping & auth validation formatters
│   ├── shopOwnership.ts               # Multi-vendor ownership matcher & resilient shop fetcher
│   ├── fetchWithRetry.ts              # Resilient fetch wrapper with automatic token refresh
│   └── sentry.ts                      # Error monitoring and telemetry handler
│
└── lib/
    ├── firebase.ts                    # Production Firebase Auth, Firestore real-time queries & storage
    └── supabase.ts                    # Firestore Compatibility Bridge adapting query chaining
```
