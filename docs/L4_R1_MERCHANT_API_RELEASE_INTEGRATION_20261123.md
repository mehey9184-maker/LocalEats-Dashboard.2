# L4-R1 — Merchant/API source reconciliation + actual Customer↔catalog loopback contract

**Date:** 2026-11-23, South Africa. **Status:** Draft only — production writes and hosting remain OFF.

## Integration source decision
- Based on latest Merchant/API main `10556f752aa93622d5b20237ea3860ed2bd68f76`; preserves newer approved Marketing, Home and missing-photo fixes.
- Port *only* exact reviewed API `catalog.ts` and `catalog.test.ts` from PR #216 (`52110da7eec98813aed3021c7bdac60c0ead9a4c`). Main's two commits since that PR's base did **not** touch these source files. Pilot publication allowlist remains optional for backward compatibility; explicitly configured `PUBLIC_CATALOG_PILOT_SHOP_IDS=''` fails closed (zero published shops) and is intentional, **not** a normal catalog test environment.
- Port only reviewed `PickupOrderActions.tsx` and its focused regression from Merchant PR #220 (`66901eafd064e499ba712a78b715c14ed5e47f30`). No simulated order UI is imported.
- Port read-only exact-preview origin verification harness from API PR #216. It rejects Production hostnames and only calls GET/OPTIONS when explicitly executed; CI runs only the offline/mock contract, not real HTTP against Vercel.
- Customer candidate is held separate at `55251bcd2d96f8bf02348367830013da69a43124` (draft Customer PR #141, base Customer CF1 #140). A new loopback integration test checks its **actual** `src/pickup/client.ts` and public-browse adapter against the compiled API router using in-memory example shops/menus. This is a real HTTP interface/serializer test, not a deployed browser↔host test.

## Source tests and release admission
CI must pass API TypeScript, complete API suite, UI tests and build, mock preview CORS contract, and real Customer↔API loopback contract. Merchant root ESLint/type audit is reported distinctly, not waved away as a green release if failed. Preserve explicit hard-off write flags. Any errors block integration acceptance until explained/fixed; no test suppression.

## Non-negotiable restrictions
- **No main merge; no Production, Preview or Cloudflare deployment; no DNS, Vercel settings, Supabase migrations or Firebase rules; no real orders/merchant state/FCM; no billing upgrades.**
- A customer can browse genuine approved shops outside four kilometres, but never submit an order outside the strictly authenticated, server-authoritative 4 km quote/create gate.
- Do not publish all nine historical approved/test shop records by default in a public pilot. Verify and configure exact genuine shop IDs at release time, with merchant consent and effective availability separately.
- Actual phone GPS/mobile-data, exact deployed Customer/API domain CORS, real customer and shop-owner identities, background push receipt, one R25 pay-at-shop pickup, current CF2-E restorable backup and rollback tests are **still pending**.
- Current linked Vercel team is Hobby paused; an old READY deployment is not proof of HTTP availability. Hobby is also not a compliant commercial LocalEats host. Record an approved commercial hosting plan/alternative prior to public orders.

## Allowed release continuation
Only after CI and human validation: integrate Customer candidate, API pilot gate and Merchant feedback as one reviewed release matrix; freeze SHAs; practice read-only hosted Customer↔API acceptance; founder signs off on genuine shops, pilot owner device, backups, and compliant hosting. Public pickup remains HARD OFF pending explicit approval.
