# Merchant onboarding — Production vs catalogue staging schema parity

**Date:** 23 November 2026 · **Owner goal:** Start onboarding vendors as soon as safely possible.
**Status:** **SOURCE-ONLY DRAFT** — no hosted merchant account creation, database schema changes, staging API connection or Production deployment.

## Existing real merchant registration path

The Merchant Dashboard has a three-step `CreateShopOnboarding` flow that validates a shop's name, category, SA phone number, address/GPS, hours and uploaded logo. It calls authenticated `POST /api/v1/merchant/shop`. The backend checks that the Firebase UID does not already own a current shop and inserts the new shop as **`approval_status: pending` and `is_active: false`**. Super Admin reviews it independently; pending shops must never accept public orders. The new Vendor Pitch Kit in [LocalAdmin draft PR #6](https://github.com/mehey9184-maker/Super-LocalAdmin/pull/6) collects **paper interest only**, not real accounts.

## Verified read-only database schema findings

Inspected the *names, nullability and defaults of database columns*, not real row contents:

| Contract | Main **LocalEats** schema | Separate **LocalEats-Profile-Staging** |
|---|---|---|
| Shop coordinates | `latitude`, `longitude`, **`lat`, `lng`** (four columns) | Only `latitude`, `longitude` (two columns) |
| `shops.id` | Automatic UUID text default | **No automatic ID default** |
| `shops.phone` | Column exists | **No column** |
| `shops.approval_reason` | Column exists | **No column** |
| `shops.created_at` | Column exists | **No column** |
| `shops.owner_id` | Nullable in main schema (API sets authenticated UID) | Required |
| `shops.is_active` | Nullable, default true; API explicitly inserts false | Required, default false |
| `shops.approval_status` | Required, default pending; API explicitly inserts pending | Required, default pending |

**Important:** The existing `LocalEats-Profile-Staging` project was built for **synthetic read-only public catalogues**, not merchant account onboarding. **Simply deleting `lat/lng` from the INSERT cannot make that project signup-ready.** Do NOT add real merchant records to it, modify its schema for merchant accounts, or use its 5+3 sample catalogue fixtures as customers. All CF2-E backup and security restrictions still apply.

## What this draft changes (backward compatible by default)

1. Adds pure, tested `merchantShopCoordinates.ts`, which supports:
   - Default **`legacy-dual`** mode: keep exactly the previous four-coordinate insert mapping on the main database. No new environment variable needed for existing Production behavior.
   - Future **`canonical-only`** mode: two-coordinate mapping for a **separately reviewed merchant-capable database** that actually supports the entire shop signup contract.
2. To prevent accidental use of catalogue-only staging, `canonical-only` also requires server-only `MERCHANT_CANONICAL_SIGNUP_SCHEMA_VERIFIED=true`. Without a complete backend-schema proof it fails closed **before** checking/updating database rows.
3. Unknown server configuration gives HTTP 503 instead of silently assuming a schema. No public `VITE_` config or browser-driven schema selection.
4. After a successful server INSERT, the response is only marked successful if the persisted shop has the same authenticated `owner_id`, **pending** approval and **inactive** status, and valid canonical GPS coordinates. Returned `lat/lng` aliases come from the **database result**, not the request body. Invalid/conflicting fields fail closed; no silent retry on an ambiguous insert error.
5. Existing JWT validation, duplicate-owner check, request-field allowlist, Cloudinary HTTPS URL validation, shop review and all order write gates remain in place.

**No live signup is activated by this PR.** Do not change deployed environment flags, hosted databases, permissions or Production deployments merely because synthetic tests pass.

## Verification

- `localeats-api/src/routes/merchantShopCoordinates.test.ts`: pure dual/canonical mode tests, unknown mode rejection, coordinate bounds, persisted alias consistency and unsafe-response failure.
- `tests/merchant-shop-onboarding-schema.test.mjs`: route security contract checks (Firebase owner binding, pending/inactive verification, no browser-supplied schema, no automatic failure retry).
- `.github/workflows/merchant-onboarding-schema-parity.yml`: tests, API TypeScript build and regression proof; **no cloud, database or network writes**.

## Path to honest live vendor signup

**Vendor interested:** the founder may conduct interviews and collect voluntary consent on a secure paper form using [LocalAdmin draft #6](https://github.com/mehey9184-maker/Super-LocalAdmin/pull/6) once reviewed and approved. This is NOT a merchant account.

**Actual merchant account:** requires approved accessible Merchant hosting and Firebase authentication, API and Supabase merchant creation compatible **with the real target schema**, shop image upload, duplicate/owner checks, real pending review, approved commercial/privacy terms, backup recovery, and supervised acceptance by a consenting vendor. **Do not execute this on the isolated CF2 catalogue staging project.**

**Public customer orders:** remain a separate, later release gate; the current Cloudflare CF1 API is a no-data/read-only bootstrap, CF2-E hosted SQL blocked on a current restorable backup, real GPS + FCM + checkout acceptance outstanding.

## Founder-ready progress distinction

Previous qualitative estimates were **75% pitch readiness** and **50% safe public orders**; founder targets **90% / 85%**. The targets are not verified percentages. Any increase should be tied to actual vendor-phone demo and customer-to-merchant success evidence, not just a green CI run.

Source of truth: [canonical LocalEats memory](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/blob/cloudflare/cf1-merchant-api-staging-20261122/docs/LOCALEATS_PROJECT_MEMORY.md). This draft is separate from and does not override the CF2-E backup hold.
