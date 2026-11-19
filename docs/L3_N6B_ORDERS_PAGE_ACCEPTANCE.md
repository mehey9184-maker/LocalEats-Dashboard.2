# LocalEats L3-N6B — Merchant Orders Full-Page Read-Only Browser Audit

**Date:** 19 November 2026 (South Africa); **branch:** `review/l3-my-kota-private-test-api` (draft PR #171).

## Scope
Mount the **actual `src/components/OrdersManagement.tsx` component** rather than only the action card, using built Merchant CSS and only synthetic, API-verified shop/order facts. The loopback Node service and fake Firebase/Supabase adapters belong exclusively to `tests/l3-n6b/`. There is **no real merchant login**, hosted Vercel endpoint, shared staging/Production database, payment, message, notification, or push. A browser request outside the ephemeral `127.0.0.1` origin is blocked. The shipped application is separately built with `VITE_PICKUP_ORDERING_ENABLED=false`.

## Reproducible artifacts
- `.github/workflows/l3-n6b-merchant-orders-page.yml`
- `tests/l3-n6b/fixture-entry.tsx` (test-only verified-shop, Orders page, refresh and account-switch wrapper)
- `tests/l3-n6b/run-orders-page.mjs` (Chromium acceptance and API stubs)
- `tests/l3-n6b/fixture-supabase.ts`, `fixture-auth-guard.ts`, `fixture-order-service.ts` (no cloud connections)
- Reused original `OrdersManagement`, `PickupOrderActions`, `MerchantApi`, `merchantPickupPolicy`, original CSS, and test identity modules from L3-N6.

## Evidence and current acceptance boundary
- [CI run 44559844429](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/actions/runs/44559844429) emitted **L3_N6B_REAL_ORDERS_PAGE_READ_ONLY_PASS** at 320, 390 and 1280 px, and **L3_N6B_CROSS_MERCHANT_OWNER_GUARD_PASS**: original page and pickup controls rendered; pickup order/payment/collection buttons disabled with warnings; no document-wide horizontal overflow; refresh control's topmost hit target verified; verified shop owner enforced; changing to a differently authorized synthetic merchant prevented old-order disclosure; no mutation calls issued. The job is marked **failed overall** because a separate test wrapper refresh used Playwright locator.click and timed out during the injected error path.
- The test harness was corrected to invoke the wrapper refresh handler directly (does not bypass auth, backend, or the production UI). The follow-up [CI run 44560297503](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/actions/runs/44560297503) is the **final pending full-suite gate** at the time of this checkpoint; do not mark L3-N6B completely passed until it succeeds. No application code was changed to accommodate the test.
- Other Merchant/API workflows at the follow-up commit have passed: L3-N2, L3-N3, L3-N5 PostgreSQL and L3 private My-Kota security; original L3-N6 component controls remain passed.
- The test-only wrapper keeps previously verified same-merchant orders visible during a transient refresh, shows an error rather than falsely claiming an empty kitchen, and purges previous merchant scope during an account change. Successful synthetic execution of that last error-path case must be verified in the pending run.

## Not yet proven
The full live **authenticated Merchant Dashboard App shell**, actual browser navigation, real Firebase login, hosted staging schema, payment at shop, FCM device delivery or Merchant owner manual acceptance. L3-N5 disposable SQL/HTTP and L3-N6 component-level browser tests are complementary but do not automatically establish live launch safety.

## Safety/next gate
No Product UI, ordering flag, API environment, hosted database, Firebase rule, Production branch, payment, order or FCM send was changed. Both Customer PR #115 and API/Merchant PR #171 stay draft/unmerged. Once the isolated page runner is fully green, obtain an owner read-only Orders-page acceptance on a separately verified staging Preview before considering any controlled real-order activation.
