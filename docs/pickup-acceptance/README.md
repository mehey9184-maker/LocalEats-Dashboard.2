# Unanswered pickup requests — implementation and rollout record

## Behavior prepared

- New opted-in managed collection orders receive a five-minute server deadline; existing orders are not backfilled.
- A merchant reminder is durable after two minutes. It does not change order revision or need customer acknowledgement.
- Unanswered requests atomically become cancelled with an explicit `acceptance_expired` event and system actor. Preparing/Ready/collected orders never expire through this feature.
- Acceptance checks the real server clock after row locking. Scheduler delay cannot allow a late acceptance.
- Two expiry misses in thirty minutes pauses reception. Customer cancellation does not count. Resume is explicit, revision checked and authorized to the current approved shop owner; it does not change opening hours or approval.
- Customer waiting/expired/uncertain copy preserves authoritative state. Merchant reminders are readable without push. Queue delivery rechecks current ownership, state, device revocation and token; attempts are bounded and fenced.

## Actual local evidence

`localeats-api/tests/pickup/acceptance-local.ps1` creates a fresh PostgreSQL 17 cluster on loopback port 55439, applies only synthetic fixture/review SQL, then stops it in finally. Data/logs remain under ignored `.tmp/acceptance-pg-*`; no hosted connection or customer account is used. Canonical LF test copies preserve existing reviewed function hashes on Windows. Original source and drift guards remain intact.

Passed SQL cases: exact two/five-minute boundaries, unique reminders/events, accepted-order exclusion, pause/create rejection, unauthorized resume and private inbox, former-owner filtering, retry lease fencing, reset after resume, real changing clock, multi-session acceptance waiting past its deadline, and 212-order/12-shop backlog progression.

The 180-day synthetic run created exactly **2500** requests: **1800 collected, 360 customer-cancelled, 340 expired**. Outcome counts are asserted, not inferred from Firebase acceptance. All events/data are disposable; no real payment, customer complaint measurement, OS notification or six-month uptime claim is implied.

API: 247 existing regression tests passed; new acceptance policy/security/worker tests passed (8). Customer: 160 root tests, TypeScript, build and real tracking-screen browser checks at 320/390/1280 passed with external traffic blocked. Merchant: 15 pickup tests, build and reception browser checks at those widths passed, including token-refresh timeout and shop switch. Component lint passes. Full Merchant lint fails with existing repository errors; compiler comparison found 50 baseline diagnostics and the same 50 current diagnostics, zero introduced diagnostics. This remains a release blocker, not a green whole-repository check.

Fresh review found two Merchant issues (unbounded token refresh and unscoped reception display); both were fixed and browser-tested. Review found no remaining important authority/concurrency issue. UI screenshots use only synthetic fixtures.

## Not activated / required before rollout

1. Review both draft branches together. Rebase SQL against the actual approved schema: lifecycle guard hashes deliberately reject drift, including newer handover contracts. Never bypass these guards to deploy.
2. Verify a truly isolated database, backup/restore and staging Firebase credentials. Obtain separate permission before applying any hosted schema or enabling writes. No current Preview flag was changed.
3. Approve a trusted recurring scheduler. `runAcceptanceCycle` processes at most ten shops/100 due orders per shop and ten push attempts per call; it has no automatic invocation. Supabase Cron can schedule SQL, but availability, permissions and push-worker hosting must be verified for the owner's actual free plan. No scheduler is installed here.
4. Database settings, API acceptance/worker flags, browser acceptance flag and existing pickup write gates all default OFF. Cloud push has its own OFF flag. Enabling one flag is not rollout approval.
5. Test a one-minute worker cadence, backlog metrics, missed-run alerts and provider retries on isolated staging. Five minutes is the hard acceptance boundary; persisted expiry and push visibility may follow the next scheduler tick. Push display is never guaranteed to the second.
6. Verify real foreground/background delivery, denied/revoked permissions, logout/account switch and Windows banner/Notification Center using an explicitly approved staging device and bounded cloud send. No cloud message has been sent by these tests.
7. Recheck Supabase storage/egress, free-project pausing, backup arrangements and API-host terms/limits. No paid package or billing activation was added; six months of free uptime is not promised.
8. Resolve existing Merchant lint/TypeScript release failures. Review CI and the original full pickup/receipt/payment regression gates. No merge, Production deploy, real orders/payments or public activation without separate owner approval.

Official references checked: [Supabase Cron](https://supabase.com/docs/guides/cron), [Supabase pricing](https://supabase.com/pricing), [Firebase pricing](https://firebase.google.com/pricing).
