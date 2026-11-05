---
name: localeats-merchant-pickup
description: "Review, debug, and test the LocalEats Merchant Dashboard for a pickup-only launch. Use for merchant shop ownership and approval, Storefront settings, catalog and menu availability, pickup orders, payment-at-shop, customer handover, alerts, caching, and release readiness. No delivery or rider activation."
---

# LocalEats Merchant pickup launch skill

## Purpose and limits

Help the LocalEats owner make the **Merchant Dashboard** dependable for a **pickup-only, pay-at-shop** pilot while preserving the existing appearance and workflow. This skill contains instructions, not authorization to deploy, merge, change live data, or turn on ordering.

Before code changes, read the repository root `AGENTS.md` and `Vendor_LocalEats_App_Functionality_Documentation.md`, as required by this repo. Establish the checked-out branch/commit and consult the current implementation instead of assuming historical architecture notes are active. This skill applies to **this Merchant repository**. Customer, API, and Rider repositories require separate inspection.

## Non-negotiable safeguards

- **Preserve original UI and UX**: layouts, brand, navigation, order cards, menu management, Storefront, Settings, animations, and working interactions. Fix only verified defects. Request owner review before material redesign.
- **Pickup only**. Do not enable rider dispatch, delivery operations, courier tracking, online payment capture, subscriptions, or payment gateway integrations. Retain legacy source where necessary, but prevent pickup orders from entering any rider or delivery path.
- **No Production changes** without a separate explicit approval. Never merge, switch production environment variables, set activation flags, apply SQL, deploy database migrations/functions/rules, change security policies, backfill business data, or write to real users, shops, orders, payments or notifications as a result of an audit.
- **No live orders or financial events in tests**. Use unit tests, fakes, mocks or genuinely isolated data. A Vercel Preview may share the Production database: **do not use Preview for mutations unless its isolation is verified and separately approved**.
- Keep `VITE_PICKUP_ORDERING_ENABLED` disabled; keep server `PICKUP_WRITES_ENABLED` and merchant availability write gates disabled unless individually approved after backend and deployment verification. Never interpret a local toggle, cache or old document as activation approval.
- **Fail closed on security and financial state**: do not trust client-supplied owner IDs, shop IDs, prices, payment statuses or order revisions. Never let `localStorage` or stale UI establish successful order acceptance, payment or handover. Distinguish optimistic display from server-confirmed persistence.
- No new paid dependencies; protect secrets, credentials and personal information. Never output real customer details in logs, screenshots or reports.

## Structured audit workflow

### 1. Confirm current facts
- Check current branch, repo documentation, `package.json` scripts, backend/API boundaries, feature flags, recent changes and available tests.
- Identify any dependencies on the separate Customer and API repositories; do not claim an end-to-end pass from merchant-only code.
- Check that a merchant has a valid Firebase-authenticated session and the **API-verified owned shop**; `approval_status` must allow operations. Unauthorized or missing shop mapping must not unlock the dashboard through cached fallback data.

### 2. Merchant shop, Storefront and menu
- Confirm Settings and Storefront pages are reachable, comprehensible and accessible without navigation loops or unhandled errors.
- Verify shop profile/operating hours/coordinates, shop availability and the impact on customer discovery; do not invent shop coordinates or silently extend the customer discovery radius (4 km).
- Menu reads/edits must be shop-scoped. Verify real stock/availability and prices; do not show fake items, claim changes saved before API confirmation, or conceal backend errors.
- Distinguish **Preview display** from effective store availability. Existing optional/local caches may speed rendering but cannot override server authority for shop approval, order status, availability or financial state.

### 3. Pickup order lifecycle and payment
- Identify a pickup order only from persisted `delivery_type: "collection"`, not UI guesses.
- Check `pending -> preparing -> ready_for_pickup -> collected`, and explicit rejection/cancellation constraints. Only the authoritative server may confirm transitions.
- Verify merchant shop ownership, authenticated command requests, revision/concurrency protections, idempotent command handling, conflicting updates, retries and error states. No duplicate accepts/prints or invented Ready state.
- Customer pickup uses server-authoritative totals. Confirm pickup service and delivery fees are zero **only when confirmed by the correct server contract**. Display `Pay at shop`; no unverified VAT or online payment claims.
- Confirm actual in-person cash or physical card-machine payment independently; never infer `paid` merely because payment method is chosen or food marked collected.
- Collect requires **confirmed payment plus explicit physical handover**. A stale success toast or local cache must never be considered durable proof of payment, handover or order completion.
- Protect status history, evidence, and event ordering on network loss, duplicate click, page refresh and multi-tab use. Detect and report notification delay or missing order inbox items.

### 4. Performance and supportability
- Review dashboard Home, Orders, Storefront, Menu, Settings and alerts for empty-state flicker, duplicate requests, cache invalidation, high CPU/network use, inaccessible buttons, confusing wording and misleading metrics.
- Verify warning/permission-denied/timeout paths are actionable; avoid UI freeze and infinite loading. Improve caching without serving stale cross-shop information or hiding the actual server response.
- Preserve existing mobile layouts, keyboard usability, printing controls and notification settings. Do not assert a printer receipt or alert was delivered unless verified.

### 5. Verification, evidence and owner gate
- Run applicable existing tests **when a safe execution environment is available**, starting with `npm run test:merchant-pickup`, `npm run lint` and `npm run build`. Report actual results; never claim tests passed without running them. Check applicable merchant auth, availability, menu, order actions and transport tests. Use Playwright only against a safe read-only or isolated Preview.
- For synthetic stress/concurrency investigation, use mocked or disposable environments. Do not generate bulk requests, real orders or alerts against Production or a shared free-tier database.
- Summarize what was examined, exact path/line evidence, passes, failures, security concerns, owner/manual gates and unverified dependencies. If changes are justified, make the smallest patch on a new branch and leave a **draft PR**; do not merge or deploy Production.

## Repo pointers — verify files still exist

- `src/services/merchantPickupPolicy.ts`: pickup state, allowed commands and ordering gate
- `src/services/MerchantApi.ts`: authenticated merchant API and pickup transitions
- `src/hooks/useOrderWorkflow.ts`: merchant order actions and Rider separation
- `src/components/OrdersManagement.tsx`: order list and merchant controls
- `src/components/ShopProfile.tsx`: shop profile/location and Storefront-related data
- `tests/merchant-pickup.test.mjs`: existing pickup policy regression tests
- `docs/PICKUP_ZERO_FEE_REVIEW.md`, `docs/MERCHANT_AVAILABILITY_REVIEW.md`: historical approvals, blockers and unapplied SQL drafts

## Invocation

Use `$localeats-merchant-pickup` for the Merchant pickup-only audit or improvement request. A green build is **not** launch sign-off: API, Customer, security, manual UX and safe activation checks require explicit evidence and owner approval.
