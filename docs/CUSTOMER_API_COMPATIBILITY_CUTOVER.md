# Customer read/quote API compatibility — review before Production

Base: API main `09be52aa189fe933dae418615409bca13225c422`. Branch: `integration/customer-api-read-compat`.
Customer candidate: `integration/customer-original-ui-pickup` at `e8c41d728834390460923fb6a641915f4dfd8a9a`.

## Scope and guarantees

Only API source/tests/configuration and this repository's required documentation change. Dashboard UI, Rider routes/implementation, migrations and business data remain unchanged.

- Public pickup discovery uses approved, unarchived, active shops with numeric coordinates, Tembisa/Thembisa/Ivory Park location metadata, and maximum 4 km from supplied real coordinates. Menu/detail reads retain existing approval/archival checks and authoritative prices/availability.
- `POST /api/v1/orders/quote` requires the existing Firebase ID-token middleware and `pickup-v1`. It uses a read-only repository, accepts only canonical item IDs/quantities/contact/collection inputs, rejects paid options/client pricing, validates shop eligibility, then returns integer ZAR minor-unit totals and the tested canonical price fingerprint. No new columns, RPCs, orders, payment records or notifications are required for quotes.
- New order creation, legacy mutation aliases, generic order mutations, payment and collection commands fail with HTTP 503 `PICKUP_WRITES_DISABLED`, before any handler/persistence. This remains disabled even if SQL is later installed; activation needs separate reviewed code and approval.
- Explicit pickup records cannot enter legacy merchant/customer transition handlers. Historical reads, baseline legacy delivery transitions and Rider endpoints remain; their source files are not rewritten. This is not a claim that every old external/Firestore writer is closed.
- Canonical Customer origin `https://www.localeatssa.co.za` is allowed exactly. Existing configured exact Merchant/Rider/Admin origins remain. Disallowed origins receive JSON HTTP 403 `CORS_ORIGIN_DENIED`, not a misleading generic 500. Private reads/quotes still require Firebase tokens.

## Preview verification

Root Dashboard `vercel.json` excludes this branch; only `localeats-api/vercel.json` enables it. No Production deployment is authorized by this preparation.

`npm test` runs TypeScript plus 48 passing tests, including the real mounted router with test-process-only Firebase/database substitutions, authoritative quote/fingerprint equality, zero write access, authentication rejection, CORS, eligibility failures, and existing historical/Rider contracts. Mock substitutions exist only in `*.test.ts`; no production auth bypass, fixture identity or test credential is registered.

Preview checks must record deployment SHA and health/catalog/menu/CORS/auth rejection responses. An empty order/payment/collect probe is safe only after verifying the unconditional pre-handler gate in the exact deployed source. Never submit an authenticated live order to prove rejection. A successful authenticated live quote is not claimed without a legitimate test session; the mounted successful quote is verified offline without database writes.

## Prepared Customer Production variable — not applied

Project: `project-x7cvt` / `prj_2xXGbeUlulTFlmprFgGnymfLS5u1`.
Key: `VITE_LOCALEATS_API_URL`.
Target: **Production only**, no Git branch override.
Value: **`https://localeats-api.vercel.app`** — HTTPS origin only, no path/trailing slash, never a pinned Preview URL or service-role credential.

This is the existing API Production project alias. Its read/quote compatibility must be verified after separately approved API cutover and before rebuilding Customer Production. Existing Customer/API Firebase project remains `localeats-5e26e`; do not copy credentials into public variables. Actual credential values are not recorded here.

## Exact remaining Production actions (separate approval required)

1. Review this compatibility commit and Preview evidence, including the deliberate shutdown of **all new API order creation**. Coordinate with the owner; retain assigned Rider delivery continuation/history.
2. Merge only this API compatibility branch into API main and deploy only the API project. The main push may also rebuild the Dashboard project because it shares the repository; if a Dashboard rebuild is not explicitly approved, use a project-targeted deployment of the reviewed revision instead of an uncontrolled shared-main push. Do not change Dashboard source or promote a Preview with the wrong environment.
3. Verify the API Production SHA, `GET /health`, public catalog/menu and pickup discovery; exact-www Customer preflight must be 204 with matching origin; lookalikes must be 403. Verify quote 401 without a token, then a legitimate authenticated **read-only quote** if a test session is available. Do not test valid creation/payment mutations. Pickup SQL remains unapplied.
4. Add the Customer Production variable specified above, preserving all existing Firebase/Preview settings. Rebuild only after the API compatibility checks pass.
5. Separately approve merging/deploying the Customer candidate, with its original UI and hard submission block retained. Verify welcome/login/session restoration, true location eligibility, menu/cart, server quote/consent, and explicit disabled submission. Never infer real ordering readiness from a healthy API.
6. Do not apply pickup SQL, deploy Firebase rules/functions, clean data, activate order creation or purchase a service as part of this cutover. Existing legacy-writer closure and recovery gates remain prerequisites for later ordering activation.

## Rollback without enabling unsafe creation

- Before cutover record current API/Customer Production deployment IDs, SHAs and the old presence/value of the Customer Production URL privately. Do not log tokens or secrets.
- If compatibility checks fail, stop before the Customer merge. Keep Customer Production on its existing approved UI; keep API creation/payment/collection gated.
- If Customer deployment fails later, restore its prior approved deployment or the reviewed blocked-ordering Customer build. Preserve cart/history data and keep API writes gated.
- Do **not** blindly roll API back to old main: its new-order creation path was enabled. Redeploy the reviewed compatibility revision, or a reviewed repair retaining the same hard write gate, with Production environment/aliases. No schema rollback, row deletion, payment inference or Rider-history rewrite is needed.
- Disabling Git deployment triggers does not unpublish existing URLs. Preview rollback/alias reassignment, if needed, must target only the affected Preview project.
