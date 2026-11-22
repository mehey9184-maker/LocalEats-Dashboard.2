# Cloudflare CF1 restricted staging deployment — APPROVED / VERIFIED

**Owner authorization:** 2026-11-22; limited to **one isolated, no-data API bootstrap Worker** only.
**Deployment outcome:** SUCCESS; verified by connected Cloudflare API and independent GitHub Actions live HTTP smoke. No further deployment authorization implied.
**Actual Worker:** `localeats-api-cf1-staging` on `https://localeats-api-cf1-staging.mehey9184.workers.dev`.
**GitHub source pinned:** Merchant/API draft PR #222 at `01c0217fea7bf480ad80d1c9bbdaceb836335c5f` for uploaded Worker modules.
**Cloudflare deployment ID:** `ccd37d7f-fca8-42ae-b27d-4196c1dce50f`; active version `b4285a75-6538-45c0-b5d3-4f924bf07c4f`.
**Cloudflare deployment created:** 2026-11-22 19:52:20 UTC; **live acceptance:** 2026-11-22 19:55:20–21 UTC.
**Verified smoke run:** [GitHub Actions #45063320204](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/actions/runs/45063320204) at `ea614ec4fa108a04b44257d8cc3e97b963e7a0b5`, conclusion **success**.

## Observed acceptance facts

- Actual GET `/bootstrap-health` **200** with `status=bootstrap_only`, `api_ready=false`, `database_connected=false`, `firebase_auth_verified=false`, `writes_enabled=false`.
- Actual GET `/health`, `/api/v1/catalog/shops`, `/api/v1/catalog/shops/18/menu`, `/api/v1/orders`, `/api/v1/merchant/orders` **503**.
- Actual HEAD bootstrap **200** without body; read-only OPTIONS **204**; write OPTIONS **503**; unknown Origin **403**; synthetic empty POST `/api/v1/orders` **503**.
- Cloudflare read-after-write confirmed `LOCALEATS_PREVIEW_READ_ONLY=true` and all four write flags `false`, no assets, no custom domains, and just two Workers in the account: existing dashboard `localeats-app` (untouched) and this new API staging Worker. `workers.dev` enabled only on new target; Preview URLs disabled.
- Public read-only routes intentionally remain unimplemented. No Firebase, Supabase, R2, FCM, personal data, DNS, Production orders, Customer/Merchant frontend releases, billing upgrade or GitHub merge occurred.

**Risk/next gate:** The Worker has a public `workers.dev` URL for testing but exposes no real business data and denies writes. Run only bounded diagnostics; no continuous high-traffic checks. CF2 isolated database integration, auth compatibility and a separate founder-approved staging phase remain required. Successful bootstrap does NOT mean storefront ready.

---

## Original pre-deployment proposal retained as audit history

**Prepared:** 2026-11-22 · **Founder authority required:** YES
**Candidate:** `localeats-api-cf1-staging`, isolated `*.workers.dev` Worker from reviewed draft [Merchant/API #222](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/pull/222).
**Historical status at proposal creation:** PREPARED ONLY. See verified result above; no further deployments authorized.

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

**Granted on 2026-11-22 for the single no-data Worker only and fulfilled**; subsequent deployments, API data connections, DNS changes, main merges, production writes and spending remain unapproved.

**Not included** in this approval even if granted: Customer/Merchant frontend staging deployments, Supabase credentials/database data, Firebase authentication, FCM push, any real shop/menu content, DNS/custom domain changes, Production merges, payment services, activated orders, billing/plan upgrades. Each requires a separate scoped decision and safety evidence.

See [Founder charter](LOCALEATS_FOUNDER_CHARTER.md), [project handoff](LOCALEATS_PROJECT_MEMORY.md), and [CF2 read contract](CLOUDFLARE_CF2_PUBLIC_CATALOG_CONTRACT.md).
