# LocalEats pickup push — bounded HTTP best-effort attempt
Date: 2026-11-07 | Scope: Customer notification inbox and merchant Ready actions | Status: isolated draft, not deployed.

## Verified source risk before patch

`GET /api/v1/notifications`, `PUT /api/v1/push-subscriptions/:installationId`, and the pickup merchant `ready` route all await `drainPickupPush` before replying. The function awaits `pickup_claim_push`, `pickup_push_sendable`, Firebase Admin `send()`, and `pickup_finish_push` **without a request deadline**. A stalled provider/RPC can indefinitely delay an inbox read or a previously committed Ready response. Client timeouts can then leave confusing unknown outcomes.

## Proposed code-only fix

- `drainPickupPush` gets a total **4-second** maximum request wait; the caller cannot raise it above that cap. A small reserved portion is left for the fenced completion RPC.
- Successful FCM and immediate permanent/transient errors still call the existing `pickup_finish_push` with original `p_uid`, job ID, attempt number and lease timestamp. The outbox remains authoritative.
- A stalled claim, token recheck, FCM send or finish stops blocking the HTTP request at its deadline. No success/failure receipt is fabricated; a lease remains until the SQL retry policy reclaims it. Ready was committed before this best-effort send.
- `Promise.race` **does not cancel** the underlying Firebase SDK call. A late FCM success after deadline and a later outbox retry can cause **duplicate push notifications**; push therefore remains at-least-once best effort. This must never duplicate an order or be shown as payment/handover confirmation.
- No detached retry worker, new cron, new credentials, service account, database migration or new background billable traffic is added.

## Synthetic tests and release gates

Unit regression `localeats-api/src/orders/pickupPushDeadline.test.ts` covers: a permanently hanging claim RPC, hanging token recheck, hanging FCM sender with late success, stalled completion, correct fenced successful receipt, transient/permanent FCM error, unsendable revoked subscription, and invalid payload. It runs as part of `localeats-api` `npm test` on this branch.

**Do not claim push delivery solved by this alone.** There is no independent scheduled consumer. When both customer and merchant are offline, pending pushes can remain queued until an eligible authenticated request triggers the drain. The SQL outbox allows at most five leased attempts, 30-second lease and exponential delay, but a stuck provider can still deliver after deadline; use event IDs to dedupe display notifications where practical.

Before Production activation:
1. Verify API staging code against the exact authorized isolated Firebase/Firestore and Supabase staging services, including an intentionally hanging mock FCM transport. Do not send test messages to real customers.
2. Measure pickup Ready HTTP p95/p99 and customer notification GET latency; confirm no order-receipt regressions, no leaks across account/shop and consistent outbox retry state.
3. Verify app/browser detects new Ready order through authenticated inbox even if push never arrives and after a 30-minute merchant device outage.
4. Design a separately approved durable outbox worker/retry schedule appropriate to the hosting plan for when no user is online. Do not substitute detached promises on Vercel Functions for durable background work.
5. Keep `PICKUP_WRITES_ENABLED=false` and all Customer/Merchant ordering flags OFF. Do not activate delivery, riders, subscriptions or payments.
6. Review with Codex's unfinished local push work to avoid duplicating or overwriting its eventual implementation. This branch is an independent replacement candidate only.

**Deployment:** draft PR only; no Production or staging deployment, database write, real FCM token or merge.

Linked context: `docs/LOCAL_EATS_SIX_MONTH_CAPACITY_PLAN.md`; [Launch gate #73](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/issues/73).
