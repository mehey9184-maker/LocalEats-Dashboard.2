# LocalEats R5.2D — Dedicated Vercel Customer/API Staging Shells

**8 November 2026 — R5.2D owner-authorized isolated Vercel setup.**
**STATUS: SHELLS CREATED, CREDENTIAL/DEPLOYMENT/HOSTED AUTH ACCEPTANCE BLOCKED.** These are real new Vercel projects, not test fixtures. No Git connection or deployment has been initiated. No existing Production or shared Preview project/env was modified.

## Live Vercel projects created, verified by connector

- Vercel team: `mehey9184-makers-projects`, account plan: **Hobby** when inspected.
- New Customer project: `localeats-customer-staging-r52d`, ID `prj_F4szeGF8BxmYpdUVA2yLYrjAmMUN`, framework `vite`.
- New API project: `localeats-api-staging-r52d`, ID `prj_eroDrVcFOPlvRJzjCU7vbwGnleFT`, framework `express`.
- Both were created **without linking Git** (`skipGitConnectDuringLink:true`) and with `previewDeploymentsDisabled:true`, no assigned domains, no latest deployment and zero deployments when read back. Vercel Authentication protection was reported enabled (`all_except_custom_domains`). No billing-plan change was made; check Vercel quotas before more builds.
- All variables created on these projects have target **Preview only**, with **zero Production targets**. No credential from the existing live Vercel projects was copied.

### Customer staging Preview configuration actually installed

| Variable | Status |
| --- | --- |
| `VITE_FIREBASE_CONFIG_SOURCE` | `environment` — strict, no bundled fallback |
| `VITE_FIREBASE_PROJECT_ID` | `localeats-staging` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `localeats-staging.firebaseapp.com` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `localeats-staging.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `805045126244` |
| `VITE_FIREBASE_FIRESTORE_DATABASE_ID` | `(default)` |
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_APP_ID` | Added directly to **new staging Vercel Preview environment** from owner-provided Firebase Web app config; deliberately **not** included in GitHub files, descriptions or reports |
| `VITE_PICKUP_ORDERING_ENABLED`, `VITE_PROFILE_WRITES_ENABLED`, `REWARDS_ACTIVATION_ENABLED`, `LOCALPAY_LIVE_WALLET_ENABLED` | All `false` |
| `VITE_LOCALEATS_API_URL` | **NOT SET**; no safely deployed API origin is known, so Customer must not deploy yet |

The browser Firebase Web app key is public-facing application configuration, not a Firebase Admin service-account key. The staging Web app's actual identity and Firestore deny-all rules are owner screenshot-confirmed. A project name, matching fields and web key do **not** prove hosted end-to-end recovery.

### API staging Preview configuration actually installed

| Variable | Status |
| --- | --- |
| `FIREBASE_PROJECT_ID` | `localeats-staging` |
| `SUPABASE_URL` | URL of the existing independent **LocalEats-Profile-Staging** Supabase project (verified from connected Supabase; no secret stored in repo) |
| `PICKUP_WRITES_ENABLED`, `PROFILE_WRITES_ENABLED`, `RIDER_ACTIVATION_ENABLED`, `REWARDS_ACTIVATION_ENABLED`, `LOCALPAY_LIVE_WALLET_ENABLED` | All `false` |
| `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | **NOT SET**; must be a staging-only service identity with no Production access, configured securely by an authorized account owner |
| `SUPABASE_SERVICE_ROLE_KEY` | **NOT SET**; must be the staging database's service key, NEVER Production's |
| API HTTPS Preview URL/CORS | **NOT AVAILABLE** until a safe isolated API build has been approved and deployed |

The API's current source requires the Admin project ID, client email and private key to verify Firebase tokens. Without these, authentication rejects access; it does not establish a usable staging API. The API also lacks a complete pickup order database: Profile-Staging has only `public.profiles`.

## R5.2D safety policy adjustment in API draft

`localeats-api/tests/rewards/r52/stagingIsolationGate.mjs` now supports **either** (1) exact-branch Preview-only secrets on an existing project **or** (2) a genuinely dedicated Vercel staging project with project ID distinct from known Production project IDs, independently reviewed nonproduction credential provenance, no inherited environment credentials, empty Production targets, and one Preview-only value per required key. Both modes still require exact deployed branch/SHA, HTTPS staging API match, matching stage Firebase issuer, separate Supabase DB, disabled write/financial flags, synthetic accounts and explicit hosted-test approval.

The **new empty project shells do not pass the hosted acceptance gate**. There are no deployments, the API Admin private key/email and staging Supabase service key have not been set, and Customer API origin is missing. Tests exercise synthetic metadata only. Nothing from the real Vercel projects or Firebase Web screenshot is committed as secret test data.

## Before linking Git or triggering deployment

1. Owner verifies the two new Vercel staging projects and their independent settings. Keep **Preview deployments disabled** until all provider and schema gates below pass. Do not attach a live domain.
2. Complete a reviewed, reversible, staging-only pickup schema in existing Profile-Staging, including actual availability functions/view and server-read compatibility. The prior `schema.SYNTHETIC_ONLY.sql` is **DO NOT APPLY TO HOSTED STAGING** and is deliberately not an equivalent migration. No Production rows should be copied.
3. Confirm a correctly scoped staging Firebase Admin identity and a staging Supabase service credential directly in the new API Vercel project. Do NOT paste sensitive values into ChatGPT, GitHub, shell history or browser `VITE_*` keys. Consider workload identity instead of long-lived private keys if infrastructure supports it; do not provision anything paid without approval.
4. Verify that `FIREBASE_AUTH_EMULATOR_HOST` is absent from hosted API; verify Client/App staging Firebase `localeats-staging` matches Admin verifier and differs from original `localeats-5e26e`.
5. Review Customer Web API-key restrictions/authorized domains for the isolated Preview and ensure HTTPS API URL + CORS allowlist agree. Leave Customer/merchant Firestore browser rules deny-all until their real read paths are reviewed, as this could otherwise prevent UI features from loading.
6. When exact Source HEAD SHAs and all credentials have been reviewed, link **only** the new staging projects to the correct repositories (Customer `mehey9184-maker/LocalEats-app`, Vite at root; API `mehey9184-maker/LocalEats-Dashboard.2`, Express rooted at `localeats-api`). A Git link can trigger builds automatically: do NOT link before staging is safe. Avoid changing original live projects or their Git connections.
7. Enable isolated Preview deployments and verify committed branch, exact SHA, effective credentials (by safe metadata checks; never print secrets), disabled writes and zero Production endpoints. Separately approve synthetic Firebase test-user creation/revocation and browser tests. No merchant ordering, wallets, payments or Live activation.

## Outcome

**R5.2D Infrastructure shell creation and initial safe Preview configuration: DONE.** **Real hosted Customer/API deployment, Firebase Admin verifier, complete Supabase stage schema, synthetic user flows and browser acceptance: NOT DONE / BLOCKED.** No Production Vercel, production Supabase, live Firebase, production DB, merchant money, customer order, LocalPay credit or PR merge was changed.
