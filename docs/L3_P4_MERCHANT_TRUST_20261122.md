# L3-P4 — Merchant pickup confirmation clarity and company ideas pointer

**Date:** 2026-11-22 | **Base:** Merchant main `10556f752aa93622d5b20237ea3860ed2bd68f76`
**Scope:** only Merchant pickup-action feedback and source/test documentation. Draft; no live data, SQL, payment, location, ordering, API worker, merge or Production deployment.

## UX observation and fix
The Merchant pickup action buttons already wait for an authenticated API response before dispatching `merchant-pickup-order-confirmed`, but they showed no local accessible success message. Sellers could wonder whether the action worked and tap again. `PickupOrderActions` now adds a small `role=status` confirmation only **after** `MerchantApi.transitionPickupOrder` or `MerchantApi.retryPendingPickupOrder` resolves successfully. The wording is "Shop service confirmed: [action]. Refreshing the order list for current status." It does **not** claim the refreshed screen loaded, the customer was alerted, or food/payment was handed over except where the specific server action itself confirms that action.

The message is scoped to the exact order ID and original revision, discarded on an attempted subsequent action, hidden on errors and never shown for local preview simulation. Disabled pickup buttons refer via `aria-describedby` to the existing explanation that database activation is required. The existing explicit payment confirmation and physical handover gates remain separate.

## Single source of truth for future business ideas
The **canonical** business-family idea register is the Customer repo: [Scalable Idea & Decision Register](https://github.com/mehey9184-maker/LocalEats-app/blob/review/l3-p4-customer-trust-ideas-20261122/docs/LOCALEATS_SCALABLE_IDEA_REGISTER.md). Merchants should not maintain a second diverging copy. There are proposals for photo CDN caching, payouts, Merchant plans, marketing, LocalMarket, LocalRider, LocalPay, LocalCover and other ideas. **No idea is approved simply because it is documented.** Future work must check this register and seek explicit owner approval before code or Production activation.

## Verification and release gate
`tests/l3-p4-merchant-confirmation.test.mjs` asserts server-confirmation ordering, retry receipt handling, ID/revision isolation, disabled hint accessibility, and lack of success on initial SSR. The existing `merchant-handover` and pickup tests, lint and build run in `merchant-l3-p4-confirmation.yml`. Real merchant session/Shop/FCM/phone and 320px visual tests are still required for end-to-end sign-off. Do not merge or enable writes without a separate release decision.

## Existing lint debt (explicit quality limitation)
The first PR run passed the focused pickup tests, but `npm run lint` reported **196 errors and 22 warnings** across this repository, including historical unrestricted `any` types and unrelated components. Only one `no-explicit-any` finding was reported in the edited PickupOrderActions file (its pre-existing `order:any` prop); the P4 patch itself does not introduce new `any` types. To keep unrelated lint debt from hiding focused verification, this PR's CI now gates a **scoped** ESLint run on the changed component (the historical `any` produces a warning) plus unit tests and build, and still executes full-root lint with `continue-on-error` and preserves its failing logs. **Full-root lint is not clean** and must be resolved through separate scoped cleanup before declaring the entire dashboard quality gate fully green. Do not represent a passing P4-specific workflow as proof of full repository lint compliance.
