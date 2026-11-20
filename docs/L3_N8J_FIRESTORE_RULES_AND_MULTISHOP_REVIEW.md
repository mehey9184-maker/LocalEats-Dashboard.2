# L3-N8J — Isolated Firestore Rules emulator and multi-shop Merchant owner contract

**20 November 2026.** This is a stacked, **draft-only** security-review change. Its Firestore rules are **not** the active repository `firestore.rules` file and are **not published** to any hosted Firebase project. No hosted Firebase identity, Auth user, Firestore document, Supabase row, Vercel environment, Production deployment or project security rule was changed.

## 1. Staging-only Firestore rules proposal

`tests/l3-n8j/firestore.staging.rules` is a **separate candidate** for `localeats-staging` Firestore `(default)`, run only by the local Firebase Emulator Suite under a **`demo-` project ID**. The file is **not** referenced by Production builds, `firebase deploy`, `src/lib/firebase.ts`, or the existing root `firestore.rules`. Default-deny is preserved.

- **ALL Firestore browser creates, updates, and deletes are denied**, including a user's own profile, shops, menus, pickup orders, approvals, Rider state, telemetry, followers, or payment metadata.
- `users/{uid}` allows only **get own UID**; list all users and foreign profiles denied.
- `shops/{shopId}` allows only **owner-scoped** get/list (requires a matching Firebase UID in the existing shop document; listing requires an owner-constrained query); unauthenticated/public shop discovery is denied by this candidate.
- `menu_items/{itemId}` allows read only where the referenced Firestore shop is owned by the authenticated Firebase UID. The shop owner is checked using the current Firestore shop document.
- `orders/{orderId}` allows a read only for the recorded customer or verified shop owner, never because a record is marked `finding_rider`. Client order mutations are always denied.
- `rider_profiles`, `rider_connections`, `chat_messages`, `shop_followers`, `payments`, and unknown collections have no browser read/write access.

**Compatibility warning:** The existing **Customer** staging app currently uses the same `localeats-staging` Firebase project. This restrictive Merchant-focused candidate could prevent Customer staging discovery, chats and other existing legitimate reads if published as-is. **It must not be deployed until a separate Customer/merchant access compatibility review**, plus verification of the actual currently deployed staging Firestore Security Rules. Changes to **root** `firestore.rules` or Production Firebase rules are outside this draft.

Browser client protection in N8I remains defense in depth, not a server-side rules guarantee. Firebase Admin operations are privileged and can bypass Firestore Security Rules; they require separate server-authoritative Firebase UID/project/database checks.

## 2. Emulator-only verification

`tests/l3-n8j/firebase.json` selects only the local Firestore emulator on `127.0.0.1:8181`, a separate candidate rules file and UI disabled. `tests/l3-n8j/package.json` pins direct testing dependencies `firebase-tools@15.37.0`, `@firebase/rules-unit-testing@6.0.0`, `firebase@13.4.0`. No root application dependency or lockfile changes. A CI-only ephemeral install is isolated under the test folder, without package-lock changes; no hosted Firebase credentials are supplied. The test runner supplies fake `owner-A`, `owner-B`, and `customer-A` contexts via the official `rules-unit-testing` library.

The emulator test seeds disposable synthetic documents using `withSecurityRulesDisabled` *within the emulator only*, then tests genuine Firestore Rules permission decisions: own versus foreign profile, owner-scoped shop queries, multi-shop owner reads, forged shop approval/owner edits, menu cross-shop access, customer/shop-owner order reads, blocked `finding_rider` exposure, all browser writes denied, Rider GPS/payment denial and unknown paths denied. These are not real Firebase Auth identities or hosted documents.

**Actual emulator result:** GitHub Actions run [#44701726304](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/actions/runs/44701726304) completed with **3/3 jobs PASS**. The genuine local Firestore emulator executed **10/10 permission tests PASS, 0 failed** using Java 21 and a `demo-` project ID. The synthetic dormant multi-shop owner test runs passed **11/11 (N8C)**, **6/6 (N8D)** and **11/11 (N8B)**, plus the **247/247 existing API** regressions, **16/16 Merchant pickup** tests, Merchant TypeScript 0 errors, root ESLint 0 errors (35 existing warnings). The tests never read/published real Firebase rules or connected to any hosted Auth project.

## 3. Safe multi-shop owner/profile admission correction (unmounted)

`localeats-api/src/accounts/merchantApprovedOwner.ts` currently only contributes to the **dormant** Merchant profile API from previous drafts. It incorrectly required exactly one approved shop record. A read-only aggregate on separate `LocalEats-Profile-Staging` last observed **5 shop records: 3 approved/nonarchived, 1 unapproved, 1 archived, 1 distinct owner**. Their provenance is unknown, and none were modified.

The N8J proposal differentiates owner-level **profile eligibility** from authorization of a **particular shop**:
- To read an existing Merchant profile, a verified Firebase UID is eligible if the server finds **at least one approved, nonarchived shop belonging to that UID**, even when the UID owns multiple shops.
- The service-role Supabase query filters by `owner_id=verifiedUid`, `approval_status=approved`, and `archived_at IS NULL` and returns a **maximum of one** qualifying row. It checks the returned owner ID, shop ID, approved status and archive marker even after the DB filter. Database unavailable/malformed result fails closed.
- **This bool is NEVER an approval to read/modify a specific shop.** Every shop-scoped order/menu/availability operation must independently authorize `requestedShopId` using server ownership+approval. No browser-supplied owner, cached role or Firestore profile claims may establish shop ownership.
- The active API `server.ts` remains unchanged: no Merchant profile router mount, no write gate activated, no change to Production or existing pickup endpoint ownership logic.

API synthetic tests include multiple approved shops, mixed/untrusted ownership, pending/archived shops, missing IDs, bad Firebase UIDs, DB failures and exact query filter order. They use no real credentials or hosted owner information.

## 4. Remaining release blockers

1. **Actual deployed staging Firebase Firestore rules unverified.** No Firebase management connector/API in this work is authorized to read/publish `localeats-staging` rules. A GitHub repo file is not evidence of rules deployed to Firebase.
2. **Emulator candidate is intentionally conservative and may break Customer staging reads.** Review actual Customer staging usage before a staged rules publication. Do not publish it to Production, and do not publish to staging without separate owner approval and rollback plan.
3. **Two distinct Merchant staging owners are not established.** The last aggregate count found only one distinct owner for the staging shops. Do not create, reassign, delete or copy records until their provenance is independently reconciled and staging-only fixture creation is separately authorized.
4. **Actual Firebase Auth Admin scope and real revoked/disabled-session A/B tests remain unverified.** The N8D draft's synthetic revoked-token tests are not proof of real tokens.
5. **Profile writes remain disabled** and the dormant router remains unmounted. Browser/client no-write guards stay active on the reviewed N8I branch and no real orders/payments/FCM/Rider changes occurred.

**Next proposed L3-N8K:** verify the deployed **staging** ruleset read-only through an authorized Firebase/Google Cloud source; compare candidate impact on Customer and Merchant reads, revise and re-run emulator tests; then separately approve a reversible **staging-only** security rules rollout and two distinct A/B Merchant owner fixtures. Profile saving remains a later explicit gate.
