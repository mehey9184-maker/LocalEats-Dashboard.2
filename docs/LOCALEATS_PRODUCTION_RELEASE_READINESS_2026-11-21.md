# LocalEats — production release-candidate register (21 Nov 2026)

**Decision:** **Browse-only release candidate prepared; real order activation remains HOLD.**
This is a code/operations register, **not a claim that public ordering is live**. It must be retained in the repository for future assistants and checked against live deployments before every release. Owner request was to make the apps ready for Production, **then decide what to activate**. Consequently the scope here is release preparation and zero-write live checks; **no Production deploy, database mutation, Firebase Rules change, merge, real orders, FCM send, payment enablement or GPS simulation**.

## Production environment — read-only verified (21 Nov 2026, Africa/Johannesburg)

| Component | Vercel Production | Source commit / status |
|---|---|---|
| Customer | `https://www.localeatssa.co.za` and `https://localeatssa.co.za` | `d5680332d391d9aa497d10ff047c839242b2d62f`, READY |
| Merchant | `https://dashboard.localeatssa.co.za` | `a5168ccbbb37643a58ad4202c72b65dd43149c2e`, READY |
| API | `https://localeats-api.vercel.app` | `a5168ccbbb37643a58ad4202c72b65dd43149c2e`, READY |

Plain, nonsecret **Vercel Production flags** read back:
- Customer `VITE_PICKUP_ORDERING_ENABLED=false`.
- Merchant `VITE_PICKUP_ORDERING_ENABLED=false`.
- API `PICKUP_WRITES_ENABLED=false`, `MERCHANT_AVAILABILITY_WRITES_ENABLED=false`.
- These are distinct gates. No single client flag changes server-authoritative approval, ownership, price, 4 km radius, or persistence.

Production Supabase project `phdjumtqkooyppxozqsi` **read-only counts**: **9 approved and nonarchived shop records, 7 available menu item records, 1 preexisting order, 0 pickup push-outbox records**. The order was present before this release-readiness audit; do not reset, fabricate or delete it. The core `shops`, `menu_items`, `orders`, `profiles`, `pickup_order_events` and `pickup_push_outbox` tables report RLS enabled. Order/event guard triggers exist. **This is not equivalent to an authenticated E2E lifecycle test.**

My-Kota (`shop-my-kota-ivory-park`) is approved with one menu item, base `is_active=true` but authoritative `shops_with_availability.effective_is_active=false`, revision 4, configured hours **08:00–22:00**. Merchant screenshot says store unavailable; do not override effective status remotely. Shop owner must voluntarily confirm genuine readiness during opening hours before a production order test.

### Actual blocking bugs and owner-requested features

**A. Production apex-domain API CORS bug — reproduced and source-fixed, not yet live.**
Production API accepts `https://www.localeatssa.co.za` but rejects `https://localeatssa.co.za` (the second is a legitimate Customer Vercel alias). Read-only direct HTTP tests to **actual Production** `/health`, `/api/v1/catalog/shops`, `/api/v1/catalog/pickup-shops` returned WWW `OPTIONS=204/GET=200` and apex `OPTIONS=403/GET=403`. No Authorization headers, user locations, cookies, orders or sensitive bodies were sent or logged. The original Customer screenshot had no visible URL bar, so this reproduces a **real separate bug**, not proof it caused that exact session's error. Narrow fix and exact/evil-origin tests: [API draft PR #215](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/pull/215). Production may continue to fail from apex until the source fix is merged and the API deployment is VERIFIED; do not broaden CORS to `*`.

**B. Customer out-of-4km browsing — source-fixed, not yet live.**
The old owner-approved [Customer Preview PR #103](https://github.com/mehey9184-maker/LocalEats-app/pull/103) is still available in its READY, paired Vercel Customer/API Previews. The 4 km-only public pickup listing plus current Customer mapper hides distant shops; `Shops unavailable` must mean fetch failure, **not** distance. [Current-main Customer draft PR #125](https://github.com/mehey9184-maker/LocalEats-app/pull/125) replays the relevant code from #103 without overwriting newer checkout/PWA/push/history/navigation. Public catalog `/api/v1/catalog/shops` supplies verified approved shops, real device geolocation computes Haversine distance; distant shop cards are lightened, readable, marked **Outside 4 km / Browse menu only**, genuine API menus still browsable, all Add/cart paths disabled. Server quote/create remains strictly in-range (4 km inclusive), approved/available and authenticated; never spoof position or widen the radius. Initial final source commit `6fce5a3...` had **13/13 passing GitHub workflows**; additional source-only browser-key hardening and tests are under CI and require updated green checks.

**C. Private Gemini key was unnecessarily substituted into Vite.**
Customer `vite.config.ts` previously defined `process.env.GEMINI_API_KEY` from `loadEnv(..., '')`. Even if no client usage currently referenced it, this was an avoidable **browser-secret injection path**. Release candidate removed Vite define/injection and added `tests/customer-production-secrets-main.test.mjs`. Server-only `server.ts` retains runtime `process.env.GEMINI_API_KEY`; never print or share the key. All updated CI/build and live PWA smoke checks must pass before release.

**D. Genuine shop inventory verification — remains an owner gate.**
Several Production records are visibly test-named or test-oriented, some still `is_active=true`. Approved shop count **9** does not mean nine real businesses ready to receive customers. Before broadly displaying the full approved public catalog, verify which shops are genuine, available, accurately located and have reliable menus. Preserve synthetic fixtures for development rather than silently presenting them as real operating merchants. Do **not** delete, archive or alter Production merchant records without explicit owner/business approval. A future optional server-side public pilot allowlist can be developed if needed; no new allowlist is currently enabled here.

**E. Supabase security advisor readback — investigation required, no unreviewed Production migrations.**
The Production advisor reported: 16 tables with **RLS enabled but no policies** (consistent with direct-client access denied under an API-only design; investigate before treating as an error), `public.spatial_ref_sys` with RLS disabled (ERROR), the `postgis` extension in public schema (WARN), three `st_estimatedextent` public SECURITY DEFINER signatures executable by `anon` and `authenticated` (WARN), and Supabase Auth leaked-password checks disabled (WARN). These are **not an authorization to expose tables** or move PostGIS in Production. Inspect grants and compatibility, then devise a staging-tested, reversible schema/remediation proposal. Official: [RLS linter](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public), [SECURITY DEFINER linter](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).

**F. Real pickup and notifications remain unverified in this release scope.**
[Restricted beta acceptance draft PR #213](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/pull/213) passed one credential-free synthetic quote→order→merchant accept→ready→payment/collection journey and twenty existing authorization/replay/negative-case checks. This is **mock Firebase + mock Supabase**, not an actual Customer sign-in → verified R25 order → My-Kota device FCM → physical collection. The protected merchant availability UI remains offline while the server write gate is OFF. Published Production Firebase Rules for the named Firestore DB and real FCM on the actual browsers/devices must be checked before any real-order activation. Real My-Kota pilot requires **one consenting, authentic Customer physically within 4 km**, a shop owner ready to fulfill, explicit per-shop/per-UID beta admission, verified push & order fallback, pay-at-shop cash/physical card only, audit trail and tested pause/rollback.

## Controlled release decision — order of operations

### Release A — public browse-only Customer readiness
1. Keep all four pickup/merchant availability write flags OFF. Keep delivery/Rider/LocalPay/online payment/subscriptions OFF.
2. Finish Customer PR #125 current-head TypeScript, PWA build, ShopCard, out-of-range (3.9/4.0/4.1 km), closed-shop, identity/logout and no-Gemini-key-in-client checks. Run **read-only live** Customer/Merchant site, `manifest.webmanifest`, `sw.js`, canonical-origin health & catalog smoke; any failure blocks the release.
3. API PR #215 must pass exact WWW/apex CORS, typo-domain denial, full API regressions and live read-only preflight. Record the exact SHA and Vercel project. Verify after any eventual API release that **both** exact Customer domains return 200 GET and allowed 204 preflight, without opening wildcard CORS.
4. Verify the approved public shop list contains only genuine pilot businesses with real open status or clearly marked closed; owner must approve how to handle test fixtures. Confirm actual device GPS, shop coordinates, menu accuracy and removal of the “Shops unavailable” error on both domains and read-only 4 km/no-shop conditions.
5. **Only after owner signs off on the above**, merge the narrow API CORS PR and then the current-main Customer browse-only PR, inspect new Vercel Production commit SHA/aliases and replay smoke. Keep pickup OFF; preserve old READY deployments as rollback references. If CORS, PWA, menus, original design or navigation regress, **rollback only the affected Vercel project**.

### Release B — invite-only real My-Kota pickup (separate explicit approval)
1. Complete Production Firebase Rules/Admin project/FCM trust, client/merchant login and token checks, owned My-Kota shop linkage, production DB schema/RPC guard and private logging audit.
2. Verify genuine open state / 08:00–22:00 hours and a consenting nearby Customer located within 4 km. Remote owner can review distant shops but **cannot create a genuine nearby order from a distant location**.
3. Activate **only** the minimum approved shop+UID beta allowlist and authorized server-scope write gates, with a clear pause/expiry; do not enable open public ordering.
4. Run one monitored R25 pay-at-shop My-Kota transaction: real server price quote, order accepted by correct merchant, customer receipt, background push on owner device, Ready, handover/collected, no cross-account leakage; record logs and rollback readiness.
5. Expand to real public pickup only after owner acceptance and repeated success. No Rider/delivery, online payment or LocalPay activation under this scope.

## Portability / cost guardrails
Current production application is on **Vercel** with a **Supabase Postgres-backed API**; Firebase Auth, named Firestore database and Firebase Cloud Messaging must remain clearly identified as separate services (the owner's Production Firebase project is `localeats-5e26e`, staging is `localeats-staging`). Public API responses and an API adapter should be the source of truth; do not introduce new browser-to-Supabase writes. Keep media storage behind a provider-neutral URL/adapter (Cloudinary is already used; R2 is a future migration target) and avoid mandatory downloads of every distant menu/image. Do not claim the planned Cloudflare Worker or R2 migration has already happened. Preserve env/diagram/docs so a future AI can migrate a component without tying the entire business to one provider.

**Reporting convention:** Record what actually passed, failed, was not tested, and which immutable commit/deployment was inspected. No synthetic tests advertised as real transactions. No Production merge/deploy implied by a draft PR or a Vercel READY Preview.


## L3-N8U-X — Public pilot catalog credibility checkpoint (2026-11-21)
The public catalog returned nine shop records; all had the same 4.8 rating with no published review counts, none was effective-open, one explicit Production Test Shop had no coordinates and an empty menu, and one Ivory Park-addressed shop had coordinates (3,-2), outside South Africa. A browser screenshot demonstrated eight GPS-free browse-only cards including My-Kota and its real R25 menu. The misleading `8 Online` and spurious partial-menu warning have been corrected in Customer draft PR #126 (not merged). Before any public release: owner must verify business identity, approved/archived state, genuine coordinates, opening/availability and menu truth; no test merchant may be presented as independently verified.

The API draft `review/l3-n8u-x-pilot-catalog-allowlist` introduces an **opt-in** `PUBLIC_CATALOG_PILOT_SHOP_IDS` server-side read-publication filter for catalog list, nearby, detail and menu. Exact IDs only. Absent means original approved/nonarchived catalog behavior; present-but-empty fails closed. Preview should set `shop-my-kota-ivory-park`, but this is a **candidate for review**, not proof the merchant is genuine/open. This filter does not authorize ordering. Public Production deployment, CORS release, My-Kota activation, shop write operations, or broad public browsing remain separately owner gated.
