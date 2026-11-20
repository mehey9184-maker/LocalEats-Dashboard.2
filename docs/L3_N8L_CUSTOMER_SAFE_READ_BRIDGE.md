# L3-N8L — Safe Customer public catalog and legacy private-data migration (draft-only)

**Date: 20 November 2026.** This source change is stacked on still-unmerged draft #202. No Production or hosted staging deployment, Firebase Security Rules publication, account creation, Supabase row/migration write, real order, payment, FCM send or Rider activation is authorized.

## What already existed (do not rebuild it)

The Customer app's primary pickup discovery flow already calls `src/services/customerPickup.ts` → `createPickupApi` → `GET /api/v1/catalog/pickup-shops?lat=<real>&lng=<real>` and `GET /api/v1/catalog/shops/{id}/menu`. The server `localeats-api/src/routes/catalog.ts` reads from a **server-only** Supabase client, applies **approved, nonarchived shop** checks, enforces **verified numeric location and <=4 km pickup radius**, preserves approved closed shops for browsing and excludes private My-Kota test fixture IDs. The existing original ShopCard, menu and cart are kept. Pickup ordering remains OFF. **Do not replace this working path with direct Firestore reads.**

The legacy Customer `src/hooks/useShopsData.ts` and `src/lib/firebase.ts` still include unfiltered Firestore `shops`, `menu_items`, reviews, follows, messages, customer profiles, orders and Rider location methods. `src/App.tsx` uses the verified pickup catalog as its main shop source, but certain legacy review/follow/chat/profile actions still call the old modules. On `localeats-staging`, the strict N8J/N8K Firestore rules candidates intentionally block most of these legacy operations; they are **NOT deployed**.

## New API draft: allowlisted public response fields only

`localeats-api/src/routes/publicCatalogProjection.ts` explicitly projects only safe, flat scalar display properties to public shop/menu JSON **after** the existing server-owned approval and availability calculations. All four GET response shapes are covered: `/catalog/shops`, `/shops/{id}`, `/shops/{id}/menu`, and `/catalog/pickup-shops`. Even a test repository object returning extra columns cannot expose `owner_id`, phone, owner email, approval reason/status, financial information, Firebase UID, secret/token strings, raw availability revisions or arbitrary nested objects.

- Public shop display fields: `id,name,description,location,category,logo_url,rating,opening_time,closing_time,is_active,latitude,longitude,lat,lng,story`.
- Public menu display fields: `id,shop_id,name,price,description,image_url,category,is_available`. No direct customizations or server cost information. Missing menu price isn't fabricated.
- Internal availability `effective_is_active`, `availability_revision`, `availability_override_until` and `stored_is_active` are **not** sent to clients. Availability remains server-authoritative. API still uses the existing Supabase select allowlist and approval filter.

`localeats-api/src/routes/publicCatalogProjection.test.ts` and `publicCatalogResponse.test.ts` perform synthetic pure and actual loopback HTTP response tests for extra sensitive properties, closed-shop discovery, geo filtering, wrong-shop 404, menu item projection and no new mutation routes. They don't access hosted Supabase or Firebase.

## New Customer draft: private fields never enter ShopCard / menu

Separate Customer repository, branch `review/l3-n8l-customer-public-read-privacy` based on the verified Customer staging Preview source commit `c77736e7b4878965baa31ec2ada8138f554d6a7f`:

- `src/services/pickupMapping.ts` replaces raw `{...shop}` and `{...item}` spreads with a strict public display mapper. The existing original ShopCard contract, menu item names/prices, closed-shop browsing, GPS and 4 km pickup eligibility stay the same. It excludes sensitive owner, contact, financial, role and internal availability fields even if a server returns extras.
- `src/services/customerStagingNoDirectWrites.ts` rejects legacy direct Firebase/Firestore mutations **only when the Customer's configured Firebase project is `localeats-staging`**. This is a **browser defense in depth**, not Firebase Security Rules; altered clients could bypass it.
- `src/lib/firebase.ts` blocks 13 legacy direct Firestore/Storage-style mutations in staging (review, follow, support contact, Rider position, messages, read receipts, profile mirror, push token, shop/menu edits), BEFORE Firebase SDK writes. `src/lib/supabase.ts` refuses staging signup/first-time Google provisioning/password reset and profile-password update while keeping existing email/password sign-in; the legacy mock Supabase mutation chain now returns a **truthful no-write error in staging**, rather than `error:null` for a write it never saved. Nonstaging Production fallback semantics remain unchanged.
- The public pickup API client, identity checks, quotes/order write gates, original shop card/menu/cart and active routes are not changed. No real Firebase Auth, rules, FCM or Supabase call is made by the synthetic test suite.

## What remains deliberately blocked

**The isolated staging Supabase schema has shops/menu as the supported server public catalog sources. A completed, authorized server data model for Customer reviews, follows, order chats, support messages and browser token writes is NOT verified here.** Do not invent a backend table, permit broad Firestore access or claim these requests persist. The legacy Customer `src/lib/supabase.ts` is largely a no-op compatibility facade: do not interpret `{data:[],error:null}` as evidence of a real database transaction.

Future safe endpoints must verify Firebase ID tokens with revoked/disabled-account checks; shop/order ownership **on the server**; explicit, bounded, role-scoped response projections; idempotent writes; rate limits/abuse handling; and staging-only data isolation. Review submissions must verify an actually collected pickup, not client-supplied stars/UID/receipt. Chat messages must require an actual order participant and exclude Rider features until approved. Push subscriptions must be scoped to an authenticated device + verified Firebase project and separately approved stage-only write activation. Support contact must avoid leaking private payloads. No new write endpoint is mounted in L3-N8L.

**Firebase Rules release remains BLOCKED:** Both Customer and Merchant staging use `localeats-staging` Firestore `(default)`. The currently **deployed** staging Rules source/release ID and private rollback snapshot have not been obtained. N8J/N8K deny-all-write candidates break these direct Customer legacy paths and cannot be published until compatible server flows and exact target/rollback are verified. The nonexecuted read-only Rules fingerprint helper remains in draft #202.

## Owner gates

CI on API/Customer **separate draft PRs** → manual review of original UI equivalence → approval for any staging API/Customer deployment (do not promote branches or change stable aliases implicitly) → independent read-only deployed Firebase Rules snapshot + private rollback → separate approval for any stage rules change and disposable A/B shops/accounts. Profile saves, reviews, messaging, order activation, payments, Rider and real FCM remain OFF.
