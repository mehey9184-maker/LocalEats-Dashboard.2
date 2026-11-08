# LocalEats R5.2C — Real Firebase Staging and Synthetic Pickup Schema

8 November 2026. Owner-requested R5.2C. DRAFT ONLY. **Real hosted Firebase staging has NOT been provisioned or verified.** Firebase management actions are not exposed to this ChatGPT session, despite the installed plugin. No Production, live data, Firebase Auth user, Supabase hosted schema, Vercel configuration, billing, merge, or ordering change.

## Verified facts

The connected Supabase projects LocalEats and LocalEats-Profile-Staging are distinct and active. Profile-Staging currently has only public.profiles. A schema-only read of Production catalog metadata identifies shops, menu_items, orders, pickup_order_events and shops_with_availability as core pickup dependencies. Actual Production types: shop and menu IDs are text; order/event IDs are UUID; Firebase UID fields are text; items JSONB; revisions BIGINT; prices NUMERIC. RLS is enabled on the four tables. Production shops_with_availability calls shop_effective_open, which in turn uses shop_schedule_open; simply creating four bare tables is not enough.

Current Vercel Customer project-x7cvt and API localeats-api still have overlapping Preview/Production Firebase or Supabase configuration, and no exact current draft-branch deployment. An older profile-test branch has a demo-prefixed Firebase project ID, which is emulator-only and cannot be used as a real hosted Auth project.

## F1 — Owner-console Firebase setup, still pending

1. Open https://console.firebase.google.com/ and create an entirely separate project, e.g. display name LocalEats Staging. Select a unique **real** project ID distinct from Production, not a demo-prefixed emulator-only identifier. Firebase project IDs cannot be changed once the project has been provisioned.
2. Select Spark/no-cost if eligible and sufficient. Review quota/availability; do NOT add billing, upgrade to Blaze, enable paid services or authorize paid infrastructure without a separate owner decision. Google Analytics and AI assistance are optional.
3. Register a separate Web app in the staging project. In Authentication -> Sign-in method, enable Email/Password. Do not import real customers or copy any Production Auth accounts.
4. If Firestore is needed for Customer startup, initialize a separate staging database with DENY-ALL browser rules at first. Do not copy historic permissive prototype rules; no actual data is needed yet.
5. Retain six Firebase web configuration values and the explicit Firestore DB ID in the owner's secured staging configuration. The API Admin project and client project must match; a staging Admin private key must NEVER enter git, PR descriptions, chat, logs or any browser VITE_-prefixed variable. In hosted API, FIREBASE_AUTH_EMULATOR_HOST must be absent because it permits unsigned emulator tokens.
6. Do not create even synthetic Auth users or revoke any tokens until environment isolation and test scope receive a separate review.

Firebase references:
- https://firebase.google.com/docs/projects/learn-more
- https://firebase.google.com/docs/projects/billing/firebase-pricing-plans
- https://firebase.google.com/docs/auth/web/password-auth
- https://firebase.google.com/docs/emulator-suite/connect_auth

## S1 — Offline pickup schema rehearsal, implemented in draft

Files in API draft PR #124:
- localeats-api/tests/pickup/r52c/schema.SYNTHETIC_ONLY.sql
- localeats-api/tests/pickup/r52c/verify-disposable.sh
- .github/workflows/localpay-r52c-pickup-schema-disposable-pg17.yml

The SQL creates the four missing core tables and a FORCE-CLOSED structural availability view in a disposable PostgreSQL 17 database. It refuses to run unless the database is named r52c_synthetic_only AND the r52c.synthetic_only=yes connection setting is supplied. Browser fixture roles cannot SELECT, the API-read fixture role cannot INSERT, RLS and FORCE RLS are enabled, and neither order-creation/command functions nor payment/Rewards functions are created. Tests use only fabricated data and local PostgreSQL, never Supabase hosted or Firebase.

**NEVER APPLY THIS FILE TO PROFILE-STAGING OR PRODUCTION.** The structural availability view intentionally does NOT reproduce the live schedule/effective availability functions. This is a schema and access-denial laboratory, not a validated full-compatibility migration, and its host database guard is meant to reject any normal hosted Supabase database.

## S2 — Hosted staging schema is NOT yet prepared for application

A separate review must reconcile complete table types and constraints, pickup functions, event uniqueness, service-only privileges, true effective shop availability, the existing profiles table, potential pickup push subscriptions and API route dependencies. Stage schema-only changes only after approved backup and exact-project verification; never copy real customer/shop/order rows from Production. Prepare synthetic account/shop/menu/history fixtures separately, and do not insert them without a scoped staging-only data-write approval. Any staged pickup create, settlement, rider, reward or LocalPay operation remains disabled.

## E1 — Vercel environment separation is BLOCKED

Use dedicated staging-only Customer/API/Merchant projects if within plan limits, or verify every critical exact-branch Preview-only override. Shared Preview/Production Firebase Admin and Supabase keys are unsafe for this phase. Customer must opt into VITE_FIREBASE_CONFIG_SOURCE=environment with six consistent Firebase web values and the Firestore database ID. The API must connect to a separate Firebase Admin project and separate Profile-Staging Supabase credentials. All writes, merchant changes, payment, rider, Rewards and LocalPay flags remain OFF. Hosted testing must verify deployed branch and SHA and the exact staging HTTPS API origin; no live order or payment.

## Acceptance status

- F1: Real separate Firebase staging project — NOT VERIFIED/NOT CREATED in this session.
- S1: Disposable PostgreSQL 17 synthetic read-only schema — CREATED and CI passed.
- S2: Hosted Profile-Staging pickup migration — NOT APPLIED.
- E1: Separate Vercel environments and draft deployments — NOT VERIFIED.
- Browser sign-in/revoke/relogin and real hosted latency tests — NOT STARTED.

Customer PR #82, API PR #124, and Super Admin PR #4 remain DRAFT and UNMERGED. No Production, paid services, hosted database, live user or financial system altered.


## Subsequent owner-provided Firebase evidence — 8 November 2026

**The earlier F1 statement ("not created in this session") remains true for this agent's operations, but the OWNER has now created the separate Firebase staging project through the Firebase console.** Successive screenshots confirm: **LocalEats Staging**, Firebase project ID `localeats-staging`, Spark plan, registered `LocalEats Customer Staging` Web app, Email/Password authentication enabled, `(default)` Firestore database created, and Firestore browser rules with `allow read, write: if false;`. The SDK web configuration shown is consistent with `localeats-staging.firebaseapp.com` Auth domain and messaging sender ID `805045126244`.

This closes **owner-reported manual project creation and basic Web/Auth/Firestore setup** at screenshot-evidence level. It does NOT close API Admin service identity verification, Vercel Customer/API Preview credential separation, actual hosted database/schema integration, synthetic test-user approval or real hosted browser session recovery. The screenshots do not confirm Firestore region. No Firebase API key or Admin private key is stored in code or project documents.

Use the Customer draft mapping in `docs/LOCALEATS_R52C_FIREBASE_WEB_CONFIG_RECEIVED_20261108.md` (Customer PR #82). API staging must use `FIREBASE_PROJECT_ID=localeats-staging` ONLY in a separately isolated nonproduction server config, with staging-only Admin identity and no Firebase Auth Emulator override, matched to independently verified Profile-Staging Supabase credentials. DO NOT populate current shared Preview/Production credential entries, update Vercel, create service accounts, deploy or seed users solely based on screenshots.

**Updated gates:** F1 owner-created project = screenshot-confirmed; F1 backend linkage/independent project verification = OPEN; S1 disposable PG17 rehearsal = passed; S2 hosted pickup schema = not applied; E1 isolated Vercel = open; hosted auth/browser tests = blocked. All PRs draft and unmerged.
