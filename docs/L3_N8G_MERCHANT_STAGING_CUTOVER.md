# L3-N8G — Merchant staging Preview and strict Firebase cutover (draft-only)

> **N8H current hosted configuration (20 November 2026):** A dedicated Merchant Vercel Preview and a separate, branch-specific API address now exist. The Merchant Preview uses `https://localeats-merchant-api-stage-r52d-mehey9184-makers-projects.vercel.app`, **not** the original Customer staging API canonical URL described in the N8G preparation plan below. The N8H source build guard and CI enforce this corrected API target. See `docs/L3_N8H_HOSTED_MERCHANT_STAGE.md` for hosted verification, disabled-write controls, and remaining account acceptance gates.


**20 November 2026.** This document describes *prepared* source changes and the exact **owner-gated** Vercel configuration. It does not authorize creation, billing, deployment, account registration, hosted writes or a PR merge.

## Verified starting inventory

- Existing isolated Firebase: `localeats-staging`, Firestore **explicitly `(default)`**. This is **not** Production's Firebase project or named Firestore database.
- Existing Vercel staging API: `localeats-api-staging-r52d`. Canonical API domain, verified from Vercel project domains and Customer-stage `VITE_LOCALEATS_API_URL`: `https://localeats-api-staging-r52d-mehey9184-makers-projects.vercel.app`.
- Existing separate Supabase: `LocalEats-Profile-Staging`, URL `https://rgpbdajhlrwfmhopzgzk.supabase.co`, with `shops_with_availability` protected by `security_invoker`, RLS and denied direct anonymous/authenticated SELECT.
- Existing Customer Vercel staging: `localeats-customer-staging-r52d`. Public Firebase web-app settings use environment configuration and the isolated staging project.
- A **dedicated Merchant Vercel staging frontend does not yet exist**. Avoid borrowing the existing main Merchant Vercel project's Preview because its generic environment contains Production Firebase and Supabase entries.
- Staging API source currently deployed before N8D still calls `verifyIdToken(token)` without revocation checks. The **unmerged, undeployed N8D draft** adds `verifyIdToken(token,true)`.
- `LocalEats-Profile-Staging.public.shops` has **zero rows**. No authorized Merchant shop A/B owner acceptance is possible until separately approved isolated fixture writes.

## Code prepared in draft N8G (no deployment)

1. `scripts/merchant-staging-guard.mjs` exports pure, zero-network `assertMerchantStagingBuild`. The Merchant stage Vite mode `merchant-staging` requires:
   - `VERCEL_ENV=preview`, `LOCALEATS_STAGING_ONLY=true`, `VITE_MERCHANT_STAGING_ONLY=true`;
   - `VITE_FIREBASE_CONFIG_SOURCE=environment` and **the complete existing staging Firebase public client config**;
   - `VITE_FIREBASE_PROJECT_ID=localeats-staging`, `VITE_FIREBASE_FIRESTORE_DATABASE_ID=(default)` explicitly (not fallback);
   - exact `VITE_LOCALEATS_API_URL=https://localeats-api-staging-r52d-mehey9184-makers-projects.vercel.app`;
   - `VITE_MERCHANT_PREVIEW_READ_ONLY=true` and explicit `false` for `VITE_PICKUP_ORDERING_ENABLED`, `VITE_PICKUP_PAYMENT_SETTINGS_ENABLED`, `VITE_PAYMENTS_PLAN_DEMO_ENABLED`, `VITE_MERCHANT_FAKE_ORDERS_ENABLED`, `VITE_REWARDS_ENABLED`, `VITE_LOCALPAY_ENABLED`;
   - no Production Supabase URL or secret-bearing `VITE_` variable names.
   - Build stops **even if the normal `npm run build` command is accidentally used on a staging-configured target**, because `vite.config.ts` checks staging env markers in *every* mode. Existing Production builds without stage markers retain original mode, UI, cards and functionality.

2. Separate `npm run build:merchant-staging` script triggers `vite build --mode merchant-staging`. This is the **only permitted** build command for a future Merchant staging Vercel project. No source visual redesign or user flow changes.

3. `localeats-api/src/middleware/merchantStageCors.ts` and `corsOrigins.ts` prepare one **exact stage-only browser CORS origin**: `https://localeats-merchant-staging-r52d-mehey9184-makers-projects.vercel.app`. It must match a new *stage-API-only* `MERCHANT_STAGING_ORIGIN` variable and is admitted only if the API is a Preview, `LOCALEATS_STAGING_ONLY=true`, Firebase project `localeats-staging`, Supabase URL is the dedicated staging project, pickup/profile writes are disabled, and Merchant availability/account writes are not enabled. It does not bypass server Firebase authentication, token revocation checking, shop ownership or `previewReadOnlyGate`. **No wildcard or Production CORS origin was added**.

4. GitHub Actions uses only **fake public Firebase values** with `npm run build:merchant-staging`, checks false flags, exact CORS isolation, strict N8D middleware behavior, all existing API regressions and the original Dashboard TypeScript/ESLint + pickup tests. CI never receives real hosted credentials or contacts real Firebase/Supabase for account testing.

## Owner-gated host configuration checklist — NOT EXECUTED

### Merchant staging Vercel frontend

- Create a **distinct**, Preview-only Vercel project named `localeats-merchant-staging-r52d` under team `mehey9184-makers-projects` linked to **the reviewed Merchant/API source** in `LocalEats-Dashboard.2`, with root directory `.`, Vite output `dist`.
- Set the **Preview** Build Command to `npm run build:merchant-staging`, not the normal `npm run build`. Restrict its Git deployment branch to an owner-reviewed staging branch. Do not set a Production domain or production deploy target.
- Use Preview-only values listed in safeguard #1. Copy complete **public Firebase client configuration** from the existing *Customer staging* app in the Vercel UI, not from the main Merchant Project. Avoid pasting the values into GitHub issues or this chat. Never copy Firebase Admin private keys or Supabase service role into browser `VITE_` variables.
- Before releasing even a test link, independently verify build provenance, project ID, read-only flag and API origin from nonsecret deployment diagnostics. A Vercel READY status is not proof of correct Firebase Auth project.

### Isolated API staging changes, only after review

- Keep the existing `localeats-api-staging-r52d` **Preview** project and its already isolated Firebase/Supabase credentials. Do **not** edit `localeats-api` Production.
- Apply the *reviewed* N8D shared Firebase revoked/disabled-account middleware change only to a stage-specific API deployment, not to Production/main. Merge/promote neither this stacked PR nor its parents as a side-effect.
- Add Preview-only `MERCHANT_STAGING_ORIGIN=https://localeats-merchant-staging-r52d-mehey9184-makers-projects.vercel.app` to the existing staging API **only after** that exact Merchant staging deployment domain is verified as actually belonging to the newly created Vercel project.
- Set/verify `PICKUP_WRITES_ENABLED=false`, `PROFILE_WRITES_ENABLED=false`, `MERCHANT_AVAILABILITY_WRITES_ENABLED=false`, `MERCHANT_ACCOUNT_WRITES_ENABLED=false`, and `LOCALEATS_STAGING_ONLY=true`. The existing API `previewReadOnlyGate` still blocks POST/PATCH/PUT/DELETE irrespective of these flags. No Merchant account route is mounted. Do not install new Firebase/Supabase projects or databases.
- Test exact CORS preflight and revoked/disabled Firebase identity against **short-lived synthetic accounts only** after staging Admin service-account identity has been independently verified. A non-production smoke test may use GET, but no account or shop may be modified without separate specific approval.

### Remaining distinct owner gates

1. **Hosted configuration approval:** creating/reconfiguring the dedicated Merchant staging Vercel frontend and stage API CORS/auth deployment requires a separate explicit owner authorization. No such settings were changed by N8G.
2. **Two shop fixtures:** the staging Supabase `shops` table currently has zero rows. Creating two disposable approved-owner records and registering/approving two actual staging Firebase identities requires a separate approved, reversible, staging-only test plan.
3. **Read-only A/B verification:** prove two different staging sessions, revocation/disabled rejection and no cross-shop data leakage. Do not print ID tokens, passwords, emails, personal information or service-role credentials in logs/PR comments.
4. **Later profile writes:** N8B–N8D account-saving route stays **unmounted and writes hard-OFF**; any profile save/read-back/relogin test is a separate later authorization.

**Scope:** draft-only. No Vercel project created, environment variable set, deployment launched, Production changed, Firestore/SQL database written, Firebase account registered or revoked, FCM sent, payments processed, Rider activation or PR merged.
