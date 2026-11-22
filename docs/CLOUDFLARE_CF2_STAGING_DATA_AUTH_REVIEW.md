# CF2 — Staging data and Firebase authorization review

**Date:** 2026-11-22 · **Scope:** SAFE founder-approved draft code / synthetic tests only.
**Draft:** [Merchant/API PR #222](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/pull/222).
**Live CF1 Worker:** bootstrap-only; unchanged, still refuses every real business API endpoint.

## Source-derived database facts

The existing Express [catalogue router](../localeats-api/src/routes/catalog.ts) filters the database view by shop approval and archive status, but deliberately excludes those private status columns from its public SELECT projection. The new CF2 adapter must **select the two status columns internally, verify them, and strip them from customer JSON**.

The checked-in [merchant availability SQL](../supabase/drafts/merchant_availability.sql) creates the view with security_invoker=true, revokes access from PUBLIC, anon and authenticated, and grants SELECT to service_role. These are source/migration facts, not a live audit of the staging project. An anonymous/publishable Supabase key is NOT established as sufficient for this read. Do not grant the view publicly to work around an error.

The database-computed effective_is_active plus availability_revision controls shop truth. Do not infer opening from a client clock or an obsolete browser cache.

## Prepared CF2 adapter — mock transport only

Source: [stagingCatalogRepository.mjs](../localeats-api/cloudflare-staging/stagingCatalogRepository.mjs).

The repository constructs explicit GET-only plans for approved nonarchived shops, shop detail, and same-shop menus. An optional PostgREST reader accepts an **explicit injected fetch function** and checks the exact HTTPS staging project hostname; it has no default network transport, hardcoded project, secret, or runtime Worker import.

Safety limits: at most 200 shops and 400 items per shop, maximum 8-second HTTP request, 192KiB response bound. Prefer: count=exact and a complete Content-Range prevent silent partial catalogues; malformed scopes, missing counts, truncation, redirects, non-2xx replies and invalid JSON fail closed. Caps are starter constraints, not final scalable catalogue design; introduce approved pagination or bounded batching before the pilot outgrows them.

Tests use **synthetic mock HTTP responses**, not any real Supabase data. The deployed default Worker still injects no repository. No schema, credential, REST endpoint or secrets were changed.

## Connected Supabase inventory — metadata only

Connected Supabase shows two active projects named LocalEats and LocalEats-Profile-Staging. The second is a **possible reuse candidate**, not a verified isolated catalogue database. I did not inspect or change tables, records, credentials, SQL grants, accounts or migrations. Before reusing any project, verify permissions and fixture isolation under an explicitly approved staging-data scope. Do not create an extra billable project by default.

## Existing Firebase verification discrepancy

The existing [administrator middleware](../localeats-api/src/middleware/authenticateAdminFirebase.ts) uses verifyIdToken(token, true), which requests Firebase revocation checking. The general [merchant/customer middleware](../localeats-api/src/middleware/authenticateFirebase.ts) calls verifyIdToken(token) without that flag. Firebase documents that verification without checkRevoked does not check token revocation.

New source-only [firebaseAuthParityGate.mjs](../localeats-api/cloudflare-staging/firebaseAuthParityGate.mjs) and [synthetic tests](../localeats-api/tests/cloudflare-cf2-firebase-auth-parity.test.mjs) model a mandatory revoked/disabled-token check. This **does not** import Firebase Admin, contact Firebase, authenticate live users or grant merchant/admin rights. Verified identity alone is insufficient without independent shop-owner and customer-resource authorization.

Cloudflare compatibility of Firebase Admin and FCM is unverified. Test actual SDK compatibility under reviewed nodejs_compat in a separately isolated runtime before any authenticated route can be opened; no JWT signature-only downgrade.

## Scale, cost and release gates

- Read-only public catalogue requests can become expensive if every home refresh causes a shop list plus a separate menu call per shop. Measure API subrequests, database reads, Worker CPU and image bytes before public rollout; consider indexed batching and conservative version-aware caching without treating stale prices or shop availability as live.
- The target is affordable, reliable pickup-first operation, not a speculative one-million-user infrastructure bill. Define bounded-load thresholds and request budgets at the next staging milestone.
- No browser Supabase service/secret key, unrestricted public view GRANT, Production database reads, real customer data, checkout/order writes or online payment activation.
- Wait for exact-head GitHub CI and Wrangler dry-run results before claiming a completed CF2 code milestone.

**Next action:** validate the new mock transport and identity contract CI; compare existing staging project suitability after founder-approved restricted inspection; prepare a separate narrow approval request before connecting a real Supabase staging secret to any Cloudflare Worker or deploying a new Worker version. The previously approved one-time CF1 bootstrap release is already complete and does not authorize this next deployment.

**Official references:** [Supabase view privileges](https://supabase.com/docs/guides/database/views), [Supabase Data API security](https://supabase.com/docs/guides/api/securing-your-api), [PostgREST exact-count results](https://docs.postgrest.org/en/v16/references/api/pagination_count.html), [Firebase revocation](https://firebase.google.com/docs/auth/admin/manage-sessions), [Cloudflare Node compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/).
