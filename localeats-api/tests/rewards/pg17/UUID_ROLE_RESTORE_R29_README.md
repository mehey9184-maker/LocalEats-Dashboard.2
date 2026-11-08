# LocalEats Rewards R2.9 — UUID source integrity, role authorization, SERIALIZABLE recovery and rollback plan

**Status: isolated architecture/test rehearsal only (7 November 2026). NOT a Supabase migration, API route, real order integration or financial activation.**

### 1. Why R2.9 is necessary

R2.7 read-only metadata established the actual deployed LocalEats pickup order contract: **orders.id UUID, shops.id TEXT, orders.shop_id TEXT, orders.user_id TEXT (Firebase UID), pickup_order_events.order_id UUID, command_id UUID, revision BIGINT**, with server-only pickup command functions. The R2.8 private Rewards ledger used TEXT order IDs to simplify its first accounting rehearsal. Applying that scratch DDL to Production would break referential integrity. This phase reproduces the observed **column types, not the complete deployed DDL** in two new scratch-only schemas:

- `r29_source`: synthetic, reduced pickup tables with UUID order/command IDs, text shop and customer identities, numeric food price, JSONB original items, payment/collection command revisions, original intent hash and a registered/test-origin registry.
- `r29_private`: future-proofed purchase snapshots with a **composite foreign key (order UUID, shop TEXT, customer Firebase UID)** to a trusted source order; line price in integer cents, menu rule revision, original eligibility, one-time credits and Bronze commitments, immutable audits and a separate isolated concurrency budget.

The real Production service is **not attached** and no connected database query or migration occurs in this phase. Values are fabricated by deterministic SQL fixtures. All new SQL has `SYNTHETIC_ONLY` in the filename and is excluded from Supabase migration directories.

### 2. What the new PostgreSQL tests demonstrate

**Pickup is the priority even with Rewards OFF.** A valid pickup order is created without a Rewards snapshot if the programme is disabled or if the customer/shop lacks eligibility. When Rewards turns on later, historic orders still have no snapshot and cannot retroactively claim a free kota. An eligible future checkout creates the source order and immutable snapshot in **the same SQL function/transaction**. If the second item is missing or a payload tries to insert its own prices/qualification flags, the entire transaction rolls back; no orphaned source order or partial Rewards snapshot remains.

**Identity and foreign key security.** A snapshot's UUID must reference an existing pickup order and its *same* text customer and shop; mismatched or orphaned references fail. Original item price, menu revision and qualifying status cannot be altered by future merchant edits. Pending/unpaid order status alone is insufficient; a revised, persisted synthetic payment-confirmed + collected event pair and collected/paid pickup row are required. Duplicate order-intent and credit retries are idempotent.

**Real database roles, not just inspection.** New scratch non-login roles `r29_browser` and `r29_observer` are exercised under actual `SET ROLE`. Browser has no schema/table/function access. Observer can read only an inert 'not-live' `security_invoker` view; direct purchase-line SELECT, accounting UPDATE and credit-function EXECUTE are denied. RLS and **FORCE RLS** apply to each scratch table, private financial functions use `SECURITY INVOKER` and pinned `search_path=pg_catalog`, and `PUBLIC` grants are revoked. This does **not** prove future API service-role privilege separation, which still needs independent review.

**Transaction retries, separate sessions.** Two PostgreSQL clients begin `SERIALIZABLE` transactions against one funded synthetic row. Exactly one can commit the final R25; the loser sees a serialization failure, retries under a new snapshot, and cannot allocate the already-reserved funds. SQL tests also verify an explicit failed preview-DDL transaction leaves no object behind, and that a `pg_dump` of the scratch UUID/source + private schemas restores into a **new database inside the same disposable Docker container** with referential integrity, grant restrictions and source/credit/budget counts intact.

**Scope limitation:** R2.9's UUID bridge proves a **Bronze-only source compatibility and fail-closed isolation scenario**. Earlier R2.8 tests remain responsible for full Bronze/Silver/Gold milestone and merchant handover accounting; R2.3 tests remain responsible for refund holds and payments. This fixture does NOT approve new customer-facing rewards or settle any merchant debt.

### 3. Future real implementation rules — no migration authorized

1. **Get owner approval first** for campaign budget, caps, tier thresholds, participating shops, merchant refund/appeal policy, and a non-retroactive start date. Current R125 Silver and R200 Gold cap remain working proposals. The source-event process and genuine pay-at-shop evidence must receive security review.
2. **Create a genuine separate pickup-capable staging environment** with the *current deployed* pickup migrations reconstructed and a verified encrypted backup/restore. The connected profile-only staging is not a pickup staging database. Do not copy real customers/orders into tests without an approved data-protection plan. Current R2.9 Docker fixtures are the only data under test.
3. Compare the real schema's UUID/type/constraint/policy manifest against the migration *at execution time*, not only the November 7 snapshot. Ensure the Rewards schema is private and absent from PostgREST exposed schemas. Add restrictive roles/privileges with a server-owned, least-privilege and independently audited transaction executor. **A bare SECURITY INVOKER function with broad direct table write grants is insufficient** to prevent a compromised caller forging credits, so design an explicit trusted server boundary and reject arbitrary identity values.
4. Within the actual guarded `pickup_create_order` transaction, **only after programme approval and activation**, add immutable purchase-time eligibility proof written atomically with the ordinary pickup order, using menu source prices and server-approved rule version. Failure must never make pickup itself unavailable: use an explicit rollout invariant, audited transaction design and backup/restore acceptance. The testing fixture's internal writer is **not** that implementation.
5. On verified paid-and-collected pickup, reconcile exactly once with order revision/command IDs, protected budget, separate refund hold logic, idempotent server keys and durable audit/outbox. All retrying financial commands must reopen a new SQL transaction on SQLSTATE 40001/40P01, with bounded retries and post-retry source/role/budget revalidation.
6. Merchant liability appears only after independently verified food handover. Keep ledger records append-only, never silently retract actual food debt on customer refund. Bank transfer references and a merchant's receipt/dispute are separate evidence; **no automatic bank payment**.
7. Run separate security approval of Firebase token revocation, current merchant owner, active Super Admin and untrusted-client Data API restrictions. The R2.7 findings about a broad `public.payments` authenticated policy and public custom `SECURITY DEFINER` functions remain open as **core launch security triage**, not fixed by R2.9.

### 4. Proposed reversible rollout/rollback protocol (DOCUMENTATION ONLY)

**Preflight:** Revalidate exact schema hash/column types, unique constraints, RLS/policies, secret/role provenance, funding limits, API write gates and existing migration history. Capture a tested restore point *before* staging migration and record the exact migration/rollback dependencies. Require owner and security approval. All user-facing Rewards switches default OFF, and no backfill or old-order credits.

**Staged rollout:** Apply a newly generated, separately reviewed migration **only to an owner-approved dedicated pickup staging clone**, not the current main database. Test full pickup checkout/order receipt/notification with Rewards OFF; then opt into controlled synthetic Rewards scenarios while any real customer/order/payout writes stay blocked. Recheck the Supabase Data API for absence of client-accessible financial tables, views, or mutation functions.

**Rollback:** First turn Rewards earn/redeem/bank workflows OFF without turning off pickup. If no real financial obligations were ever created, revert the explicitly approved additive schema via a tested staging procedure. If *any* grant, refund hold, merchant payable or transfer evidence exists, **never DROP the ledger as a quick rollback**. Preserve auditable history and reserve/settle obligations through a separately approved reconciliation and archival plan. A failed migration must leave pickup running with no partial Rewards state. Test automatic transaction rollback and manually verified backup restore in staging before production approval.

**Go-live gate:** Dedicated owner sign-off for exact schema/migration, real payment/collection evidence, refund provenance, grant budget liability, bank settlement controls, least-privilege role verification, restore drill, tax/accounting review and customer-facing terms. No public/Production Rewards activation merely because this SQL lab passes.

### 5. Exact SQL tests and limitations

Files `compat-r29.SYNTHETIC_ONLY.sql` and `compat-r29-assertions.SYNTHETIC_ONLY.sql` are loaded by the existing isolated PG17 runner after all R2.2–R2.8 tests. The runner additionally exercises actual SET ROLE access denial, simultaneous SERIALIZABLE reads/conflicts, post-conflict retry, source/financial reconciliation, transaction rollback, and dump/restore in the disposable Docker container. No JWT is verified and no real refund, bank transfer, merchant receipt or owner funding is performed.

A PostgreSQL superuser still runs the synthetic command writers; this cannot establish Production authorization. A screenshot of 'green CI' is **not** permission to migrate R2.8/R2.9 scripts. This test is not a deployable Supabase backend.

Reference: [Supabase Data API securing](https://supabase.com/docs/guides/api/securing-your-api), [PostgreSQL 17 Serializable Isolation](https://www.postgresql.org/docs/17/transaction-iso.html), [PostgreSQL 17 explicit locking](https://www.postgresql.org/docs/17/explicit-locking.html), and [PostgreSQL backup and restore](https://www.postgresql.org/docs/17/backup-dump.html).

**Next phase R3.0:** Review the security design and requirements for a **least-privileged private transaction executor** and a separately authorized, real pickup-capable staging environment. Do not create paid resources or apply a migration without new owner approval. Public pickup launch remains a separate track.
