# LocalEats Master Plan

> START HERE. One living project memory for the LocalEats founder, future developers, AI assistants, and collaborators.
>
> Owner: LocalEats founder (sole final decision-maker). Created 8 November 2026.
> Status: BUSINESS DESIGN AND DOCUMENTATION ONLY. NO live Rewards, checkout activation, database writes, production deployments, billing, or release approval.
> Canonical repository: https://github.com/mehey9184-maker/LocalEats-Dashboard.2
> Canonical path: LOCAL_EATS_MASTER_PLAN.md. Until this document's draft PR is merged, use the PR branch, not the absent main-branch URL.

## READ THIS BEFORE ANY WORK

This document preserves decisions, uncertainties, roadmap, budget calculations and handover context across long chats or changes of AI/developer. It is the source of truth for founder APPROVED BUSINESS INTENT; it does not replace repository AGENTS.md instructions, the deployed source, tests, current migrations or real security evidence.

The founder wants us to discuss anything that does not make sense until we understand it, use credible research, challenge risky assumptions, preserve the original look of the apps, minimise costs, and never represent mocks as real transactions. A later assistant should first read this file, then read Customer, Merchant/API and Super Admin instructions and inspect current implementations. When documents disagree, explicitly report the contradiction instead of silently guessing. A decision described here never itself permits a production write.

**Current priority, 8 Nov 2026:** Focus the assistant's current work on defining the LocalEats Rewards / Free Kota programme, promotional balance, funding and customer experience. Defer other launch-readiness phase work until this design task is settled. This does not control separately operating external tools or grant permission to turn on live Rewards.

**Current launch limits:** Customer pickup only; customer pays at the shop using cash or the shop's physical card terminal; no rider/delivery for at least the initial six months; no in-app payments, subscriptions, reward redemptions, real test orders or production changes without separate approval.

## 1. How to interpret decision status

| Label | Meaning |
| --- | --- |
| CONFIRMED | Explicit decision from the founder, not necessarily implemented |
| PROPOSED | Reasonable idea under discussion, not approved for advertising or production |
| OPEN | A missing decision; ask the founder |
| IMPLEMENTED, VERIFIED | Current code and tests verified, with evidence/date |
| BLOCKED | Preconditions are missing; do not activate |
| SUPERSEDED | Older proposal replaced by a newer founder decision; preserve history |

The founder alone can change PROPOSED or OPEN to CONFIRMED. An AI must keep changes in the dated log at the bottom of this document. Do not silently promote a mock-up or green test into a live offer.

## 2. Product mission and repository map

LocalEats should help local South African food shops reach customers, earn repeat orders and handle pickup reliably. Near-term success means trustworthy customer discovery, fast and stable Home, truthful shop menus/open-state, server-confirmed orders, reliable critical alerts, clear merchant handover, and honest financial records. Expansion from South Africa across Africa and later globally is a long-term ambition. LocalMarket, LocalRider, LocalPay and LocalCover are deferred separate concepts, not required for this pickup release.

| Area | GitHub repository | Role |
| --- | --- | --- |
| Customer App | https://github.com/mehey9184-maker/LocalEats-app | Home, ShopCard, discovery, cart, Profile, future Rewards display |
| Merchant Dashboard and central API | https://github.com/mehey9184-maker/LocalEats-Dashboard.2 | Shops, menus, pickup order handling, Merchant Marketing, server authority |
| Super Admin | https://github.com/mehey9184-maker/Super-LocalAdmin | Shop review; future Rewards campaigns, budgets, payables, transfer confirmation and audits |
| Rider/delivery | Future phase | Must remain disabled for pickup launch |

Current source may include earlier Firestore compatibility layers, legacy delivery logic or future architecture intentions. Frontends should never decide financial truth. Check actual runtime implementation before proposing code migration.

## 3. Permanent engineering and business rules

1. Founder approves release, spending and irreversible live changes. Work on review branches and draft PRs; do not merge or deploy Production automatically.
2. Preserve original Customer and Merchant designs. Any new Rewards indicator near the logo must be visually approved without changing the trusted shop card/menu/cart/navigation.
3. No connected Supabase/Firestore real data writes, live orders, credentials, shop approvals, real push sends, security-rule changes, hosted-staging purchases or Production feature flags without separate explicit approval. A Vercel Preview may still point at Production.
4. Central server authority: Firebase-verified identity; shop ownership verified by server; authenticated immutable paid-and-collected events; server-side pricing; atomic reward grants/spends; accurate merchant debts; audit. Browser state/localStorage is not proof of payment or collection.
5. A customer should never earn from a fake/simulated checkout, refunded/cancelled/uncollected order, free reward unit, duplicate replay or unauthorised shop. Count eligible paid kota UNITS, not simply orders.
6. Do not change the pickup policy: customers browse closed shops, but closed shops cannot take new orders. No rider/delivery, online payment gateway, subscription charging, unlimited rewards or guaranteed jobs.
7. A member's permanent rank is different from their available promotional food balance. Neither a cache nor a disappearing balance may silently demote a member.
8. No misleading marketing: disclose fundamental conditions, participating shops, qualifying items, campaign capacity and dates. Before activation, the flyer must prominently say COMING SOON.
9. Monetary records use integer ZAR cents and auditable immutable events; no unrecorded grant, double spend, duplicate reimbursement or false merchant-confirmed transfer.
10. Distinguish actual verified deployment state from synthetic offline tests. Link exact commit/PR/test evidence, and leave unresolved risks visible.

## 4. Founder decisions for Rewards (8 Nov 2026)

| ID | Decision | Status | Live status |
| --- | --- | --- | --- |
| RW-01 | First four qualifying purchased kotas unlock a free eligible standard kota (up to proposed R25), or another eligible food item priced below R25. That first free-kota gift is ONCE PER CUSTOMER; it must NOT repeat every four purchases. | CONFIRMED one-time rule | NOT LIVE |
| RW-02 | Permanent ranks are Bronze, Silver, Gold, Platinum. Highest earned rank stays permanently, even when available food credit is R0. | CONFIRMED | NOT LIVE |
| RW-03 | Customers can redeem eligible Rewards at ANY PARTICIPATING LocalEats shop, not only the shop where they earned units. | CONFIRMED | NOT LIVE |
| RW-04 | LocalEats funds rewards. After verified food handover a merchant payable appears in Super Admin; owner records manual bank payment; verified merchant confirms receipt or disputes. | CONFIRMED | NOT LIVE |
| RW-05 | Gold and Platinum benefits should be SPENDABLE PROMOTIONAL FOOD CREDIT, usable across multiple eligible purchases until the available amount is exhausted. Not a compulsory single food bundle. | CONFIRMED product direction | NOT LIVE |
| RW-06 | Put the available credit amount near the LocalEats header logo, with rank, progress and history in Profile. Preserve original UI and require visual sign-off. | CONFIRMED preference; exact UI OPEN | NOT LIVE |
| RW-07 | Customers choose eligible food across participating shops within available reward credit. | CONFIRMED | NOT LIVE |
| RW-08 | The prior counts of 4 qualifying units, 20 ADDITIONAL to Gold, 40 ADDITIONAL to Platinum are only WORKING PROPOSALS after Bronze. The founder selected OTHER PROGRESSION when answering and focused on the credit concept, not confirming thresholds. | OPEN beyond initial 4 | NOT LIVE |
| RW-09 | Gold R125 and Platinum R200 are working example credit grants, not a finally approved advertised guarantee or spending commitment. | PROPOSED values | NOT LIVE |
| RW-10 | Platinum represents membership in the LocalEats community and the optional opportunity to APPLY for ambassador work. No guaranteed employment or bypass of fair hiring. | CONFIRMED direction | NOT LIVE |
| RW-11 | Merchant promotional PDF promotes LocalEats and the idea of a FREE KOTA, with app details for participating customers. Until real launch it states COMING SOON, never pretending the deal is active. | CONFIRMED direction | Existing teaser was reportedly merged; inspect before reuse |
| RW-12 | First-time guide after registration/login settles, dismissible and not interrupting checkout, with How Rewards Work accessible from Profile. | PROPOSED onboarding flow | NOT LIVE |
| RW-13 | Determine an AFFORDABLE programme budget before any offer goes live. | CONFIRMED intention, actual amount OPEN | NOT LIVE |
| RW-14 | Preserve all planning, app responsibilities, rules, risks, decisions and future handover instructions in ONE living GitHub document, including conflicts and change history. | CONFIRMED | THIS DOCUMENT |
| RW-15 | **OPTIONAL SPLIT PAYMENT**: if the eligible food bill exceeds available reward credit, customer can apply the remaining credit and pay the rest **directly at the physical shop** by cash or the shop's card terminal. No online payment. A fully covered eligible purchase never needs extra cash. | CONFIRMED 2026-11-08 | NOT LIVE |

**Important change to existing specifications:** The merged Super Admin Rewards R1 design in docs/LOCALEATS_REWARDS_R1_OWNER_FUNDED_SPEC_20261107.md and Merchant/API Rewards R2.1 offline domain model describe a higher-rank R125/R200 SINGLE FOOD BUNDLE. RW-05 now supersedes that **bundle-only reward format** as a BUSINESS PLAN. Their anti-fraud rules, one-time Bronze grant, budgeting, merchant confirmation and audit concepts still stand. Existing implementation HAS NOT yet been updated to spendable balance. Any agent who implements the old bundle format without asking is using outdated instructions.

## 5. Customer experience and explicit scenarios (design only)

Bronze: customer sees 0/4 qualifying kota units. Genuine paid-and-collected qualifying kota units count. After the first four, unlock ONE eligible free kota and progress to Silver; no repeating four-kota free gifts. The initial free item is an entitlement, not customer cash.

Silver: progress toward Gold under a threshold TO BE CONFIRMED; earlier idea was 20 MORE qualifying kota units after the first four. Rank remains permanent.

Gold: when the agreed milestone is reached, the customer receives an agreed amount of PROMOTIONAL FOOD CREDIT (working example R125). The header may show: LocalEats | Food Rewards R125. Member rank is Gold. Credit is not withdrawable cash.

**APPROVED split-payment example (business rule; NOT implemented):** A Gold customer has R125 credit. They buy R60 in eligible food from participating Shop A and complete verified pickup. LocalEats credit applied: R60. New balance: R65. LocalEats owes Shop A R60. Later they choose R100 eligible food at participating Shop B; apply remaining R65 credit and pay **R35 directly at Shop B** in cash or through Shop B's physical card terminal. Only after the authenticated merchant confirms actual R35 payment AND food handover does the server finalise a R65 promotional spend, set available credit to R0 and create a R65 LocalEats merchant reimbursement payable (NOT R100). Later orders are paid normally; GOLD rank remains permanent. This is a customer/merchant payment split, not in-app cash collection.

**No mandatory top-up:** A shopper can spend reward credit alone on eligible goods fully covered by that credit. The split-payment option is only used when the customer independently chooses eligible food costing more than their remaining credit; it must not become a forced extra purchase or minimum order. If the cash remainder cannot be paid, the server releases the temporary credit hold and no merchant reimbursement becomes due. A payment-collected flag or client screen alone is not proof of collection.

Platinum: after a higher milestone TO BE CONFIRMED (earlier proposal 40 more), grant an agreed additional food-credit entitlement (working example R200). Do not erase any unspent Gold balance on promotion. Whether multiple grants aggregate in one visible number, what is spent first and any expiry are OPEN.

**Qualifying earning rule to decide:** Should a mixed credit-plus-cash order count toward progress only for separate fully cash-paid kota units? Recommended initial protection: do not earn progress on promotional credit-funded units; no free kota should ever earn another free kota. Prevent fraud loops.

**Critical header truth:** If the real server cannot verify current credit, display a neutral unavailable/retry state, not R0 or an invented R125. A balance is not a LocalPay bank wallet; it is a restricted food-reward claim. Legal substance and obligations still need review.

## 6. Finance: how the new credit works behind the scenes

Separate records: (A) permanent rank and earned qualifying units, (B) customer earned and available food credit, (C) short-lived credit reservations for a legitimate pending pickup, (D) credit actually spent on verified fulfilled food, (E) merchant reimbursement owed, (F) owner external bank transfer recorded, (G) merchant receipt confirmed/disputed, (H) reversals and audit.

EARN: only the central API can establish qualifying paid-and-collected source evidence, eligibility, programme version and unique unit ID. Reserve enough budget before granting any binding future reward promise, and reject duplicate/replayed grants. Old test orders are excluded.

RESERVE: when the customer selects approved food at a participating shop, API calculates a time-limited reward hold, validates available balance, merchant eligibility, real menu item prices and the **optional split-payment remainder**. For a R100 eligible order and R65 verified credit, the quote clearly identifies R65 LocalEats-funded and R35 to be paid by the customer **at the shop**. The customer must accept the server-confirmed split before pickup. Cross-shop concurrent requests must never spend the same R65 twice. A failed order releases the reservation. Credit-only redemptions (no remainder) must remain possible for items the credit fully covers.

FULFIL: verified merchant must confirm **the customer paid the shop any cash/card-terminal remainder** AND the food was actually handed over. Server atomically moves only the reserved promotional portion to SPENT exactly once and creates an equal LocalEats merchant payable using the immutable checkout price snapshot. For the R100/R65/R35 example, the shop receives R35 from the customer and LocalEats owes the shop R65; do not create a R100 LocalEats payable or deduct R100 in credit. Cancellation, insufficient cash, shop closure, rejection or no handover releases any credit hold and creates NO payable. The UI can show a pending reservation but cannot call it settled/collected without server confirmation. All records must support idempotent retries and reconciliation after a network interruption.

REIMBURSE: Super Admin lists owed amounts by merchant and reward reference. LocalEats owner pays shop externally and records transaction reference/amount/date. Status then becomes PAYMENT SENT, AWAITING MERCHANT CONFIRMATION, never auto-settled. Correct authenticated merchant can confirm bank receipt or dispute; only confirmed receipt becomes SETTLED. Partial/batched payouts require immutable allocations and a dispute trail.

SUPPORT: refund/reversal, stock problems, merchant withdrawal, account recovery, outage after food delivery, duplicate request, fraud, tax and expired token scenarios require explicit handling before launch. All money in integer cents and ZAR; no negative balances, silent deletion, orphan payables, double reimbursement or impersonated owner.

No payment gateway, transfer-to-friends, cash withdrawal, unapproved voucher stacking or in-app wallet functionality should be introduced by this plan. Customer out-of-pocket **split payment at the shop** is allowed; it is not a promotional balance top-up and does not add cash into the Rewards account.

## 7. Cost realism and pilot affordability

At the working caps R25 once + R125 Gold credit + R200 Platinum credit, the maximum potential food reward per fully progressing customer is **R350** (if fully redeemed, no other rewards). This is the maximum cost exposure for those three rewards, not a production promise.

| Example admitted customers | Worst-case total rewards if ALL eventually earn all three |
| ---: | ---: |
| 1 | R350 |
| 2 | R700 |
| 3 | R1,050 |
| 5 | R1,750 |
| 10 | R3,500 |

Under the **unconfirmed** cumulative 4 + 20 + 40 = 64 qualifying units, if each qualifying kota hypothetically sells for R25, 64 x R25 = R1,600 in **MERCHANT SALES**. R350 reward spending is 21.875% of those merchant sales, but that is NOT revenue to LocalEats. The founder must not confuse GMV with platform profit. Shop subscriptions are not active during the initial three-month free period and cannot be assumed to fund rewards.

**Recommendation, NOT a budget approval:** Begin at R0 with synthetic Preview only. If the founder can safely reserve R500 for a future live pilot, that amount covers one potential R350 full-rank commitment and R150 remaining cushion, not unlimited full-rank promises. R700 would cover up to two full-rank commitments without extra contingency. If the founder cannot afford full-rank liabilities, design a clearly disclosed, separately funded BRONZE-ONLY pilot and do not imply that Gold/Platinum credit is guaranteed until a later programme version. Never withdraw already earned benefits without a fair, legally reviewed policy.

### Funding options — illustrative admissions, not authorisations

**Model A: Bronze-only (not Gold/Platinum guaranteed).** Reserve R25 per eligible admitted customer for the once-only first gift, with an illustrative separate **20% cash safety reserve**. Under a R250 total cash envelope, set aside R50 buffer and reserve at most R200 for **8** customers. Under a R500 envelope, keep R100 buffer and reserve at most R400 for **16** customers. These caps apply to admitted eligible customers whose promise could mature, NOT just rewards already redeemed. Communicate a limited Bronze programme/version clearly before earning starts. Do not quietly promise later Gold/Platinum money if not funded.

**Model B: Full rank ladder (only if final rewards stay R25 + R125 + R200).** Maximum possible commitment is R350 per participant; an illustrative 20% buffer is R70 more per participant. R500 can safely cover **1** complete participant at R350 plus R150 remaining; R1,000 covers **2** participants at R700, with R300 remaining. Ten full-ladder participants imply R3,500 potential rewards, and a 20% R700 contingency takes the planning envelope to R4,200. The 20% buffer is a **planning assumption**, not a law or proof of sufficiency; it cannot replace analysis of all expected claims or support costs.

**Campaign admission rule (proposal):** Do not advertise uncapped milestone credit to an unlimited base while reserving only for customers who have already unlocked it. An openly capped, funded pilot with a clear enrolment state, mutually agreed merchant participation, and a future version for higher ranks is safer. Reserve for all promised rewards up to the approved participant and amount caps. If budget is insufficient to admit a new user, don't promise them an entitlement; do not retroactively cancel a reward that has already been lawfully earned.

**Accounting separation:** (1) cash reserved against promised or already-earned unspent customer credit, (2) cash owed to shops for actual completed handovers, (3) bank transfers sent and awaiting merchant confirmation, (4) buffer for reversals/disputes. Those are NOT all incremental charges on top of the same credit: a funded commitment moves from outstanding customer benefit to merchant payable when redeemed. Track state transitions to avoid double-counting while making sure cash is available until shop reimbursement.

**Commercial challenge:** At launch, paid kota order totals generally go to shops. If LocalEats earns zero transaction fee, 32 hypothetical R25 kota purchases by eight customers produce R800 merchant sales but **R0 direct per-order LocalEats revenue** (before any future independently approved business model). Funding eight R25 first gifts costs up to R200 in LocalEats marketing expense, plus support and fraud risk. A good promotion may build retention and future merchant value, but it is not self-financing without independently proven incremental LocalEats income.

**ROI measurement proposal:** Record paid qualifying units attributable to the pilot, repeat purchase rate, net additional active customers, actual fully fulfilled credit cost, outstanding reward obligations, merchant reimbursement delay/disputes, customer support burden, and any actual LocalEats revenue. Do not assume growth from fake sign-ups, a scan count or gross merchant sales alone.

**Open budget inputs:** Actual money available AFTER essential expenses; proposed number of pilot customers and shops; item price distribution; reimbursement timing; merchant agreement; whether capacity is invitation-based or capped; fraud/support reserve; and what legal/consumer remedy applies when funding runs low. Do not enroll unlimited participants and hope later subscriptions pay for promised food.

## 8. App-by-app intended functionality (not activated)

| Surface | Proposed future behavior | Guardrail |
| --- | --- | --- |
| Customer Home header | Small available Food Rewards amount beside LocalEats logo, only from verified central API | No fake cash balance, no unapproved header redesign |
| Customer Profile | Permanent rank, current-stage units, earned free kota, actual food-credit balance, history and plain-language rules | No user-editable loyaltyPoints authority |
| Customer Menu/Cart | Eligible items, true server quote, credit amount offered, customer pay-at-shop remainder, one-time pickup hold | No gateway, no offline/client-confirmed credit deduction |
| Merchant Orders | Verify reward reservation, customer remainder, real collection and handover | Merchant cannot mint reward or payable |
| Merchant Payments | View accurate owed, sent, confirmed or disputed merchant reimbursements | Old localStorage COD toggles are not bank receipt evidence |
| Merchant Marketing PDF | LocalEats-centred FREE KOTA interest with honest Coming Soon until activated | Disclose essential terms on public offer, not just hidden after signup |
| Super Admin Rewards | Programme versions, participating shops, budget admission, all unused credit liabilities, fulfilments, debts, transfer refs, confirmations, disputes, audit | No non-admin edits or fake settled states |
| Super Admin Ambassadors | Platinum customers may opt in and apply for genuine future community work | No automatic hiring or paid job promise |
| Onboarding | Once per version, after login/guide settles; dismissible and accessible later | Never interrupt live checkout |

## 9. Marketing ethics, laws and customer trust

**Campaign message before launch:** "A FREE KOTA? — COMING SOON. Discover your local favourites with LocalEats. Rewards are not yet active." The real flyer should promote LocalEats first, and any merchant as an optional participating shop/QR location. No fake scarcity, fake beneficiaries or hidden admission requirements.

**If eventually live:** state a truthful, funded eligibility offer such as "Buy four qualifying kotas and unlock one eligible free kota at participating LocalEats shops." Important conditions must appear in the offer, with a clear path to full terms. Do NOT pretend customers can earn a free kota merely by signing up or scanning a QR.

South Africa's Consumer Protection Act 68 of 2008, section 35 governs loyalty credits and awards, their offer terms and fulfilment: https://www.gov.za/sites/default/files/32186_467.pdf and https://api.acts.co.za/consumer-protection-act-2008/35_customer_loyalty_programmes.php. The legal meaning depends on the substance, not the label "food credit" versus "wallet". Get qualified advice on credit expiry, programme availability, refunds, merchant tax/VAT, POPIA and any recruitment implications before publication. This document is not legal advice.

## 10. Known implementation history (not proof of live Rewards)

- Super Admin Rewards R1 **design spec** merged in PR #3: https://github.com/mehey9184-maker/Super-LocalAdmin/pull/3. File docs/LOCALEATS_REWARDS_R1_OWNER_FUNDED_SPEC_20261107.md retains old single-bundle higher-tier proposal; see RW-05 above for supersession.
- Merchant Marketing "A FREE KOTA? — COMING SOON" teaser reportedly merged via PR #95: https://github.com/mehey9184-maker/LocalEats-Dashboard.2/pull/95. Actual printed/rendered PDF still needs visual review and truthful current copy.
- Existing Merchant/API R2.1 offline synthetic rewards model: localeats-api/src/rewards/README.md and corresponding tests; NOT a live server-authoritative balance and still based on single redemption bundles.
- Customer loyaltyPoints type exists; it is NOT a trusted live Rewards credit balance.
- Launch issue #73 tracks production security/ordering blockers: https://github.com/mehey9184-maker/LocalEats-Dashboard.2/issues/73. Merchant/API draft R4.2 PR #121, R4.3 PR #122 and R4.4 PR #123 were left draft/unmerged. Synthetic CI success does not certify actual database policy remediation, Firebase device delivery, hosted staging or real orders.
- This master-plan file is documentation-only, proposed through a new draft PR based on main; it has no code, migration, real reward event, merchant balance or Production activation.

## 11. Phases for the current Rewards-first discussion

| Phase | Work | Mandatory gate |
| --- | --- | --- |
| RM-1 | Agree on Gold/Platinum milestone counts, final credit values, eligible food items, rollover and expiry; split tender is CONFIRMED | Founder updates CONFIRMED decisions in this master file |
| RM-2 | Establish affordable budget and expected business return, participant cap, shop opt-in and reimbursement timetable | Founder confirms actual cash exposure separately |
| RM-3 | Design versioned, server-owned immutable credit grants, reserve/spend, merchant payable, refund and payout models | Security/reconciliation review only |
| RM-4 | Run synthetic multi-merchant PostgreSQL/Firebase tests for concurrency, replay, loss, fraud, budgets, partial payments | Exact-commit passing tests and owner review |
| RM-5 | Prepare Customer header/Profile/cart, Merchant Orders/Payments/PDF, Super Admin Rewards previews | Preserve original UX, manual owner visual sign-off |
| RM-6 | Review commercial terms, genuine separate staging, accounting, backups and real-device tests | Separate approval; no implied Production launch |
| RM-7 | Small capped pilot only after core pickup launch is safe, funded, legal terms and merchant participation are settled | Explicit owner activation decision |
| RM-8 | Resume initial Customer + Merchant + API + Super Admin launch-security and merge-readiness tasks | No automatic merge or live payments/orders |

## 12. Questions nobody should silently decide

| Ref | Open business decision |
| --- | --- |
| Q1 | Gold threshold: 20 additional qualifying kotas, 20 lifetime, or different? Platinum threshold: 40 additional, 40 lifetime, or another progression? |
| Q2 | Exact Gold and Platinum credit grant amounts: R125/R200 or other funded amounts? |
| Q3 | **RESOLVED 2026-11-08:** optional split payment APPROVED: use R65 credit, pay R35 at shop, handover required before spending credit. No forced top-up. Remaining open: detailed payment confirmation and dispute user experience. |
| Q4 | Eligibility: all foods, only approved menu foods, drinks/extras? Does a partially credit-funded kota count toward rank? |
| Q5 | When Platinum is reached, do leftover Gold credits remain and combine into the displayed available total? Any expiry and minimum-term promises? |
| Q6 | What actual pilot budget is affordable? How many people can be admitted without financial overpromise? |
| Q7 | Which merchants opt in, and when must LocalEats reimburse them? What if merchant exits/disputes? |
| Q8 | Timing of guide, UI placement, accessible user terms, PDF copy and precise campaign rollout date? |
| Q9 | Customer return, partially fulfilled order, refunds, tax, merchant fraud/charge disputes and recruitment privacy safeguards? |

## 13. How to keep this project memory current

Every time the founder accepts a meaningful change, the assistant must update Section 4, Section 12, and the append-only Section 14 Decision Log ON THE SAME DRAFT BRANCH/PR, with a date, exact decision, old rule superseded, affected app, and current implementation status. Source implementation and doc status are different. When real code changes, update its relevant repository AGENTS and local documentation links and verify tests. Do not copy divergent master docs into other repos: use pointer links instead.

For an AI/developer handover, the founder can send:

> "Go to my GitHub repo mehey9184-maker/LocalEats-Dashboard.2 and read LOCAL_EATS_MASTER_PLAN.md (or its open draft PR if not merged), then read each app's AGENTS and current source. Summarize confirmed decisions, open issues, security rules, work already verified, and next safe step. Respect pickup-only and do not merge or change Production without me."

## 14. Append-only decision log

| Date | Ref | What changed | Decision status | Implementation note |
| --- | --- | --- | --- | --- |
| 2026-11-07 | Prior R1 | Bronze one free kota; Silver/Gold proposed single food bundles; LocalEats reimburses after merchant handover; Platinum can apply for ambassador opportunities. | Historical design | Super Admin PR #3; Merchant teaser PR #95 |
| 2026-11-08 | RW-01 | Free kota once after first four paid qualifying kotas, never every four again. | CONFIRMED | No live activation |
| 2026-11-08 | RW-03 | Reward can be redeemed at any participating LocalEats shop. | CONFIRMED | Future cross-shop settlement needed |
| 2026-11-08 | RW-05 | Gold/Platinum higher-tier benefits are SPENDABLE FOOD CREDIT across purchases, not single fixed bundles. | CONFIRMED DIRECTION | Earlier bundle-only format SUPERSEDED; model not yet changed |
| 2026-11-08 | RW-06 | Available reward credit near LocalEats logo; rank/historical details in Profile. | CONFIRMED PREFERENCE | Original UI preserved until preview reviewed |
| 2026-11-08 | RW-08 / RW-09 | Thresholds beyond four and exact example R125/R200 credit values remain open. | OPEN | No public promise |
| 2026-11-08 | RW-13 | Founder wants one persistent GitHub Master Plan for personal recall and successor AI/developer handover. | CONFIRMED | This draft, not yet merged |
| 2026-11-08 | RW-15 | Customer can apply earned credit to eligible food and pay any remainder **at the physical shop**; e.g. R100 order = R65 LocalEats promo + R35 customer cash/card-terminal. Full-credit purchases must not require extra cash; grant/spend, shop handover and merchant debt require trusted server confirmation. | CONFIRMED | Design documented; zero route/UI/DB activation |
