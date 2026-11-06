# LocalEats — Review-only signup role privilege escalation hardening

**2026-11-06. Not applied to Production. No merchant, rider, or customer record modified.**

Read-only inspected Production `public.handle_new_user()` currently inserts `COALESCE(NEW.raw_user_meta_data->>'role', 'customer')` into `public.profiles.role` from the `on_auth_user_created` auth.users trigger. User metadata is editable by the user. Therefore the trigger's new-account role decision is not a trusted authorization source. This is an exploitable configuration pattern if any role-dependent code trusts that field. Do not assume exposure is only theoretical.

The proposed SQL checks the exact old behavior, SECURITY DEFINER configuration and existing named trigger before replacing the role assignment with the constant `customer`. It preserves existing users' roles on conflict and does not modify rows already in the database. It narrows direct `handle_new_user()` EXECUTE for public/anon/authenticated. It pins `search_path` and schema-qualifies relations.

CI starts isolated PostgreSQL 17, reproduces a synthetic attacker-supplied admin role, runs the guarded SQL only against the synthetic DB, and proves later users claiming admin/merchant in signup metadata receive only `customer`, while existing roles are unchanged. **This is not a live environment sign-up test.**

Before any live cutover: capture encrypted real data backup and verify independent restore; confirm actual Production function body, trigger and role-dependent merchant approval logic have not changed; separately approve a live security migration; run a genuine sign-up test using **authorized test accounts** without real orders; inspect authorization roles/claims and verify merchant access remains grant-by-approval only. Revoking public EXECUTE may also need checking any unsupported clients relying on direct calls.

The separate `rider_notifications` GRANT/RLS exposure still requires the reviewed PR #57 cutover. There is no delivery or rider product activation planned for at least six months of genuine pickup usage.
