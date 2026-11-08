# LocalEats Rewards — R500 pilot and investor-demand evidence plan

**Draft strategy, 8 November 2026. No live campaign, trial billing, real-data writes, rewards earning or merchant reimbursement.**
Source of approved founder intent: repository root **LOCAL_EATS_MASTER_PLAN.md**, draft PR #124.

## 1. Owner decisions versus open launch choices

**CONFIRMED:** R500 maximum promotion envelope; one eligible free kota after first four qualifying paid-collected kota units, ONCE per customer; Gold promotional food-credit amount R80 and Platinum R150 as intended future full-ladder benefits; credit redeemable at any participating shop, with customer allowed to pay any remainder directly at the shop; customer keeps rank permanently; LocalEats reimburses confirmed reward handover merchants. Founder wants verified repeat paying customers as investor evidence, not inflated registration counts.

**CONFIRMED merchant policy direction:** new shops receive one calendar month of trial starting after shop approval and genuine trading; planned Super Admin-only +1 Month Free button subject to backend authority and separate release. Current 30-day frontend approximation is not trustworthy. Do not automatically charge any shop.

**OPEN:** whether pilot launches only the first free-kota reward or promises all stages; exact admitted customer count; whether four kota units must be spread across at least two distinct visits; Gold/Platinum thresholds; eligible item and merchant list; customer terms/cancellation/refund; exact shop trial start event, number of allowed free-month extensions and billing terms; cash actually reserved. No unrestricted customer enrolment or public Gold/Platinum promise.

## 2. Candidate R500 pilot budget — not yet approved to activate

| Reserve | Amount | Purpose |
| --- | ---: | --- |
| Maximum eligible Bronze gifts | R300 (12 × R25) | One gift each, even if not yet earned |
| Remaining risk/operational reserve | R200 | Buffer; not promised as additional prizes |
| **Overall planned ceiling** | **R500** | Stop new admissions before maximum promised liability exceeds funded amount |

Alternative: 16 Bronze participants, R400 reserved gifts and R100 buffer. This leaves less flexibility. Full-ladder exposure of R25 + R80 + R150 = R255 for ONE customer. TWO full-ladder customers = R510, already R10 over the total R500; therefore do not advertise unlimited higher-level credit for the pilot. A versioned Bronze-only programme can have permanent future rank plans while stating clearly that R80/R150 credit is not earned under the initial pilot offer. Never revoke actually promised rewards to solve a budget shortage.

Do not release any active campaign until actual cash is ring-fenced and merchant opt-in, reimbursement timeline, consumer-law disclosures, accurate account/checkout states, pickup safety and legal terms have passed review.

## 3. Suggested phased pilot after separate activation approval

**Before recruitment:** verify exact pilot staging and Production boundaries; fix live order security and merchant receipt; obtain voluntary participation from a small local group of real shops. Publish eligibility, reward cap, merchant participation, start/end dates and privacy terms. Do not claim free food is active on the existing Coming Soon flyer.

**Recruitment (example 12 participants):** transparent, limited enrolment of 12 genuine customers. Do not offer employer/staff/test accounts, old test orders or hidden invitations as normal customer demand. Record incentive exposure in advance. Obtain lawful basis for analytics and report aggregate outcomes.

**Observation:** customers make normal paid-at-shop pickup orders. Follow each first-time paid customer for a full 30 days; do not count users whose observation window is incomplete as failed returners. Check paid-and-collected order proofs, actual unique orders, different real trading days, genuine merchant shop fulfilment and whether later orders were customer-funded.

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

Do not silently label four kota UNITS in one basket as four repeat purchases. Existing four-unit milestone is confirmed, but a founder proposal for ≥2 real visits is OPEN. A customer can qualify under the old unit-only rule without independently returning, so data collection must measure separate visits whatever qualification rule is eventually approved.

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
