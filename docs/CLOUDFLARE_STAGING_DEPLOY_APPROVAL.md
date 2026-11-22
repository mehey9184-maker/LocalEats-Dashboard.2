# Cloudflare staging deployment approval proposal — NOT YET AUTHORIZED

**Prepared:** 2026-11-22 · **Founder authority required:** YES
**Candidate:** `localeats-api-cf1-staging`, isolated `*.workers.dev` Worker from reviewed draft [Merchant/API #222](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/pull/222).
**Status:** PREPARED ONLY. This file is **not** permission to deploy.

## Why start with a restricted API bootstrap

We need to prove Cloudflare account routing, runtime CPU/request behavior, diagnostic read access and exact CORS behavior before moving the storefront or credentials. The existing `localeats-app` dashboard Worker is not this build and its GitHub autobuild is linked to Customer `main`—do not reuse, retry or attach domains to it.

## Narrow proposal

- Create exactly **one distinct staging Worker** named `localeats-api-cf1-staging` in the existing connected Cloudflare account, with only `workers.dev` exposure and no custom domains/routes/DNS.
- Deploy **only** `localeats-api/cloudflare-staging/worker.mjs` plus its purely local mock-contract module as an imported file. Its **default export has no repository**, no Supabase, no Firebase, no DB, no R2, no FCM, no secrets and no asset serving.
- Set `LOCALEATS_PREVIEW_READ_ONLY=true`, and `PICKUP_WRITES_ENABLED=false`, `MERCHANT_AVAILABILITY_WRITES_ENABLED=false`, `PICKUP_PAYMENT_SETTINGS_WRITES_ENABLED=false`, `PROFILE_WRITES_ENABLED=false`. No production API origin, no customer or merchant origin until separate CORS approval.
- `GET /bootstrap-health` returns `api_ready:false`; **all** real catalogue/menu/account/order/payment endpoints and mutations return 503. `GET /health` remains 503. No real person should use this test app.
- No GitHub auto-deployment from `main` (or any other branch). Pin deployment to the reviewed Worker source and exact head commit; verify cloud asset inspection and no production bindings before allowing any traffic.
- After deploy, perform a few non-authenticated read-only GET/HEAD/OPTIONS probes and a negative POST denial probe with synthetic content only. A negative POST test must not send a real order or customer payload. Confirm no writes and minimal request/CPU usage.
- **No charge authorization:** target the existing Cloudflare free account only, with no plan upgrade, paid add-on or data transfer beyond a few synthetic requests. The founder must review any feature that would require a paid offering. Preserve a rollback by removing the **new staging** Worker if necessary; never touch existing Worker `localeats-app`.

## Preflight evidence

- [Customer #140](https://github.com/mehey9184-maker/LocalEats-app/pull/140) and [Merchant/API #222](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/pull/222) were reviewed as drafts; no deployment yet.
- CF1 test/build and Wrangler `--dry-run` passed on prior pinned heads.
- CF2 public shop/menu shape is **mock-only** with no runtime backend; its tests cover approved shop filtering, effective availability, verified prices, 4km, CORS and read-only semantics.
- Before actual deployment, re-verify the exact latest GitHub CI green state, Cloudflare account roles and free-tier capacity, and inspect the final worker bundle. Do not substitute the UI placeholder or production Customer repo.

## Explicit founder decision

**Not yet granted.** If the founder explicitly approves *this one restricted no-data `workers.dev` API-bootstrap staging deployment*, execute it without further micro-approvals provided preflight gates are satisfied, then report the real URL, read-only smoke results, CPU/request cost evidence, no Production changes and any discrepancies.

**Not included** in this approval even if granted: Customer/Merchant frontend staging deployments, Supabase credentials/database data, Firebase authentication, FCM push, any real shop/menu content, DNS/custom domain changes, Production merges, payment services, activated orders, billing/plan upgrades. Each requires a separate scoped decision and safety evidence.

See [Founder charter](LOCALEATS_FOUNDER_CHARTER.md), [project handoff](LOCALEATS_PROJECT_MEMORY.md), and [CF2 read contract](CLOUDFLARE_CF2_PUBLIC_CATALOG_CONTRACT.md).
