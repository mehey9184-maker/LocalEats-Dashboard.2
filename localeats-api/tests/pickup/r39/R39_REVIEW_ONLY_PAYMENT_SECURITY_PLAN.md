# LocalEats R3.9 — Payment-table permission remediation: review-only plan

**Status:** Draft for review, **NOT an approved or deployable Production migration**. 8 November 2026. Pickup-only, pay at shop. No online payments, rider dispatch, delivery, Rewards awards, subscriptions or payouts activated.

## Why this is now the highest security priority

A READ-ONLY Supabase catalog audit of the primary pickup database found `public.payments` has **RLS enabled**, but its policy `Payments access` applies `ALL TO authenticated USING (true) WITH CHECK (true)`. The `authenticated` and `anon` roles also hold SELECT/INSERT/UPDATE/DELETE table privileges, although the `anon` role has no current permitting RLS policy. Any client holding *valid Supabase authenticated role access* may consequently have cross-shop payment-row permissions regardless of ownership. No actual payment row was queried or changed to test this.

R3.8 proved the broad policy unsafe using synthetic data. R3.9 adds an exact source-controlled, review-only **SQL template** with:
- guard requiring existing `Payments access` policy to match the reviewed `ALL/true/true` pattern and `public.payments` RLS to be enabled;
- guard verifying backend reader retains SELECT and no **additional** browser-public payment policy has appeared;
- a short lock timeout, one transaction, revocation of client/PUBLIC table permissions and removal of the broad policy;
- postconditions that anon/authenticated have NO payments table privileges and service reader still has SELECT.

The SQL is a `.REVIEW_ONLY.sql.txt` template with `__SCHEMA__` and role placeholders, stored under tests rather than `supabase/migrations`. It CANNOT run verbatim. **Do not substitute and run it against connected Supabase now.** The tests substitute only scratch schema/roles `r38_lab`, `r38_authenticated`, `r38_anon`, `r38_backend` in an isolated Docker PostgreSQL 17 container.

## R3.9 isolated safety checks

The CI runner:
1. Creates only synthetic legacy payment records for fake shops 101 and 202, total 4,250 synthetic currency units; never copies a real payment or client.
2. Modifies the synthetic policy to `false/false` and proves the SQL template **fails closed on drift** without changing any synthetic rows or original table grants.
3. Restores the fake legacy `true/true` policy; applies the **exact** review template to the disposable database; checks browser SELECT, INSERT, UPDATE and DELETE grants have been removed, while a distinct backend role can still SELECT.
4. Uses `SET SESSION AUTHORIZATION` to prove a client cannot read or update payment records or impersonate the backend role—avoiding superuser `SET ROLE` false positives.
5. Proves a second application fails rather than claiming idempotency.
6. Exports a **schema-only** archive into another disposable database; confirms no data and the client/backend privileges remain correctly restricted after restore.
7. Destroys all local databases, roles and data with the Docker container. No hosted DB credentials/ports/remote migrations are used.

**What passes:** the proposed permission boundary on synthetic database objects and error behavior. **What has NOT been tested:** a complete live schema clone, actual Supabase Data API access, Firebase-backed merchant billing response, real cloud network, linked payment providers, or production-safe rollback.

## Caller and compatibility audit

Current GitHub source indicates `src/components/PaymentHistory.tsx` reads `payments` from `../lib/supabase`, but that module is a *Firestore compatibility facade*, not the Supabase Data API. GitHub source search found no direct `.from("payments")` in the current Customer app and API routes. **External/legacy consumers have not been proven absent.** Do not assume this means the migration is safe to deploy.

The legacy `payments.shop_id` is `bigint`, while the modern pickup `shops.id` is `text`. A correct future server read endpoint must resolve a verified merchant's Firebase UID against the authoritative shop mapping and this legacy payment relationship. Do not authorize reads using arbitrary client `shop_id`, unaudited Firestore metadata, customer-supplied roles or user-editable JWT metadata.

Before any live deployment, prepare an isolated, approved staging clone with a representative synthetic compatibility dataset, confirm any Super Admin/reporting integrations, and provide a shop-scoped **server** read endpoint if the legacy payments page needs data. Keep payment-status/order transitions server-authoritative; the client never writes payment financials directly.

## Safe staged rollout and recovery strategy

1. Snapshot *schema only* and exact permissions/policies at the intended change time. Compare to R3.9 observed preconditions. Coordinate a low-traffic change window after owner approval and full staging QA.
2. Implement and test the authenticated server-only payment-history endpoint **before** revoking client grants. Verify real Firebase auth and shop ownership, output minimization and permission denial for cross-shop clients, with no financial mutations.
3. Apply only an independently reviewed, generated versioned migration **in staging** using current Supabase CLI/migration procedures; run read, denial, order and merchant billing regressions and check error telemetry. Do not copy the review-only file as a versioned migration.
4. Require explicit written owner approval and backout criteria before any Production schema/role/policy change.
5. Prefer **roll-forward** recovery through a verified server read endpoint or temporarily disable affected billing UI. Do **not** automatically restore the former `USING true` policy to "roll back"; that would reintroduce cross-shop access. Any emergency exception requires a distinct risk approval and hard time limit.

## Merchant screenshot / Preview acceptance

The screenshot from 8 November shows the dashboard fail-closed at shop verification. R3.8 found the generic Merchant Preview API URL referred to an inaccessible/not-found old Vercel deployment; its review branch was rebuilt against a healthy, **server-read-only** API Preview and local write flags disabled, with no Production changes. The corrected link is:

**https://local-eats-dashboard-2-6m8o-20ren6m6k-mehey9184-makers-projects.vercel.app/**

The branch deployment is READY and serves HTTP 200. Its API uses the same Firebase project and the expected Supabase shop availability view exists. However, there is **still no verified real merchant sign-in/shop response**. The owner must open the corrected link, sign in and use Retry; **do not save a shop or operate orders in Preview**. Do not mark the screenshot resolved until the merchant's shop actually loads. If it still fails, report sanitized Network response status for `GET /api/v1/merchant/shop`—never an ID token, email, UID or cookie.

## Public launch and remaining gates

The pickup-only launch estimate remains approximately **60%**; this is a planning estimate, not a weighted automated grade. R3.9's synthetic SQL tests cannot resolve manual Customer/Merchant Preview UX, real FCM push reliability, production payment policy or full deployed schema compatibility. Riders/Delivery stay disabled for at least six months, Rewards Coming Soon, pay-at-shop only.

Sources: read-only Supabase `pg_policies`/privilege metadata 8 Nov 2026; Vercel exact deployment state; GitHub source and CI. Supabase security guide: https://supabase.com/docs/guides/api/securing-your-api
