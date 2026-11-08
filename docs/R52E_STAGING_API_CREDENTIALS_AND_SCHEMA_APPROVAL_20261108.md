# LocalEats R5.2E — Secure staging API credentials and pickup schema preparation

**8 November 2026 | Owner requested R5.2E.**
**Status: staging source safeguards and read-only schema review prepared; hosted credentials, schema migration and deployment NOT completed.**

## 1. Actual staging state, independently checked (read-only)

- New Vercel staging API: `localeats-api-staging-r52d`, ID `prj_eroDrVcFOPlvRJzjCU7vbwGnleFT`. Separate from live `localeats-api` (`prj_TeDwYT5LKfy5Rd66qszwglC9Ft0r`). No Git connection, no domain and zero deployments. All configured variables target **Preview only**. No Production-targeted environment variable.
- Current API staging Vercel settings: `FIREBASE_PROJECT_ID=localeats-staging`, `SUPABASE_URL=https://rgpbdajhlrwfmhopzgzk.supabase.co`, `LOCALEATS_STAGING_ONLY=true`, with pickup/profile/rider/Rewards/LocalPay writes set to `false`.
- Current API staging project **does not have** `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `SUPABASE_SECRET_KEY` or `CUSTOMER_APP_ORIGIN`. This absence is INTENTIONAL; it must refuse startup and cannot be used for browser tests.
- New Customer staging project `localeats-customer-staging-r52d` has the complete Firebase WEB config from owner screenshots but still **no `VITE_LOCALEATS_API_URL` and no deployment**.
- Connected Supabase `LocalEats-Profile-Staging` is a real separate project. Its `public` schema currently includes just `profiles` (column `user_id` text, profile fields, RLS enabled) and **zero** of the required `shops`, `menu_items`, `orders`, `pickup_order_events` tables, `shops_with_availability` view or `shop_effective_open`/`shop_schedule_open` functions. Existing migration count was 1 and identified as `create_isolated_profile_staging_p5`. No table rows or customer data were read, and no SQL changes were applied.
- The owner's screenshots show real `localeats-staging` Firebase with Email/Password enabled and Firestore browser rules deny-all. They do NOT establish backend Admin credentials, test accounts or hosted acceptance.

## 2. API implementation in draft PR #124, no Production behavior change

Files:
- `localeats-api/src/lib/r52eStagingSafety.ts`: pure opt-in preflight `LOCALEATS_STAGING_ONLY=true` which **throws** before API initialization unless `VERCEL_ENV=preview`, expected staging Firebase project/service-account identity, PEM-shaped private key, separate Supabase project URL, modern `sb_secret_` Supabase secret key, exact HTTPS `.vercel.app` Customer origin, and all pickup/profile/rider/Rewards/LocalPay write flags are literally `false`. Rejects Firebase Auth Emulator override, Production database URL and legacy `SUPABASE_SERVICE_ROLE_KEY` in this dedicated stage mode. Logs error CODES only; never logs keys.
- `localeats-api/src/lib/firebaseAdmin.ts` and `supabaseAdmin.ts` call this check. The latter accepts `SUPABASE_SECRET_KEY` in **opted-in staging only**. When `LOCALEATS_STAGING_ONLY` is absent, existing Production Firebase/Supabase startup and legacy key selection are unchanged.
- `localeats-api/src/corsOrigins.ts` admits only the configured HTTPS staging Customer origin for browser calls when opted in, not `www.localeatssa.co.za`, any Merchant origin, or arbitrary Preview. Normal Production CORS rules are retained.
- `localeats-api/tests/r52e/stagingCredentials.test.mjs` uses FAKE never-valid secrets and pure functions; offline PR-only workflow `.github/workflows/localpay-r52e-staging-secret-guards.yml`. Earlier R5.2 isolation acceptance now demands a modern `SUPABASE_SECRET_KEY` (not legacy) from a dedicated API staging project. All former branch-scoped compatibility checks are retained.
- The opt-in validation is an additional guard, **not verification** that an actual service-account credential or Supabase secret belongs to the intended provider account. Provenance must be independently reviewed at setup.

## 3. Owner-only sensitive credential setup — still required

**Do not paste secrets, JSON, screenshots showing keys, or private-key blocks into ChatGPT, GitHub, terminal history or any `VITE_*` browser variable.**

A. In the Firebase Console, select ONLY `LocalEats Staging` → Project Settings → Service accounts. If a service-account key is approved for this non-Google server host, generate and securely retain the downloaded JSON locally. Long-lived keys have security risk; a workload identity approach can be evaluated if supported. Copy `client_email` and `private_key` DIRECTLY into **new staging API Vercel project** → Settings → Environment Variables as `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY`, with **Preview only / Sensitive**. Ensure the email belongs to `localeats-staging.iam.gserviceaccount.com`, not live Firebase. Project ID is already set. Never upload JSON to the Customer app or GitHub. Firebase documents this for non-Google environments: https://firebase.google.com/docs/admin/setup

B. In Supabase, select ONLY `LocalEats-Profile-Staging` → Project Settings / API Keys or Connect. Use a modern **server-side secret key** (prefix `sb_secret_`) for that staging project. Paste it DIRECTLY into new API staging Vercel project as `SUPABASE_SECRET_KEY`, **Preview only / Sensitive**. Do not set the deprecated `SUPABASE_SERVICE_ROLE_KEY` in this isolated staging project. Modern Supabase secret keys are privileged and bypass RLS, so never put them in browser env or code. https://supabase.com/docs/guides/getting-started/api-keys

C. `CUSTOMER_APP_ORIGIN` must be set only after the protected Customer staging Preview HTTPS URL is known, verified and approved. Do not invent a host. The API and Customer URLs have a bootstrap dependency; plan the safe order before enabling Git or deploying. No API deployment is authorized by this preparation. Never attach real LocalEats Production domains.

D. Keep all five write gates false, `LOCALEATS_STAGING_ONLY=true`, and `FIREBASE_AUTH_EMULATOR_HOST` unset in the stage API. Do not create test users or revoke any account until exact commit/backend issuance is verified.

## 4. Pickup database preparation — hosted change remains OPEN

The staging `public.profiles` table exists (and has RLS), but pickup reads also depend on:
- `shops`: shop ID text, approval/ownership/active status, coordinates, schedule;
- `menu_items`: menu ID text, shop ID, price NUMERIC, availability;
- `orders`: order ID UUID, Firebase UID text, shop ID, items JSONB, statuses, revision BIGINT;
- `pickup_order_events`: UUID event and command identities, order UUID, actor UID and revision BIGINT, unique command/revision invariants;
- `shops_with_availability` **and** `shop_effective_open` / `shop_schedule_open`: real effective shop-open logic required for accurate Customer browse/eligibility and Merchant UI.

The R5.2C SQL in `localeats-api/tests/pickup/r52c/schema.SYNTHETIC_ONLY.sql` is a **disposable PG17 laboratory only**; its view ALWAYS reports shops closed and it deliberately refuses hosted database execution. **DO NOT APPLY TO PROFILE-STAGING OR PRODUCTION.**

A future separate staging-only migration must be produced from a reviewed schema diff, with migration history, RLS grants, profile compatibility and real availability functions verified, reversible strategy, zero copied Production rows, and tightly scoped synthetic fixture approval. Do not create orders, mark payments, grant Rewards, or write LocalPay balances as part of this phase. Migration must be expressly approved by the founder before it is applied to `LocalEats-Profile-Staging`.

## 5. Acceptance evidence and scope

- Draft-only API code, synthetic negative tests and historical regression workflows can pass now.
- Real API credentials and deployment CANNOT be claimed complete: both key classes and Customer origin are missing.
- Hosted pickup schema absent: staging data is not yet compatible with API pickup-history/merchant reads.
- No real browser Firebase revocation, sign-in, disabled account, cross-account switching or latency test is authorized until complete independent project/secret provenance, exact branch SHA, read-only policies, verified staging-only endpoints and separate synthetic account approvals.
- Preserve the original Customer/Merchant UI/UX, Pickup-first pay-at-shop launch and no live orders. All PRs DRAFT/UNMERGED. No Production, data-write, cost, Firebase rules or LocalPay activation was performed.

**Current owner gate:** securely enter `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` and `SUPABASE_SECRET_KEY` directly into ONLY the new staging API Vercel project when comfortable with the scope; do not provide credentials to chat. The hosted migration and first safe deployment require separate review and approval.
