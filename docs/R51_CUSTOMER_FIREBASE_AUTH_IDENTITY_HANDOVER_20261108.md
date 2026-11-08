# LocalEats R5.1 — Customer Firebase auth consistency (API handover)

8 November 2026. Owner approved R5.1 as **draft-only**. This file updates the architecture interpretation; it does not change API runtime, staging settings, database, live orders, LocalPay, payments, Firebase rules, or Production.

## Verified source finding

- The CURRENT Customer App's src/lib/supabase.ts is a legacy Supabase-named compatibility adapter around Firebase Auth: password/Google sign-in, getSession and signOut use Firebase SDK; user.id is Firebase user.uid, access_token is Firebase user.getIdToken().
- Customer pickup service uses the same Firebase Auth currentUser ID token. The API route middleware in localeats-api/src/middleware/authenticateFirebase.ts expects Bearer fb-... and verifies with Firebase Admin verifyIdToken(token, true), rejecting expired, revoked and disabled accounts on its R4.8 draft.
- Supabase is used by the central API as a relational data service; it does NOT, by itself, mean Customer Login uses independent Supabase Auth. No cross-provider UID/email bridge is justified by the inspected Customer code.
- Merchant Dashboard has its own authentication implementation and ownership gates; DO NOT infer the same client adapter semantics for merchants without inspecting their source.

## Draft Customer R5.1 implementation and evidence

Customer PR #82 changes only pickup-history listening from Firebase onAuthStateChanged to onIdTokenChanged, enabling a fresh token for the same Firebase UID to trigger an API-verified history retry after a previous 401. Existing fail-closed history cleanup, identity check, old-request cancellation and original UI remain.

New Customer PR CI uses source-contract checks and a disposable local Firebase Auth Emulator with real Firebase client/Admin SDKs. Actual completion must be checked against the final Customer PR commit; passing emulator tests does NOT establish browser recovery, live API sign-in, Production acceptance, or hosted staging.

## Staging/release blockers

Confirm actual hosted Customer Firebase project ID, API Firebase Admin project ID, issuer and audience, service credentials, DB project and Vercel Preview environment are all intentionally isolated from Production. Customer Firebase has bundled configuration fallback values; a Preview URL alone does not establish backend isolation.

Before any merge: test revoked and disabled users, same-UID reauthentication, two-user account switch, anonymous users, 401 response classification, stale private history clearance and merchant ownership transfer against separate nonproduction services. Measure mobile-network latency and retain all owner approvals. R4.8 authenticateFirebase revocation checks are still in an UNMERGED draft. Pickup write gates stay OFF. No Rewards, LocalPay, merchant payouts or Production deployment approved.

Source: Customer draft https://github.com/mehey9184-maker/LocalEats-app/pull/82
API draft https://github.com/mehey9184-maker/LocalEats-Dashboard.2/pull/124
