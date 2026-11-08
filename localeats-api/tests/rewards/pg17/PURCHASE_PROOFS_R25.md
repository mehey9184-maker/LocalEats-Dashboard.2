# LocalEats Rewards R2.5 — Verified Purchase-Time Eligibility Rehearsal

**Scope: TEST-ONLY / NOT A MIGRATION / NOT A LIVE REWARDS FEATURE.** The synthetic PostgreSQL 17 schema and scripts must never run on Supabase, staging or Production. These files have no connected databases, no API endpoints, no feature flags, no customer credit writes, no merchant reimbursements and no real order creation. All synthetic PostgreSQL objects live inside a Docker container with no exposed port; the CI runner deletes it after the tests.

## Core problem

The current LocalEats pickup API does not establish an immutable Rewards catalogue/eligibility snapshot when an order is created. A merchant can later change or disable a menu item. Counting a historic purchase by looking at today's menu, or trusting a browser-provided eligible_kota flag, could incorrectly grant or deny a free kota and put LocalEats in debt.

## Rehearsal design

- purchase_customers and shop_programmes represent synthetic, server-verified registered customer identities and owner-approved shop participation/versions.
- menu_eligibility_current is editable *only as the synthetic current menu*; each row has a price in integer ZAR cents, qualifies_kota boolean, and revision.
- capture_purchase_at_checkout accepts **only item IDs and quantities** plus trusted service order/customer/shop IDs. It locks the programme, fetches each actual catalogue row under FOR SHARE, and writes an immutable per-line snapshot of original price, quantity, eligibility, menu revision and shop programme version. It records whether the shop was enrolled and the account was registered and non-test at checkout. It cannot trust client price, fake discounts, names or claims.
- Replay with identical order intent is idempotent; a different customer, shop or item quantity on the same order ID fails. Invalid items roll back all the snapshot writes.
- pickup_source_events represent persisted, revisioned payment-confirmed and collected commands. No qualifying credit occurs until both events exist in the proper sequence, and a purchase was eligible at checkout. Identical reward credit retries use R2.2's atomic PostgreSQL credit-and-budget gate, not new unsafe client points.
- source_refund_notices records immutable server-only verified refund sources at the original line level. A refund **before** credit blocks a new reward. A refund **after** credit atomically creates the R2.3 recovery hold so previously-earned rank, entitlements and merchant obligations are not silently deleted. Refund totals cannot exceed the originally purchased quantity and replay must preserve the original evidence.
- Source checkout snapshots, payment/collection events and refund events reject updates/deletes, even when the current merchant menu changes. The synthetic untrusted role has no schema/table/function privileges.
- Contradictory or injected raw order_line_facts are explicitly rejected by the verified credit path.

## Test cases

The runner executes all earlier R2.2/R2.3 financial regression tests and then R2.5 deterministic and two-process PostgreSQL tests: duplicate checkout, duplicate credit, duplicate refund, mutable menu revision vs historical item eligibility/price, retroactive enrolment attempts, guest/test account exclusion, orders without paid/collected proof, pre-credit refund, post-credit hold, over-refund, snapshot tampering, forged raw facts, transaction rollback, concurrent checkout vs merchant menu edit, and refund vs credit race. All inputs are synthetic and results are checked in the isolated local DB.

PostgreSQL 17 row-locking design references: https://www.postgresql.org/docs/17/explicit-locking.html and https://www.postgresql.org/docs/17/applevel-consistency.html.

## Boundaries that remain before a real launch

1. **Real API evidence is missing.** No Supabase Rewards adapter exists. The current pickup order path has no purchase-time Rewards snapshot implementation; it is *not* permitted to credit old orders retroactively.
2. Identity/role values are synthetic fixtures, NOT Firebase Admin verification. Production must independently authenticate the registered customer, shop owner and Super Admin using trusted server-side middleware and an audited data-access contract.
3. The real order creation must atomically persist its original item-price and eligibility snapshot with the actual order; checkout and all payment/collection events must use the same authoritative PostgreSQL transaction rules. The source proof cannot be constructed by user/merchant fields or an unauthorised RPC.
4. Immutable source refund proof in this test is not a real cash or card-machine refund reconciliation. A separate owner-approved, independently verified refund workflow is required before money/reward liability moves.
5. Preserve the R2.3 rule that a merchant's food-handover payable cannot be cancelled merely because a customer later obtained a refund. Do not promise/activate Rewards before funding, full terms, and programme activation approval.
6. Existing R2.2 credit_paid_order can still be called by the privileged synthetic test owner; before an actual deployment, only the authenticated verified-credit interface with restricted SQL privileges may be used, and direct writes/facts must be inaccessible to all client/merchant roles.
7. A paused programme, exhausted budget, late collection, shop ownership transfer and real-world refunds require further end-to-end policy/operational review before activation.

**Working proposal only:** Bronze one free kota after first four genuine qualifying collected kotas (standard kota up to R25; other food strictly below R25), Silver 20 more eligible kotas -> proposed package R100–R130, Gold 40 more -> proposed R200 reward, Platinum community ambassador interest (no guaranteed job). No programme is live or promised.

Related: PR #97 offline accounting, #98 atomic ledger, #99 recovery, #100 read-only trusted API proof. Core pickup public-launch blockers remain Codex's parallel priority.
