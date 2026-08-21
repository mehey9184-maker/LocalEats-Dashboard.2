# LocalEats Vendor App - Functionality & Architecture Documentation

**Application Name**: LocalEats Vendor (Merchant Dashboard & Operations Platform)  
**Platform**: React 18+ (Vite, TypeScript, Tailwind CSS, Framer Motion, Lucide React)  
**Backend & Persistence**: Google Cloud Firestore & Firebase Auth (Live production database, real-time order streams, menu syncing, and authentication) with Firestore Compatibility Bridge (`src/lib/supabase.ts`)

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

## 2. System Architecture & Modular Layout

```
src/
├── main.tsx                           # Application entry point with stabilized 1-attempt recovery guard
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
│   ├── useOrderWorkflow.ts            # Order transition state machine (pending -> accepted -> ready -> delivered)
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

---

## 3. Key Modules & Functional Workflows

### 3.1 Authentication & Onboarding
- **SignIn (`SignIn.tsx`)**: Email/password authentication, Google SSO, and password reset trigger.
- **SignUp (`SignUp.tsx`)**: New merchant account creation with live password strength scoring and phone number validation.
- **VerificationPending (`VerificationPending.tsx`)**: 6-digit OTP entry with countdown resend timer and simulated auto-verification fallback.
- **EditProfile (`EditProfile.tsx`)**: Updates owner details, phone number, operating hours, and location pin.

### 3.2 Real-Time Order Management (`OrdersManagement.tsx`)
- **State Workflow**:
  - `pending` ➔ `accepted` (Kitchen preparation begins, prep timer starts)
  - `accepted` ➔ `ready` (Order packaged, nearby riders alerted for pickup)
  - `ready` ➔ `dispatched` / `in_transit` (Rider picked up food with PIN verification)
  - `in_transit` ➔ `delivered` (Payment settled & customer received order)
  - `rejected` / `cancelled` (With reason code logged)
- **Audio Kitchen Alerts (`useKitchenAlerter.ts`)**: Generates Web Audio synthesized chime and continuous loop alarms until the merchant acknowledges incoming orders.
- **Thermal Printing (`escPosEngine.ts`)**: Generates ESC/POS byte streams for 58mm and 80mm receipt printers via Web Bluetooth or Web USB APIs with failure queues and retry mechanisms.

### 3.3 Menu & Catalog Management (`MenuManagement.tsx`)
- Category organization (Burgers, Mains, Drinks, Desserts, Combos).
- In-stock / Out-of-stock instant switches.
- Pricing, modifier additions, item descriptions, and client-side compressed image uploads.

### 3.4 Rider Dispatch & Pairing (`RiderManagement.tsx`)
- Real-time GPS distance calculation to available couriers.
- 24-hour Pairing Cipher generation for direct merchant-to-rider network handshakes.
- Real-time delivery tracking with interactive Leaflet map overlays.

### 3.5 Shop Profile & GPS Accuracy (`ShopProfile.tsx`, `useShopLocation.ts`)
- Precise latitude/longitude pinning to eliminate delivery location ambiguity.
- Schedule management (open/close hours with automatic `syncShopAvailability`).
- Delivery radius, minimum order thresholds, and "Cash-on-Arrival" badges.

### 3.6 Diagnostics & Self-Healing (`ShopDiagnosticPanel.tsx`, `ErrorBoundary.tsx`)
- Real-time ping monitors for Firestore connectivity.
- LocalStorage cache cleanup tool to resolve stale session data.
- System error boundary with single-attempt self-healing and React ErrorBoundary recovery interface.

---

## 4. Continuity & Codebase Maintenance Protocol
- Whenever components or utility functions are added, modified, or extracted from `App.tsx`, developers must update this document.
- Follow modular single-responsibility principles: view components belong in `src/components/`, state hooks in `src/hooks/`, static data in `src/constants.ts`, and core types in `src/types.ts`.
- **Runtime Symbol Integrity**: All orchestrator view imports and component references (`LayoutDashboard`, `getFirestoreShops`, `getFirestoreOrders`, `getFailedPrints`, `safeGetOrderItems`, `isRiderOnline`, `QueuedPrintJob`, `PrinterDiagnosticResult`, `UserIcon`, `PauseCircle`, `Circle`, `Loader2`, `ArrowRight`, `MoreHorizontal`, `BellOff`, `useAuthGuard`, `PrintingFormat`) are strictly validated against their source modules with zero runtime reference errors.
- **Forensic Startup Verification**: Verified root state generic type instantiation (`useState<User | null>`), restored `Toaster` from `sonner`, corrected undefined `Icon` identifiers to `UserIcon` in `App.tsx`, and imported `useAuthGuard` in `DashboardOverview.tsx`, preventing runtime reference crashes and ensuring reliable bootstrap into the merchant interface.
