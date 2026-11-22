# CF-W1 — Cloudflare-only Merchant Workshop Preview

**Date:** 23 November 2026 · **Founder correction:** “I was hoping to make a preview on cloudflare.”  
**Status:** Source and isolated tests first. **Do not call it deployed until the exact Cloudflare Worker URL responds with the tested app.**

## CF-W1 actual deployment evidence — 23 November 2026

**DEPLOYED — separate public fictional demo only.** The exact Worker URL was verified using Cloudflare's connected Browser Rendering service: **https://localeats-merchant-workshop-preview.mehey9184.workers.dev/**. At **390px mobile** the actual hosted DOM contained the **LocalEats Kitchen Workshop**, fake ticket `DEMO-001`, and conspicuous **No real orders** notice. The deployed build completed **SUCCESS** on source SHA `ac08a08731400cc357bea17caf0b925450ac794c`, Cloudflare build `857afbf0-8a7b-4422-aae9-a286e11b6263`, Worker version `7da308e6-cded-4973-b52b-386433d28f0c`. The Worker has **only the `ASSETS` binding**, no service or database integrations, `workers_dev=true`, `preview_urls=false` and no custom routes. Existing Workers `localeats-app` and `localeats-api-cf1-staging` unchanged.

**Cloudflare-specific build recovery:** Earlier builds failed on a **pre-existing stale `bun.lock`** whose frozen install wanted an added `esbuild` dependency. Added `packageManager: npm@10.9.2` and **removed stale `bun.lock` ONLY from this unmerged review branch**, preserving `package-lock.json` and main untouched; the platform selected npm clean-install, built Vite isolated assets and deployed via Wrangler. This branch-only lockfile change is **not intended to merge unreviewed into main** as part of a regular feature PR; reconcile dependency management separately if later merging.

**Source and browser evidence:** Latest [Merchant Workshop #225 draft](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/pull/225) at `ac08a08731400cc357bea17caf0b925450ac794c` completed **5/5 GitHub workflows SUCCESS**, including Cloudflare static assets Wrangler dry-run and mocked-Cloudflare-host Chromium mobile (320/390) + desktop and the original Vercel guard regressions. The separate actual hosted 390px Browser Rendering result is **PASS**. Attempts to run more hosted Browser Rendering calls for 320px/desktop returned **HTTP 429 free-tier rate limit**; do not claim live-host browser acceptance on those sizes. Their isolated local Chromium acceptance passed. Founder can test the public URL on a physical phone; no real phone has been used by this worker.

**Public scope and explicit limitations:** This is a **public standalone training demo**, not authenticated Merchant Dashboard, customer app or real order processing. It contains imaginary food/customer tickets only; users can pause/step/restart the animation. It never registers vendors, stores names, sends push, prices real food, displays real sales or touches a real database. Deployment to this **new dedicated preview Worker** does not authorize updating live LocalEats domains, real shop data, Cloudflare API, Supabase CF2-E or paid tiers. CF2-E hosted SQL remains **NOT READY** due unverified current encrypted staging backup. Do not confuse this standalone preview with working Merchant login/order acceptance.

**Cost:** No new paid tier was selected or spending authorized; Cloudflare's Free Worker limits still apply. The repository dependency install reported inherited dependency vulnerability notices, but the standalone Worker bundle is React/static and does not embed service credentials. Avoid extending this worker to account-bearing functionality.

## Decision

The founder's objective is a demonstration suitable for vendor pitching, **not a live-order release**. Use a distinctly named **Cloudflare Worker with static assets** hosting the **same real `MerchantWorkshopDemo` React component** as [draft PR #225](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/pull/225). The static shell cannot log in, create a shop, accept an order or call customer/merchant APIs. It has zero Supabase, Firebase, R2, Hyperdrive, API, analytics, payments or printer bindings. A read-only standalone Worker is safer and cheaper than deploying the entire authenticated Merchant Dashboard or modifying Cloudflare CF1 API.

**Dedicated Worker name:** `localeats-merchant-workshop-preview`  
**Expected Worker URL only after actual deployment:** `https://localeats-merchant-workshop-preview.mehey9184.workers.dev`. Do not circulate an unverified URL.  
**Production domains:** unchanged. `dashboard.localeatssa.co.za`, `www.localeatssa.co.za`, `localeats-app`, `localeats-api-cf1-staging` and all Supabase projects are out of scope.

## Security boundary

- Entrypoint: `preview/merchant-workshop/main.tsx`, imports only the original workshop React component, the exact Cloudflare-only hostname flag and a minimal Tailwind stylesheet. **Never imports Merchant App.tsx, API or PWA service worker.**
- New guard `isIsolatedCloudflareWorkshopPreviewEnabled()` requires exact Worker hostname, HTTPS and build-time flags `VITE_MERCHANT_WORKSHOP_CLOUDFLARE_PREVIEW=true`, `VITE_MERCHANT_PREVIEW_READ_ONLY=true`, `VITE_PICKUP_ORDERING_ENABLED=false`. The component's original Vercel-only guard is unchanged, and the new Cloudflare guard must not grant anything to general Merchant order controls.
- The Worker script `preview/merchant-workshop/worker.ts` explicitly denies POST/PUT/PATCH/DELETE and paths associated with API, orders, payment and merchant/customer/admin resources; it sets restrictive CSP (`connect-src 'none'`), `no-store`, noindex, Referrer Policy, Permissions Policy and clickjacking headers.
- App always labels food examples **DEMO/FAKE**, prices **Example R**, no real shop or client identities. Autoplay demonstrates incoming → accepted → preparing → ready → collected, all entirely in-memory.
- **The Worker URL is publicly reachable to anyone with the link**; it is safe only because it contains no private information, not because Workers have authentication. Never insert real merchant names, contact details or credentials into it. If owner-only access is needed later, authorize Cloudflare Access separately.
- No custom domain, DNS change, production Worker, paid tier, new user account, credential retrieval, database migration, security policy or permission change.

## Build and test

- Vite config: `preview/merchant-workshop/vite.config.ts` produces isolated `dist-merchant-workshop` from source, without PWA, Firebase, backend or Sentry initialization. Run with read-only environment flags only.
- Worker deploy configuration: `wrangler.merchant-workshop-preview.jsonc`, separate script name, `workers_dev=true`, `routes=[]`, `preview_urls=false`, `assets.run_worker_first=true`, only `ASSETS` binding.
- CI: `.github/workflows/cloudflare-merchant-workshop-preview.yml` runs static guards, `npm ci`, isolated Vite build, bad-string scan, pinned Wrangler **dry-run only**, and headless Chromium visual/behavior tests with a **virtual Cloudflare hostname mapped to localhost**. Screenshots are fictional and retained only three days.
- Strict release gate: Do not claim a pass until **all** CI checks green on the same source SHA. Do not deploy a Worker if a dry-run or browser security test fails.
- Hosted acceptance after deployment: verify an actual HTTP 200/index page at the exact workers.dev URL and same app build; confirm no CSP errors, no network POST/GET to APIs, no PII, no cache of order data, responsive layout, pause/step/restart, and Worker POST /api/checkout returns denial. The current chat cannot test a real physical phone; founder can test on their own.

## Hosting execution approach

1. Verify connected Cloudflare account and Worker namespace, and ensure no existing Worker has the **new exact name**. Do not edit `localeats-app` or `localeats-api-cf1-staging`.
2. Use Cloudflare **Workers Builds connected GitHub** if available, with production branch set to the **review-only workshop branch** and the Worker name matched to the Wrangler file. Build command: `npm ci --no-audit --no-fund && npx vite build --config preview/merchant-workshop/vite.config.ts`. Deploy command: `npx wrangler@4.54.0 deploy --config wrangler.merchant-workshop-preview.jsonc`. Build-time values: `VITE_MERCHANT_WORKSHOP_CLOUDFLARE_PREVIEW=true`, `VITE_MERCHANT_PREVIEW_READ_ONLY=true`, `VITE_PICKUP_ORDERING_ENABLED=false`, `VITE_MERCHANT_FAKE_ORDERS_ENABLED=false`. There are no application secrets.
3. Before creation, verify account's GitHub integration/build token has suitable **existing** authorization. Do not create or reveal new tokens; do not change billable plans. If integration unsupported, leave source ready and report the single blocker.
4. Cloudflare Worker previews are **not** Merchant login/Production acceptance. Keep source in draft PR; do not merge PR #225 to main simply to publish a demo. A future full authenticated Merchant Dashboard on Cloudflare is a separate project gate.

## Founder reporting

Report exactly: Worker name and verified URL, source commit, CI result, actual Cloudflare deployment/build result, scope of browser/host checks, no production/DB/FCM changes, and outstanding real phone/vendor sign-off. Do not inflate 90% vendor-pitch or 85% real public order readiness from a fictional demo.

[Founder agreement](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/blob/cloudflare/cf1-merchant-api-staging-20261122/docs/LOCALEATS_FOUNDER_CHARTER.md) · [Canonical project handoff](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/blob/cloudflare/cf1-merchant-api-staging-20261122/docs/LOCALEATS_PROJECT_MEMORY.md).
