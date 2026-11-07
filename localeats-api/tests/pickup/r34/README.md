# LocalEats R3.4 — Real pickup SQL, isolated PostgreSQL 17 end-to-end rehearsal

**8 November 2026. No Production, connected Supabase, hosted staging, live orders, payments or real Firebase push.**

## Summary

For the first time in the Rewards-related architecture programme, **R3.4 executes the actual checked-in pickup SQL function definitions and triggers**, rather than a separate simplified model of those functions. It uses a **fresh, disposable local `postgres:17-alpine` container** with no published ports, no secret Supabase environment variables and entirely synthetic IDs, addresses, phone and food data.

It is **not yet an exact full Production schema clone**. The checked-in migrations do not reconstruct every deployed table, policy and change; in particular the applied `pickup_payment_methods` migration is not present in the repository's SQL files. The synthetic legacy prerequisite tables are deliberately minimal and must not be treated as a Production migration.

## 1. Source verification — actual deployed PostgreSQL catalog, SELECT only

Connected read-only metadata on 8 November 2026 established:
- `public.orders.id uuid`, `shop_id/user_id text`, `items jsonb`, `create_intent_hash text`, `revision bigint`, `payment_status text`;
- `public.pickup_order_events.order_id uuid`, `command_id uuid`, `revision bigint`, unique `(order_id,command_id)`, `(order_id,revision)`, `(order_id,kind)`;
- `public.pickup_create_order` and `public.pickup_order_command` are `SECURITY INVOKER`; client roles do not have execution rights;
- `public.pickup_order_command` updates the order and then inserts a matching event **inside the same transaction**. Deployed function body comparisons against repo SQL showed `pickup_create_order` matches `supabase/drafts/pickup_zero_fee.sql`, while `pickup_order_command` and `guard_pickup_order` match `supabase/drafts/pickup_launch_foundation.sql`, ignoring differences in whitespace;
- canonical MD5 of normalized deployed `prosrc` for those functions, included as offline drift guards:
  - `pickup_create_order`: `70cb4891b1ff47c5f15cb112e192bad8`;
  - `pickup_order_command`: `303bef1097192d096ba3340d87c16f02`;
  - `guard_pickup_order`: `3d4c1851a9a791df1f698af8e36bc5d0`.

**Do not blindly trust this frozen hash for later deployments**: repeat a read-only catalog review when preparing a later rollout. Local CI checks the hash of the SQL it recreated, not a new live connection.

## 2. Local replay — actual checked-in draft files

`run-local-pickup-r34.sh` starts only a temporary PostgreSQL database `pickup_r34_lab` and loads these files **without modifying their SQL**:

1. `localeats-api/tests/pickup/r34/baseline.SYNTHETIC_ONLY.sql`: creates **fabricated legacy prerequisites** (minimal shops, menu_items, orders, and non-login `anon`, `authenticated`, `service_role` roles). The service-role rights let the original migration's own preflight pass. This file is NOT part of a deployable migration chain.
2. `supabase/drafts/pickup_launch_foundation.sql`: executes the original protected create/command RPC definitions, append-only pickup events, deferred matching-event integrity trigger, FCM push queue, entitlement-safe role grants, and order guards.
3. `supabase/drafts/pickup_zero_fee.sql`: executes the repo zero-fee replacement with its original function preflight. The client checkout total is recalculated as exact menu subtotal, **R0 service/delivery fee**.
4. `supabase/drafts/merchant_availability.sql`: executes original merchant availability and protected collection-insert guard. Fake eligible shop overrides its time window.
5. `fixtures.SYNTHETIC_ONLY.sql`: synthetic My-Kota R25 item, fake Tembisa/Ivory Park location, false phone/email, and nonfunctional FCM token. No real customer UID or real order.
6. `checkout-e2e.SYNTHETIC_ONLY.sql`: calls the **actual loaded RPCs**, not an imitation.

The offline test is a **functional subset**: it doesn't load applied payment-method migration, Supabase-managed auth/storage/Realtime functions, full production views/indexes/legacy financial policy, Cloudflare Worker HTTPS, client/merchant frontends or Firebase Admin/FCM. A green result cannot be called a complete database replica.

## 3. End-to-end and negative cases

The SQL checks a single created pickup journey: `pending → preparing` (merchant Accept), `ready_for_pickup` (Ready), `payment_status paid` from merchant cash confirmation, and `collected` after explicit food handover. It verifies the matching immutable event revisions `0 → 4`, original order ID, **no Rider/Delivery**, total R25 and **R0 service fee**.

The fake subscription queues **one ready push event**. The test calls `pickup_claim_push`, `pickup_push_sendable`, and `pickup_finish_push` to exercise sending/acknowledgement logic. **No real Firebase message is sent** and push delivery reliability has not been measured.

Negative scenarios: idempotent replays, forged merchant, buyer-initiated cancellation, stale revision, tampered menu price/subtotal/service fee, outside 4 km, shop closed/unapproved, unpaid collection, unconfirmed handover, invalid online payment method, forbidden browser RPC/table access, direct state mutation without the matching event (deferred commit rollback), immutable order price, fake event revision and two-process duplicate create. All expected failures must preserve the source order and outbox without ghost writes.

**No actual customer, merchant, real shop, Production transaction or payment is involved.** A fake cash payment is only a simulated state transition.

## 4. Release implications and remaining blockers

**Confirmed safety boundaries:** The workflow has `contents:read`, pinned checkout action, no saved credentials, an isolated PostgreSQL 17 Docker image without published ports, no remote Supabase connection string, and an automatic container removal. The draft SQL only executes **inside** that disposable container. Production remains untouched and Rewards remains Coming Soon.

**Outstanding before public launch or Rewards:**

- The repository migration chain is **not complete**. The actual remote migration history includes applied `pickup_payment_methods` (20261101160331) but no corresponding source SQL file. Reconcile full live DDL (tables, defaults, checks, policies, triggers, views, functions, role grants and all applied migrations) into a reproducible, privacy-safe **schema-only** baseline before claiming true 1:1 Production equivalence. Do not overwrite existing migration history.
- The Client and Merchant frontends still need real Preview smoke tests including auth startup/login, guest redirect, location radius and nearest shops, closed-shop browsing, menu/cart, no-write simulated checkout, real pickup where specifically authorized, notification timing and failure states. Local Postgres cannot certify UX or Firebase push.
- The local stack isn't a Firebase Admin signature/revocation check nor Cloudflare HTTPS/FCM environment. Previous R3.0–R3.2 mock tests prove contracts only. Real Firebase project use needs separate owner approval and secure staging.
- Even though test fake order is marked paid, the *business* remains **pay at shop on pickup, no online payments**. Do not enable Rider/Delivery, subscriptions or real financial ledger.
- R2.7 separately flagged permissive authenticated `public.payments` policy and anon-executable custom SECURITY DEFINER functions. R3.4 does **not** change any Production policies; Codex must triage them under separate owner-approved staging security PR.
- A full local schema restore or Production backup/restore isn't accomplished simply by loading three repo drafts over a minimal baseline. The 8 November R3.3 synthetic `pg_dump/pg_restore` drill does not prove Production backup restorability.

## 5. Running it and next actions

From a **local clone** with Docker installed and running:

`bash localeats-api/tests/pickup/r34/run-local-pickup-r34.sh`

The script creates and removes a temporary local container automatically. No hosted Supabase access, Supabase CLI login or cloud paid tier is required. On Windows, run it using a Bash environment with Docker Desktop.

The GitHub Actions workflow `.github/workflows/pickup-r34-offline-e2e.yml` runs the same script on the PR's exact commit. A merge may trigger normal Merchant Vercel compilation but does not add any runtime route, feature flag, webhook or payment capability.

**Recommended R3.5:** recover every missing applied pickup migration as reviewed schema-only source, run a complete source-equivalence and restore test in free local Preview, then do carefully controlled **real GUI Preview acceptance** for Customer and Merchant, without risking Production. A separate owner approval is necessary before creating any paid staging resources or making a real order.

**Status:** pickup-only public launch remains a separate previous planning estimate of **~60%** until a fresh end-to-end UI/reliability and security audit. Passing this isolated database test is progress on technical test coverage, not a claim of customer-ready launch.

Reference: <https://supabase.com/docs/guides/local-development/cli-workflows> (Supabase local setup and avoiding remote destructive commands); PostgreSQL 17 transaction semantics <https://www.postgresql.org/docs/17/transaction-iso.html>.
