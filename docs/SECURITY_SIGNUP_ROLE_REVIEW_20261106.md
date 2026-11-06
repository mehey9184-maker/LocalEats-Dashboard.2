# LocalEats: role metadata signup escalation — review only

**Security audit on 2026-11-06.** Production Supabase `public.handle_new_user()` is a `SECURITY DEFINER` trigger on `auth.users`. Its current SQL inserts `COALESCE(NEW.raw_user_meta_data->>'role', 'customer')` into `public.profiles.role`. User-editable metadata is not a trustworthy source of merchant, rider or admin authorization. An attacker who can sign up with a custom metadata role might acquire a privileged profile value. We have not tested exploitability against Production or observed exploitation.

The exact Production trigger observed is `on_auth_user_created AFTER INSERT ON auth.users`. It is currently callable as a public RPC and has a mutable search_path. Supabase Security Advisors warn about both concerns.

## Review-only repair
`security/drafts/signup_role_metadata_lockdown_REVIEW_ONLY.sql` is **not** in the migrations folder and is not automatically executed. It checks the current vulnerable function identity, its trigger, proconfig, and expected role expression before altering anything. It then preserves the original name/email/phone signup mapping, but always sets **new accounts to the server-owned `customer` role**, preserves existing roles on conflict, sets an explicit search_path and revokes direct `anon` and `authenticated` function invocation. The trigger remains enabled. Any schema drift aborts the transaction. The server-side `service_role` execute permission is retained.

## Synthetic regression
A disposable PostgreSQL 17 CI service first reproduces the unsafe behavior with a fictional user supplying `role=admin`, then applies the **exact proposed SQL** and asserts: a new `admin` or `merchant` metadata claim creates a customer, a pre-existing verified merchant role is not overwritten, names are still recorded, and public RPC execute privileges are absent. No real customers, credentials, accounts or Production SQL used.

## Prerequisites for applying to Production
1. Fresh encrypted, independently restorable full Production backup. Current backup rehearsal #58 is synthetic only. Supabase Free does not provide daily automatic backups.
2. Map every component that consumes `profiles.role`, `admin_users` and `shops.owner_id`. Ensure merchant onboarding is approved server-side, rather than metadata-driven, so legitimate merchants are not locked out.
3. Explicit owner approval for this **exact** transaction and a controlled security cutover, preferably paired with the reviewed rider notification lockdown in PR #57. Recheck production function signatures, policies and grants immediately before application.
4. Apply with transaction error stopping and verify `pg_get_functiondef`, role grants, and one authorized staging signup first. Never run an unreviewed signup against Production.
5. Run Supabase Security Advisors again and inspect any remaining public SECURITY DEFINER functions including `rls_auto_enable` and PostGIS functions, without blindly revoking extension-owned functions.
6. The following remain separate launch blockers: hosted two-account Firebase profile save/read-back, first actual encrypted backup/restore, commercial hosting, original UI acceptance, safe order receipt, and owner approval of pickup activation.

**No Production database changes, schema changes, payments, real orders, riders or delivery are permitted by this review PR.** Keep pickup-only for at least six months of actual customer activity.
