# LocalEats Phase 1 — Rider notification privilege risk and REVIEW-ONLY repair

**Date:** 2026-11-04. **Status:** Prepared on a separate branch and tested against disposable PostgreSQL. **NOT deployed to Production or staging.**

## Verified read-only Supabase findings

The existing LocalEats production database (project ID documented internally; no credentials included here) had these exact facts when inspected:
- `public.rider_notifications` has RLS enabled, but its sole policy **Rider notifications access** was `FOR ALL TO PUBLIC USING (true) WITH CHECK (true)`.
- Both `anon` and `authenticated` have table-level SELECT, INSERT, UPDATE and DELETE privileges. The RLS policy does not limit them to their own notifications.
- `public.nudge_rider_by_id(uuid,bigint,text)` is `SECURITY DEFINER`, allows arbitrary supplied rider and shop IDs, has **no authenticated ownership check**, and `anon` / `authenticated` both have EXECUTE.
- `public.nudge_rider(uuid,text)` is also `SECURITY DEFINER` and grants EXECUTE to both roles. Although it uses `auth.uid()` to look up a shop, it does not verify that the supplied rider is paired with that shop.
- GitHub code search across Client, Merchant and Rider repos found one Merchant `supabase.rpc("nudge_rider", ...)` call (a dormant Rider-related action); no code references to `nudge_rider_by_id` or direct `rider_notifications` table access were found. Code search is not proof that no external consumers exist.
- The Merchant Riders page is currently locked. This does **not** automatically protect the Supabase Data API from direct calls.
- The user has **not** authorized enabling rider operations or live database permissions changes during Phase 1.

These are real security misconfigurations if the exposed `public` API is reachable, **not evidence that anyone has exploited the database**. Do not test exploitability against Production or insert records there.

## Proposed narrow repair

The file `security/drafts/rider_notifications_lockdown_REVIEW_ONLY.sql` is **not** in the migrations folder, is not executed by the application, and is **not** safe to apply without a separate owner-approved review.

Its single transaction:
1. Refuses to proceed if the notification table, RLS policy count, unrestricted policy definition, or privileged function identities differ from the verified snapshot.
2. Revokes all direct table privileges on `public.rider_notifications` from `PUBLIC`, `anon` and `authenticated`.
3. Removes the unrestricted RLS policy, retaining RLS enabled and no public read/write policy.
4. Revokes EXECUTE on **only** these two legacy notification functions from `PUBLIC`, `anon` and `authenticated`.
5. Explicitly preserves service_role CRUD/EXECUTE and asserts the resulting permissions. No business rows are changed and no tables are dropped.

It intentionally makes the dormant Merchant direct `supabase.rpc("nudge_rider")` path unavailable to browsers. If rider nudges are reactivated later, build an authenticated, shop-owned API endpoint using the server-side service role and verified rider/shop pairing, never re-open this broadly permissive function.

## Isolated validation
The PR's GitHub Action runs a fresh PostgreSQL 16 container with synthetic roles, reproduces the unsafe policy/function grants, applies the exact review draft and verifies:
- `anon` and `authenticated` cannot read or write notification rows or execute either privileged function.
- The service_role retains the intended permissions, and a synthetic service-side function call works.
- The unrestricted RLS policy is gone; no real project connection credentials are available.

## Mandatory cutover gates (no automatic action)
1. Identify and approve the responsible owner and current rider-notification consumers; ensure live rider functions are still disabled, and validate no legitimate production path depends on the direct RPC.
2. Capture a fresh encrypted backup and verify restore on a disposable compatible database. Review exact SQL against refreshed table privileges, policies, function bodies and signatures (avoid applying if drift).
3. Explicit owner approval to apply **only** the reviewed SQL to the correct project. Record the exact pre-change policy/grants and a safer-than-original recovery design; do not revert to unrestricted PUBLIC access just to restore a broken path.
4. Transactional application by an authorized database owner in a controlled release window, then read-only privilege/RLS verification and re-run Supabase Security Advisors.
5. Test Merchant, Client and Rider read-only flows, and their current no-activation flags; do not simulate real riders or orders on Production.

## Other risks found, deferred for separate review
- `public.handle_new_user()` is a `SECURITY DEFINER` signup trigger that reads `raw_user_meta_data->>'role'`. Metadata supplied by a user must never confer merchant/admin/rider authority. Audit every downstream use of `profiles.role` before changing this trigger: the trigger is attached to `auth.users` and an unreviewed change could break signups.
- `public.profiles` has broad table grants but RLS is enabled; do not confuse grants with row access until inspecting its policies.
- The PostGIS extension and `spatial_ref_sys` database-advisor warning should be handled with extension ownership awareness, not a blind RLS migration.
- `public.rls_auto_enable()` is an event trigger; review it with database-owner tools separately rather than altering global event-trigger privileges during this narrow change.

Supabase documentation:
- https://supabase.com/docs/guides/database/functions
- https://supabase.com/docs/guides/observability/advisors?lint=0028_anon_security_definer_function_executable
- https://supabase.com/docs/guides/api/securing-your-api

**No Production database writes, schema changes, order activation, rider activation, payments or merges are authorized by creating this review artifact.**
