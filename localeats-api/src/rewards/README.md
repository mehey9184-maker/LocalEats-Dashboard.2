# LocalEats Rewards R2.1 — Offline-only domain rehearsal

> **IMPORTANT BUSINESS-DESIGN UPDATE (2026-11-08):** See the canonical project document at repository root: **LOCAL_EATS_MASTER_PLAN.md**, especially decisions RW-05, RW-08 and RW-09. The founder has **superseded the single R125/R200 food-bundle-only format** for higher tiers with a planned **spendable food-credit balance across multiple participating-shop purchases**. The new founder-confirmed **business proposal** uses R80 Gold credit and R150 Platinum credit, with an overall R500 Rewards pilot spending ceiling. The earlier R125/R200 bundle amounts are SUPERSEDED as an intention but remain coded in this EXISTING **offline-only prototype**. The founder also explicitly approved optional SPLIT PAYMENT: apply available reward credit and pay the remainder in cash or at the shop's physical card terminal; there is no in-app top-up or payment gateway. The **Silver→Gold purchase threshold is now FOUNDER-CONFIRMED as +20 genuine qualifying paid-and-collected purchased kota units AFTER the initial four Bronze units** (=24 cumulative); an earlier +10 recommendation is superseded. **Gold→Platinum threshold still OPEN.** The 12-customer R500 Bronze-only pilot capacity is an accepted PLAN, while actually ring-fenced cash, future Gold funding, credit-ledger mechanics, legal terms and participating shops are still OPEN. R2.1's existing +20 synthetic counter aligns numerically with the new Gold count but its old single-bundle reward format and historical R125 amount still do NOT match the new business rule. A passing synthetic test does not mean any Rewards are active. DO NOT adapt the legacy model into Production or advertise active rewards until those design and safety gates pass.

> **PLATINUM BUSINESS COMPARISON (2026-11-08; NOT IMPLEMENTED / NOT OWNER-APPROVED):** Gold's +20 additional legitimately paid-and-collected purchased kota units after Silver is CONFIRMED (24 cumulative). Platinum's NEXT threshold remains OPEN between **+30 ADDITIONAL purchased qualifying kota units after Gold** (54 cumulative; provisional assistant preference) and **+40** (64 cumulative; historical synthetic prototype value). The old R2.1 +40-unit bundle counter is NOT proof the founder selected +40; tests only verify that historical prototype. The R150 planned Platinum food credit requires a separately funded, published and approved active campaign, as with Gold R80. R500 Bronze-only 12-customer pilot promises only one up-to-R25 first free kota, not higher tiers. See canonical root LOCAL_EATS_MASTER_PLAN.md and docs/REWARDS_PLATINUM_MISSION_THRESHOLD_COMPARISON_20261108.md. No active credit, code change, payout, SQL migration or customer reward activation.

> **LATEST FOUNDER CORRECTION (2026-11-08; BUSINESS RULE ONLY):** **FOUR qualifying, genuinely PAID-AND-COLLECTED purchased kota units unlock the one-time Bronze free-kota entitlement, EVEN WHEN ALL FOUR WERE BOUGHT IN ONE ORDER ON ONE DAY.** The previously accepted requirement for two distinct pickup dates is **SUPERSEDED and MUST NOT be implemented**. The user's customer-trust reason is avoiding surprise forced return visits; retention is separately measured with real customer-funded repeat purchases after the gift, and future missions introduced progressively. Program admission, shop eligibility, once-only grants, budget reservation, refund/replay prevention and the one-off R25 cap still apply. Gold R80 / Platinum R150 future food-credit concepts require funding, confirmed milestones and published terms; no such cash benefit is promised in the 12-person R500 **Bronze-only design**. This README below documents the EXISTING OFFLINE PROTOTYPE, not a live backend or a legal offer.

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

The prototype's old R125/R200 bundle figures and +20/+40 stage thresholds describe **historical synthetic code** and must not be mistaken for current owner-approved R80/R150 planned credits or agreed higher-rank eligibility. No live redemption, source-of-truth balance, merchant reimbursement or prize announcement is enabled.
