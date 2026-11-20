# L3-N8M — Customer community contracts and isolated Preview acceptance boundary

**Date:** 20 November 2026. **Source-only drafts. No hosted data changes.**

## Verified staging schema, read-only

The connected `LocalEats-Profile-Staging` Supabase project was queried through `information_schema.columns`, without reading or writing any personal/shop/order rows. The verified `public` schema contains `shops`, `menu_items` and `profiles`. No `public.orders`, `reviews`, `shop_reviews`, `follows`, `shop_followers`, `messages`, `chat_messages`, `order_messages`, `contact_messages` or `user_push_tokens` tables were found in this scoped check. Other schemas/services were not exhaustively audited, and an absent public table does not prove no such data exists elsewhere. **We have no verified write-capable community storage or order participant lookup in staging.**

The Customer app source at draft #119 still directly reads Firestore `reviews`, `follows`, `messages`; its N8L guard denies legacy writes only for `localeats-staging`. N8J/N8K proposed Rules would block many of those reads. None of these direct paths is safely migrated by N8M.

## Server contract: dormant, authenticated and explicitly read-only

New `localeats-api/src/routes/customerCommunityReadOnlyContract.ts` exports `makeCustomerCommunityReadOnlyRouter(store,authenticate)` with a **required, injectable server-only read store** and the existing strict `authenticateFirebase` default. It is deliberately **NOT mounted** in `localeats-api/src/server.ts` and is not connected to the unverified staging schema. A normal deployed API will still return 404 for these planned routes.

Proposed paths under a *future* `/api/v1/community` mount:

| Method and path | Eligibility | Output |
| --- | --- | --- |
| `GET /shops/{shopId}/reviews` | Registered Firebase UID; server store must confirm shop approved and not archived; reviews must be individually published and belong to that shop | Up to 25; id, shop_id, integer rating 1–5, reviewed comment, timestamp only |
| `GET /me/follows` | Registered Firebase UID only; verified UID from server middleware, **never** query/body `user_id` | Up to 50 approved followed shop IDs; no owner data |
| `GET /orders/{orderId}/messages` | Registered Firebase UID; server store must confirm **collection/pickup** order and participant matching `customer_uid` or independently `verified_merchant_uid` | Up to 50 messages, each with verified sender role+UID matching order participants; text and timestamp only |
| `POST/DELETE/PATCH` review/follow/message/read-receipt routes | **Always blocked**, no write store provided | HTTP 503 `COMMUNITY_WRITES_DISABLED`; no persistence claim |

Every read sets `Cache-Control: no-store`. Invalid IDs, non-owner account, anonymous user and nonexistent/foreign order fail closed. Foreign order lookup returns the same generic 404 as a nonexistent order. Malformed, mixed-UID, unapproved, unpublished, wrong-shop or cross-order rows return a generic unavailable error, not raw records. All user emails, phone numbers, sender UIDs, owner IDs, metadata and unverified roles are stripped. The store contract requires a *verified* server-side order/shop participant lookup; a caller-supplied UID or a Firestore profile `role` must never authorize it.

**Important:** A synthetic in-memory store used in tests does *not* mean a real Supabase/Firestore implementation exists. Do not mount the router or claim real reviews/contacts/follows/chat succeed before separately approving the storage, moderation, verified collected-pickup review eligibility, order-scoped messaging, rate limits, retention, identity/project mapping and idempotent write design.

## Customer contract (separate draft)

The Customer draft branch `review/l3-n8m-customer-community-read-contract` adds `src/services/customerCommunityReadContract.ts`: HTTPS-only GET API client, Firebase bearer from a supplied token getter, no client-specified UID, strict response ID/role matching, explicit failure on 404/unavailable/no network/bad JSON and a public-field projection. It **is not called by App/ShopCard/ChatWidget** and has **no POST/DELETE/PATCH methods**. Existing N8L direct-write protections and UI are preserved.

## Verification / real Preview blockers

- Offline API HTTP tests use synthetic A/B Customer UIDs, merchant UID, guest, malformed reviews/follows, wrong shop IDs, foreign orders and untrusted message senders; all writes must reject. They never reach hosted Firebase/Auth, Supabase or Vercel.
- Customer contract tests use synthetic HTTPS transport and invalid response cases. Original pickup UI, server public catalog, 4 km and pay-at-shop remain unchanged.
- The actual staging API deployment on `localeats-api-staging-r52d` and dedicated Customer staging Preview on `localeats-customer-staging-r52d` **must both serve the exact N8M reviewed commits** for live end-to-end Preview acceptance. Previous N8L read-only Vercel inspection showed no N8L API or Customer branch deployment to those dedicated projects; an automatic Merchant Vercel Preview is **not** proof of a Customer/API pair.
- Before any hosted use, verify *both* Preview project identities, Firebase `localeats-staging`/`(default)` and API Admin service-account mapping, Supabase staging project, fully OFF writes, correct CORS, protected endpoints and no cross-Production dependencies. Without separate approval for hosted deployment and staging fixtures, do not create accounts, mutate data, publish rules, or claim A/B Firebase acceptance.
- The N8K deployed Firebase Rules snapshot and private rollback source remain **UNVERIFIED**; no Rules publication should occur yet.

## Release gate (unchanged)

All PRs remain draft/unmerged; no Production, Supabase schema/migration/records, Firebase Auth/rules/FCM, payments, pickup-order activation, Rider, review/chat/follow profile writes, or merchant profile API mount. Exact acceptance must be recorded only after real endpoints and real project-scoped identities can be checked.
