# LocalEats pickup radius policy — any approved town, ≤4 km

**Decision:** 2026-11-07 owner chose that any approved shop within a customer's current 4 km radius is eligible regardless of its town, suburb or `shops.location` display text. This applies to Customer discovery, read-only quote and eventual server-authoritative create after owner-approved activation. **Pickup-only, pay at shop, no delivery/rider for 6+ months.**

## Truth table

| Shop state | Actual coordinates + ≤4 km | Discovery | Menu browsing | New pickup quote/create |
| --- | --- | --- | --- | --- |
| Pending/rejected/suspended/archived | any | hidden | blocked | blocked |
| Approved; closed / outside operating hours | yes | shown as Closed | real menu visible | blocked |
| Approved; open | yes | shown as Open | real menu visible | eligible if item/auth/payment constraints pass |
| Approved; open/closed | farther than 4 km | hidden | not offered in nearby discovery | blocked |
| Approved; open/closed | missing, invalid or nonfinite pin | hidden | not offered in nearby discovery | blocked |

**A town string cannot expand or shrink the radius.** The API validates latitude and longitude; the merchant's displayed address is informational, not authority. Nearest shops appear first. The 4 km decision applies to each customer's actual location individually; it is **not** a 4 km circle anchored to one launch town. Real ordering is still disabled.

## Source-level changes (new STACKED draft)

Branch `fix/pickup-any-town-radius-only-20261107` starts from the unmerged API **closed-browse draft PR #82**; it must not be merged before that prerequisite is independently reviewed. `/api/v1/catalog/pickup-shops` no longer filters location strings. `pickupReadQuote` and `pickupPricing` likewise remove `OUTSIDE_PICKUP_PILOT` checks, while preserving:

- server approval/status, nonarchived checks, true availability and actual shop coordinates;
- maximum 4 km calculated from customer coordinates;
- valid menu items, available stock, server-calculated ZAR prices and zero delivery fee;
- authenticated pickup-only cash or physical card machine, zero tips, validated contact;
- idempotent order creation and user/merchant ownership; no rider, online payment or delivery.

The two obsolete `isPickupPilotShop` helpers (API and order contract) are removed. Unit/route tests now prove a nearby shop is eligible regardless of `location` text, and invalid coordinates, >4km, closed and unapproved shops still fail as before.

## CRITICAL UNRESOLVED Production database gate

Read-only inspection of Supabase Production project `phdjumtqkooyppxozqsi` confirmed on 2026-11-07:
- `public.pickup_create_order(text,text,jsonb)` is installed;
- its body contains **both** `OUTSIDE_PICKUP_PILOT` and `OUTSIDE_PICKUP_RADIUS` checks;
- `anon` has no EXECUTE; `service_role` has EXECUTE.

The checked-in **review-only** SQL drafts `supabase/drafts/pickup_zero_fee.sql` and `supabase/drafts/pickup_launch_foundation.sql` still contain:

```sql
if sh.location is null
   or sh.location !~* '\m(tembisa|thembisa|ivory[[:space:]]+park)\M'
then raise exception 'OUTSIDE_PICKUP_PILOT'; end if;
```

**Do not modify, auto-run or silently replace these existing reviewed drafts.** They have separate fee/creation/fencing and safety assumptions. Coordinate a separate REVIEW-ONLY, hash-pinned SQL migration against the *actual installed function body* that removes ONLY the town-string check while retaining the locked shop row, approval/open state, geographic radius, price/menu validation and service-only RPC grants. Rehearse on a correctly restored disposable PG17 schema and re-test the complete pickup operation; do not touch Production SQL without fresh explicit owner signoff, independently verified rollback and backup.

**Current DB would reject some newly eligible shops at live create**, even if preview/API quote succeeds. Thus **no live activation/merge/deployment** of the geo-policy changes until the database cutover is tested and approved. Confirm the quote and create use consistent checks, otherwise customers may see quote success but creation failure.

## Cross-repository coordination

- Super Admin maintains verified shop approval and approval-history actor; it must not auto-open new shops.
- Merchant controls actual open status and genuine shop coordinates. No fake coordinates or guessed town defaults.
- Customer closed-browse draft [Customer #74](https://github.com/mehey9184-maker/LocalEats-app/pull/74) plus API prerequisite [API #82](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/pull/82) must be reviewed together. Customer already sends GPS to pickup catalog and authoritative quote/create; the geographic decision requires **no new Customer UI or client-side town filter** on this verified API path.
- Trial starts only after approved shop truly starts trading; do not interpret approval, `created_at`, first Preview visit or test order as billing start.
- Separate launch blockers: actual deployed Firebase named-database security rules, Supabase role/Rider GRANT lockdown, staging schema parity, hosted A/B account isolation and full pickup tests.

## Verification boundaries

This PR's synthetic API tests cannot establish hosted end-to-end acceptance, shop GPS truth or the installed DB function's new behavior. The companion SQL change is deliberately **not applied**. After policy update and later separately approved staging parity, test two approved shops within 4 km but different suburbs, one 4.01 km away, a pending/archived shop, a closed shop, and two accounts for ownership isolation. Verify Super Admin decision → Merchant open → Customer browse/quote/create → Ready/Collected with staged synthetic accounts only.

**Draft only.** No Production Supabase/Firebase/Vercel change, no shop/account/order modification, no SQL migration, no merged PR, no subscription/billing/payments/Delivery/Rider activation.
