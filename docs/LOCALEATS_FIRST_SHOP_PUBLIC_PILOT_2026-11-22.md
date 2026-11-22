# LocalEats first-shop real pickup pilot — release HOLD until real acceptance

**Owner objective (22 November 2026):** Begin marketing, onboard an actual shop and allow authenticated customers to attempt real pickup orders while continuing development on separate branches.

This document records **preparation**, not Production activation. Do not describe production pickup as enabled until an actual deployed API and Customer build, genuine owner availability and real order acceptance are observed.

## Scope of first public pilot

- **Shop:** My-Kota (`shop-my-kota-ivory-park`) only, *after the owner is verified and ready*. Other test and unverified shops are not advertised or admitted.
- **Customers:** Firebase signed-in, **non-anonymous** accounts only. Customer location must be furnished to the server, and Haversine distance from the real shop must be no more than 4 km. Physical device location remains an acceptance gate; source-level checks cannot prove that a person is actually nearby.
- **Payment:** cash or card machine **at the shop**; no online card collection, LocalPay, Delivery/Riders or discounted rewards.
- **Availability:** merchant-owner-set authoritative effective shop availability, within advertised opening hours; the shop stays closed until the real owner explicitly opens it.
- **Safety:** server-side approved shop status, item availability, server prices, idempotent order persistence, owner-only order transitions, no anonymous accounts and an explicit pilot expiry.
- **Notifications:** registered FCM tokens alone are not proof of delivery. Before opening real ordering, verify actual merchant wake-up on a physical device and an actively supervised merchant dashboard inbox with manual fallback.

## New opt-in, fail-closed order-admission gate

API branch `release/first-shop-pickup-pilot-20261122` includes the original **single test UID** mode and adds a *separate* explicit public pilot mode:
- `PICKUP_WRITES_ENABLED=true`
- `PICKUP_PUBLIC_PILOT_ENABLED=true`
- `PICKUP_PUBLIC_PILOT_SHOP_ID=shop-my-kota-ivory-park`
- `PICKUP_PUBLIC_PILOT_EXPIRES_AT`: strict UTC timestamp no more than 7 days ahead.

All four requirements must be met; otherwise public pickup is rejected. Missing, malformed, expired or >7-day expiry fails closed; only My-Kota may be admitted by this release. No customer ID or address is sufficient to override 4 km, closed shop, missing menu or payment checks. The global write flag remains an independent kill switch. A distinct test-only mode still requires the pre-existing `PICKUP_TEST_CUSTOMER_UID` when the public pilot flag is not true.

**These flags are not enabled by this branch.** Vercel builds capture their environment at deployment; changing settings without a corresponding verified deployment does not activate new code. The Merchant availability-write flag and Customer/Merchant ordering flags remain separate.

## Verified baseline before this patch

- Production Customer SHA: `d5680332d391d9aa497d10ff047c839242b2d62f`.
- Production Merchant/API SHA: `a5168ccbbb37643a58ad4202c72b65dd43149c2e`.
- 9 approved/nonarchived public shop records, including test records and erroneous coordinates; all currently effective-closed.
- My-Kota: assigned owner, one available R25 item, configured 08:00–22:00, effective availability **false** and revision 4, three non-revoked push subscription rows.
- One preexisting order, zero pending outbox jobs. Do not alter or delete the existing order.
- Source-only Customer draft #127 and API draft #216 were previously CI-green, but paired hosted Preview and real device + shop owner acceptance remained unverified. A new public pilot order-admission branch adds more tests; check CI for the **latest** head.

## Correct release and pause sequence

1. **Merchant sign-up**: invite one real shop owner to register at `https://dashboard.localeatssa.co.za`; API `POST /api/v1/merchant/shop` creates a pending, closed shop and requires Firebase auth. This read-code assessment is not a complete live signup check. Owner verification and approval must follow. Do not automatically approve placeholder records.
2. **Catalog and Customer**: deploy vetted API+Customer builds with exact apex/www CORS and `PUBLIC_CATALOG_PILOT_SHOP_IDS=shop-my-kota-ivory-park`; browse-only Customer ordering remains OFF. Verify no misleading rating and all other public detail/menu URLs 404, 320/390px and PWA.
3. **Merchant/notification**: verify shop owner's Firebase identity and owned shop linkage, live device push on the shop owner's device, merchant order inbox and manual fallback. Confirm merchant personally available and capable of pickup and cash/card payment.
4. **One consenting real customer**: physically within 4 km, signed in, genuine GPS (not emulated), use the R25 menu with actual Owner readiness within 08:00–22:00. Confirm real quote and price with no order creation yet.
5. **Restricted activation**: set API availability-write gate so the owner can voluntarily open the shop, then activate the four scoped order-admission settings with a short explicit expiry. Deploy API Production only after Preview, CI and rollback references are confirmed. Enable Customer + Merchant pickup UI on their verified Production builds last.
6. **Physical acceptance**: create one real pickup only with the customer's specific consent. Confirm persistence, same-owner merchant acceptance, merchant device alert + manual inbox fallback, ready, payment confirmation, physical handover, collected status, and privacy isolation.
7. **Expand** only after the owner signs off on these real outcomes. Keep Riders/delivery/online payments/rewards OFF. Do not promise public availability while order gates remain OFF.

**Emergency pause:** set `PICKUP_WRITES_ENABLED=false` on Production API and redeploy/roll back the API so the change is actually running; disable Customer and Merchant ordering flags and redeploy them as needed; mark shop closed using the authorised owner workflow. Avoid deleting orders or toggling database schema. Keep the previous READY deployment IDs available.

## Separate continued-development branches

- Customer `develop/post-launch-customer-20261122` from tested PR #127 head.
- Merchant/API `develop/post-launch-merchant-api-20261122` from API PR #216 head.
- Public pilot release review `release/first-shop-pickup-pilot-20261122`; draft only.
- Never auto-merge `develop` into Production. Ship narrow, tested fixes through review.

## Still BLOCKED before real ordering

My-Kota is currently **effective closed**. Public order creation has not been accepted by a real, consenting customer; real FCM delivery and the full merchant handover are unverified. The Vercel Hobby deployment quota previously refused API Preview deployment (402). Treat all three as real release gates rather than bypassing or advertising orders as live.
