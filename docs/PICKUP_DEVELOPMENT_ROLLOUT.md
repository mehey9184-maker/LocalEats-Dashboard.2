# Pickup development deployment preparation

Prepared 2026-10-28. Local changes only; this document does not authorize push, SQL, settings changes or deployment. Preserve Rider implementation/history, main and unrelated records. Existing deployment exclusions stay false until separately approved staged enablement.

## Baselines and effective configuration

Customer baseline 7c32d0f7bc63af469be7a96f202b8ac778db4215; Merchant/API baseline 48015f49ab188e96b162bf8df4646985452402ba. Both on launch/pickup-only-pilot-01, initially clean. Owner verified roots: Customer ./; Merchant ./; API localeats-api/. Standard configuration files are each root's vercel.json, including localeats-api/vercel.json. Connector omits custom configuration path overrides; their absence is not verified. Verify effective files before enabling deployments.

## Minimum schema and cutover

Keep supabase/drafts/pickup_launch_foundation.sql unchanged. Four nullable orders columns (delivery_type, payment_status, create_intent_hash, revision), three tables (events/inbox, subscriptions, outbox) and service-only transactional functions are already the narrow safe contract. No historical backfill, default pickup/payment inference, active/archived migration application or Rider schema edit. Current API requires pickup-v1; old quote/create requests receive 426 before catalog/persistence. RPC/schema failure cannot manufacture order confirmation.

Known schema evidence is representative fixture/migration source, not a current deployed schema dump. Before approval compare the actual target's types, idempotency unique index, required defaults/nullability (including omitted delivery proof fields), catalog columns, privileges, RLS, existing triggers/functions and object collisions. Check legacy writers in deployed main, old browser caches, Firestore/Cloud Functions, root Express /api/orders and service-role jobs. SQL guard blocks browser mutations and all unclassified new Postgres inserts, while retaining authorized legacy delivery updates. Applying it changes shared behavior immediately, even if only Preview code is being deployed.

A database rejection cannot remove a fabricated-success fallback from an already deployed legacy UI, nor stop a Firestore-only write. Therefore freeze legacy NEW ordering paths during cutover or use a separately approved isolated development database with verified schema/catalog and available no-cost allowance. Do not assume main is untouched operationally just because its commit is unchanged. Do not disable assigned Rider continuation/history. If affected legacy entrypoints cannot be controlled, STOP before applying schema; do not relax the guard or allow ambiguous inserts.

Capture a recoverable schema/data export before approved DDL. Apply this draft once, as one transaction; it is not idempotent and must not be blindly rerun. Its 5-second lock and 30-second statement timeouts fail rather than waiting indefinitely. Existing data/type/object drift must be resolved by a reviewed adjustment, not a speculative backfill. Verify committed objects/grants and API transaction behavior after application. No SQL was executed in this preparation pass.

## Preview settings to configure later

All changes below are PREVIEW, preferably scoped to launch/pickup-only-pilot-01; never edit the shared Production+Preview entry when intending a branch-only override.

Customer project-x7cvt and Merchant local-eats-dashboard-2-6m8o:
- VITE_LOCALEATS_API_URL: exact verified API Preview HTTPS ORIGIN, no /api/v1 path, credentials, query or fragment. Both compiled pickup apps now reject missing/invalid origins before fetching tokens or issuing requests. Vite dev/fixture proxy remains local-only; production build does not use it.
- Verify the coherent existing VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_MESSAGING_SENDER_ID and VITE_FIREBASE_APP_ID set against API Firebase Admin's project. Both committed fallback configs use localeats-5e26e; actual deployed value agreement remains unverified. Older env examples contain a different Firebase project; do not copy them blindly. Enable existing email/password test accounts and verify shop owner_id equals the Merchant Firebase UID. Check Firebase authorized domains/provider restrictions for the chosen stable Preview origins.
- Optional Customer VITE_FIREBASE_VAPID_KEY for best-effort FCM; omit until verified. In-app Ready is required regardless of push permission/provider availability.
- Never configure VITE_SUPABASE_SERVICE_ROLE_KEY, VITE_FIREBASE_PRIVATE_KEY or other private credentials. Public Firebase web configuration is distinct from Admin credentials.

API localeats-api:
- SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY: server-only, explicitly approved data target. Existing Preview and Production share entries; Preview is NOT isolated automatically.
- FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY: server-only coherent existing Admin credentials matching both browser projects; verify privately without printing values.
- MERCHANT_DASHBOARD_ORIGIN: exact stable Merchant Preview browser origin.
- CUSTOMER_APP_ORIGIN: exact stable Customer Preview browser origin; currently absent in metadata. No wildcard or trailing slash. Existing Merchant preview prefix/suffix matching is retained but is not a substitute for Customer authorization. Do not widen it to all vercel.app hosts. Exact origin settings allow planned stable branch URLs before clients deploy; verify actual URLs when issued.
- Preserve RIDER_APP_ORIGIN, SUPER_ADMIN_ORIGIN and other existing Rider/history settings. Keep DELIVERY_PROOF_SECRET where required for existing legacy delivery proof reads; do not rotate it for pickup.

Metadata rechecked without decrypting values: Customer lacks VITE_LOCALEATS_API_URL; Merchant API URL is shared Production+Preview; both Firebase web sets are shared; API database/Admin entries are shared Production+Preview and CUSTOMER_APP_ORIGIN is absent. Configuration cannot prove credentials match, permissions work, domains are authorized, or target data is disposable.

## Ordered execution after separate approval

0. Approve exact target/data exposure, current service plan/usage/commercial eligibility and effective Vercel config paths. Vercel plan/usage and Firebase quotas remain unverified; a costs_not_found response is not zero usage. Hobby's non-commercial personal-use restriction is not waived by calling this development. No paid upgrade, new queue, scheduler or permanent worker. Use only confirmed existing free-capable allowances; otherwise stop. Identify test customer/merchant UIDs, shop/menu IDs and retain each generated order UUID/idempotency key in an explicit manifest. Never clean up by date/name/status alone.
1. Approved schema: inventory/freeze affected new-order writers, capture recovery export, apply only the approved draft transaction, verify target schema/permissions. Existing managed history/payment facts must be preserved on any rollback.
2. API Preview: configure server-only Preview settings and exact client origins; leave BOTH frontend exclusions false. Change ONLY localeats-api/vercel.json exact branch rule to true. From Merchant/API worktree, after JSON/diff review:

```powershell
git add -- localeats-api/vercel.json
git commit -m "chore: enable pickup API development previews"
git push origin HEAD:refs/heads/launch/pickup-only-pilot-01
```

These commands are proposed only, NOT executed. Verify deployment SHA/root/Express entrypoint src/server.ts and read-only GET /health (200 is not database/auth readiness). An unauthenticated GET /api/v1/orders must return JSON 401. A signed-in test Customer GET must use Bearer fb- plus its real Firebase ID token and return only its own orders. Old quote/create contract must return JSON 426. Missing RPC/auth/config must fail honestly, never synthesize success. Do not put ID tokens in shell command lines or logs.
3. Merchant Preview: set its branch-scoped VITE_LOCALEATS_API_URL and coherent Firebase config; verify API OPTIONS/POST allows only intended origin and required headers/methods. Change ONLY root vercel.json rule to true, commit and push the Merchant branch. This push may rebuild API too: reverify deployment SHAs. Keep main untouched.
4. Customer Preview: configure its branch-scoped API URL/Firebase set, Customer origin in API and optional VAPID. Then change Customer root exclusion to true, commit and push its branch. Keep fixture=1/emulator modes OFF; Vercel Preview is a production Vite build.

For stages 3 and 4, from the corresponding worktree after only the reviewed config change:

```powershell
git diff --check
git add -- vercel.json
git commit -m "chore: enable pickup client development previews"
git push origin HEAD:refs/heads/launch/pickup-only-pilot-01
```

No main push/merge or --prod promotion. Frontend Vite settings are compiled and require a later approved rebuild when changed. Cross-origin requests must pass CORS and any Vercel deployment protection without exposing a protection bypass token in frontend code.

## Short live verification and rollback

After approved rollout only: two real test accounts, one approved active Tembisa/Ivory Park shop and real menu within 4 km. Quote server prices, create once, retry original intent after a lost response and confirm same order. Merchant accepts (Preparing), marks Ready; refresh Customer and confirm durable inbox. Collection while unpaid fails; explicitly confirm actual test cash/card-machine payment, then actual test handover and Collected; refresh/history persists. Check pending rejection/cancellation, expired auth and cross-customer/shop denials. No lengthy synthetic journey rerun required. Push denial/failure must not hide Ready or alter order facts. Do not run real commercial transactions until hosting eligibility is confirmed.

Rollback: stop new testing and disable branch deployment triggers as a later approved action; disabling a trigger does not unpublish existing Preview URLs. Remove access to affected Preview entrypoints as separately approved. Retain schema, orders, audit/payment/collection facts and use a compatible API or read-only managed orders. Never roll back mutations to a legacy API that bypasses new facts; never delete history or infer paid from Collected. Preserve unresolved idempotency commands. Any test-data cleanup or compensating event requires separate approval.


## Validation in this preparation pass

- Focused mocked API/CORS/service tests: 13/13 passed. Initial sandbox loopback EACCES was resolved by rerunning those same tests with local loopback permission; no Firebase/Supabase provider calls or SQL.
- Customer pickup client tests: 6/6 passed. Merchant pickup client tests: 6/6 passed.
- API TypeScript build, Customer full TypeScript and Customer/Merchant production builds: passed. Merchant build retains existing unresolved assets/map-bg.png warning.
- Merchant active pickup entry TypeScript: passed. Full Merchant TypeScript: 62 existing diagnostics in untouched legacy screens/components. An in-memory HEAD-source comparison against the working tree found the exact same 62 diagnostics and zero new ones; no legacy files were rewritten.
- JSON deployment exclusions unchanged, git diff --check and added-line secret-pattern scans passed. Pattern scans do not prove every possible secret format.
- SQL draft, active/archived migrations, Rider implementation and all deployment exclusions unchanged. No SQL (including disposable SQL), browser journey, provider/settings change, push, deploy or data cleanup performed.
- Remaining gates: actual target-schema/writer compatibility and recoverable backup, approved cutover/SQL, effective config discovery, privately verified Firebase/project alignment, branch-scoped Preview API/CORS settings, hosting eligibility/usage and ordered deployment approvals.
