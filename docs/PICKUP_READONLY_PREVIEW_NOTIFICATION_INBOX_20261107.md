# Pickup notification inbox: read-only Preview acceptance (2026-11-07)

**Status:** review-only patch. No Firebase or Supabase writes, no Vercel deployment, no feature activation, no Production changes, no merge.

## Existing verified issue

- The authenticated `GET /api/v1/notifications` loads persisted `pickup_order_events` for the caller and then awaits `drainPickupPush` (a Supabase outbox claim, sendability check, Firebase FCM push, and outbox completion write).
- Because this "GET" previously had mutation/send side effects, `previewReadOnlyGate` correctly rejected its GET and implicit HEAD in Vercel Preview. Customers could not browser-check their Ready inbox in a read-only Preview, even if a verified read-only database connection existed.
- A Preview deployment may share Production Supabase read credentials. Disabling the guard without removing the side effects would be unsafe.

## Narrow solution

- Keep the existing `isReadOnlyPreviewMode` condition in one exported function, shared by the HTTP guard and notification handler. It is true when `VERCEL_ENV=preview` or explicit `LOCALEATS_PREVIEW_READ_ONLY=true`.
- **Only for read-only Preview**, `GET/HEAD /api/v1/notifications` skips `drainPickupPush` entirely. It performs its original authenticated, recipient UID-scoped, `ready`-only, sorted/limited read and sends no push.
- The preview guard continues rejecting **every POST, PUT, PATCH and DELETE** before API routes; GET and HEAD notifications can now reach the pure-read route. Other GETs are not newly made safe by this change and still require individual review.
- **Production and local development** still await the existing outbox drain on notification GETs. This preserves the current opportunistic retry trigger while a separately designed durable retry worker is outstanding. A companion draft PR #77 separately bounds provider waiting and must be reviewed/merged independently.
- No new endpoint, signature, pagination format, token exposure, background worker, SQL function, migration or payment/ordering behavior.

## Tests

- `localeats-api/src/middleware/previewReadOnlyGate.test.ts` now tests the Preview guard admits GET and HEAD notifications, rejects mutation verbs, verifies fake Customer A/B authenticated event reads (recipient isolation), 401 for missing auth, and zero attempted outbox RPC in Preview.
- It also tests explicit read-only flag behavior without Vercel Preview.
- `.github/workflows/pickup-preview-notification-inbox.yml` builds and runs the Preview gate and existing mounted pickup route test using synthetic stubs and no cloud secrets.
- CI must actually finish green before any testing claim; a passing synthetic test does not prove hosted Firebase/Supabase identity mapping, deployed Vercel routing or database RLS.

## Outstanding gates before public release

1. Verify **actual** published Firebase named Firestore database rules and Supabase signup/rider permissions; no public launch if permissive.
2. Hosted **isolated** Customer A/B authenticated notification inbox tests, including stale/empty state, pagination, cross-account query and Preview read-only banner. Never copy personal data to GitHub logs.
3. Confirm merchant Ready creates an authoritative persisted event accessible to only its intended recipient, even when FCM is unavailable. Separate staging write authorization required.
4. Verify duplicate-device push behavior and design a durable outbox scheduler. Production still uses request-triggered push and is not guaranteed prompt delivery without an online eligible client.
5. Verify Customer/Merchant/API deployment compatibility, startup/order/cancellation state and operational support. Keep `PICKUP_WRITES_ENABLED=false` and all ordering flags OFF until explicit owner launch approval.

Related drafts: Merchant/API #77 (bounded FCM), Customer #73 (Firebase rules review), Merchant/API #75 (staging profile), launch issue #73. This branch changes no Customer UI and preserves existing design.
