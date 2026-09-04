# LocalEats Vendor App - Functionality & Architecture Documentation

**Application Name**: LocalEats Vendor (Merchant Dashboard & Operations Platform)  
**Platform**: React 18+ (Vite, TypeScript, Tailwind CSS, Framer Motion, Lucide React)  
**Backend & Persistence**: Firebase Authentication; LocalEats API with Supabase PostgreSQL authority for merchant shop identity, creation, approval, and availability; legacy Firestore operations through `src/lib/firebase.ts` and the Firestore compatibility bridge in `src/lib/supabase.ts`

---

## 1. Executive Summary & Business Stakeholder Directives

LocalEats Vendor is the mission-critical merchant operating system for local food establishments and restaurants. Designed with Swiss-Modern aesthetics and high operational ergonomics, the app provides real-time order fulfillment, instant inventory controls, rider dispatch/handshake management, sales analytics, and thermal printer integration.

### Core Directives:
1. **Zero-Guesswork Location Engine**: All maps and shop locations prioritize numeric latitude (`lat`) and longitude (`lng`) floats over plain text addresses.
2. **Defensive Database & Cache Resilience**: Automatic fallback to local storage cache (`localStorage`) ensuring the vendor interface never crashes or stalls during intermittent network connectivity.
3. **High-Contrast Touch & Responsive UI**: Minimum 44-46px touch targets, warm coral accents (`#FF5A36`), bold charcoal typography, instant haptic and audible kitchen alerts.
4. **Autonomous Operational Reliability**: Self-contained background workflows for audio kitchen alarms, ESC/POS Bluetooth/USB thermal printing, and multi-channel notification systems.
5. **Stabilized Crash Recovery Protocol**: Max recovery attempts capped at 1; delegates fatal render errors directly to React's `ErrorBoundary` to prevent infinite reload loops and DOM manipulation clashes.
6. **Fail-Closed Merchant Identity**: Firebase Auth is authoritative and the merchant API is the only source of the authenticated merchant's shop. Failed signup never creates a local authenticated identity or accepts shop ownership metadata. Shop state starts empty; only an authenticated merchant-shop `404` whose JSON error is exactly `Merchant shop not mapped` opens mandatory shop creation. Unexpected `404`, network, and other API failures keep the dashboard locked behind retry/sign-out controls. Operational access requires an API-returned shop with `approval_status: "approved"`; cached menu records are restored only after their `shop_id` matches that API-verified owned shop. Migration utilities preserve string shop IDs without inferring owners or default shops.
7. **Server-Authoritative Shop Availability**: Merchant operational availability changes use authenticated `PATCH /api/v1/merchant/shop/availability`. The verified Firebase UID selects the merchant's single current unarchived Supabase shop; browser shop IDs, owner IDs, Firestore, the compatibility bridge, and local storage cannot authorize or perform the write. Only approved shops can be activated, while deactivation remains safe for every lifecycle state.

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
* **Client Ownership Resolution**: `MerchantApi.getMerchantShop()` is the only source that populates the authenticated merchant's shop state, and verified ownership is registered for the exact Firebase UID before the shop becomes current. Firestore shop listings, realtime shop subscriptions, Supabase shop scans, browser caches, and authentication metadata cannot establish or repair ownership. Cached menu data is tenant-filtered against API-verified shop IDs before restoration, and menu saves re-verify their candidate shop IDs.
* **Type-Cast Robustness**: Uses `string(shopId)` to seamlessly support both numeric (`18`) and string (`"18"`) identifiers.
* **Access Rules**: Public read for customer storefront discovery and vendor profile loading; write/update/delete restricted to the verified shop owner (`owner_id == auth.uid`).

#### 3.2.1 Merchant Shop Creation & Approval Gate
* **Authoritative Resolution**: After Firebase authentication, the client resolves the merchant shop only through `GET /api/v1/merchant/shop`. The exact returned shop ID is registered against the exact Firebase UID; cache, browser metadata, Firestore listings, and Supabase scans cannot establish ownership.
* **Mandatory No-Shop Flow**: Only a JSON `404` response with `error: "Merchant shop not mapped"` displays the full-screen shop-creation form. Non-JSON, malformed, or unexpected `404` responses, network failures, and all other HTTP failures display a fail-closed verification error with retry and sign-out actions, never onboarding.
* **No-Shop Lifecycle**: Firebase authentication → `GET /api/v1/merchant/shop` → `404` → mandatory **Create Your Shop** → required Cloudinary logo upload → authenticated `POST /api/v1/merchant/shop` → Supabase pending shop → approval gate.
* **Merchant-Friendly Setup**: Mandatory shop creation is presented as three focused steps covering business details, location, and final review. Merchants choose a recognizable category, enter a familiar South African phone number that is normalized to `+27` before submission, and confirm hidden numeric coordinates through browser location or the existing Leaflet map. Description and story remain optional, while the shop image and physical location remain required.
* **Server-Owned Creation**: The form sends only the approved shop profile fields to authenticated `POST /api/v1/merchant/shop`. The backend remains responsible for assigning ownership and initial approval/activation state. The client accepts the exact returned shop and does not synthesize or repair ownership data.
* **Approval Gate**: Newly created, rejected, suspended, or otherwise unapproved shops remain outside the operational dashboard. Only `approval_status: "approved"` enables orders, menu loading, realtime subscriptions, shop-hour automation, and heartbeat activity.
* **Merchant Review States**: The approval gate gives pending, rejected, and suspended merchants distinct business-friendly explanations while keeping operational access locked. Backend-provided approval reasons are trimmed and rendered only as plain text; the gate offers status refresh and sign-out actions without browser-controlled approval, editing, or resubmission.
* **Availability Mutation Contract**: `PATCH /api/v1/merchant/shop/availability` accepts exactly `{ "is_active": boolean }` after Firebase bearer authentication. The API derives ownership only from the verified UID, rejects missing shops with `404 / Merchant shop not mapped`, rejects multiple current shops with `409 / Multiple current shops mapped to merchant`, rejects activation outside `approved` with `409 / Shop must be approved before going online`, and fails a concurrent ownership, archive, or approval change with `409 / Shop availability state changed; retry`. Malformed or additional fields return `400 / Invalid availability request`; authentication and unexpected database failures remain generic `401` and `500` responses. The successful response contains the authoritative updated Supabase shop row, which replaces merchant React state. The API updates only `is_active`; it does not write Firestore or assume an `updated_at` column.

#### 3.2.2 Server-Side Super Admin Authorization Foundation
* **Authoritative Request Chain**: Future `/api/v1/admin/*` handlers run only after the LocalEats API verifies a Firebase ID token with revocation checking and confirms the verified Firebase UID against `public.admin_users` with `role = 'super_admin'` and `is_active = true`.
* **No Browser Authority**: Email, frontend role labels, local storage, request body/query/header role claims, Firestore, mock data, and cached role data cannot grant administrator access. Every sensitive admin request performs a fresh server-side `admin_users` lookup.
* **Fail-Closed Contract**: Missing, malformed, invalid, expired, revoked, or disabled Firebase authentication returns a generic `401`. A valid Firebase identity without active super-admin authorization returns a generic `403`. Database failures return a generic server error and never degrade into an authorization denial or fallback.
* **B2 Identity Surface**: `GET /api/v1/admin/me` exercises the authentication and authorization middleware and returns only the verified UID, Firebase email, and server-established role.
* **B3 Shop Review Reads**: `GET /api/v1/admin/shops` returns a bounded, explicitly allowlisted review overview from `public.shops`, defaults to unarchived pending submissions, supports validated status/limit/offset filters, and orders newest submissions first with shop ID as a deterministic tie-breaker. `GET /api/v1/admin/shops/:shopId` returns an explicit allowlist for one unarchived shop. Both routes reuse the B2 middleware chain, send `Cache-Control: no-store`, fail closed on database errors, and perform no writes. Lifecycle mutations are handled separately by the B4 atomic approval transition endpoint.
* **B4 Atomic Approval Transition**: `POST /api/v1/admin/shops/:shopId/approval` accepts one allowlisted lifecycle action with the caller's optimistic `expected_status` and any required reason. The acting UID comes only from the server-established admin context. The API delegates the sole write to `public.transition_shop_approval`, whose locked transition matrix, row lock, state comparison, active-admin recheck, shop update, and approval audit event execute atomically. Reject and suspend force the shop inactive; approve preserves `is_active`, while reinstate preserves the inactive state established by suspension. Neither action auto-opens the shop, and the API provides no batch approval path.
* **B7A Super Admin CORS Readiness**: The API optionally accepts one exact browser origin from `SUPER_ADMIN_ORIGIN`. Blank or malformed values add no allowed origin. This does not alter the existing exact Merchant Dashboard production origin or the constrained HTTPS preview-host prefix/suffix policy, and all `/api/v1/admin/*` routes continue to require server-side Firebase authentication and active `super_admin` authorization.
* **Super Admin Frontend Integration Status**: The secure Super Admin feature branch uses Firebase project `localeats-5e26e` with real Firebase client authentication, verifies authorization through `GET /api/v1/admin/me`, and performs shop review through the centralized LocalEats Admin API. Its active runtime no longer includes legacy anonymous authentication or Firestore authority. The Super Admin application has not yet been deployed to Vercel.

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
