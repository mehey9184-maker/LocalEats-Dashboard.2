# CF2-A — Staging catalogue fixture acceptance

**Date:** 2026-11-22 (Africa/Johannesburg) · **Result:** COMPLETED — synthetic shop/menu fixtures suitable for further isolated catalogue rehearsal, NOT approved for live API connection.
**Scope authorized:** Founder replied “Next recommended task — CF2-A” to the exact proposal to inspect staging-only shop/menu test records. Only read-only aggregate and bounded synthetic-fixture SELECT queries were used.
**Project inspected:** Connected Supabase project **LocalEats-Profile-Staging**. The **LocalEats main project was not queried**. This is a real separate Supabase project but entire-account/customer isolation has not been independently proven.

## Evidence from actual database (read-only)

- First aggregate query counted **5 shops and 3 menu items**. Every shop and menu row has both an ID and a name containing test/fixture/demo/staging-related markers. **No untagged shop/menu rows** were found in this project.
- Shop rows returned with a bounded test-fixture filter (test ID and test name only), selected fields: test ID, test name, approval state, archived boolean, stored/effective availability, revision, and booleans indicating location-field presence. **No owner IDs, contact details, profiles, customer identities, order or payment content was read.**
- Synthetic shop cases: `stg-test-shop-open` (approved, not archived, effectively open); `stg-test-shop-closed` (approved, not archived, effectively closed); `stg-test-shop-far` (approved, not archived, effectively open); `stg-test-shop-pending` (pending, effectively closed); `stg-test-shop-archived` (approved historically but archived, effectively closed). All have an integer availability revision and location columns. Availability is a time-dependent database-computed observation; it must be rechecked when using the data.
- Exactly **3 approved/unarchived shops** are public catalogue candidates. Two of those were effectively open and one was closed at inspection; **1 pending and 1 archived shop must not be returned publicly**.
- Synthetic menu fixtures: `stg-test-item-kota-open` (R25, open shop), `stg-test-item-drink-open` (R10, open shop) and `stg-test-item-kota-closed` (R25, closed shop). All three item-level availability flags were true. A closed shop's available menu item can be browsed but **must not become orderable** while the effective shop status is false.
- Cross-check on fixture IDs verified **0 orphan menu rows, 0 menu rows on pending/archived shops and 0 null/negative menu prices or missing item-availability values**. Two items are exactly R25. There is no item test row on either pending or archived shop; negative-route denial remains covered by synthetic CF2 tests, not live test data.
- Derived synthetic-to-synthetic distance between `stg-test-shop-far` and `stg-test-shop-open` was approximately **8.9 km**, providing a candidate greater-than-4-km browse-only test without using any person's location.
- Read-only migration inventory listed an applied `20261109165612_r52o_isolated_staging_catalogue_schema_approval_a`, which is consistent with a staging catalogue schema. This **does not prove the individual fixtures were seeded by a reviewed migration**; exact fixture creation provenance was not found in the current GitHub search.

## Security constraints verified earlier in CF2 (no changes here)

- `shops` and `menu_items` have RLS enabled; in the inspected staging metadata, there were no SQL policies listed for them.
- `shops_with_availability` is a `security_invoker=true` view. The tested `anon` and `authenticated` roles do not have SELECT grants on the two tables or the view; `service_role` has SELECT. Do **not** add public grants or place a service-role key in browser assets.
- `owner_id` and other account linkage in shop rows were **not** inspected, and no other staging tables (profiles, orders, push, outbox) were read. Therefore we can establish **synthetic-only shop/menu sample content**, not entire-project or real-identity isolation.

## Decision and outstanding risks

**CF2-A fixture inspection: PASS within the authorized narrow scope.** The staging project is a **reasonable candidate for reusing as a catalogue test fixture source**; it is NOT yet approved as a backend connected to the public Worker.

Before CF2-B, choose and prove a least-privileged staging-only reader. The existing `service_role` access is broad and RLS-bypassing; a PostgREST call with only a publishable key cannot be assumed to read the restricted view. Document row-level/column-level separation and read-only guarantees; do not enable unauthorized public grants, use Production keys, assume Firebase runtime parity, or silently ignore results beyond strict caps.

**Scope expressly not exercised:** No updates, inserts, deletes, DDL, SQL grants, RLS changes, role or key creation/retrieval, Cloudflare environment/Worker changes, live requests to Production, customer/auth/order/profile queries, paid plan changes or GitHub `main` merges.

## Next authorization gate

Prepare CF2-B as a separate **founder approval** describing exact staging-only Data API role/secret permissions, isolated connection and Worker name, bounded smoke tests, logging/request CPU limits, rollback, and explicit no-orders/no-Production conditions. Source-only design and synthetic tests can proceed under SAFE autonomy; deploying or binding credentials requires separate consent.

References: [CF2 staging data/auth review](CLOUDFLARE_CF2_STAGING_DATA_AUTH_REVIEW.md), [Founder charter](LOCALEATS_FOUNDER_CHARTER.md), [Canonical handoff](LOCALEATS_PROJECT_MEMORY.md), [Migration issue #223](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/issues/223).
