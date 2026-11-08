# LocalEats Rewards R2.8 — Private ledger and transaction design (synthetic only)

**Safety status: NOT a migration. NOT an API integration. NOT approved for Supabase, staging or Production.** The files named `private-r28.SYNTHETIC_ONLY.sql` and its assertions are loaded only by the existing GitHub Actions Docker `postgres:17-alpine` runner. The role `r28_untrusted`, schema `r28_private` and all contents exist exclusively inside the disposable CI container. There is no hosted DB URL, environment secret, API route, real order, live reward or bank action.

## 1. Why a NEW private schema instead of reusing the existing public tables?

R2.7 examined connected production PostgreSQL 17 metadata and confirmed that `public.orders` contains JSON order lines and pickup status, `public.pickup_order_events` records payment/collection transitions, and the existing shop/menu tables are mutable. None of those records currently establishes immutable kota eligibility, price/rule revision, owner-funded campaign liability or independently verified cash refund evidence **as of the time of purchase**. Therefore, counting today's menu or upgrading a Customer Profile loyalty counter would invent credit.

R2.8 adds a candidate separate **private accounting domain** that can eventually be attached to a transactionally verified future pickup order service. This candidate is not the actual connected Production schema. Historic paid pickup orders are not eligible retroactively.

## 2. Synthetic-only table design

| Domain | Scratch tables | Invariant |
|---|---|---|
| Campaign and participation | `programme`, `shop_enrolments`, `shops`, `customers`, `admins` | Programme starts disabled; shop must be approved and enrolled before checkout; real registered customers only |
| Current merchant menu | `menu_current` | Mutable revision, price in integer cents, kota eligibility, food type; not used to recalculate historical purchase credit |
| Evidence at purchase | `orders`, `purchase_lines` | One immutable original order ID and ordered line snapshots with original price, quantity, programme version, menu revision and eligibility |
| Paid-and-collected order proof | `pickup_events` | Immutable, unique, revision-ordered payment-confirmed then collected events; no credit from a status flag alone |
| Loyalty entitlement | `credits`, `progress`, `grants` | One credit per order line and one grant per tier; milestone thresholds 4, +20, +40. All lines in an order share a single atomic credit call |
| Financial liability | `programme.committed_minor`, `handovers`, `payables` | Reserve cap on grant; replace cap with food's actual price on verified handover; only handover creates merchant debt |
| Manual settlement design only | `transfer_evidence`, `merchant_receipts` | Immutable reference and receipt placeholders; **NO function that sends money or marks bank receipt** |
| Refund recovery | `refund_events`, `refund_holds` | Independently reviewed shop/admin refund source, cumulative quantity cap, immutable event; preserve earned grant and existing merchant debt |
| Audit | `audit_events` | Append-only events with unique semantic references and no silent rewriting |

The working cap model is Bronze R25, Silver **R125 proposed**, Gold R200. These are still subject to owner's final financial terms approval. The programme liability ceiling in this rehearsal is based on cap amounts; `committed_minor` is **not a spendable customer wallet balance**. It includes outstanding reward caps and already-created payables including future paid/confirmed ones. Unused cap headroom is freed only when actual food handover costs less than the reserved cap. No discount, delivery or rider value is included.

## 3. Transaction boundaries rehearsed

1. `capture_checkout`: trusted server IDs and *only* menu-item ID/quantity intent. It locks the singleton programme and current menu row, verifies simulated registered/non-test identity and approved enrolled shop, writes immutable purchase snapshots; duplicates return the same order, altered intent rejects. This must ultimately be inserted into the *existing actual authoritative pickup CREATE ORDER transaction*, not called as an independent HTTP afterthought.
2. `record_pickup_event`: synthetic trusted command fixture for immutable, increasing payment/collected events. This is NOT a real authenticated checkout/payment confirmation.
3. `credit_collected_order`: holds programme budget row lock through source-validation, new line credits, progress milestones, grants and cap reservations. A second unfunded line aborts **every** write in the database transaction. Replay cannot double-credit. Two customers competing for R25 cannot both reserve the same R25.
4. `record_verified_refund`: locks programme row to serialize against credit and handover; checks the original immutable item quantity, simulated merchant ownership and independent active Super Admin reviewer; records a refund before credit as an award blocker, or after credit as a customer hold without removing a reward/merchant debt.
5. `fulfil_grant`: verifies an unheld earned grant, approved enrolled shop and food item kind/price; one immutable handover creates one `owed` payable at the actual item price. A replay cannot create duplicate debt. Other-food Bronze alternative must cost strictly below R25.
6. `reconcile_commitment`: tests equality between funded programme commitment and the sum of outstanding (earned) caps plus the full amount of fulfilled handover payables. Bank records are only proposed schema placeholders.

All functions are `SECURITY INVOKER` with a pinned PostgreSQL `search_path`. RLS is enabled on every scratch table and no policies are granted to public client roles. Schema/table/sequence/function `PUBLIC` grants are explicitly revoked; test-only untrusted role checks must fail to read, insert or execute. Scratch functions run as PostgreSQL test owner and have **NO mapped Firebase identity**; this is not proof of real authorization.

## 4. Regression evidence and concurrency

The existing R2.2/R2.3/R2.5 Docker test run still executes first. R2.8 adds:
- Immutable purchase snapshots, same-intent idempotence, rejection of client-controlled price/eligibility claims, negative guest/test and unenrolled-shop scenarios;
- No credit until separately stored payment-confirmed then collected command; no reward debt until food handed over;
- Four kota units -> one Bronze grant at R25 cap, another twenty -> Silver grant at proposed R125 cap, budget reconciliation after R24 food handover;
- Price/menu revision changing after purchase cannot affect historical qualifications;
- Distinct verified shop owner and active Super Admin reviewer for synthetic manual refund; no account rank deletion or merchant chargeback; extra refund quantities rejected; append-only records reject UPDATE/DELETE;
- Two different PostgreSQL sessions racing: same checkout ID, same award, two customers for one funded cap, refund vs credit, menu edit vs purchase snapshot, and multi-line failure rolling back *all* progress and reservations;
- Every scratch relation RLS-enabled; untrusted role cannot use private schema, select/insert tables or execute private functions.

## 5. Explicit gaps before ANY real integration

- No actual Supabase Rewards tables, API adapter, central HTTPS route or Firebase JWT verification is implemented here. **Never run these test files through a connected SQL editor, migration tool, or Production psql session.**
- Real LocalEats `orders.id` is UUID and source `pickup_order_events` is already present. This prototype uses synthetic text IDs for ease of rehearsal. An actual integration must have proper foreign keys to the real order and shop/source records and must be reviewed against current deployed migrations, not blindly copied from this prototype.
- The synthetic refund function trusts the merchant/admin IDs supplied to it. In Production they must come from independently verified revocation-checked identities and current, transactionally loaded ownership/admin role records. A privileged backend must not accept user-typed claims as evidence.
- The prototype no-policy/RLS and service-owner execution pattern is a **deny-by-default test**; a real service needs an audited narrowly privileged server role, function grants, and full Row Level Security/invoker tests. Simply changing a function to SECURITY DEFINER to bypass access problems would be unsafe.
- Real return-to-shop/food quality disputes, merchant reimbursements, bank returns, partial payouts, refund appeal/release, identity/account transfer and programme shutdown require separate policy and financial audit.
- No merchant payout initiation or confirmation functions are implemented; **manual transfer proof itself is not proof that funds arrived**.
- The real app must remain pickup-only with pay-at-shop. Keep the Rider App/Delivery deferred and the Rewards Coming Soon offer inactive.
- R2.7 found the current public.payments policy broadly permissive and several anon-executable custom SECURITY DEFINER functions. Codex's core pickup-security remediation is separate and should be reviewed before an owner approves any financial rollout.

**Safe future phase R2.9:** independent transaction/privilege and source-integrity review of the proposed private schema, adapt exact table types to the real pickup contracts **in a disposable copied schema** and document reversible migration/restore steps. Only after the owner's explicit approval would a real Preview-schema migration be proposed. Public launch remains a separate ~60% verified pickup workstream.

Documentation references: [Supabase securing Data API](https://supabase.com/docs/guides/api/securing-your-api), [RLS and grants](https://supabase.com/docs/guides/database/postgres/row-level-security), [function permissions](https://supabase.com/docs/guides/database/functions), and PostgreSQL 17 [explicit locking](https://www.postgresql.org/docs/17/explicit-locking.html).
