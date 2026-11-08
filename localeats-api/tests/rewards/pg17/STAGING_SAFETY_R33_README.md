# LocalEats Rewards R3.3 — Pickup-Compatible Staging Preflight and Safe Migration Rehearsal

**8 November 2026. STATUS: offline design/test only. NOT approved for hosted Supabase, a database migration, live Rewards, or new paid resources.**

This phase provides an **isolated PostgreSQL 17 contract-drift, access-denial, transaction rollback and dump/restore rehearsal**. The SQL filename is `staging-r33.SYNTHETIC_ONLY.sql` and is loaded only by the existing disposable CI Docker test harness. The test database contains fabricated shop/customer/order/payment data; no actual user data, Supabase secrets, Vercel production env variables, Firebase project or connected database backup is used.

## 1. What we verified against the actual connected pickup Production database

The following findings come from **read-only PostgreSQL catalog metadata**, not test assumptions:

| Object | Relevant actual type/constraint |
|---|---|
| `public.orders.id` | `uuid`, primary key |
| `public.orders.shop_id`, `user_id` | `text` (shop non-null; customer nullable) |
| `public.orders.items` | `jsonb` |
| `public.orders.create_intent_hash` | `text` (nullable) |
| `public.orders.revision` | `bigint` |
| `public.pickup_order_events.id`, `order_id`, `command_id` | `uuid` |
| `public.pickup_order_events.revision` | `bigint` |
| `public.pickup_order_events.command_hash`, `actor_uid`, `kind` | `text` |
| `public.shops.id`, `owner_id` | `text` |
| `public.menu_items.id`, `shop_id` | `text`; `price` is `numeric` |
| `public.pickup_order_events` | Unique `(order_id,command_id)`, `(order_id,revision)`, `(order_id,kind)` |
| `public.pickup_order_command` | SECURITY INVOKER; no `anon` or `authenticated` EXECUTE grant; order UPDATE precedes event INSERT inside one command transaction |

Catalog checks also showed RLS enabled, but **not FORCE RLS**, on the selected real `public` tables; this is an observation, not a recommendation to blindly change Production. We inspected metadata only and made **no hosted database writes**.

The connected migration history reports `pickup_launch_foundation` (20261030111305), `pickup_zero_fee` (20261031073608), `merchant_availability` (20261031073645) and `pickup_payment_methods` (20261101160331) among other older migrations. **Migration names and metadata alone do NOT guarantee that the full applied DDL can be recreated from checked-in source**. That reproducibility remains an explicit blocker.

## 2. What this disposable PostgreSQL test proves

`r33_source` intentionally models **only** the minimum verified type contract for shops, pickup orders and persisted command events, including command uniqueness and order/shop/customer identity. It is NOT a complete copy of Production's tables, RLS policies, triggers, functions, storage or auth.

`r33_private` models a future **disabled-by-default**, unfunded private programme and additive evidence/financial domain: checkout snapshots, purchase lines with integer-minor-unit original menu price and eligibility revision, source-order-coupled outbox, obligations, immutable audit. All source/ledger IDs are synthetic.

The test executes:
- **Schema preflight:** a SQL manifest of essential column names/types and command uniqueness constraints. It intentionally corrupts one expected type and inserts a missing column declaration, and proves the preflight fails closed. A green lab run does not replace an execution-time real catalog comparison.
- **Private access:** no PUBLIC grants; synthetic browser and worker roles are NOLOGIN, non-superuser, NOBYPASSRLS and cannot use private schemas, query tables or execute private functions. Every scratch relation has RLS and FORCE RLS; finance functions are SECURITY INVOKER with a pinned PostgreSQL search_path.
- **Referential integrity:** snapshots use composite `(order_uuid,shop_id_text,customer_uid_text)` foreign keys, and outbox source event pointers must match **the same order UUID**. A forged cross-customer/shop or cross-order event fails the database transaction.
- **Immutable history:** the purchase-time snapshot, original line eligibility and audit reject UPDATE/DELETE. The test intentionally seeds a fictitious R25 liability to prove that a rollback guard **must not permit dropping a ledger with existing obligations**.
- **Rollback and restore:** a deliberately aborted scratch transaction does not leave newly created tables or change source/financial counts. A **pg_dump -Fc** of only these synthetic schemas is restored into a **brand-new disposable database in the same container**, then order/line/obligation counts, source-event referential integrity, programme status, restrictive privileges and RLS are checked. The restored test database is deleted with the CI container. This is **not** proof that a hosted Supabase backup could be restored successfully.

**Important distinction:** The example private snapshot is populated by the isolated PostgreSQL test owner solely to exercise recovery gates while the programme is inactive. It is NOT a proposed backend shortcut that permits earning historical rewards. Real snapshots would be captured only by the authoritative future checkout transaction, after new owner approval.

## 3. Minimum-cost staging proposal — NOT created

**Recommended $0-recurring-cost first stage: a local/disposable PostgreSQL 17 container** with a reproducible checked-in **schema-only** pickup DDL export, generated from an approved snapshot of the current deployed structure and reviewed for secrets or private data. That can establish database compatibility without exposing or modifying a hosted environment. If Supabase Auth/Storage/Realtime behavior becomes necessary, use the Supabase CLI's local stack if the developer can run Docker and disk/memory requirements fit. Do not assume GitHub CI or the profile-only Supabase staging project is a full replacement for production pickup contracts.

Do **not** create a paid Supabase branch, clone actual user/customer data into Preview, add payment methods or enable Rewards as part of this phase. If a true second hosted pickup-capable staging project is later necessary, first obtain explicit owner approval of price/free-tier limits, project/region, auth separation, who can access data, cleanup date and resource budget. Existing profile-only staging is **not** a pickup test environment.

## 4. Staging and migration approval gates for future R3.4

1. **Baseline and drift:** export/restore the exact effective pickup table/functions/triggers/constraints/indexes/RLS/policies and migration history into an **offline isolated** environment. Confirm `pickup_create_order`, `pickup_order_command`, command hash/revision uniqueness, cashier payment method, manual pickup and push outbox remain behaviorally equivalent; reject any unexpected schema drift.
2. **No real user data:** generate only synthetic shops, customers and paid-at-shop pickup orders. Never copy Firebase IDs/tokens, customer locations, real purchases, or service-role secrets into CI logs or new staging.
3. **Privileged execution:** audit schema exposure to Supabase Data API, EXECUTE grants, NOLOGIN owner with narrow rights, separate authenticated API/worker credentials, Firebase Admin revocation and refresh, nonce/replay fencing, merchant ownership changes, Super Admin approval and transaction-order source rechecks.
4. **Owner money terms:** finalize maximum reward caps, funded campaign ceiling, eligibility and opt-in start date, customer refund/dispute handling, independent merchant reimbursement/transfer proof and manual settlement accounting. R125 Silver and R200 Gold remain **proposals**, not customer promises.
5. **Backup and zero-loss rollback:** prove migration preflight and restored baseline in disposable tests. In a future approved staging database, take a verified encrypted backup/restore point, test additive migration idempotence and rollback **before any actual credit**. Once grants, refunds, merchant payables or transfers exist, disable new Rewards processing first and **preserve history rather than DROP financial tables**; reconcile obligations independently.
6. **Pickup-first release gate:** pickup ordering, pay-at-shop, accepting, preparing, ready, collected, customer/merchant notifications, outages and retry recovery must still pass with Rewards OFF. No rider/delivery, no online payments and no real financial writes from tests.
7. **Core launch security is separate:** R2.7 previously flagged permissive authenticated `public.payments` policies and anonymously executable custom SECURITY DEFINER functions. Confirm their status through a specific pickup security review; R3.3 makes no changes to those policies.

**R3.3 completion means staging architecture and migration safeguards are rehearsed. It does not mean that a real staging environment or a live Rewards service exists.**

References: [Supabase managing environments](https://supabase.com/docs/guides/deployment/managing-environments), [Supabase local development](https://supabase.com/docs/guides/local-development/cli-workflows), [Supabase Data API security](https://supabase.com/docs/guides/api/securing-your-api), [PostgreSQL 17 backup/restore](https://www.postgresql.org/docs/17/backup-dump.html).
