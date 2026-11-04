# LocalEats Phase 1 — Merchant inbox completeness when a shop has more than 250 orders

**Safety:** API-only read correction; no database writes, schema changes, notifications sent or ordering activation. Draft PR until manual staging acceptance.

## Verified missing-order risk
The Merchant API `GET /api/v1/merchant/orders` previously selected the newest 250 orders for the verified merchant's shops. An unfinished order older than those 250 records could disappear from the merchant's inbox even though it remained in PostgreSQL.

This is separate from push notification success. The Merchant Dashboard reads this API every 15 seconds, so reliable order visibility must not depend on push, nor on a capped mixed-status history.

## Proposed behavior
- Retain the **250 latest** orders as before to preserve history and existing UI.
- In a second read, fetch *unfinished* orders for the same verified shop IDs, 250 per page, ordered by `created_at DESC, id DESC`. All statuses other than known terminal `cancelled`, `collected`, `delivered` and `completed` count as unfinished (including NULL and unknown status strings).
- Merge by authoritative order ID, prefer the latest read of an unfinished row, sort newest-first and strip delivery proof fields before returning data to the browser.
- Require authenticated Firebase identity and merchant ownership lookup before either order query, and reject any unexpected cross-shop record returned by upstream providers.
- If any page read fails or the number of unfinished orders exceeds **1,000**, return an explicit non-success response rather than silently implying the order inbox is complete. The hard limit is a fail-closed operational warning, not a statement that 1,000 simultaneous orders are supported.
- No new timers, jobs, cron, FCM worker or expensive optional subscriptions. No changes to the Merchant layout or checkout flow.

## Validation
- 250 newest orders are completed; an older pending order still appears.
- More than 500 active orders across 3 pages are assembled without duplicates.
- Up to 1,000 are included; 1,001 triggers a hard error rather than a partial inbox.
- A failure on page 2 causes an error, not a partial success; malformed/null data is rejected.
- Other shops' rows are never sent to the wrong merchant.
- The API remains read-only and retains existing delivery proof redaction.
- New regression job runs TypeScript, the complete API unit suite and explicit pickup/rider disabled flags. Independent Merchant baseline CI also runs.

## Limits and next steps
This is **not** a proof that 5,000 concurrent users or high-throughput Supabase can be served. Offset pagination may be briefly inconsistent when orders change while pages are fetched; the dashboard's periodic retry/foreground sync is required for eventual reconciliation. If this scenario becomes common, design a stable keyset or database-snapshot API with load/latency benchmarking.

With 20 shops opening their dashboards, extra reads could increase Supabase usage. Measure 15-second polling reads and egress under staging, then optimize with server-side versioning/deltas if necessary. Never reduce consistency by discarding open orders.

**Dependencies:** Merchant order-recovery PR #56 is separately drafted, not merged. Privileged rider-notification SQL PR #57 and backup rehearsal PR #58 remain separate. No Production merge, DB permissions, FCM, payments, rider dispatch, order activation or staging load test is authorized by this PR.
