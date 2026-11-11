# LocalEats: 90-day accelerated 25-by-25 pilot — result

**Executed:** 2026-11-11. **Evidence:** GitHub Actions workflow `L2 synthetic 90-day 25-merchant 25-customer pilot`, run 43033317995 on commit `edb90bb5fb179ba7bc450fb93ac01b7a5626cff4`. Result: **SUCCESS**.

## What was actually tested

A 90-day **virtual calendar** (2026-11-11 through 2027-02-08), not an elapsed 90-day real-world trial. Used compiled current LocalEats pickup pricing, consent, create, and command-service code. This is a **no-network, in-memory synthetic RPC/persistence model** with 25 fictional merchants, 25 fictional customers, one fictional R25 kota per shop and 900 total fictional order attempts. Merchant dashboard, Customer browser, live Firebase Auth/FCM, Supabase PostgreSQL, Vercel runtime and human payment/handover were **NOT exercised** by this load simulation. Separate pre-existing isolated real PostgreSQL/HTTP CI journey also passed.

No Firebase users created. No real merchant/customer accounts deleted. No live transaction, production database edit, money, push message or on-device usage. All model customers, merchants, shops, orders, inbox entries and events were cleared in memory and asserted empty before the test exited.

## Observed synthetic run result

| Metric | Result |
|---|---:|
| Virtual days | 90 |
| Fictional merchant accounts | 25 |
| Fictional customer accounts | 25 |
| Synthetic order intents and unique order IDs | 900 |
| Simulated successful paid-and-collected | 630 |
| Simulated customer cancellations | 90 |
| Simulated merchant rejections | 90 |
| Simulated Ready but unpaid/no-show | 90 |
| Merchant inbox entries retained | 900 |
| Duplicate clicks replayed idempotently | 100 |
| Synthetic pre-commit transient failures | 29 |
| Simulated success acknowledgments lost after commit | 52 |
| Create attempts recovered after transient/unknown outcome | 80 |
| Simulated push deliveries failing | 65 |
| Cross-account access/write attempts rejected | 990 |
| Invalid unpaid/no-handover collection attempts rejected | 720 |
| Fictional customer/merchant accounts remaining after cleanup | 0 |
| Fictional orders remaining after cleanup | 0 |
| Actual cash paid or collected | **R0** |
| Production writes or actual Auth accounts | **0** |

The model's nominal 630 x R25 = R15,750 is **fictional only**, not LocalEats sales, earnings, payments or receivables. No real financial report should include it.

## What the model demonstrated (and did not prove)

- The current pickup service correctly uses server-priced R25 consent and immutable idempotency keys within the adapter. Repeats/retries did not create extra model orders.
- The model forbade cross-merchant order commands/inbox access and cross-customer history/key replays; it also rejected collection before payment or affirmative handover.
- 65 undelivered modeled push messages did **not** remove orders from the durable modeled merchant inbox. This **does not** prove actual FCM delivery or inbox refresh latency.
- Synthetic cleanup completed. This is **not** deleting 50 real Firebase users.
- Tests do **not** emulate three months of internet outages, phone memory, UI interaction, staff errors, real kitchen capacity, wallet/rewards, billable hosting traffic, or notification permissions.

## Practical problems and recommended remedies before giving shops access

**Priority 0 — real launch blockers**

1. **Real authenticated account isolation:** confirm two separate Customer accounts cannot read another customer's history, even during account switch; confirm separate Merchant account cannot see or act on My-Kota orders. Login alone is not proof.
2. **Actual cash-and-kota pilot:** the 2026-11-01 My-Kota R25 Paid/Collected database order was an earlier test, not a genuine meal/payment. Perform one owner-supervised R25 order through the authentic Customer and Merchant frontends, actual cash/card-machine confirmation, physical handover, then Customer history refresh.
3. **Controlled feature flags:** Production API `PICKUP_WRITES_ENABLED=false`, Customer/Merchant `VITE_PICKUP_ORDERING_ENABLED=false`. The API's `PICKUP_TEST_CUSTOMER_UID` is not configured. Keep broad ordering disabled. Only use a securely verified single customer UID with existing fixed My-Kota shop allowlist for a separately reviewed one-order test.
4. **Missing push fallback / merchant availability:** when push is missing, the Merchant UI needs a reliable, tested inbox sync/recovery status so staff never rely on FCM alone.
5. **Legacy order chat path:** Customer code uses Firestore `messages`, while hardened rules authorize only order-scoped `chat_messages`. Do not weaken security rules to restore chat; implement authenticated order-participant API or label chat unavailable for the pickup-only pilot.
6. **Hosting and backup:** ensure business-eligible hosting, recent encrypted Production backup and verified restore, and owner-accessible audit/incident plan before placing real public orders.

**Priority 1 — likely customer and owner friction**

- Customer uncertainty after a network timeout: display Pending confirmation and retry the **same** request ID; never prompt an immediate new order.
- 90 modeled unpaid Ready/no-shows: give merchants clear payment-not-confirmed and uncollected indicators, aging queues, expiry/cancellation policies and support escalation.
- 90 modeled customer cancellations and 90 rejections: show clear reason, status, and notification in both apps.
- Real 4 km radius and GPS permission: test nearby/outside-area handling, do not silently hide the shop without an explanation.
- Multi-order rush: add visible current queue and shop-pause/availability controls, realistic prep estimates and escalation when overloaded.
- Profile/notification privacy and order review prompts need manual Android/iOS/browser tests.

## Approval boundary

This PR is **test-only**. It does not authorize a global Production pickup switch, new Firebase accounts, public shop onboarding, a change to commercial plans, rewards activation, a Production database migration or real money movement. To run a true 90-day pilot, the owner must enroll real authorized participants, observe activity for 90 calendar days, protect their data, and obtain proper account closure/retention decisions rather than automatically deleting users with real orders.

**Conclusion:** The accelerated 25x25 synthetic rehearsal **PASSED** and provides repeatable fault-injection evidence. Public LocalEats pickup ordering and handing over a real restaurant remain **NOT YET ACCEPTED** pending the genuine test and browser-based tenant isolation checks.
