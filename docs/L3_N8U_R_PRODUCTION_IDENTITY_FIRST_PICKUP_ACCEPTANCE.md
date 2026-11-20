# L3-N8U-R — Production identity and first pickup acceptance

**As of 20 November 2026.** **Release decision: HOLD public pickup ordering.**
**Mode:** production **read-only** preflight + credential-free **local synthetic** API acceptance. This document does not authorize live Production orders, merges, Firebase rules publication, push sends, PWA installation, Production environment edits, migrations, payments or customer invitations.

This work continues stacked draft [L3-N8U-P PR #211](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/pull/211) and [L3-N8U-Q PR #212](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/pull/212). It preserves the Production Firebase + Supabase boundaries and keeps approved UI intact.

## 1. Actual Production shop eligibility — read-only records

Production Supabase project **`phdjumtqkooyppxozqsi`** contains **9 shops and 7 menu items**. A live read-only SQL inventory cross-checked each shop's approval, active/archived status, stored geographic pilot text, valid coordinates, owner UID presence, available and positive-price menu items, and non-revoked recorded push subscriptions. **No owner UID, customer UID, password or FCM token was exported.**

**Exactly one shop passes all the static data prerequisites:**

| Shop | Production ID | Approval / active | Location | Priced available items | Non-revoked FCM records |
|---|---|---|---|---:|---:|
| My-Kota | `shop-my-kota-ivory-park` | approved / true | Katlego Street, Ivory Park | 1 | 2 |

*These are necessary conditions, not proof the shop is open at this instant or the owner can currently log in.* FCM records do not establish device delivery, browser permission or valid tokens.

The other eight records are **not candidates for the immediate first controlled order** because at least one condition fails. Specific examples:
- **Food war** and **meat guy** are recorded as inactive, with **0 available menu items**, and their location is the ambiguous `ivory 2`, which does **not** satisfy the current Production SQL's exact Ivory Park/Tembisa location-pattern check.
- **take home** is active but has **0 menu items** and its recorded location is outside the current pilot.
- The Alexandra, Braamfontein, Maboneng, and Soweto sample shops are outside the original SQL region and have no recorded owner UID; do not recruit these as live pilot merchants.
- **LocalEats Production Test Shop** is inactive with no current location or menu.

**Bottom line:** prepare the **first** acceptance with My-Kota and **one owned consenting test customer**; don't promise 2–3 eligible shops today. To expand to other shops later, review and verify their real owner login, location, approval, opening state and priced menu; any geographic expansion needs a separately reviewed database change.

Production `pickup_create_order` SQL still enforces `OUTSIDE_PICKUP_PILOT` for locations not matching `tembisa|thembisa|ivory park`; API also enforces a 4 km launch-location distance. The first customer test must use a real, consented nearby device/location; never spoof geography or weaken the rule to force acceptance.

## 2. Existing Production order is business history, not a disposable test fixture

Read-only aggregate Production SQL shows **1 existing pickup-contract order**, status **`collected`**, payment status **`paid`**, and **5 associated pickup-order events**; push-outbox contains **0 rows** at the time checked. These facts demonstrate past persistence of a pickup lifecycle but do not prove the currently deployed public frontend/API/login/FCM journey end-to-end. Preserve all existing records without deletion, modification or replay.

## 3. Production identity and configuration boundary

- Production API Vercel public alias `localeats-api.vercel.app` is a READY deployment from `main` commit `a5168ccbbb37643a58ad4202c72b65dd43149c2e`. Connected read-only Vercel environment checks identified non-secret production `FIREBASE_PROJECT_ID=localeats-5e26e` and `SUPABASE_URL=https://phdjumtqkooyppxozqsi.supabase.co`. This is environment **project-ID alignment**, not proof the actual Admin credential works.
- `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` are stored as **sensitive** Vercel values and were not retrieved or printed. The Firebase Admin credential's genuine validity, live disabled/revoked-token enforcement, and the merchant owner's matching Firebase Auth UID are not verified against Production Firebase.
- Owner screenshots previously identified the **named Production Cloud Firestore database** `ai-studio-localeatsvendord-a61b068b-3029-4d93-ba41-626b03a23bbe`. Its **currently published Rules source/version was not inspected**. The independently verified deny-all `localeats-staging/(default)` Rules **do not establish Production named-DB permissions**.
- Current Production Customer, Merchant, API pickup flags `VITE_PICKUP_ORDERING_ENABLED=false`, `VITE_PICKUP_ORDERING_ENABLED=false`, `PICKUP_WRITES_ENABLED=false`. PR #211 hardens revoked-account verification but is draft/unmerged. PR #212 adds bounded 1–3 shop and 1–20 invited customer beta gating and independently pausable **new** admission, but is also draft/unmerged. The code and live environment are NOT yet capable of publicly accepting orders via that new policy.

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
