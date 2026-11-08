# LocalEats R5.2 — Hosted staging isolation, auth recovery gate

**8 November 2026 | Approved limited draft scope. Outcome: hosted tests STOPPED (not independently isolated).**

Read-only Vercel inspection identified the API project as localeats-api and the Customer project as project-x7cvt. API Firebase Admin variables (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) and Supabase variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) are scoped to both Preview and Production rather than verified branch-only staging values. Customer VITE_FIREBASE_PROJECT_ID, API_KEY, AUTH_DOMAIN etc likewise have Preview+Production target scopes. Older branch-scoped Preview values exist but DO NOT establish correctness or isolation for current PR branches.

No deployment was found for the Customer PR #82 exact branch docs/rewards-master-handover-pointer-20261108 or API PR #124 exact branch docs/rewards-master-plan-credit-20261108 in the read-only branch-filtered Vercel deployment queries. No decrypted values, project data, authentication sessions, customer/merchant accounts, SQL, payment records or real hosted endpoints were accessed. This is a **failure of isolation evidence**, not a claim that shared scopes prove an active Production write gate.

## Draft policy and offline evidence
- localeats-api/tests/rewards/r52/stagingIsolationGate.mjs defines a fail-closed contract requiring exact READY Preview branches/commits, independent Firebase Customer/API identity source from Production, separate Supabase staging DB, verified HTTPS staging API origin, branch-scoped Preview-only critical vars, all write/payment gates off, synthetic accounts and deliberate acceptance authorization.
- stagingIsolationGate.test.mjs uses ONLY synthetic metadata: it must reject the ACTUALLY OBSERVED failure shape (no exact branch deployments, shared Preview/Production scopes, unknown backend/DB identities), and reject synthetic wrong commit, shared credentials, Production Firebase/DB reuse, and write-enabled cases. A hypothetical independent config passing the policy is NOT actual staging certification.
- .github/workflows/localpay-r52-hosted-staging-preflight.yml runs read-only tests without Vercel/Firebase/Supabase credentials and without any hosted network call. Never treat green PR CI as hosted acceptance.
- The Customer PR #82 adds optional strict environment-only Firebase configuration; this prevents a consciously configured staging build from silently falling back to a known bundled Production Firebase project. Existing production/default behavior remains unchanged.

## Required future evidence before hosted session testing

1. Dedicated nonproduction Firebase Auth project and correct Firebase Admin issuer/audience/project for API and Customer, distinct from actual Production; no real customer or merchant identities.
2. Dedicated nonproduction Supabase project and disposable synthetic profiles/shops/history; RLS/permissions and credentials proven isolated and no Production data copied.
3. Dedicated Vercel projects or reviewed exact-branch Preview-only env scopes for every Firebase/Supabase secret and Firebase public config; no Preview–Production credential collision; check effective scoped config without printing secret values.
4. Customer strict VITE_FIREBASE_CONFIG_SOURCE=environment with all fields; API URL HTTPS staging-only and exact matching API deployed commit; explicit disabled pickup/customer/merchant/profile/rewards/payments write gates.
5. Read-only confirmation that Vercel Preview deploys target precisely the PR head SHA; then independently approve intentional staging synthetic user sign-in, revocation, re-login, logout, disabled user, guest, account A/B switching, 401 versus network error, stale private read, merchant ownership changes.
6. Measure browser/mobile performance only on isolated staging. Never use localhost Emulator latency as an SA mobile result, and never accept Merchant/API isolated regression as permission to enable ordering.

## Status

R5.2 code/CI/docs: DRAFT POLICY ONLY. R5.2 REAL HOSTED STAGING: **BLOCKED**. No Production deployment, database write, Firebase revocation, feature flag change, merchant payout, reward credit, order creation, PR merge, Super Admin release or LocalPay activation.


### Additional read-only Supabase project discovery (8 November 2026)
The connected Supabase account lists two independently identified active project references: **LocalEats** and **LocalEats-Profile-Staging**. The latter is a real separate project resource, so creation of another Supabase project may be unnecessary IF this staging project is suitable. It has NOT been proven to be the API PR's effective database or to contain appropriately synthetic pickup test data. Vercel still has unverified Preview/Production-overlapping SUPABASE_URL and service-role credential scopes, no exact current draft deployment, and Firebase isolation is not established. Do not redirect deployed applications, reuse Production credentials, query customer records, migrate schema, or create data without a reviewed isolation plan and owner approval.
