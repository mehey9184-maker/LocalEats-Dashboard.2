# LocalEats R5.2O — Schema Approval A execution evidence (2026-11-09)

## Decision and scope

**Owner expressly approved Schema Approval A** for Supabase `LocalEats-Profile-Staging` only, accepting that full Supabase Auth/Storage/application-migration-history recovery had not been independently verified. The approval did **not** authorize production, fixtures, staged identities, any ordering, payment, rewards credit, Vercel production deployment, GitHub merge or live promotion.

- **ONLY destination:** `rgpbdajhlrwfmhopzgzk`, Supabase project name `LocalEats-Profile-Staging`, region `eu-west-1`, PostgreSQL `17.11.0.011`.
- **Exact reviewed source:** draft PR #127, `supabase/drafts/r52k_catalogue_staging_REVIEW_ONLY.sql` at branch `review/r52k-staging-catalogue-migration-20261109`; GitHub blob SHA `af01f5c5d650c6caa61811f94f36d7dc7cfcbe12` (9,163 characters).
- **Execution route:** Supabase connected `apply_migration` against the explicit staging project ID. Provided the script's documented per-session `localeats.r52k_owner_approval` guard value and left its SQL body intact. The migration action responded `{"success":true}`.
- **New tracked migration:** `20261109165612` / `r52o_isolated_staging_catalogue_schema_approval_a`. Pre-existing `20261103140914` / `create_isolated_profile_staging_p5` retained.

## Preflight: PASS (read-only)

Immediately before executing the source reviewed migration, the connector read-only preflight returned `PRECHECK_PASS`. Confirmed project identity via `get_project`, one original migration, original P5 profile comment, PostgreSQL 17, profiles empty, source RLS/FORCE RLS protected, anon/authenticated SELECT denied, service_role SELECT allowed, no existing shops, menus or catalogue view, zero Auth users and zero Storage objects.

## Post-apply: PASS (read-only)

Read-only metadata query and Supabase table/migration listing verified:

| Expected staging result | Observed |
| --- | --- |
| Original `public.profiles` preserved | yes, still zero rows, FORCE RLS + RLS both enabled |
| `public.shops` exists | yes |
| `public.menu_items` exists | yes |
| `public.shops_with_availability` exists | yes |
| Shop rows / menu rows / view rows | **0 / 0 / 0** |
| RLS on shops and menus | true / true |
| Policies on shops and menus | **0** |
| View `security_invoker` | `true` |
| `anon` and `authenticated` SELECT on shops/view | denied |
| `service_role` SELECT on shops, menus, view | granted |
| `service_role` INSERT/UPDATE/DELETE on shops, INSERT/UPDATE on menus | denied |
| Shop availability-revision trigger | present (one) |
| Staging migration ledger count | **2**, including original P5 migration |
| Public tables | only profiles, shops, menu_items |

**Real staging API read tests using authenticated Vercel project access (not simulated):**

- `GET https://localeats-api-staging-r52d-mehey9184-makers-projects.vercel.app/api/v1/catalog/shops` → HTTP **200** and JSON `{"success":true,"shops":[]}`.
- `GET https://localeats-api-staging-r52d-mehey9184-makers-projects.vercel.app/api/v1/catalog/pickup-shops?lat=-26.0000&lng=28.0000` → HTTP **200** and JSON `{"success":true,"shops":[]}`.
- Existing API deployment `dpl_3iuTisu3ErPEivYhhaH8ov9MQJbr` remained **READY**, target `staging`. No new Vercel deployment was made.

## Post-migration security advisor — reviewed

Supabase Security Advisor returned one **INFO** lint group, `rls_enabled_no_policy`, listing `public.profiles`, `public.shops`, and `public.menu_items` (count 3). This is **expected for the current server-only design**: RLS enabled, no browser-facing policies, explicit `anon`/`authenticated` direct SELECT denied, only backend service role SELECT. Do not add permissive RLS policies to silence the lint. Reference: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

Additional live metadata checks passed: `anon` and `authenticated` both denied SELECT on `menu_items`, `service_role` denied DELETE on menu, `anon` denied EXECUTE on the two catalogue functions and revision trigger function, `service_role` allowed EXECUTE on the expected safe availability function. All three public application tables still have zero rows.

## Independent scope boundaries and remaining risks

**Schema Approval A = COMPLETE.** This deliberately creates empty synthetic-only constrained catalogue tables/view; the API empty reads are expected until test fixtures are separately approved.

**Still NOT proven:** complete Supabase project recovery from the owner's backed-up exports; preservation/recovery of hosted Auth/Storage managed migration tables and original `supabase_migrations.schema_migrations` from a clean restore; real customer/merchant identity/permissions; actual menu visibility with fictional shop fixtures; pickup order state machine on hosted staging; pilot financial evidence and reimbursement; full browser acceptance; Production backup; real ordering or Rewards.

The owner reported and tested encrypted `.7z` copies and separately uploaded/stored them, but provider ACL/durability and archived files' full restore were not independently verified. The recovery risk was disclosed and the owner approved **isolated staging schema only** under that limitation.

**Next separate gate: Fixture Approval B**, covering only optional fictional staging test-shop/menu inserts from `supabase/drafts/r52k_catalogue_fixture_SYNTHETIC_ONLY.sql`; do not run without distinct owner authorization. Identity Approval C and any pickup write gate/Production/Rewards activation are **not** approved.

**No Production change; no merge; no new real ordering, rider or rewards activation.**
