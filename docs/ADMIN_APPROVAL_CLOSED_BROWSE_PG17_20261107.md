# LocalEats shop approval → closed browse → merchant activation: isolated audit
Date: 2026-11-07 | **REVIEW ONLY**, no actual Supabase write, live signup, shop approval or deployment.

## What is established

- The separate Super Admin frontend uses Firebase authentication, verifies an active super-admin via `/api/v1/admin/me` and performs shop approval actions through the central API, not direct browser SQL.
- The API shop-approval route calls `transition_shop_approval` with the **authenticated** Firebase UID and the expected current shop state, preventing stale transitions from silently succeeding.
- Actual archived Phase4G approval SQL is `supabase/archived-migrations/20260902234040_phase4g_admin_approval_foundation.sql`. It logs transitions in `shop_approval_events`, leaves newly approved/reinstated shops **inactive** until separately opened, and forces rejected/suspended shops inactive.
- Customer `/api/v1/catalog/shops` returns approved nonarchived shops, including closed ones. But Customer's actual nearby `/api/v1/catalog/pickup-shops` + mapper currently hide approved closed shops. This has a coordinated, unmerged API+Customer draft: Merchant/API #82 and Customer #74.
- Read-only Production aggregate from 2026-11-07: 9 approved test shops (6 stored active, 3 inactive), 8 shop approval audit events, and 1 active super-admin account. These figures do not validate actual hosted approval/merchant browser integration, nor should they be used to infer billing trial start.
- **There is no existing trusted `trading_started_at` field on `shops`** in the inspected Production column list. Therefore merchant three-month free period cannot safely start from an approval timestamp or today's test shop flags. Subscription billing stays off.

## New disposable PostgreSQL 17 rehearsal

The workflow `.github/workflows/superadmin-shop-approval-pg17.yml` starts a local-only synthetic DB, creates minimal `shops`, `anon`, `authenticated`, and `service_role` roles and runs the actual **archived** Phase4G SQL (unaltered). No cloud credentials or production data are required.

`tests/security/shop_approval_pilot_assertions.sql` tests:
1. `anon` and `authenticated` cannot call the approval RPC, while `service_role` can.
2. Newly submitted pending owner shop is excluded from the approved public catalog predicate.
3. Verified active super-admin can approve a pending shop, yet it remains **closed**.
4. A stale repeat approve cannot add an extra approval-history row.
5. An inactive or unprovisioned admin cannot approve, and archived shops cannot be approved.
6. Rejection/suspension require reasons and force the shop closed; reinstatement and reapproval preserve closed status.
7. The approval audit records only the trusted acting admin UID; approved catalog-eligible shops can remain closed, with zero orderable shops automatically activated.

**These are actual SQL executions in a synthetic database, not complete hosted API/browser integration.** In particular, the merchant availability API RPC `merchant_set_availability`, the live database's full roles/ACL objects, customer geolocation, and Firebase Auth identity services are not recreated here. A green CI test does not prove all staging endpoints work.

## Required next phase — hosted isolated staging

Test the full three-app sequence with disposable, authenticated test identities and a schema-faithful isolated DB:
1. Merchant applies and sees pending state; Customer cannot browse pending.
2. Verified super-admin approves in Super Admin. Database audit actor, timing, and status must be correct; shop must remain not accepting orders.
3. Customer can browse the approved **closed** shop and its real menu if within the approved 4 km pilot, but cannot add or submit.
4. Authorized merchant opens through `merchant_set_availability` with expected revision and confirmed persistence, not a client-side `is_active` overwrite. Only then can the customer obtain a valid pickup quote. Unapproved/suspended/archive checks must remain enforced.
5. Disable and suspend the shop; Customer should retain approved inactive browse where policy permits but no checkout; suspended shops must disappear from catalog entirely.
6. Manual two-device testing must verify stale caches/refreshes, zero fabricated orders, actor attribution and no unintended FCM sends.

The server currently hard-codes Tembisa/Thembisa/Ivory Park plus a 4 km radius; do not change launch geography until owner explicitly chooses. Three-month free subscription period begins only once an **approved shop actually trades**, after an auditable server-side event—not at test approval.

## Safety

This PR is a **nondeployable isolated test**. No change to app logic, Production schema, active SQL migrations, Admin UI, feature flags, shop data, Rider/Delivery, payments, paid subscriptions or hosting. All GitHub drafts remain unmerged. SQL CI must actually pass before calling the rehearsal complete.

Related: [main launch gate #73](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/issues/73), [Super-LocalAdmin review PR #2](https://github.com/mehey9184-maker/Super-LocalAdmin/pull/2), [API closed-browse draft #82](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/pull/82), [Customer closed-browse draft #74](https://github.com/mehey9184-maker/LocalEats-app/pull/74).
