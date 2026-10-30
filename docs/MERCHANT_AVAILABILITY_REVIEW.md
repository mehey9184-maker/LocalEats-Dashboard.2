# Merchant availability review — 2026-10-31

Branch: fix/merchant-authoritative-availability, based on reviewed zero-fee branch 727eb72904bd6066696f20b8c019b4c06b29743c. This branch therefore retains the separate, unapplied zero-fee SQL dependency. Do not merge blindly into main or deploy Production.

## Root cause and replacement
The original switches wrote local overrides and two Firestore paths (the nominal Supabase frontend client is a Firestore bridge). API shop refresh reads Postgres, so the switch could not reliably persist the authoritative state. Failed writes also left stale local authority. All availability controls now use Firebase-authenticated PATCH /api/v1/merchant/shop/availability. Every command uses an RPC that locks the shop, verifies its actual owner and current revision, and returns the saved record. No client timestamp, owner claim or chosen expiry is accepted.

Availability mutations default-deny unless server-only MERCHANT_AVAILABILITY_WRITES_ENABLED=true. This is separate from PICKUP_WRITES_ENABLED, which remains false. Preview availability writes also remain false because it shares the Production database. Reads fail explicitly while the new view is absent. No fallback to Firestore/local storage establishes availability.

## Schema and policy
Live information_schema inspection confirmed public.shops has text opening_time/closing_time, nullable boolean is_active, and no override expiry or availability revision. supabase/drafts/merchant_availability.sql is an unapplied additive transaction:
- availability_override_until timestamptz nullable: no speculative backfill.
- availability_revision bigint NOT NULL DEFAULT 0 with nonnegative constraint and automatic revision trigger.
- shop_schedule_open evaluates Africa/Johannesburg, start inclusive/end exclusive; overnight hours supported. Missing/malformed/equal hours fail closed unless the merchant explicitly confirms a temporary opening.
- shop_effective_open is the single database calculation: is_active must be true, and either scheduled hours apply or the confirmed override has not expired. Explicit close always wins.
- service-role-only security-invoker shops_with_availability view supplies Merchant, catalog/discovery and server quote/order-pricing reads. Approval, archival, pilot area and 4 km filters remain.
- merchant_set_availability checks ownership/revision under row lock. Opening outside hours requires confirmation and lasts exactly one hour. Early close clears expiry. Opening within hours resumes scheduled availability. Expiry does not require cron, queue, dashboard or a permanent worker; reads and order creation evaluate it using database time.
- collection INSERT guard acquires a shop FOR SHARE lock, rechecking effective availability/approval/archive immediately before insert. Close locks the same row FOR UPDATE. A create that already won the lock may complete; after close wins/commits no new create succeeds. Historical idempotent replays remain available; existing payment/handover/fulfillment history is not changed.
- view/RPC execute access revoked from PUBLIC/anon/authenticated; grants limited to service_role. No Rider tables/functions changed. No historical order updates.

Regular opening hours are not edited. Legacy browser auto-scheduling no longer writes business status; its original setting remains visible but disabled with server-managed wording. Manual Holiday Mode routes through the same API close/open command. Future scheduled holiday metadata is not a new authoritative contract; it requires separate design rather than browser writes. Do not represent old metadata saves as a supported server holiday scheduler.

## Original UI
Existing header, dashboard, bulk and status controls retained. Outside-hours opening uses a confirmation, preserving the revision originally reviewed. No automatic conflict rebasing/retry extends an override. Successful API results update the UI and stale local overrides are ignored/removed. Failed persistence cannot set a successful status. Dashboard refreshes authoritative availability on focus and every 30 seconds while visible. The server enforces expiry immediately regardless of display refresh interval. Customer catalog is served effective availability without changing Customer source or radius.

## Validation
API suite, Merchant unit tests, API TypeScript, Merchant build, no-new-diagnostics comparison, git diff and added-line secret checks are required before commit. Disposable PostgreSQL 17 fixtures test real SQL execution, SAST midnight/overnight/boundaries, one-hour confirmation/expiry, ownership, revision conflict, close/create locking, existing idempotency and pickup lifecycle. Provider Firebase authentication is mocked only inside tests; no deployed auth bypass is added. Local fixture data is not Production data.

## Preview limitations
Only API and Merchant Previews are authorized. Both write gates remain false. Supabase SQL remains unapplied, so a signed-in Preview shop read will report unavailable schema; the live Production database must not be used to demonstrate a successful toggle. A fully interactive hosted toggle test requires a separately approved isolated schema/database binding (no paid services), or review of the already-tested local disposable fixture. Do not enable the Preview mutation gate against the shared Production database.

## Production approvals and rollback
1. Independently review/approve exact merchant_availability.sql and the zero-fee draft dependency if releasing the inherited pricing changes. Check object-name collisions/lock window and save backup/schema checksums immediately before approved application.
2. Apply approved SQL only after separate owner authorization; verify grants, functions, triggers, views, unchanged order/Rider counts and My-Kota hours.
3. Approve API and original Merchant release with PICKUP_WRITES_ENABLED=false, frontend pickup flags unchanged/off for this release. Set MERCHANT_AVAILABILITY_WRITES_ENABLED=true only under explicit approval to change shop availability.
4. Test a real availability change only with owner permission; no order is required. First-order activation remains a separate approval.
Rollback: disable availability writes and pickup writes; keep schema, saved explicit closures, expiry and revision facts. Do not drop the insert guard or restore a browser writer. Keep the hardened API until a separately reviewed safe replacement exists. No deletion of order/payment/events/history.

## Recorded validation results
141/141 API tests passed; API TypeScript passed. 10/10 existing Merchant pickup tests and 4/4 new availability transport tests passed. Merchant production build passed. Existing Merchant TypeScript baseline has 61 diagnostics; current has 59, with zero new diagnostics after path/line normalization. Disposable PostgreSQL 17 migration, one-hour confirmation, SAST expiry, row ownership/revision checks, actual close/create contention and existing two-client pickup lifecycle passed. Servers stopped after tests. Diff whitespace and added-line credential scans passed. No Rider/Firebase implementation changes.
