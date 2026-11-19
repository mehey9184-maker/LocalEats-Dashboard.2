# L3-N6 — Merchant Pickup Component: Isolated Chromium Acceptance

**Date:** 19 November 2026 (Africa/Johannesburg)
**Result:** PASS — component-level offline browser acceptance.
**Release gate:** This does **not** constitute acceptance of the entire authenticated Merchant Dashboard, a live payment, or Production readiness.

## Source, environment, evidence

- GitHub Actions run: [44555901948](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/actions/runs/44555901948), **completed success**, tested commit `5e47afcd2f094f53435ddad8b8abcb1908577665`.
- Source: `src/components/PickupOrderActions.tsx`, `src/services/MerchantApi.ts`, `src/services/merchantPickupRecovery.ts`, `src/services/merchantPickupPolicy.ts` — bundled directly, **not copied or replaced with synthetic UI logic**.
- Fixture: `tests/l3-n6/{fixture-entry.tsx,fixture-auth.ts,fixture-api-auth.ts,run-merchant-browser.mjs}`.
- Workflow: `.github/workflows/l3-n6-merchant-browser.yml`.
- Real Merchant CSS was extracted from a successful Vite build and loaded with the original React pickup-action component in headless Chromium.
- Fixture runs only at a random local `127.0.0.1` HTTP port. Chromium network interception aborts any external request; Firebase and API identity headers are mock modules resolved exclusively by the test-time esbuild plugin.
- The **shipping Merchant Vite build** is compiled with pickup orders OFF. A separate ephemeral test bundle substitutes a local-only `VITE_PICKUP_ORDERING_ENABLED=true` for real component interactions against the in-memory loopback API; no production/frontend environment is changed, and the test bundle is never deployed. A second local test bundle keeps actions disabled.
- No remote database, Firebase, cloud API, merchant account, Production/staging Vercel Preview mutation, or actual push/financial transaction is involved.

## Automated acceptance results

GitHub job passed: **43 component/browser assertions** across widths **320px, 390px, 1280px**, **15/15 Merchant pickup policy/regression tests**, **7/7 merchant command-recovery tests**, and the shipping Merchant build.

| Scenario | Status | Coverage |
|---|---|---|
| Pending → Accept → Preparing | PASS | Real component button, API call, valid receipt, refreshed state |
| Preparing → Mark Ready | PASS | Confirmation and pickup status |
| Ready unpaid → card-machine payment confirmation | PASS | Actual confirmation dialog; paid fact separately confirmed by local API |
| Ready paid → explicit handover → Collected | PASS | Confirmation dialog, final revision, durable local fixture state |
| Reload after collection | PASS | Server fixture, not browser-only optimistic display, establishes result |
| At 320 / 390 / 1280 px | PASS | Buttons visible, enabled, minimum target width, within viewport |
| Disabled live-order build | PASS | Accept disabled; mutation count exactly zero |
| Lost response after accepted action | PASS | Browser discards *post-commit* acknowledgement; UI does not invent success |
| Account switch after lost acknowledgement | PASS | New merchant does not receive old merchant's card/recovery controls |
| Return to original merchant and retry | PASS | Same saved command ID, replayed receipt, exactly one synthetic state transition |
| 503 before payment is recorded | PASS | Unpaid state preserved; no Collected action; retry can confirm payment |
| Local API traffic isolation | PASS | Network routing restricted to loopback, no hosted service dependency |

The first two experimental fault-injection variants were corrected **in the test harness**: destroying the local socket did not deliver a deterministic browser rejection, so the final passing fixture allows the local API to commit the synthetic command and then deliberately discards the acknowledgement at the browser fetch boundary. This does not modify application behavior or reduce retry security.

## Important limitations / next owner gate

- The actual **OrdersManagement page under a real signed-in Merchant session** was not navigated/accepted by this test. It exercises the real `PickupOrderActions` component and recovery adapter in an isolated React page. The full dashboard shell, navigation, live merchant authentication, notifications and real UI integrations remain unverified.
- No real bank/card processing was done; cash and card-machine confirmations were **synthetic events** in the local mock API.
- L3-N5 previously established real Express Customer/Merchant adapters against disposable PostgreSQL 17, but this L3-N6 browser run uses an **in-memory** server for pixel and recovery behavior. The two complementary tests do not, by themselves, prove end-to-end live UI+DB acceptance.
- No real FCM device receipt was verified here. No merchant printing or delivery/Rider activity was tested.
- The next owner gate should use an **approved, explicitly isolated Merchant staging Preview in read-only mode** to verify real Orders page navigation, layout, status warnings, refresh, mobile touch targets and access restrictions. Real command buttons must remain disabled until **separately approved, truly isolated** order writes. A further end-to-end Merchant browser+disposable SQL integration can be staged independently if desired.
- Keep Customer PR #115 and API/Merchant PR #171 **DRAFT / UNMERGED**. Do not change Production, shared staging tables, Firebase rules, activation flags, payments, existing shops or notification sends.

**L3-N6 status:** Isolated pickup-action browser component acceptance **passed**; full authenticated Merchant Dashboard owner acceptance **pending**.
