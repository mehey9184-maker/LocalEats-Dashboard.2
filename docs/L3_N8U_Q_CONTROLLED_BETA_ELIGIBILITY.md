# L3-N8U-Q — Bounded Production pickup beta eligibility (source-only)

**Reviewed:** 2026-11-20. **Branch:** `review/l3-n8u-q-controlled-production-beta-eligibility`, stacked on `review/l3-n8u-p-production-pickup-launch-gate` (draft PR #211). **Release state: HOLD.** No Production deploy, merge, environment edit, Firebase login, order creation, payment, push delivery or database write occurred in L3-N8U-Q.

## Owner's immediate business goal
Offer a **limited real pickup-only beta** to around **2–3 preapproved shops** and **10–20 invited customers** on the existing public LocalEats websites, using Production Firebase Authentication, Production API and Supabase, paying **at the shop**. This is NOT a general public ordering launch. No delivery/Rider, online card charging, LocalPay, rewards activation or merchant subscriptions. Keep the existing Install App and push opt-in flows and original shop UI.

## Security problem resolved in draft
Previously the API `controlledPickup.ts` admitted only **one hardcoded test shop** `shop-my-kota-ivory-park` and one server-only `PICKUP_TEST_CUSTOMER_UID`. This contract is preserved for its existing acceptance flow by default. Merely flipping the existing `PICKUP_WRITES_ENABLED=true` never authorized a real public beta and still does not.

New code adds a **separately enabled, strict server-side beta invitation policy**:
- `PICKUP_BETA_ENABLED=true` explicitly selects beta mode.
- `PICKUP_BETA_ADMISSION_ENABLED=true` separately admits **new** orders; set to `false` to pause new admissions while allowing already persisted pickup orders to finish.
- `PICKUP_BETA_SHOP_IDS`: comma-separated **1–3** exact shop IDs; no whitespace, duplicates, empty entries, paths or wildcard. A shop must ALSO pass the API/catalog approval, open status, location and SQL server checks.
- `PICKUP_BETA_CUSTOMER_UIDS`: comma-separated **1–20** exact Firebase Auth UIDs; not emails, browser-supplied UIDs or frontend roles. Never print them, place them in public `VITE_` vars, commit them, or expose them in client output.
- `PICKUP_BETA_EXPIRES_AT`: mandatory, exact UTC `YYYY-MM-DDTHH:mm:ssZ` future timestamp **no more than 30 days away**. After expiry, new order admission fails closed. Existing persisted pickup obligations are not automatically discarded. This is admission-time checking, **not** a background scheduler to clear waiting orders.
- `PICKUP_WRITES_ENABLED=true` is still the overarching server hard-off, and all **frontend flags remain independently gated** until approved. Invalid, partial or malformed beta settings reject new orders; unknown shop/customer rejects 403, not an implicit open pilot. No cohort is shipped or activated with this PR.

**Do not set real values or flags yet.** The beta has not been approved for Production enablement, and tests use synthetic IDs only. A read-only audit of live Production API Vercel settings confirmed `PICKUP_WRITES_ENABLED=false` and the old `PICKUP_TEST_CUSTOMER_UID` remains configured. New beta values are not configured at the live project.

## Admission vs continuation
**New orders / quote can_submit:** after Firebase verification, check global pickup flag, explicit beta mode, admission toggle, exact invited UID/shop lists, expiry; `quote.can_submit` remains false for others. The action still requires authoritative shop lookup and pricing, four-kilometre range, item availability, explicit money consent, API idempotency and privileged SQL RPC.

**Previously saved orders:** during beta mode, `assertControlledPickupContinuation` verifies global hard-off, expected persisted pickup type, stored UID/shop identifiers and 64-char create-intent hash. It deliberately does not re-check the current invite lists, expiry or new-admission toggle. Route reads still restrict cancel to `orders.user_id=verified firebase UID` and Merchant `loadMerchantOrder` to `shops.owner_id=verified firebase UID`; SQL `pickup_order_command` applies owner/customer verification, revision and transition rules. This avoids a cohort edit preventing a shop from fulfilling food it already agreed to prepare.

Operational pause: set only `PICKUP_BETA_ADMISSION_ENABLED=false` **while keeping `PICKUP_BETA_ENABLED=true` and `PICKUP_WRITES_ENABLED=true`** if existing orders must continue. Use global `PICKUP_WRITES_ENABLED=false` only as an emergency all-writes stop that also blocks continuation; immediately coordinate manual fulfillment/refund/resolution for existing customers. Do not erase order history.

## Database and geographic blocker not solved by this code
Read-only inspection of actual Production `pickup_create_order` SQL found the mandatory regional constraint:
`sh.location !~* '\\m(tembisa|thembisa|ivory[[:space:]]+park)\\M'` -> `OUTSIDE_PICKUP_PILOT`.
The API also enforces **4 km pickup radius**. Therefore the first invited beta shops must have correct approved/active Production records in this geographical pilot. Arbitrarily allowlisting another area will **not** work. Widening geography requires separate business decision, Postgres review/migration and location acceptance; do not weaken the stored SQL rule as part of this task.

## Read-only Production security snapshot carried forward from L3-N8U-P
- Production Vercel Customer/Merchant/API pickup switches all remained `false` on last direct readback. Live Production API Firebase project ID is `localeats-5e26e`, SQL URL is `https://phdjumtqkooyppxozqsi.supabase.co` (non-secret project ID validation only). Actual Firebase Admin service credentials/published named Firestore Rules remain unverified.
- Production Supabase already had **1 existing valid pickup-contract order, 5 events belonging to it**, 0 push jobs, and existing SQL lifecycle RPCs. Do NOT wipe, mutate or treat these as disposable fixtures.
- Parent draft PR #211 adds reviewed `verifyIdToken(token,true)` enforcement; its offline targeted **13/13** and complete existing API regressions **231/231** passed before this stacked branch was created. This child branch includes the parent code; verify its own CI separately.

## Exact tests / release gates
This branch introduces synthetic, **credential-free** regression checks for: exact allowlist, 3/20 upper caps, duplicate and malformed lists, unknown merchant/customer IDs, correct mode, required new-admission switch, window expiry and 30-day bound, global hard-off, old test identity fallback, and preserved continuation after admission is paused or a cohort entry changes. It updates exactly three persisted-order continuation sites: customer cancellation, Merchant accept/ready and Merchant reject/payment confirmation/collect. Existing API route and SQL identity/transition enforcement are intentionally retained.

**Actual CI outcome on this draft:** GitHub Actions `L3-N8U-Q bounded Production beta eligibility (offline)` passed API TypeScript compilation, **22/22 focused safety tests**, and **231/231 full existing API regressions**, with no live provider credentials. The shared `Vercel – localeats-merchant-staging-r52d` deployment check is **red**, separately, because the dedicated Merchant staging Vercel project attempted `npm run build:merchant-staging` on this Production-oriented branch, whose package scripts do not include that staging-only command. Vercel build logs confirm `Missing script: "build:merchant-staging"`. **Do not remove the dedicated staging guard, alter Production settings, or claim that a staging Preview was deployed.** A future release review must resolve check applicability using explicit staging-project branch filtering or a dedicated reviewed staging integration rather than weakening isolation. The API offline tests passing does not automatically make the whole PR merge-ready.

**Remaining mandatory release evidence (separate owner approval):**
1. Validate actual Production Firebase named Firestore Rules and Firebase Admin credential; verify revoked account, wrong-owner and account switching against owned test accounts (no tokens in logs).
2. Verify **all cohort IDs** map to approved active Production shops and invited real Firebase users; validate Production SQL/physical service area and shop capacity; capture signed owner/customer consent and collection/payment handling.
3. Run one owner-approved **real-system, controlled** quote→create→merchant accept→ready→record pay-at-shop→collect path. Verify price tamper rejection, idempotent duplicate, wrong merchant denial, accurate order receipt/history, and cross-user privacy. Preserve preexisting history and arrange explicit test-item refund/cleanup where necessary. Don't confuse synthetic SQL rollback tests with real flow.
4. Independently verify browser/OS **FCM push** from actual new-order and ready events, permission-denied fallback and in-app order state, and Customer/Merchant PWA installation prompts on real browser devices.
5. Review baseline errors, Production PostGIS-related Supabase security advisor warnings, monitoring/alerts, owner pause/rollback mechanics and support protocol; gain explicit final go/no-go **before** enabling Production flags or merging PRs.

## Rollback / operations
- To stop new Production beta orders **without abandoning existing orders**: set server Preview/Production beta admission toggle to `false` under an approved release process. Do not reset an active merchant's order or remove the stored customer from historical order records.
- In an urgent security incident, use top-level `PICKUP_WRITES_ENABLED=false` (also blocks status transitions); alert owners and coordinate manual resolution; do not delete Production data.
- For a code regression, roll back only to an immutable, verified Production API deployment and re-check effective environment, while keeping beta admission closed. Never rollback Production Firebase rules or SQL from a staging file blindly.

**Result L3-N8U-Q:** Prepared source-only, opt-in bounded beta admission and continuing-order protections. It is **not a live Production beta**. 
