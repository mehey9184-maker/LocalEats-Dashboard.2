# LocalEats — Phase 1: freeze legacy offline Firestore replay and browser automatic acceptance

**Date:** 2026-11-05. **Status:** Preview candidate, unmerged. **No Production data changes.**

## Verified code risks

The Merchant app carried an old IndexedDB `pending_mutations` queue, with `UPDATE_ORDER`, `UPDATE_MENU`, and `UPDATE_STOCK` records. On browser reconnect, `src/App.tsx` and `src/components/ConnectivityMonitor.tsx` could invoke `processOfflineSyncQueue`. That function used `updateFirestoreOrder` or `updateFirestoreMenuItem` directly from the browser, with no authoritative LocalEats API confirmation or server-owned revision/idempotency check. Historical offline changes could overwrite newer server data and/or conflict with today's Supabase-based order contract. Code search found no active production call site for `queueOfflineMutation`, but old browser IndexedDB records may still exist.

The Merchant component also read `autoAcceptOrders` from localStorage and automatically attempted `updateOrderStatus` for all in-memory orders with `status="pending"`. This could act on old pending orders after a prolonged network outage, in the absence of an explicit server-side auto-accept policy.

The reconnect toast said the local cache had synchronized *before* a verified API response.

## Preview fix (does not redesign screens)

1. `processOfflineSyncQueue()` is made an explicit no-op returning **zero**. It does not read or delete old queue records, update Firestore, or report success. Old IndexedDB entries remain for manual review; they are not automatically submitted.
2. Merchant reconnect and SW messages trigger authoritative `fetchOrders`, `fetchShops` and `fetchAllMenuItems` reads, not the legacy mutation queue.
3. Connectivity badge retains its layout, but displays **N REVIEW** for leftover offline records. Its click explains that no offline changes were synchronized. It does not claim success.
4. The old client-side auto-accept effect is **removed**. The switch defaults off even if localStorage previously said true and displays **Paused**; clicking it explains that server-authorized auto-accept is not available. The old confirmation modal cannot turn it on.
5. Reconnect notice now says the server is being checked. The Orders read-status warning from PR #60 remains responsible for confirming a successful read.

## Limitations and gates

- This freezes **only** the documented legacy offline replay and browser auto-accept mechanisms. Existing direct Firebase/Supabase writes elsewhere in the Merchant app (e.g., shop settings and menu features) are outside this PR; a read-only API Preview guard does not make all frontend actions read-only. Use Preview only for Orders read/reconnect until a full write inventory is completed.
- Some merchants may have unsent legitimate offline stock/menu edits stored in IndexedDB. They are **not** erased. Do not copy them to the database automatically; compare with the current shop/menu, then propose a future server-owned authorized recovery flow. This is an intentional behavior change requiring owner Preview acceptance.
- The old local UI setting for auto-accept may have been enabled, but that setting never provided server-side consent or concurrency authority. Real auto-accept, if ever wanted, must be independently approved with verified customer notes, merchant shop capacity, merchant revocation, idempotency, stale order rejection, and audit records.
- Read-only synthetic/CI tests cannot prove real-phone push, merchant notification delivery, or full staging throughput.
- This PR is based on the combined PR #60 integration branch; it is **not** intended to merge to Production ahead of the review of #60. Other Phase 1 PRs #57 and #58 remain draft, with real backup and production security cutover pending.
- No SQL migrations, Supabase Production writes, Firebase records, payments, order-creation flags, riders, domain changes or live activation were made.

## Manual acceptance in Preview

Open Orders with a test merchant. Disconnect and reconnect; look for **Verifying orders**, not **offline changes synchronized**. If any old queued changes exist, the badge should show **REVIEW** without replaying them. Verify the auto-accept toggle is visibly **Paused**, even if the browser previously enabled it. Confirm old shop orders clear on account/shop switch and the API-stale warning continues to work. Do not use real orders or save shop settings in Preview.

## Next launch gates

First perform the real encrypted Supabase backup/restore on a separate database, then deploy the isolated reviewed security permissions in PR #57 after explicit approval and regression testing. Conduct authorized staging HTTP/Supabase order receipt tests and client/merchant manual original UX sign-off before any launch approval.
