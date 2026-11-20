# L3-N8U-R — Production identity and first pickup acceptance

**As of 20 November 2026.** **Release decision: HOLD public pickup ordering.**
**Mode:** production **read-only** preflight + credential-free **local synthetic** API acceptance. This document does not authorize live Production orders, merges, Firebase rules publication, push sends, PWA installation, Production environment edits, migrations, payments or customer invitations.

This work continues stacked draft [L3-N8U-P PR #211](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/pull/211) and [L3-N8U-Q PR #212](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/pull/212). It preserves the Production Firebase + Supabase boundaries and keeps approved UI intact.

## 1. Actual Production shop eligibility — read-only records

Production Supabase project **`phdjumtqkooyppxozqsi`** contains **9 shops and 7 menu items**. A live read-only SQL inventory cross-checked each shop's approval, active/archived status, stored geographic pilot text, valid coordinates, owner UID presence, available and positive-price menu items, and non-revoked recorded push subscriptions. **No owner UID, customer UID, password or FCM token was exported.**

**Exactly one shop passes the static data prerequisites (not the live-open check):**

| Shop | Production ID | Approval / active | Location | Priced available items | Non-revoked FCM records |
|---|---|---|---|---:|---:|
| My-Kota | `shop-my-kota-ivory-park` | approved / true | Katlego Street, Ivory Park | 1 | 2 |

The current My-Kota menu item is recorded as **`cheeze, palone and meat` (R25, available)** in Production SQL. This is a read-only inventory value; the actual quoted total and fee at checkout must still be computed server-side and confirmed by the customer.

*These are necessary static conditions, not proof the shop is currently accepting an order or the owner can sign in.* A **second direct Production read-only query** against `public.shops_with_availability` showed `effective_is_active=false` for My-Kota at inspection time. The separate schedule function returned `within_shop_schedule=false`, with stored opening/closing hours `08:00–22:00` and no active override. Therefore the shop **cannot be assumed orderable at the instant of this audit**; the first real-system test must occur inside a verified open period with the owner's consent, or use a separately approved merchant availability change through the normal owner process. **Do not bypass or alter the availability constraint just to force a test.** FCM records do not establish device delivery, browser permission or valid tokens.

The other eight records are **not candidates for the immediate first controlled order** because at least one condition fails. Specific examples:
- **Food war** and **meat guy** are recorded as inactive, with **0 available menu items**, and their location is the ambiguous `ivory 2`, which does **not** satisfy the current Production SQL's exact Ivory Park/Tembisa location-pattern check.
- **take home** is active but has **0 menu items** and its recorded location is outside the current pilot.
- The Alexandra, Braamfontein, Maboneng, and Soweto sample shops are outside the original SQL region and have no recorded owner UID; do not recruit these as live pilot merchants.
- **LocalEats Production Test Shop** is inactive with no current location or menu.

**Bottom line:** My-Kota is the **first static-data candidate**, not proven open currently. Prepare the first acceptance with My-Kota **during verified shop opening hours** and **one owned consenting test customer**; don't promise 2–3 orderable shops today. To expand to other shops later, review and verify their real owner login, location, approval, opening state and priced menu; any geographic expansion needs a separately reviewed database change.

Production `pickup_create_order` SQL still enforces `OUTSIDE_PICKUP_PILOT` for locations not matching `tembisa|thembisa|ivory park`; API also enforces a 4 km launch-location distance. The first customer test must use a real, consented nearby device/location; never spoof geography or weaken the rule to force acceptance.

## 2. Existing Production order is business history, not a disposable test fixture

Read-only aggregate Production SQL shows **1 existing pickup-contract order**, status **`collected`**, payment status **`paid`**, and **5 associated pickup-order events**; push-outbox contains **0 rows** at the time checked. These facts demonstrate past persistence of a pickup lifecycle but do not prove the currently deployed public frontend/API/login/FCM journey end-to-end. Preserve all existing records without deletion, modification or replay.

## 3. Production identity and configuration boundary

- Production API Vercel public alias `localeats-api.vercel.app` is a READY deployment from `main` commit `a5168ccbbb37643a58ad4202c72b65dd43149c2e`. Connected read-only Vercel environment checks identified non-secret production `FIREBASE_PROJECT_ID=localeats-5e26e` and `SUPABASE_URL=https://phdjumtqkooyppxozqsi.supabase.co`. This is environment **project-ID alignment**, not proof the actual Admin credential works.
- `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` are stored as **sensitive** Vercel values and were not retrieved or printed. The Firebase Admin credential's genuine validity, live disabled/revoked-token enforcement, and the merchant owner's matching Firebase Auth UID are not verified against Production Firebase.
- **Source files are divergent, not evidence of publication:** read-only comparison of `mehey9184-maker/LocalEats-app@main:firestore.rules` (blob `d168836960afec5afa705f320b6347495cc0e4cc`) and `mehey9184-maker/LocalEats-Dashboard.2@main:firestore.rules` (blob `d6b15ab961f4260c9d02814ed48023cd916c4eb4`) found the Merchant source permits certain owner-authenticated **Firestore shop creation** and **Firestore order updates**, whereas the Customer source denies client shop creation and all order updates. These source rules are not necessarily the live published rules for the named Production database. **Do not publish either file, widen writes, or assume either is current** without comparing the exact published Production Rules version, legacy data paths, API-authoritative pickup invariant and rollback policy.
- **OWNER'S ACTUAL LATEST PRODUCTION FIRESTORE RULES SCREENSHOT RECEIVED (2026-11-21 review):** Firebase Console selector shows production **Localeats** project and the named database `ai-studio-localeatsvendord-a61b068b-3029-4d93-ba41-626b03a23bbe`, **Security** rules history with the **starred latest Nov 11 2026 version selected**. The full visible 234-line rules display closely aligns by collection names, comment headings and crucial permissions with `mehey9184-maker/LocalEats-app@main:firestore.rules` blob `d168836960afec5afa705f320b6347495cc0e4cc` (but a screenshot is **not** a machine-verifiable checksum, and no opaque Rules release ID was exported). Key verified visible policy: `/shops` permits public reads, denies browser create/delete, allows constrained owner updates; `/menu_items` permits public reads and owner-checked edits; `/orders` allows participant/owner reads but **client create, update and delete are all false**; `/users` restricts self-profile and protected roles/claims; `/payments` allows owner reads and **denies client writes**. The catch-all deny-by-default does **not** mean all reads/writes are denied—specific collection matches grant limited operations. The Merchant repo's main `firestore.rules` blob `d6b15ab961f4260c9d02814ed48023cd916c4eb4` is materially **more permissive** (client shop create/delete, order update, user profile write) and must **not** be deployed over the live named Production DB as a shortcut. **No Firebase rule change was made.**
- Current Production Customer, Merchant, API pickup flags `VITE_PICKUP_ORDERING_ENABLED=false`, `VITE_PICKUP_ORDERING_ENABLED=false`, `PICKUP_WRITES_ENABLED=false`. PR #211 hardens revoked-account verification but is draft/unmerged. PR #212 adds bounded 1–3 shop and 1–20 invited customer beta gating and independently pausable **new** admission, but is also draft/unmerged. The code and live environment are NOT yet capable of publicly accepting orders via that new policy.

## 3A. Actual public Merchant account session — owner screenshots + deployed source (2026-11-21)

The owner supplied two screenshots of the **public LocalEats Merchant Dashboard**, Home and Menu, while signed in. **Observed in screenshots:** a green `Linked: My-Kota (shop-my-kota-ivory-park)` indicator under **Sync & Verify Store Ownership**; Merchant Menu showing exactly **1 available item** `cheeze, palone and meat` priced at **R25.00**, matching the previously read-only Production SQL record; pay-at-shop described as **cash or card machine**; **0 orders today** and **0 ready for pickup**; **Install App** CTA visible; **STORE OFFLINE — NOT RECEIVING ORDERS**, `Shop unavailable`, and a **Go Online Now** CTA. Menu explicitly states **read-only, editing/import unavailable until authoritative menu editing is supported; no changes will be saved**. Add-item and scanner buttons are still drawn, so disabled/no-op menu actions must be checked for honest UX; screenshot does not establish functionality.
 
**Ownership meaning in actual deployed `main` source:** `src/App.tsx` `resolveMerchantShop(firebaseUid)` calls `MerchantApi.getMerchantShop()`; `MerchantApi.getMerchantShop()` requests `GET /api/v1/merchant/shop` with Firebase bearer, and accepts only a shop response whose `owner_id` matches the authenticated UID. `acceptAuthoritativeMerchantShop(firebaseUid,shop)` separately checks `shop.owner_id === firebaseUid`, then registers the ID in UID-scoped memory via `src/utils/shopOwnership.ts`. The deployed API `localeats-api/src/routes/merchant.ts` `GET /shop` reads `shops_with_availability` with `.eq("owner_id", req.authUser.uid)`, requiring exactly one mapped shop. **Thus the screen is meaningful owner-session-to-shop API evidence**, not merely an arbitrary cached shop label. It does not independently log the exact runtime API response, server credential validity, or a cross-account negative test; no UID/token is requested or logged.

**Availability is not yet a live toggle:** the connected Production API Vercel env confirms `MERCHANT_AVAILABILITY_WRITES_ENABLED=false` and `PICKUP_WRITES_ENABLED=false`. Deployed `PATCH /api/v1/merchant/shop/availability` returns `503 AVAILABILITY_WRITES_DISABLED` while that flag is OFF. The visible **Go Online Now** and **Set All Online** CTAs therefore should not be treated as operational launch controls. Do not click or change flags merely to make the shop appear open. Previous read-only Production `shops_with_availability` query showed `effective_is_active=false` for My-Kota because current schedule was outside stored **08:00–22:00** and there was no active override. Shop `shops.is_active=true` (base) is distinct from effective availability returned by the API.

**Home snapshot counts** represent the rendered current-session dashboard, not independently attested all-time Production orders. Production SQL already contains **one historical paid and collected order** with five events; "today's orders 0" does not contradict that.

**Current acceptance verdict:** **Merchant Firebase login → API-linked My-Kota shop → API menu retrieval appears to work** on the real public dashboard. Customer identity, active shop period, push delivery, and full authenticated order creation/accept/ready/pay-at-shop/collect remain to be proven. A visual "Install App" button alone does not prove browser PWA install behavior.

## 4. Local mounted API acceptance — synthetic only

The R branch adds `localeats-api/src/routes/pickupBetaRoute.test.ts`, running real Express route handlers on a local ephemeral HTTP server with **mock** Firebase Auth and mock Supabase `from/rpc`. No actual Firebase, Postgres, merchant device, web browser, server credentials or money involved. Checks:
1. Missing/invalid bearer tokens fail HTTP 401, and valid synthetic Firebase claims call the verifier with `checkRevoked=true`.
2. Local quote uses mock trusted catalog price, shows a permitted `can_submit`, rejects unknown invited UIDs.
3. Unauthorized creation is denied before any synthetic persistence RPC.
4. The authorized synthetic customer places one correctly consented order through `pickup_create_order`, without allowing the buyer to set an authoritative price.
5. The wrong shop owner is denied before a command RPC; the correct synthetic owner accepts it.
6. Pausing **new** beta admission makes quote `can_submit=false` and blocks further order creation, **but permits existing order ready → payment-confirmation → collected** under the same verified owner.
7. Validates receipt types/revisions and prevents treating a generic request body UID as the actual actor.
8. All provider access is explicitly mocked; any test result proves the tested source contract **only**. **It is NOT a real Production pickup test.**

**CI:** `.github/workflows/l3-n8u-r-first-pickup-acceptance.yml` runs this harness, the existing identity/beta guards, and TypeScript compilation with Production credentials prohibited. Record the actual Actions result and any failures before promotion. This draft branch must **not** be deployed to the public aliases.

## 5. First *actual* Production test — strict approval and recording gates

**Prerequisites to request approval, not actions authorized by this report:**

- **Rules and identity:** verify the current published Rules for `localeats-5e26e` **named database**, check that relevant merchant/customer legacy Firestore reads work with those rules, and validate Firebase Admin project/credential and revoked-account verification in a controlled read-only login. Owner and test customer give informed consent to test on live service. Verify My-Kota's Production `shops.owner_id` exactly matches the merchant's verified Firebase UID; do not share UIDs/tokens in chat.
- **Shop readiness:** owner confirms My-Kota can actually receive one test order; inspect current shop status, menu item and price in the public Customer App and the Merchant Dashboard, ensure location/device is within 4 km. Confirm staff availability and pickup payment method (customer pays in-person, no online charge).
- **Release controls:** review/merge only the selected exact API and frontend commits after test/CI and owner sign-off, restore-test Production backups, keep one-command pause/rollback and customer support contact. Set **only the reviewed pilot shop + consenting test customer's Firebase UID**, bounded time window and separate admission control. Never expose the real IDs as frontend env variables or source commits. The present public pickup flag is still OFF.
- **Order lifecycle:** place **one** agreed order; record a correct server quote and fingerprint, reject altered client R0.01, idempotent retry and wrong account; merchant sees it even without push, accepts → marks ready, customer gets correct notification if opted-in, merchant records pay-at-shop accurately, customer receives food, merchant records collected; validate same order and event revision in both apps and Supabase, no leaked cross-user information.
- **FCM/PWA:** verify the actual owner/customer device permission and installation flows separately. Two stored My-Kota push-subscription rows do **not** imply two working push devices; verify Firebase provider acceptance, browser receipt and OS display. When push is unavailable, API order inbox/status must still work. Do not send push to nonconsenting users.
- **Final reconciliation:** compare Production order/event/push counts before and after, preserve the pre-existing collected/paid order and five events, record any user complaint and rollback path. Never delete valid business history or treat a real order as merely disposable.

### Immediate next practical gate
1. Obtain the **published Production named Firestore database Rules view**, with project and DB identifier visible; do not click Publish.
2. Check My-Kota owner can sign in with the Firebase account in the actual public Merchant Dashboard; compare real owner UID to server shop owner using a safe, private admin diagnostic (never post tokens, UID lists, private keys or passwords).
3. Choose and document **one consenting, actual test customer's Firebase account** and a **single monitored test window**; request separate explicit approval before enabling any Production order-writing flag or sending real FCM messages.

## 6. Safe rollback and release verdict
The current two-draft PR chain is code-prepared only; do **not** equate a green unit suite, past completed order, READY Vercel deployment or a subscribed push token with a live end-to-end proof.

- To pause **new** beta creation after a reviewed release: `PICKUP_BETA_ADMISSION_ENABLED=false`. Existing accepted order fulfillment continues only if global pickup writes stay enabled.
- Emergency global switch `PICKUP_WRITES_ENABLED=false` also blocks merchant collection commands; coordinate manual completion and any customer reimbursement rather than orphaning records.
- Revert verified immutable API/frontend deployments and review stored receipts; don't rollback database or published Firebase rules blindly.

**Today's decision:** first selected shop known; Production Firebase published named-database rules, owner/customer identity pairing and hosted real order/FCM flow are pending; **public Production pickup remains OFF.**


## L3-N8U-R CI evidence — verified, 2026-11-21 (South Africa)

GitHub Actions `L3-N8U-R first pickup journey acceptance (synthetic only)` ran on immutable source commit `5d8b6332ea4156f272070f1a3eb38d82a51652ad`, [workflow run #44832407909](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/actions/runs/44832407909), and **PASSED**. Specifically:
- Node 22 and `npm ci --ignore-scripts`: passed; no Production Firebase, Supabase, Vercel or cohort credentials supplied.
- API TypeScript compilation: passed.
- Local mounted synthetic HTTP quote-to-order-to-collection scenario, including cross-owner denial, R0.01 price-consent tamper rejection, idempotent duplicate and continuing an order after a new-admission pause: **1/1 passed**.
- Existing revoked-token verification, controlled beta eligibility and pickup route regressions: **20/20 passed**.
- First test attempts failed because synthetic shop mock omitted `availability_revision` and fixture expiry included fractional seconds; both **test fixture** errors were corrected. Production API fail-closed availability/expiry validation was not weakened.

**Critical limitation:** The GitHub Actions test uses **mock Firebase authentication and mock Supabase RPC**, with a locally hosted Express app. It is **not** a real My-Kota customer purchase, hosted Firebase login, live notification, Production database write or merchant device acceptance. The separate dedicated Merchant staging Vercel check on draft Production branches is unrelated to these API tests and may show failure if it is configured to build branches lacking `build:merchant-staging`. Do not merge until all release checks and owner authorization are reviewed.
