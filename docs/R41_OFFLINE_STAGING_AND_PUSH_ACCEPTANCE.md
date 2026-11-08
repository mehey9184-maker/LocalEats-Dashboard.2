# LocalEats R4.1 — Offline staging boundary and notification reliability review

**Status: DRAFT, review only. 8 November 2026. NO Production database migration, no hosted SQL mutation, and no live orders or Firebase notification delivery.**

## What the merchant accepted
The owner confirmed that all five **Merchant Settings P1** checks worked in the exact review Preview: original shop opens in Storefront; Billing and Delivery are labelled Coming soon and are inert; Account no longer invents verified banking; original navigation/design retained. This is **Settings UI acceptance only**, not full order lifecycle, write permissions, customer UX or notification acceptance. Merchant Settings PR #119 remains a draft unless separately approved for merge.

## Why R4.1 is not a Production migration
The primary LocalEats Supabase database still had an unrestricted `Payments access` policy (`ALL TO authenticated USING(true) WITH CHECK(true)`) and public `Rider notifications access` policy at the last read-only inspection. Anon/authenticated execute permissions on privileged rider-nudge RPCs were also observed. These remain launch blockers and must not be casually restored after hardening.

The existing **LocalEats-Profile-Staging** project is **NOT a pickup-schema staging clone**: it has a profile table but not the complete `orders`, `payments`, `pickup_push_outbox`, pickup RPCs and legacy references required for security compatibility testing. Never point the R3.9 payment template at Profile-Staging and claim full pickup staging passed.

The R3.9 payment-permission change stays in `.REVIEW_ONLY.sql.txt`, outside active migrations. Its narrow PostgreSQL 17 replay uses only synthetic shop/payment records. R4.1's CI reruns that established rehearsal and checks the same source-level Preview mutation guard. Passing synthetic tests does **not** establish complete hosted-schema equivalence, all production callers, Auth/Storage recovery or safe rollout.

## New R4.1 tests (no live FCM)
The tests exercise the actual `drainPickupPush` function through a fake RPC adapter and a fake asynchronous FCM sender:

1. An absent authenticated UID cannot claim a job.
2. A permitted send is awaited and finished with the correct UID, attempt and lease fencing.
3. Revoked/rotated token or stale sendability recheck causes no send and is acknowledged as unsendable.
4. Transient provider error reports `sent=false, permanent=false`, no instant spin or false delivery acknowledgment.
5. Unregistered/invalid provider tokens report `sent=false, permanent=true`.
6. Malformed leased jobs and failed database rechecks never send.

The durable `pickup_order_events` inbox remains independent of FCM; a missed push must not erase a Ready event. The source currently drains at most one job on an eligible authenticated request, with no continuous worker. Therefore **real-device FCM delivery remains unverified** and prompt delivery cannot be guaranteed from these tests.

## Remaining gates before owner can approve any actual payment-policy work
- Inventory every active caller, including legacy reporting, Super Admin and older integrations; verify that a server-side Firebase-authenticated and shop-scoped payment-history path is available where required.
- Create a **separate, non-Production, owner-approved** pickup staging environment and reproduce an appropriately sanitized full schema, RLS policies, functions, role grants and compatibility fixtures. Never import live personal/payment content into ordinary CI or commit it.
- Record a schema/permissions comparison and synthetic staging acceptance: browser cross-shop attempts denied, authenticated backend owner-scoped reads preserved, order/pickup transitions unaffected, and clear fail-closed rollback/roll-forward procedure.
- Execute actual FCM tests with explicitly consented separate test devices/accounts and shop ownership, checking permission grant, registration, revoke, Ready event, device receipt, token rotation, offline recovery and duplicate suppression. Keep real ordering disabled while testing through isolated fixtures.
- Independently test secure backup/restore; then require separate explicit owner approval before any Production security remediation or pilot enablement.

## Safety and result interpretation
The R4.1 branch contains **only tests, docs and CI**, no new deployable SQL, production-config change, app code change, queue worker, order write or payment implementation. A green GitHub workflow proves the listed fake-RPC and offline PG17 scenarios only. This document does not claim actual FCM delivery, production-schema parity or that LocalEats is launch-ready.

Pointers: Merchant Settings #119, payment rehearsal #118, launch issue #73; Supabase RLS guide: https://supabase.com/docs/guides/database/postgres/row-level-security .
