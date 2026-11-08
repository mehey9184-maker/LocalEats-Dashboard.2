# LocalEats R4 — LocalPay Rewards financial security, settlement and future independence

**8 November 2026 | Owner-approved direction to DESIGN R4, not permission to deploy, charge, run live rewards, pay merchants, write Production data, change checkout, merge or incorporate a company.**
Master source of truth: [LocalEats Master Plan](../LOCAL_EATS_MASTER_PLAN.md) in draft [PR #124](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/pull/124). Customer/Super Admin details must point here rather than create divergent rules.

## A. New founder branding and company direction

- Founder explicitly wants **LocalPay** to be the name associated with the Rewards credit and **one day to form a separate company**. Record **LocalPay** as the chosen WORKING brand for the future restricted award, subject to verified South African brand availability and appropriate regulatory advice. Suggested truthful customer-facing descriptor AFTER commercial clearance and an approved release: **"LocalPay Rewards — eligible food credit"**. Display nominal R value accurately (e.g., R80 available) only when the server verifies an actually issued grant. Never show a mock bank account or implied cash balance.
- For now, the actual business **issuer/sponsor remains LocalEats**. No LocalPay (Pty) Ltd is incorporated by this plan, no bank/e-money license is held or assumed, and no customer deposit or regulated money transmission is authorized. LocalPay is an intended future business line/brand, not a created financial institution.
- **Current allowed design intent:** owner-funded, closed/restricted **promotional food-credit awards** only, usable for eligible food at approved participating LocalEats shops; **no consumer cash load, wallet top-up, cash-out, person-to-person transfer, credit lending, bank account, direct card payment, or online payment gateway**. The customer still pays any shortfall in person at the physical merchant (cash or the merchant's own card terminal). Customer can redeem eligible food fully covered by credit without a forced top-up.
- **Future separate-company direction:** assess viable entity name, trademark rights, customer contracts, merchant agreements, sponsor/issuer liability, tax/accounting, privacy/POPIA transfers, data controller duties, banking partnership or other payment authorisation when appropriate. Company separation or issuing broader wallet/e-money would require an **entirely NEW** architecture, regulatory work and explicit owner go-ahead. No automatic transfer of liabilities or balances from LocalEats to any future LocalPay company.
- **Brand clearance warning:** unrelated parties actively operate payment products named **LocalPay**, including https://localpay.com/ and https://localpayapp.com/ . This neither establishes nor disproves a South African trademark conflict. Do not reserve a domain, publicise ownership/uniqueness, register a company or spend money on permanent signage until conducting **official CIPC name and free preliminary trade mark searches**, a lawyer-led clearance (relevant goods/services classes), and reasonable cross-border brand assessment. CIPC official entry: https://iponline.cipc.co.za/Trademarks/Search/FreeTMSearchNotice.aspx .
- **Regulatory uncertainty:** South African Reserve Bank's payments regulatory mandate and modernisation are changing. Restricted multi-merchant food credits are not automatically an unrestricted money wallet, but even **closed-loop arrangements** can raise regulatory questions depending on issuer, acceptance and actual value flows. Before activating any customer-facing instrument, obtain counsel/compliance advice on whether registration, designation, authorisation or bank/provider partnership is needed; do not decide legality solely by the branding term. See SARB official regulation https://www.resbank.co.za/en/home/what-we-do/payments-and-settlements/regulation and 2026 payment-system transfer/authorisation context https://www.resbank.co.za/en/home/what-we-do/payments-and-settlements/psmb . Consumer loyalty awards are also subject to CPA section 35: https://api.acts.co.za/consumer-protection-act-2008/35_customer_loyalty_programmes.php .

## B. Financial rules — every rand backed by real money before any reward promise

### Actual first R500 / 12-customer pilot (PLANNING ONLY)

| Budget bucket | Amount | Meaning |
| --- | ---: | --- |
| Maximum planned owner-funded promotional ceiling | **R500** | NOT proof that R500 has been received or set aside |
| Twelve one-time Bronze grants (up to R25 each) | **R300** | Reserve full grant commitment for each admitted customer, even before a gift is redeemed |
| Not-yet-committed buffer | **R200** | Not a licence to promise Gold; reserve for approved support/disputes and operational prudence |
| Gold/Platinum cash promise under this campaign | **R0** | **NO** R80/R150 higher-rank credit should be issued, earnable, advertised as active, or treated as pre-accruing |

**Before campaign launch**, require independent proof that the owner has actually ring-fenced at least the planned reward commitments and reviewed how operational costs/disputes will be funded; keep a funding reference/status in Super Admin. Stop enrolment at 12 and whenever remaining uncommitted backed funds cannot meet full promised liabilities. The current R500 is a **cap**, not automatically spendable cash.

The full future ladder can reach R25 Bronze + R80 Gold + R150 Platinum = **R255 possible benefit per customer**. If all 12 were enrolled in a fully offered ladder, maximum nominal commitments could reach **R3,060**, which exceeds R500 by R2,560. Never assume delayed Gold/Platinum mission thresholds make unfunded promises safe. No financing from **unpaid merchant subscription invoices** or imagined investment funds.

### Liability-transition invariant

At a point in time, maintain **non-overlapping** liability buckets for: (1) reserved but unearned promised customer benefits; (2) customer-earned but unspent eligible food-credit/gift grants; (3) customer-authorised temporary redemption holds; (4) merchants owed for verified handed-over food **not yet actually paid externally**; (5) dispute and manual adjustment holds. A redemption moves value **from customer-held claim to merchant-payable**, it is **not a second customer-and-merchant cost**. A verified bank payout extinguishes merchant payable and reduces ring-fenced cash. Never count the same R25/R80/R150 twice. Keep a separate actual cash/funding reconciliation and explain buffer utilisation; a merchant receipt confirmation alone does not prove a bank transfer occurred.

**Conservative coverage invariant (conceptual):**
`actual_available_ring_fenced_cash >= unearned_promised_reserves + unspent_customer_claims + active_redemption_holds + unpaid_merchant_claims + documented_dispute_reserves`.
If a value is moved between these categories, decrement the source and increment the destination **within one atomic transaction**. This is a bookkeeping/financial-control model, not an assertion that the currently unbanked R500 exists. Proof of cash must be manually reconciled with bank statements under admin authority; a local app variable is not financial evidence.

## C. Authoritative data model (proposed schema, NOT executed)

**Architecture direction retained:** Customer / Merchant / Super Admin frontends call a trusted **HTTPS API**; the server verifies user identity and shop approval/roles, and the authoritative accounting data lives in server-controlled PostgreSQL. No direct frontend database writes, no trusting localStorage rewards, no shipping privileged API keys.

Proposed logical tables/events (actual naming/migration must be reviewed separately):

1. `reward_program_versions`: immutable versioned Bronze/Gold/Platinum thresholds, published terms, admission caps, cash-limit policy, activation statuses and participating merchants. Current accepted future milestones: 4 units to Silver, +20 to Gold, +30 to Platinum (54 total); under **Bronze-only pilot** no higher-rank credit is available.
2. `reward_funding_pools`: proof of confirmed incoming owner promotional funding, outstanding balance, approved budget ceiling, currency `ZAR`, funding bank reconciliation reference, admin approver and note; NEVER treat a manually entered number alone as proof of funds.
3. `reward_enrolments` and `reward_customer_reserves`: authenticated participant/version unique key; hard cap of 12; full R25 initial guarantee reserved when admitted; independent of whether their four purchased units are earned; anti-multiple-account controls without invasive tracking.
4. `reward_eligible_purchase_events`: one immutable server-confirmed real external `order_id` / relevant `order_item_id`, quantity, shop, customer, actually-paid-and-collected proof, trusted timestamps, refunds/cancellations. **Four eligible purchased kotas in ONE genuine order qualify**; free/reward-funded units, cancelled/refunded orders and simulated checkouts do NOT count. Unique event key prevents duplicated customer progress.
5. `reward_grant_lots`: one-time Bronze food entitlement plus separately future-funded Gold R80 and Platinum R150 lots; customer/programme/milestone unique grant ID; `nominal_cents`, `available_cents`, `held_cents`, `issued_at`, `expires_at` (future approved policy 36 **calendar months per actual grant** or longer legal requirement), merchant coverage restrictions, grant status. Keep expiry and grant accounting separate even if Customer UI shows one sum. **No credit lot is created by merely displaying a rank.**
6. `reward_ledger_journal` and `reward_ledger_entries`: append-only, transaction-grouped, immutable debits/credits in **integer cents**, references to source order/grant/merchant, idempotency key, actor/source, policy version; never update/delete history to 'fix' balances—use compensating entries with reason. Appropriate double-entry accounting semantics and balanced per-journal currency totals required in implementation.
7. `reward_redemption_reservations`: temporary idempotent per-order holds across earliest-expiring available eligible grants, quote snapshot and shop menu eligibility, timeout/release and unique order token. Two devices cannot concurrently spend the same R40. A hold is NOT already a merchant payable.
8. `reward_merchant_payables`: generated **only after** server verifies genuine shop handover AND customer paid the outstanding cash/card-terminal remainder at the physical shop, with unique actual fulfilment/order reference and precise promotional amount. No merchant self-minted payables or duplicate redeems.
9. `reward_bank_transfers` / `reward_merchant_receipts` / `reward_disputes`: owner records external bank transfer amount/reference/date and supporting authorised evidence, status `prepared → externally_sent → merchant_acknowledged` (or `disputed`); authenticated shop acknowledges or contests receipt. Reconciliation and no second bank payment based on a retry. Merchant acknowledgement is a separate evidence source, not a substitute for bank reconciliation.
10. `reward_admin_audit_events`: restricted roles, fund changes, grant overrides, programme version changes, manual adjustments, cancellations, refunds, disputes, exceptional fair expiry extensions. All money actions append audited events with actor/time/reason and no unapproved ability to hide deletions.

**Future split payments:** R100 eligible food, R65 actual credit, R35 customer pays shop. Reserve exactly R65 credit server-side; after the verified physical R35 plus food pickup, capture R65 from credit lots and create **R65 payable** to merchant, not R100. If payment or handover fails, RELEASE R65 to same original lots, preserve original award and expiry dates, and create NO merchant payable. Avoid customer evidence alone as proof of payment.

## D. R4 state machine and threat controls (design only)

1. **Funding verified → programme admit:** require a funding source reference and independent proof; server rejects new participant if `max_customers = 12` or `remaining_funded_uncommitted < R25`. Admission lock/transaction defeats concurrent 13th signup.
2. **Real paid+collected order → eligible unit credited:** merchant authenticated/approved, order owned by customer, purchased quantity and price verified by API, shop attestation of actual payment and pickup, replay-resistant customer pickup handover (e.g., short-lived collection PIN that is never the raw shop password). A PIN is corroborating proof, not a substitute for merchant payment evidence; risks of staff/customer collusion need dispute monitoring.
3. **Four units reached → ONE Bronze grant:** unique customer+programme milestone, purchase-event replay prevention, gift cap and reserved funding, no double issue even across two devices or shops.
4. **Redemption quote → atomic short-lived hold:** server recalculates eligible menu item prices and balance; if Gold/Platinum offers become real later, consume **earliest-expiring lots first** without erasing Gold remainder at Platinum rank-up, and enforce grant-specific 36-month customer-friendly validity. No expired/unknown credit accepted.
5. **Cash/card remainder + actual handover → capture:** one server transaction moves held credit from customer liability to single merchant payable; order and redemption status advance atomically/idempotently. Do not mark captured merely because frontend displayed 'Ready' or 'Collected'.
6. **Manual bank reimbursement → merchant receipt:** no in-app wallet transfer to merchant; owner pays externally and attaches genuine bank evidence; merchant then acknowledges or disputes. Keep liability open through payment dispute and reconcile actual bank movement. No fabricated 'Paid' states.
7. **Refund/cancellation/reversal:** release unconsumed holds; for refunded eligible orders subtract net qualifying PURCHASED units and re-evaluate rank/grant state under explicit policy. **Never silently claw back a genuinely already redeemed gift or delete customer rank without a legal/fairness dispute rule**; freeze disputed scenarios for admin review instead. For refunding a promotional food fulfilment, record compensation/restoration in original grant lots where valid; audit expiry exceptions.
8. **Expiry and reminder:** owner-approved future policy gives each actual funded Gold/Platinum grant 36 calendar months or longer required. Show distinct grant dates and optional 30-/7-day reminders; maintain immutable expired ledger events and handle platform-caused expiry interference fairly. Legal end-of-day cutoff/timezone still requires expert sign-off.
9. **Outage/retry:** repeated network request with same idempotency key must return original result; uncertain create/redeem/transfer status must show 'Checking', never trigger an unreviewed second financial action.
10. **Permissions and privacy:** customer sees only own real credit/transactions; merchant sees only payables attributable to own approved shop; Super Admin can administer pool and reimbursement with precise permissions and immutable audit. Rate limits, brute-force protection, secrets management, no PIN/token in logs, backups and eventual restore rehearsal.

## R4.1 completion evidence — test-only GitHub draft (2026-11-08)

The founder APPROVED R4.1 isolated financial-engine testing. The Merchant/API draft PR #124 now adds a separate pure-Node `localeats-api/tests/r41LocalPayFinance.mjs` and `r41LocalPayFinance.test.mjs`, with `npm run test:r41` and an API `npm test` inclusion. **Verified PASS in two environments:** 23 R4.1 checks passed locally on Node v22 and again **23/23 PASS on GitHub Actions** at code commit `ffc22e05501338c118e7e7d23e166187b082aaaa`, Merchant baseline run `42445248328`, job `128622692231`. That same workflow passed **224/224 existing API tests**, and the Verified Customer Profiles API — Disabled by Default workflow also succeeded. The code was tested as test-only fixtures; this is NOT a PostgreSQL/bank/production security certification. The test files are deliberately outside `localeats-api/src/` so they cannot be compiled into the API runtime, imported by Express handlers, or issued real Supabase/Firestore writes. No package dependencies were added. Its constructor will reject missing `syntheticFixture: 'R41_TEST_ONLY'`.

**Covered tests:** 12 concurrent capped R25 reservations under R500 ceiling; 13th rejected; true single-order four-unit Bronze reward; 3+1 in separate orders; once-only gift no double replay; unpaid, uncollected, simulated, refunded, reward-funded or nonparticipating-shop rejection; negative/invalid amounts; concurrent credit holds; no payable on quote, unpaid shop remainder or uncollected food; merchant payable only after verified *fixture* handover; duplicated/mismatched fake bank evidence prevented; merchant acknowledgement distinct from bank record; future Gold R80/Platinum R150 lots and oldest-expiring first while preserving original dates; R100 food financed R65 future credit plus R35 physically paid remainder gives **R65 not R100** payable; refunded/cancelled reserved credits return to same grant; detached snapshot cannot mint money; no negative internal balances and all buckets conserve initial fictitious funds.

**Additional trust fix caught by synthetic unit tests:** A Bronze **free item** of R24 must NOT leave an R1 spendable credit that can be redeemed for a second item. The model explicitly consumes the entire one-off gift entitlement after one paid-and-collected qualifying item is handed over; any R1 unused ceiling returns to *uncommitted mock promotional funds*, rather than granting a second gift. **This is a rehearsal-model correction, not a real-app fix.**

**What a passing synthetic test does NOT establish:** genuine funding proof, bank transfer validity (a fake boolean/mock value is used), approved-shop identity (only mock store IDs), cryptographic pickup proof, legal regulated activity, actual customer payment, real database consistency, persisted locks and unique indexes across processes, deterministic rollback of cross-service events, real retry after a database outage, real customer/merchant app flows, or Production financial safety. Those require separate R4.2 disposable PostgreSQL integration and audited review. Do not interpret `R41_TEST_ONLY` as a security control in a real environment or copy its fake `paid`/`collected` parameters into a live API.

## E. Draft acceptance matrix for isolated, non-writing synthetic tests

| Test | Required result |
| --- | --- |
| 12 concurrent admissions followed by a 13th | first 12 capped, 13th rejected; R300 maximum obligations, R200 buffer |
| Single authentic paid-and-collected order with four eligible purchased kotas | Bronze once; no multi-day/visit requirement |
| Same checkout duplicated with two clients/retries | one progress event, one gift |
| Simulated checkout, refunded or uncollected food | zero qualifying progress and zero gift/payable |
| Two devices attempt to spend same R80 | only one valid hold; never negative available |
| R100 food with R65 credit and R35 unpaid remainder | hold released, no merchant payable |
| R100 food with R65 captured credit plus physical R35 verified | R65 payable after verified pickup, never R100; credit lot reduced only once |
| Gold R40 leftover + new Platinum R150 future grant | R190 displayed, earliest expiring lot consumed first; R40 expiry not changed |
| Merchant screenshot claims transfer but no bank evidence | not settled; dispute/review |
| Owner retries external-bank transfer record | original transfer/ref seen; prevent duplicate intended payout, reconcile actual bank statement |
| Funded liability reaches limit; 13th signup | fail-closed; no extra reward promise |
| Expiry, clock skew, cancellation, system error | precise legal cutoff, reversible holds, fair audited extension, no vanished valid credit |
| Server cannot read current ledger | neutral unavailable/retry, not invented R0 or promise |
| Customer / merchant tries direct DB write, admin bypass | permission denied; server-only accepted mutations |
| Future Gold/Platinum credits with current R500 Bronze-only version | impossible to earn, grant, spend or advertise as funded |

## F. Repo-specific responsibility and staged delivery

**Merchant/API source of truth:** versioned programme and fund/reserve table design, authoritative order purchase evidence, append-only financial journal, idempotent grant/hold/capture/payout state machines, role/consistency tests, no direct DB writes from client.

**Customer app:** preserve original ShopCard, menu and pickup checkout; future conditional small **LocalPay Rewards** header with accurate *restricted food credit* label and separate grant history; future eligible items/credit split tender only under proven server quote and after owner preview acceptance. Do NOT show an active bank/wallet, create customer payment instructions, or remove closed-shop browsing.

**Merchant dashboard:** preserve original UI/UX; future order pickup proof, limited own-shop reimbursements and truthful amount owed/sent/disputed; never give merchants authority to mint credit or mark the owner's bank payment complete merely by clicking a local button.

**Super Admin:** programme admissions/budget guard, versioned caps, verified funding evidence and audit, shop opt-in, external bank payout recording and reconciliation, disputed claims, trustworthy +1 month merchant trial button (separate commercial function). Do not net LocalPay Rewards **merchant reimbursement debts owed BY LocalEats** against separate merchant subscription debts **owed TO LocalEats**.

**Future LocalPay company:** separate identity/legal holder may later offer other payment services after market validation, feasibility, naming/trademark rights, authorised financial arrangements, consumer protection and a separate architecture/owner-approved spin-off plan; never silently migrate existing customer rewards liabilities or accounts.

**Non-negotiable safe release sequence:** document policy → founder approval of remaining open details → legal/brand review → actual ring-fenced funding and participating shop agreements → isolated server model and PostgreSQL migration DRAFT → synthetic unit, adversarial and concurrency tests → Customer/Merchant/Super Admin Preview UX regression and sign-off → backup and data/reconciliation rehearsal → explicit, distinct small pilot **go-live** approval. Production, actual reward creation, merchant bank transfer, automatic billing and code merge remain OFF until owner signs that specific gate.

## G. Open founder decisions / researched cautions

1. Should the first LocalPay naming be visible as **"LocalPay Rewards"**, or only as an internal name while official brand clearance happens? Founder selected LocalPay as future name; public use should await clearance.
2. How do participating merchants opt in and document actual payment + collection, without treating a shop's self-attestation alone as infallible?
3. What is the owner-approved external bank reimbursement cadence (e.g. weekly), dispute deadline and emergency recovery reserve? Until confirmed, do not promise an exact pay-out day.
4. What evidence proves real ring-fenced cash, and is merchant subscription revenue actually collected versus forecast?
5. Which food items can be paid with credit? When does a split-credit purchased kota earn eligibility, if ever? Current conservative default excludes reward-funded units.
6. Exact future Gold/Platinum enrolment start and treatment of purchases from before those campaigns; do NOT promise retroactive grants.
7. Legal determination of South African loyalty vs electronic-payment classification, validity under CPA §§35/63, POPIA and brand rights; any regulated functions require appropriate authorisation/partner setup.

**R4 as of 2026-11-08: financial-security DESIGN documented, NOT implemented or certified.** A draft approval to DESIGN is not approval to execute a real bank transfer, issue credit or register a company.
