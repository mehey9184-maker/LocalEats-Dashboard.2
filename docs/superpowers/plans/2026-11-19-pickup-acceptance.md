# Pickup Acceptance Implementation Plan

> Execute inline using superpowers:executing-plans, with tests before implementation.

**Goal:** Prevent unanswered pickup orders from keeping customers waiting indefinitely.
**Architecture:** Opt-in database deadlines and transactional expiry; bounded service-only sweeps create durable notices. Existing authenticated API surfaces the facts; browsers never decide that cancellation succeeded.
**Tech Stack:** PostgreSQL 17, existing Express/TypeScript API, React Customer and Merchant apps.
**Spec:** ../specs/2026-11-19-pickup-acceptance-design.md

## Constraints and review focus

- All hosted activation and sending remain off; test only disposable local PostgreSQL.
- Exact deadline, concurrent acceptance/cancellation, replay, owner changes and outages require behavioral tests.
- Historical and accepted orders stay untouched; payment/handover contracts and 4 km discovery remain intact.
- Keep Customer PR115 and icon drafts separate; use dedicated feature branches/draft PRs.

## Tasks

- [ ] Add failing SQL tests for opted-in deadlines, durable reminder/expiry, late acceptance and repeated misses.
- [ ] Implement additive review-only SQL with locked transactions, private notices and explicit resume.
- [ ] Rehearse locally, including role denials and concurrent commands; retain stopped synthetic evidence.
- [ ] Add default-off authenticated API adapters and scoped reads, with safe errors and regression tests.
- [ ] Add Customer and Merchant status presentation without browser-authoritative transitions; test uncertainty and account isolation.
- [ ] Run existing API/UI suites, TypeScript/builds and 180-day synthetic workload; review diff, commit and push dedicated draft branches.
- [ ] Document scheduler, push/device and hosted activation gates; do not claim live rollout from local passes.
