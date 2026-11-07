# LocalEats — Combined signup + dormant rider security rehearsal (2026-11-07)

**Status: REVIEW ONLY.** No Production or staging SQL executed. No database writes performed outside disposable synthetic CI. No live ordering, delivery, rider activation, billing, Firebase rules deployment or merge.

## New read-only Production vs staging comparison

An authenticated Supabase SQL inspection on 2026-11-07 found:

| Fact | Production `phdjumtqkooyppxozqsi` | Staging `rgpbdajhlrwfmhopzgzk` |
|---|---|---|
| `public.handle_new_user()` | present; trusts `raw_user_meta_data->>'role'` | absent |
| `auth.users.on_auth_user_created` trigger | present, 1 named trigger | absent |
| Anonymous EXECUTE of signup function | true | not applicable |
| `public.rider_notifications` | present, anonymous SELECT true, authenticated UPDATE true | absent |
| `Rider notifications access` public permissive policy | present | absent |
| `nudge_rider(uuid,text)` | callable by anon | absent |
| `nudge_rider_by_id(uuid,bigint,text)` | callable by authenticated | absent |

Both queries were read-only. **Do not assume the absence of insecure objects in staging proves the Production fixes will work. Staging has a different schema.** No real-person records or account identifiers were exported.

A separate read-only Production summary showed **3 profiles, all role=`customer`**, at inspection time. This does not prove existing app-level roles or Firebase claims are safe and does not address future signup vulnerability.

The two exact repair drafts already exist and were tested separately:
- `security/drafts/signup_role_customer_only_REVIEW_ONLY.sql` — prefer this one customer-only signup approach; do not also apply the alternative `signup_role_metadata_lockdown_REVIEW_ONLY.sql`.
- `security/drafts/rider_notifications_lockdown_REVIEW_ONLY.sql` — remove public rider table grants and privileged RPC execution while preserving service-role access.

## What the NEW combined test proves

`.github/workflows/pickup-combined-db-security-rehearsal.yml` starts a **fresh PostgreSQL 17-alpine service**, with a synthetic-only password and the fixed local database `localeats_security_disposable`. It refuses any nonlocal host, missing database name, or supplied shared cloud environment URL.

In this single disposable database it:
1. Runs the existing synthetic signup fixture, demonstrating metadata role escalation to `admin`.
2. Reconstructs the legacy rider notification table/policy/functions in a new synthetic fixture sharing the same `anon` and `authenticated` roles.
3. Checks both vulnerable preconditions before proceeding.
4. Applies **one** selected signup draft and the rider draft, in order, entirely inside disposable PostgreSQL.
5. Runs both existing independent assertion suites and a joint postcondition: new `admin`/`merchant` metadata can only create customer roles, old profile role remains unchanged, rider table and privileged function grants disappear for `anon`/`authenticated`, and service-role rider call still works.
6. Re-runs each draft intentionally and requires it to refuse unexpected schema drift (instead of silently claiming a successful cutover).

**Limitations:** This is a minimal synthetic fixture that reproduces the selected Production object definitions/permissions; it is **not a full imported Production schema**, does not validate Firebase Auth signups, and does not reproduce all views, triggers, roles, permissions, PostgREST or merchant/client runtime behavior. The previously tested restore of Production schema/data was performed separately and cannot replace this permission/cutover test.

## Why live cutover is still blocked

- **Backup:** Confirm encrypted archive password protection and separate offsite copy (owner already reported the second copy); retain correct roles/ACL and managed Auth/Storage restore coverage before any irreversible change.
- **Current Production drift:** Read the current function body, signature, ownership, `auth.users` trigger activation, role grants, rider table grant/policy/function signatures **immediately before** a separately approved migration. Use existing draft PR #74 read-only preflight. Reject on mismatch.
- **Staging schema parity:** Introduce reviewed, **sanitized** matching auth trigger/rider metadata and roles in a truly isolated staging database, not Production. Obtain explicit authorization for staging writes; the current staging project does not have the relevant objects. Never copy customer emails, device FCM tokens or plaintext credentials into GitHub.
- **Auth end-to-end:** Sign up two synthetic users through the supported Auth endpoint, one claiming `admin` and one `merchant` in user metadata. Require customer-only DB roles and no merchant/administrator API access. Ensure an existing approved merchant still retains legitimate access. Check the Customer and Merchant legacy role mirrors/caches and server approval flow.
- **Rider dormant code:** Audit whether any Merchant actions still call `nudge_rider` RPC, and keep Riders Coming Soon for 6+ months. Revoking unused public functions must not break the pickup-only UI.
- **Independent authorization:** Supabase Data API RLS/grants, Firebase deployed rules on the named Firestore database, and API identity/role checks are distinct gates. A PG-only unit test does not establish Firebase permissions.
- **Safe rollout:** Migration and rollback plan, service-health verification, live postcondition SQL, and explicit owner approval are required. Do not automatically run these drafts from app CI/CD.
- **No activation:** Production `PICKUP_WRITES_ENABLED` and customer/merchant ordering flags remain OFF until hosted end-to-end order tests and separate approval.

Related: https://github.com/mehey9184-maker/LocalEats-Dashboard.2/issues/73 ; draft API PR #74 ; Customer Firebase rules draft #73 ; Customer profile PR #71 ; API profile PR #75.

Supabase security references:
- https://supabase.com/docs/guides/auth/managing-user-data
- https://supabase.com/docs/guides/database/functions
- https://supabase.com/docs/guides/database/postgres/row-level-security

**No branch or PR here authorizes applying SQL to Production, connected staging or any customer database.**
