# LocalEats Rewards R2.1 — Offline-only domain rehearsal

**This module does not make rewards live.** It has no HTTP routes, database schema, background jobs, Supabase writes, bank transfers or app UI. The default model is inactive. Only the Node test suite creates a synthetic active programme.

## Covered in the isolated model

- Bronze: after 4 qualifying **paid, collected** kota units, issue one reward capped at R25 and promote to Silver (0/20).
- Silver: after **20 more** units, issue a proposed food bundle capped at R125 and promote to Gold (0/40).
- Gold: after **40 more** units, issue a proposed food bundle capped at R200 and promote to Platinum.
- Platinum: recognition only; no promised job, automatic payment or further reward from this model.
- Same order-line id and input replay returns the same state. Conflicting replay is rejected. An order-line's quantity counts units, not orders.
- Unpaid, uncollected, refunded, simulated/test, non-kota and nonparticipating-shop source events fail closed.
- A milestone reserves the entire prospective maximum from the owner-funded programme budget *before* the credit is committed. If insufficient, the entire synthetic event is rejected and the prior state is unchanged.
- A reward grant does **not** create a merchant debt. The trusted, one-time handover creates a payable for the actual approved menu item price.
- Bronze accepts one eligible standard kota at up to R25, or one other eligible food item costing **strictly less than R25**. Silver and Gold use bundles within their respective provisional caps.
- Super Admin recording a manual payment marks a payable **sent**, not settled. Only the verified merchant's separate confirmation marks it **confirmed**; the merchant may instead dispute. Paid expenses remain counted against the campaign budget.
- Domain transitions return new maps rather than mutating the prior model. This permits deterministic replay tests; it is **not** cross-process transaction isolation.

## Essential integration preconditions before R2.2 / any Production Rewards

1. Reconcile against current actual pickup order status and payment confirmation on the central API. **Never** accept \`paid\`, \`collected\`, \`eligibleKota\`, \`shopId\`, \`merchantShopId\`, \`adminUid\` or \`priceMinor\` as authoritative from a browser.
2. Decide programme enrolment and budget admission *before* customers can earn any promise; prevent budget exhaustion from losing legitimately earned credits. Version immutable rank rules and participant consent.
3. Implement database-backed uniqueness constraints and **atomic, serialized** budget reservations, order-line credit, milestone grant, reward redemption/handover, payable, manual transfer, and merchant receipt. Test concurrent requests across independent processes, lost replies, and transaction rollback in disposable PostgreSQL 17.
4. Use item-eligibility snapshots, true quantity, price caps, merchant participation, correct shop owner and independent Super Admin authorization. Handover identifiers must be generated/validated server-side and one-time.
5. Design refund/reversal accounting, entitlement expiry after clear approved terms, disputed payment resolution, partial/batched transfers, stock unavailability and app support before activation. Do not erase immutable audit history.
6. Enforce budget caps and auditable \`reserved\` versus \`fulfilled/owed/sent/confirmed\` totals. No bank payment integration in R2.
7. Do not turn on customer rewards, merchant debt, live checkout, employment or promotional promises without separate owner approval and security acceptance. Existing test accounts and old orders never earn retroactively.

## Scope tracking
- Programme policy and business design: \`Super-LocalAdmin/docs/LOCALEATS_REWARDS_R1_OWNER_FUNDED_SPEC_20261107.md\` (merged PR #3).
- Honest pickup-only coming-soon marketing teaser: Merchant PR #95 (merged).
- Current isolated code: \`src/rewards/rewardsModel.ts\`; tests: \`src/rewards/rewardsModel.test.ts\`.
- No Production database migration, payout, financial claim or feature switch is deployed by this phase.

The Silver R125 cap and Gold 40-unit threshold remain *working proposals* pending the owner's final funding decision. Public promotional copy must not present them as active guarantees.
