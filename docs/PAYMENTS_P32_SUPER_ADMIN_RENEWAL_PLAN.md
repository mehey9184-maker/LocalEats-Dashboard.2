# LocalEats Payments P3.2 — Subscription and Super Admin renewal proposal

**Status:** Design only. Not activated. No migration, payment write, notification scheduling, shop suspension or approval change is authorized by this document.

## Merchant-visible plan information

- **Free introductory period:** planned three calendar months, R0; the actual start and expiry must be set by an authorized server action when the introductory offer is activated for that shop. Never compute a billing deadline from `shops.created_at` or the merchant's browser.
- **Plus:** R199 per month.
- **Pro:** R399 per month.
- **Premium:** R499 per month.
- Tier benefits, eligibility, tax treatment, grace periods and paid launch date remain unfinalized. Do not claim entitlement to premium features or automatically invoice a merchant.
- Dashboard should render the authenticated API-reported current tier and a clock based on an explicit server timestamp, in South African time. No timestamp means **Expiry date awaiting confirmation**. A front-end countdown is informational only; server determines expiry and access. An expired clock does not change shop state.
- Current Merchant API lacks a dedicated authenticated billing-status contract. P3.2 Preview treats optional shop fields as display facts only, not a verified bank/payment ledger. The isolated demo timer is clearly marked SAMPLE ONLY; it must not create or store subscription records.

## Proposed expiry workflow (requires separate owner approval)

1. A server-authoritative subscription record is established for the **API-verified shop**, including tier, billing state, activation, expiry (absolute UTC timestamp), policy version, unique period reference and source. Only a trusted Super Admin process can set initial trial dates.
2. A server scheduler checks due/expired subscriptions based on authoritative timestamps. On expiry, it creates an **idempotent** admin-review event (one per shop, period and event type) that appears in the **Super Admin App** notification inbox, with optional push when delivery is supported and authorized. Retry delivery without duplicating event records. An expiry alert is not a financial transaction.
3. Owner contacts merchant or merchant contacts owner. For an in-person cash payment, **Super Admin** first verifies the exact shop, amount, tier and period. Only an active, authenticated Super Admin can use **Record cash payment**. Merchant UI has no authority to mark itself paid. No card number, CVV, or customer private financial data is collected.
4. Admin confirms a payment-received event with amount/currency ZAR, payment method (in-person cash), actor identity, shop/period IDs, time, optional receipt reference, and a unique idempotency key. The backend writes payment evidence and a linked subscription renewal **atomically**, validates the amount/plan, and returns a receipt ID. Show success only after server confirmation. A secondary confirmation and immutable audit trail protect mistakes; record correction/refunds as separate audit events, never overwriting history.
5. On verified renewal, the server changes **subscription access** and sets the next expiry according to approved policy. Clear the renewal notification only when receipt and state transition are confirmed; do not trust a browser toast. The merchant refreshes and sees the API-provided expiry and chosen tier.
6. **Business/shop approval remains independent.** Never set `approval_status: approved` merely because cash was received. A shop independently rejected/suspended for safety, ownership or compliance stays blocked until its separate authorized review resolves. Likewise, nonpayment must not silently alter shop approval without an explicit approved policy.

## Decisions still needed before implementing Super Admin payment actions

- When to start each shop's three calendar months of introductory access, and how to treat earlier shops.
- Whether an expired subscription should temporarily enter a grace period; proposed discussion starting point: **7 days**, but not approved.
- Exact billing access restrictions after any grace period and how to protect customer orders already underway.
- Which tier benefits correspond to R199/R399/R499, and when subscription collection begins.
- Whether reminders should be sent at expiry only or also before expiry, and which Admin channels are authorized.
- Legal/invoicing/tax and receipt requirements for in-person cash collection in South Africa.

## P3.2 Preview safety boundaries

Only read-only merchant UI and regressions are changed. `main`, Production, Super Admin and database remain unchanged. No Super Admin notification or payment reconciliation is claimed to exist. Owner acceptance of the Preview and separate backend/migration authorization are required for subsequent phases.
