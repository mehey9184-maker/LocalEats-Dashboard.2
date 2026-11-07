# LocalEats Rewards R3.1 — Trusted Pickup Transition Outbox + Firebase Preview Rehearsal

**Status: isolated, synthetic, off. 8 November 2026. DO NOT APPLY THESE SQL FILES TO A CONNECTED DATABASE.** No real Rewards credit, backend route, customer earning, payout, bank action, migration, Supabase write, subscription or Rider/Delivery functionality is introduced.

## Goal and source reviewed

The current pickup service already sends authenticated server-owned commands through `pickup_order_command` with `p_order_id`, `p_action`, unique `p_command_id`, `p_expected_revision` and `p_handover_confirmed`. Pickup order creation is separately handled by `pickup_create_order`. R3.1 **does not replace or modify those functions**, as doing so could disrupt the pickup-only public launch.

R2.7 found no actual Rewards eligibility snapshot at checkout; R3.0 proved a restricted finance executor against **artificial** pickup source records, but did not show how the real collected transition could produce a durable event. R3.1 therefore rehearses the missing transition-to-outbox boundary and a strictly read-only Firebase-inspected preview path. It does not connect them to the real database.

## 1. Private outbox transaction design (disposable PostgreSQL 17)

Two new test schemas `r31_pickup` and `r31_private` reproduce a *reduced* synthetic pickup model (UUID order/command IDs, shop/customer Firebase IDs as text, immutable checkout proof, unique command ID/revision/kind). No existing R2.2–R3.0 tables are changed.

- `programme.active` is initially false. A simulated legitimate collected command still succeeds when Rewards are OFF, and enabling a programme later **never backfills** that older order.
- An AFTER INSERT trigger on a synthetic `command_events` row of kind `collected` creates one outbox event **in the same PostgreSQL transaction** only if the order is verified paid+collected, the customer registered and not a test order, the original immutable purchase proof matched the customer and shop and included eligible units, the shop enrolled and approved at purchase, the programme active before checkout, the payment event precedes collected in both revision and timestamp, and the event actor matches the authoritative shop owner. A missing proof, invalid command, forged actor, unenrolled shop, test account, guest or unpaid order emits **no Rewards event**.
- The outbox includes only order UUID, collected command UUID, revision, delivery/lease state and attempt count. It contains no balance, bank instructions, customer reward entitlement or merchant payable.
- A `UNIQUE` source event and outbox key provide idempotence; duplicate collection cannot produce two outbox rows. Inserting the collected command and then rolling back the transaction also rolls back the outbox insert.
- The deliberately narrow `r31_worker` NOLOGIN role has no source/financial table privileges. It may only EXECUTE private `claim_next(worker_label)` and `acknowledge(order,command,worker)`. Both functions use a non-login non-superuser `SECURITY DEFINER` owner, pinned `search_path`, private schema, FORCE RLS and explicit policy/grant limits. Direct browser/merchant/outbox inserts and role escalation are denied.
- Two separate PostgreSQL workers competing for one pending event can lease it **only once at a time** using `FOR UPDATE SKIP LOCKED`. A worker crash results in an expired lease; a different worker can reclaim the **same** pointer with a higher attempt count. A stale/wrong worker cannot acknowledge it, and a consumed event cannot be reissued.

**Critical limitation:** This is **at-least-once delivery**, not exactly-once processing. A crash after future accounting but before acknowledgement can cause repeated event delivery. A future credit processor must use its own immutable order+line/idempotency keys, revalidate source and budget under one DB transaction, and acknowledge only after committed accounting; a label such as `worker-a` is **not authentication**. The R3.1 worker has no reward-writing function at all.

## 2. Firebase Admin and read-only Preview adapter

`pickupOutboxPreviewR31.ts` is inert, unmounted and has zero database/FCM/Firebase/Supabase imports. Trusted server startup alone supplies a `verifyIdToken(token,true)` callback and a read-only transaction provider. Each inspection accepts only a server-observed Authorization header, order UUID and collected-command UUID.

- Uses the existing revocation-checked R2.6 financial actor parser, rejects anonymous/invalid/revoked/expired tokens (expiry testing uses mock exceptions; actual cryptographic verification requires a real Firebase Admin SDK).
- Within one consistent read-only transaction it verifies that the current owner of the shop is the token UID, that the collected event actor matches that UID, that the order and checkout identity/programme proof agree, and that the database outbox pointer matches the collected command/revision.
- Returns a frozen object `mode: preview-read-only` with `canCredit:false` and `canAcknowledge:false`. There is NO method to enqueue, claim, acknowledge, credit, pay merchants, process refunds or update statuses.
- Unit tests try role/owner impersonation, forged user_metadata, reversed or missing payment commands, expired/invalid source, stale programme opt-in, wrong command ID, invalid token and database outage.

This is a contract test using injected mock Firebase verification and fake database bundles. **It is NOT a connection to the user's real Firebase project, a Preview deployment endpoint, or an OAuth/JWT penetration test.** Do not describe it as production identity security.

## 3. Test evidence and rollback boundaries

The existing dedicated Docker PostgreSQL 17 CI runs R2.2–R3.0 accounting, financial isolation, UUID, privilege and recovery tests, then R3.1 trigger/outbox/race tests. On separate test runs, the general Merchant/API and Customer Profile gates must also pass. All roles/data/functions exist only inside a container with no published port or hosted credentials. When CI exits the container is removed.

The rollback strategy for future work is to first disable new Rewards enqueuing and reward processing, **not** delete unprocessed or already-consumed outbox events or ledger obligations. A real deployment must retain immutable event and accounting history for reconciliation and audit. No real Supabase staging or Production migration is authorized.

## 4. Known blockers and next phase

1. The actual order creation path **still does not store** a Rewards purchase-time snapshot. A future owner-approved pickup-capable staging migration must atomically store one or omit it safely without stopping pickup.
2. The main database's real `pickup_order_command` transaction has not been modified or instrumented. The synthetic AFTER INSERT trigger order assumption must be checked against **actual** command-event and state-update ordering, database constraints and rollback behavior before adaptation. Never just copy `outbox-r31.SYNTHETIC_ONLY.sql` to hosted SQL.
3. No server-owned private outbox worker with authenticated worker credentials, owner-approved campaign policy, retry/backoff/dead-letter handling or observability exists; this synthetic lease has a fixed 30-second duration and no production heartbeat/poison-message policy.
4. The existing ordinary Firebase middleware still uses `verifyIdToken(token)` without revocation checking. Financial operations would need a separate verified Firebase Admin route dependency and stable trusted database composition root, not a client-supplied callback or user_metadata.
5. Event proof and merchant ownership **must** come from central API/Firebase Admin and durable, transactionally consistent source. The synthetic insert uses an untrusted fixture owner and cannot establish who genuinely accepted a cash/card-machine payment or handed over food.
6. No live reward amounts/benefits have final approval, no private hosted Rewards tables exist, no real payout or refund reconciliation/dual control exists. Never retroactively grant free kota based on old purchases.
7. Core pickup launch security findings from R2.7 (`public.payments` authenticated ALL policy and some public SECURITY DEFINER functions) remain open. They must be tracked separately; do not modify Production as a side effect of Rewards.

**Recommended R3.2:** design an owner-approved disposable integration copy of the real pickup command transaction plus an authenticated internal worker-to-credit contract; add poison-message, dead-letter and recovery tests, then independently review with Codex. Rewards remain Coming Soon; launch remains pickup-only/pay-at-shop.
