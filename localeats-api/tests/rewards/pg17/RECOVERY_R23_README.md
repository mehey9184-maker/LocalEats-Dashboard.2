# Rewards R2.3 — Refund holds, cancellations and reimbursement recovery

**Synthetic-only financial laboratory.** There are no API endpoints, UI controls, Supabase migrations, real customers, reward activation, payouts or Production SQL changes. These files extend the disposable R2.2 PostgreSQL 17 test schema and run exclusively inside the GitHub Actions Docker job. The reward_lab schema in these tests must never be applied to a hosted database.

## Owner-funded business rules under test

1. **Refund before free-food handover:** a trusted, immutable refunded order-line unit event adds a hold. The earned rank and entitlement remain visible in this synthetic database; the R25/R125/R200 reserved liability remains allocated until separate manual review. Both new credits and unfulfilled reward handovers are blocked while on hold. **Do not silently claw back rank or claim the refund erases an already promised gift.**
2. **Refund after food was given:** place the customer on hold for review, but **do not cancel the merchant payable**, remove the merchant's confirmation, reduce the menu-price snapshot or make a new negative payable. The merchant still supplied food on behalf of LocalEats.
3. **Uncollected/aborted reward attempt:** record the reason and attempt ID, preserving the underlying earned entitlement and its budget reservation; no free food was handed over, so no new merchant payable is created. Repeat delivery of an identical cancellation is idempotent.
4. **Wrong bank-transfer reference:** record one immutable correction with a new reference and reason; the original transfer record, merchant, amount and sent status remain unchanged. Never generate a second bank transfer automatically. Further changes require an explicit investigation workflow (not built).
5. **Disputed merchant receipt:** Super Admin may document investigation; the payable stays disputed until the **correct authenticated merchant** acknowledges that the dispute is resolved and payment has been received. Super Admin's note cannot self-settle the debt. The original dispute and its resolution acknowledgement both remain as immutable entries.
6. **Even if programme is paused:** historic refund cases and financial recovery must still be recorded. The R2.3 recovery functions can record a synthetic refund while the programme is inactive.
7. **Budget invariants:** allocated owner spend must always equal the sum of outstanding earned entitlements at their reserved caps plus original-price payables for food actually supplied, including amounts owed, sent, disputed and confirmed. A customer refund does **not** release a promise, reverse a real food handover or replenish campaign funds by itself.

## Concurrency and security assertions

The runner includes separate PostgreSQL sessions to simulate: the exact same refund event replayed twice; two different partial refunds exceeding original qualifying item quantity; refund racing against reward handover (either serial outcome is safe); and two simultaneous merchant acknowledgements of a dispute. It checks unique immutable financial events, protected original transfer data, permission revocations and budget reconciliation.

The tests do **not** prove real identity authentication. The lab uses server-trusted synthetic inputs, not browser-supplied facts. A real API must independently verify and persist pickup order payment+collection, purchased kota quantity, refund provider ID/amount, genuine merchant ownership, bank-transfer reconciliation, and admin authorisation. It must persist and replay an append-only source of truth, not infer from Customer Profile counts. Also required before any live campaign: fair customer communication, an appeal/review path, release-of-hold policy, cancellation after collection, replacement/refunds for incorrect food, chargebacks, proof of bank receipt, partial/batched reimbursements, bank-return reconciliation, loss recovery and audit/legal approval.

This phase **deliberately does not decide automatically whether a refund should remove an unredeemed entitlement**: it stays reserved and held until approved business terms and a verified human case resolution. Releasing reserved funds without first resolving an outstanding customer promise could result in unfunded free food.

The Platinum programme is a community/ambassador application pathway, never an automatic job or payment. The Gold 40-item threshold and approximate R125/R200 packages are still proposals. Core pickup launch security work stays with Codex; R2.3 must not block it.
