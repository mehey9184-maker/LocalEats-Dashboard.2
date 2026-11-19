# L3-N5 — Disposable PostgreSQL Customer-to-Merchant Pickup Rehearsal

**Date:** 19 November 2026 (Africa/Johannesburg)
**Status:** PASS — **isolated real SQL / real API HTTP / pinned Customer and Merchant adapters only**.
**Activation status:** None. API/Customer live order flags remain OFF. This is **not** Production readiness or real merchant/browser acceptance.

## Sources and exact gate

- API review branch: `review/l3-my-kota-private-test-api`, draft PR #171.
- Code/test commit validated: `03e4fca639e1d04959bd8b84633d61ef7ebcfb91`.
- Owner-accepted Customer code pinned in test checkout: `c77736e7b4878965baa31ec2ada8138f554d6a7f`, Customer draft PR #115 (unchanged).
- GitHub CI: [L3-N5 disposable PostgreSQL workflow run 44551445179](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/actions/runs/44551445179), **completed success**.
- Other API checks at same commit: L3-N3 44551444988, private My-Kota 44551445230, L3-N2 44551444937 — all completed success.
- Test entry: `.github/workflows/l3-n5-disposable-pickup.yml`.
- Isolated test SQL and real HTTP harness: `localeats-api/tests/pickup/{schema.sql,verify.sql,ci-isolated-journey.sh,ci-isolated-races.sh,journey.mjs}`.
- Exact reviewed SQL drafts only, unchanged: `supabase/drafts/pickup_launch_foundation.sql`, `pickup_zero_fee.sql`, `merchant_availability.sql` and test-only availability fixtures.
- Fresh backup and restore verifier: `localeats-api/tests/pickup/ci-l3-n5-restore.sh`.

## Isolation

The test runs in a short-lived GitHub Actions PostgreSQL **17** Docker service with a generated synthetic database `local_pickup_qa`. The script checks exact loopback host `127.0.0.1`, port 5432, PostgreSQL test name and synthetic credentials, no `SUPABASE_URL`, hosted database URL, service-role/secret key, or production identity. It refuses an existing orders table. There is no real account, real shop, browser-stored token, FCM send, shared staging mutation or production access. The true pickup SQL functions are executed by local fixture roles and mock Firebase authentication; local process-only write activation permits the rehearsal, not a deployment.

The test checks out the exact owner-accepted Customer API adapter and exercises the actual API route handlers and Merchant adapter against that local Postgres service. It does not assert that the latest Merchant Dashboard UI buttons were clicked in a browser.

## Passed integration checks

1. PostgreSQL 17 creates the exact checked-in draft structures with review-hash validation; all input and permission preflight SQL assertions pass.
2. Customer shop discovery enforces 4 km and preserves closed-approved shop browsing; real menu, server quote (R60 for two R30 synthetic meals) and zero pickup service/delivery fees.
3. A request with synthetic private shop ID `private-test-my-kota-preview` is denied at quote and create with HTTP **422 `PRIVATE_TEST_ONLY`**, and creates no order. The private fixture never becomes a public or paid shop.
4. Successful Customer order creation persists once; intentionally lost create response recovers with the same idempotency key and replay. A different customer cannot claim it.
5. Merchant reads the persisted order for their shop, then accepts and marks it Ready with receipts. Ready replay returns the original receipt and does not duplicate the inbox fact; nonowner merchant actions are rejected.
6. Only the owning Customer receives the Ready inbox record; unrelated customers do not. No real Firebase push notification is sent.
7. Early collection is rejected. Payment-at-shop confirmation and explicit handover happen separately, then order becomes collected. Refresh/history and completed replay retain persisted status and five immutable events. Rejection/cancellation, offline database and menu-unavailable paths fail safely.
8. Races: concurrent identical creates produce one order/event; accept vs cancel permits one winner; shop closure wins before a racing creation and rejects the new order.
9. No Rider dispatch, assignment or delivery charges occur for the synthetic pickup orders.

Local SQL transaction scripts print:
`PICKUP_CONCURRENT_IDEMPOTENT_CREATE_PASSED`,
`PICKUP_ACCEPT_CANCEL_EXCLUSIVE_RACE_PASSED`,
`PICKUP_CLOSE_DURING_CREATE_PROTECTION_PASSED`,
`PICKUP_TWO_CLIENT_HTTP_POSTGRES_JOURNEY_PASSED`,
`PICKUP_ONLY_TWO_APP_REAL_HTTP_POSTGRES_PASS`.

## Backup/restore proof

The same job uses the PostgreSQL **17** tools from its own disposable Docker container to dump the fabricated database, restores to a **second empty local database** `local_pickup_qa_restore`, checks all four table counts and relational/security invariants, and removes both temporary archive and restore database at job exit. The runner's PostgreSQL 16 client was incompatible with the PG17 server, so this matching-client fix was verified in the final passing run.

| Synthetic table | Original and restored rows |
|---|---:|
| `orders` | 12 |
| `pickup_order_events` | 23 |
| `pickup_push_subscriptions` | 2 |
| `pickup_push_outbox` | 2 |

Assertions also show a completed/paid pickup remains restored, zero private sample orders, zero Rider fields/delivery fees on new pickup orders, no orphaned events, Ready event counts preserved, RLS enabled on pickup event/subscription/outbox tables, and both core pickup RPC definitions restored. Final marker: `L3_N5_DISPOSABLE_POSTGRES_RESTORE_PASS` and `L3_N5_ISOLATED_HTTP_POSTGRES_COMPLETE_NO_HOSTED_WRITES`.

## What this does NOT establish

- No real Customer/merchant production session or live payment was exercised.
- Merchant Dashboard UI and on-device browser controls were not manually accepted in this phase; the tests exercise the shipped Merchant API adapter, not the rendered React UI.
- No hosted staging SQL migration was applied; no conclusion that its schema mirrors the disposable fixture.
- No live FCM notifications were sent or observed on a device.
- No permission to merge PR #115 or #171, switch payment/order/availability write flags, change Production, or launch real orders.

## Recommended L3-N6 owner gate

Stage a **synthetic Merchant Dashboard browser acceptance** with a separately launched local fixture API and disposable Postgres, preserving original UI. Verify order list, Accept, Ready, confirmed payment and collection, old-response recovery, and no unverified success. Then obtain a manual owner review before any separate controlled real-order activation decision. Keep all hosted Production and shared staging writes disabled and draft PRs unmerged.

**Status: L3-N5 disposable SQL/HTTP/backup-restore passed. Wider live merchant UI acceptance and activation remain pending.**
