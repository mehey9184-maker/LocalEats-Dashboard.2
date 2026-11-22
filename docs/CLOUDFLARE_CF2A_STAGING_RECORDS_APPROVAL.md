# CF2 — Restricted staging data connection proposal (FOUNDER APPROVAL REQUIRED)

**Date:** 2026-11-22
**Status:** Prepared, **not approved or executed**.
**Required authority:** explicit founder consent before inspecting staging fixture records, using a database key, altering SQL permissions, or deploying another Worker version.

## Why this is the next real integration gate

CF1 API bootstrap is deployed and correctly denies real orders/menus. CF2 has mock-only public shop/menu GET contracts, a bounded PostgREST request adapter, Firebase revocation-required identity contract, and a successful Cloudflare Firebase Admin packaging dry-run. None uses a live database or actual Firebase authentication.

Read-only schema/ACL inspection shows the existing **LocalEats-Profile-Staging** Supabase project has the needed shop/menu structures and security-invoker availability view; grants currently permit SELECT only with server-side service_role, while the underlying shops and menu_items tables have RLS enabled and no policies. **No customer/order rows were read.**

## Narrow proposed next scope

1. **Staging-only records and isolation check.** Inspect minimal metadata and a bounded sample of nonpersonal synthetic shop/menu fixture records in **LocalEats-Profile-Staging**, with no Production project queries or customer/account/order content. Refuse the project if fixture data cannot be confirmed synthetic and independent of Production. No record modification, deletion or migration is authorized.
2. **Least privilege design.** Review whether dedicated read-only Data API grants/RLS and a limited role are viable without exposing private shop fields. Avoid adding PUBLIC/anon grants, broad RLS bypasses or SECURITY DEFINER shortcuts merely to fix access. If dedicated privileges require SQL, prepare a reviewed, disposable rehearsal only; **do not execute grants/SQL without a separate explicit approval**.
3. **No credentials in Git or browser.** Any approved staging database credential must exist only as a server-side Cloudflare secret. Never copy the main project's service-role/secret key, or use production Firebase credentials. An existing staging secret has broad privileges, so do not use it for a public endpoint until isolated fixtures, secret handling and per-route read-only enforcement have been independently verified.
4. **Separate Worker exposure only after acceptance.** Propose a new distinct CF2 test Worker rather than modify the accepted CF1 bootstrap; set all write flags OFF, disable custom domains, use an isolated workers.dev test hostname and exact allowlisted origin. Require full CI, negative verb tests, no real customer data, limited requests/CPU and rollback. **This Worker deployment is NOT authorized by this document**.
5. **No auth or FCM activation.** Firebase Admin imports bundle with nodejs_compat, but runtime revocation checks and actual push delivery are unverified; do not enable merchant/customer protected endpoints, notification registration or payment/order acceptance.

## Business and cost conditions

Reuse the active staging project **only if data isolation is proven**, avoiding a third Supabase project and unnecessary charges. No service upgrade/credit card changes. A read-only pilot should use low-volume tests and prevent load on the existing Vercel-disabled Production domain. Workers Free CPU/request quotas and Supabase REST count query costs must be measured and audited before release. The current adapter deliberately caps shops at 200 and menu rows at 400 rather than hide incomplete results, so paginate and batch before expansion.

## What founder approval would authorize

If the founder **expressly approves Stage CF2-A**, the AI may inspect **only synthetic or test fixture shop/menu records within LocalEats-Profile-Staging**, and continue local simulations/CI. It may not create database objects, alter privileges/RLS, use database secret keys, deploy a new Worker, change custom domains/DNS, connect real Firebase, touch main Production, place orders or incur costs. Those would require an **additional specific, evidence-based approval** after CF2-A.

**Status now:** CF2-A approval outstanding. No action required until the source/CI handoff is complete and this request is presented in a CEO report.

[Founder charter](LOCALEATS_FOUNDER_CHARTER.md) · [CF2 security findings](CLOUDFLARE_CF2_STAGING_DATA_AUTH_REVIEW.md) · [Canonical project handoff](LOCALEATS_PROJECT_MEMORY.md) · [Migration issue #223](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/issues/223).
