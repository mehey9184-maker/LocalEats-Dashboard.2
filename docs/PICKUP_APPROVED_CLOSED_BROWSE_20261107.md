# LocalEats — Approved closed-shop browsing (isolated coordinated review)
Date: 2026-11-07 | Scope: pickup-only Customer catalog + original UI.

## Confirmed cross-app discrepancy

- Super Admin approves a shop through `POST /api/v1/admin/shops/:id/approval` after server-side Firebase Auth, active `admin_users.super_admin`, and the atomic `transition_shop_approval` function. Approval is distinct from opening for orders. The existing SQL approval function intentionally leaves `is_active=false` on approval and reinstatement; reject/suspend force `is_active=false`.
- Merchant `GET /api/v1/merchant/shop` returns the owned shop, including pending state. The Merchant UI separately gates operational pages on approved status.
- Public `GET /api/v1/catalog/shops` already returns **approved, nonarchived** shops even when they are closed, and its menu endpoint permits approved, nonarchived menus for browsing.
- However, `GET /api/v1/catalog/pickup-shops?lat=...&lng=...` previously rejected `is_active=false`, making approved closed shops invisible to the **actual Customer Pickup API**.
- Customer `mapPickupShop` independently rejected closed entries and stamped `isOpen:true`, even for a shop with a separately supplied false status. An existing horizontal shop card also disabled entry while closed.
- **User-approved UX**: approved closed shops should be visible and their real menus/prices browsable; buying must stay disabled. Preserve existing shop cards, menu/cart presentation, distance sorting, and four-kilometre boundary.

## Minimal isolated changes

**API draft** (this repo):
- Preserve server-side approved/unarchived catalog selection, location/pilot-area and real-coordinate validation, 4 km maximum and nearest-first sorting.
- Accept only **boolean** effective `is_active` (open or closed) from the verified `shops_with_availability` database view, rather than filtering out closed shops.
- Return the real status unmodified; no fabricated orders, reviews, prices or notifications.
- Existing `/api/v1/orders/quote` and create/merchant Ready authority remain unchanged: closed, suspended, unapproved and archived shops still cannot accept new pickup orders. `PICKUP_WRITES_ENABLED` stays OFF.

**Coordinated Customer draft** `mehey9184-maker/LocalEats-app`:
- Accept verified open or closed boolean status in `mapPickupShop` and set `isOpen` to match `is_active`.
- Keep the closed shop card clickable (also via keyboard) so its real menu is accessible; the existing card styling remains.
- Existing `MenuItemCard` checks `getShopStatus(shop).isOpen`, shows `Closed`, and blocks adding sold-out/closed items. The quantity modal's confirm handler now re-checks closed state to prevent a stale modal from adding to the cart.
- Keep all original app design and checkout flags.

## Testing / known blockers

- API synthetic route regression for nearby open+closed verified entries, approved+unarchived repository filter, distance/location, and menu browse.
- Customer synthetic mapper/caching/source guards prove status authenticity, closed browse, no invalid prices or out-of-radius results, and UI cart prevention. Both repositories need CI + manual browser acceptance before any merge/deploy.
- **Important:** This is NOT a real hosted Customer/Merchant/Super Admin journey. Approval-RPC and database changes have not been exercised together on a complete isolated staging project; staging Production-schema parity, Firebase published named-database rules and Supabase signup/rider permissions are separate launch blockers.
- Existing `isPickupPilotShop` restricts the pilot to textual location values `Tembisa/Thembisa/Ivory Park`. **Do not expand this to other suburbs without owner decision**; it is a business rollout boundary, not a technical radius calculation. The 4 km customer-to-shop radius still applies.
- No fee/trial start upon approval: owner confirmed a 3-month free period only when approved merchant begins real trading, not while testing. No billing activation.

No Production deployment, feature flag change, database mutation, merge, payments, Rider/delivery activation or live orders authorized. Coordinate both separate draft PRs and independently review before later owner-approved release.
