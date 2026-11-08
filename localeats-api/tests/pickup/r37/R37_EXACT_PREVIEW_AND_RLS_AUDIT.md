# LocalEats R3.7 — Exact-Commit Customer/Merchant Preview and Payments RLS Risk

**8 November 2026. Read-only Preview inspection and synthetic security tests only; NOT public launch acceptance.**

## Result: both exact-main Preview deployments are READY

Previously, Preview links did not match the current Customer or Merchant main commits. For R3.7, each repository gained an **additional branch**, `review/r37-exact-main-readonly-preview-20261108`, pointed at the exact existing main commit. Vercel created independent **non-Production** deployment IDs and Preview aliases from those sources. No source commit was changed in either app to create these deployments.

| Surface | Git commit SHA | Vercel deployment | Preview URL |
|---|---|---|---|
| Customer | `01069d9e6db41325c4ad9a086a0148efa32edce7` | `dpl_J94kpwCPbYp67q7J8s287g8ksjfi` | https://project-x7cvt-7hg9ian4x-mehey9184-makers-projects.vercel.app/ |
| Merchant | `5aedc5424d7070ee7156a080cc69e6a550acc1a4` | `dpl_6WuaU4yc1dr7i18Pnk34jC1zxedW` | https://local-eats-dashboard-2-6m8o-82gac7vcv-mehey9184-makers-projects.vercel.app/ |

Both deployments were `READY` and an authenticated Vercel read-only HTTP GET of the root page returned `200 OK`. They are protected by the owning Vercel project's authentication settings; reviewers may need to sign in. The Production aliases were **not** retargeted.

**Critical limitation:** An HTTP GET of HTML is NOT a screenshot, an authenticated React application walkthrough, a test with physical device GPS, or a guarantee that the Preview API is isolated from live services. The Preview environmental variables and backend routing have **not** been verified as safe for order writes. During R3.7, DO NOT click Checkout/Buy, edit a merchant, confirm an order or accept any action that writes; only navigate and inspect. An eventual test-order flow requires a separately verified pickup-capable staging environment and explicit owner approval.

## Concrete no-write observations

- Customer served a recognizable LocalEats app page with a loading shell and pickup-focused meta description.
- **Confirmed copy mismatch:** Customer HTML `<title>LocalEats | Local's Best Kota & Braai Delivery</title>` and keywords `Food Delivery`, despite launch being pickup-only. This is a narrow trust/copy fix to review in a separate Customer Preview PR, preserving original card and UX. No actual UI change is applied in this phase.
- Customer still references a OneSignal bootstrap on **Production domains only**. R3.7 did not activate it on Preview; do not infer that Firebase push is reliable or that OneSignal has been removed.
- Merchant returned `200 OK`, document title `LocalEats Merchant`, built JS and CSS asset links, and a PWA manifest. None of this certifies the Storefront settings entry or live Orders visibility.

## Owner acceptance checklist — ALL pending

1. **Login and guest profile:** Guest goes straight to Login before saving profile. Logged-in refresh stays on Home without unwanted initial-page jump.
2. **Original My-Kota home and location:** Preserve original shop card and menu/cart entry, nearest-first sorting and 4 km rule, no red-pin selector, stable skeleton with no blinking.
3. **Closed-shop browse:** Allow actual menu and prices, disabled Add/Buy with closed label.
4. **Cart, pricing and test checkout:** R0 service/delivery fee, pay-at-shop only, **“Simulate test checkout” creates no real order**. Do NOT submit this Preview UI if its backend isolation is unknown.
5. **Merchant Settings / Storefront:** Settings Storefront entry opens, payment methods and shop location controls are understandable and access-controlled.
6. **Merchant Orders page:** Compact toolbar does not cover orders; status controls are legible. **Do not operate any real order**.
7. **Notifications:** Real Firebase FCM, background/reconnect timing and missing/late pushes only on a separately approved, fully isolated environment. Synthetic queue success cannot certify delivery.
8. **Riders/Delivery/Payments/Rewards safe defaults:** Rider page Coming Soon; no delivery, online checkout, subscriptions, live Rewards or automatic merchant payout.

**All eight remain unapproved.** The user must perform or explicitly accept a genuine exact-commit browser/phone Preview walkthrough and report any mismatch. Do not mark `manual_pass` true without evidence. The manifest and Node test enforce that distinction.

## Production payments permissions — verified and unresolved

A **read-only** Supabase metadata query confirmed:
- `public.payments` columns include `id uuid`, `shop_id bigint`, `amount numeric`, `payment_method text`, `status text` (the exact legacy payment model, not the current pickup order cash confirmation event).
- `anon`, `authenticated` and `service_role` all have SELECT/INSERT/UPDATE/DELETE table privileges. RLS is enabled and the single `Payments access` policy permits **authenticated `ALL` operations with `USING true` and `WITH CHECK true`**.
- That combination gives authenticated API users **no per-shop row restriction in this policy**. It must not be treated as safe merely because pickup currently uses the authoritative API for order/payment status. We did not execute unauthorized SQL against Production or access real payment records.
- The separate `public.shops` policy is SELECT-only even where column grants are broad; do not overstate UPDATE permission without checking RLS.

`payments-rls-lab.SYNTHETIC_ONLY.sql` and `run-rls-offline-r37.sh` reproduce the policy in disposable PostgreSQL 17 with fake shop/payment IDs. A simulated unrelated authenticated role can read, UPDATE, DELETE and INSERT another shop's fake payment rows. The lab then **REVOKEs the exposed client grants and removes the permissive policy only inside the disposable container**, and confirms all client table operations are denied while a separately authorized test server role can still SELECT.

**This is NOT a Production migration or a safe turnkey fix**. An actual remediation must first search existing application callers, decide if any legitimate UI needs direct read access, preserve audit/history/settlement behavior, implement the chosen least-privilege interface under correct Firebase-to-server authentication, and pass isolated staging read/write/cancellation tests. Only with owner approval can a reversible migration and monitored rollout be considered. Do not blindly DROP the live policy.

## What advances readiness and what doesn't

- Exact-commit build/HTML evidence: **complete** for both apps, no change to Production aliases.
- Logged-in browser screenshots, Stores/Orders and real push: **pending**.
- Live `payments` RLS hardening: **pending**. Reproduced in a disposable lab but not modified remotely.
- R3.6 recovered applied SQL and offline replay: already complete, **full deployed schema equivalence still not certified**.

**Public pickup launch readiness remains an approximately 60% working estimate**, pending owner acceptance and security closure, not a mathematical CI grade. Keeping the number unchanged avoids conflating test coverage with a working live launch. Rewards and Rider/Delivery remain inactive for the initial pickup-only period.

## Next suggested phase

R3.8 should first deliver a staged least-privilege payment-policy remediation with a tested migration/rollback plan and current API caller audit, while finishing exact-Preview owner acceptance. Do not create real orders, live subscriptions, online payments or production data mutations as part of that preparation.
