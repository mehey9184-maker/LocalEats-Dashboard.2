# LocalEats R5.2B — Dedicated Staging Setup and Isolation Acceptance

**8 November 2026 — Founder requested R5.2B.**
**Outcome:** connected-resource audit and offline acceptance gate PREPARED. Actual hosted staging provisioning and acceptance **NOT COMPLETE**. No merge, new billable resource, live credential change, database schema write, user creation/revocation, orders or LocalPay activation.

## Verified metadata (no secret decryption or record access)

| Component | Evidence | Verdict |
| --- | --- | --- |
| Supabase Production | Existing active LocalEats project | Do not touch |
| Supabase Profile Staging | Separate active LocalEats-Profile-Staging project; public schema currently exposes only `public.profiles` | Reuse candidate; not a full pickup database |
| Firebase hosted staging | No independently verified live nonproduction Firebase project accessible to this session | BLOCKED |
| Old Customer Preview branch | `preview/client-profile-security-review-20261106` has branch-scoped Firebase variables, but project ID starts with `demo-`; its supplied API origin is not a valid HTTPS origin | NOT a usable hosted R5.2B environment |
| Customer current draft | Vercel project `project-x7cvt`, PR #82 branch: no matching deployment; Firebase defaults still scoped to Preview + Production; no current-branch overrides | BLOCKED |
| API current draft | Vercel project `localeats-api`, PR #124 branch: no matching deployment; Firebase Admin and Supabase vars shared across Preview + Production | BLOCKED |
| Merchant current environment | Vercel project `local-eats-dashboard-2-6m8o`, Firebase Preview + Production shared; no evidence of independent merchant staging pairing | BLOCKED |

Source: read-only Vercel project variable metadata, GitHub PR heads/deployment searches, Supabase project listing and public table metadata. This is a **point-in-time observation** and should be refreshed before any deployment. `demo-` Firebase project IDs are for emulator-only projects; they do not establish hosted Auth/Firestore. Do not treat absence of a branch deployment as a failed hosted sign-in test: **no hosted test was run**.

## Reuse-first architecture decision

1. **Keep the existing Supabase Profile Staging project** as the first candidate. It is distinct from the active Production project. It currently lacks the `shops`, `menu_items`, `orders` and `pickup_order_events` public tables required for the intended end-to-end pickup history/merchant rehearsal. No migrations, fixture data or service-role access were applied under R5.2B. Before using it, compare a reviewed minimal staging-only schema, API query contracts and RLS/permissions; use **synthetic records only** after a separate data-write approval. Never copy Production customers, orders, cards, merchant bank details or LocalPay ledger.
2. **Verify or provision a genuinely separate hosted Firebase project** for staging, preferably within an available free project quota where suitable. It must be a real Firebase project (not `demo-`), must differ from Production, and must contain only synthetic Auth accounts. Apply restrictive Firestore/Storage rules; never weaken Production rules. No account creation/revocation was performed because no verified isolated Firebase project access was available.
3. **Choose a safe Vercel arrangement** before touching any settings. Prefer dedicated, explicitly nonproduction Customer/API/Merchant Vercel projects containing only staging variables; alternatively use reviewed exact-Git-branch overrides for **every** critical variable. Vercel supports branch-scoped overrides, but missing keys inherit common Preview values, which are currently shared with Production. Creating projects or replacing environment variables needs a separate infrastructure review and confirmation of potential cost.
4. API must use staging-only `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Customer must use `VITE_FIREBASE_CONFIG_SOURCE=environment` and six complete staging Firebase web fields plus `VITE_FIREBASE_FIRESTORE_DATABASE_ID`. Merchant uses its separately reviewed environment-only Firebase mode. Never put service-role keys, Firebase Admin keys, passwords or tokens in `VITE_*` values, GitHub, PR descriptions or logs.
5. Keep Customer, API and Merchant pickup submissions, profile writes, merchant changes, rider flows, payments, Rewards and LocalPay **disabled**. Even on staging, no real or synthetic pickup order creation until a separate controlled-test approval.
6. Build exact-commit **Preview only** after provider and variable isolation has been verified. Record independently verified Customer/API Firebase issuer/audience agreement, separate Supabase project reference, deployed branch + SHA, HTTPS staging API origin and CORS allowlist; avoid a misleading READY status if linked to Production.

## Offline check added in this draft

`localeats-api/tests/rewards/r52b/resourceReadiness.mjs` assesses resource metadata without network access. `observedResources.snapshot.json` records only safe booleans and public table names, not URLs or secrets. The observed assessment is **BLOCKED**. Tests prove incomplete staging schema, absent hosted Firebase, missing exact deployments, inherited Preview/Production variable scopes and unknown synthetic/owner acceptance must not be treated as ready.

A synthetic fully affirmative fixture is labelled **EVIDENCE_READY_FOR_INDEPENDENT_REVIEW** — deliberately *not* authorization to run hosted tests. The prior R5.2 staging gate must also pass with real independent evidence, feature flags and precise commits. Green CI only proves the offline logic.

## Acceptance evidence still required

- Independent Firebase project exists in the owner's Firebase console, matching backend Admin verifier and Customer Web SDK; correctly isolated from live Firebase, verified without exposing secrets.
- Supabase staging schema is reviewed for pickup/merchant reads and its project/credentials are independently different from Production; synthetic-only fixture design approved.
- Customer, API and Merchant Preview variables prove no effective Production credential inheritance. For branch override strategy verify every critical key on the exact branch; dedicated staging projects may be easier to audit.
- Exact-branch Preview deployments at the tested head commit are READY, use HTTPS staging API and fail closed if any stage config is missing.
- Explicit owner consent for synthetic Auth staging login/revocation and fixture writes before launching browser tests, with cleanup plan and any cost disclosure.
- R5.2 end-to-end identity recovery, disabled account, A-to-B switch, anonymous history, signout, Merchant ownership checks, realistic mobile latency and UX owner sign-off pass **on that isolated environment**.

**Next recommended R5.2B gate:** verify a real hosted Firebase staging project and approve an isolated synthetic-only schema/infrastructure plan; then configure segregated Vercel projects or branch overrides and test exact Preview builds. **No Production release authorization.**
