# LocalPay R4.4 — Actual pickup contract, inert read-only Rewards evidence bridge

**8 November 2026 | Founder approved isolated READ-ONLY CONTRACT TESTING, not a real data connection, SQL migration, payout, checkout activation, customer credits, brand launch, merge, or Production change.**

## What R4.4 does

R4.4 imports the **current compiled Merchant/API source** rather than duplicating assumptions:
- `localeats-api/src/orders/pickupService.ts` → actual `pickupQuote` (immutable *quoted* line format) and `merchantCommandReceipt` (order id, actor uid, command id, kind and revision).
- `localeats-api/src/rewards/financeActor.ts` → `verifyFinancialActor`, which requires a server-provided `verifyIdToken(token, true)` function. R4.4 deliberately supplies only an **injected FAKE verifier** for tests, not Firebase Admin or real customer authentication.
- `localeats-api/src/rewards/trustedEvidence.ts` → `verifyCollectedKotaEvidence`, which can return a **candidate**, not a reward, when all persisted evidence exists and is internally consistent.

The **test-only** `tests/rewards/r44/contractReadOnlyAdapter.mjs` provides an `inspect(serverAuthorizationHeader, orderId)` method. It demands a *single* injected `readOnlySnapshot` transaction and a complete mock **private** evidence bundle. This includes real pickup order fields, shop-owner approval, merchant's two signed-looking command receipts, independent mock customer pickup-code confirmation, explicit persisted and purchase-time Rewards-eligibility proof for each menu item, a server-verified customer profile and explicit complete refund history. It **never** calls a write method or produces redeemable LocalPay credit; success always returns `canGrant:false`, `canReserve:false`, `canReimburse:false` and `canActivate:false`.

**15 Node contract tests** check the real module shape, proper mock token revocation-check invocation, a valid hypothetical full evidence bundle, repeated read-only inspection, wrong-shop owner/anonymous/revoked sessions, missing financial order fields, incomplete public order projections, missing command identifiers, payment vs collection revisions/owners, missing/forged independent customer code, unauthoritative menu/refund evidence, stale programme participation and fail-closed reader errors.

Run `cd localeats-api && npm run test:r44` (builds TypeScript from source first). Tests are also appended to the existing `npm test`. Dedicated PR-only GitHub Actions workflow: `.github/workflows/localpay-r44-pickup-contract-readonly.yml` (no PostgreSQL/Supabase container or real token). It installs locked dependencies and runs the contract checks in a fresh Node process with all activation flags OFF. The tests do NOT call an actual live database or a read-only Production URL.

## Critical findings from real API source: DO NOT GRANT REAL REWARDS

1. **Customer public order history loses financial proof.** `src/routes/orders.ts` intentionally strips `create_intent_hash` from customer-facing orders. Its `GET /api/v1/orders/:id` event projection is `id,kind,revision,occurred_at,details`; it does NOT include private `command_id`, `actor_uid` and associated verified shop-owner authority. R4.4 rejects this public projection as insufficient to issue rewards.
2. **Pickup order creation is not a Rewards programme enrolment.** `StoredOrder` has `items`, `status`, `payment_status`, `delivery_type`, `create_intent_hash` and revision, but no verified permanent Rewards item-eligibility-at-checkout snapshot, enrolled programme version or recorded owner-funded customer admission. The R4.4 happy-path fixture adds **fake** immutable Rewards snapshots; these cannot be inferred from the current mutable menu, SKU name or ordinary quoted price. Production schema audit R2.7 already identified this blocker.
3. **The current pickup 'collect' command requires `handover_confirmed:true` as merchant input.** This is useful for the existing pickup workflow, but NOT independently verified customer handover or a cryptographically checked one-time customer pickup PIN. R4.4 requires separate *mock* consumed customer-code proof and refuses to substitute the merchant boolean or local toast.
4. **Real-world pay-at-shop and refund evidence is not established.** A persisted `payment_confirmed` event / `payment_status:'paid'` is a merchant assertion that the physical cash or card-terminal remainder was received. R4.4 demands both correct event sequencing and shop ownership as a minimum, but cannot independently certify money at the till. Likewise no complete, independently verified Rewards refund ledger is available from current pickup GET responses. An UNKNOWN refund history is NOT an empty history.
5. **Actual merchant authentication and shop ownership require server checks.** `financeActor.ts` expects an actual server-side token revocation check, but R4.4 only passes a test stub, so it's not proof of real Firebase identity. A verified token alone doesn't establish approved shop ownership; the test transaction must check current owner `shops.owner_id` and shop approval, then the recorded merchant event actors.
6. **Real data must come from ONE consistent trusted database read.** Public browser order JSON, cache, localStorage, separate changeable menu reads, or HTTP request role/status flags may not be assembled into an apparently valid financial event.

## Tested mock fixture and limits

Example hypothetical immutable pickup order: order ID is valid UUID; `shop_id=shop-my-kota-ivory-park`, `user_id=customer-1`, `delivery_type=collection`, `status=collected`, `payment_status=paid`, revision 3; matching accepted/payment_confirmed/collected command UUIDs with verified merchant event actor, one kota purchase line `{menu_item_id:'kota',quantity:4,unit_price:25,line_total:100}`, one non-kota line, reward start predating purchase, independent mock pickup confirmation and explicit no-refund evidence. A true result returns only `eligibleUnits:4` with `canGrant:false`. Real R4.2 unique-grant and budget rules have **not** been connected to this read-only test. No irreversible financial action is possible.

Passing tests demonstrate the test model's fail-closed contract assumptions, **not the existence of the missing persisted evidence in LocalEats' real schema**. An injected fixture source label `synthetic-server-readonly-snapshot` and fake `verifyIdToken` are not a security mechanism outside tests.

## Follow-up gates (need fresh founder approval)

- Design and approve how immutable programme snapshots, shop opt-in, purchase eligibility, non-test/non-simulated classification and full refund history can be recorded in authoritative **future** server-side transactions (no retroactive grants).
- Real Firebase Admin `verifyIdToken(token,true)` and shop ownership/revocation at financial-action time; an audited and brute-force-resistant independent pickup-code protocol, plus proof the merchant received physical cash/card terminal settlement.
- Review a financial-grade SQL read adapter with transactional snapshot, database role/permissions/RLS, evidence integrity + outbox, refund races and payment disputes, then test on truly isolated non-Production backend with no live users or shared database. Current `PICKUP_WRITES_ENABLED` stays false.
- Prove the Bronze R500 pilot funds actually exist and merchants consent; assess South African legal/consumer and trademark matters. Future Gold R80, Platinum R150, 36-month LocalPay credit lots remain inactive.
- Separate owner acceptance for any proposed R4.5, production SQL migration, actual API wiring, UI, payouts or real pilot.

**R4.4 is not approval to alter the current pickup payment/collection endpoint or expose a Rewards ledger.** Preserve the original Customer ShopCard and Merchant UI.
