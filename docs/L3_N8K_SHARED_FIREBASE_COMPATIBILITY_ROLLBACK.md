# L3-N8K — Shared Customer/Merchant staging Firebase Rules compatibility and rollback gate

**Review date: 20 November 2026.** This is a **read-only / local-emulator audit**. There is NO Firebase Security Rules publication, project setting change, Firebase account creation, Supabase row write, real order or deployment to Production.

## Verified target and evidence provenance

- Read-only Vercel inspection confirmed **Customer staging** project `localeats-customer-staging-r52d` is READY on GitHub commit `c77736e7b4878965baa31ec2ada8138f554d6a7f` (`mehey9184-maker/LocalEats-app`, branch `review/l3-my-kota-private-test-customer`). Its **Preview-only** environment explicitly specifies `VITE_FIREBASE_CONFIG_SOURCE=environment`, `VITE_FIREBASE_PROJECT_ID=localeats-staging`, `VITE_FIREBASE_FIRESTORE_DATABASE_ID=(default)`, `LOCALEATS_STAGING_ONLY=true` and pickup ordering OFF. Values were checked with the connected Vercel tool; secrets were not copied.
- The separately verified N8H Merchant staging Vercel target uses **the same Firebase project** `localeats-staging` and Firestore **`(default)`**. A shared Firestore rules publication would affect BOTH apps. Do not assume Vercel project separation creates separate Firestore databases.
- In the **exact deployed Customer Git SHA** above, `src/lib/firebase.ts` contains the real direct Firestore call paths listed below. This is evidence of build source, **not an assertion that each method is invoked at runtime**.
- The Customer repository's **`firebase.json` specifies a *different named Firestore database* `ai-studio-localeatsvendord-a61b068b-3029-4d93-ba41-626b03a23bbe`**. This is **not** the Customer staging Preview's configured `(default)` DB. A naive Firebase CLI deploy from that repo could target the wrong database. Do not execute a deploy from either repo.
- Both Merchant `firestore.rules` and Customer `firestore.rules` are checked-in source variants and **do not prove what Firebase currently enforces**. Customer's checked-in rules are different from Merchant's, notably in users/shops/orders protections.
- Official Firebase docs: Security Rules are enforced per database and client queries are checked against possible results, **not filtered**. Admin/server SDK bypasses Firestore Rules. See https://firebase.google.com/docs/firestore/security/rules-structure and https://firebase.google.com/docs/firestore/security/rules-query

## Customer ↔ Merchant compatibility matrix (actual Customer staging source)

| Customer source path / operation | N8J candidate | N8K candidate | Classification / blocker |
| --- | --- | --- | --- |
| `users/{uid}`: get own Firebase profile | ALLOW | ALLOW | Self-only, cross-user denied |
| `profiles/{uid}`: `FirestoreService.getProfile/listenToProfile` | DENY | **ALLOW own get** | N8K compatibility improvement; cross-user read/list and all writes denied |
| `profiles/{uid}`: `saveProfile` via `setDoc` | DENY | DENY | Mirror write remains blocked; API may be authoritative, must verify UX does not claim save |
| `shops`: `healthCheck` with unfiltered `limit(1)` | DENY | DENY | **Blocker**: stage Firestore health check can fail |
| `shops`: `getShops/listenToShops` full collection | DENY to customers | DENY to customers | **Blocker**: legacy discovery cannot see shops. If newer API discovery is authoritative, prove the fallback safe and remove misleading health output |
| `menu_items`: `getShops` full collection fallback | DENY to customers | DENY to customers | **Blocker**: menu discovery fallback; owner-specific doc get still allowed |
| `orders`: `getOrder/getOrdersByUser/listenToUserOrders` | Own/customer + shop owner | Same | **Compatible in emulator** for UID-filtered query and own order; broad list and `finding_rider` public pool denied |
| `reviews`: `getReviewsForShop` filtered query | DENY | DENY | **Blocker**: previously submitted reviews cannot load through direct Firestore |
| `reviews`: `addReview` | DENY | DENY | **Blocker**: direct post-purchase review submission denied; must use authorized server route |
| `follows`: `followShop/unfollowShop/getFollowedShops` | DENY | DENY | **Blocker**: follow state cannot be written/read via direct Firestore |
| `messages`: `sendMessage/listenToOrderMessages` | DENY | DENY | **Blocker**: legacy Customer chat direct Firestore disabled; note this uses `messages` collection, NOT Merchant rule's `chat_messages` |
| `contact_messages`: `submitContactMessage` | DENY | DENY | **Blocker**: direct support-contact write denied |
| `user_push_tokens`: `savePushToken` | DENY | DENY | **Blocker** if active; push device registration must have a separately verified API path |
| `shops/menu_items/orders` customer/merchant browser writes | DENY | DENY | **Required security invariant**. Pickup order creation and prices stay server-authoritative |
| `rider_profiles/payments/unknown` | DENY | DENY | **Required privacy/scope invariant** for pickup launch |

**Do not resolve the discovery blocker by making entire `shops` or `menu_items` documents publicly readable.** The examined Customer read code accesses shop `owner_id`, `phone`, availability and other metadata, and full-document Firestore rules cannot redact private fields. Only a separately reviewed **sanitized public catalog** or existing server-authoritative API (with verified CORS/auth, location/radius, approvals, menu prices) can safely replace public collection reads. This is a design gate, not a source change in N8K.

## Candidate and test evidence

- `tests/l3-n8j/firestore.staging.rules`: previous N8J strict Merchant candidate, preserved unchanged.
- `tests/l3-n8k/firestore.shared-staging-review.rules`: **separate NOT-DEPLOYABLE candidate**, adds only authenticated own `profiles/{uid}` get; all other former default-deny and write-off restrictions preserved. It deliberately keeps Customer unsafe/direct flows denied, so **passing emulator tests is evidence of the problem, not approval to roll out**.
- `tests/l3-n8j/customer-shared-compatibility.test.mjs`: evaluates actual local Firestore permission decisions for a Customer UID, a second UID, a Merchant owner and an anonymous visitor on the new candidate. Tests both **allowed** own-profile/order reads and intentionally **denied** discovery, public menus, reviews, follows, chat, contact, push and all browser writes.
- `tests/l3-n8k/shared-rules-release-gate.mjs` and tests: a separate safe release is blocked unless *actual deployed ruleset* snapshot/fingerprint, Customer functional compatibility, Merchant no-write isolation, review of public-doc privacy, emulator checks, exact rollback, and explicit owner release approval are present. The result can **never** authorize Production or account writes.
- GitHub CI uses a localhost-only `demo-` project and synthetic data. No real Firebase Auth, production/staging IDs, service-role credentials or deployed rules are loaded.

## Deployed Firebase staging rules retrieval — BLOCKED / not represented as complete

There is **no callable Firebase Rules read-management operation exposed** in this ChatGPT session, even though Firebase appears installed in the plugin directory. Connected GitHub and Vercel expose source and deployment configuration, **not** the published Firestore rules release.

For a future separately authorized read-only step, `localeats-api/scripts/l3-n8k-read-staging-rules.mjs` is a **guarded, NOT EXECUTED** helper using the official Firebase Admin SDK **`getSecurityRules(app).getFirestoreRuleset()`** for the **`(default)`** database. It refuses any mode except explicitly approved `localeats-staging`, `(default)`, non-Production, non-CI runtime with an authorized read-only Google identity. It prints only the ruleset name and **SHA-256 of source files**, never credentials or source, and has **no create/release/delete calls**. The owner must ensure IAM grants are read-only and the audit is performed in a private verified staging environment. Its existence **does not** mean the rules were retrieved.

Before any possible rule change, obtain and privately save the **exact deployed rules source**, release/ruleset ID, source hash and timestamp for `projects/localeats-staging/releases/cloud.firestore/(default)` (or equivalent default release). Check that the retrieved project is **not** the Production Firebase project or named database. A repo rules file or fingerprint *alone* is **not** a rollback backup. Never paste service-account private keys or ID tokens into PRs, chat, CI or browser logs.

## Proposed shared-stage rollout + rollback (PLAN ONLY, not approved to execute)

1. **Preflight and inventory:** Independently read `localeats-staging` default Firestore's current release and source; preserve privately the old immutable ruleset ID, exact source, SHA, release time and the stage Customer/Merchant deploy SHAs. No deployment while absent.
2. **Compatibility:** Replace unsupported Customer direct Firestore uses with independently tested, scoped API operations where needed; audit public catalog doc fields; preserve Customer ShopCard/menu/cart and pickup-disabled UX. Run both apps' read-only smoke tests and the two emulator suites. Document the legacy paths intentionally disabled or migrated. Ensure backend reads verify Firebase UID and owner/shop identity.
3. **Review and approval:** Explicit separate owner sign-off on *the exact candidate rules file hash*, target `localeats-staging`/`(default)`, expected read/writes, time window and rollback. Never use the Customer repository's named-database `firebase.json` as the staging publish configuration.
4. **Controlled staging-only publish (later):** Only an authorized release mechanism bound to the verified project/database may publish. Confirm the release ID/source after publication, allow propagation, then run authorized read-only Customer and Merchant smoke checks; recheck anonymous/cross-owner denial. No Production rollout or user fixture creation in this step.
5. **Rollback criteria:** Immediately stop and restore the **previous exact staging-only ruleset release** if Customer discovery, shop/menu access, profile, message/review flows regress or previously forbidden access becomes permitted. Validate the restored release/source hash and verify both apps again. Do not attempt rollback using only a SHA or a filename.
6. **Postgate:** Only when rollback and both apps are verified, separately authorize two truly independent Merchant staging owner mappings and real A/B revoked-token checks; profile write activation remains a further independent release.

**Current release decision: BLOCKED.** Multiple Customer flows deliberately fail this candidate; the deployed staging rules release and rollback snapshot are missing. Do **not** publish N8J or N8K candidates to the shared staging project, and do not alter Production.
