# LocalEats R5.2J — isolated staging catalogue & CORS readiness (REVIEW ONLY)

**Date:** 2026-11-09  
**Scope:** Dedicated Customer/API Vercel staging and Supabase `LocalEats-Profile-Staging` only.  
**Status:** Staging CORS corrected and network-verified; catalogue schema/seed and authenticated acceptance remain **NOT APPROVED / NOT APPLIED**.

## Deployed staging routing, proof and controls

- Stable Customer staging alias: `https://localeats-customer-staging-r52d-mehey9184-makers-projects.vercel.app`
- Stable API staging alias: `https://localeats-api-staging-r52d-mehey9184-makers-projects.vercel.app`
- API staging deployment: `dpl_3iuTisu3ErPEivYhhaH8ov9MQJbr` (`READY`, target `staging`). Existing API staging source bundle was reused unchanged; the `CUSTOMER_APP_ORIGIN` environment variable was edited **only on the isolated API project, Preview scope**.
- Network verification from an isolated sandbox with a valid short-lived Vercel share cookie:
  - `OPTIONS /api/v1/catalog/pickup-shops`, origin = stable Customer alias: **204** and matching `Access-Control-Allow-Origin`.
  - Same preflight with earlier ephemeral Customer deployment origin: **403 / CORS_ORIGIN_DENIED**.
  - Same preflight with live Production Customer origin: **403 / CORS_ORIGIN_DENIED**.
  - `GET /api/v1/catalog/pickup-shops` without coordinates and with allowed origin: **400 / INVALID_COORDINATES**, matching CORS header (proof that API route is reached).
  - `GET /health`: **200**, `GET /api/v1/catalog/shops`: **500** (database catalogue unresolved).
- API write flags remain `false`: `PICKUP_WRITES_ENABLED`, `PROFILE_WRITES_ENABLED`, `RIDER_ACTIVATION_ENABLED`, `REWARDS_ACTIVATION_ENABLED`, `LOCALPAY_LIVE_WALLET_ENABLED`. `LOCALEATS_STAGING_ONLY=true`; staging Firebase project ID is `localeats-staging`.
- Keep Vercel Authentication/deployment protection enabled. **Do not widen CORS to wildcard, Production, or all preview deployments.** An OPTIONS response advertising HTTP methods does not activate writes; the separate write gates stay disabled.

## Database discovery (read-only)

Supabase staging project reference: `rgpbdajhlrwfmhopzgzk`. It currently has an empty `public.profiles` table with RLS enabled. Read-only `to_regclass` checks found **no** `public.shops`, `public.menu_items` or `public.shops_with_availability`. No schema migrations, records, accounts or test orders were created.

The current API `localeats-api/src/routes/catalog.ts` reads:

- `shops_with_availability`, filtering `approval_status='approved'` and `archived_at IS NULL`, selecting `effective_is_active, availability_revision, availability_override_until, id, name, description, location, category, logo_url, rating, opening_time, closing_time, is_active, latitude, longitude, lat, lng, story`.
- `menu_items`, selecting `id, shop_id, name, price, description, image_url, category, is_available, popularity_score, customizations, created_at`.
- Real coordinate-based `/api/v1/catalog/pickup-shops` sorts by distance and limits results to 4 km. Approved closed shops must remain browseable for menu viewing; ordering must remain unavailable while the pilot write gate is off.

Relevant repository references: `supabase/drafts/merchant_availability.sql` and `supabase/drafts/pickup_launch_foundation.sql` (both draft, **not permission to execute**), `localeats-api/tests/pickup/schema.sql` (isolated test fixture only), `localeats-api/src/routes/catalog.test.ts`.

## Proposed staging-only catalogue schema — NOT YET APPROVED

1. Define `public.shops` with **text IDs** and owner IDs, explicit approval/archival state, active/availability state, validated coordinates, optional opening/closing schedule, optional descriptive fields, and revision/override metadata. Reconcile column types, constraints and default semantics against both existing API contract and draft availability SQL **before** generating a migration; do not copy unreviewed Production records.
2. Define `public.menu_items` with **text ID** and text `shop_id` FK, nonnegative finite numeric ZAR price, availability, description, image/category, optional popularity score and JSON customization data. Limit record sizes and reject malformed prices.
3. Provide `public.shops_with_availability` with `security_invoker=true` and authoritative effective-open behavior. Review scheduling, override precedence and revision concurrency from `merchant_availability.sql`.
4. Enable RLS on every exposed table. **Revoke direct anon/authenticated access** to the catalogue table/view until security approval; grant only the minimum SELECT permissions required by the staging API service identity. Do not add `SECURITY DEFINER` as a workaround or expose secret keys to the browser.
5. Run schema-contract and RLS permission tests in a disposable/synthetic environment, record a reversible staging migration and a backup/rollback procedure. Take a staging-only baseline first; do not modify the current `profiles` table or any Production project.

**Auth/credential gate:** Vercel masks sensitive staging credentials; successful `/health` alone does not establish valid Supabase service credentials or a working Firebase account flow. Verify key provenance through approved account controls without printing secrets, then test registered synthetic Firebase authentication, UID-scoped profile reads, disabled/revoked-token rejection and empty-profile behavior.

## Proposed synthetic fixture — separately approved later

Use only fabricated, visibly labeled **STAGING TEST** shops, fake menu products and a fixed *synthetic* coordinate fixture, such as test origin `lat=-26.0000,lng=28.0000` (not a user's device location).

- Approved open shop within 4 km, with 2 fictional menu items and server-side prices.
- Approved **closed** shop within 4 km, whose menu is still browseable but order actions remain disabled.
- Unapproved and archived shops that never appear publicly.
- Approved shop farther than 4 km, excluded from nearby results.
- One registered synthetic Customer identity, after separate approval; **no real identities, merchants, emails, phone numbers, payments, orders, reward credits or vouchers**.

Keep data names unmistakably synthetic, keep all tables and fixture inserts inside staging, and provide an explicit cleanup script after owner sign-off.

## Acceptance gates for proposed R5.2K

- With an empty staging catalogue **after approved schema setup**, `GET /api/v1/catalog/shops` returns `200 {success:true,shops:[]}` rather than `500`; invalid coordinates still return `400`.
- With approved fixtures, shops are properly filtered and ordered by proximity at the 4 km boundary, including approved closed-shop browsing and the real menu. Unknown shop IDs return `404`. No fake Production data or hard-coded fallback prices.
- Guest Home, Discover, ShopCard, menu, cart read-only paths and sign-in/Profile are checked in a real browser without replacing the original Customer UI or logo. Test identities are isolated to Firebase staging.
- Confirm `OPTIONS` is allowed only from the stable staging Customer alias and CORS denies live Production origin. Protect against revoked/disabled Firebase sessions and account switching.
- Keep all Customer/API/server write gates disabled; no order submission, payment activation, LocalPay, rewards, database promotions, merge or Production deploy.
- Report failing read paths and blockers truthfully, and **do not sign off full R5.2 staging readiness** until schema, credentials and synthetic read acceptance pass.

## Required owner approval before database actions

This document approves **nothing by itself**. Before executing DDL, RLS/grant changes, fixtures, or registering test identities, obtain separate explicit owner approval for the exact isolated staging project, reviewed migration SQL, backup/rollback steps, synthetic fixture, and verification plan. No existing PR may be merged without separate sign-off.
