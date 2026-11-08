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
| RW-01 | First free eligible kota (standard kota at approved price up to R25, or one eligible other food item strictly below R25) is earned **ONCE per eligible customer** after **FOUR qualifying PAID-AND-COLLECTED kota UNITS**, which may all come from **ONE genuine order on ONE day**. No forced multi-day or two-order gate. Server-trusted collected purchase evidence and programme funding are required; free/simulated/refunded units do not count. | CONFIRMED founder correction 2026-11-08, supersedes RW-16 | NOT LIVE |
| RW-02 | Permanent ranks are Bronze, Silver, Gold, Platinum. Highest earned rank stays permanently, even when available food credit is R0. | CONFIRMED | NOT LIVE |
| RW-03 | Customers can redeem eligible Rewards at ANY PARTICIPATING LocalEats shop, not only the shop where they earned units. | CONFIRMED | NOT LIVE |
| RW-04 | LocalEats funds rewards. After verified food handover a merchant payable appears in Super Admin; owner records manual bank payment; verified merchant confirms receipt or disputes. | CONFIRMED | NOT LIVE |
| RW-05 | Gold and Platinum benefits should be SPENDABLE PROMOTIONAL FOOD CREDIT, usable across multiple eligible purchases until the available amount is exhausted. Not a compulsory single food bundle. | CONFIRMED product direction | NOT LIVE |
| RW-06 | Put the available credit amount near the LocalEats header logo, with rank, progress and history in Profile. Preserve original UI and require visual sign-off. | CONFIRMED preference; exact UI OPEN | NOT LIVE |
| RW-07 | Customers choose eligible food across participating shops within available reward credit. | CONFIRMED | NOT LIVE |
| RW-08 | The prior counts of 4 qualifying units, 20 ADDITIONAL to Gold, 40 ADDITIONAL to Platinum are only WORKING PROPOSALS after Bronze. The founder selected OTHER PROGRESSION when answering and focused on the credit concept, not confirming thresholds. | OPEN beyond initial 4 | NOT LIVE |
| RW-09 | Future full-ladder **Gold R80** and **Platinum R150** spendable eligible promotional food-credit values remain the owner's intended amounts; actual claims arise ONLY under an enrolled, funded, published programme version that clearly states thresholds, terms and shops BEFORE its respective mission requires qualifying purchases. The Bronze-only pilot does NOT offer these higher-tier credits. Previous R125/R200 values SUPERSEDED. | CONFIRMED planned amounts; future offer funding/eligibility OPEN | NOT LIVE |
| RW-10 | Platinum represents membership in the LocalEats community and the optional opportunity to APPLY for ambassador work. No guaranteed employment or bypass of fair hiring. | CONFIRMED direction | NOT LIVE |
| RW-11 | Merchant promotional PDF promotes LocalEats and the idea of a FREE KOTA, with app details for participating customers. Until real launch it states COMING SOON, never pretending the deal is active. | CONFIRMED direction | Existing teaser was reportedly merged; inspect before reuse |
| RW-12 | First-time guide after registration/login settles, dismissible and not interrupting checkout, with How Rewards Work accessible from Profile. | PROPOSED onboarding flow | NOT LIVE |
| RW-13 | Owner chose a **maximum pilot promotion budget of R500**. This is an authorised PLANNING CEILING, not evidence that cash is already deposited or permission to publish claims. No reward liability may exceed available ring-fenced funding. | CONFIRMED budget ceiling 2026-11-08 | NOT LIVE |
| RW-14 | Preserve all planning, app responsibilities, rules, risks, decisions and future handover instructions in ONE living GitHub document, including conflicts and change history. | CONFIRMED | THIS DOCUMENT |
| RW-15 | **OPTIONAL SPLIT PAYMENT**: if the eligible food bill exceeds available reward credit, customer can apply the remaining credit and pay the rest **directly at the physical shop** by cash or the shop's card terminal. No online payment. A fully covered eligible purchase never needs extra cash. | CONFIRMED 2026-11-08 | NOT LIVE |
| RW-16 | The previous rule required 4 qualifying kota units across 2 distinct paid-and-collected pickup dates. **Founder REVERSED this rule on 2026-11-08** after recognising it could feel manipulative. **This two-day gate must NEVER be implemented as the current policy.** See RW-01. | SUPERSEDED historical decision | NOT LIVE |
| RW-17 | **Progressive mission reveal:** Customer sees clear **Bronze Mission 1** (4 eligible purchased kota units -> one free kota). After it is truly completed and Silver is granted, the app can introduce the next Gold mission. Platinum's next mission may be introduced later when Gold is reached. Future locked missions may show intriguing themes but must not disclose a false/unsupported active offer. **Before a customer must spend to qualify for any mission, show its true reward, eligibility, conditions, availability and redemption details.** The programme must not hide material terms. | CONFIRMED progressive-unlock direction 2026-11-08; legal/UX implementation controls apply | NOT LIVE |
| RW-18 | The first capped **R500, 12-customer, Bronze-only pilot** is the owner's accepted planning structure: at most 12 admitted eligible customers x R25 maximum gift (R300 potential exposure), keeping R200 uncommitted as buffer. This DOES NOT approve actual enrolment, spending, merchant commitments or Production activation. No Gold/Platinum cash reward promise under this pilot version. | CONFIRMED pilot planning structure 2026-11-08 | NOT LIVE |
| MC-01 | For **new merchants under the new offer**, change the default promotional subscription free trial from **three months to ONE calendar month**. Keep the previously agreed start gate: shop APPROVED and actually begins genuine trading, not registration/testing. Existing promised terms must be honoured until lawfully amended; no billing is yet authorised. | CONFIRMED business-direction 2026-11-08; start/transition rules pending technical review | NOT LIVE |
| MC-02 | Add a **Super Admin-only +1 Month Free** extension action for an identified eligible merchant shop. It must add one calendar month to the server-authoritative trial end, require explicit confirmation and a logged reason, show new end date, and keep a complete append-only audit. Merchant can view the new end date; cannot grant it. The owner's policy for multiple extensions and exact placement remains OPEN. | CONFIRMED desired capability 2026-11-08; security/UI specifics PROPOSED | NOT IMPLEMENTED |
| IV-01 | Measure actual REPEAT paying customers, independent return visits, fulfilment and unsubsidised retention for future investor discussions. Never describe gifted food or merchant gross sales as LocalEats revenue or organic demand. | CONFIRMED objective; metrics PROPOSED | NOT IMPLEMENTED |

**Important change to existing specifications:** The merged Super Admin Rewards R1 design in docs/LOCALEATS_REWARDS_R1_OWNER_FUNDED_SPEC_20261107.md and Merchant/API Rewards R2.1 offline domain model describe a higher-rank R125/R200 SINGLE FOOD BUNDLE. RW-05 now supersedes that **bundle-only reward format** as a BUSINESS PLAN. Their anti-fraud rules, one-time Bronze grant, budgeting, merchant confirmation and audit concepts still stand. Existing implementation HAS NOT yet been updated to spendable balance. Any agent who implements the old bundle format without asking is using outdated instructions.

## 5. Customer experience and explicit scenarios (design only)

Bronze MISSION 1: customer sees a straightforward `0/4 qualifying kotas` unit tracker with **NO additional visit or day requirements**. Four eligible kota units in one genuinely paid-and-collected pickup order are sufficient to earn the one-time eligible free-kota entitlement and advance to Silver. Examples: `4 kotas purchased in one order Monday` = YES, `3 Monday + 1 Thursday` = YES, `2 Monday + 2 Monday` = YES once both are paid-and-collected, `4 kotas in unpaid/cancelled/simulated order` = NO. The first gift entitlement is NOT a fifth free line automatically created in the original sale: it is granted after trusted purchase completion and redeemed later according to clearly published terms, including at the same participating shop/date if eligible. Count paid qualifying UNITS, not orders; gift-funded, refunded and replayed units earn nothing. Rank never advances from an unverified client-side status. Free kota only once per customer across all participating shops/devices.

Silver: progress toward Gold under a threshold TO BE CONFIRMED; earlier idea was 20 MORE qualifying kota units after the first four. Rank remains permanent.

Gold: when the agreed milestone is reached and the customer is enrolled under an actually funded and published offer, the planned benefit is **R80** of PROMOTIONAL FOOD CREDIT. The header may show: LocalEats | Food Rewards R80. Member rank is Gold. Credit is not withdrawable cash. The exact qualifying-unit threshold for Gold is still OPEN.

**APPROVED split-payment example (business rule; NOT implemented):** A Gold customer begins with **R80** credit. They buy **R15** in eligible food from participating Shop A and complete verified pickup. LocalEats credit applied: R15. New balance: R65. LocalEats owes Shop A R15. Later they choose R100 eligible food at participating Shop B; apply remaining R65 credit and pay **R35 directly at Shop B** in cash or through Shop B's physical card terminal. Only after the authenticated merchant confirms actual R35 payment AND food handover does the server finalise a R65 promotional spend, set available credit to R0 and create a R65 LocalEats merchant reimbursement payable (NOT R100). Later orders are paid normally; GOLD rank remains permanent. This example assumes the shops actually offer approved items at those prices and the founder has funded the programme. This is a customer/merchant payment split, not in-app cash collection.

**No mandatory top-up:** A shopper can spend reward credit alone on eligible goods fully covered by that credit. The split-payment option is only used when the customer independently chooses eligible food costing more than their remaining credit; it must not become a forced extra purchase or minimum order. If the cash remainder cannot be paid, the server releases the temporary credit hold and no merchant reimbursement becomes due. A payment-collected flag or client screen alone is not proof of collection.

Platinum: after a higher milestone TO BE CONFIRMED (earlier proposal 40 more), grant an additional **R150** of food-credit entitlement only under a fully funded, published programme version. Do not erase any unspent Gold balance on promotion. Whether multiple grants aggregate in one visible number, what is spent first and any expiry are OPEN.

**Qualifying earning rule to decide:** Should a mixed credit-plus-cash order count toward progress only for separate fully cash-paid kota units? Recommended initial protection: do not earn progress on promotional credit-funded units; no free kota should ever earn another free kota. Prevent fraud loops.

**Critical header truth:** If the real server cannot verify current credit, display a neutral unavailable/retry state, not R0 or an invented R80. A balance is not a LocalPay bank wallet; it is a restricted food-reward claim. Legal substance and obligations still need review.

## 6. Finance: how the new credit works behind the scenes

Separate records: (A) permanent rank and earned qualifying units, (B) customer earned and available food credit, (C) short-lived credit reservations for a legitimate pending pickup, (D) credit actually spent on verified fulfilled food, (E) merchant reimbursement owed, (F) owner external bank transfer recorded, (G) merchant receipt confirmed/disputed, (H) reversals and audit.

EARN: only the central API can establish qualifying paid-and-collected source evidence, eligibility, programme version and unique unit ID. Reserve enough budget before granting any binding future reward promise, and reject duplicate/replayed grants. Old test orders are excluded.

RESERVE: when the customer selects approved food at a participating shop, API calculates a time-limited reward hold, validates available balance, merchant eligibility, real menu item prices and the **optional split-payment remainder**. For a R100 eligible order and R65 verified credit, the quote clearly identifies R65 LocalEats-funded and R35 to be paid by the customer **at the shop**. The customer must accept the server-confirmed split before pickup. Cross-shop concurrent requests must never spend the same R65 twice. A failed order releases the reservation. Credit-only redemptions (no remainder) must remain possible for items the credit fully covers.

FULFIL: verified merchant must confirm **the customer paid the shop any cash/card-terminal remainder** AND the food was actually handed over. Server atomically moves only the reserved promotional portion to SPENT exactly once and creates an equal LocalEats merchant payable using the immutable checkout price snapshot. For the R100/R65/R35 example, the shop receives R35 from the customer and LocalEats owes the shop R65; do not create a R100 LocalEats payable or deduct R100 in credit. Cancellation, insufficient cash, shop closure, rejection or no handover releases any credit hold and creates NO payable. The UI can show a pending reservation but cannot call it settled/collected without server confirmation. All records must support idempotent retries and reconciliation after a network interruption.

REIMBURSE: Super Admin lists owed amounts by merchant and reward reference. LocalEats owner pays shop externally and records transaction reference/amount/date. Status then becomes PAYMENT SENT, AWAITING MERCHANT CONFIRMATION, never auto-settled. Correct authenticated merchant can confirm bank receipt or dispute; only confirmed receipt becomes SETTLED. Partial/batched payouts require immutable allocations and a dispute trail.

SUPPORT: refund/reversal, stock problems, merchant withdrawal, account recovery, outage after food delivery, duplicate request, fraud, tax and expired token scenarios require explicit handling before launch. All money in integer cents and ZAR; no negative balances, silent deletion, orphan payables, double reimbursement or impersonated owner.

No payment gateway, transfer-to-friends, cash withdrawal, unapproved voucher stacking or in-app wallet functionality should be introduced by this plan. Customer out-of-pocket **split payment at the shop** is allowed; it is not a promotional balance top-up and does not add cash into the Rewards account.

## 7. Confirmed R500 pilot ceiling and honest unit economics

**Approved planning figures as of 2026-11-08:** first one-time kota at a ceiling of R25; Gold R80 promotional food credit; Platinum R150 promotional food credit; overall promotion envelope **R500**. Higher-rank qualification thresholds are still open. No actual money has been transferred to a campaign account, no shop is automatically enrolled, no customer has a live entitlement and no Production activation has been approved. The maximum **per-person nominal credit/grant commitment** for all three milestones is **R255** if the person earns them all and all credit is redeemed.

| Fully eligible participants promised all milestones | Total potential grant exposure |
| ---: | ---: |
| 1 | R255 |
| 2 | R510 — **R10 over the full R500 cap, BEFORE contingency** |
| 3 | R765 |
| 5 | R1,275 |
| 10 | R2,550 |

A R500 pot supports only **one** customer with all three credit/reward milestones fully promised, leaving R245 for other eligible claims and a buffer; it does **not** support an uncapped all-tier promotion for all users. Pending/available unspent credit and merchant debts are different stages of the same funded obligation, not independent new spending caps.

### Recommended initial pilot: Bronze-only, clearly disclosed

Keep Gold/Platinum **status progression** in the future product design, but do NOT market R80 or R150 as guaranteed for pilot customers until each eligible participant's full promised entitlement has been funded and approved. A *Bronze-only campaign version* with a published participant cap is safer than silently delaying an earned higher reward. The full loyalty ladder may be developed/tested with synthetic data independently of live promises.

| Total pot | Reserved Bronze gifts | Maximum admitted qualifying customers | Cash buffer |
| ---: | ---: | ---: | ---: |
| R500 | R300 (R25 x 12) | 12 | R200 |
| R500 | R400 (R25 x 16) | 16 | R100 |
| R500 | R500 (R25 x 20) | 20 | R0 — not recommended |

For a conservative first controlled pilot, **12** is my suggested starting point, leaving a R200 operational and dispute reserve; **16** is an alternative if the owner accepts a smaller R100 reserve. These are options, not an approved cohort size. New participant admission must stop before approved capacity is exceeded. Published campaign terms must explain Bronze-only status, eligibility, period, venue and later-rank conditions, without misleading consumers into thinking R80/R150 are already promised.

**Founder trust-first correction (2026-11-08):** The prior forced two-day/two-pickup Bronze gate has been explicitly REJECTED as potentially manipulative. **Four genuinely purchased/paid-and-collected eligible kotas, even in a single basket on one date, unlock the one-time reward.** Encourage repeat behaviour via the subsequent, clearly disclosed Gold mission (only when commercially funded/active), good food discovery and actual service quality—not a surprise condition on the initial free-kota promise. Investor reporting must still separately count genuine returning paid customers on a DIFFERENT purchase date; do not conflate four units in one basket, first free-kota handover or mission clicks with repeat purchases. A future Gold mission can require multiple paid visits only after the founder independently approves and advertises such a condition.

### Cohort evidence for future investors

Track distinct real customers and merchants with consent-aware aggregate analytics; **exclude owner/staff/demo/test orders**, count genuine paid-and-collected merchant-confirmed pickups, and distinguish **fully paid orders, mixed credit/cash orders, and fully subsidised reward fulfilments**. Track: (1) new sign-ups versus first real paid purchase, (2) unique first-time paid customers, (3) repeat customers with a second genuine paid visit within 30 days, (4) repeat customers after the reward is exhausted and without a new incentive, (5) cohort 30/60-day paid repeat retention, (6) real completed paid-order volume, (7) unique participating shops and merchants actively fulfilling, (8) delivered/fulfilled order rate and cancellations, (9) reward promotional cash spend per retained customer, (10) complaints, merchant reimbursement timeliness and disputes, and (11) any actual LocalEats revenue separately from merchant sales.

**Investor evidence must be labelled accurately:** offer data from incentivised and non-incentivised customers side by side; a 30-day pilot is only an early signal, not proof of durable product-market fit. A few artificially subsidised redemptions must never be presented as organic recurring demand. Follow cohort metrics rather than claiming raw downloads prove retention (YC: https://www.ycombinator.com/library/8H-analytics-for-startups).

**Working pilot scorecard / successor handover:** see [docs/REWARDS_R500_PILOT_AND_INVESTOR_EVIDENCE_20261108.md](docs/REWARDS_R500_PILOT_AND_INVESTOR_EVIDENCE_20261108.md) for suggested 12-person funding/reserve, mature cohort definitions, cost-per-paid-repeater calculations, truthful investor presentation fields and no-live-activity acceptance gates. That plan is NOT an executed marketing experiment.

### Unit-economics reality

Under the earlier **unconfirmed** full-ladder threshold 4 + 20 + 40 = 64 purchased kota units, 64 × R25 hypothetical selling price = **R1,600 of merchant food sales**. The full R255 incentive commitment is 15.9375% of that illustrative merchant sales figure, but it is NOT 15.9375% of LocalEats revenue. LocalEats does not receive merchant gross sales automatically. A R500 promotion must be funded as a marketing expense. At least until separate billing authorisation, predicted Plus/Pro/Premium subscriptions cannot be treated as earned revenue.

Budget expense categories include actual fulfilled customer free-food benefit, refunds or disputes, merchant reimbursement timing and a risk buffer. A merchant should receive the legitimate price funded by LocalEats after verified handover, not carry indefinite unpaid debt. Shop eligibility, mutual merchant participation, affordable menu categories and a written payout schedule are necessary before any active promise.

### Trial-policy change and fundraising trade-off

Founder has now chosen a **one-month free merchant subscription trial**, reduced from the earlier three-month design, with a Super Admin-only planned **+1 Month Free** extension button. The trial must start only after the shop has been approved and genuinely begins trading (the previously agreed condition), not merely when a test shop is created. Treat new agreements and existing promised trials fairly; do not retroactively cut an existing merchant's three-month entitlement without explicit agreement. Any subscription bills or service locks remain OFF until a separate reviewed billing release.

**Challenge:** Shortening the shop trial to one month may make merchant retention look worse if early customer traffic is low. When testing investor demand, focus first on how many shops get actual orders, how many shops return to fulfil, and whether they independently want to stay once the product is useful. The extension button should support accountable goodwill for shops building their first customer base, not artificially disguise merchant churn or grant free months indefinitely.

### Illustrative cash planning, not actual expenditure

R500 is a **planned spending ceiling**, not money proved reserved. Prioritise R0 synthetic tests first; personally ring-fence funds before making a promise, and leave the option to postpone any pilot rather than putting essential expenses at risk. At least the maximum cost of all benefits **promised** to an admitted customer must be funded, even if redeemed much later. Do not wait until they reach the next rank to discover the budget has run out. No retroactive cancellation of already earned, lawful rights.

## 8. App-by-app intended functionality (not activated)

| Surface | Proposed future behavior | Guardrail |
| --- | --- | --- |
| Customer Home header | Small available Food Rewards amount beside LocalEats logo, only from verified central API | No fake cash balance, no unapproved header redesign |
| Customer Profile | Permanent rank, current-stage units, earned free kota, actual food-credit balance, history and plain-language rules | No user-editable loyaltyPoints authority |
| Customer Menu/Cart | Eligible items, true server quote, credit amount offered, customer pay-at-shop remainder, one-time pickup hold | No gateway, no offline/client-confirmed credit deduction |
| Merchant Orders | Verify reward reservation, customer remainder, real collection and handover | Merchant cannot mint reward or payable |
| Merchant Payments | View accurate owed, sent, confirmed or disputed merchant reimbursements | Old localStorage COD toggles are not bank receipt evidence |
| Merchant Marketing PDF | LocalEats-centred FREE KOTA interest with honest Coming Soon until activated | Disclose essential terms on public offer, not just hidden after signup |
| Merchant Subscription | Planned one-month trial starts at genuine approved trading; display verified start, end, extensions and inactive billing status | No browser-synthesised 30-day countdown, automatic charge or retroactive removal of merchant promises |
| Super Admin Shop Review / Subscriptions | Planned **+1 Month Free** per-shop extension action: server-calculated new end date, confirmation, reason, audit, admin-only authorization; implementation checklist in Super-LocalAdmin/docs/MERCHANT_TRIAL_FREE_MONTH_SPEC_20261108.md (draft PR #4) | No browser-only trial grant; retries cannot double-extend, no billing activation |
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
- Existing Merchant/API R2.1 offline synthetic rewards model: localeats-api/src/rewards/README.md and corresponding tests; NOT a live server-authoritative balance and still based on single redemption bundles and old R125/R200 proposed caps. **New R80/R150 numbers are business decisions only and not yet coded.**
- Customer loyaltyPoints type exists; it is NOT a trusted live Rewards credit balance.
- **Verified source concern (2026-11-08):** Merchant [src/App.tsx lines 460–480](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/blob/main/src/App.tsx#L460-L480) estimates a fixed 30-day subscription trial from `trial_start_date || created_at || now`, with `subscription_status || "trial"`. This may incorrectly show an eligible merchant as expired or start a trial before genuine trading; frontend fallback is not an authoritative free-month grant. Before any subscription billing or granting extension via the proposed button, replace this with trusted server-side trial events/end dates, clear unavailable states, and multi-shop ownership tests. **No runtime fix in this documentation-only PR.**
- Launch issue #73 tracks production security/ordering blockers: https://github.com/mehey9184-maker/LocalEats-Dashboard.2/issues/73. Merchant/API draft R4.2 PR #121, R4.3 PR #122 and R4.4 PR #123 were left draft/unmerged. Synthetic CI success does not certify actual database policy remediation, Firebase device delivery, hosted staging or real orders.
- This master-plan file is documentation-only, proposed through a new draft PR based on main; it has no code, migration, real reward event, merchant balance or Production activation.

## 11. Phases for the current Rewards-first discussion

| Phase | Work | Mandatory gate |
| --- | --- | --- |
| RM-1 | Bronze four-unit reward in ANY eligible order, sequential next-mission discovery, R80/R150 future credit amounts, and split tender are CONFIRMED; still decide future Gold/Platinum purchase thresholds, eligible food, rollover and expiry | Founder updates CONFIRMED decisions in this master file |
| RM-2 | Model the CONFIRMED R500 ceiling; agree admission count, Bronze-only versus funded full ladder, repeat-visit definition and shop opt-in; design one-month merchant trial and admin-only extension | Owner approves campaign capacity and merchant offer terms separately |
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
| Q2 | **RESOLVED 2026-11-08:** Gold credit R80, Platinum credit R150 (previous R125/R200 superseded); NOT yet an active promised offer. Higher-rank eligibility thresholds remain OPEN under Q1. |
| Q3 | **RESOLVED 2026-11-08:** optional split payment APPROVED: use R65 credit, pay R35 at shop, handover required before spending credit. No forced top-up. Remaining open: detailed payment confirmation and dispute user experience. |
| Q4 | Eligibility: all foods, only approved menu foods, drinks/extras? Does a partially credit-funded kota count toward rank? |
| Q5 | When Platinum is reached, do leftover Gold credits remain and combine into the displayed available total? Any expiry and minimum-term promises? |
| Q6 | **RESOLVED pilot planning structure 2026-11-08:** 12 eligible enrolled customers maximum, one R25-capped Bronze gift each (R300 maximum reserved gift commitment), R200 remaining buffer, total R500 ceiling. Still OPEN: verify ring-fenced cash, pilot dates/merchants, legal terms and separate launch authority. Future Gold/Platinum benefits NOT included or promised. |
| Q7 | Which merchants opt in, and when must LocalEats reimburse them? What if merchant exits/disputes? |
| Q8 | Timing of guide, UI placement, accessible user terms, PDF copy and precise campaign rollout date? |
| Q9 | Customer return, partially fulfilled order, refunds, tax, merchant fraud/charge disputes and recruitment privacy safeguards? |
| Q10 | Super Admin **+1 Month Free** button: one extension per shop or repeatable with exceptional approval? Require reason, owner verified identity, full date/audit trail, prior-term protection, and no automatic billing. |
| Q11 | **RESOLVED AND REVISED 2026-11-08:** Bronze requires **4 qualifying PAID-AND-COLLECTED purchased kota units**; even 4 in ONE order/day earns a one-time free kota. **The previously approved 2-visit/different-day gate is SUPERSEDED and must NOT be used.** Technical acceptance still needs authentic paid/collected proof and replay/refund correction. |
| Q12 | One-month merchant trial: confirm start event (approved and genuine trading), extension eligibility and honest treatment of any shops promised the previous three-month offer. |

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
| 2026-11-08 (earlier discussion) | RW-08 / RW-09 | Earlier design treated threshold counts and example R125/R200 credit values as OPEN. | HISTORICAL; R125/R200 amounts later SUPERSEDED on 2026-11-08 by R80/R150 | Higher-rank unit thresholds still OPEN; see later RW-09 log row |
| 2026-11-08 | RW-13 | Founder wants one persistent GitHub Master Plan for personal recall and successor AI/developer handover. | CONFIRMED | This draft, not yet merged |
| 2026-11-08 | RW-15 | Customer can apply earned credit to eligible food and pay any remainder **at the physical shop**; e.g. R100 order = R65 LocalEats promo + R35 customer cash/card-terminal. Full-credit purchases must not require extra cash; grant/spend, shop handover and merchant debt require trusted server confirmation. | CONFIRMED | Design documented; zero route/UI/DB activation |
| 2026-11-08 | RW-09 | Replace the R125/R200 proposal with **R80 Gold and R150 Platinum promotional food credit**, once per verified level-up, subject to published funding/eligibility. | CONFIRMED amounts; production disabled | Earlier R125/R200 amount proposals SUPERSEDED; existing R2.1 model unchanged |
| 2026-11-08 | RW-13 | Allocate **R500 maximum** as the planned Rewards pilot envelope; cohort size and actual ring-fenced cash remain to be accepted before launch. | CONFIRMED spending ceiling | Plan-only; no customer promises or merchant payables |
| 2026-11-08 | MC-01 | Shorten the NEW MERCHANT subscription trial OFFER from three months to **one calendar month** starting after approved real trading; protect previously promised terms. | CONFIRMED business direction | No billing, trial activation or existing app code changed |
| 2026-11-08 | MC-02 | Founder wants a **Super Admin +1 Month Free** merchant trial extension button with server-authorised/audited shop-specific grant. | CONFIRMED desired feature; exact policy OPEN | NOT IMPLEMENTED; separate review/Preview acceptance required |
| 2026-11-08 | IV-01 | Primary goal is provable repeat PAYING customers and shop demand for future investor discussions, not raw reward redemption or fabricated GMV/revenue. | CONFIRMED objective | Retention dashboard/business test design OPEN |
| 2026-11-08 | RW-16 / RW-01 | APPROVED the two-visit rule: at least four qualifying purchased kota units **across two genuine paid-and-collected pickup orders on different South African calendar dates**, at least one qualifying paid unit in each counted visit, before the one-time free kota. Four units in one order or two orders on the same date do not qualify. | CONFIRMED and replaces earlier units-only proposal | Design-only; no live rank, order, wallet, reward or promotional promise activated |
| 2026-11-08 (later owner correction) | RW-01 / RW-16 | REJECT the forced separate-day/pickup rule. Four qualifying paid-and-collected kota units from ONE or multiple purchases unlock the initial free kota exactly once; no customer forced to return to qualify for an explicitly advertised four-kota reward. | RW-01 CONFIRMED; RW-16 SUPERSEDED | Update future tests, UI mission copy and R2.1 model alignment; no live activation |
| 2026-11-08 (later owner discussion) | RW-17 | Reveal the next mission after completing the previous one; locked future prizes need not crowd the first screen. Before customers spend to earn an offered mission, show the actual funded reward and material terms; no deceptive mystery prize promise. | CONFIRMED direction with disclosure safeguard | Design only; Gold/Platinum do not activate in Bronze-only pilot |
| 2026-11-08 (later owner approval) | RW-18 | Accepted the R500 Bronze-only pilot structure with 12 capped eligible customers (R300 potential gifts plus R200 funding buffer). | CONFIRMED pilot PLAN; NOT a go-live authorisation | Merchant opt-in, actual funding, public terms, credible pickup security, independent launch approval still needed |
