# Merchant command recovery

Pickup commands have a 15-second client deadline spanning Firebase token refresh, HTTP and JSON response parsing. A timeout aborts available transport work, releases the UI lock, and retains the original command ID/revision/options in account-and-order-scoped session storage. Retry reuses that payload. Account changes, late responses and mismatched receipts cannot clear recovery or claim success.

The API projects a persisted pickup_order_events record into command_receipt: command_id, order_id, actor_uid, kind and revision. It omits the command hash and event details. The Dashboard checks that receipt and the returned authoritative order. Replaying a prior command may return a later order state; its original receipt must still match. Missing receipts remain unconfirmed. No new SQL or public privileges are required.

## Rollout

Deploy the updated API before using this Dashboard against it. Verify the API and Dashboard deployment commits; frontend main alone does not prove the API is updated. Keep production VITE_PICKUP_ORDERING_ENABLED and PICKUP_WRITES_ENABLED disabled until their separate release gates are approved. Old API responses intentionally retain the pending command rather than report success without a receipt.

## Verification

- API npm test: 142 tests passed.
- Client recovery tests cover timeout/abort, exact retry, duplicate requests, account changes, late replies, receipt mismatches, advanced replay, malformed pending routes and unavailable retry storage.
- Real staging Firebase authentication with disposable local PostgreSQL passed the authenticated HTTP lifecycle and replay after collection, preserving the original event receipt.
- A synthetic browser walkthrough deliberately dropped a committed acceptance response, then retried the same command and completed Ready, payment and handover. Production records and FCM delivery were not tested.
- Root Dashboard TypeScript retains its existing 55 baseline errors; touched services introduce none. Production build passes.
