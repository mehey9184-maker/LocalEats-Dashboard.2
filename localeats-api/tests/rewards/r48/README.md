# LocalPay R4.8 — Firebase authentication security remediation (DRAFT ONLY)

**8 November 2026 | Owner requested R4.8.** Scope: repair the **revocation-check omission on the draft API branch** and test the affected pickup authentication boundary without connecting to a real Firebase user or Supabase instance. **No Production release, data writes, payment, credit, SQL migration, real user sign-out, preview-to-live promotion, or merge authorised.**

## Actual checked-in fix (draft PR #124, NOT deployed)

The existing active `localeats-api/src/middleware/authenticateFirebase.ts` previously called `authAdmin.verifyIdToken(token)` without an explicit revocation check, permitting a token that is otherwise valid until normal expiry to pass even after an account's credentials were revoked/disabled. R4.8 changes this existing middleware to:

```ts
const decoded = await authAdmin.verifyIdToken(token, true);
```

It also validates that the verified server-side UID is a nonempty, bounded, whitespace/control-character-free string before adding `req.authUser`. Both authenticated Customer and Merchant HTTP handlers use this middleware, **so the behaviour change extends beyond Rewards** if eventually deployed. It may introduce extra Firebase backend latency, rate-limit/service-outage exposure and customer reauthentication requirements. Do **not** merge or release without explicit owner approval, an independent staging project, integration performance validation, monitoring and frontend logout/reauthentication behaviour review.

The former R4.7 source assertion that intentionally required the *absence* of `checkRevoked=true` has been updated to require its **presence on this draft branch**. This is a supersession of that historical blocker, **not a claim that Production was patched**.

## Isolated tests

**R4.8 Node tests:** `localeats-api/tests/rewards/r48/revocationMiddleware.test.mjs` imports the compiled **real** `authenticateFirebase` and mounted **real** `merchantOrderRoutes`, with synthetic in-memory Firebase verifier/Supabase responses. Tests confirm a forced `checkRevoked=true` on every authenticated request; denial on mock revoked, disabled, expired or unknown tokens and auth service failure; no re-use of identities after revocation; rejection of absent/malformed tokens and forged UID; generic anonymous detection preserved; and an actual loopback HTTP Merchant route verifying current owner and returning `PICKUP_WRITES_DISABLED` to the rightful merchant without writing an order. The Customer app card and Merchant UI have not been edited.

**Firebase Authentication Emulator tests:** `tests/rewards/r48/firebaseAuthEmulator.test.mjs` runs with `firebase-tools` and `firebase.emulator.json` binding Auth to **127.0.0.1:9099**, `GCLOUD_PROJECT=demo-localeats-r48`, no real Firebase key or external project. The Admin SDK is explicitly initialised to that fake project. The test creates fake users via the emulator's own local HTTP endpoint, then invokes its **real** `firebase-admin` `verifyIdToken(token,true)` for normal, disabled and revoked accounts; also checks an anonymous identity and a bogus token. The CLI/Auth Emulator may not implement every production timing/claim edge case identically. **Emulator-issued tokens are unsigned and NEVER acceptable to real Firebase; passing emulator tests is not real-world Firebase signature validation.**

CI workflow `.github/workflows/localpay-r48-auth-revocation-isolated.yml` has a normal locked-dependency mocked-auth job and a separate actual local Auth Emulator job. Both run on the existing draft PR, no secrets or Prod DB connectivity. `npm run test:r48` runs mock route tests and full `npm test` includes these tests plus the earlier R4.7 regression. The emulator uses an exact pinned test CLI version with no changes to application package dependencies.

**Verified CI:** GitHub Actions run **42495129249**, source-code commit **`8467e6027be5bdf1fd59302788294a9e01c03d16`**, both jobs completed **SUCCESS**: mocked middleware/merchant permissions job **128775739152** ran **8/8 R4.8 tests** and **49/49 retained R4.7 tests**, and genuine local Auth Emulator job **128775739405** ran **5/5 Firebase Admin Emulator tests** (including revoked and disabled synthetic accounts). The emulator job ran with only a local fake demo project, no real service keys or actual user accounts. A later documentation-only commit may trigger fresh CI; always check the current PR head before release.

## Finances and remaining go-live blockers

- The working source change is on a **draft branch only**. The currently deployed API remains unverified/unchanged by R4.8.
- Real financial authorisation must also verify shop owner and approval against server-held state **at each action**, and separately authenticate the customer at handover; a merchant's `handover_confirmed:true` checkbox or `payment_status:'paid'` remains only an attestation, not proof cash/card settled or code consumed.
- The mock local order route is a permission check, not the private SQL, production merchant identity data or live order/payout state. The R4.6 R500/12-person Bronze reservation is a fake lab ledger; actual bank backing, merchant consent, consumer terms and refund/charge disputes remain unproven. Future Gold R80/Platinum R150 food-credit balances and LocalPay wallet/company are NOT live.
- No production-safe checkout-time immutable Rewards eligibility integration, full refund audit, merchant external bank transfer, secure OTP code/QR experience, bank reconciliation, independent legal/POPIA review or release approval exists.
- Confirm users with revoked/disabled sessions receive a clear sign-in recovery path and that `verifyIdToken(...,true)` latency doesn't cause merchant order confirmation delays or cache/empty-list illusions. Do not silently fall back to unverified local session claims on an auth outage.
- A green CI run authorises neither Preview environment mutation nor Production. Preserve original UI/UX and draft PR status.

## Suggested next owner-gated phase

R4.9, if later authorised, should validate authenticated pickup/customer handover across an **independent real staging Firebase project and isolated staging DB**, measure worst-case login/merchant read latency, verify revoked/disabled user frontend recovery and actual shop scope, and then separately decide whether to merge the auth correction. Live LocalPay activation remains a separate financial/security/legal gate.

Source hierarchy: `LOCAL_EATS_MASTER_PLAN.md`, R4.8 README, R4.7/R4.6 test notes. Official Firebase Admin docs explain that `verifyIdToken(token,true)` is required for revocation and disabled-user checks and adds an extra backend network request.
