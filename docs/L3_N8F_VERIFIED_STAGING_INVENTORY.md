# L3-N8F — Existing isolated LocalEats staging inventory and Merchant setup gate

**Read-only inspection on 20 November 2026.** No Firebase service-account keys, ID tokens, passwords, private profile data, customer records, or Supabase/Vercel secret values were exported into this report. This is a **pre-acceptance audit**, not signed-in Merchant staging acceptance.

## Correction to the narrow N8E Vercel search

N8E examined only the main `localeats-api` and `local-eats-dashboard-2-6m8o` projects. That inventory **did not cover** the separately named staging projects. A wider read-only Vercel project listing confirms both existed already:

| Layer | Existing resource | Read-only evidence |
| --- | --- | --- |
| Firebase staging | **`localeats-staging`** | Vercel API + Customer staging configured Firebase project IDs are equal and explicitly point here; distinct from the Production Firebase project |
| Supabase staging | **`LocalEats-Profile-Staging`** | Separate active healthy project from `LocalEats`, both in `eu-west-1` |
| API staging Vercel | **`localeats-api-staging-r52d`** | Separate Vercel project, latest deployment READY, Preview-only `LOCALEATS_STAGING_ONLY=true`, `FIREBASE_PROJECT_ID` matches the Customer stage; its `SUPABASE_URL` equals the separate staging Supabase project's API URL |
| Customer staging Vercel | **`localeats-customer-staging-r52d`** | Separate READY Vite project. `VITE_FIREBASE_CONFIG_SOURCE=environment`, complete Firebase public configuration, `VITE_FIREBASE_PROJECT_ID` matches API stage, `VITE_FIREBASE_FIRESTORE_DATABASE_ID=(default)`. Its configured API host is a registered domain of the API staging project |
| Merchant staging Vercel | **Not found** | The main Merchant Vercel project's generic Preview remains unsafe by default because it can reuse Production Firebase config; do not treat it as isolated |

The API staging Vercel project has separate Preview-only Firebase Admin credential entries and an API-side Supabase service-role entry. Their **existence** does not prove that the Firebase service-account's actual project scope has been tested. Do not disclose or paste the values. The API staging environment is not configured for Production; all inspected `PICKUP_WRITES_ENABLED` and `PROFILE_WRITES_ENABLED` values are `false`. Customer staging profile writes are also `false`.

The deployed staging API's `server.ts` mounts `previewReadOnlyGate`, which rejects mutation verbs on Vercel Preview; the deployed shared `authenticateFirebase` still calls **`verifyIdToken(token)` without `true`**. Strict revocation-aware middleware exists only in draft L3-N8D PR #196. The staged Merchant account route is not active.

## Staging database, verified READ ONLY

Supabase reports five empty application tables: `profiles`, `shops`, `menu_items`, `pickup_push_subscriptions`, `customer_push_test_attempts`. All have row-level security enabled. The view `public.shops_with_availability` exists and exposes exactly the owner-check columns required by the N8C Merchant contract (`id`, `owner_id`, `approval_status`, `archived_at`). It is defined with **`security_invoker=true`** and grants **no direct SELECT** to `anon` or `authenticated`. Supabase's security advisor reports five *informational* RLS-enabled/no-policy notices; in this service-role-only staging design those tables deny direct client access. This is not evidence of successful server-side service-role owner lookup, which still needs a staging-only authenticated test.

The `shops` table currently has **zero rows**, so no merchant can pass the N8C approved-shop owner lookup against that database until separately approved, disposable, **staging-only** shop fixtures exist. Previous user-created `tester`/`tester2` staging accounts were discussed in prior work, but this phase **did not independently access Firebase Auth or verify those accounts today**.

## Corrected Firestore staging database policy

Production Merchant uses a **named** Firestore database in its bundled Firebase configuration. The existing **separate** `localeats-staging` Firebase project instead explicitly uses its **`(default)`** Firestore database. This is a safe project-level separation *if* API, Admin SDK and Merchant staging app all explicitly select the same staging project and database. N8C's `openMerchantAccountFirestoreForReview` already supports `(default)`.

L3-N8F corrects the overly restrictive N8E **test-only** requirement for a newly named Firestore staging database. Its guard continues to reject an implicit/missing database ID, mismatched client/API databases, mismatched Firebase projects, and any staging target equal to Production; it now accepts explicit `(default)` **only when the entire separate-stage identity check succeeds**. Do not alter Production's named Firestore config.

## Remaining Merchant staging release gate

1. **Dedicated Merchant frontend target.** Set up a separate Vercel Merchant staging project (or an equivalently proven fully isolated branch target). On that target ONLY, use `VITE_FIREBASE_CONFIG_SOURCE=environment`, complete staging public Firebase web-app settings, `VITE_FIREBASE_PROJECT_ID=localeats-staging`, and **`VITE_FIREBASE_FIRESTORE_DATABASE_ID=(default)`**. Set `VITE_LOCALEATS_API_URL` to the dedicated API staging domain, `VITE_PICKUP_ORDERING_ENABLED=false`, and leave all Merchant profile/order/payment/Rider write gates off. Never copy Production's bundled Firebase project or credentials into this target. A new Vercel project may have plan/cost implications; review before creation.
2. **Stage API security cutover.** Apply N8D `verifyIdToken(token,true)` only to an expressly isolated API staging deployment after review; do **not** merge to Production as a byproduct. Confirm Admin service account project ID and explicit API `(default)` Firestore ID for staging; the N8D Merchant account API remains **unmounted and hard-off**.
3. **Safe owner fixtures.** After independent account isolation proof and permission for *staging-only* writes, create precisely two disposable approved Merchant shops mapped to two separate staging Firebase UIDs in the separate staging Supabase project. Never transfer or clone Production users/shops or permissions. Maintain an exact deletion/reversal record. The zero-row staging shops table means an owner-check test cannot currently succeed.
4. **Actual two-account admission.** On the isolated Merchant Preview, sign in A and B using staging-only accounts, verify token revocation/disabled-account rejection and owner A/B scoping via **read-only** API requests. A must not see B's shop/profile even transiently. Check environment-specific Firebase and Supabase targets before every request. Do not send credentials or Firebase ID tokens in chat, CI logs, PR comments or issue text.
5. **Separate later approval for persistence.** Profile writes are not authorized by an auth-only rehearsal. The N8D account API stays unmounted and writes hard-off. No live profile-save success or logout/relogin persistence is claimed.

## Automated review-only tests

`tests/l3-n8f/staging-resources.mjs` grades the pre-existing Customer/API resource evidence separately from Merchant read-only acceptance, and **never claims real Firebase authentication or profile writes**. `tests/l3-n8f/staging-resources.test.mjs` covers matching isolated resources, explicit staging `(default)` DB, broken ownership-view access controls, mismatched Production targets, missing Merchant stage, absent revoked-token deployment and fake two-account attestations. N8E's no-network rules are retained with the Firestore policy correction. GitHub CI uses fixture data with no hosted credentials, in addition to the existing API regressions and Merchant quality checks.

**Actual L3-N8F result:** Existing stage backend identified and its Supabase schema verified read-only; **Merchant frontend staging, real revoked-token testing, two approved owner fixtures and authenticated account A/B acceptance remain pending**. No new Firebase/Supabase projects are necessary. No Vercel environment/project settings, production API, security rules, GitHub main, Firebase users, Supabase rows, push notifications, orders, payments or account data were changed in this audit.
