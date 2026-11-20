# L3-N8P — Owner-approved staging pickup write rehearsal: exact executed evidence

**Date:** 20 November 2026. **Status:** staging rollback-only database check PASSED; authenticated Customer↔Merchant pickup acceptance BLOCKED by unverified deployed Firebase rules / staging account and Merchant/API pairing. Production remains OFF.

## Authorization and exact target
The owner said “i approve” in response to completing a separately approved **staging-only pickup-order lifecycle rehearsal and Firebase rules verification** after N8O. No Production changes, new real order, online money, public account, push to real users, merge or Firebase rules publication was authorized.

Only verified project `LocalEats-Profile-Staging`, ID `rgpbdajhlrwfmhopzgzk` was used for the SQL checks. Production Supabase ID `phdjumtqkooyppxozqsi` was never passed to any write tool in this task.

## Actual staging PostgreSQL acceptance (not mocked)

Source `tests/l3-n8p/STAGING_TRANSACTION_ROLLBACK_ONLY.sql` was saved in GitHub and executed once through Supabase's connected SQL action, in a single **BEGIN → DO → read-only summary SELECT → ROLLBACK** transaction. The SQL contains **no CREATE/ALTER/DROP/GRANT**, no trigger disable, no auth accounts, no RPC install and no notification sends.

Preflight asserts:
- `public.orders`, `public.pickup_order_events`, `public.pickup_push_outbox` exist and original `l3_n8o_orders_hard_off` trigger is enabled.
- No preexisting synthetic fixtures with the N8P IDs.
- `anon` lacks orders INSERT and `authenticated` lacks orders SELECT.

Inside the uncommitted transaction:
1. Inserted **two synthetic staging test shops**, with distinct synthetic owner UID strings, and **one synthetic menu item** priced R25.00. These UIDs were only database text, NOT created Firebase users.
2. Read the catalog's server-side R25 price; confirmed a fabricated R0.01 price does not match the stored menu item.
3. A merchant-scoped UPDATE using the **other owner** modified **0 rows**, while the correct owner's SQL predicate matched **1 row**. This checks a database ownership WHERE predicate, NOT a real Firebase token or server API authorization.
4. A realistic pickup order INSERT was caught and validated to fail specifically with `L3_N8O_STAGING_PICKUP_WRITES_DISABLED`. That is intentional: active staged order persistence and lifecycle RPCs are **not yet approved/installed**, and the database hard-off is retained.

The tool returned the expected transient counts: **2 shops, 1 item, 0 orders**. The transaction ended with **ROLLBACK**, not COMMIT. A separate subsequent *read-only* postflight query confirmed:
- **0 residual synthetic shops** and **0 synthetic menu items**.
- **0 orders, 0 order events, 0 push outbox jobs**.
- All **3 staging pickup hard-off triggers remain enabled**.

This is real database evidence of stage isolation and the write-deny gate. **It does NOT demonstrate a persisted order, an authenticated Customer→Merchant lifecycle, acceptance/ready/payment/collection, idempotent order replay or FCM receipt.** Prior source-level/synthetic tests do not fill those hosted gaps.

## Deployed Firebase rules: genuine blocker, not assumed safe

Source files `firestore.rules` exist in both GitHub repositories, but source is not the current **published staging ruleset**. The Customer's `firebase.json` points to a different named Firestore database (`ai-studio-localeatsvendord-a61b068b-3029-4d93-ba41-626b03a23bbe`) rather than the Vercel Preview's explicit `localeats-staging/(default)`. **Do not deploy that file to staging blindly.**

The available ChatGPT connector operations did not expose a Firebase rules-release read or actual staging Firebase Auth user/UID verification action. The dedicated stage API `FIREBASE_PROJECT_ID=localeats-staging`, but its Firebase Admin service account project credential could not be independently attested without accessing secrets, which were not retrieved. No rules were published or modified. No Firebase identities were created, disabled, revoked or used for real A/B.

## Additional hosted pair blocker: Merchant still points to the older API alias

The already READY reviewed Customer N8O Preview is configured for the new stage API. The separate Merchant staging project `localeats-merchant-staging-r52d` has `VITE_PICKUP_ORDERING_ENABLED=false`, and its Preview `VITE_LOCALEATS_API_URL` still points to the **older N8G Merchant API alias**, not the N8O API. Therefore this is NOT yet one tested Customer+Merchant+API stage order-flow pair. Do not repoint it automatically before staged credentials/rules/owner scope are verified and protected.

## Deployment and Production boundaries

N8O stage Customer: `https://localeats-customer-n8o-r52d-mehey9184-makers-projects.vercel.app` (reviewed draft #123 SHA `42a1d915...`).
N8O stage API: `https://localeats-api-n8o-r52d-mehey9184-makers-projects.vercel.app` (reviewed API draft #206 SHA `e3f18449...`).
N8P made **NO Vercel changes**, no new API feature/routes, no database schema migration, no cloud function, no rules changes, no hosted Orders, no FCM push.
Production pickup write flags and deployments remain on previously verified OFF/unchanged baseline; N8P performed no Production operations.

## The next minimum safe gate to run a genuine pickup order

1. Obtain read-only **currently published** Firestore Rules **release and source** for the exact `localeats-staging` Firebase project and `(default)` database, with a verified rollback ID. Compare it to needed shop/profile/registration operations; do not publish changes yet.
2. Independently attest the staging API Admin service-account project without revealing private keys; verify the stage Supabase URL and exact Customer+Merchant browser CORS allowlist.
3. With separately scoped **disposable staging-only Firebase A/B identities and synthetic approved shop owner mappings**, rehearse API authentication, wrong-owner denial and real read-only catalog/quote; no Production UIDs.
4. Review and install stage-only, secure **pickup_create_order/pickup_order_command** RPCs and transition guards compatible with the stage schema. Remove stage hard-off triggers only under another explicit scoped acceptance migration with narrow rollback and a protected test window. Never use a permissive browser-RLS policy, client-priced order, insecure Express fallback or Firebase callable legacy order.
5. Perform exactly one bounded real staging write journey with confirmation and cleanup, double-submit/idempotency, rejection, payment-at-shop handover, cross-owner denial, and push **only to owned disposable test devices**, with written results. Keep Production OFF until verified and separately approved go/no-go.

The user approved the staging rehearsal; this task executed all currently safe staging database checks. **Real signed-in owner/customer staging orders cannot responsibly proceed until Firebase's actual deployed rules and staging identities are verified.**
