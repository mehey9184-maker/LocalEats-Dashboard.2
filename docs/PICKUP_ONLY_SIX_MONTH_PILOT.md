# LocalEats — Pickup-only pilot and six-month delivery/Rider freeze

**Business decision confirmed 2026-11-05.** Pickup is the ONLY service in the first real-customer launch. This is an operating policy, not an estimate of when delivery will become available.

## What we launch first

Customer nearby shop discovery (existing 4 km maximum), actual menu/cart, server-confirmed quote, **collection-only** order creation, payment **at the shop** (cash or its physical card machine), Merchant Orders inbox, merchant accept → prepare → ready, customer collection and verified payment/handover. Merchant can handle customer notes, cancellation/rejection, missed push notifications and reconnection. No online payment charges are required for Phase 1.

Do not add Delivery checkout options, Rider App features, driver pools, rider matching or dispatch, GPS tracking, rider earnings, delivery PIN, delivery pricing, or rider subscriptions during the pickup pilot.

## Earliest possible Phase 2 review: six-plus months of actual customer use

1. **Start clock** only after the **first genuine external customer's paid-and-collected pickup order** has been verified in Production. Owner-created/test orders and Preview/staging simulations do not count. Record the date (timezone Africa/Johannesburg) and order ID reference in a restricted internal operations register, not in Git.
2. Accumulate at least **six elapsed calendar months** with **six months demonstrating genuine pickup activity**. An unused service sitting online does not satisfy the requirement. Maintain monthly counts of real unique customers, completed paid pickups, genuine shop activity, order failures/support requests and actual operating expenses.
3. Even after that minimum, Phase 2 is **not automatic**. The owner must review actual retention, merchant satisfaction, costs, safety, support load, backups, privacy and stability, and explicitly approve a separate Rider/Delivery design phase.
4. No existing rider service, dispatch code or data privileges should be activated during these six months. Security lockdown on already exposed dormant rider-notification database functions remains a separate risk-control task, **not rider product development**.
5. Until then, keep Rider App repos and all delivery UI/features out of the active development queue. Fix production security vulnerabilities that affect data exposure, but do not build or promote delivery capabilities.

**No earliest calendar release date can be stated now:** real pickup usage has not begun. Even if a first real collected order happens on a particular date, eligibility needs six-plus months of actual trading *and* separate owner approval.

## Client readiness gates and evidence

- The Customer pickup-only Preview is draft Client PR #40; original ShopCard and design must be accepted manually.
- Merchant reliability and no-stale-auto-accept Preview is draft Merchant PRs #60 and #61.
- This branch adds **automated PostgreSQL 17-backed HTTP integration testing** using the real Merchant and Customer pickup API adapters and the real API route implementation. The Customer adapter is pinned to Customer main commit 8ba6129173eb628d629f9696d3eb84c0e24e9bfe, including the reviewed startup, quote recovery, catalog and cart changes through PR #53. Fictional orders and credentials stay inside an isolated GitHub CI PostgreSQL service.
- Test currently requires pickup writes *inside* the disposable fixture only; Production and both frontend flags stay disabled.
- Real API/database staging remains incomplete until a **separate** disposable connected staging environment is provisioned and its contract checked; this GitHub CI container is not the Production Supabase cluster and does not test real FCM delivery.
- Before real clients: independently verified encrypted production backup and restore; resolution of exposed privileged rider-notification permissions and account-role authorization; commercial-permitted hosting; real device UX and operational sign-off; merchant order receipts and pickups with no duplicates; security/privacy/POPIA; customer support and a rollback plan.

## Isolated journey acceptance tests

CI should prove: approved/nearby shop discovery, real item menu, quote amounts, accepted cash at shop, lost HTTP response followed by idempotent replay, exactly one persisted order, no cross-customer or cross-merchant reads, merchant accept/preparing/ready, durable ready notification, payment by physical card terminal recorded only after confirmation, positive handover/collection, customer history after refresh, cancellation and merchant rejection, unavailable menu denial and simulated DB outage denial. A separate **concurrent PostgreSQL race gate** verifies two simultaneous identical creates persist exactly one order/event; competing merchant accept versus customer cancel has one winner; and closing a shop before a competing create prevents the order. These are disposable SQL transactions, not Production traffic. Every newly created pickup order must have `delivery_type=collection`, `delivery_fee=0`, `delivery_status=none`, and `rider_id=null`.

This is real **HTTP+PostgreSQL** execution against synthetic fixtures, not a live customer test, commercial readiness signoff or permission to activate pickup writes.

## Cost discipline

Pay neither riders nor developers for delivery work during the six-month pickup period. Avoid always-on workers and paid tools without measured operational need. Preserve essential pickup ordering, basic merchant management and pay-at-shop for every shop. Merchant subscription and payment activation require a separate agreement and launch approval; the initial three-month shop promotion should begin only once each approved shop actually starts trading.

**Current release state:** Review-only draft and isolated CI. No live SQL, real orders, Firebase sends, payments, hosting tier change, merges or rider activation.
