# L3-N8E — LocalEats Merchant hosted staging identity audit

**Date:** 20 November 2026 (read-only). **Verdict: BLOCKED for real A/B staging authentication.**

This is a configuration verification note, **not** permission to create accounts or perform writes. No credentials, tokens, personal records, Supabase keys, private Firebase keys, real user identifiers or value-bearing environment dumps belong in this file.

## Evidence inspected
- Vercel team `mehey9184-makers-projects`: projects `localeats-api` and `local-eats-dashboard-2-6m8o`.
- Latest READY Production deployment for each project (both from source SHA `a5168ccbbb37643a58ad4202c72b65dd43149c2e` on 19 Nov 2026).
- Vercel project environment **metadata** (key names, environment targets and branch scope; do not publish values).
- Targeted read of API's non-secret Firebase **project identifier only**, compared in memory with the checked-in Merchant `firebase-applet-config.json` project identifier; identifiers matched. No API private key or service email value was requested or exposed.
- Deployed `src/lib/firebase.ts` and `localeats-api/src/middleware/authenticateFirebase.ts`, `localeats-api/src/server.ts`, and dormant N8D draft source.

## Read-only findings

| Gate | Observation | Status |
| --- | --- | --- |
| API Firebase project vs deployed Merchant bundle | API configured `FIREBASE_PROJECT_ID` equals bundled Merchant `projectId` | **PASS (project identifier only)** |
| Full Firebase Admin service-account identity | Credential variable names exist, but the actual service-account email/project and revocation behavior were not verified | **UNVERIFIED** |
| Merchant Firestore database | Deployed Merchant source selects `firebase-applet-config.json.firestoreDatabaseId` (named database) unless opt-in `VITE_FIREBASE_CONFIG_SOURCE=environment` | **CONFIRMED CODE PATH** |
| API named Firestore database | No configured `MERCHANT_FIRESTORE_DATABASE_ID` / `FIREBASE_FIRESTORE_DATABASE_ID` was found in API project variable names | **MISSING FOR N8D COMPOSITION** |
| Merchant isolated config opt-in | No `VITE_FIREBASE_CONFIG_SOURCE` or `VITE_FIREBASE_FIRESTORE_DATABASE_ID` project env metadata was found | **MISSING** |
| Separate Vercel custom staging environment | Neither project lists a custom staging environment | **NOT FOUND** |
| API Firebase credentials Production/Preview | Same project-level variable entries target **both Production and Preview** | **NOT ISOLATED** |
| API Supabase credentials Production/Preview | Same project-level `SUPABASE_URL` and service-role entries target **both Production and Preview** | **NOT ISOLATED** |
| Separate isolated merchant users A/B | No independent staging Firebase project and two approved synthetic accounts were verified | **UNVERIFIED/BLOCKED** |
| Deployed revoked-token middleware | Production shared `authenticateFirebase.ts` still calls `verifyIdToken(token)`; N8D draft adds `verifyIdToken(token,true)` | **UNDEPLOYED SECURITY CHANGE** |
| Active Merchant profile API | Production `server.ts` does not mount the N8B–N8D account router | **NO LIVE PROFILE SAVING** |

The read-only Vercel project information confirms variable entries exist, **not** that encrypted or sensitive values were exposed. The Merchant `VITE_FIREBASE_PROJECT_ID` value itself is sensitive in Vercel's UI and could not be decrypted; the deployed Merchant app defaults to its *bundled* Firebase project unless the explicit environment opt-in is enabled. Project ID matching alone does **not** prove the Admin service account, Firebase Auth backend, named Firestore database, or hosted Supabase isolation is correct.

No claim about real Firebase session revocation, enabled accounts, account isolation or user persistence can be made from synthetic CI alone. **Do not use the current Preview as a safe two-account testing environment.**

## N8E automated fail-closed gate

`tests/l3-n8e/staging-readiness.mjs` is a pure, offline, **configuration eligibility** check. It requires an explicitly selected environment-based client Firebase configuration, a distinct staging Firebase project with matching Merchant/API/Admin service-account project IDs, exact matching **named** Firestore database IDs, a separate staging Supabase project, all account/order/availability writes disabled, read-only API admission, and exactly two independently attested staging-only account IDs. It never consumes secrets or performs network requests.

Its result always states `evidence: configuration-only` and `realFirebaseAuthenticationVerified: false`, even when synthetic identities pass the preconditions. `tests/l3-n8e/staging-readiness.test.mjs` verifies the rejection cases with fake identifiers and checks the real source retains the unmounted, read-only boundary. The test manifest uses **variable key names only**, never environment values.

## Blocker resolution, by separately approved stage setup

1. Provision or identify a **separate Firebase staging project**, with a project-scoped Firebase Admin service account that cannot access Production and with a dedicated (possibly same *name* but different project) named Firestore database.
2. Provision or identify an **isolated Supabase staging project**; do not reuse the current API's Production/Preview service-role target. Verify host/project identity, never paste keys into chat.
3. Configure a strictly branch-scoped/isolated Vercel staging target for the Merchant and API; set the Merchant's `VITE_FIREBASE_CONFIG_SOURCE=environment` plus all complete staging Vite Firebase options and the explicitly named `VITE_FIREBASE_FIRESTORE_DATABASE_ID`. Set the API `FIREBASE_PROJECT_ID`, Admin credential, explicit named Firestore ID, and isolated Supabase server credentials. Every write gate remains **OFF**.
4. Verify the intended deployed commit and environment, valid Firebase Auth application and Firestore Admin connection using **read-only, nonsensitive probes only**, preferably with a short-lived staging-only token, approved after the environment is independently verified.
5. Only after identity separation is established, register two fresh staging-only accounts **within that staging project**, verify Firebase revoked/disabled-account admission and **read-only** per-owner shop authorization with no cross-account leakage. Do not use real merchant, order or customer records.
6. Stage-only profile persistence, actual save/read-back/relogin and a future write endpoint remain a separate approval: N8D hard-codes disabled writes, the Merchant app still honestly rejects legacy profile save.

**No live/staging authentication or Firebase Admin service account was used in N8E.** No Production, Preview settings, GitHub main, Firebase users/Firestore, Supabase, SQL/rules, billing, Rider activation, payments, orders, FCM notifications or feature flags were modified. PRs #191, #193, #195 and #196 remain drafts; N8E changes only review/CI/docs.
