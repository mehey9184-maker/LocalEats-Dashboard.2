# CF2 — Cloudflare Public Catalogue Contract (mock-only, no deployed backend)

**Date:** 2026-11-22 · **Approval scope:** founder SAFE autonomy · **Branch:** `cloudflare/cf1-merchant-api-staging-20261122` / [draft PR #222](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/pull/222)

## What this change actually does

Adds `localeats-api/cloudflare-staging/publicCatalogRead.mjs` and isolated Node tests. The real CF1 Worker entrypoint still exports `createIsolatedCatalogTestWorker()` with **no repository injected**; its `GET /bootstrap-health` accurately says `api_ready:false`, while all actual catalogue/menu/auth/order/health routes stay **503**. Nothing calls Supabase/Firebase/R2 or Vercel, and no new Cloudflare deployment was made.

The test-only dependency-injected code models the existing Express public contract in `localeats-api/src/routes/catalog.ts`:
- `GET /api/v1/catalog/shops` → `{success:true,shops:[...]}`
- `GET /api/v1/catalog/shops/:shopId` → `{success:true,shop}` or generic 404
- `GET /api/v1/catalog/shops/:shopId/menu` → `{success:true,menu_items:[...]}`; requires that the shop first passes public approval and archive checks
- `GET /api/v1/catalog/pickup-shops?lat=...&lng=...` → bounded genuine-coordinate and max 4km nearby listing; it is NOT the source for outside-area browse. The all-shops route is the public browse source.
- HEAD returns no body, GET and GET-only OPTIONS allow **exact staged CORS origin**, all mutation verbs and write preflights remain 503.

## Explicit authority and evidence requirements

The synthetic repository passed to tests provides `getApprovedShops`, `getApprovedShopById` and `getMenuByShopId`. It returns fabricated **test fixtures only**; those must not become visible in an actual customer app or Production.

The data boundary requires `approval_status='approved'`, `archived_at=null`, an explicit `effective_is_active` boolean, safe `availability_revision` and `is_active` boolean. The original Express repository queries `shops_with_availability` and applies the shared `effectiveShop` authority; the future Cloudflare adapter MUST obtain the same server-computed view **and explicitly carry the approval/archive evidence to the verifier**. It may not derive open hours from browser clocks or trust local flags as order authority.

Only allowlisted public shop/menu fields are returned; `owner_id`, secret columns and internal approval information are stripped. Menu item rows must refer to the exact authorized shop and have finite nonnegative numeric prices and a verified availability boolean; otherwise the **entire menu fails closed**. Internal error details never appear in public responses. A shop without an unambiguous archive record is excluded from the test-only shop catalogue.

## Synthetic-only checks (no live requests)

```sh
node --test localeats-api/tests/cloudflare-staging-worker.test.mjs
node --test localeats-api/tests/cloudflare-cf2-public-catalog-contract.test.mjs
cd localeats-api && npx --yes wrangler@4 deploy --dry-run --config wrangler.cf-api-staging.jsonc
```

The CI workflow `.github/workflows/cloudflare-cf1-staging-gate.yml` runs both tests and both static/Worker dry-runs on push. **Record the exact workflow outcome before claiming this milestone passed.**

## CF2 still not complete — mandatory next work

1. Design **isolated** Supabase staging credentials and the actual Worker repository adapter; no live Production project endpoint/key reuse. Confirm `shops_with_availability` filters, projected fields, merchant approval, archive exclusion, time-zone open-state semantics and SQL/RLS boundaries. No schema/migration changes until owner approval.
2. Benchmark Workers runtime/Node compatibility for the current Firebase Admin revoked-token verification, FCM and Supabase client. Keep authenticated endpoints OFF until behavior is equivalent; a simple HTTPS JWT parse is **not** a safe replacement for revoked/disabled-account checking.
3. Only after isolated data and endpoint parity, present founder with a specific staging-deployment plan including Cloudflare resource names, expected request counts, cost ceiling, rollback and assurance that no live domains or real users will be touched. **SAFE autonomy permits CI/dry-run, not actual staging deployment.**
4. Pair real `*.workers.dev` Customer #140 build with the accepted read-only API. Verify true real-data browse/menu and GPS/Android, CORS, 320px/390px, PWA/FCM as appropriate; no real orders, offline price claims or account leakage.
5. Preserve Vercel incident [#221](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/issues/221) and migration release gates [#223](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/issues/223); obtain a **separate founder merge/deploy/DNS approval** only after all release evidence exists.

This is a behavioural model and safety scaffold, **not** proof the Cloudflare API is production-ready or that a live server is connected.
