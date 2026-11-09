# LocalEats R5.2P — Fixture Approval B execution evidence (2026-11-09)

## Authorization and execution scope

**Owner expressly approved Fixture Approval B for fictional shops and menu items in `LocalEats-Profile-Staging` ONLY.** No approval for Production, new Auth accounts, real orders, reward grants, payment/reimbursement, merge, or UI replacements.

- **Exclusive staging target:** `rgpbdajhlrwfmhopzgzk`, `LocalEats-Profile-Staging`, PostgreSQL 17.11.0, ACTIVE_HEALTHY.
- **Reviewed fixture source:** draft PR #127 `supabase/drafts/r52k_catalogue_fixture_SYNTHETIC_ONLY.sql` at branch `review/r52k-staging-catalogue-migration-20261109`; GitHub blob `8f531e2e7235fd1089c0bc6f1d015e79d978927c` (3060 characters).
- **Write route:** authorized `Supabase.execute_sql` to the explicit staging project ref, using the SQL file unchanged after the narrow `localeats.r52k_owner_approval` guard, and its original SQL transaction (`BEGIN; DO preflight; INSERT shops; INSERT menu_items; COMMIT;`). This is **fixture data**, not a schema migration.
- **Preflight read-only PASS:** PG17; source P5 profiles intact/empty; empty shops, empty menu, empty availability view; no Auth users; R5.2O schema A migration present; two total migrations; synthetic staging sentinel matches; browser catalogue privileges denied, service-role catalogue SELECT granted and INSERT denied.
- **Database response:** SQL completed with empty result `[]` and no error. The independent read-back check below is authoritative proof of inserted rows.

## Staging database post-write checks — PASS

Actual read-only connected staging SQL returned `R52O_FIXTURE_B_PASS`:

| Property | Result |
| --- | --- |
| Total shops | 5 |
| Total menu items | 3 |
| Synthetic IDs/owners for all shops and items | 5/5 and 3/3 |
| Approved, unarchived shops | 3 |
| Pending shops | 1 |
| Archived shops | 1 |
| Profile rows | 0 |
| Auth user rows | 0 |
| Migration-history count | **2 unchanged** |
| Closed fixture shop menu rows | 1 |
| Open fixture effective_is_active | true (temporary 7-day availability override) |
| Closed fixture effective_is_active | false |
| anon shop SELECT and authenticated menu SELECT | denied |
| service_role shop INSERT | denied |
| Shop/menu RLS | both enabled |
| View security_invoker | true |

**Synthetic-only test design:**
- `stg-test-shop-open` (temporary open override, expires 7 days from insert), with R25 Kota and R10 drink.
- `stg-test-shop-closed` (closed but menu browseable), with R25 Kota.
- `stg-test-shop-pending` (not publicly discoverable).
- `stg-test-shop-archived` (not publicly discoverable).
- `stg-test-shop-far` (approved but >4 km from fixed test origin).
- Fixed invented location **(-26.0000, 28.0000)**. **No user's actual location is used, modified, or implied.** Testing the client near that point requires an explicit synthetic-location test setup; otherwise its strict 4 km filtering may hide these shops.

## Real hosted staging API checks — PASS

All calls were made via Vercel authenticated account access to the **existing staging deployment** alias `https://localeats-api-staging-r52d-mehey9184-makers-projects.vercel.app`.

| API request | Actual result |
| --- | --- |
| `GET /api/v1/catalog/shops` | HTTP 200, **3** approved/non-archived fixtures (open, closed, far), no pending or archived |
| `GET /api/v1/catalog/pickup-shops?lat=-26.0000&lng=28.0000` | HTTP 200, **2** shops: open at 0 km, closed at ~0.456 km; far filtered out |
| `GET /api/v1/catalog/pickup-shops?lat=-26.0800&lng=28.0000` | HTTP 200, **1** far fixture shop, now 0 km; origin shops out of radius |
| `GET /api/v1/catalog/shops/stg-test-shop-open/menu` | HTTP 200, Kota R25 and drink R10 |
| `GET /api/v1/catalog/shops/stg-test-shop-closed/menu` | HTTP 200, R25 kota, closed shop browseable |
| `GET /api/v1/catalog/shops/stg-test-shop-pending/menu` | HTTP 404, `Shop not found` |
| `GET /api/v1/catalog/shops/stg-test-shop-closed` | HTTP 200, shop effective status false |

No new Vercel deployment or GitHub merge was needed. These checks cover **hosted API**, not manual **Customer UI** or Merchant Dashboard acceptance. No Customer design, actual shop geolocation, or production data was changed.

## Safety and next approval

**Fixture Approval B = COMPLETE.** Catalogues are synthetic read-only. **No real ordering, reward grant, payment, registration, rider activation, Production or merges.** Schema Approval A and Fixture B have both passed verification.

**Next gate:** Founder/customer manually checks the original ShopCard, Discover/Home, menu and closed-shop browse behavior using *synthetic fixed-location* tests without bypassing live safety gates. Then **Identity Approval C** would require a separate explicit authorization to create any fake staging Firebase/merchant identities. Recheck write-gate disabled, credential scope, token revocation, merchant ownership and idempotency independently.

**Outstanding before live:** full Supabase project recovery, hosted pickup-write safety, actual user/merchant order transitions, Production backup, billing/payment/settlement controls, funded and audited Bronze rewards pilot. The staged open fixture expires after 7 days unless separately approved to change.
