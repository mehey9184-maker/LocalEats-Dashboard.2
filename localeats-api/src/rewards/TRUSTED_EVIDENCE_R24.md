# R2.4 — LocalEats Rewards trusted evidence gate (NOT LIVE)

**Status:** a library-only, fail-closed contract and unit tests. No API routes import it. There is no Supabase Rewards reader, no migration, no production rewards, no balances or customer UI. Do not treat a successful TypeScript build as proof of live API security.

## Existing code inspected

- Current Customer/Merchant pickup endpoints in src/routes/orders.ts read server-side Supabase orders and pickup_order_events, and pass Firebase Admin verified auth to the pickup service. Real-order writes remain guarded by PICKUP_WRITES_ENABLED and controlled test identity.
- The StoredOrder type has items, status, payment_status, delivery_type and create_intent_hash but does **not** establish a persisted, immutable Rewards-eligibility-at-purchase snapshot. Never infer eligibility from a changing menu or by matching the word “kota”.
- authenticateAdminFirebase checks token revocation and authorizeSuperAdmin verifies active admin_users role=super_admin. Merchant authenticateFirebase currently verifies without the token-revocation check; future financial action authentication must meet the stricter requirement.
- The API must read true persisted payment and collection events and order status atomically before approving any reward.

## R2.4 read-only contracts

1. verifyCollectedKotaEvidence: requires a persisted pickup-only order, paid+collected status, create intent hash, ordered payment and handover commands with revisions, participating approved shop at purchase, registered non-test customer, immutable programme-version item eligibility proof, and an explicitly verified empty refund history. Only returns a candidate; no credits are issued.
2. verifyMerchantReceiptAuthority: requires Firebase ID token revocation-checked by middleware, the owner ID from the trusted shop record, a matching sent payable, and matching bank transfer evidence. No customer-controlled payout amount.
3. verifyAdminTransferAuthority: requires revocation-checked Firebase identity and active super_admin lookup, an owed payable at an integer-cent amount, and explicitly no existing transfer. Does NOT transfer money.
4. verifyManualRefundReview: because payments occur at the shop, requires a previously credited line and distinct merchant + active Super Admin reviewers, immutable refund reference/amount/quantity, and matching ownership. Does not refund cash, release a hold or delete merchant debts.

All functions reject missing or inconsistent evidence and simulated purchases. No client chooses paid, collected, eligibleKota, admin role, owner ID, amount or rank. The actor type may ONLY be constructed from a real middleware invocation of Firebase Admin verifyIdToken(token,true). **A matching TypeScript object is not authentication**; none of the functions is wired to HTTP yet.

## Mandatory next gates

- A consistent SQL snapshot across order, pickup payment/collection commands, programme opt-in, immutable item-eligibility-at-purchase and refund history. Current Production tables do not establish these Rewards facts; the Reader intentionally has no implementation.
- Correct owner-approved programme versions, no retroactive eligibility from merchant menu edits, and no award from historical test/anonymous users.
- Persisted PostgreSQL unique credit and entitlement IDs, serialized budget reservations, atomic merchant payables, refund-hold/appeal workflow, and durable audit.
- Merchant revocation-checked auth at financial confirmation, proper shop-owner proof and Super Admin active lookup. Never trust user_metadata or arbitrary browser JSON.
- Independent payment evidence and handling of bank returns, partial transfers, multiple merchant debts, account transfers and disputed receipts.
- Disposable PG17 concurrency and failure tests and a separately authorised Production launch. No live reward promise before funding approval.

## Verification scope

Run the existing Merchant/API CI, which now includes trustedEvidence.test.ts using in-memory fake readers. These tests prove fail-closed input and authority checks, not that live Supabase supports rewards. No Rewards endpoint, SQL migration or real customer effect is in this PR. Core pickup security and the Codex launch path are separate.

Related: Merchant/API Rewards PRs #97, #98, #99 and Super Admin design PR #3.
