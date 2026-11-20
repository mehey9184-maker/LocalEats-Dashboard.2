# L3-N8H — Isolated Merchant Vercel Preview and stage-only API authentication

**Date:** 20 November 2026. This describes specific completed staging-only hosted actions, not a Production release, real A/B test, or profile-write acceptance.

## Created and verified

- Vercel team `mehey9184-makers-projects` is on its **Hobby** plan. New dedicated **Vite** project: `localeats-merchant-staging-r52d`, ID `prj_dtGKm1i2PIzvmENGjYt4OLZUtMpw`, linked to `mehey9184-maker/LocalEats-Dashboard.2`.
- Its build command is `npm run build:merchant-staging` and output directory `dist`; the Ignored Build Step rule skips Production builds. One initial Vercel deployment was interpreted as Production by the platform and was **CANCELED before building** by this rule. The subsequent deployment with Preview inferred from a nonproduction Git branch succeeded at commit `ac4563cbe7e293c27d27152f533a724f831af794`.
- **18 Vercel environment variables** were added to the new Merchant project, ALL scoped to `preview` and **none** scoped to `production`. Public staging Firebase values were copied from the existing Customer staging project through the authenticated Vercel connector, not exposed in issues or git. `VITE_FIREBASE_CONFIG_SOURCE=environment`, `VITE_FIREBASE_PROJECT_ID=localeats-staging`, and `VITE_FIREBASE_FIRESTORE_DATABASE_ID=(default)` were verified. All six pickup/payment/demo/reward/LocalPay toggles are explicitly false, `VITE_MERCHANT_PREVIEW_READ_ONLY=true`, and the `LOCALEATS_STAGING_ONLY` and `VITE_MERCHANT_STAGING_ONLY` markers are both true. **No Firebase Admin key, Supabase service-role key or other secret was supplied to the browser project**.
- A **verified branch-bound Preview domain** was attached to the Merchant project:
  `https://localeats-merchant-staging-r52d-mehey9184-makers-projects.vercel.app`
  tied to `review/l3-n8g-merchant-staging-cutover`. This is the exact origin already admitted by the N8G stage-only API CORS guard. Vercel SSO authentication was set to **all deployments** for the new Merchant staging project to reduce accidental public signup/mutations.
- Existing dedicated API stage `localeats-api-staging-r52d` was verified again to use **`localeats-staging` Firebase** and the separate `LocalEats-Profile-Staging` Supabase URL. It kept `PICKUP_WRITES_ENABLED=false`, `PROFILE_WRITES_ENABLED=false`; three **Preview-only** additions were made: `MERCHANT_STAGING_ORIGIN` set to the Merchant branch-domain above and `MERCHANT_AVAILABILITY_WRITES_ENABLED=false`, `MERCHANT_ACCOUNT_WRITES_ENABLED=false`. No Production env keys were modified.
- A Preview-only API deployment was created from the reviewed N8G source commit `ac4563c...`, with **READY** state. Public read-only smoke checks on its unique deployment address returned `GET /health` **200**, `GET /health/launch-readiness` **503 (blocked)** and unauthenticated Merchant shop read **401**, without supplying any Firebase ID token.
- To avoid interrupting Customer staging, a separate **verified branch-bound API domain** was attached to the existing API stage project:
  `https://localeats-merchant-api-stage-r52d-mehey9184-makers-projects.vercel.app`
  tied to `review/l3-n8g-merchant-staging-cutover`. The canonical Customer staging API alias `https://localeats-api-staging-r52d-mehey9184-makers-projects.vercel.app` was left unchanged.
- The Merchant project Preview environment `VITE_LOCALEATS_API_URL` was changed **only in the new Merchant project** to this Merchant-specific API alias. The source `scripts/merchant-staging-guard.mjs` was updated in the N8G draft branch to require the exact same URL and a new regression test rejects fallback to the Customer staging canonical domain. **The initial Merchant Preview build used the prior API URL; it requires redeployment from the updated commit before claiming the browser bundle uses the separate Merchant-specific alias.**

## Unchanged / not yet verified

- No Production Vercel app or domain, Firebase identity, Firestore database, Supabase data, Firebase Auth rules, security policies, main branch, orders, payments, FCM or Rider functionality was changed. No live account data was fetched or written. No new Firebase/Supabase projects were created.
- The N8D shared `authenticateFirebase` implementation requesting `verifyIdToken(token,true)` is **running in the new API staging Preview source**, but **real revoked-token/disabled-user behavior has not been proved with a genuine staging Firebase account**. The API has Firebase Admin credential variable entries, but stage Auth Admin account scope and token verification have not been authenticated in a live two-user rehearsal.
- The Merchant account profile route remains **unmounted and write-disabled** in `localeats-api/src/server.ts`.
- The Supabase staging `shops` table remains empty as of the previous read-only schema verification. Two approved disposable shop fixtures and two verified, different Firebase Merchant accounts are still needed for genuine read-only per-owner A/B acceptance. No such fixtures/accounts were created in N8H.
- The Merchant app has legacy Firestore-compatible client write paths (e.g., signup and shop settings), so an isolated Preview plus a read-only **API** gate is not evidence that every **client-side Firebase** write is blocked. Keep Vercel authentication enabled and do not authorize broad manual user testing or data mutation before separately reviewing Firestore rules and app write paths.

## CI / review boundary

The N8G draft PR #199 is stacked on other unmerged, review-only drafts and does not authorize a merge. The source build guard, exact staging API origin allowlist and strict Firebase middleware have green isolated synthetic CI. Any subsequent stage deployment must be matched to the exact CI-passing review commit and **Preview**, not Production. This document must be updated with final preview URL, commit and CI evidence after the final redeploy.

Next gate: staging-only nonmutating GET/CORS verification; then review Firestore client writes and separate approval for disposable stage-only Firebase/Supabase shop identities before real A/B authentication. Profile saving, orders and FCM remain separate later gates.
