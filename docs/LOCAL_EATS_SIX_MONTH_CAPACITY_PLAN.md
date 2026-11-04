# LocalEats — 180-day synthetic order reliability and cost-readiness plan
Date: 2026-11-04 | Scope: 20 shops, 5,000 synthetic customers, 150 orders/day, up to 10 orders/minute during a 15-minute daily rush.
Status: OFFLINE simulation and read-only infrastructure audit. NOT permission to activate live orders, create Production data, change schemas, or conduct hosted stress testing.

## 1. Interpret the two traffic rates
- 150/day × 180 days = **27,000 accepted order intents**; across 20 shops this is 7.5 orders/shop/day on average.
- 10/min × 15 minutes = **150 orders**, representing the entire day's demand in one deliberate worst-case rush.
- 10/min *continuously* × 60 × 24 × 180 = **2,592,000 orders**, a fundamentally different load and storage budget.
- 5,000 **registered** users does not imply 5,000 simultaneous authenticated or Realtime connections.

## 2. What the synthetic harness actually does
Source: localeats-api/tests/synthetic-180day-load.test.mjs.
- Calls the actual repository's TypeScript pickup-service logic, including parsePickupInput, pickupPricing, pickupQuote and createPickup after an isolated local TypeScript build.
- In memory only: 20 Tembisa-like synthetic approved shops, one synthetic R25 menu item/shop, 5,000 synthetic customer IDs, a transactional-**model** Supabase RPC adapter, a synthetic merchant inbox, and a synthetic FCM outbox.
- Generates 10 arrivals per virtual minute, 15 minutes/day, 180 days, with 45% of orders assigned to the top two shops.
- Injects 2% temporary failures **before** a synthetic commit, 8% lost API responses **after** a successful commit, 10% duplicate-click probability, 12% transient FCM send failure and 3.5% permanently undeliverable device notifications. Six maximum create attempts reuse the same original intent and key.
- Asserts one durable order per intent, no false payment confirmation, one merchant-inbox entry and one outbox entry per committed order, rejection of changed-intent/cross-customer replays, and correct failure of a permanent database outage.
- No requests to live Supabase, Vercel, Firebase or external APIs. This is **not** a test of real network latency, Supabase throughput, Vercel function runtime, Firestore performance, merchant device delivery, or real database transaction implementation.

### Synthetic result, deterministic seed 1042026
- 27,000 intended / **27,000 committed in model** / 27,000 synthetic merchant inbox entries / 5,000 unique synthetic customers / 20 synthetic shops.
- 2,655 synthetic repeat clicks; 4,762 replay responses; 536 pre-commit temporary failures; **2,107 simulated responses lost after database commit**, all ultimately recovered in this controlled model using the same idempotency key.
- 26,055 push jobs delivered in the model; **945 notifications undeliverable**, while the same 945 orders remain in the synthetic merchant inbox.
- For a *single* kitchen prep station completing one order per eight minutes, the two most-busy shops in the first simulated 15-minute rush get 35 and 29 requests, respectively, creating illustrative backlogs of **33 and 27** orders. These are assumed kitchen capacities, not observed human performance.
- **Critical interpretation:** The model demonstrates the desired invariants under the selected synthetic faults; it does **not** prove the live app will persist all orders or that its notification inbox will be visible quickly. Actual database load testing and two-account manual UI acceptance are separate gates.

## 3. Read-only 2026-11-04 infrastructure snapshot
- Connected Supabase project LocalEats: **ACTIVE_HEALTHY**; total DB footprint approximately **21 MB**; 9 shop rows, 7 menu-item rows, 1 order row, 5 pickup event rows, 0 pickup_push_outbox rows. Second staging project also active.
- Existing public.orders database indexes include a **unique idempotency_key** index and (shop_id, created_at DESC) lookup index.
- Database has pickup_create_order and pickup_order_command functions. API source calls pickup_create_order RPC with consent/fingerprint validated; use of PostgreSQL functions is a promising transactional design, but no live high-load measurements have been performed.
- Client uses VITE_PICKUP_ORDERING_ENABLED strict true-only gate; API source uses PICKUP_WRITES_ENABLED strict true-only gate. Do not enable as part of this test.
- Existing push service drains at most one leased item per relevant request; there is no continuous retry worker. Merchant inbox must not depend on receiving push.
- Supabase advisors currently flag 5 unindexed FKs, including pickup_push_outbox subscription_id, multiple permissive RLS policies, and 7 privileged SECURITY DEFINER functions callable by anon/authenticated roles. These need **individual permission and function-body review** before any write changes; not every linter warning proves an exploit. Preserve extension-owned spatial_ref_sys handling (do not blindly modify).
- Use the Supabase Dashboard's security/performance advisors to review details; do not run automatic production migrations as a response to the synthetic test.

## 4. Storage scenarios — estimates, not real row measurements
Assume an additional 4, 8, 16, or 24 KiB of PostgreSQL storage *per order* including order snapshots, events, notifications, indexes and overhead. For 27,000 orders:
| Assumed KiB/order | Six-month addition, decimal MB | Plus observed baseline ~21 MB |
| ---: | ---: | ---: |
| 4 | 111 | 132 |
| 8 | 221 | 242 |
| 16 | 442 | 463 |
| 24 | 664 | 685 |

Supabase Free includes **500 MB DB storage** per project. Profiles, shops, indexes, WAL effects, image references, deleted-row bloat and further features need headroom. At 16 KiB/order the nominal 500 MB limit is already dangerously close; at 24 KiB/order it is exceeded. **Do not select a plan using these estimates without measuring actual storage growth on isolated staging.** No Free-plan automated daily backups: arrange tested encrypted, offsite exports and periodic restore drills before customer reliance.

Official guidance: https://supabase.com/docs/guides/platform/billing-on-supabase | https://supabase.com/docs/guides/platform/backups

## 5. Free-service limits and compliance (reverify before launch)
- **Supabase Free:** 500 MB database/project, 50,000 monthly active users, 5 GB uncached + 5 GB cached egress allocation, 1 GB files, 2 million Realtime messages/month, 200 peak Realtime connections, 500,000 Edge Function invocations/month. A Free project may be paused for insufficient activity. Two active Free projects are already present in this account, per connected project list.
  https://supabase.com/docs/guides/platform/billing-on-supabase
  https://supabase.com/docs/guides/realtime/limits
  https://supabase.com/docs/guides/platform/free-project-pausing
- **Firebase:** FCM is currently no-cost. Firestore Standard has 1 GiB free stored, 50k reads/day, 20k writes/day, 20k deletes/day, 10 GiB network transfer/month. Only one free-eligible database per Firebase project; verify which database qualifies if a named database is used. Avoid double-writing authoritative orders to Firestore and Supabase.
  https://firebase.google.com/docs/firestore/pricing
  https://firebase.google.com/pricing
- **Vercel Hobby:** **non-commercial/personal only**, even where numerical quotas seem ample. Commercial LocalEats deployment needs a commercial-permitted hosting plan; do not solve this by creating multiple Hobby accounts. Provider rules classify unauthorized hosted load testing as outside fair use. Evaluate total hosting spend before launch, and never run capacity tests against live shared infrastructure without authorization.
  https://vercel.com/docs/plans/hobby
  https://vercel.com/docs/limits/fair-use-guidelines
- **Possible future hosting alternative:** Cloudflare Workers Free documents 100,000 requests/day and 10 ms CPU/request, but current Express/Firebase Admin code does not automatically run in a Worker. Compatibility, data protection, auth, rate limits and migration must be engineered and separately tested. Do not switch architecture only because of a theoretical quota.
  https://developers.cloudflare.com/workers/platform/pricing/

## 6. Reliability acceptance before first public orders
1. **Order is durable before success**: server computes price, verifies ownership/shop/stock/radius/payment method, commits order and immutable event in one transaction; return only after confirmed persistence. On an unknown response, preserve the exact original idempotency key and consent until status is reconciled.
2. **Merchant inbox independent of push**: query authoritative pending orders on dashboard open/reconnect/foreground and periodically while active. Add visible last-sync time and "connection uncertain" status. Treat FCM as a wake-up hint, not a receipt.
3. **Outbox recovery**: persist event+notification work atomically, retry transient delivery failures with backoff and dead-letter diagnostics. Because current code drains only on relevant requests, evaluate a reliable scheduled consumer/worker before launch; hosting cost/permissions must be explicit.
4. **No silent losses**: reconcile each accepted order's event chain, merchant visibility and notification state. Track pending/unconfirmed creates, duplicate-key conflicts, merchant acknowledgment delays and uncollected orders.
5. **Offline and stuck phones**: user should see "Pending confirmation" on an ambiguous timeout, not "Failed/no order" or "Success" prematurely; re-open the same order by ID after reconnect.
6. **Human operations**: limit simultaneous open orders per shop, allow manual pauses, realistic prep time and status; do not promise 10/minute capacity at a single kitchen if the shop can prepare one meal every eight minutes.
7. **Privacy/security**: never cache sensitive order PII without user/shop scope; server controls price, orders, status, rider assignment, payment facts; inspect advisor warnings with permission. No broad anonymous read/write policies.
8. **Customer complaints to anticipate**: merchant never saw an order; duplicate checkout; app says submitted but merchant disagrees; stale price or item unavailable; 4km location mismatch; merchant slow during rush; payment reported when not made; FCM permission denied; rider handover dispute; delayed refund/cancellation; app offline; privacy concerns. Provide clear status, support contact and audit trail before launch.

## 7. Next test ladder (separate approval required)
1. Continue existing isolated API route and SQL transaction/race unit/integration tests; run a disposable PostgreSQL database if available locally.
2. Run **staging-only** authenticated, rate-capped real HTTP/DB test at 1, 2, 5 and 10 orders/min with synthetic accounts. Set temporary storage/egress budget, enforce cleanup, provider permission and no Production target.
3. Measure p50/p95/p99 order acceptance latency, 4xx/5xx/error ratio, duplicate-commit count, unknown-outcome reconciliation time, merchant pending-order visibility lag, notification delivery rate and stale queue depth. Do not invent target measurements.
4. Simulate database outage, a lost success response, merchant offline for 30 minutes, 250+ concurrent Realtime sockets, two users racing a menu stock limit, price changes between quote/create, an API deploy mid-submit and 30-minute push outage.
5. Only after passing manual customer+merchant tests and independent security reviews, propose an explicit per-component launch gate; require owner approval before Production activation or paid plan changes.

**Deployment policy:** This document and the test change do not authorize Production writes, live order activation, migrations, FCM/Firestore changes, enabling pickup flags, or production load testing.
