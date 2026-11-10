# Pickup any-town 4 km — exact Production-function SQL review

Date: 2026-11-07. **NO PRODUCTION OR CONNECTED STAGING APPLICATION APPROVED.**

## Owner decision and current mismatch

The owner confirmed that an approved LocalEats shop is eligible for nearby customer pickup if its **real, validated coordinates are within 4 km of the customer's actual location**, regardless of the shop's `location` town/suburb string. Approved closed shops can be browsed (menu/prices), but only approved, not archived, open shops can accept an order; pickup and pay-at-shop only. No Riders, Delivery or online/subscription billing during launch.

The unmerged API any-town draft [#84](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/pull/84) removes town-name restrictions from discovery and quote. The existing **installed Supabase Production** function `public.pickup_create_order(text,text,jsonb)` still rejects a shop if its `location` field is null or does not match Tembisa/Thembisa/Ivory Park. A quote from the new API could therefore succeed while the final persistence RPC fails.

## What was actually inspected (READ-ONLY)

Connected Supabase Production `phdjumtqkooyppxozqsi` read-only catalog inspection, November 7:

- `pg_proc.prosrc` **5220 characters**, SHA-256 `d876b99ff69718b9aed46ebe4b0f8074eb762454f237728e0f13a5a2b87d0b0d`.
- That source matches *character-for-character* the body already committed in `supabase/drafts/pickup_zero_fee.sql`.
- The function is owned by `postgres`, `SECURITY INVOKER` (not `SECURITY DEFINER`), volatile, with `search_path = ''`; `service_role` can execute, `anon` cannot.
- The existing function checks the authoritative locked shop row for approval, archive and active status; validates real latitude/longitude; rejects distances >4 km; validates genuine menu items/quantities/prices; enforces zero pickup service fee, order idempotency and a corresponding created event.
- One and only one substring comprising the obsolete town-name condition was identified. Removing that line leaves 5076 characters, SHA-256 `d4f2f67aa2ff03120d4de27a4860f56defd770cf3c53016a1759709737da4eb1`, computed **read-only** from the installed source. **No SQL changes were executed against Production.**

## Review-only proposed replacement

The new `security/drafts/pickup_any_town_4km_create_REVIEW_ONLY.sql`:

1. Is intentionally **outside `supabase/migrations`** and not referenced by deployment/CI to a cloud database.
2. Begins a single transaction with 5-second lock/30-second statement timeout.
3. Verifies the **exact installed source hash, owner, SECURITY INVOKER mode, function volatility, pinned empty search_path, anon/authenticated denied and service_role permitted EXECUTE**.
4. Requires the old town-name condition to occur **exactly once**, including whitespace/newline, in `pg_proc.prosrc` and `pg_get_functiondef`.
5. Rebuilds the existing `CREATE OR REPLACE FUNCTION` text from **the installed definition**, removing that single condition. It does not copy or rewrite financial/approval/order checks or privilege statements.
6. Verifies resulting `prosrc` exactly equals the original with only that condition removed, pins the new SHA-256 and rechecks owner/security/grants. Any mismatch raises and rolls back.
7. A second application should **fail** its original baseline hash precondition. This is intentional, not a failure to be skipped.

This is a carefully scoped *candidate*, **not a license to apply it in the real database**. Independently verify a current offsite backup, actual function owner/grants, schema parity and full restore rehearsal immediately before the separately approved release. If Production diverges, stop and prepare a new review; do not weaken the hashes or bypass the checks.

## Disposable PostgreSQL 17 test

`.github/workflows/pickup-any-town-db-rehearsal.yml` uses only a new GitHub Actions `postgres:17-alpine` service, `127.0.0.1`, fixed synthetic database name, and a synthetic password. It refuses cloud URLs. It:

- Builds minimal synthetic tables/roles/accounts/shops/menu and **extracts the exact existing zero-fee function body** from the committed draft; the baseline function SHA must match Production's read-only hash.
- Reproduces original server-only privileges before applying review SQL *only to disposable PG17*.
- Checks successfully persisted R25 pickup orders for shops labelled Cosmo City, Pretoria and a shop with **no town text** when their GPS is within 4 km.
- Checks replay idempotency, cross-customer idempotency conflict, hashes of the full synthetic order and event rows and service-fee=R0.
- Checks denial for >4 km, closed, unapproved, archived and invalid-coordinate shops, and for forged R1 client totals.
- Checks replaying the migration is explicitly rejected on source drift.

**Limitations:** The schema is a minimal synthetic compilation/behavior fixture, **not** an exact complete Supabase Production restore; no real Firebase identities, Customer browser, Merchant workflow, PostgREST/RLS, admin-approved shop or actual cloud service is exercised. We cannot assert live compatibility from CI alone.

## Release gating order

1. Independently review this PR and related API [#84](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/pull/84) stacked on closed-browse [#82](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/pull/82) plus Customer closed-browse [#74](https://github.com/mehey9184-maker/LocalEats-app/pull/74).
2. Verify deployed Firebase **named** database rules and Supabase signup-role + Rider GRANT hardening (separate P0 issues). Keep all public ordering flags off.
3. Rehearse the approved SQL against a **fully schema-faithful, isolated Supabase/PostgreSQL restore**, including old permission metadata and API two-account authenticated staging tests. No copying customer personal information into GitHub.
4. Only with a fresh, explicit owner decision, make a reversible staged deployment plan covering API/Customer compatibility, staging to Production, fallback behavior and independent rollback.
5. After separately approved launch, monitor Customer discovery/quote/create consistency, merchant order inbox, Ready push/receipt recovery, duplicate order prevention, closure and support flows.

**No Production/staging DB writes, merged PRs, real orders, billing, Riders/Delivery, deployments, or hosting purchases in this PR.**

The guarded check rejects a missing function search_path as well as an unexpected setting. Run the exact review SQL from the Git LF bytes. A Windows CRLF copy can cause the one-line guard to fail closed, as observed in the local rehearsal. The LF copy passed the PostgreSQL 17 authority and radius assertions, and rejected repeat application. Do not bypass a hash or guard failure.

Rollback rehearsal: capture the current function definition and its owner, grants, configuration and security mode before the cutover. The isolated workflow restores that captured definition in a single transaction after checking the exact forward hash. It requires the original hash afterward and compares ownership, permissions and hashes of the full synthetic order and event rows. Production rollback would first disable pickup writes and requires its own approval.
