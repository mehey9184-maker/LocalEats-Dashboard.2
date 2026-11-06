# LocalEats — Commercial hosting and capacity gate (review only)
Date: 2026-11-07 | First launch: Customer + Merchant + API, pickup, pay-at-shop only.

## Decision: do not activate a business on Vercel Hobby

Vercel's Hobby plan is for **personal, non-commercial** deployments. A LocalEats commercial launch requires a plan/provider explicitly permitting business use, **even if no hosting quota is exhausted and customers pay in shops**. Do not treat Hobby's numerical quotas as permission to operate commercially, split the business across Hobby teams, or start real ordering without a commercial-permitted plan.

Vercel Pro currently starts at **US$20 per month** (excluding applicable tax/overages), including one deploying seat and **US$20 monthly infrastructure credit**. Vercel currently lists **1 TB of Fast Data Transfer** in the Pro package; Hobby lists **100 GB**. This is **visitor-facing data transfer**, *not* 1 TB of PostgreSQL, image or object storage. Vercel's Fast Data Transfer, function invocations/CPU, and Supabase/Firebase usage are **distinct metrics** with independent quota/costs. Verify current pricing and team plan immediately before purchase.

Vercel projects already connected under the same team:
- Customer: `project-x7cvt`
- Merchant: `local-eats-dashboard-2-6m8o`
- API: `localeats-api`

A team can contain multiple projects; pricing is not automatically one new $20 seat *per project*. Do not purchase seats or upgrade the team without separate owner approval. No Vercel billing or actual use totals could be reliably retrieved through the read-only integration today; obtain live monthly metrics from **Vercel Dashboard → team → Usage → last 30 days → filter by project**, then record them privately.

## Read-only baseline (2026-11-07)

- PostgreSQL Production total size, read-only query: **22,006,931 bytes (~21 MiB)**.
- Target load from the already completed synthetic model: **20 shops, 5,000 registered users, 150 orders/day (~4,500/month), with a hypothetical short 10/minute burst**.
- Existing 180-day synthetic model covers 27,000 intents and illustrative 4–24 KiB additional storage/order. It does **not** measure actual Vercel traffic, actual PostgreSQL storage per order, or actual cloud throughput.
- Supabase Free currently includes **500 MB database/project**. At larger measured order/event growth, a paid Supabase tier could be needed *before* Vercel's included bandwidth becomes the bottleneck.
- An account is not equal to a daily visitor: 5,000 registered users do not imply 5,000 concurrent users, 5,000 visits daily, or a fixed transfer rate.
- Customer Production `VITE_PICKUP_ORDERING_ENABLED=false`, Merchant Production `VITE_PICKUP_ORDERING_ENABLED=false`, API Production `PICKUP_WRITES_ENABLED=false` at last reviewed Vercel environment snapshot. API Production still predates the new profile endpoint; deploy ordering and profiles only through later separately approved release gates.
- Some **historical Preview branches** have true ordering/write flags; never use an arbitrary Preview to exercise real data without inspecting isolation and read-only middleware.

## Sizing illustrations — not observed traffic

Suppose, for estimation only, **100,000 app visits per month**. Each average visit causes:

| Vercel-delivered data per visit | Approximate monthly Fast Data Transfer |
|---:|---:|
| 0.5 MB | 50 GB |
| 2 MB | 200 GB |
| 6 MB | 600 GB |

These amounts are only rough decimal arithmetic. Real transfer changes with caching, images served directly by other providers, browser asset reuse, number of visits, API responses and compression. Request/CPU volume and functions can reach limits independently of transfer. Compare to the team's *actual* Vercel usage meter and current plan, not these examples.

## Upgrade and reliability decisions

1. **Before commercial first order:** choose a commercial-permitted host (Vercel Pro is the lowest-friction continuation if acceptable to the owner; separately evaluate migration alternatives if $20/mo is not viable). Do not activate pickup ordering on Vercel Hobby merely because the free quota has headroom.
2. **During testing:** remain on current non-commercial Preview/testing configuration and reduce unnecessary builds and network calls. Never run unauthorized hosted stress tests or Production load tests.
3. **Collect actual metrics:** Vercel team/project Fast Data Transfer, CDN requests, function invocations, CPU, 4xx/5xx, p95 response times, cache hit/miss; Supabase DB bytes, API egress, MAU; Firebase Firestore reads/writes, FCM delivery results. One service's dashboard cannot measure the others.
4. **Budget warning:** investigate sudden spikes immediately; consider proactive reviews at ~50% of an allowance, plan mitigation at ~75%, and decide upgrades before running out. These are proposed business guardrails, not provider-enforced thresholds. On Pro, configure Spend Management **before** enabling on-demand billing; recognize that a hard cap may interrupt live orders.
5. **Reliability gate:** order commits and receipts must not depend on push or a fast homepage. The authoritative merchant inbox must reconcile even if push times out; 10/minute requires real authorized staging measurements of peak p95/p99 latency and duplicate/idempotent acceptance.
6. **Scale only on evidence:** upgrade when measured quota pressure, actual request error rates/latency, storage growth, compliance, support coverage, or uptime targets require it—not merely when registered account count grows.
7. **Growing costs:** Vercel compute and transfer, Supabase database/storage/egress/backups, Firebase Firestore access, images/objects, domains, SMS/email, monitoring and support are separate cost categories. Paying for Vercel Pro does not automatically upgrade Supabase or grant 1 TB file storage.
8. **Before 90–100% readiness:** separately resolve published Firebase named-database rule version; unsafe Supabase signup and dormant rider grants; hosted Customer+API profile A/B reads/saves; push timeout and merchant inbox behavior; end-to-end isolated pickup order; legal/privacy/support; final hosting plan; rollback, monitoring and owner launch authorization.

## Release and procurement safeguards

This file is a **budget and release-gate note only**. No request or permission to purchase a plan, expose secrets, change Vercel environment flags, deploy to Production, run hosted load tests, create/delete Production orders, alter Supabase/Firebase rules, activate payments or delivery, or merge other drafts.

## Source references (verified 2026-11-07)

- Vercel Fair Use — commercial use: https://vercel.com/docs/limits/fair-use-guidelines
- Vercel Hobby: https://vercel.com/docs/plans/hobby
- Vercel Pro plan (fee, credit, transfer): https://vercel.com/docs/plans/pro-plan
- Vercel Limits: https://vercel.com/docs/limits
- Vercel usage dashboard: https://vercel.com/docs/pricing/manage-and-optimize-usage
- Supabase usage/Free storage: https://supabase.com/docs/guides/platform/billing-on-supabase
- Existing LocalEats simulation: `docs/LOCAL_EATS_SIX_MONTH_CAPACITY_PLAN.md`
- Existing launch blockers: https://github.com/mehey9184-maker/LocalEats-Dashboard.2/issues/73
