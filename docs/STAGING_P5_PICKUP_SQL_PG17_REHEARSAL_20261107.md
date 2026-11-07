# LocalEats — isolated P5-profile-preserving pickup SQL integration rehearsal
Date: 2026-11-07 • **REVIEW ONLY; never run these synthetic fixtures in connected staging or Production**.

## Purpose and context

The owner authorized preparation of the existing **LocalEats-Profile-Staging** database for a complete three-app pickup acceptance environment, but only **after a verified restorable backup and independently reviewed SQL**. Staging Supabase project `rgpbdajhlrwfmhopzgzk` currently contains the P5 `profiles` table and one profile migration, with 0 profile/Auth/Storage records. The earlier 26-object readiness check found 23 required pickup/approval objects missing. This branch **does not install those objects in staging**.

The live staging profile structure was inspected by READ-ONLY PostgreSQL system-catalog queries. It has 14 columns, 13 constraints, RLS enabled AND forced, no browser `anon`/`authenticated` table grants, and a server-only `service_role` grant. It stores Firebase UIDs in `profiles.user_id` as text, not the legacy Production profile schema. No existing profile rows or private values were copied.

## What this new disposable test rehearses

`.github/workflows/staging-p5-pickup-schema-rehearsal.yml` starts a fresh, fixed-name `postgres:17-alpine` CI service on loopback only, with **no Supabase credentials**. It refuses all cloud URL environment variables and any pre-existing public table. It then:

1. Creates the existing historical *synthetic* pickup fixture from `localeats-api/tests/pickup/schema.sql` and a new P5-like **synthetic** table from `tests/staging/pickup_p5_preservation_fixture.sql`. An entirely fictional customer profile is inserted; a fingerprint of the 14-column profile schema, constraints, RLS and grants is captured.
2. Runs the existing reviewed pickup foundation, zero-fee pickup RPC, merchant availability, and archived Super Admin approval SQL in this disposable database. It applies the hash-pinned one-condition any-town SQL draft from prerequisite [#86](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/pull/86), also only in the disposable database.
3. Closes **deliberately permissive historical browser policy/GRANTs** belonging ONLY to the synthetic pickup fixture; these permissions must never be copied into a connected staging migration. Turns on RLS for the synthetic legacy shop/menu/rider tables. No rider functionality is activated.
4. Checks that P5 columns, defaults, constraints, RLS/force RLS, grants and the fictional record remain unchanged; no browser order or profile privileges appear.
5. Runs a simulated **Super Admin approved pending → approved but closed**, Merchant independently opens using `merchant_set_availability` with expected revision, and Customer creates a genuine **SQL** R25 pickup from a shop whose location text is **Pretoria** but whose GPS is inside 4 km. Replayed keys cannot create extra orders, cross-user replay is blocked, and closing the shop prevents new orders.
6. Checks that every new pickup row has zero delivery fee, no rider, unpaid on-site payment and matching immutable creation events and Super Admin audit record.

**Meaning of a CI PASS:** The specific reviewed SQL fragments can coexist in one **synthetic** PostgreSQL 17 database and leave a profile table shaped like the read-only inspected staging P5 contract untouched. This is more than isolated function tests, but remains **NOT** a complete staging restoration, hosted Firebase UID verification, PostgREST/RLS penetration test or real Customer/Merchant/Super Admin browser acceptance.

## Important safety limitation

The existing historical `localeats-api/tests/pickup/schema.sql` is explicitly **UNSAFE TO USE AS A STAGING MIGRATION** because it creates synthetic legacy rider rows/orders, grants broad authenticated access to `orders`, and includes a deliberately permissive RLS policy for negative regression testing. In this CI-only rehearsal, those unsafe fixture privileges are closed before acceptance assertions. For a connected staging migration, design the **new tables with restrictive RLS/grants from the first transaction**, rather than creating insecure tables and fixing them later.

The P5 table is manually reconstructed from read-only catalog metadata, not imported as a complete managed Supabase/Auth environment. No Supabase Auth users, Firebase profiles or FCM tokens are used.

## Remaining actual staging rollout gates

- Follow the owner-approved **backup-first runbook** in [#88](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/pull/88): privately export existing staging roles/schema/data/history, encrypt an offsite copy and **prove an isolated restorable backup**, not merely SHA-256 file checks. The current connector cannot export/verify one.
- Review an **actual stage-only, fail-closed additive DDL migration** against the current staging schema and preserve the current P5 `profiles` definition exactly. No direct browser Supabase writes; restrictive RLS and grants from the start. The historic synthetic pickup fixture in this test is **not that migration**.
- Independently verify staging Firebase Auth project `localeats-pickup-stage-261105` never targets Production Firebase `localeats-5e26e`, and Super Admin API identity verification has a separately staged, verified administrator entry.
- Verify the Customer/Profile, Merchant, Super Admin, Pickup API and Supabase RLS/permissions with two real **synthetic** staging Firebase identities, merchant and admin via hosted endpoints; confirm 4 km any-town/closed browse, pickup state transition, payment-at-shop only, duplicate prevention, notifications, account isolation, no sensitive log leaks.
- Production Firestore named-database rules and Production Supabase signup-role/Rider grants remain separate launch blockers. Keep all Production pickup writes, billing, delivery and riders disabled.

**No connected Supabase staging/Production schema or data changes, GitHub merges, Vercel deployments, real orders, external messages, paid hosting or payment activation in this branch.**
