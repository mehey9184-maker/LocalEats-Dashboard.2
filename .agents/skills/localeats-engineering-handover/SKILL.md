---
name: localeats-engineering-handover
description: "Use for LocalEats cross-app onboarding, code-health audit, architecture decisions, maintenance, security hardening and AI handoffs. Read current evidence before edits; pickup-first, no live changes."
---

# LocalEats engineering handover
1. Read root AGENTS.md and docs/LOCALEATS_AI_HANDOVER.md. Follow repository-specific pickup skill and functionality documentation; inspect relevant sections rather than scanning all history. If the canonical cross-repo guide is unavailable, do not infer missing release decisions.
2. Establish exact repository/branch/SHA, active vs historical code, owner intent, environment isolation and permitted scope. Use graph/index only if fresh; inspect actual source, call sites, imports and tests.
3. For L4-H1, read the canonical audit; inventory before deletion. Classify live/deferred/demo/unknown/dead; prove reachability and test coverage before changing anything. Prefer small reversible changes and avoid new cost.
4. Preserve approved UI, 4 km genuine-GPS pickup, truthful status, backend authority, account/shop isolation, idempotency and physical payment confirmation. Never enable deferred delivery/rider/LocalPay or online payment.
5. Use mocks/disposable environments with writes OFF; no real account/order/notification, production flag, deploy, merge, SQL mutation or paid service from an audit. Owner separately authorizes release. Never store secrets or private recovery files in Git.
6. Append important decisions and current status to canonical handover, sync relevant functionality doc, and report evidence, unknowns, rollback and next action. Do not turn test results into deployment claims.
