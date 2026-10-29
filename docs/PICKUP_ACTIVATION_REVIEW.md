# Pickup activation review — 2026-10-29

Status: prepared for owner review, NOT Production activation.

## Exact database artifact
Use only supabase/drafts/pickup_launch_foundation.sql from this commit. Exact SHA256: f68a80a77461762ac8efe15e7216bc5b1202d292af40564a65fddf77dd051cef. It is the existing reviewed launch draft, unchanged from launch/pickup-only-pilot-01. It adds nullable delivery_type/payment_status/create_intent_hash/revision to orders; append-only pickup_order_events supplies the durable Ready inbox. pickup_push_subscriptions and pickup_push_outbox support optional permissioned best-effort FCM with one awaited, leased attempt per relevant request. No cron, paid queue or permanent worker. No Rider schema changes or historical backfills.

Read-only target metadata: phdjumtqkooyppxozqsi. Required orders/shop/menu column types and unique idempotency key match. No current pickup RPC/column collisions or custom orders/shop/menu triggers. RLS enabled. service_role SELECT/INSERT/UPDATE, shop/menu locking privileges and bypass-RLS verified. Current orders count: zero. My-Kota is approved, active, unarchived and has an owner; exact Firebase UID ownership remains enforced by the existing authenticated shop endpoint and requireOwnedShop, previously verified in the original UI. This pass did not extract a new browser token or independently renew that signed-in verification.

## Backups / legacy boundaries
Saved database archive SHA256 21afe4788e21e784454798e48ad40c5591e44947aff9f1777ac448910fe8ec92 and exported deployed Firestore rules SHA256 ed2ea3db7dd7f896b25b91573b2d1ccd472656f477739329383cb1906aee3496 still match. Business-table restore passed previously; full Supabase restore remains unverified because local PostGIS/Vault extensions are absent. These are snapshots from October 28; refresh backup immediately before an approved cutover if data/schema has changed.

Current deployed API and Customer legacy guards remain in Production. The prepared API requires pickup-v1, rejects legacy pricing/ambiguous creation, preserves generic write denial, and does not activate any legacy writer. The saved Firestore rules still permit some legacy document updates; they are NOT Supabase authority and must not be represented as fully closed deployed rules. Firebase callable inventory was not re-established in this pass; known createOrder URL was previously 404. No Firebase deployment performed.

Current Rider route, verification, pairing and migration source remain byte-for-byte unchanged. Existing delivery continuation and reads remain routed. New pickup rows have delivery_status=none, no rider_id; database constraints/triggers prohibit changing those facts, while the existing Rider feed requires finding_rider. The isolated test fixture models business tables, not the entire Supabase extension ecosystem.

## Isolated validation
Run from this repository:
```
npm test --prefix localeats-api
node --test tests/merchant-activation.test.mjs
npm run test:merchant-pickup
& ./localeats-api/tests/pickup/validate.ps1 -Journey -Port 55442
```
Runner creates a unique loopback-only synthetic PostgreSQL cluster, applies the draft locally, exercises immutable facts, SQL privileges, duplicate/concurrent creation, accept/cancel races and a real Express/HTTP/PostgreSQL journey. Fixture Firebase verifier is confined to the offline test runner, never mounted by server.ts. Original Customer and Merchant adapter recovery tests supplement that protocol journey; this is not a live, activated original-UI acceptance claim.

Validation result: 132 API tests pass (including retained compatibility and Rider coverage), 9 Merchant policy/menu tests and 3 actual Merchant service activation/recovery tests pass. Customer has 3 render, 6 integration and 3 service activation/recovery tests passing. Both production builds pass; Customer TypeScript passes; Merchant retains 61 baseline diagnostics with zero new diagnostics. Disposable PostgreSQL SQL integrity/race assertions and HTTP two-client journey pass.

API Preview/Production SUPABASE_URL binding independently reconfirmed to the specified project without displaying credentials. No existing activation variables are set on any of the three Vercel projects; defaults remain off. Customer/Merchant Production API origin is the existing https://localeats-api.vercel.app. New review frontends use the dedicated default-off API Preview branch alias https://localeats-api-git-activation-p-dc232e-mehey9184-makers-projects.vercel.app. Exact review origins are configured only on that API Preview branch; broad Merchant Preview host matching is blanked only in that scope.

## Required owner approval and ordered cutover
1. Review/approve this exact SQL and explicitly accept the full-restore limitation, or first validate restore on compatible disposable Supabase/Postgres infrastructure. Reconfirm backup freshness, target and schema immediately before application.
2. Apply the reviewed file once to phdjumtqkooyppxozqsi using supported Supabase SQL access (entire transaction, ON_ERROR_STOP if psql). Do not apply archived integrity migrations. Draft lock_timeout=5s and statement_timeout=30s fail closed; a failure rolls back the whole transaction. Never retry blindly after an ambiguous connection loss: inspect columns/RPCs first.
3. Read-only verification: select column_name,data_type from information_schema.columns where table_schema='public' and table_name='orders' and column_name in ('delivery_type','payment_status','create_intent_hash','revision'); select to_regclass('public.pickup_order_events'),to_regclass('public.pickup_push_subscriptions'),to_regclass('public.pickup_push_outbox'); select proname from pg_proc where pronamespace='public'::regnamespace and proname like 'pickup_%'; inspect RLS/grants/trigger definitions and confirm historical orders have not been reclassified. Do not create a live record for a schema probe.
4. Separately approve API activation release and Production-only PICKUP_WRITES_ENABLED=true. Deploy the tested API source first, keeping Firebase server credentials private and the current exact Customer/Merchant origins. Legacy/generic creation remains denied. Recheck health, catalog, ownership and authenticated reads.
5. Separately approve Merchant and Customer releases with Production-only VITE_PICKUP_ORDERING_ENABLED=true and VITE_LOCALEATS_API_URL=https://localeats-api.vercel.app. Rebuild each original UI. Do not enable these flags merely by merging a branch; defaults remain off.
6. Owner-approved two-account real acceptance: customer quotes/consents once; submit/retry with same key; merchant checks real items/phone, accepts to Preparing, marks Ready; customer refresh sees durable Ready; merchant confirms actual cash/card-machine payment, hands over food, then confirms Collected. Check persistent customer history. No payment inferred from method or collection. Stop on ownership/schema/quote mismatch.

## Rollback
Turn the API switch off first and rebuild frontend switches off. Preserve nullable columns, orders, events, payment and handover facts; never drop tables or replay old inserts. Keep new read paths so history stays visible. Do not roll back to an API that re-enables unsafe legacy writers. FCM failure does not undo Ready or erase the inbox. Existing development Previews remain default-off against the shared database; no activated remote journey is authorized yet.

## Remaining gates
Production migration application and write switches are explicitly unapproved. Full Supabase-specific restore fidelity is unresolved. Fresh authenticated two-account acceptance after cutover is still required. Zero additional paid services were introduced; commercial use requires confirmation the existing hosting plan permits it, without assuming Vercel Hobby commercial eligibility. No live ordering/payment mutation was performed.

## Published default-off review deployments
- API/Merchant application commit: a356d6e9e949cafce931468c9d22340e9153e0b5.
- Customer application commit: 1b8361387ab59ec57d42143e65b7d4ed79f6015e.
- Customer: https://project-x7cvt-7o50q8hpk-mehey9184-makers-projects.vercel.app
- Merchant: https://local-eats-dashboard-2-6m8o-eh22snlma-mehey9184-makers-projects.vercel.app
- API: https://localeats-api-git-activation-p-dc232e-mehey9184-makers-projects.vercel.app (latest pinned deployment localeats-pvlbc0sqp-mehey9184-makers-projects.vercel.app).
All READY. API health 200 and real My-Kota menu read 200 with one R25 item. Original Customer welcome and Merchant sign-in pages load. This does not claim fresh authenticated original-UI ordering against the shared database. PICKUP_WRITES_ENABLED=false and VITE_PICKUP_ORDERING_ENABLED=false are explicit branch-only Preview settings. No Production settings changed. Both remote main SHAs and all three Production aliases remain unchanged. A later documentation-only commit does not change the tested application source.
