# Pickup acceptance deadline

Implements the owner's approved five-minute unanswered-order policy for the six-month pickup/pay-at-shop pilot. Routine preparing updates need no acknowledgement. Only pending, unpaid, managed collection orders opt into this feature. Existing historical orders are not backfilled.

Use server timestamps: remind the merchant once after two minutes; expire an unanswered request after five minutes. Persist cancellation and its audit event atomically. A late acceptance must fail even when the scheduler is unavailable. Customer cancellation, merchant acceptance and timeout serialize on the order row and retain existing idempotency protections. A preparation delay never expires an accepted order.

Two deadline misses in thirty minutes pauses new requests for that shop. This is an implementation default selected by Codex, not a claim the owner specified those thresholds. Customer cancellations do not count. Resume requires an authenticated, verified shop owner and an explicit action; it cannot open an otherwise closed/unapproved shop. No inferred offline status from a single disconnected browser.

Approaches: browser timers fail when tabs close; paid Firebase Functions would add billing; database deadlines plus bounded database sweeps fit the current PostgreSQL authority. Select the latter with a durable notification inbox/outbox and an independently approved scheduler. Supabase pg_cron is a deployment candidate, not an installed or verified hosted capability. Never promise free-tier uptime or exact push delivery time.

All feature activation defaults off. Prepare SQL only under supabase/drafts; run it solely against a new disposable local PostgreSQL cluster. No hosted schema changes, billing, live notifications, real orders, Production, merges, or changes to existing icon and private My-Kota drafts. API functions remain SECURITY INVOKER and inaccessible to browser database roles. Notice recipients derive from order/customer and verified current shop ownership; tokens stay server-side.

Customer copy: waiting for acceptance, deadline elapsed but unconfirmed while offline, then persisted expiry with Find another shop and View order details. Do not offer a second order while the first is uncertain. Merchant copy distinguishes paused reception from opening hours. Keep original layouts and components.

Validation: exact 2/5 minute boundaries, accepted/cancelled/paid/legacy exclusions, duplicate sweeps, expiry/accept/cancel races, private account isolation, pause/resume/reset, zero cloud sending, six-month synthetic workload and bounded queries. Report simulated versus real-device evidence separately.
