# Pickup schema and API safety corrections — local review package

Status: IMPLEMENTED LOCALLY; production SQL, migration publication, commit, push and deployment remain unapproved. All changes are unstaged. Branch `launch/pickup-only-pilot-01`; starting and ending committed HEAD `2796f2d94f4fb5f00b37d5cf087721d7a31f294d`.

The owner's instruction to do all independent-review recommendations authorizes these local corrections, API implementation and disposable PostgreSQL execution. It does not authorize a production database connection or rollout. No other repository or original documentation checkout was changed. Owner decisions supersede the older delivery/cache language in AGENTS.md and historical documentation.

## 1. Recommendations resolved

| Independent-review recommendation | Local implementation |
| --- | --- |
| Close unclassified inserts | Every new orders INSERT requires the managed pickup contract. The previous null-classification INSERT exception is removed. Browser mutation checks precede legacy branches, even with permissive historical policies. Existing unclassified records retain their values and authorized API delivery updates. |
| Complete payment and scoped replay | Creation binds authenticated UID and immutable intent, before repricing. Commands bind order UUID, current ownership, actor UID, normalized payload and command UUID. Payment explicitly requires actual cash/card_machine; collection separately requires handover_confirmed=true. |
| Align malformed-state guards | Pending/preparing/cancelled must be unpaid; collected must be paid; Ready may be unpaid or paid. Terminals cannot progress. Model, RPCs, trigger constraints and tests cover these rules. |
| Safe outbox claim/completion | Scoped SKIP LOCKED claims, 30-second leases, attempt generation fencing, five-attempt ceiling, exponential backoff and exhaustion abandonment. Send recheck verifies current recipient/token/revocation/order state. Revocation clears token. |
| Execute disposable PostgreSQL tests | Native PostgreSQL 17.11; a fresh loopback-only cluster under ignored node_modules/.cache. Synthetic fixtures only. Tests apply this draft, exercise actual permissions/triggers/deferred checks and concurrent requests, then stop their own cluster. |
| Implement transactional API commands | Service-only SECURITY INVOKER RPCs create order+event, and atomically apply actions+events+Ready jobs. Mounted Express routes call them; no independent update/insert sequence for managed commands. |

## 2. Files in this package

Modified tracked files:

- `localeats-api/src/routes/orders.ts`: pickup-v1 quotes/create, managed accept/Ready/cancel RPC dispatch, reject/payment/collect routes, safe customer action history and internal-hash stripping.
- `localeats-api/src/server.ts`: notification/subscription router and PUT in the existing CORS method list.
- `localeats-api/package.json`: include contract, pickup service and mounted route tests.
- `Vendor_LocalEats_App_Functionality_Documentation.md`: current local status and rollback/rollout limits.

Untracked review files, including the pre-existing Stage 3B drafts:

- `supabase/drafts/pickup_launch_foundation.sql`
- `docs/PICKUP_SCHEMA_CONTRACT_REVIEW.md`
- `localeats-api/src/contracts/pickupDraft.ts` and `pickupDraft.test.ts`
- `localeats-api/src/orders/pickupService.ts`, `pickupService.test.ts`, `pickupPush.ts`
- `localeats-api/src/routes/pickupNotifications.ts`, `pickup.test.ts`
- `localeats-api/tests/pickup/schema.sql`, `verify.sql`, `validate.ps1`, `race-create.sql`, `race-accept.sql`, `race-cancel.sql`, `race-verify.sql`

No active migration, archived migration, Rider implementation, package dependency, lockfile, environment file or provider configuration was changed.

## 3. Minimum schema and authority

Four nullable orders columns remain the entire order-column addition: delivery_type, payment_status, create_intent_hash, revision. They have no defaults or historical backfill. NULL historical fulfillment/payment remains unknown. New records are explicit collection/unpaid/revision 0 with immutable SHA-256 creation intent. Creation snapshots and customer identity/contact are immutable; payment method can change only during explicit payment confirmation. SQL stamps managed timestamps.

Three tables remain justified:

1. pickup_order_events supplies both append-only audit facts and durable customer Ready inbox entries. Unique order/revision, order/command and order/kind prevent duplicate facts. No separate notification table, read-receipt schema or duplicate message payload.
2. pickup_push_subscriptions binds an authenticated customer and installation to a permitted FCM token, supports rotation/revocation and clears revoked tokens. Unique token conflicts cannot transfer another customer's binding.
3. pickup_push_outbox separates mutable delivery attempts from immutable events, with one job per Ready event/device. Retain this only for best-effort retries; it requires no new scheduler/queue service.

New tables have RLS and no browser policies or grants. Only service_role can read/write the required operations; events grant SELECT/INSERT only. Trigger functions and RPCs are SECURITY INVOKER with empty search_path and qualified application objects; PUBLIC/anon/authenticated EXECUTE is revoked. Firebase identity is authenticated by Express; server-only calls supply its UID. Never expose a service-role key or forward a browser-supplied UID/authorized boolean. The pure model's authorized value is a server/test ownership result, not an API input.

The SQL now preflights required column types, catalog ID type, coordinate columns, service-role privileges and a valid nonpartial unique idempotency index (constraint-backed or standalone). Exact unverified production drift fails closed. This is not a substitute for actual schema/policy inspection before rollout.

## 4. Exact local API contracts

All paths below are now mounted locally; none is deployed by this task. They require `Authorization: Bearer fb-<Firebase ID token>` and return no-store responses under the existing API middleware.

| Endpoint | Implemented local behavior |
| --- | --- |
| POST /api/v1/orders/quote | pickup-v1 only, approved/active/unarchived real shop/menu, quantities/availability/price validation, at most 4 km from supplied launch_location; returns priced lines in minor units, ZAR total_minor and pricing_fingerprint. Zero writes. |
| POST /api/v1/orders | Requires pickup-v1, canonical request and consent; same-key same-customer immutable replay precedes catalog; new creation uses pickup_create_order RPC. 201 committed new order, 200 replay. Omits absent Rider proof columns. |
| GET /api/v1/orders | Existing authenticated customer-scoped persistent order list. Existing limit 50 remains; no new order-list pagination was added. |
| GET /api/v1/orders/:id | Customer-scoped order; managed orders additionally include safe event kinds/revisions/times/details. Rejection/cancellation reasons and independent payment facts can be displayed from events. Internal hashes are omitted. |
| POST /api/v1/orders/:id/cancel | Managed order: pending/unpaid customer command + cancellation fact. Existing legacy conditional cancellation remains for old orders. |
| POST /api/v1/merchant/orders/:id/accept | Managed order: pending/unpaid -> preparing/unpaid + accepted fact; existing legacy delivery logic retained. |
| POST /api/v1/merchant/orders/:id/ready | Managed order: preparing/unpaid -> ready_for_pickup/unpaid + single Ready inbox fact + eligible device jobs, in one transaction. One awaited best-effort push attempt afterward. |
| POST /api/v1/merchant/orders/:id/reject | Pending/unpaid -> cancelled/unpaid, with merchant_rejected reason. |
| POST /api/v1/merchant/orders/:id/payment-confirmation | Ready/unpaid -> Ready/paid, actual cash/card_machine required; amount/currency/method recorded from authoritative order. Does not collect. |
| POST /api/v1/merchant/orders/:id/collect | Ready/paid -> collected/paid, explicit handover_confirmed=true required. Does not infer payment. |
| GET /api/v1/notifications | Own Ready events only, descending timestamp/UUID keyset cursor, 50 rows. No tokens, command hashes or other-customer events. Triggers one bounded push drain. |
| PUT /api/v1/push-subscriptions/:installationId | UUID installation, permission_granted=true and validated fcm_token. UID comes only from authentication. Own token rotation; uniqueness conflicts return conflict. |
| DELETE /api/v1/push-subscriptions/:installationId | Idempotent own-installation revocation and token clearing. |

Quote/create require: contract_version=pickup-v1, UUID idempotency_key (canonical lower case), shop_id, item IDs/quantities/optional notes, delivery_type=collection, delivery_schedule_mode=standard, payment_method=cash or card_machine, customer_details.name/phone, and finite launch_location.lat/lng. Email/address/city/instructions are optional; **this minimum implementation requires contact for quote as well as create**, reusing existing validation. Tips, paid options, variants, promotions, client totals and unexpected fields are rejected. No delivery GPS is persisted for pickup.

Create adds `consent: {currency: "ZAR", total_minor: integer, pricing_fingerprint: 64-character lowercase SHA-256}`. Server pricing, not the client's amount/hash, determines persistence. The fingerprint covers ordered item ID/name/quantity/unit/line prices and complete monetary breakdown. Immutable intent additionally covers authenticated customer, normalized checkout/contact, original intended payment method, location and consent. Missing or changed hash/other customer produces generic 409 without returning another order. Actual method changes later do not break creation replay.

Each managed action needs UUID command_id and nonnegative safe-integer expected_revision. Reject/cancel also need a trimmed reason of 1–500 characters. Payment-confirmation also needs payment_method=cash/card_machine. Collect also needs handover_confirmed=true. Caller-supplied identity/authorization, prices and unrelated fields are rejected. Original identical command replays after later transitions; changed payload conflicts. A different Ready command after Ready returns 409 and cannot create another inbox event.

Accept means preparing immediately; no new Accepted enum. Rejection is stored cancelled plus merchant_rejected fact. All actions recheck current customer/shop ownership inside the locked database transaction before command replay. Expected revision and row locking serialize accept/cancel and prevent terminal resurrection.

HTTP outcomes: 400 malformed payload, 401 missing/expired identity, 403 denied ownership, 404 missing/concealed order, 409 price/state/key conflict, 422 eligibility/unsupported work, 426 old creation/quote contract, 503 unconfirmed persistence/schema/provider dependency. A connection loss has unknown commit outcome; retry the original key/command. No memory/localStorage success substitute is introduced.

## 5. Transaction and push details

pickup_create_order takes a transaction advisory lock for the idempotency key, rechecks replay first, locks the current shop and menu rows in stable ID order, verifies availability and snapshot prices against current catalog, recalculates the existing service fee (R2.50 when subtotal is positive), rechecks radius using locked shop coordinates, and commits order plus created event. API consent is revalidated before calling this service-only RPC. Menu updates cannot pass the row locks before the transaction commits.

pickup_order_command locks the order and shop ownership, scopes replay by actual actor/order/kind/hash, applies one valid revision and writes its event. Deferred constraints reject Ready/payment/collection projection changes without their matching event. Ready and eligible jobs are committed together. No subscriptions is a valid Ready with zero jobs.

pickup_claim_push scans at most ten scoped due rows and returns at most one lease. pickup_push_sendable rechecks the captured token, lease generation/expiry, recipient, revocation and current Ready status immediately before provider use. pickup_finish_push acknowledges only the same live lease/attempt; stale workers cannot overwrite a newer attempt. Expired leases can be reclaimed; attempt 5 exhaustion becomes abandoned. Retries use bounded exponential backoff on later relevant requests.

FCM uses the existing firebase-admin dependency and configured app. With no initialized Firebase app, drain leaves jobs pending. Provider errors never reverse committed Ready or hide the inbox. No token/provider error payload is logged. Payload is data-only, generic event/order IDs with a short TTL; the Customer worker must implement display, event-ID dedupe and fetch current order on opening. A permission change after the final check can race an already in-flight provider request; delivery cannot be guaranteed. A provider acceptance is not customer receipt. No traffic means retries may not happen. One awaited send per Ready/inbox/subscription request; no detached promise, permanent worker, cron or paid queue. Merchant list reads do not start a drain in this minimum implementation.

## 6. Database execution and validation

Reproducible Windows command, from localeats-api: `./tests/pickup/validate.ps1` (optional -PostgresBin and -Port, default PostgreSQL 17 path / loopback port 55432). The runner refuses an occupied port, initializes a fresh unique ignored node_modules/.cache/pickup-pg-* cluster with synthetic roles/data, binds 127.0.0.1 only, and stops that exact cluster in finally. It does not use installed database services, Supabase URLs, production credentials or environment changes. Stopped synthetic data/logs are retained for inspection.

Fixture coverage: known orders fields/types/FKs, unique idempotency standalone index, RLS plus deliberately permissive legacy browser policy, nullable historical/cancelled/completed/assigned delivery records, real PostgreSQL grants/row locks, and new draft objects. It verifies browser mutation/RPC/table denial, legacy delivery continuation, creation replay before closure, cross-customer/changed-intent conflicts, authoritative price/radius failures, missing-event transaction rollback, append-only/immutable facts, recipient revocation, scoped claims, lease reclamation, stale completion, exhaustion, duplicate Ready, method changes, separate payment/handover and rejection/customer cancellation.

Two separate concurrent psql connections prove same-key creation yields one order/event. Concurrent accept/cancel yields exactly one successful revision; the other fails ORDER_STATE_CHANGED, with exactly two total facts (created plus winning action).

**Full production-schema fidelity is UNVERIFIED.** No production dump, current triggers/policies/index definitions, active assignments or hosting bindings were accessed. Fixtures are representative, not a production clone. PostgreSQL syntax/execution and tested concurrency are verified only against this local engine/fixture. Existing unknown triggers, permissions, extensions, type drift and legacy writers must be examined in a separately authorized rollout review.

Final verification results are recorded below. Initial sandbox runs of HTTP tests failed with loopback EACCES; the same tests pass with local loopback allowed. Windows pg_ctl required a hidden root-process wait instead of PowerShell's descendant-tree -Wait; the reproducible runner includes that correction. Fixture SELECT FOR SHARE needed minimal UPDATE(id) privilege on shop/menu; production preflight checks the necessary privileges without granting new catalog write authority.

## 7. Locking, compatibility and rollback

Draft stays outside active supabase/migrations. No migration history changes and no archived integrity SQL application. Four nullable columns have no defaults/backfill. New CHECK constraints use NOT VALID to avoid a historical heap scan under the ALTER TABLE lock; they still enforce new writes. A later reviewed maintenance action can validate them. DDL still needs an exclusive lock briefly, with 5-second lock and 30-second statement timeouts; test against representative size/traffic before rollout. New-table indexes do not scan existing orders. Colliding objects or incompatible types fail the transaction.

Do not apply this SQL independently of compatible API deployment. It deliberately rejects old/unclassified inserts and browser mutations, including legacy writers. This is a contract cutover, not a backward-compatible checkout API change: old quote/create clients receive 426; managed commands need command/revision payloads. Existing legacy delivery API transitions/history remain and Phase 1/new-work gates are unchanged. No new persisted delivery states or Rider columns were introduced.

There is no new environment flag. Before the reviewed schema exists, pickup creation/actions cannot report persistence success. After schema/API cutover, pickup-v1 callers can create; coordinate rollout and client release during an approved window. No push to main is safe merely because tests pass: existing automatic deployment could publish these incompatible routes. Keep this local branch unpushed until schema/client/hosting review and rollout authorization.

Application rollback retains all columns, orders, audit/payment/collection events, subscriptions and jobs. Stop new client creation and use the last compatible API, or make managed orders read-only. Never restore an older mutation API that bypasses managed facts or reenables delivery offers. No destructive down script is supplied. A mistaken payment/handover still requires an approved compensating-event design; history must not be deleted or silently marked unpaid.

## 8. Free-tier and launch dependencies

No new dependency, paid provider, background service, premium database feature or Firebase upgrade was added. Request-driven transactions and FCM fit a free-capable design, but do not certify actual quotas or commercial hosting eligibility. The connected plan remains unverified; Vercel Hobby is limited to non-commercial personal use and would block this commercial pilot. No host was switched, plan inspected through privileged settings, or billing/environment change made. Existing standalone Docker/start does not listen on a port and remains an unverified alternative; this task does not change hosting.

The precise Tembisa/Ivory Park shop boundary and physical-card capability evidence remain owner/catalog dependencies. Radius is straight-line Haversine, maximum 4 km; user-supplied location is eligibility input, not proof of physical presence. This package does not fabricate a town geofence or card-terminal column. Customer/Merchant frontend adoption, worker/subscription reconciliation and a two-account real pickup acceptance test require a separately authorized client task. No other repository was changed.

Production launch remains NO-GO until actual schema/policy compatibility, a coordinated approved migration/API rollout, client pickup/payment/handover/inbox adoption, free commercial hosting eligibility and the two-account acceptance test are verified. The local corrections do not constitute permission to commit, apply production SQL or deploy.

## 9. Minimal acceptance after separately approved staging rollout

Use a real merchant account/shop with two active menu items and a separate customer account within 4 km. Quote and consent to server prices; place once, retry the identical body after a simulated lost response, and verify the same persisted order. Changed cart/contact/consent under that key must conflict; a second customer must never recover it.

Merchant sees only their shop's order/contact and accepts into preparing. Customer refresh shows preparing. Merchant Ready produces one durable inbox fact; repeat the original command and confirm one fact/job per device. Denied push permission must leave the in-app event intact. Expired auth and database failures must show honest failure/recovery.

Attempt collection while unpaid: reject. Confirm actual cash or physical-card payment: customer remains Ready with independent paid status. Confirm actual food handover and collect: customer sees collected after refresh and in persistent history. Repeat original payment/collect commands safely; different commands cannot resurrect or repay. Check rejected/pending cancellation, out-of-stock, unavailable shop, cross-shop merchant access, expired leases and revoked subscriptions. Pickup must never appear in Rider feeds/claim/progression; existing authorized delivery test fixtures/history remain intact.

## 10. Final local validation

- API build: PASS (`npm run build`, also run by npm test).
- API TypeScript: PASS (`./node_modules/.bin/tsc.cmd --noEmit`).
- Complete API suite: PASS, 122 tests, zero failures/skips; includes all existing Phase 1 tests and 15 draft/pickup tests.
- PostgreSQL 17.11: PASS against fresh synthetic fixture, including real concurrent create and accept/cancel sessions; final runner printed PICKUP_POSTGRES_ASSERTIONS_PASSED, PICKUP_CONCURRENT_CREATION_AND_ACCEPT_CANCEL_PASSED and PICKUP_DISPOSABLE_POSTGRES_PASSED. Exact cluster stopped in finally; no local test server remains running.
- Root Merchant UI build was attempted but unavailable because vite/root UI dependencies are not installed in this worktree. No UI files changed; no dependency installation was performed to expand scope.
- git diff --check: PASS; untracked-file whitespace check: PASS. Added-line secret-pattern scan: PASS across all 20 changed/untracked files (1,548 added lines at inspection); no credential values were printed. This is a pattern scan, not a guarantee against every secret format. No production database or FCM provider calls were made by validation.
- Committed HEAD remains 2796f2d94f4fb5f00b37d5cf087721d7a31f294d; nothing staged or committed.

Official references: [Supabase function privileges and invoker guidance](https://supabase.com/docs/guides/database/functions), [Firebase Admin FCM sends](https://firebase.google.com/docs/cloud-messaging/send/admin-sdk), [Firebase pricing](https://firebase.google.com/pricing), [Vercel Hobby restrictions](https://vercel.com/docs/plans/hobby). These describe capabilities/restrictions; they do not establish this project's billing plan, quotas or provider readiness.
