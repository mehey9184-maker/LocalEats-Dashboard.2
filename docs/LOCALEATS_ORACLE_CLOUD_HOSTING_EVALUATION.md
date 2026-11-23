# LocalEats — Oracle Cloud Always Free Hosting Decision

**Research date:** 2026-11-22 · **Founder proposal:** evaluate new Oracle Cloud Free Tier account for 6–9 months of cost-controlled LocalEats hosting. **Status: RESEARCH / NO OCI RESOURCES CREATED.**
**Primary recommended decision:** Cloudflare Static Assets for Customer/Merchant; continue Cloudflare Worker API + Supabase acceptance. Evaluate **Oracle Always Free as an isolated secondary/staging backend and alternative API runtime** if a real Cloudflare Worker CPU, Firebase Admin or FCM integration cannot fit free limits. Do not migrate the whole site or Production data on an untested VM.

## Important factual corrections

- **Trial is not 6–9 months:** Oracle's normal Free Trial provides **US$300 credits for 30 days**; resources that use trial-only paid capacity can be reclaimed after the trial if not upgraded. **Always Free** resources are a different category and can continue after the trial with no published time expiry, provided account eligibility, availability, ongoing terms and usage limits. A 6–9 month $0 goal must use **Always Free**, not temporary trial credits.
- Oracle's **current authoritative Free Tier page** reports Ampere A1 **1,500 OCPU-hours + 9,000 GB-hours monthly**, equivalent to **2 OCPUs / 12 GB RAM** 24/7 across the tenancy. There are also up to **two AMD E2 Micro VMs** (each only 1/8 OCPU and 1 GB RAM). Online descriptions and older Oracle Arm pages may still say **4 OCPUs/24 GB**, so **do not assume that higher allowance**. Verify the user's actual Console limits, tenancy home region and provisionable shapes before any decision.
- **Block storage:** 200 GB Always Free total including boot volumes; the default boot volume uses about 50 GB per VM. **Object storage:** up to 20 GB in Free-only state with 50,000 Object Storage API requests/month. **Outbound transfer:** Oracle currently lists 10 TB per month as part of Always Free. These are per-tenancy pools, not dedicated/per-instance promises, and some services/extra regions may generate charges.
- **Major availability risk:** Oracle may reclaim idle Always Free instances; its documentation defines a 7-day idle test involving 95th-percentile CPU under 20%, network under 20%, and memory under 20% for A1. Always Free VM shapes can have **out-of-host-capacity** errors in a chosen region, meaning even a new approved instance might not be immediately provisionable. Do **not** artificially waste CPU/network to game the idle rule. Always Free accounts generally rely on community support instead of full support.
- **Expiry:** Oracle says the ordinary Always Free resources continue after the trial; trial-only paid resources can be reclaimed. Keep the VM shape/CPU/RAM/storage clearly within Always Free before the trial ends, and do not upgrade to Pay As You Go without specific founder approval.
- **User account:** founder reports an Oracle Cloud account is now available. We have **not connected OCI**, seen the tenancy, trial status, current regional quotas, currently deployed instances, or billing status. Any recommendation that depends on a live quota/instance is provisional.

## Comparison specific to LocalEats

| Decision criterion | Cloudflare Static + Workers | Oracle Always Free |
|---|---|---|
| Public Customer/Merchant static React/Vite websites | **Preferred.** Cloudflare serves static assets without metered Worker invocations on asset hits | Possible via Nginx/Caddy but uses a VM, patching and operational maintenance unnecessarily |
| Request-based public API | Workers scale automatically; Free limit 100,000 requests/day, 10 ms CPU per invocation, 128 MB per isolate, 50 subrequests; requires real Firebase Admin auth and endpoint CPU acceptance | Node/Express can run for longer background CPU tasks with 2 OCPU/12 GB A1, but VM is single-region, requires security updates, backups, monitoring, DDoS protection, recovery and capacity; no accepted uptime yet |
| Existing authoritative Postgres | **Keep Supabase.** Current order/security, RLS and migration contracts must not change without approval | Running another Postgres VM would create duplicated authority/backups and unnecessary migration risk |
| Mobile-user image CDN | Cloudflare + R2 after separate approval; preserve Data Saver | OCI Object Storage is useful for non-sensitive staging backups under allowance, not a reason to duplicate live image pipelines |
| Push notifications | Keep Firebase FCM; verify actual device delivery and merchant fallback timing | Hosting API on OCI would not replace or guarantee FCM push; a free VM crash could interrupt pickup alerts |
| Scheduled jobs and long-running processing | Investigate Cloudflare Cron/Queues/other approved providers within limits | **Potentially useful** for experimental workers, staging load-tests, batch verification and fallback API prototype, never enabled for live orders without accepted recovery |
| Operational risk | Provider quota limits, CPU and support caveats; previous Vercel pause shows provider concentration risk | Idle reclamation, home-region shape scarcity, single VM failure, missed patches, potential billable-resource mistakes |
| Growing from first pilot to Africa-wide service | CDN static pages scale well, Worker costs can be measured | Free VM is an experiment, not a credible fixed-price million-user SLA; add horizontal services and paid capacity only on actual revenue/traffic evidence |

**Geography:** The existing LocalEats-Profile-Staging Supabase project is in `eu-west-1` (verified previously). OCI home region and the principal production Supabase region have **not** been checked. Hosting a database-dependent API in South Africa while its database resides in Europe can introduce extra latency—measure request roundtrips rather than assume geographic closeness solves performance.

## Recommended 6–9 month trial plan (illustrative milestones, no spend authorization)

**Phase O0 — account inventory and read-only connection**: verify tenancy home region, current free trial/Always Free billing state, eligible 2 OCPU/12 GB remaining quota, VM availability, storage and networking limits; set up read-only IAM/MCP integration. No provision/deploy.

**Phase O1 — disposable/isolated pilot (separate founder approval):** provision **one Always Free eligible A1 Ubuntu/Oracle Linux Arm64 VM** in home region if capacity and quota are confirmed, with no customer data. Install secure base image, automatic security updates, firewall deny-by-default, SSH key access or OCI Bastion, limited role, monitoring/alerts, documented backup and tested restore. Do **not** expose root SSH broadly or install a public dashboard/DB port. No Vercel or Production DNS cutover.

**Phase O2 — technical comparison:** run a mock synthetic LocalEats read-only API on Oracle and the accepted Cloudflare read-only API, comparing P50/P95 latency to staging Supabase, memory/CPU, request failure rate, TLS/proxy maintenance, patching/restore, and total realistic spend at 100/10,000/1,000,000 users (load scenarios, not capacity guarantees). Test a simulated VM loss and recovery. **No live orders/merchant FCM effects**.

**Phase O3 — launch decision:** if Cloudflare Worker's authentication/FCM CPU or package limitations are concretely unacceptable, consider Oracle as **backend runtime only** behind Cloudflare frontends after distinct founder approval; otherwise keep Oracle for isolated staging/batch tasks or unused. As sales arrive, choose a supported paid plan based on measured costs and availability, not a promised fixed date.

## Safeguards

- Never create billable compute shapes, block/storage volumes, load balancers, bandwidth, public IPs or other paid OCI resources by mistake. The "Always Free eligible" indicator and tenancy quota are mandatory preflight conditions. Set cost budgets/alerts; alerts are **not necessarily hard spend caps**.
- Do not upgrade trial account to Pay As You Go, sign up for paid services, or authorize subscriptions without separate explicit founder approval.
- Use a dedicated **read-only OCI IAM identity** for initial discovery. No administrator access, no private keys pasted in chat, no API signing key files in GitHub. OCI SDK/CLI and MCP secrets remain in local protected storage or managed secret stores.
- Even for staging, no real customer/merchant/owner identifiers, Production Supabase keys or Production Firebase credentials; follow the same GitHub milestone documentation and approval gate.
- Review cross-border privacy/POPIA implications and business continuity before any real personal data migrates to another hosting region. This is a risk assessment, not legal advice.

## Verified sources (consulted 2026-11-22)

- [Oracle Free Tier official](https://www.oracle.com/cloud/free/) and [Free Tier / 30-day trial](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm)
- [Oracle Always Free entitlements, idle reclaim, storage, egress](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
- [Oracle Free Tier FAQ, capacity/support and trial expiry](https://www.oracle.com/cloud/free/faq/)
- [Cloudflare Static Assets billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)
- [Cloudflare Workers Free limits](https://developers.cloudflare.com/workers/platform/limits/)
- [OCI official MCP server](https://github.com/oracle/mcp/tree/main/src/oci-cloud-mcp-server)
- [LocalEats OCI connection plan](LOCALEATS_ORACLE_MCP_CONNECTION_PLAN.md)

**Decision:** Oracle is a valuable **backup hosting option / isolated backend lab**, not yet the preferred public frontend host. No OCI account access, resource creation, DNS, GitHub merges, DB changes, FCM or paid resources in this research.
