# Zero-fee pickup review

Branch: fix/pickup-zero-fee in both repositories. Production stays unchanged and PICKUP_WRITES_ENABLED=false.

## Cause and contract
The shared calculateAuthoritativePrice added PILOT_SERVICE_FEE to collection, and the installed pickup_create_order RPC independently recomputed 2.50. Pickup now uses authoritative menu subtotal with service_fee=0 and delivery_fee=0. R25 x1 = R25; x2 = R50. No additional VAT is charged or merchant VAT registration assumed. Delivery pricing is unchanged. Quote fingerprints change with the new breakdown, so old unpersisted consents must be refreshed. Existing persisted idempotency replay retains original facts before repricing.

Pickup promotions remain unsupported by the existing API and are rejected; client promo estimates cannot establish a discount. The Customer summary supports only explicit internally consistent server quote discounts. This is not a new discount-validation backend or approved coupon contract.

## Separate SQL approval required
File: supabase/drafts/pickup_zero_fee.sql (UTF-8, LF).
Raw SHA256: 0eb4e56cb7954070f1aa1b931a3f319382100bb0167fbd6932fb35eb2b7a2c73
Installed creation function body SHA256: 6ff9319db511da669b0489cef8d18fe6f252269096b243f3d40e3fc20696836a (read-only target verification matched).
The draft BEGIN/COMMIT transaction checks the existing function body and changes only its fee assignment via CREATE OR REPLACE FUNCTION. It preserves function identity/grants and all ownership/pricing/replay/event logic. No tables, columns, historical updates, Rider objects or payment/collection commands change. It refuses a second application through the body-drift check. The already-applied foundation file remains untouched.

## Ordered Production release, separately approved
1. Keep API writes false. Review this code, Previews, exact SQL and checksum; reconfirm target phdjumtqkooyppxozqsi and backup before approved SQL execution.
2. Apply only the approved new function replacement once, then verify the installed body, grants, unchanged existing records and zero-fee creation behavior in isolation. Do not execute the foundation migration again.
3. Deploy the reviewed API commit with writes false. Verify authenticated x1/x2 quotes return 2500/5000 minor totals, zero fee and legacy denials. A quote itself creates no order.
4. Deploy the paired original Customer and Merchant UI commits with writes off. Preserve Production API URL and existing Firebase configuration. Confirm summary/line items and Merchant persisted totals; no real order is needed to populate a screen.
5. Only after separate controlled-test approval enable the My-Kota/designated-Customer gates and follow the actual payment/handover protocol. Never infer payment from method or collection.

## Rollback
Disable API writes first and redeploy. Retain all orders, original intent hashes, prices, payment facts and append-only events. Do not undo the migration by deleting columns/events or rewriting historical totals. An app rollback must keep write denial; the zero-fee policy cannot silently revert to charged new orders.

## Validation
Results and Preview URLs are recorded in the review report. Disposable tests apply the unchanged foundation then this fee-only draft before SQL safety/race assertions and the real local HTTP/PostgreSQL journey. No live order or Production schema application is part of this task.

Validated locally: 139 API tests and API TypeScript/build pass; 13 Merchant tests/build pass; Merchant baseline/current 61 diagnostics with zero new. Customer has 14 focused tests, TypeScript and build passing. PostgreSQL 17 disposable migration, constraints/grants, concurrent creation and accept/cancel checks, and two-client HTTP journey pass. Existing journey assertions were updated for zero fees and structured 403 error codes; Production is unchanged. Diff checks and added-line secret scanning pass.
