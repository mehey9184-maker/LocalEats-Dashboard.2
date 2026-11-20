# L3-N8N — Paired Customer/API staging acceptance and current-main reconciliation

**20 November 2026 — DRAFT REVIEW ONLY.** No production deployment, Firebase Rules publication, Supabase mutation, real Firebase Auth account, order, payment, FCM send or Rider activation.

## 1. Exact repo state: latest Customer main ≠ staging feature stack

A live GitHub read of `mehey9184-maker/LocalEats-app` confirmed **`main` SHA `d5680332d391d9aa497d10ff047c839242b2d62f`**. It includes the independent Claude UI/quote work (merged PR #59) and subsequent verified-receipt/paginated-history work. Checkout remains `src/screens/CheckoutScreen.tsx`, imported by `src/App.tsx`. No edits to `main` were made.

The separate Customer N8M draft PR #120 head is **`ad4f523dd6ea3251cbe154864050255f4be48616`**, stacked on draft #119 and an older isolated Customer Preview base `c77736e7b4878965baa31ec2ada8138f554d6a7f`. GitHub compare `main...review/l3-n8m-customer-community-read-contract` reports diverged; **the Customer main receipt/history changes are absent from the reviewed staging stack**. Notable files to reconcile are `src/App.tsx`, `src/pickup/client.ts`, `src/screens/OrderHistoryScreen.tsx`, the new `src/services/pickupReceipt.ts` and receipt/history tests. Do NOT force-merge #119/#120 or reset `main`; create a separately tested reconciliation branch/replay of known approved changes once the upstream work is reviewed. Avoid accidentally undoing quote, receipt, history or old ShopCard UX.

API/Merchant N8M draft PR #204 head **`2b377ee1408516d3df6d2a33e18590b2d3209f09`** remains unmerged; its community route is dormant and write-disabled. Older production Merchant/API deployed SHA remained `a5168ccbbb37643a58ad4202c72b65dd43149c2e` in a read-only Vercel check.

## 2. Real frontend data-access classification — audit of current main

**Do not classify a file as connecting to Supabase merely because it imports `supabase`.** Checked-in `src/lib/supabase.ts` is a Firebase Auth compatibility wrapper; `supabase.from(...).select/update/insert` uses a local mock chain and `supabase.rpc` is an error, not a browser Supabase SDK query. `@supabase/supabase-js` type imports are also not network calls. The actual Customer `server.ts` independently constructs a server-side `supabaseAdmin` service-role client; that *is* Supabase access and must be reviewed as a separate backend, not browser-side.

| Runtime path (current main) | Actual service | Classification and risk |
| --- | --- | --- |
| `src/services/customerPickup.ts` → `src/pickup/client.ts` | `VITE_LOCALEATS_API_URL` → `/api/v1/catalog/pickup-shops`, menu, quote, authenticated pickup order/history | **Server API** for controlled pickup, real GPS/approved shops; no direct Supabase browser query. `VITE_PICKUP_ORDERING_ENABLED` must remain false for staged rehearsal |
| `src/screens/CheckoutScreen.tsx` `supabase.from("orders"/"promo_codes"/"rider_profiles")` | Local mock `src/lib/supabase.ts` | **No verified Supabase database read**. Legacy promo/rider/order count decisions using mock/locally cached state must never be considered authoritative for eligibility, prices or customer assurances |
| `src/lib/profileService.ts` `upsertProfileWithRPC()` | Fetch `/api/profiles` on Customer Express backend, *plus* `FirestoreService.saveProfile()` direct Firestore mirror and offline local queue | **Mixed server API + direct Firestore write**. User ID/role in body may be client supplied; verify server Auth/UID matching. Offline cached success is NOT proof of persisted server profile. This is NOT a browser Supabase RPC |
| `src/hooks/useShopsData.ts` | `FirestoreService.getShops/listenToShops`, `fetch("/api/v1/shops")` | Legacy **direct Firestore reads and onSnapshot listeners**, plus separate Express API. Merge/cached data and demo shop seeding can diverge from server-authoritative approved pickup catalog. Distinguish active Home path from legacy hook |
| `src/lib/firebase.ts` reviews | Firestore `reviews` | Direct reads via filtered `getDocs`; direct writes `addDoc`; a submitted review is NOT verified against a collected pickup |
| `src/lib/firebase.ts` follows | Firestore `follows` | Direct read query and `setDoc/deleteDoc` mutations; no server-follow authorization |
| `src/lib/firebase.ts` chat | Firestore `messages` | Direct onSnapshot and `setDoc/writeBatch`; browser `sender_id` and `sender_role` may be caller-selected, **not verified order participation** |
| `src/lib/firebase.ts` profile/push/Rider/shop/menu | Firestore `profiles/user_push_tokens/rider_profiles/shops/menu_items` | Direct browser writes for profile mirror, device token, rider position, shop/menu edits or demo fixture seeding. Stored rules and server ownership must be verified; client guards alone are bypassable |
| `src/lib/firebase.ts` `createAuthoritativeOrder` | Firebase callable Cloud Function | **Separate legacy order path** in `CheckoutScreen` outside the controlled pickup API. Do not activate delivery/legacy checkout or assert it shares Cloudflare/Worker pricing/authorization |
| Customer `server.ts` `/api/orders`, `/api/profiles` | Express server's `supabaseAdmin` | **Actual server-side Supabase**. The older Express `/api/orders` contains client-pricing and in-memory fallback paths; requires separate remediation and a reachable-path review before ordering activation |
| Customer `src/screens/OrderHistoryScreen.tsx`, pickup receipt | Controlled pickup API history route | New `main` work needs preservation and regression review during any draft reconciliation |
| N8L/N8M drafts #119/#120 | Staging-only guards, public display mapper, dormant GET-only community adapter | **Not in current main**. Synthetic CI passed but is NOT evidence these guards or routes are active in the deployed Customer app |

This is a **source-based classification**, not packet-level proof of which legacy path is mounted for every user. Graphify's import graph is useful for finding candidates, but it cannot alone certify runtime call reachability or live database access.

## 3. Current dedicated staging Vercel facts (read-only)

| Required target | Observed READY branch / commit | Desired reviewed N8M | Acceptance |
| --- | --- | --- | --- |
| Customer Vercel project `localeats-customer-staging-r52d` (`prj_F4szeGF8BxmYpdUVA2yLYrjAmMUN`) | `review/l3-my-kota-private-test-customer` / `c77736e7...` | Customer #120 `ad4f523d...`, after explicit main reconciliation | **MISMATCH** |
| API Vercel project `localeats-api-staging-r52d` (`prj_eroDrVcFOPlvRJzjCU7vbwGnleFT`) | `review/l3-n8g-merchant-staging-cutover` / `ac4563cb...` | API #204 `2b377ee1...` | **MISMATCH** |
| Customer `VITE_LOCALEATS_API_URL` on Preview | `https://localeats-api-staging-r52d-mehey9184-makers-projects.vercel.app` | Exactly the intended Customer-stage canonical API, not the Merchant-only alias | **CONFIGURED**, but not evidence that N8M API is live there |
| Customer and Merchant Preview Firebase | `localeats-staging`, explicit Firestore `(default)` in N8H–N8K audit | API Firebase Admin service-account scope and deployed Firebase Rules must be independently attested | **BLOCKED** |
| Stage Supabase `LocalEats-Profile-Staging` | Public tables `shops/menu_items/profiles`; only one distinct shop owner in earlier aggregate | Two independent approved owner mappings for actual A/B; review/follows/messages/orders currently lack verified public tables | **BLOCKED** |
| Production Merchant/API | Unchanged previous `main` SHA `a5168cc... ` at inspection | MUST remain unchanged | **PASS** |

A GitHub PR-triggered **Merchant frontend** Preview on `localeats-merchant-staging-r52d` is **NOT** an API Preview and **NOT** a Customer Preview. A green CI run against fake Firebase settings does not prove the same app is deployed with the right hosted Firebase credentials. Do not claim a paired browser acceptance.

## 4. Pair readiness preflight — source-only, no hosted credentials

`tests/l3-n8n/paired-preview-readiness.mjs` is an offline pure function taking only nonsecret project IDs, Git SHA/branch names, booleans, domains and attested isolation status. It intentionally **fails the current evidence**. A positive synthetic result would only permit consideration of a safe, owner-approved read-only browser smoke. It explicitly never returns real Firebase A/B success or approval to create shops/users, publish rules, activate profile/order writes or touch Production.

The gate rejects a wrong Vercel project, non-Preview target, one stale or mismatched SHA, unreconciled Customer main receipt/history changes, mismatched Firebase/Firestore project or Admin credentials, stage Supabase overlap with Production, wrong Customer API origin, unverified CORS, an unreviewed Customer mutation guard, mounted community routes, enabled order/profile/community writes or missing owner consent.

## 5. Safe staging-only acceptance checklist (NOT YET EXECUTED)

1. **Reconcile Customer `main` + #119/#120 in a new reviewed staging branch** without overwriting the newly merged quote UI, receipts and paginated history. Run current-main checkout, receipt, history, cart, profile-sign-in, maps and small-screen tests. No merge or Production deployment.
2. **Separate explicitly approved Vercel Preview-only deployments** for that exact Customer review SHA and the exact API review SHA. Both must be READY in the dedicated correct Vercel projects. Don't repoint the stable Customer stage alias to Merchant-only API or silently change Production domains. Only approved read-only target/env adjustments.
3. **Verify API + Customer identities** without printing keys: `localeats-staging`, `(default)`, Admin service-account project, isolated Supabase project, permitted Customer origin CORS. Request no private tokens or API data and do not execute POST/PUT/PATCH/DELETE.
4. **Safe anonymous/no-token GET/OPTIONS checks:** confirm public staged health, actual GPS-bound `/catalog/pickup-shops` and shop/menu response contracts (no private contacts/IDs) using sanitized known fixture data; verify unauthorized/absent token requests are denied with 401/403, not PII. For arbitrary GPS, never manufacture a user's location. Order readiness must be 503 blocked; no live orders.
5. **Owner browser review:** verify original ShopCard, installed-app prompts, menu, cart, quote-disabled checkout, receipt/history and profile state cannot invent persistence. No signup/first-time Google and no push sends during a read-only acceptance. Full A/B authentication, revoked/disabled-token and shop ownership can only occur after stage rules, service account and disposable identities are separately approved.
6. **Rollback:** preserve the prior staging deploy SHA/URL/domain mapping; if a staged candidate fails, revert only that Preview alias or return to the prior stage branch. The actual **deployed** Firebase Rules source/release and private rollback are still unknown: no rules publication.

**Release status: BLOCKED.** The L3-N8N gate and audit are safe preparations. No hosted paired deployment or real sign-in acceptance has occurred, and no new community write routes/storage are authorised.
