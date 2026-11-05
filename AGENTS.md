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
