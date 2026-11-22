# LocalEats Project Memory — Durable Handoff / Operational State

**As-of:** 2026-11-22 (Africa/Johannesburg) · **Maintainer:** AI technical worker on behalf of founder
**Canonical location:** Merchant/API repository, `docs/LOCALEATS_PROJECT_MEMORY.md`, review branch `cloudflare/cf1-merchant-api-staging-20261122`
**State label:** **CF1 API BOOTSTRAP DEPLOYED AND LIVE-SMOKE VERIFIED; REAL APP/API NOT MIGRATED**

> **Starting a new chat?** Open this Markdown file from GitHub using the exact branch, read `docs/LOCALEATS_FOUNDER_CHARTER.md`, read both repositories' root `AGENTS.md` and source documentation, then fetch the actual current PR/CI/Cloudflare state. Details below describe the last verified state, **not** a permanent runtime guarantee. Do not ask the founder to repeat facts already recorded here.

## LATEST — approved CF1 API bootstrap deployed and smoke verified (2026-11-22)

**Founder explicitly approved** this one restricted no-data Worker deployment; no blanket staging or Production authority. The existing `localeats-app` placeholder and the Vercel-hosted Production domains remain untouched.

- **Real Cloudflare staging URL:** `https://localeats-api-cf1-staging.mehey9184.workers.dev/bootstrap-health` (the **bootstrap**, not the working app).
- **Deployed only** `localeats-api-cf1-staging`, uploaded from GitHub draft #222 pinned at `01c0217fea7bf480ad80d1c9bbdaceb836335c5f`, using `localeats-api/cloudflare-staging/worker.mjs` and its imported mock-only public catalog contract module. Production `main` not merged. Version `b4285a75-6538-45c0-b5d3-4f924bf07c4f`, deployment `ccd37d7f-fca8-42ae-b27d-4196c1dce50f`.
- **Safety read-back from Cloudflare:** `LOCALEATS_PREVIEW_READ_ONLY=true`; all four write flags false; **no Firebase/Supabase/R2/FCM bindings**, no assets or custom domains. Worker is available only on its own `workers.dev` host; Preview URLs disabled.
- **Actual remote HTTP tests** from [GitHub Actions run 45063320204](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/actions/runs/45063320204), code commit `ea614ec4fa108a04b44257d8cc3e97b963e7a0b5`, **PASS**: bootstrap GET 200 with `api_ready=false` and no data/Auth/writes; business GET /health, /catalog/shops, /catalog/shops/18/menu and order/merchant endpoints all 503; HEAD 200 no body; read OPTIONS 204; mutation OPTIONS 503; untrusted Origin 403; empty synthetic POST /orders 503. No customer account or real order information transmitted.
- **Not accomplished:** full API/Supabase migration, live catalogue/menu, Customer/Merchant Cloudflare frontend deployments, real phone tests, Production restoration, DNS changes, paid account changes or merge. **No one should treat the successful bootstrap as a usable food ordering service.**
- **Next safe task:** CF2 isolated database adapter + Firebase Admin/FCM runtime compatibility review (mock/fixture-only until individually approved); estimate free-tier limits/CPU. Any more staging deployment or real backend connection requires separate founder authorization.
- **Complete approved-deployment audit:** [`docs/CLOUDFLARE_STAGING_DEPLOY_APPROVAL.md`](CLOUDFLARE_STAGING_DEPLOY_APPROVAL.md).

## Decision / working contract (2026-11-22)

Founder confirmed: **SAFE** autonomy for research, isolated code/tests/docs and draft PRs; **founder approval** for merges, staging deployments, public DNS/Production changes, paid commitments or real account/customer data operations; **milestone CEO reports**; **GitHub Markdown as project memory**. AI should solve routine technical problems, evaluate unit economics and scale, report decisions, and request human action only for actual authority requirements. Full matrix: [founder charter](LOCALEATS_FOUNDER_CHARTER.md).

## Company and products

- **LocalEats:** South African low-budget food marketplace starting in local neighborhoods; initial launch **pickup-only**, customer **pays at shop**. Shop/menu/prices must be authenticated server truth. Real GPS is required for pickup eligibility; **4 km radius for ordering**, but verified out-of-range approved shops may be browse-only with clearer state.
- **Applications:** Customer frontend (`LocalEats-app`), Merchant Dashboard and independent API (`LocalEats-Dashboard.2` + `localeats-api` subdir), later Rider and Super Admin. Preserve original accepted UI, 5 bottom tabs, genuine merchant food imagery, accessible navigation and offline truth. Merchant 15s critical order-read fallback/push reliability is not to be weakened without evidence.
- **Stack direction:** React/Vite PWAs → Cloudflare Workers Static Assets; independent Cloudflare Worker API → Supabase Postgres (authoritative), Firebase Auth/FCM (revocation and push checks), eventual R2 images. No browser direct service-role access; no new customer-facing backend API until security and isolated staging compatibility are proven.
- **Future group:** LocalMarket, LocalRider, LocalPay and LocalCover are exploratory; no activation/charges. Canonical ideas: [Customer idea register](https://github.com/mehey9184-maker/LocalEats-app/blob/integration/l3-p1-p4-zero-write-20261122/docs/LOCALEATS_SCALABLE_IDEA_REGISTER.md).

## Repositories, review branches, and PR dependencies (verify live on next turn)

| Workstream | Current review branch / PR | Last checked head before this handoff edit | Status |
|---|---|---|---|
| Customer P1–P4 | [Customer draft PR #139](https://github.com/mehey9184-maker/LocalEats-app/pull/139), `integration/l3-p1-p4-zero-write-20261122` → `main` | `f035dc2f3964a7aabab282819248d2abf0d4bab3` | Open draft; not merged |
| Cloudflare Customer CF1 | [Customer draft PR #140](https://github.com/mehey9184-maker/LocalEats-app/pull/140), `cloudflare/cf1-customer-staging-20261122` → **PR #139 branch**, not main | `2246f68d0179d07faec943c502b1fc4535822578` | Open, stacked draft; head will change with these docs |
| Cloudflare Merchant/API CF1 | [Merchant/API draft PR #222](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/pull/222), `cloudflare/cf1-merchant-api-staging-20261122` → `main` | `93a609274fb73e326f84f3229bf13b4158efe461` | Open draft; head will change with charter / CF2 work |
| Vercel incident | [Merchant/API issue #221](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/issues/221) | Not a release ref | Vercel Hobby team paused; Production unavailable |
| Cloudflare migration source of truth | [Merchant/API issue #223](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/issues/223) | Not a release ref | CF1–CF3 safety/acceptance checklist |

**CF1 verified CI evidence on pre-document commits:**
Customer [run 45058252705](https://github.com/mehey9184-maker/LocalEats-app/actions/runs/45058252705): Node safety tests, `npm ci`, Vite-only static asset build with **synthetic** staging URL, Wrangler **--dry-run** — **PASS**.
Merchant/API [run 45058258166](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/actions/runs/45058258166): write-off/CORS tests, Merchant Vite static build with **synthetic** URL, BOTH Wrangler **--dry-run** packages — **PASS**.
**CI passing on an older commit does not imply new commits passed; recheck.**

## Cloudflare — verified connected account (read-only check, 2026-11-22)

- Official Cloudflare integration is connected to this ChatGPT session (and founder reports Codex connected). Cloudflare account lists a **single** existing Worker called `localeats-app` from a **dashboard template**; `has_assets=false` (not the Customer build). Two dashboard-created versions were Ready; its public `workers.dev` subdomain was disabled at inspection.
- That placeholder's auto-build configuration targets **Customer GitHub `main`**, `bun run build`, `npx wrangler deploy`; it is **not** CF1 draft #140. Treat it as unrelated; **do not retry/promote it**.
- Its first GitHub build failed before app compilation: Bun `--frozen-lockfile` mismatch (`@vercel/analytics` removed from `package.json` but retained in `bun.lock`); duplicate `vite` entry warning. This does **not** invalidate CF1 npm-based safety tests.
- **Update, 2026-11-22:** exactly one **API bootstrap-only** Cloudflare Worker was deployed with founder approval and passed remote smoke tests; the Customer and Merchant frontend apps still have no Cloudflare deployments. No Production DNS, secrets, Firebase, Supabase, payment or real-order mutations by this migration.

## Vercel status and reason for migration

At the previous verified live check, `www.localeatssa.co.za`, `dashboard.localeatssa.co.za` and `localeats-api.vercel.app/health` responded **HTTP 402 `DEPLOYMENT_DISABLED`**. Official account email cited **273%** of 4 included Fluid Active CPU hours, team paused until **2026-12-22** unless upgraded; support email reply said no email-based support case was created. **Do not assume outage fixed or that upgrading is authorized.** Actual high-CPU function/route was **not identified** due limited billing metrics/log retention. Compare costs before choosing a paid provider.

## CF1 technical state and CF2 task

- Customer draft #140 holds `wrangler.cf-staging.jsonc`, `scripts/build-cloudflare-staging.mjs`, tests and `docs/CLOUDFLARE_CF1_CUSTOMER_STAGING.md`. Vite-only build intentionally does not publish `server.ts`/`dist/server.cjs` or any secrets. API URL must be an exact HTTPS `*.workers.dev` staging origin. Pickup, profile, LocalPay, rewards writes remain off.
- Merchant/API draft #222 holds Merchant static `wrangler.cf-merchant-staging.jsonc`, guarded Vite-only build, tests, and a separate API `localeats-api/wrangler.cf-api-staging.jsonc` → `localeats-api/cloudflare-staging/worker.mjs`. Its **CF1 API is bootstrap-only**, `GET /bootstrap-health` reports `api_ready:false`, ALL real business reads/mutations are 503, write gates fail closed, exact-origin CORS required. This is not live catalog or accepted API compatibility.
- **CF2 mock-only catalogue contract prepared in draft #222** (2026-11-22): `localeats-api/cloudflare-staging/publicCatalogRead.mjs`, dependency-injected test variant in `worker.mjs` and `localeats-api/tests/cloudflare-cf2-public-catalog-contract.test.mjs`. The mock tests model approved/nonarchived shop list, shop detail, menu, 4km pickup-list, effective availability, strict prices, CORS, HEAD/OPTIONS and mutation denial. **The default Worker still injects NO repository, serves no authentic shop/menu data and returns 503 for all business routes; `/health` stays unavailable.** See [CF2 source-only contract](CLOUDFLARE_CF2_PUBLIC_CATALOG_CONTRACT.md). GitHub CI must be rechecked on the last commit and it is NOT a live staging integration.
- After pure-code parity, design disposable Supabase staging connection without embedding secrets. Verify Firebase Admin revocation/disabled-token and FCM push compatibility with Workers **before** enabling authenticated routes. Do not silently reduce auth standards.
- Founder **approved exactly one no-data Cloudflare API bootstrap staging deployment on 2026-11-22 and it is complete**. No general authority for additional staging deployments, customer/merchant hostings, database/auth integrations or real data. Future staging deployments still require a separate specific founder decision, with cost and rollback review.

## Manual / Production release gates

- True Cloudflare staging API serving live read-only approved catalog/menu; separate test credentials; no Production database / token reuse.
- Genuine Android mobile-data GPS and 320px/390px/desktop, PWA install/icons, login isolation, original shop cards, correct R25 My-Kota menu, distant browse-only and genuine 4km order restriction; Data Saver on slow connection and names-only offline, no stale prices.
- Order/push/merchant shop readiness must be separately verified using authorized isolated tests; no real orders/payments without distinct founder release sign-off.
- Cloudflare request/CPU/egress budgets and denial of unexpected writes; backups, rollback and DNS cutover checklist. Then founder separately approves Production merge/deployment and DNS.

## Continuation checklist for the next AI / next chat

1. Open exact docs: **this file**, [charter](LOCALEATS_FOUNDER_CHARTER.md), both root `AGENTS.md`, the two CF1 runbooks and Customer idea register; check `Vendor_LocalEats_App_Functionality_Documentation.md` before Merchant edits and `LocalEats_App_Functionality_Documentation.md` before Customer edits.
2. Fetch current GitHub PR #139, #140 and #222 branch names, head/base SHAs, approvals, GitHub Actions; inspect issue #221 and #223; recheck actual Cloudflare account state if needed (read-only).
3. Continue **safe, isolated CF2** database adapter and auth-compatibility research under existing draft #222, using **mock/synthetic** data only until a separate founder-approved isolated staging backend exists. Revalidate the new public read contract CI first. Adjust this handoff and tests in the same PR; never switch `localeats-app` placeholder or auto-deploy from `main`.
4. At milestone, update this document with **dated observed facts** and new exact links; post a brief CEO report: completed, verified, blocked, risk/cost, Production changed?, founder decision required?, next safe action.
5. If chat context runs out, paste the direct GitHub URL for this file into the new chat; the next agent should **fetch** it from the connected GitHub app, not rely on legacy chat memory. An issue comment on #223 should carry a link to the same handoff.
6. Do not include credentials, user tokens, passwords, customer PII or unreviewed secret env values in any GitHub file.

**Last verified CF2 code-only milestone (2026-11-22):** `localeats-api/cloudflare-staging/publicCatalogRead.mjs` and `localeats-api/tests/cloudflare-cf2-public-catalog-contract.test.mjs` were added to draft PR #222; the worker injects a repository **only for synthetic tests**, leaving the default Worker bootstrap-only (no real API). The combined CF1/CF2 safety and Wrangler `--dry-run` workflow [run 45062047767](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/actions/runs/45062047767) completed **successfully** on `112666061622d8f797eed36035456da5ad7817f0`. [Customer CF1 workflow 45061812046](https://github.com/mehey9184-maker/LocalEats-app/actions/runs/45061812046) also succeeded. Documentation commits after those SHAs need current CI revalidation; **no real Cloudflare API or production functionality tested**.

**Current milestone:** the founder-approved [one-worker staging proposal](CLOUDFLARE_STAGING_DEPLOY_APPROVAL.md) was executed and verified by real edge smoke; all other deployment scopes remain unapproved. **Next safe task:** design the isolated database-staging adapter and verify Firebase Admin/FCM compatibility without touching Production. No frontend deployment, live secrets, business orders, spending or domain changes are authorized.
