# L3-N8S — Staging authentication safety and Customer–Merchant API pairing preflight

**Checked:** 2026-11-20. **Scope:** staging source guard + offline tests + read-only connected-project inspection. **No Production, Firebase Rules deployment, staged account creation, database migrations, stage/API repointing, push sends, order activation, or merges.**

## Live read-only observations (not test assumptions)

- Owner screenshots verified **Production Firebase** project `localeats-5e26e`, named Firestore database `ai-studio-localeatsvendord-a61b068b-3029-4d93-ba41-626b03a23bbe`, and FCM HTTP v1 enabled. **Do not** mistake these Production screenshots for staging rules evidence.
- Dedicated staging Customer and Merchant Vercel projects have `VITE_FIREBASE_PROJECT_ID=localeats-staging`, `VITE_FIREBASE_FIRESTORE_DATABASE_ID=(default)`, `VITE_FIREBASE_CONFIG_SOURCE=environment` and `VITE_PICKUP_ORDERING_ENABLED=false`.
- Staging API project has `FIREBASE_PROJECT_ID=localeats-staging`, `SUPABASE_URL=https://rgpbdajhlrwfmhopzgzk.supabase.co` and `PICKUP_WRITES_ENABLED=false` (read from non-secret Preview variables; the Admin service account **credential project remains unverified**).
- **Customer Preview** points to `https://localeats-api-n8o-r52d-mehey9184-makers-projects.vercel.app`; **Merchant Preview** still points to `https://localeats-merchant-api-stage-r52d-mehey9184-makers-projects.vercel.app`. This is an **actual mismatch**, not an accepted paired customer→merchant API test. The current Merchant staging deployment is **READY** on older branch `review/l3-n8g-merchant-staging-cutover` commit `53ab4d2431f0c9c14d7f1eda1998e4042375174d`; it is **not** the current N8P source and does not have the newer staging signup write guard.
- Read-only query directly against Supabase **staging** project `rgpbdajhlrwfmhopzgzk` returned **0 orders, 0 pickup events, 0 push outbox rows, and all 3 hard-off triggers enabled**. No pickup creation/command RPCs were present in the earlier read-only function inventory.
- The actual **published staging** `localeats-staging/(default)` Firebase Rules release and historical rollback ruleset are **not independently verified**. Previously pasted deny-all rules and Production screen/database/rules source are insufficient to attribute published Rules to stage. No rules deployment was attempted.

## Source-only safety improvement

Existing Merchant staging mutation guards in `src/lib/merchantStagingNoWrite.ts` blocked direct browser writes based on `VITE_MERCHANT_STAGING_ONLY` or `VITE_MERCHANT_PREVIEW_READ_ONLY` being exactly `"true"`. The staging Vercel Preview currently sets both to true; however an inadvertent omission of both flags would remove that defense.

L3-N8S adds the exact recognized Firebase project ID `localeats-staging` as a **third independent fail-closed condition**, preventing direct browser mutation into this project even when both flags are absent/false. Production project `localeats-5e26e` remains unchanged when the stage markers are absent. A deliberately isolated staging test cannot authorize any write through this browser guard; such a test must use a separately reviewed server-authorized API and the final published rules.

Offline regression file `tests/l3-n8s/merchant-staging-identity-guard.test.mjs` asserts project-ID fail closed, backward-compatible marker fallback, Producton identity unaffected, checks that signup/Google-auth/new account/password reset/profile/storage SDK side effects are guarded, and preserves existing-user email sign-in for a later consented test.

**Important:** This fix is on an **unmerged source branch**, not the currently deployed Merchant staging binary. Do **not** treat it as a verified browser fix or a completed hosted login acceptance. The CI workflow operates entirely on GitHub source, with **no hosted credentials**.

## Next required gates (exact order)

1. **Verify published staging rules and rollback by exact Firebase project/database.** In Firebase Console switch to `localeats-staging`, Cloud Firestore database `(default)`, Rules; record currently published release identifier/date and original source without pressing Publish. If the console cannot show a release ID, use an authorized read-only Firebase Rules Releases API/CLI with credential-safe access. Never deploy the Customer repo's named Production Firestore configuration to the staging default database.
2. **Attest server identity without exposing secrets.** Confirm that the staging API Firebase Admin service account `project_id` matches `localeats-staging` by server-side assertion / privileged diagnostic that exposes only a boolean and non-secret project identifier; avoid logging or returning private keys and tokens. Confirm CORS permits only exactly the reviewed Customer and Merchant staging origins. Validate this with actual browser network responses before claiming success.
3. **Publish a reviewed Merchant *staging-only* Preview with the updated no-write guard, after verification.** Confirm its immutable commit and browser bundle, then pair the dedicated Merchant Preview with the reviewed N8O stage API via Preview-only environment settings and a safe build. Both Customer and Merchant must use the same trusted API origin. Do not repoint Production or create broad CORS allowances.
4. **Use only disposable, isolated staging Firebase identities** after published-rule and API-admin-scope verification. Verify existing-user login, wrong-password and missing-profile diagnostics, owner mapping from authenticated API, and cross-owner denial without creating permanent shops/orders. A read-only login test is not a live pickup-order write test.
5. **Only after another explicit migration and test-window approval:** review/install safe staging-only `pickup_create_order` and `pickup_order_command` RPCs, remove staging-only hard-off using a reversible controlled process, and run **one bounded** real Customer order → Merchant accept → ready → pay-at-shop → handover sequence with duplicate idempotency and wrong-owner rejection. Test FCM **only on owned disposable devices**. Clean up and restore hard-off; verify 0 unexpected rows and no Production changes. Production ordering still needs separate owner go/no-go.

## Release verdict

**HOLD** authenticated end-to-end order activation and public pickup launch. Source hardening is prepared only. Do not mistake offline passing tests or a READY preview for deployed Firebase rules, valid owner identities, hosted persisted orders, notification receipt, or public launch approval.

See related [L3-N8P rehearsal draft #208](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/pull/208) and cross-app [L3-N8O Customer draft #123](https://github.com/mehey9184-maker/LocalEats-app/pull/123). Provider portability and current-vs-future infrastructure are documented in separate owner-reviewed draft PRs #124 and #209.
