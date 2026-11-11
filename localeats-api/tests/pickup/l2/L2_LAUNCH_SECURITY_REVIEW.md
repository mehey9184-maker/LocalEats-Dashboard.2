# LocalEats L2 — Launch Security Hardening: Review and Staging Gates

Date: 11 November 2026. Status: REVIEW ONLY. Not approved for Production; no live writes, migrations, Firestore rules deployment or feature-switch activation.

## Verified read-only evidence (Production metadata; no customer/order/payment/chat rows inspected)
- Supabase project ref: phdjumtqkooyppxozqsi.
- public.chat_messages has RLS enabled and two public ALL policies ("Allow all on chat_messages" and "Chat message access"), both USING true WITH CHECK true; anon and authenticated possess direct table grants. Cross-order messages could be exposed through Data API.
- public.payments has RLS enabled and "Payments access" (ALL TO authenticated USING true WITH CHECK true); authenticated has direct privileges. Cross-shop payment reads/writes may be possible through Data API.
- service_role has explicit DML grants on both tables. This does not prove all external/reporting integrations are compatible with removing browser access.
- public.orders and public.profiles have RLS enabled without public policies; this is not an API or end-user identity isolation test.
- handle_new_user() is a trigger function for auth.users.on_auth_user_created and also has public EXECUTE. nudge_rider, nudge_rider_by_id and rls_auto_enable have publicly executable SECURITY DEFINER privileges too. Review function bodies and all caller dependencies first; do not break the signup trigger.
- Do not blanket-revoke extension-owned PostGIS objects (spatial_ref_sys, st_estimatedextent) without a separate review.

## Existing payment guard: R3.9
Reuse localeats-api/tests/pickup/r39, not a competing payment migration. Its payments-access-hardening.REVIEW_ONLY.sql.txt cannot be applied verbatim to hosted Supabase; its disposable PG17 runner checks drift, role denial, impersonation, data preservation, repeat rejection and schema-only restore. Before changing live payment access, confirm an ownership-checked Firebase-authorized server-side billing/history endpoint. Legacy payments.shop_id is bigint whereas shops.id is text; never trust arbitrary client shop IDs.

## New chat guard: L2
The chat-access-hardening.REVIEW_ONLY.sql.txt file is also nondeployable:
- Requires the exact two reviewed broad chat policies, RLS already enabled, and explicit backend read/write privileges.
- Revokes PUBLIC, anon, authenticated direct privileges and removes the two policies in an atomic, short-lock transaction.
- Postconditions verify both browser roles cannot perform DML and backend role retains DML. Drift fails closed.
- Does not add a browser chat policy. First supply participant-verified, rate-limited API access (or separately audited fine-grained policies); protect order identity and sender identity server-side.
- Never modifies chat contents. Do not roll back by restoring unrestricted USING true policies.

## Firestore source/deployed mismatch: launch blocker
- LocalEats-app main firestore.rules contains 25 public allow-read-write clauses on profiles, orders, messages, chats, shops, etc. It is unsafe IF deployed.
- A separate source file security/review/firestore-deployed-baseline.rules and the Merchant repo firestore.rules are more restrictive, but the filenames do not prove deployed enforcement.
- A safe baseline may still have legacy direct order state updates and broad rider reads; do not deploy either candidate blindly.
- Identify the exact live Firebase project/database and deployed ruleset first, inventory Firebase Auth identity and collection callers, then stage least-privilege rules and test guest, two-account, Merchant, API/admin and Rider allow/deny paths in Firebase emulator. Do not ship a rules file until tested.
- The currently connected tools cannot read the live deployed Firebase ruleset; obtain an authenticated Firebase Rules release export from the owner or a verified provider connection before accepting this gate.

## Privileged database functions
- Inventory security-definer function bodies, EXECUTE grants and external callers before revoking. The auth.users trigger calls handle_new_user; ensure signup remains functional after any access change.
- Investigate rider nudge functions and rls_auto_enable for caller bypass. Prefer revoking PUBLIC/anon/authenticated execute when proven unused by legitimate clients, and keep explicit trusted-backend execution.
- Separate review for PostGIS extension objects and leaked-password auth settings. These are not automatically changed by this PR.

## Ordered release gates
1. Preserve fresh Production schema/ACL snapshots and confirm deployed Firebase Rules release; no customer data inspection.
2. Identify browser/API/Realtime/legacy callers and implement Firebase-authenticated order-participant chat plus shop-authorized payment history if required.
3. Run R3.9 and L2 synthetic PG17 tests and staging two-account cross-shop denial, backend allowance and UI regression.
4. Confirm backup and compatible restore evidence, fail-closed behavior, monitoring and roll-forward contingency.
5. Generate a versioned migration only AFTER approved staging evidence; ask for separate explicit owner authorization before Production SQL or deployed Firebase rules change.
6. Keep Production PICKUP_WRITES_ENABLED=false and both frontends VITE_PICKUP_ORDERING_ENABLED=false; Rider, rewards, online payments, LocalPay and subscriptions remain disabled until their own gates.

## Explicit non-actions
No Production Supabase SQL writes, Firebase Rules deployment, active schema migration, Production environment edit, application runtime change, PR merge, or real-order activation. Synthetic database tests cannot prove hosted Firebase rules or real-device acceptance.

References: https://supabase.com/docs/guides/api/securing-your-api ; existing R3.9 review plan; read-only Production pg_policies, ACL and trigger metadata checked 11 Nov 2026.
