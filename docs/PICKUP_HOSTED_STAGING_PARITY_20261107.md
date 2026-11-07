# LocalEats — actual staging parity and full pickup acceptance gate
Date: 2026-11-07. **Read-only inspection completed. No cloud data writes, deployments, merges, or staging schema changes.**

## Verified read-only environment facts

The connected **profile staging** Supabase project is `rgpbdajhlrwfmhopzgzk`. The dedicated Firebase staging Auth project in the already prepared profile runner is `localeats-pickup-stage-261105`, **not** the Production Firebase `localeats-5e26e`. The guarded profile runner in Merchant/API draft PR #75 intentionally tests only two synthetic account profiles through a canonical handler on localhost; it does **not** exercise the globally deployed preview application.

The existing three-app LocalEats architecture requires these flows for a supervised pickup launch:

1. **Super Admin:** verified admin identity, shop approval and append-only approval history.
2. **Merchant:** approved merchant ownership, menu/settings, authoritative open/close revision and pickup order inbox.
3. **Customer:** approved nearby open/closed catalog, real menus, quoted pickup prices, own profile and order history; no delivery or online payment.
4. **API/DB:** server-only service role, authoritative price/4 km, idempotent order/create-event, Ready notifications and recovery.

On November 7, an authenticated Supabase **read-only** comparison and the exact SQL file `security/preflight/pickup_stage_schema_parity_READ_ONLY.sql` found **3 of 23 pickup-specific required tables/views/columns/function signatures present** in staging. The present items are `public.profiles`, `public.profiles.user_id` and `public.profiles.role`. **20 are absent**, including `shops`, `menu_items`, `orders`, `pickup_order_events`, `pickup_push_outbox`, `admin_users`, `shop_approval_events`, `shops_with_availability`, `transition_shop_approval`, `merchant_set_availability` and `pickup_create_order`. No row data or PII was read or exported.

Production has the primary pickup and approval objects, but its known role-escalation, dormant Rider access and named-town restriction remain active until separately approved cutovers. It is **unsafe** to call a profile-only cloud test full checkout/approval acceptance, or to point any Preview with write permissions at Production to fill this gap.

## Repeatable read-only check

The SQL file under `security/preflight` queries only the system catalogs/information_schema; it does not use `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `ALTER`, privileged RPC calls, personal rows or auth tokens. It returns a single schema metadata JSON object with exact required relations, columns, functions, object-presence, and the function roles able to execute.

The offline `localeats-api/scripts/pickup-stage-parity-gate.mjs` reads a private JSON snapshot, compares against the fixed 23-object pickup-only contract and refuses incomplete or dangerously public function privileges. Its reported `OBJECT_AND_GRANT_PRECHECK_PASS` means **only** a basic inventory/EXECUTE preflight passed—never complete Firebase Auth, RLS, data-isolation, role, API routing or live-order acceptance. A result can become stale immediately after capture.

To run safely, select the **correct staging project** via an independently authenticated Supabase connection, run the SQL only there, and save the returned JSON to a private local file. Add `"project_ref":"rgpbdajhlrwfmhopzgzk"` *only after independently verifying the source project*. Then run:

```bash
node localeats-api/scripts/pickup-stage-parity-gate.mjs --snapshot /private/path/pickup-stage-inventory.json
```

The operator's label is **not proof of provenance**; the actual project ID must be verified outside the file. Never commit this snapshot, credentials or private account data. The script has no network access or write methods. Nonzero exit means staging **must not** be advertised as ready for pickup workflows.

## How to prepare a real isolated full staging environment — requires separate explicit approval

**Do not modify the existing profile staging project yet.** It may contain synthetic acceptance data and serve the profile runner. Before any writes:
- Inventory its current profiles/Auth settings, Firebase stage project, associated API Preview, and active SQL history. Take a verified backup if there are any staging records worth retaining. Do not copy Production customer emails, tokens, orders, names or addresses.
- Choose to either extend the existing profile staging database (minimizes free-tier projects) or create a new strictly separated staging database/project (may incur cost or exceed Free project count). Obtain owner choice/approval for **staging changes only**; **Production remains untouched**.
- Restore a **schema-only**, independently reviewed PostgreSQL structure compatible with the approved pickup API, Super Admin approval, Merchant availability and Customer profile revisions. Avoid replaying an old insecure Production signup trigger or permissive Rider grants into stage. Apply the approved hardened migrations together in a disposable PG17 dress rehearsal before any connected staging cutover.
- Use synthetic shops, menu items, one verified synthetic Super Admin, one approved merchant and two distinct synthetic customer Firebase-stage identities. All credentials and service role keys stay outside GitHub.
- Keep the Firebase staging Auth project `localeats-pickup-stage-261105` isolated from Production Firebase `localeats-5e26e`; the Preview API must verify the staging Firebase project/audience. Do not point Preview to Production Firestore or Supabase for write tests. Set order activation **staging-only** after verifying the isolation and owner authorizes synthetic staging writes; never change Production flags.
- Verify the published Firebase security rules **on the actual named Production and staging Firestore databases** independently; rule source in GitHub does not establish deployed permissions.
- After schema parity, run validated acceptance: Super Admin Pending→Approved (remains closed), Merchant open with revision, Customer nearby browse (closed menus), real pickup quote/create from another town within 4 km, intentional duplicate submit, merchant Accept→Preparing→Ready→Collected, authenticated A/B privacy, push failure and durable inbox recovery, suspensions, idle-session refresh. No real-world user orders, payments, Rider/Delivery or subscription billing.
- Test final backup/recovery and rollback in the disposable environment, recheck public grants, and require explicit separate owner signoff before any Production security/SQL deploy.

## Critical outstanding separate blockers

- Production `public.handle_new_user()` trusts user-editable signup role metadata and exposes EXECUTE; dormant `rider_notifications` / nudge RPC privileges need the reviewed lockdown.
- Deployed Firebase named Firestore rules remain unverified and Customer source rules are widely permissive.
- The any-town API/Customer changes and exact-function SQL cutover are still unmerged drafts #74/#82/#84/#86 and require coordinated release after complete hosted tests.
- Staging profile runner #75 still needs two synthetic Firebase credentials and server role authorization; its preflight is green but no real save accepted.
- API bounded push timeout draft #77 and read-only Preview inbox #78 need integration; guaranteed independent outbox retries and verified 4 km user/shop location accuracy are not complete.
- Vercel Hobby is not a commercial hosting solution for the public business. Support/privacy/POPIA and actual pilot customer acceptance are independent release gates.

**This review/test is not a staging migration.** The connected Supabase and Firebase projects, Vercel environments, Production database and all owner test shops are unchanged. No rider, delivery, online payment, subscription or live ordering activated.

### Scope correction: Rider and Supabase Auth signup are intentionally deferred

Pickup does **not** require `rider_notifications`, either `nudge_rider` RPC or a production-style `public.handle_new_user()` trigger. The existing profile staging uses Firebase UID-scoped API writes; recreating the vulnerable production signup trigger or unused Rider privileges would make staging less safe. The review-only inventory therefore checks **23 pickup-only objects** (including the required `pickup_push_subscriptions`) and leaves deferred Rider infrastructure absent. This changes the numeric preflight to **3 present / 20 missing** on the last read-only staging inspection, not the underlying actual staging schema. No database DDL was applied.
