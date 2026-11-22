# CF1 — Cloudflare staging migration: Merchant + API (review-only)

**Status:** prepared on an isolated GitHub branch; **not deployed**, not merged, and not operationally released.

This repo contains two independent Cloudflare staging configurations and **does not** change Vercel, Production DNS, Firebase, Supabase, R2, live shop states or existing order records.

## 1. Merchant: static Vite PWA

- Wrangler file: wrangler.cf-merchant-staging.jsonc
- Build: node scripts/build-cloudflare-staging.mjs (Vite-only; no server bundle)
- Cloudflare will serve the dist directory as SPA assets; original Merchant Home/Orders/Menu/Marketing/Settings design stays unchanged.
- Staging only; VITE_MERCHANT_PREVIEW_READ_ONLY=true, fake-order UI off, pickup/payment/availability/profile writes disabled. Any browser-only write path not covered by the build flags must be independently audited; client flags never grant server permission.
- No app should sign into real Production Firebase/Supabase identities from an unaccepted Preview.
- An existing vite.config.ts define block could inline process.env.GEMINI_API_KEY / GOOGLE_MAPS_PLATFORM_KEY into browser JS when those server keys were provided. This branch removes those server-key define substitutions. Never inject VITE_GEMINI_API_KEY into the staging browser bundle. Merchant AI scanner must be redesigned to use an authenticated, server-owned proxy before production use; its direct client-key workflow is NOT approved in this staging plan.

Merchant commands for an **offline/local** build review once the true API endpoint exists:

    npm ci
    node --test tests/cloudflare-staging-gate.test.mjs
    VITE_LOCALEATS_API_URL=https://<actual-api-staging>.<your-subdomain>.workers.dev node scripts/build-cloudflare-staging.mjs
    npx wrangler@4 deploy --dry-run --config wrangler.cf-merchant-staging.jsonc

The host above is a **template**, not a verified real address. Do not publish a Merchant login app with real Production credentials until separate authorization and account-isolation testing.

## 2. API: read-only bootstrap, NOT an Express migration

- Wrangler file: localeats-api/wrangler.cf-api-staging.jsonc
- Worker source: localeats-api/cloudflare-staging/worker.mjs
- Local tests: node --test localeats-api/tests/cloudflare-staging-worker.test.mjs
- To dry-run from the localeats-api subfolder: npx wrangler@4 deploy --dry-run --config wrangler.cf-api-staging.jsonc
- All server flags must be explicitly disabled. No auth, catalogue, menu, profile, orders or push route has been migrated yet. The ONLY successful probe is GET /bootstrap-health, returning api_ready=false.
- All other application requests return 503, all mutations are blocked, and CORS denies browser origins until an exact staging Customer/Merchant origin is configured. **Do not connect the frontend to this bootstrap as if it were a working API.**
- This Worker has no Firebase, Supabase, R2, Cloudinary, payments or live order logic. It is safe to inspect locally without backend credentials.
- Do not add service-role keys or private Firebase keys to Git. Use Cloudflare secrets in isolated staging only after business routes and authenticated request security have been reviewed.

## 3. The real API port (CF2) requires separate acceptance

Cloudflare's Express guide uses nodejs_compat with cloudflare:node/httpServerHandler. That does NOT prove the existing Firebase Admin SDK, revoked-token checks, FCM, Supabase admin client, order idempotency, outbox and price authority work correctly in a Worker. Evaluate each dependency on a disposable isolated staging database. If admin SDK calls are unsupported, use a reviewed alternative that preserves revocation/disabled-user enforcement; never silently downgrade auth checks.

First accepted Cloudflare API routes should be **read-only** GET /health plus public shop catalogue/menu GET and exact-origin OPTIONS, preserving freshness and out-of-range browsing. Only then rebuild Customer PR #139 with its real staging API origin. Customer / Merchant authenticated or write routes remain disabled until audited with separate credentials and tests.

## 4. Release and cost gates

1. Cloudflare account and verified *.workers.dev subdomain must exist; no connector for Cloudflare is available in this ChatGPT session. Do not share tokens/private keys in chat.
2. Local and GitHub CI Node tests and Wrangler --dry-run must pass, followed by optional isolated staging deployment with no custom domains.
3. Exact CORS; role/merchant separation; PWA service workers/icons/Android GPS; real-phone mobile data; R25 menu/4 km pickup truth; push (background and foreground); stale/offline guards; no real orders/Production DB writes; cost and request-count budget.
4. Review Worker CPU metrics in Cloudflare before increasing usage. Workers Free has per-invocation CPU and daily request limits; keep fail-closed for any security-critical route. Monitor out-of-limit and error responses.
5. Only after independent owner release approval, backups/rollback evidence, and demonstrated staging parity should anyone consider a domain/DNS switch or merge to Production.

Tracking: LocalEats Dashboard issue #221 (Vercel outage), Customer draft PR #139 (L3-P1–P4). No automatic paid-plan upgrades or domain changes.

Official docs:
- https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/
- https://developers.cloudflare.com/workers/tutorials/deploy-an-express-app/
- https://developers.cloudflare.com/workers/platform/limits/
