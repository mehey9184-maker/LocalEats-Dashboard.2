# LocalEats L1B — Additive Pickup Schema Design & Main Release Separation

**Date:** 2026-11-10
**Status:** Offline/disposable additive DDL rehearsal prepared; no hosted restore, schema migration or order writes authorized.

## Summary

L1A examined the hosted `LocalEats-Profile-Staging` database, project ref `rgpbdajhlrwfmhopzgzk`, and obtained `L1A_CURRENT_STAGING_BASELINE_PASS`. The current profile, shops and menu catalogue exists, but `orders`, `pickup_order_events`, `pickup_create_order` and `pickup_order_command` do not.

The owner asked to proceed to L1B **and to move safe work toward `main`**. We must *not* merge all draft PRs, which are more than 200 commits ahead of `main` in the Merchant/API repo and over 100 ahead in Customer. GitHub `main` can be a Production deployment source. Design and release are independent decisions.

## First deliverable: fail-closed disposable-only pickup schema

The file `security/drafts/l1b_pickup_additive_DISPOSABLE_REHEARSAL_ONLY.sql` is explicitly a **rehearsal**, with a hard database-name guard `localeats_l1b_disposable` that refuses hosted Supabase `postgres` databases. It:
- Requires P5 profile + R5.2O shop/menu tables already exist with their exact current column counts and initial 0/5/3 row baseline.
- Does not drop, alter or recreate `profiles`, `shops`, `menu_items`, catalogue functions/view or their grants.
- Adds `orders` with **text** `shop_id` FK to existing `public.shops(id)`, UID-bound `user_id`, UUID order ID, unique UUID-shaped idempotency key, 64-hex intent hash, revision, original customer/price/item snapshot and amount constraints.
- Adds `pickup_order_events` with UUID command ID, unique `(order_id,command_id)`, unique `(order_id,revision)`, event kind/actor and immutable-append design intent.
- Restricts pickup orders to collection; no rider, delivery fee, tip, promotion, wallet or payment gateway. Payment is cash or shop card machine with customer paying at the shop.
- Enables RLS + FORCE RLS on both new tables. All browser roles get **no** grants; service-role gets **SELECT only**. No backend `INSERT/UPDATE/DELETE`, no command/create RPC, no API/environment activation. Thus the rehearsal is **intentionally not capable of placing an order**.
- Uses `BEGIN` and short transaction lock/statement timeouts; fails on missing catalogue, unexpected privilege drift, existing pickup tables or any wrong database name.

The static Node tests in `tests/staging/l1b_disposable_additive_schema.static.test.mjs` verify the guard, add-only table scope, type/price/ownership/idempotency contract, and absence of executable RPC/write grants. Static tests are not Postgres DDL verification.

## Remaining design work before ANY hosted staging migration

1. **Fresh independently restorable backup:** L1A STOP remains in force. The earlier local schema restore does not cover today's current 5 shops, 3 menu items and two migration-history rows. Supabase-managed Auth/Storage migration history requires compatible restore evidence.
2. **PG17 disposable end-to-end rehearsal:** restore the CURRENT captured staging source into an isolated compatible clone and change its disposable database name only as part of that separate approved restoration workflow. Run the draft there; compare all original tables/roles/views/functions/privileges to the pre-install snapshot. Confirm there are two empty new tables, zero browser DML rights and no accidental write path. Test deliberate rollback on failure.
3. **Schema contract and API alignment:** current app `pickupService.ts` expects `pickup_create_order(p_uid,p_intent_hash,p_record)` and `pickup_order_command(p_uid,p_order_id,p_action,p_command_id,p_expected_revision,p_reason,p_payment_method,p_handover_confirmed)` RPCs and checks returned `order`, `replayed`, and command `event`. **These RPCs are not implemented by this rehearsal**. Write them under a separate narrowly reviewed privilege model and tests, or do not activate anything.
4. **Merchant owner identity mismatch:** existing `shops.owner_id` is constrained to `stg-test-owner-...`, and does not currently hold Firebase UIDs for the two test customers or a confirmed test merchant. Never loosen that check or substitute a browser-provided owner ID without review. Propose and separately approve a synthetic merchant mapping/onboarding fixture or new association table.
5. **Authoritative pricing/replay:** server re-fetches menu, validates line IDs and quantity, exact price and explicit consent, checks shop's current approved/open state and pickup radius, records one immutable intent hash, handles concurrent idempotency replay and rejects ambiguous quantities and cross-account commands. Race testing is mandatory before any write gate can open.
6. **Payment at the shop:** merchant-only verified `confirm_payment` and confirmed handover; never mark paid based on customer button or client timer. Every transition needs an append-only event receipt and monotonic revision.
7. **Security:** no public execution of a `SECURITY DEFINER` function, no `anon`/`authenticated` direct DB DML, restricted service identity, no unaudited `search_path`, no SQL dynamic identifier injection, limit sensitive output. Test ownership as Customer A, Customer B, owning Merchant and foreign Merchant. Reject replay of an old command ID with different payload.
8. **Operations:** don't enable Rewards, riders, profile writes, LocalPay, push outbox or payment integrations via a pickup schema migration. Separate go/no-go for app UI, Merchant transitions and production backup.

## Main integration — separate and narrow

- The current API review branch is **228 commits ahead of `main`**; Customer C1E branch is **123 commits ahead**. These contain more than the isolated work under review. Do not merge these large branches or drop protections from them directly into `main`.
- Use a new **`main`-based documentation-only draft PR** to establish the phased release plan without enabling any feature. Do not target the active `main` commit with the disposable SQL or bulk development runtime changes.
- For each independent runtime fix, prepare a **small cherry-picked or reimplemented PR from current `main`** (not from the draft stack), test the actual `main` baseline in CI, run a Preview deployment, verify backward-compatible API contracts and disabled flags, and require explicit owner sign-off for *that specific PR*.
- Before any merge to `main`, verify GitHub branch protection, required reviews/status checks and all Vercel Production Git integrations. A merge could deploy live even when the corresponding database schema is absent.
- Do not consider staging Customer PR #91, API #130/#131, Rider or Super Admin features launch-ready merely because their draft branch builds.
- Once Production deployment behavior is characterized, choose a controlled release window, prepared rollback, separate Production backup and explicit owner approval. Do not change a Production environment or schema as a side effect of `main`.

## L1B phase status / next gate

- L1B additive schema **design skeleton**: prepared, offline-only; **not approved for staging**.
- Static schema contract: requires local test result; disposable PG17 execution **pending**.
- Production-equivalent RPCs, stored event ledger, signed merchant ownership and integration tests: **outstanding**.
- Fresh current staging backup and clean-room restore: **blocked, owner-private action**.
- `main` integration: **documentation-only draft planned**, no merges.

**No remote SQL changes, no new hosted accounts, no real orders, no Production or PR merges.**
