# Super Admin Rider verification — pickup-only server gate
Date: 2026-11-07. **DRAFT CODE ONLY: no Production deploy, no DB writes, no Rider activation.**

## Cross-app risk

The separate `mehey9184-maker/Super-LocalAdmin` frontend currently offers Rider verification through authenticated `PATCH /api/v1/admin/riders/:riderId/verification`. Even with UI hidden in Super-LocalAdmin draft PR #2, a trusted and authorized administrator could still call the API directly. This is a **product-scope gate**, not proof anonymous users can access admin routes; the existing Firebase authentication and `admin_users.super_admin` checks already protect them.

Pickup-only launch explicitly postpones delivery and Rider App for **at least six months of actual customer pickup use**. No Rider approval/dispatch/assignment/switch may become active accidentally during this period.

## Proposed narrowly scoped API behavior

- `localeats-api/src/routes/adminRiders.ts` checks `process.env.ADMIN_RIDER_VERIFICATION_WRITES_ENABLED === "true"` *after authentication and super-admin authorization, but before validating a rider ID or making any database read/write*.
- Missing, `false`, uppercase `TRUE` and all non-exact values fail closed with HTTP 503, `RIDER_VERIFICATION_COMING_SOON`, `Cache-Control: no-store`.
- This limits **Rider verification PATCH**. Existing authorized GET/list routes remain read-only, and no changes are made to shop review, customer orders, merchant approval, profiles, payment or other Rider endpoints.
- Production router keeps the strict default-off env check. Tests inject a scoped fake feature reader only for regression of the old synthetic status transitions. Browser payloads and user-editable metadata cannot change the flag.
- Super Admin draft PR #2 disables the UI module while retaining original layout and shop approval. **Both source changes remain separate drafts and neither is deployed.**

## Synthetic tests

`localeats-api/src/routes/adminRiders.test.ts` tests that a disabled, authenticated super-admin request gets 503 before even touching `findById` or `updateVerification`; unauthenticated clients still receive 401 and non-admin users still receive 403. It tests default-absent and `TRUE` case and retains the existing in-memory transition, approval safety, field allowlist and privacy checks with the isolated synthetic switch set true.

CI must compile the API and run all tests, with no Supabase/Firebase Production access. These tests are not live compliance or launch approval.

## Further gates

1. Independent review of all other Rider endpoints, Merchant and Customer dormant delivery links, and existing Firebase/Supabase Rider permissions; do not assume this one PATCH guard disables every Rider workflow.
2. Verify no active deployment has a conflicting override. Any future flag enablement requires a new explicit owner-approved Rider launch plan, later delivery architecture and test strategy, not merely the passage of calendar time.
3. Keep `PICKUP_WRITES_ENABLED=false` and other live-order/payment/delivery/billing flags OFF until separate approvals.
4. Verify hosted Customer, Merchant, Super Admin and central API compatibility in isolated Preview. Never change or create Production Rider rows for testing.
5. The **Firebase published named-database rules** and **Supabase signup metadata/Rider notification SQL** launch blockers remain separate P0 gates.

Tracking: https://github.com/mehey9184-maker/LocalEats-Dashboard.2/issues/80 ;
https://github.com/mehey9184-maker/LocalEats-Dashboard.2/issues/73 ;
https://github.com/mehey9184-maker/Super-LocalAdmin/pull/2 .
