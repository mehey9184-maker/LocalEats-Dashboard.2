# LocalEats — read-only pickup launch security preflight

**Status:** review-only, no migration, no Production write, no live ordering activation.

Run `security/checks/public_launch_known_findings_READ_ONLY.sql` in the authenticated Supabase SQL Editor **only after confirming the intended project**. The query reads `pg_catalog`, `pg_policies` and privilege metadata; it does not read customer or merchant records.

## Verified baseline, 2026-11-06

The exact check was exercised via a read-only query against the live LocalEats Supabase project. Five gates returned **BLOCKED**: the publicly broad rider notification policy, public rider table grants, public rider RPC execution, signup role sourced from user-editable metadata, and public signup function execution. `signup_trigger_enabled` returned **PASS**. No table, grant, RLS policy, role, function or live customer data was modified.

## Intended post-cutover usage

1. Obtain and independently verify a **real encrypted Production backup and restore** (the synthetic rehearsal is not sufficient).
2. Review consumers and explicitly approve the reviewed SQL drafts from PRs #57 and #71 before any real DB security changes. Do not auto-apply them or use CI to make Production writes.
3. Apply the separately approved changes in a controlled maintenance window, then run this **read-only** preflight against the exact intended project. Require all six results to show PASS; check Supabase security advisors and verify service-role behavior separately.
4. Confirm actual Firebase/Firestore rules, full signup/register role integrity, Customer/Merchant/API deployment alignment, complete staging A/B profile tests, and real-phone pickup tests before any public orders.
5. Record the timestamps and outcomes in [launch gate issue #73](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/issues/73). Never paste credentials, customer data or raw backup files.

**Important limitations:** This check targets specific known signatures and patterns. It is not a comprehensive authorization audit; a custom additional policy, different function signature, unsafe app logic, public Firebase access, or inadequate restore coverage might exist even if all rows say PASS. The check deliberately does not approve a launch or replace human review.

If the query errors after schema changes, treat the outcome as **BLOCKED**, not PASS. Never weaken checks just to obtain green results.
