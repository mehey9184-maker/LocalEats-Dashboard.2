# L3-N8I — Merchant staging browser-write and Firestore Rules audit

**20 November 2026 · Draft-only, no hosted rule change or account creation.**

## Scope and verified sources

Reviewed the N8H/N8G isolated Merchant Preview source in draft PR #199, including `src/lib/firebase.ts`, `src/lib/supabase.ts`, `src/App.tsx`, `src/components/EditProfile.tsx`, `firestore.rules`, `localeats-api/src/server.ts`, `src/services/MerchantApi.ts`, and the existing staging build/CI guards. Reviewed the search results for direct Firebase Auth/Firestore/Storage mutation calls in the repository. **Source rules are not proof of currently deployed Firebase rules.** No authenticated Firebase rules-query connection was available and none was attempted.

Existing protected staging resources:
- Dedicated, Vercel-authenticated Merchant Preview `localeats-merchant-staging-r52d`; Firebase `localeats-staging`, explicit Firestore `(default)`.
- Merchant-only API branch Preview `localeats-merchant-api-stage-r52d-mehey9184-makers-projects.vercel.app`, on `localeats-api-staging-r52d`. Its N8D shared Firebase verifier uses `verifyIdToken(token,true)` at source; live revoked-user acceptance still untested.
- Independent `LocalEats-Profile-Staging` Supabase project. Its `shops` table was **empty** in the previous read-only audit. Do **not** write fixtures or create Auth accounts without a separate, specific approval.

## 1 — Client-side write-path findings

| Source | Actions that can mutate hosted state | N8I defensive action |
| --- | --- | --- |
| `src/lib/firebase.ts` Auth | `firebaseSignUp` creates a Firebase Auth account and a Firestore `users/{uid}` record; Google popup can provision a first-time account; reset password sends email; `updateFirebaseUserProfile` updates Auth/Firestore | Stage-only early rejection before mutation/network calls; **password sign-in for existing accounts remains allowed**, as does sign-out |
| `src/lib/firebase.ts` Firestore | `migrateDataToFirestore` batch-writes shops/menu/orders; `updateFirestoreShop`, `updateFirestoreMenuItem`, `createFirestoreMenuItem`, `deleteFirestoreMenuItem` write directly | Stage-only early fail-closed, preserving previous method return types; no false success |
| `src/lib/firebase.ts` Storage | `uploadImageToFirebaseStorage` uploads avatar/shop/menu files | Stage-only reject before `uploadBytes` |
| `src/lib/supabase.ts` browser compatibility adapter | `.from(...).insert`, `.upsert`, `.update`, `.delete` send Firebase Firestore `setDoc`, `updateDoc`, `runTransaction` and `deleteDoc`; despite its name it is **not** a server-side Supabase write | Stage-only central mutation rejection at top of `FirestoreQueryBuilder.execute`, **before a Firestore collection reference or transaction**; readable queries stay unchanged |
| `src/App.tsx` | Merchant heartbeat can update `shops`; Settings delivery preferences call direct shop update; profile/holiday/hours use `supabase.auth.updateUser` | Heartbeat already suppressed by `VITE_MERCHANT_PREVIEW_READ_ONLY=true`; all Firestore paths below are blocked; compatibility profile update already deliberately rejects without claiming success |
| `src/services/MerchantApi.ts` | Authenticated Merchant API POST/PATCH operations | Dedicated API stage `previewReadOnlyGate` and disabled flags remain authoritative. **Client guard does not replace API security.** |

No direct `setDoc`/`deleteDoc`/`writeBatch` application calls were located outside the two targeted Firebase bridge modules in the inspected repository search. This is a **code search result**, not an assertion about uninspected dependencies, downloaded bundles, service workers or external scripts.

**Guard implementation:** `src/lib/merchantStagingNoWrite.ts` treats either `VITE_MERCHANT_STAGING_ONLY=true` **or** `VITE_MERCHANT_PREVIEW_READ_ONLY=true` as an active no-write marker; returning an error or throwing **before** Firebase SDK mutation calls. It is additive to the N8G build-time exact project/database/API check and is inactive in existing Production builds without staging markers. No visual UI redesign.

**Important limitation:** JavaScript client checks can be bypassed by altered clients or direct Firebase SDK requests. They are not a security boundary against malicious users. The **actual deployed Firestore Security Rules**, Firebase Auth policies and API ownership validation must independently deny unauthorized requests.

## 2 — Security-rule findings from repository source (NOT confirmed deployed)

The checked-in `firestore.rules` was inspected, but **no Firestore Rules were uploaded/modified** in N8I.

| Severity | Rule | Why it needs tightening before write acceptance |
| --- | --- | --- |
| **Critical** | `/users/{uid}` allows the matching signed-in UID to **read/write any field** | A browser can change its own `role`, `owner_id`, `approved` and other claims if a backend ever relies on those fields. Future rules must allowlist editable profile fields and require protected authority fields unchanged. |
| **High** | `/shops/{shopId}` allows any authenticated user to **create** a shop claiming their own UID and allows the owner to update/delete **all fields** | Client can change status, approval flags, shop ownership, pricing/visibility or metadata outside the API. Merchant approval/ownership must be server-authoritative. |
| **High** | `/orders/{orderId}` allows customer/merchant updates to most fields other than a limited protected list; reads permit any signed-in account to access `delivery_status="finding_rider"` orders | Status/operations may be forged, and private order details may leak in the finding-rider pool. Pickup orders must remain server-authoritative. |
| **High** | `/rider_profiles/{riderId}` allows **any authenticated user** to read GPS and phone information | Tracking information should be limited to verified, active order participants. |
| **Medium** | `/rider_profiles/{riderId}` create/update accepts an ID match in document data as alternative to path ID | Could permit writes to documents under unexpected keys; bind identity to the document path. |
| **Medium** | Firestore menu/shop-owner checks reference Firestore `shops`, whereas the current Merchant API owner lookup uses Supabase `shops_with_availability` | Ownership/approval can diverge. Do not allow independent browser writes to override the authoritative API shop state. |

No production or staging ruleset was changed. Existing legitimate client functionality may depend on these rules; a separate **Firebase Emulator test suite, staging-only rules rollout and real-denial verification** are mandatory before attempting a hosted rules change. Never use a broad deny-all production rules replacement as an unreviewed shortcut.

No `firebase.json`, `.firebaserc`, or `storage.rules` deployment source was found at repository root. That is **not** proof no hosted Firebase/Storage rules exist.

## 3 — Two-account acceptance protocol (UNEXECUTED)

1. **Rules and client isolation gate:** Confirm actual deployed staging Firestore/Storage rules, Firebase Auth project and server Admin service account belong exclusively to `localeats-staging`. Prove staging browser mutations are rejected by client **and** staging Firebase rules. Restrict stage rules with emulator tests first; do not modify Production.
2. **Explicit test identities approval:** Create or verify **two distinct, disposable** Firebase Auth test identities in `localeats-staging` only, with owner-approved credentials managed privately outside chat and GitHub logs. There are no approved new identities created by this phase. The stage Merchant browser's Sign Up/Google-first-time creation is deliberately blocked; provision identities through a separately approved, staging-only Admin workflow.
3. **Approved shop fixtures:** The separate staging Supabase `shops` table previously had no rows. Obtain a *separate* approval to create two minimal, reversible staging-only shop records, each approved, nonarchived and bound to precisely one of the two Firebase UIDs. Never copy Production users or shop records. Verify fixture IDs in a private cleanup plan.
4. **Read-only A/B checks:** With identity A, GET the stage Merchant API owner profile/shop and assert only A's shop is visible; sign out; sign in as B, verify B sees only B. In separate browser sessions verify no cached A data flashes. GET/401 for missing/revoked/disabled token and 403 for unapproved owner. Keep all profile/order/availability writes off.
5. **Exit criteria:** Two account isolation acceptance screenshots/logs with **no user identifiers or secrets**, failed cross-owner reads and failed client-side mutation attempts confirmed by Firebase rules, a verified staging Admin project+database, zero unauthorized writes. Review cleanup and account revocation before deleting synthetic records.
6. **Profile saving** remains a separate, future stage requiring owner approval of scoped server writes, a full read-back and signed-in A/B persistence verification. It is **not** part of N8I.

**Release boundary and automatic Preview:** This PR contains Merchant client write containment, synthetic tests, isolated CI and documentation. Git integration automatically created a **distinct READY Vercel Preview deployment from the N8I draft branch** (for example `dpl_3G6wV7opJ1b62j4HvLTYEVYT22Ae`, SHA `130e5a1269ef85a62409feda87c82e1a2468c18c`, target Preview). It is **not** a merge, Production deployment, alias promotion, a Firebase Security Rules publication, or real account acceptance. The stable Merchant N8H staging domain is still pinned to its N8G review branch; no assignment of that alias was requested. The new N8I Preview browser guard is defense in depth only. No Production deploy, no Firestore rules changes, no migration, no Firebase account or Supabase shop fixture creation, no staged live sign-in/revocation, no FCM, no orders/payments, and no PR merge.
