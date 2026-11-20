# L3-N8T — Staging-only Merchant/Customer API origin pairing (2026-11-20)

**Change type:** dedicated Vercel Merchant staging project **Preview environment-variable change only** plus source-only audit/smoke preparation. No Production, database, Firebase project or published rules changed; pickup/write flags remain OFF. This report does not claim signed-in acceptance or public pickup availability.

## Exact before / after (rollback available)

| Project | Setting | Before | After |
|---|---|---|---|
| `localeats-merchant-staging-r52d` (`prj_dtGKm1i2PIzvmENGjYt4OLZUtMpw`) | `VITE_LOCALEATS_API_URL`, **Preview only**, variable ID `yjrnWtQTj3nytKmp` | `https://localeats-merchant-api-stage-r52d-mehey9184-makers-projects.vercel.app` | `https://localeats-api-n8o-r52d-mehey9184-makers-projects.vercel.app` |
| `localeats-customer-staging-r52d` | `VITE_LOCALEATS_API_URL` | unchanged | `https://localeats-api-n8o-r52d-mehey9184-makers-projects.vercel.app` |

Vercel confirmed the Merchant env value after the scoped edit. **An env-value update alone does not change already-built Vite JavaScript.** Require a new immutable Merchant Preview built after the change; confirm the **runtime app bundle** contains the new URL and `localeats-staging` before claiming actual pairing. The previous dedicated staging Merchant alias still resolved to old N8G commit `53ab4d2431f0c9c14d7f1eda1998e4042375174d` at the time of this check; don't claim it changed without verifying a new alias mapping.

**The N8O API alias** was independently resolved through Vercel to immutable READY deployment `dpl_2niWsguJjx9EiqNL4wdN9b5tjtyw`, commit `e3f18449abd5383180a065ab05cb2fd68bd9ec5c` on `review/l3-n8n-paired-preview-preflight`. **Customer N8O** alias resolved to READY `dpl_9rmHDYtzCqvH9vVKqEQD2nbmk1jB`, commit `42a1d91522bd42cd07703dce7164a5bebccbd218`. These are the reviewed immutable pair; the Merchant API origin now points there in the **Preview config**, but no authenticated customer/merchant transaction was performed.

## Security preconditions checked before Preview-only edit
- Staging Firestore `localeats-staging/(default)` latest starred Rules entry, Nov 8 2026 8:52 PM, has `allow read, write: if false`. The Admin SDK bypasses those client rules and needs separate server permissions.
- Dedicated Merchant staging Vercel project: `VITE_FIREBASE_PROJECT_ID=localeats-staging`, `VITE_FIREBASE_FIRESTORE_DATABASE_ID=(default)`, `VITE_FIREBASE_CONFIG_SOURCE=environment`, `VITE_MERCHANT_STAGING_ONLY=true`, `VITE_MERCHANT_PREVIEW_READ_ONLY=true`, `VITE_PICKUP_ORDERING_ENABLED=false`. L3-N8S adds a project-ID-backed deny-write browser guard; it has NOT yet been proven in hosted browser.
- Dedicated stage API Vercel project: `FIREBASE_PROJECT_ID=localeats-staging`, `SUPABASE_URL=https://rgpbdajhlrwfmhopzgzk.supabase.co`, `LOCALEATS_STAGING_ONLY=true`, `PICKUP_WRITES_ENABLED=false`, `PROFILE_WRITES_ENABLED=false`, `MERCHANT_ACCOUNT_WRITES_ENABLED=false`, `MERCHANT_AVAILABILITY_WRITES_ENABLED=false` and exact `MERCHANT_STAGING_ORIGIN` and `CUSTOMER_APP_ORIGIN`. `merchantStageCors.ts` checks exact origin/project/database/off flags at server side before allowing Merchant staging CORS.
- `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` exist as sensitive staging API Vercel variables. The connector **did not expose the service-account email** when read through the permitted view, and **private key was not requested**. Therefore actual Firebase Admin credential project, validity and hosted verified-token checks remain **unattested**. Do not claim a successful authorized login or owner mapping.
- Direct HTTP from this agent environment was unavailable (DNS unable to resolve `.vercel.app`), and the text web fetch could not access the app; use external GitHub CI's safe GET/OPTIONS smoke tests for accessible browser CORS evidence. Those requests carry no tokens and may fail due deployment protection.

## Read-only acceptance requirements
1. Build a **new immutable Merchant staging Preview from the reviewed guarded source commit**, targeting the dedicated stage project only. Verify **Vercel READY**, exact commit, Preview target and built API/Firebase project strings; don't affect Production aliases.
2. Test public `GET /health`, safe CORS `OPTIONS` requests and unauthenticated `GET /api/v1/merchant/shop` (must be 401) from the **two exact staging origins**, with no Authorization headers or writes. Distinguish Vercel protection redirects from app CORS/401 behavior. Negative-case wrong origin must be blocked.
3. Verify the real stage Admin SDK identity safely (e.g., controlled staging-only verification with owner-scoped disposable account), and actual customer/merchant browser network calls. **No user IDs, ID tokens, private keys, service-role keys, passwords or device tokens in documentation.**
4. Once the two browser clients and read-only API tests have passed, use separate approval for a narrowly isolated authenticated A/B test. SQL staging hard-off triggers remain active until separate reviewed stage-only migration. Production ordering remains OFF.

## Rollback
Restore only the Merchant **Preview** value of Vercel variable ID `yjrnWtQTj3nytKmp` to:
`https://localeats-merchant-api-stage-r52d-mehey9184-makers-projects.vercel.app`;
then rebuild the previous reviewed Merchant staging commit (or re-alias an immutable known-safe staging deployment), verify `VITE_PICKUP_ORDERING_ENABLED=false`, and confirm API/project pairing matches expected rollback. Do not modify the Production Merchant or Customer projects or their DNS aliases.

**Release verdict:** Stage-only API configuration paired; hosted re-build, credential-safe identity, browser CORS and authenticated pickup still require verification. Do not merge draft PRs or activate writes.
