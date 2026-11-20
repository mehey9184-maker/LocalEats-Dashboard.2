# L3-N8U-S — Customer public catalog availability vs out-of-range browsing

**Date:** 2026-11-21 (Africa/Johannesburg). **Scope:** source-only CORS fix on API `main` and recovery of the **existing, owner-approved Customer Preview**. **NO Production merge, deploy, flag changes, Firebase/Supabase writes, live FCM, order creation, customer fake GPS or radius expansion.**

## Owner screenshots: two independent failure modes

The user posted Customer Home with signed-in-looking greeting and **`Shops unavailable — Pickup shops could not be loaded`**, `0 Online`, and a `Reload Shops & Live Data` button. Merchant Dashboard simultaneously displayed authentic **My-Kota** and its R25 menu item but `Store Offline — Not Receiving Orders`. These screens do not prove a 4 km rejection. A successful empty in-range catalog is **not** supposed to become the `Shops unavailable` error; the latter indicates a failed fetch, failed public API preflight, malformed/unavailable catalog or missing/failed individual menu results.

Current immutable Production Customer at `www.localeatssa.co.za`/apex is SHA `d568033` (main). It reads `GET /api/v1/catalog/pickup-shops?lat=...&lng=...` and `GET /api/v1/catalog/shops/:id/menu`, with a short-lived location-scoped cache. The Production API (SHA `a5168cc`) `pickup-shops` deliberately filters to **distance <=4 km** and current Customer `mapPickupShop` rejects noneligible distances. Therefore it is not possible to implement browsing distant shops merely by changing a CSS opacity. Remote customers currently should get a successful **empty** nearby catalog if all other services work.

## Proven CORS gap, qualified root cause

Production public Customer Vercel project serves **BOTH** `www.localeatssa.co.za` and `localeatssa.co.za`. However, current Production API source `localeats-api/src/corsOrigins.ts` authorizes `https://www.localeatssa.co.za` and some exact env origins while **not** authorizing `https://localeatssa.co.za` at all. The Production API Vercel env snapshot has no public `CUSTOMER_APP_ORIGIN` override in Production; `MERCHANT_DASHBOARD_ORIGIN` is unrelated. A browser visiting the **apex** would thus fail the `OPTIONS`/GET origin guard with 403, and the Customer renders `Shops unavailable`.

Vercel Production API runtime logs in a limited recent window recorded **`OPTIONS /api/v1/catalog/pickup-shops`**, but did not expose the caller's `Origin` or an HTTP status. The user's screenshot did not show the browser URL bar. Therefore this is a **confirmed CORS configuration bug with a plausible screenshot connection**, not proof that this specific request used the apex. Direct external GET verification from the assistant container was unavailable (DNS fails); a Vercel trace lookup of an observed request ID was not found. Do **not** claim all Customer catalog errors are caused by this one issue.

This draft makes **one exact-match API allowlist change only**: permit `https://localeatssa.co.za` alongside the existing `https://www.localeatssa.co.za`. The source tests explicitly reject http, evil lookalikes, extra path, and nonstandard ports. It does not relax Firebase/Auth, CORS broadly, rate limits, Production writes, merchant approvals, menu prices, 4 km pickup, or `PICKUP_WRITES_ENABLED=false`.

## Exact prior owner-approved preview recovered: Customer PR #103

- [Draft Customer PR #103](https://github.com/mehey9184-maker/LocalEats-app/pull/103), branch `feature/customer-outside-pickup-area-preview-20261117`, still **OPEN DRAFT** and unmerged; Customer preview commit `1688c5a4bebeea65cb01c3b6d37cd4f589a212c8`.
- Verified Vercel READY stable Customer Preview alias: `https://project-x7cvt-git-feature-cust-f75225-mehey9184-makers-projects.vercel.app` (immutable deployment `dpl_FvuGpcHFMi4nmo9CwNnHBsyQ7Kp6`).
- Its paired **API Preview** `https://localeats-api-git-preview-cust-44b534-mehey9184-makers-projects.vercel.app` is also READY; contains read-only `/api/v1/catalog/shops` source and exact Customer Preview CORS origin. Vercel Deployment Protection may require the owner to be signed into the correct team; do not disable protection to run a test.
- PR #103 is the precisely requested original UI treatment: public approved/nonarchived shops (including distant ones) are discovered via **`/api/v1/catalog/shops`**, the browser uses real validated coordinates to compute distance, displays in-range shops first and lightens `Outside 4 km` cards in `More shops outside your pickup area`, with `Browse menu only` label and real menu reading. **No full-card opacity degradation**; text stays legible. Shopping cart, menu Add, checkout are blocked outside 4 km. Nonmatching/invalid shop coordinates omitted; shop cards retain their original layout, image and navigation.
- **DO NOT merge PR #103 blind**. It was created from an older Customer `main` and changes `App.tsx` substantially; current main has newer N8O pickup/notification/history/UX controls not necessarily present on PR #103. Reapply only the reviewed discovery/mapping/UI security changes onto the **current-main** Customer branch, then run all customer regression tests and verify a Preview with both a far and near device. Or use PR #103 Preview **only for immediate visual acceptance** without activating ordering.

## Safest testing plan when the owner/customer is farther than 4 km from My-Kota

1. **Remote browse-only:** Use the existing draft PR #103 Preview at the customer's real GPS to confirm My-Kota is discoverable as a visually lighter **Outside 4 km / Browse menu only** card. The item should be viewable at its true price but Add/checkout remain disabled. Missing location must prompt for permission without guessing proximity.
2. **Near-shop genuine fulfillment:** One **consenting** customer using a real signed-in Production Firebase account physically located within 4 km of My-Kota, with shop owner genuinely available during verified **08:00–22:00** hours, completes the tightly restricted pickup test only after separate security/Production rollout authorization. Do not spoof location, increase 4 km, or connect distant customer to special write bypass.
3. **Remote technical coverage** remains offline mocked API integration tests in [L3-N8U-R PR #213](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/pull/213) (1/1 mounted synthetic journey + 20/20 authentication/beta guards passed) and existing Customer PR #103 boundary regressions. Those **cannot replace** one real FCM/merchant receipt/collection acceptance.
4. **Before public browsing changes:** Confirm which domain the actual Customer screenshot used (apex or www), inspect non-secret browser Network GET/OPTIONS statuses without sharing tokens, review the repaired API CORS draft tests, and check the actual approved catalog state/availability. Both domains must return a truthful catalog or empty state, not `Shops unavailable` merely because no shop is within 4 km.
5. **Release ordering** requires **separate explicit owner go/no-go** for the stacked beta API auth/allowlist drafts, a near-shop customer/merchant monitored test, authoritative quote/idempotency/ownership checks, valid FCM delivery, and pause/rollback. Both Customer and Merchant Production switches and API `PICKUP_WRITES_ENABLED` remain OFF until then.

**Status:** This draft is a narrow CORS source fix only; out-of-range Preview already exists for acceptance; public pickup is NOT activated.

## Independently observed live read-only CORS HTTP evidence (21 Nov 2026)

GitHub Actions [L3-N8U-S CORS gate, run #44836907376](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/actions/runs/44836907376) **PASSED** (API build, precise CORS cases, full existing API regressions and read-only Production HTTP diagnostics). Its token-free requests to the current Production `https://localeats-api.vercel.app` returned:

| Request (exact browser Origin) | OPTIONS | GET | Browser CORS response |
|---|---:|---:|---|
| `https://www.localeatssa.co.za` to `/health` | 204 | 200 | Allowed exact origin |
| `https://localeatssa.co.za` to `/health` | 403 | 403 | No allow-origin header |
| `https://www.localeatssa.co.za` to `/api/v1/catalog/shops` | 204 | 200 | Allowed exact origin |
| `https://localeatssa.co.za` to `/api/v1/catalog/shops` | 403 | 403 | No allow-origin header |

**This confirms the exact apex CORS bug on the hosted Production API**, not just a source hypothesis. The browser screenshot omitted the URL, so it does not confirm this was that session's root cause. A second read-only synthetic-coordinate `GET /api/v1/catalog/pickup-shops` probe was added to run separately, without placing any order. The source fix **remains draft and is NOT deployed**. No sensitive response bodies, account tokens or user location were printed.

## Real pickup-shops endpoint observed (21 Nov 2026)

Token-free GitHub Actions [run #44837403758](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/actions/runs/44837403758) confirmed the actual live `/api/v1/catalog/pickup-shops` route (with an **artificial fixed coordinate in a public GET, not a real person's GPS and not an order**) behaves as follows: exact WWW Customer `OPTIONS 204` and `GET 200`; exact apex Customer `OPTIONS 403` and `GET 403`. The route and underlying public Production database are reachable from WWW. A remote user getting **Shops unavailable** on WWW may still have a separate browser-side CORS/cache/configuration/network problem: the original screenshot did not show domain or developer-network status. The single-origin code fix still needs explicit Production merge/deploy authorization; this draft has not affected current API responses.
