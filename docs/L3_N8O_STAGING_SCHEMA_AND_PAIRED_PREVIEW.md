# L3-N8O — Owner-approved staging pickup schema and paired read-only Previews

**20 Nov 2026 (Africa/Johannesburg).** Owner approved **staging-only** pickup-order schema and reviewed Customer/API Preview deployments, **with all real-order switches OFF and Production unchanged**. This document records ACTUAL executed actions and observed outcomes; it is not an activation approval.

## Target isolation and applied staging migrations

- **Supabase target:** `LocalEats-Profile-Staging`, ref `rgpbdajhlrwfmhopzgzk`, `ACTIVE_HEALTHY`, EU-West-1. Production Supabase ref `phdjumtqkooyppxozqsi` was **NOT mutated**.
- The source is deliberately under `supabase/staging-only/` **outside automatic production migrations**.
- Applied through the connected Supabase migration tool with explicit project ID:
  1. `20261120190238_l3_n8o_staging_pickup_orders_hard_off`, exact source `supabase/staging-only/L3_N8O_PICKUP_ORDERS_HARD_OFF.sql`.
  2. `20261120191636_l3_n8o_staging_push_outbox_fk_index`, exact source `supabase/staging-only/L3_N8O_PICKUP_OUTBOX_INDEX.sql`.
- Existing `shops`, `menu_items`, `profiles`, `pickup_push_subscriptions` and staging fixtures were **not overwritten**. No Production rows copied; no new users, shops, orders or payments.
- New **`public.orders` has 33 columns**, matching Production field names and types for later reviewed pickup RPC compatibility; also added `public.pickup_order_events` and `public.pickup_push_outbox`. Stage outbox references the already existing private stage push-subscription table.
- Read-only postflight confirmed all three new tables have **RLS enabled**, `anon` INSERT denied, `authenticated` SELECT denied, service-role SELECT permitted, and **one enabled application-side hard-off trigger per table** on INSERT/UPDATE/DELETE. New order, event and outbox tables each contain **zero rows**.
- Hard-off trigger function `public.l3_n8o_staging_pickup_writes_disabled()` intentionally raises `L3_N8O_STAGING_PICKUP_WRITES_DISABLED` even if an API write flag is accidentally enabled. It must only be removed/replaced under a **new, separately authorized staging activation migration** after storage/ownership/lifecycle review.
- No new `pickup_create_order` or merchant lifecycle RPC, scheduler or worker was installed. Therefore this is a **foundational schema**, NOT a runnable order engine or real pickup acceptance.
- Supabase security advisor reports informational `rls_enabled_no_policy` findings on the new and previously private stage tables. **This is intentional default-deny**, not a request to make them public. The advisor initially found one missing FK index on `pickup_push_outbox.subscription_id`; the second migration corrected it, and the follow-up performance scan showed **zero unindexed foreign keys**. Unused-index notices are expected for new zero-row tables.
- Production `public.orders` was independently confirmed to already exist and contain 33 columns; **no Production DDL or order mutation** was executed.

## Paired Vercel Preview deployments — actually READY

The exact reviewed source revisions were deployed via Vercel's Git-source Preview API into **existing dedicated staging projects only**. Both project targets are `preview`; no Production project or alias was promoted, and neither draft was merged.

| Component | Dedicated Vercel project | Reviewed Git SHA | Final immutable deployment | Status |
| --- | --- | --- | --- | --- |
| Customer | `localeats-customer-staging-r52d`, `prj_F4szeGF8BxmYpdUVA2yLYrjAmMUN` | `42a1d91522bd42cd07703dce7164a5bebccbd218` from draft #123 | `dpl_9rmHDYtzCqvH9vVKqEQD2nbmk1jB` | READY Preview |
| API | `localeats-api-staging-r52d`, `prj_eroDrVcFOPlvRJzjCU7vbwGnleFT` | `e3f18449abd5383180a065ab05cb2fd68bd9ec5c` from draft #206 | `dpl_2niWsguJjx9EiqNL4wdN9b5tjtyw` | READY Preview |

New fixed isolated **stage-only** aliases (not Production) were successfully assigned:
- Customer: `https://localeats-customer-n8o-r52d-mehey9184-makers-projects.vercel.app`
- API: `https://localeats-api-n8o-r52d-mehey9184-makers-projects.vercel.app`

**Why Preview environment configuration was adjusted:** Vercel refused branch-specific environment variable creation with `Project ... does not have a connected Git repository`. Instead, the following two **existing Preview-only variables were updated in the isolated staging projects**, with no Production variable/alias changes:
- Stage API `CUSTOMER_APP_ORIGIN`: formerly `https://localeats-customer-staging-r52d-mehey9184-makers-projects.vercel.app`; now the fixed N8O Customer alias above, so its existing exact-origin CORS route recognizes this dedicated Preview.
- Stage Customer `VITE_LOCALEATS_API_URL`: formerly `https://localeats-api-staging-r52d-mehey9184-makers-projects.vercel.app`; now the fixed N8O API alias above.
- These two Preview defaults **are not branch-scoped** because of Vercel's Git-connection limitation; future Preview rebuilds in these two isolated projects inherit the new pairing until deliberately changed back. Existing immutable previous deployments and Production are unaffected. No secret environment values were exposed.
- Read-only environment verification showed Customer Preview `VITE_FIREBASE_CONFIG_SOURCE=environment`, `VITE_FIREBASE_PROJECT_ID=localeats-staging`, Firestore `(default)`, `LOCALEATS_STAGING_ONLY=true`, `VITE_PICKUP_ORDERING_ENABLED=false`. API Preview `FIREBASE_PROJECT_ID=localeats-staging`, Supabase staging URL, `LOCALEATS_STAGING_ONLY=true`, `PICKUP_WRITES_ENABLED=false`, `PROFILE_WRITES_ENABLED=false`, `MERCHANT_ACCOUNT_WRITES_ENABLED=false`. Some optional flags are absent and must **not** be interpreted as enabled.
- Existing server middleware `previewReadOnlyGate` rejects POST/PUT/PATCH/DELETE. This and the new database hard-off triggers are distinct independent controls. Dormant community/profile write endpoints remain unmounted.

## Actual safe HTTP and bundle checks performed

- New API stage alias `GET /health` returned **HTTP 200** JSON `{"status":"ok","service":"localeats-api"}`.
- New API `GET /api/v1/catalog/shops` returned **HTTP 200** and **3 shops**. The emitted shop objects contained none of the checked private keys `owner_id`, `owner_email`, `phone`, `approval_status`, `availability_revision`, `firebase_uid`, `service_role_key`. Actual live public menu/full browser flows were **not** exercised.
- Customer stage alias `GET /` returned **HTTP 200**, title `LocalEats | Local Kota & Braai Pickup`. Its built JS asset contained the **new N8O stage API alias** and `localeats-staging`, but **neither** the old staging API alias **nor** the known Production Firebase project ID. It contained the reviewed stage no-write and blocked-order copy.
- The connected Vercel HTTP checker could not finish a protected order-route request because a later redirect required deployment authentication, even after its temporary share link. This is **NOT evidence of API's real 401 or 403 ownership checks**.
- Exact browser Origin/CORS preflight, real staged Firebase ID-token acceptance/revocation, a real Customer–Merchant pair, menu/cart screenshot equivalence, FCM delivery, and complete pickup handover remain **not yet verified**. No order, signup or mutation requests were sent to these Previews.
- Public LocalEats Customer Production domain/hosting and actual deployed staging Firebase Security Rules release/rollback source still require independent verification. A correct Preview build does not prove that customers can use a public Production application.

## Production and rollback boundary

Final Vercel read-only deployment check: Production `localeats-api` and `local-eats-dashboard-2-6m8o` are still READY at **`a5168ccbbb37643a58ad4202c72b65dd43149c2e`**. The actual Production API `PICKUP_WRITES_ENABLED=false` and Production Merchant `VITE_PICKUP_ORDERING_ENABLED=false` were checked earlier and are not changed here.

Rollback without touching Production:
1. Keep the old immutable stage deployment IDs `dpl_9L8HD1ryskRLLpGSX2Pov1sk9Ksr` (API), `dpl_BxMyNuJo7g3hKtcunyK5FQ3MG8bw` (Customer) available. The new N8O aliases can be retired or reassigned independently of Production.
2. Restore **only these two isolated Preview variables** to their prior canonical staging API/Customer URLs listed above, and then rebuild the relevant isolated Preview if needed. No production URL/env changes.
3. Keep new stage schema hard-off and empty until separately approved acceptance. **Do not automatically DROP the tables**, which would require a new explicit, isolated destructive-migration approval even though they currently have zero rows.
4. To enable real staged pickup order writes later, separately review existing Production's secure pickup RPC/trigger contract, stage schema drift, authorized synthetic account/shop fixtures and disabled Firebase/FCM state, then submit a *separate* reversible staged lifecycle migration and enable only the minimum staging flags. This authorization was **NOT** part of N8O.

## Next launch gate

Public **browse-only** launch can be considered after a verified Production Customer domain, Firebase sign-in/Rules, real approved catalog, mobile UX and support. Real **pickup/pay-at-shop** launch additionally requires a proven isolated staging customer→merchant accept→ready→collected lifecycle, order/idempotency/retry and notification acceptance, staging-to-Production schema comparison and strict production rollback/monitoring. Reviews, follows, Rider, delivery, online payments and subscriptions are non-MVP and remain deferred.

**Outcome of this approved task:** staging schema applied and verified, two reviewed read-only staging Preview deployments and fixed aliases READY, no data/payment or Production activation. **Real public ordering remains OFF.**
