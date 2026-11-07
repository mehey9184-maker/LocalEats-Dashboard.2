# LocalEats Rewards R2.7 — Read-only real schema compatibility and security audit

**Audit:** 7 November 2026, connected main PostgreSQL 17 and separate profile-only staging. Verified with Supabase read-only list_tables, list_migrations, pg_catalog SELECT and security advisors, plus Merchant/API main commit 82328e5. **No user rows, private records, keys, DDL, mutations, migrations or billed branches accessed or created.**

**Decision: BLOCK REAL REWARDS ACTIVATION.** This audit is a preflight and not a request to deploy SQL or enable customer earning, bank transfers, orders, Rider/Delivery or subscriptions.

## 1. Real projects inspected

The main LocalEats PostgreSQL 17 database has public orders, pickup_order_events, shops, menu_items, profiles, admin_users, payments, and no deployed Rewards ledger schema. The separate LocalEats-Profile-Staging PostgreSQL 17 database currently has only its isolated profiles table. **It cannot act as a pickup/Rewards staging system.** No changes were performed in either project.

Repository main has four September SQL migrations under supabase/migrations, but the connected main database migration inventory also lists four later October/November pickup migrations. Some relevant SQL exists under supabase/drafts. This is a **schema reproducibility/restore review item**, not proof of corruption or authority to reapply any migration. Coordinate with Codex.

## 2. Real schema compatibility

| Requirement | Actual database evidence | Assessment |
|---|---|---|
| Pickup order identity and state | public.orders: id, shop_id, user_id, items JSONB, status, payment_status, delivery_type, intent hash and revision | Good foundation. Several pickup CHECK constraints are NOT VALID for historical rows, so old orders cannot automatically qualify for Rewards |
| Paid-and-collected command sequence | public.pickup_order_events: command_id, revision, actor_uid, kind, occurred_at, details | Good foundation. UNIQUE constraints on order+command, order+kind, order+revision; trigger guarding event modification |
| Pickup server command safety | pickup_create_order and pickup_order_command are SECURITY INVOKER; anon and authenticated have no EXECUTE privilege | Good existing server-owned boundary; do not open them to client-supplied Rewards facts |
| Merchant authority | public.shops: owner_id (nullable), approval_status | Need a verified owner at the time of financial action, including transferred shops |
| Merchant menu | public.menu_items: price, is_available, category; no Rewards rule revision | Current menu cannot establish what qualified for Rewards on a historic order |
| Real customer | public.profiles has user_id, role and RLS enabled with no policy | Must separately verify Firebase registration, guest exclusion, real order provenance and no test/simulated checkout |
| Immutable Rewards eligibility at checkout | No purchase-line Rewards snapshot or programme version found | **Blocking** |
| Reward campaign funding/participation | No owner-funded programme/version/approval snapshot found | **Blocking** |
| Loyalty accounting | No private Rewards credit, progress, grants, payables, transfer, refund-hold or audit ledger | **Blocking** |
| Refund proof | No verified independent merchant/admin pay-at-shop refund evidence established | **Blocking** |

Order origin in the live schema lacks explicit R2.4 test_record and simulated_checkout columns. A future integration could derive the same truth from a separately verified, immutable server event; **do not add fields just to satisfy a draft TypeScript interface**. Older orders must not earn retroactive promises.

## 3. Production permission findings — review, not exploitation claims

**HIGH — public.payments:** RLS is enabled, but the policy named **Payments access** grants command ALL to authenticated, USING (true), WITH CHECK (true). The authenticated database role also has table-level SELECT/INSERT/UPDATE grants. There is no per-user or per-shop predicate in that policy. It could allow cross-tenant access **where a client has a valid Supabase-authenticated JWT and the table is exposed in the Data API**; no exploit has been demonstrated. The table is not needed for the pickup pay-at-shop MVP, but review its actual use and stage a tested reversible remediation before public launch. **Do not change Production in this PR.**

**HIGH/REVIEW — publicly callable business SECURITY DEFINER functions:** Custom public.handle_new_user(), public.nudge_rider(...), public.nudge_rider_by_id(...) and public.rls_auto_enable() can be executed by anon and authenticated. handle_new_user has no fixed search_path. Check whether they are trigger-only functions and preserve signup behavior during any safe grant/revoke or hardening. Do not silently switch modes or revoke privileges without a test plan. Three additional extension-owned PostGIS st_estimatedextent overloads were also reported; investigate separately rather than altering extension internals.

**CONTEXT:** Advisor finds public.spatial_ref_sys without RLS and postgis extension in public; these are extension-related and not automatically fixable within the Rewards scope. Other RLS-enabled tables, including orders and pickup_order_events, have **no direct client policies**, consistent with a deny-by-default service-only design. Missing policies are not automatically a security defect.

**POSITIVE:** The important pickup stored procedures are SECURITY INVOKER and private to service use. The orders and pickup events have dedicated data guards and uniqueness. Preserve those controls.

## 4. Proposed architecture for later approval (not a migration)

1. Agree owner budget, per-tier caps, enrolled-shop terms, eligible standard kota definition, customer refund/appeal rules, and a strictly non-retroactive start date.
2. Design an **unexposed private** schema for immutable programme versions, enrolments, purchase-line snapshots, unique credits, rank progress, budget reservations and grants, handovers, merchant payables, external transfer proof, independently reviewed refunds, holds and append-only audits. Table names in the adjacent audit code are **illustrative only**.
3. Record the per-line eligibility proof **within the authoritative order-create PostgreSQL transaction**, not by a second independently committed HTTP request or today's changing menu. A customer or merchant must never supply price, qualifying flag, shop approval or user role.
4. After actual paid-and-collected handover, use one locked/idempotent SQL transaction for all qualifying lines, budget admission and entitlement reservations. Reconcile refunds as separate immutable events and do not erase debt for food already handed over.
5. Authenticate finance actors with a revocation-checked Firebase ID token and independently verify active Super Admin or current shop ownership. Do not trust user_metadata, browser-provided Firebase UIDs or broad authenticated role grants. Keep bank proof and recipient confirmation separate.
6. Build and test the adapter with disposable PostgreSQL 17 and two-session race tests; demonstrate denied public access, backup/restore, and migration replay. A private Supabase schema must not be exposed to the Data API.
7. Require independent security/accounting review and explicit owner approval before *any* real migration, customer-facing Rewards promise or production activation.

## 5. Repeatable verification and limitations

The adjacent R27_READ_ONLY_METADATA_PROBES.sql contains only pg_catalog SELECT queries. An authorized reviewer can repeat them on the **chosen** database without accessing customer order rows. The pure schemaCompatibilityAudit.ts and its tests use a **dated sanitized snapshot** of the real metadata and flag missing private Rewards sources, broad payments access and publicly executable custom definer functions.

These tests check the **audit detector**, not live SQL transaction correctness, payment security, or RLS through actual tokens. Even when a future private schema passes the structural checker, productionActivationAllowed remains false. A real staging copy of pickup data does not yet exist in the connected profile-staging project, and no new project/branch was created.

Supabase review links:
- [Exposing tables to Data API](https://supabase.com/docs/guides/api/securing-your-api)
- [Row level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Anonymous SECURITY DEFINER advisory](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
- [Mutable function search_path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)

Codex issue #73 includes the security triage handoff. Pickup-only public launch remains separate; no completion percentage should be raised solely because this audit passed.
