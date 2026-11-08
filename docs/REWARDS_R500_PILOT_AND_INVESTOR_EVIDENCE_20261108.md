# LocalEats Rewards — R500 pilot and investor-demand evidence plan

**Draft strategy, 8 November 2026. No live campaign, trial billing, real-data writes, rewards earning or merchant reimbursement.**
Source of approved founder intent: repository root **LOCAL_EATS_MASTER_PLAN.md**, draft PR #124.

## 1. Owner decisions versus open launch choices

**CONFIRMED:** R500 maximum promotion envelope; one eligible free kota ONCE per customer after FOUR verified paid-and-collected qualifying kota units, INCLUDING four in a SINGLE legitimate order on ONE day (no extra two-visit rule); Gold promotional food-credit amount R80 and Platinum R150 as intended future full-ladder benefits; credit redeemable at any participating shop, with customer allowed to pay any remainder directly at the shop; customer keeps rank permanently; LocalEats reimburses confirmed reward handover merchants. Founder wants verified repeat paying customers as investor evidence, not inflated registration counts.

**CONFIRMED merchant policy direction:** new shops receive one calendar month of trial starting after shop approval and genuine trading; planned Super Admin-only +1 Month Free button subject to backend authority and separate release. Current 30-day frontend approximation is not trustworthy. Do not automatically charge any shop.

**CONFIRMED pilot design (NOT LIVE):** 12 capped eligible customers for the R500 Bronze-only pilot: reserve up to R300 (12 x R25) for one initial gift each and leave R200 cash buffer. The first four purchased qualifying kota units may be bought all in one legitimate paid-and-collected order; future mission details are introduced progressively only when commercially active. **OPEN:** actual cash ring-fencing, pilot dates and participating merchants, future Gold/Platinum thresholds, eligible item list, customer terms/cancellation/refund, exact merchant trial start event, extension limit and billing terms. No unrestricted customer enrolment or public Gold/Platinum monetary promise.

## R4 — LocalPay branding and financial-security model (not live)

**Owner choice on 8 November 2026:** The founder wants future restricted earned eligible food credit known as **LocalPay**, with a long-term possibility of an independent company. The working description is **LocalPay Rewards — eligible food credit**, NOT a consumer bank account, unrestricted stored cash, cryptocurrency, customer-funded electronic wallet or existing LocalPay legal entity. Multiple unrelated firms already use LocalPay as a brand outside South Africa; trademark/company-name clearance through CIPC and qualified SARB/consumer-law advice are REQUIRED before public brand launch or real payment service. LocalEats alone remains the intended reward sponsor/merchant reimbursement obligor until an explicitly authorised legal restructuring.

**Financial segregation:** the R500 maximum campaign budget is only a planning cap and is NOT bank proof. Admit no more than 12 eligible genuine Bronze customers and only once verifiable owner-backed cash is appropriately reserved. Reserve up to R25 face value per admitted person = **R300 full potential commitment**; preserve **R200** outside promises as an operational buffer, not a covert Gold fund. No Gold R80 or Platinum R150 granted, accrued or promised under this Bronze-only campaign, even if ordinary purchase statistics would pass +20 or +30 thresholds.

**No double counting:** the accounting transitions from participant reserved commitment → legitimately earned Bronze gift/customer available entitlement → successful collected-food redemption → merchant payable → actual bank transfer/merchant acknowledgement (or a documented dispute). A fulfilled reward creates an amount LocalEats owes the shop **instead of** a still-unused customer gift, not a duplicate R25 expense; the bank payment removes merchant payable and funded cash. Every transition must be uniquely referenced, server-authoritative, idempotent, journalled in integer cents and auditable.

**Customer/shop proof:** Genuine order ownership, merchant-confirmed pay-at-shop and food handover plus safe corroborating customer pickup confirmation; no fake checkout, unpaid/uncollected/free/refunded orders, replayed orders, guest scams, shop self-minting or unsupported 'Paid' UI. Support partial future LocalPay Rewards credit with physical shop cash/card remainder; no online money collection. Keep all live APIs and Production untouched.

**Full detailed R4 design:** [R4 LocalPay Rewards finance, settlement and separate-company safeguards](R4_LOCALPAY_REWARDS_FINANCIAL_SECURITY_AND_FUTURE_COMPANY_20261108.md) and canonical root Master Plan LP-01 / LP-02. Before implementation: actual funding bank proof, shop agreements, local legal review, synthetic adversarial + race tests, truthful Preview UX, explicit separate owner pilot/credit launch authorisation. Rewards cannot proceed solely because subscription invoices are forecast or investment is expected.

## 2. Owner-accepted 12-person R500 Bronze pilot design — NOT approved to activate

| Reserve | Amount | Purpose |
| --- | ---: | --- |
| Maximum eligible Bronze gifts | R300 (12 × R25) | One gift each, even if not yet earned |
| Remaining risk/operational reserve | R200 | Buffer; not promised as additional prizes |
| **Overall planned ceiling** | **R500** | Stop new admissions before maximum promised liability exceeds funded amount |

The founder has approved the **12-person structure as a planning decision**, not a real launch or expenditure. An alternative 16-person arrangement would reserve R400 and leave R100, but is NOT the chosen current design. Full-ladder exposure of R25 + R80 + R150 = R255 for ONE customer. TWO full-ladder customers = R510, already R10 over the total R500; therefore do not advertise unlimited higher-level credit for the pilot. A versioned Bronze-only programme can have permanent future rank plans while stating clearly that R80/R150 credit is not earned under the initial pilot offer. Never revoke actually promised rewards to solve a budget shortage.

Do not release any active campaign until actual cash is ring-fenced and merchant opt-in, reimbursement timeline, consumer-law disclosures, accurate account/checkout states, pickup safety and legal terms have passed review.

## 3. Suggested phased pilot after separate activation approval

**Before recruitment:** verify exact pilot staging and Production boundaries; fix live order security and merchant receipt; obtain voluntary participation from a small local group of real shops. Publish eligibility, reward cap, merchant participation, start/end dates and privacy terms. Do not claim free food is active on the existing Coming Soon flyer.

**Recruitment (owner-accepted plan, 12 participants):** transparent, limited enrolment of up to 12 genuine customers only after funded launch approval. Do not offer employer/staff/test accounts, old test orders or hidden invitations as normal customer demand. Record incentive exposure in advance. Obtain lawful basis for analytics and report aggregate outcomes.

**Observation:** the founder REVERSED the forced two-date/visit requirement due to customer-trust risk. Bronze eligibility requires FOUR verified paid-and-collected eligible purchased kota UNITS, potentially all in ONE real order on ONE date; grant the initial free-kota entitlement ONCE per eligible customer. Examples: 4 purchased and collected Monday = qualifies; 3 on Monday + 1 Thursday = qualifies; an unpaid order or reward-only fulfilment = does not qualify. Do not add a second-day gate or fake a second paid visit. Count bona fide order IDs, server-verified payment and collection, prevent replays and apply refund reversals. For investor evidence, INDEPENDENTLY measure whether each user makes a SECOND genuine PAID pickup order after their first purchase, and especially whether they RETURN PAYING after receiving their first free kota. A free-kota redemption is not a paying return. Follow genuine paid customers for full 30-day windows before claiming retention. Future Gold/Platinum missions can invite return visits only if their terms and benefit are funded, disclosed and approved before qualifying purchases.

**After rewards:** track whether customers return for a second independent PAID pickup after the first gift has been redeemed and no further credit was used. This is stronger evidence of product utility than a no-charge redemption.

**Investor follow-up:** after sufficient mature cohorts, summarise customer first-to-second paid visit retention, unique paid repeaters, order completion reliability, merchant continuation, real promotion expense and merchant gross sales distinctly from any REAL LocalEats revenue. Do not extrapolate a tiny invited pilot into proven national demand; show sample size and uncertainty.

## 4. Evidence dashboard definitions — recommended

| Metric | Trustworthy definition |
| --- | --- |
| Real paid customers | Distinct authenticated external customers with ≥1 server-confirmed paid-and-collected pickup (exclude mocks, staff/test and reward-only pickups) |
| 30-day paid repeat rate | Among customers with first genuine paid pickup ≥30 days ago, percentage with another separate genuine paid-and-collected order on a different date within 30 days |
| Paid return after reward | Distinct eligible customers who made a further fully customer-funded qualifying pickup after their first reward handover, divided by eligible reward recipients with a mature 30-day post-redemption observation window |
| Merchant utilisation | Number of participating independently owned shops fulfilling true external paid pickup orders, by week |
| True fulfilment rate | Paid-and-collected real orders divided by eligible submitted live orders; separately report cancelled/refunded/failed handovers |
| Promo food cost | Actual LocalEats-funded eligible item value fulfilled and owed/paid to merchants; show unspent entitlements separately |
| Reward cost per paid repeater | Actual fulfilled promotional cost / distinct observed returning PAYING customers. If denominator is 0, show N/A; include pilot size |
| LocalEats income | Only real recognised platform fees and/or paid merchant subscriptions (if separately activated), **not merchant food sales/GMV**, predicted dues or reward credit |
| Retention by cohort | Week of first genuine paid pickup, with separate observed 30- and 60-day repeat purchase rates where complete |
| Incentive-dependence | Separate fully paid visits, mixed-credit+customer cash visits and reward-only handovers; label aggregate outcomes as incentivised when appropriate |

**Latest founder trust-first correction on 8 November 2026 SUPERSEDES the earlier same-day restriction:** one genuine paid-and-collected order containing four eligible purchased kota units is sufficient to earn the one-time first free kota. The goal of return behaviour is pursued through voluntarily engaging next missions and a good pickup experience, NOT by imposing an unexpected multi-visit condition. Never count that one basket as four separate visits, gift handover as an organically paid order, or simulated/duplicate/refunded orders as customer demand. Separately measure actual first-to-second PAID purchase conversion and **customer-funded returns after the gift**. The next Gold mission and any future prize must be clearly described and funded by the time it is offered; Bronze-only pilot must not tease guaranteed unfunded R80 or R150 credit.

## 5. Investor presentation template (fill with actual verified data, never invented numbers)

- **Pilot scope:** real start date, duration, geographies, participating merchant count, number of invited/admitted customers, promotion wording and max funding exposure.
- **Demand:** genuine paid customers and orders, completed pickup rate, first-to-second paid order conversion, 30/60-day cohorts, return after reward use.
- **Cost:** spent Rewards cash, still-owed merchant reimbursements, outstanding promised credit, actual LocalEats income and infrastructure/support costs separately.
- **Merchant side:** shops that fulfilled and continued using LocalEats, time to first real order, reason for any shop loss; clearly report one-month trial and admin-granted extra months as FREE (not paid MRR).
- **Limitations:** selection bias from invited users, small sample size, food incentives, location concentration, incomplete observation and unresolved public-launch blockers.
- **Next funded experiment:** what behaviour must improve before expanding enrolment or offering R80/R150, and what additional cost that would require.

Reference for cohort logic: Y Combinator Startup Library, Analytics for Startups, https://www.ycombinator.com/library/8H-analytics-for-startups. Applicable South African consumer law: Consumer Protection Act 68 of 2008 (particularly loyalty-programme terms), https://www.gov.za/documents/consumer-protection-act.

## 6. No-live-activity approval gate

This plan changes no runtime API, client, database table, private merchant data, Finance controls or subscription trial. Until the owner separately approves a funded campaign AFTER reliable core pickup, keep Rewards and subscriptions disabled and merchant marketing labelled Coming Soon. Code/test acceptance must explicitly protect real pickup price, stock, customer identity, merchant payment-at-shop handover, one-time grants, budget admission, multi-shop credit holds, financial ledger truth, merchant reimbursement, refund/dispute scenarios and loss of network response.
