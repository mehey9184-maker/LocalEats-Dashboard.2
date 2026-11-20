# LocalEats — provider boundaries, cost control and migration handoff (2026-11-20)

**Status:** owner intent + repository/hosting observations; **documentation only**. This is NOT a deployment certificate, production schema migration, security-rules publication, or proof that every frontend has completed its API-only migration. Read this **before** changing Firebase, Supabase, API routing, media storage, authentication, or launch flags. The current active launch scope is **pickup-first, pay at the physical shop**; Rider/delivery, online payments, LocalPay, rewards activation and subscriptions are not approved for public activation.

## 1. Owner's long-term architectural rule (desired state, not a claim about current code)
LocalEats must remain **portable, inexpensive to operate, and replaceable one provider at a time**. The owner wants to avoid unexpected Supabase egress and being forced into a rewrite or vendor lock-in when upgrading or moving Supabase, Firebase, image storage, or API hosting. Prior informal descriptions of "Supabase for customers / Firebase for shop owners" are an **initial mental model, not an implemented or verified split**. Do not split authentication or move data solely on that phrase. Present migration choices and costs to the owner, and preserve the approved original UI/UX.

## 2. Observed services and evidence, 20 Nov 2026
| Boundary | Current evidence (not always fully deployed/active) | Portability principle |
|---|---|---|
| Authentication | Both Customer and Merchant frontend login/signup source call **Firebase Authentication**, including `signInWithEmailAndPassword`. Authentication is **not** confirmed to be divided between Supabase customers and Firebase merchants. | Keep a small Auth adapter; verify Firebase ID tokens server-side and map provider UID to stable internal actor IDs before any future auth migration. |
| Merchant authorization | API verifies a merchant's owned/approved shop; browser profiles and Firestore metadata must not confer shop ownership or admin powers. | Enforce server-side ownership and scopes, not provider-specific claims or local cache. |
| Customer/merchant transaction records | Supabase **PostgreSQL** staging contains `shops`, `menu_items`, `orders`, pickup events/outbox; the pickup API is designed to be server-authoritative. Production and staging Supabase projects are separate. Some legacy code still reads/writes Firestore. Do **not** describe Supabase as storing only customer accounts. | Put prices, catalog/ordering, status transitions, idempotency, payments-at-shop receipts and ownership behind a narrow API/data repository interface; never let browser-supplied prices or unauthenticated SQL drive orders. |
| Production Firebase / Firestore | Owner's Firebase Console screenshots identify Firebase project **`localeats-5e26e`** (display name Localeats) and the **named** Firestore database `ai-studio-localeatsvendord-a61b068b-3029-4d93-ba41-626b03a23bbe`; its `menu_items`, `shops`, `orders`, `profiles`, `users`, etc. are visibly present. Existing bundled `firebase-applet-config.json` files match these IDs. Presence of data is **not** proof it is the authoritative live order store. | Inventory and retire direct client Firestore dependencies deliberately, per feature; no blind rules deployment or deletion/migration of existing data. Firebase rules and their published release are database-specific. |
| Staging Firebase | Dedicated Firebase project `localeats-staging`, Firestore `(default)` in paired Vercel preview environment variables. **The published staging ruleset/release is not independently attested from the owner-provided Production screenshots.** | Verify exact project/database and current published Rules release before any real staging account or write rehearsal. Never copy the Production named-DB rules deployment target into staging. |
| Firebase Cloud Messaging | Owner's Production Firebase Console shows **FCM HTTP v1 enabled**. Earlier owned-browser tests demonstrated notifications; HTTP v1 enabled alone does **not** prove real-device push delivery or end-to-end pickup notifications. | Wrap message scheduling and provider token operations in a notification interface; retries/deduplication/status reports must distinguish provider acceptance, browser receipt and OS display. |
| Image/media storage | Existing Merchant upload source and document URLs use **Cloudinary** (including image URLs visible in the owner screenshot). **Cloudflare R2** is a desired future media-storage option, not verified as an active completed cutover. | Store stable asset IDs/storage keys and metadata; serve optimized media via a CDN, avoid coupling domain data to a single provider URL; migrate assets with verification before removing old URLs. |
| API/hosting | Live and staging LocalEats API use a Vercel/Express deployment today; a Cloudflare Worker API is an **architectural direction**, not proven current production hosting. Separate Customer, Merchant and API staging projects exist. | Frontends should use a versioned LocalEats API contract; changing server/hosting/storage must not change the user-facing contract. |

## 3. Explicit environment boundaries and current release gate
- **Production Firebase:** `localeats-5e26e`, Firestore named database above. **Staging Firebase:** `localeats-staging/(default)`. These are different projects and databases. Confirm the deployed rules version separately for each. A text file of rules or checked-in `firestore.rules` is **not evidence of current publication**.
- **Production Supabase:** project `phdjumtqkooyppxozqsi`. **Isolated Supabase staging:** project `rgpbdajhlrwfmhopzgzk`. All environment and service-role credentials must remain secret and server-side. Do not copy Production data/accounts into staging for tests.
- **L3-N8P** [Merchant/API draft PR #208](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/pull/208) documents a successful staging **rollback-only** database safety rehearsal; it is **not** a successful authenticated end-to-end pickup test. Staging had zero orders/events/outbox rows after rehearsal; three database hard-off triggers were enabled.
- As inspected on 20 November, `PICKUP_WRITES_ENABLED=false` for the Production and staging APIs and `VITE_PICKUP_ORDERING_ENABLED=false` for public Customer/Merchant and paired staging apps. **Do not enable flags, disable triggers, deploy Firebase Rules, create customer/merchant test identities, merge PRs or publish orders based on this document.**
- Staging Merchant and Customer previews still point at **different API aliases**; pair and verify exact origins/CORS and the Firebase Admin project identity before signed-in customer→merchant tests.
- Production Firebase rules for the named database have **not** been validated from the screenshot alone. The owner-provided 233-line Firestore rules text resembles source rules, not independently proven published rules. Treat any supposed deny-all rules as unscoped until the exact Firebase project and database are established.

## 4. Target provider-neutral contract (design proposal, not a shipped feature)
```text
Customer App / Merchant Dashboard / (later Rider App, Super Admin)
                    |
              LocalEats API v1
         auth / ownership / validation
         pricing / idempotency / lifecycle
             /        |         \
    IdentityAdapter  OrderRepository  MediaAdapter
    (Firebase Auth)  (SQL provider)   (Cloudinary now;
                                      R2 candidate)
                       |
               NotificationAdapter
                 (Firebase FCM)
```
The **API** must own order creation, server prices, shop and actor authorization, permitted transitions, receipt truth and replay protection. The UI must not directly use a vendor SQL client or Firestore write to bypass those protections. Read-only legacy Firestore paths are to be inventoried and migrated individually; they are not automatically deleted. Firebase Auth may remain the single identity provider for both customer and merchant even if the order database moves; migration to separate Auth providers needs an explicit decision and UID/ownership mapping.

## 5. Minimize cost/egress without breaking correctness
1. **Measure before optimizing:** baseline provider-specific DB egress, read/write volumes, CDN/media bandwidth, API request totals and failed/retried requests (staging vs Production separated). No guaranteed savings without measurements; egress is not the same as query count.
2. **Small, bounded API responses:** paginate shops/orders/history; return only needed fields and delta updates; avoid shipping complete tables or private customer fields to every browser.
3. **Cache only safe public data:** CDN/cache public shop and menu summaries with bounded TTL or server-driven invalidation on merchant changes. Never cache a user's private orders across identities or falsely display cached state as confirmed payment/handover.
4. **Media:** sized/compressed images from an image CDN, not Postgres payloads; avoid redundant copies/uploads; retain durable object IDs for eventual R2 migration.
5. **Notifications:** use FCM to signal changes and fetch authoritative state on open; don't depend solely on push for correctness. Back off repeated polling where appropriate while preserving freshness for kitchen actions.
6. **Server-side access:** API uses least-privilege DB access, server-authenticated price queries, rate limits, verified owner scopes and idempotency keys. Never expose Supabase service keys, Firebase Admin credentials, FCM server secrets or Cloudinary signed upload secrets to browser code.

## 6. Mandatory migration/upgrade playbook
- Inventory all actual reads/writes by feature and provider, including legacy Firestore compatibility bridge, Firebase Auth and Cloudinary direct upload code; label each **LIVE**, **STAGING**, **LEGACY**, or **PLANNED**, and record owner approval.
- Freeze an explicit versioned interface and schema contract. Use stable LocalEats IDs plus mapping to provider UIDs; prevent an auth provider change from assigning another shop to the wrong actor.
- Create and **restore-test** backups and exports, including relational constraints, image objects and URLs, identity associations, order history and notification subscription mappings; verify checksums/counts, not just the existence of an archive.
- Prepare an isolated staging provider, apply reviewed migrations there, compare synthetic end-to-end quote→order→accept→ready→paid-at-shop→handover with cross-owner denial and double-submit/idempotency. Require **real** owned-device FCM evidence for push claims.
- Move one provider **behind the API adapter** at a time. Use shadow read/compare or other bounded, privacy-safe cutover techniques; identify dual-write/conflict risks. Preserve a tested rollback path and prohibit destructive cleanups until verification.
- Publish Production only after owner go/no-go and validated compliance/cost checks; retain launch flags OFF until then. Report actual evidence, gaps, dates and commit/deployment IDs.

## 7. AI handoff / documentation truth hierarchy
1. Current security/launch constraints in each repository's `AGENTS.md` and scoped pickup skill.
2. This **dated** provider-boundaries document for owner intent and verified-as-of-date configuration; do not mistake a future target for present implementation.
3. Current `LocalEats_App_Functionality_Documentation.md`, `Vendor_LocalEats_App_Functionality_Documentation.md`, reviewed phase reports and git source for implementation details.
4. Deployed Vercel environment/commit and Firebase project/database **published** rules for actual runtime behavior; current direct evidence beats historical README, prompts and proposed migration files.

**Known legacy ambiguity:** the Customer README still has historical descriptions such as "Supabase (Auth, Firestore)" even though Firebase Auth is used in current login source; this document supersedes that description for architecture planning. A verified commit, environment and live test are required before claiming a feature is Production-ready.

**Last reviewed:** 2026-11-20. **Owner input:** optimize future provider portability and Supabase egress, without discarding existing approved UI or trading away security. No production data, Firebase configuration, live ordering, hosted SQL or credentials modified to produce this handoff.
