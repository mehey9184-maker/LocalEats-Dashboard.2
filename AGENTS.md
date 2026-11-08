# LocalEats Platform - Persistent System Instructions

## Active Merchant pickup-only Codex policy — 2026-11-05

Isolated Firebase staging builds must explicitly set `VITE_FIREBASE_CONFIG_SOURCE=environment` and supply the complete staging app configuration. That mode selects `VITE_FIREBASE_FIRESTORE_DATABASE_ID` (defaulting to `(default)`) without reusing bundled production values. Existing deployments retain their bundled configuration until opted in.

For the upcoming LocalEats merchant launch, **pickup and pay at the physical shop only** are in scope. Rider/delivery functions and subscriptions/online payments remain inactive and require future explicit approval. Existing Rider/delivery sections below are historical or retained-code descriptions, **not current launch instructions**.

Use the repository-scoped `$localeats-merchant-pickup` skill at `.agents/skills/localeats-merchant-pickup/SKILL.md` when auditing merchant Storefront/Settings, menu, pickup Orders, availability, notifications, payment confirmation or performance. Preserve the existing UI/UX. Work on isolated branches with owner-reviewed **draft PRs**; do not merge, change Production, enable order or availability write flags, apply SQL, alter live data/security, or place real orders. Tests must use mocks, disposable databases, or separately approved truly isolated environments; Preview alone does not guarantee isolation.

**Authoritative-truth rule**: historical guidance about local cache/status resilience must never authorize local state to claim that a pickup order, payment, availability change or customer handover was persisted. These outcomes require authenticated server confirmation. Merchant shop ownership and approval must be verified by the API, not inferred from cache or caller-provided metadata.


## 📚 Documentation Check & Continuity Protocol
- **Documentation Check**: Before performing any file edits, always read `Vendor_LocalEats_App_Functionality_Documentation.md`.
- **Documentation Sync**: After completing an edit, update `Vendor_LocalEats_App_Functionality_Documentation.md` to reflect the current state, architecture, and modular structure of the application.

## 🧑‍💼 User Profile: The Business Stakeholder
- **Perspective**: The user is the founder and business operator of LocalEats. They expect a hands-off technical relationship. 
- **Role**: Standard CEO / Product Owner. They express goals in terms of business impact, customer conversion, trust, and operational efficiency.
- **Workflow**: Avoid asking the user to write code, design SQL tables, write regex, or debug terminal/build errors. The AI must manage the tech stack autonomously behind the scenes and present clear, human-readable operational results.

---

## 🛠️ Tech Stack & Database Architecture Rules

### 1. Zero-Guesswork Location Engine (Maps & GPS)
- All navigation maps and routing models must prioritize **numeric latitude (`lat`) and longitude (`lng`) floats** over text addresses.
- Text addresses are for human display only. All interactive routing coordinates in the Rider and Client views must bind directly to coordinates in the `orders` or `shops` tables to guarantee accuracy.

### 2. Defensive Database Updates (PGRST / Cache Prevention)
- **Do NOT** assume columns exist in Supabase tables without verification. 
- Always safely strip un-migrated columns (like `city`, `rider_name`, `rider_phone` on the `orders` table if they do not exist) before running updates on Supabase. This guarantees that updating orders never throws database exceptions or blocks rider progress.
- Maintain localized status tracking so that if Supabase triggers a temporary validation failure, the frontend application remains responsive with a local fallback cache (`localStorage`).

### 3. Separation of Prompts & Scope
- **Client Storefront**: Minimalist, Swiss-Modern style. Focuses on premium trust signals (e.g. "Cash-on-Arrival" indicators), high-contrast touch targets (min 46px), checkout speed, and simple order tracking.
- **Rider Deliveries**: High-performance, mobile-first utility layout. Focuses on maps, active-mission filters, instant order status switches, and 24-hour merchant handshake pairing via Pairing Ciphers.
- **Merchant Controls**: Dashboard for local shop owners to manage menus, toggle external rider availability, configure trust badges, and generate pairing links.

---

## 🎨 Visual Identity & UI Polish Guidelines
- **Modern Aesthetic**: Clean, spacious white canvas with bold charcoal typography paired with warm coral accents (`#FF5A36`). High-contrast elements only.
- **No Telemetry Slop**: Never display raw developer console logs, container port numbers (such as "PORT: 3000"), or system debugging borders in the user interface. 
- **Haptic & Visual Feedback**: Provide instant visual loading triggers, haptic vibration cues for riders, and highly readable notification alerts via `sonner` toasts.

## Pickup kitchen instructions — 2026-11-05
Customer special instructions are bounded to 500 characters per server menu line and preserved through quote/create. Repeated menu IDs consolidate with quantity-labelled instructions; aggregate quantity is limited to the existing server maximum of 20. Merchant presentation uses authoritative unit prices and line totals, keeps item instructions visible and escapes customer notes in HTML receipts. This changes no live SQL, ordering flags or payment state.

## Merchant pickup command recovery — 2026-11-06
The merchant command adapter has a 15-second deadline covering Firebase token refresh, request and response parsing. Timeouts keep the exact account/order-scoped command for Retry previous action; late responses cannot clear it. Duplicate retries share in-flight work, and account/storage changes prevent applying a response. Success requires a receipt matching command ID, actor, order, action kind and original revision; replay can return a later valid order state. The API exposes only those saved event facts, without command hashes or event details.
Rollout: deploy the receipt-producing API before using the new Dashboard. An older API response without a receipt remains unconfirmed and keeps recovery available. Production ordering flags remain off; this change activates no SQL, security, payment, rider or order features. Synthetic browser verification includes deliberately dropping an acceptance response and replaying the exact command through local PostgreSQL with real staging Firebase authentication.

## Merchant pickup Home — 2026-11-06
Home uses persisted collection orders from the current API-verified shop. It shows pay-at-shop and confirmed Ready counts, not platform payouts or rider availability. The unsupported bank-link/POS prototypes (including raw card-number entry and fixed-price synthetic writes) are removed from Home. Legacy delivery analytics/components remain retained but unmounted; Home no longer subscribes to rider connections. Setup checks cover shop, hours and menu. Advanced figures are labelled order value, not revenue; invented preparation time is replaced by the actual kitchen queue.
The initial verified shop scope now loads the authoritative menu. Reads have a 15-second deadline and request-generation guard; scope changes invalidate obsolete replies. Same-shop verified menu facts stay visible during refresh. Unread/failed menu counts show Loading/Unavailable with Retry, not zero. Unverified/failed order reads show recovery instead of empty queues; summaries/export require fresh order state. Weekly CSV includes payment status and quotes/neutralizes spreadsheet formulas. Production ordering/availability activation flags, schema, security rules, billing and payment facts are unchanged.

Background shop revalidation retains the approved same-account display while the authenticated read is in flight, with a 15-second deadline. Initial/cross-account verification still waits. Missing/unapproved/failed ownership locks the dashboard; obsolete generation/identity responses cannot reset a newer account. Auth callbacks check the current Firebase identity before and after asynchronous work. Actual-callback regressions cover delayed account formatting, old lookup failures, obsolete sign-out events and failed current revalidation. Home day counts/charts/report filenames use the South African shop date.

## Controlled pickup quote eligibility
The quote response adds can_submit for the verified customer and requested shop, based on the existing pilot gate. Prices remain available while submission is disabled. Clients treat a missing or false result as quote-only. The create route independently rechecks all authorization and pricing.


## R5.1 Customer identity cross-repository note (2026-11-08)

Inspect Customer src/lib/supabase.ts BEFORE calling Customer Login a separate Supabase Auth provider: that module is actually a Firebase Auth compatibility wrapper. API authentication still must verify signed Firebase ID tokens with revoked/disabled status, then verify shop ownership/roles server-side. Never substitute email or browser UID claims. Current R5.1 is DRAFT-ONLY Customer token-change observer + emulator tests; no API auth changes, staging/Production deployment, database writes, orders, financial or rewards activation. Hosted staging isolation and browser verification are still open; see docs/R51_CUSTOMER_FIREBASE_AUTH_IDENTITY_HANDOVER_20261108.md.


## R5.2 API hosted staging STOP gate — 2026-11-08

Read-only Vercel metadata shows current localeats-api Preview and Production share several credential variables (Firebase Admin and Supabase); no exact branch deployment exists for API draft PR #124. The Customer Preview likewise shares Firebase configuration. Do not create/revoke real Firebase accounts, query user records, test hosted login, or change hosted env/DB/Production under R5.2 until a wholly isolated and independently verified staging project/database/API/branch configuration exists. Synthetic-only source gate is at localeats-api/tests/rewards/r52/stagingIsolationGate.mjs; a passing test against mock metadata is NOT cloud isolation evidence. See docs/R52_HOSTED_STAGING_ISOLATION_READINESS_20261108.md. All pickup/merchant/profile/LocalPay/rewards writes remain OFF, no merge.
