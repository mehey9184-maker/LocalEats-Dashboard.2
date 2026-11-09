import test from "node:test";
import assert from "node:assert/strict";
import {
  REWARDS_POLICY_R52N as policy,
  projectBronzeMissionReadOnly,
  reviewBronzePilotRelease,
  reviewPilotCapacity,
} from "./r52nPilotPolicy.js";

test("R52N new pilot policy does not copy superseded +40 / R125 / R200 rules", () => {
  assert.equal(policy.rollout, "NOT_LIVE");
  assert.equal(policy.firstPilot.kind, "BRONZE_ONLY");
  assert.equal(policy.firstPilot.qualifyingUnitsForOneGift, 4);
  assert.equal(policy.firstPilot.giftsPerCustomer, 1);
  assert.equal(policy.futureOnly.silverAtTotalUnits, 4);
  assert.equal(policy.futureOnly.goldAtTotalUnits, 24);
  assert.equal(policy.futureOnly.platinumAtTotalUnits, 54);
  assert.equal(policy.futureOnly.goldCreditMinor, 8_000);
  assert.equal(policy.futureOnly.platinumCreditMinor, 15_000);
  assert.equal(policy.futureOnly.creditValidityCalendarMonths, 36);
  assert.equal(policy.futureOnly.enabledInFirstPilot, false);
});

test("R52N R500 ceiling is not mistaken for spendable funds or R500 in rewards", () => {
  assert.equal(policy.firstPilot.approvedPlanningCeilingMinor, 50_000);
  assert.equal(policy.firstPilot.maximumParticipants, 12);
  assert.equal(policy.firstPilot.maxGiftMinor, 2_500);
  assert.equal(policy.firstPilot.maximumCommittedGiftExposureMinor, 30_000);
  assert.equal(policy.firstPilot.uncommittedPlanningBufferMinor, 20_000);
  assert.deepEqual(reviewPilotCapacity(12, 2_500), {
    withinPlanningCap: true,
    maximumGiftExposureMinor: 30_000,
    remainingPlanningBufferMinor: 20_000,
  });
  assert.equal(reviewPilotCapacity(13, 2_500).withinPlanningCap, false);
  assert.equal(reviewPilotCapacity(12, 2_501).withinPlanningCap, false);
  assert.equal(reviewPilotCapacity(12, 9_999).withinPlanningCap, false);
});

test("R52N 4 genuinely verified purchased units in one order would reach a threshold without issuing a gift", () => {
  assert.deepEqual(projectBronzeMissionReadOnly(4), {
    thresholdUnits: 4, progressUnits: 4, thresholdReached: true,
    grantsMade: 0, creditBalanceMinor: 0,
  });
  for (const input of [0, 1, 2, 3]) {
    const r = projectBronzeMissionReadOnly(input);
    assert.equal(r.progressUnits, input);
    assert.equal(r.thresholdReached, false);
  }
  assert.equal(projectBronzeMissionReadOnly(54).thresholdReached, true);
  assert.equal(projectBronzeMissionReadOnly(54).grantsMade, 0);
});

test("R52N reject malformed unit count and budget capacity", () => {
  for (const n of [-1, NaN, Infinity, -Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => projectBronzeMissionReadOnly(n), /INVALID_VERIFIED_UNIT_COUNT/);
  }
  for (const n of [-1, NaN, Infinity, 0.2, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => reviewPilotCapacity(n, 2_500), /INVALID_PILOT_CAPACITY/);
    assert.throws(() => reviewPilotCapacity(2, n), /INVALID_PILOT_CAPACITY/);
  }
  assert.throws(
    () => reviewPilotCapacity(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER),
    /PILOT_CAPACITY_OVERFLOW/,
  );
});

test("R52N default evidence refuses release, even when milestone and budget figures are known", () => {
  const result = reviewBronzePilotRelease();
  assert.equal(result.reviewReady, false);
  assert.ok(result.missingEvidence.includes("actualStagingRestorePassed"));
  assert.ok(result.missingEvidence.includes("ringfencedFundingMinor"));
  assert.ok(result.missingEvidence.includes("ownerSpecificProductionReleaseApproval"));
  assert.equal(reviewBronzePilotRelease({ringfencedFundingMinor: 0}).reviewReady, false);
  assert.equal(reviewBronzePilotRelease({ringfencedFundingMinor: 30_000}).reviewReady, false);
  assert.equal(reviewBronzePilotRelease({ringfencedFundingMinor: 50_001}).reviewReady, false);
});

test("R52N every individual proof is required; even fully reviewed result performs no activation", () => {
  const all = {
    ringfencedFundingMinor: 50_000,
    actualStagingRestorePassed: true,
    pickupOrderReadAndWriteAcceptancePassed: true,
    serverVerifiedCollectedPaymentEvidencePassed: true,
    immutablePurchaseIdempotencyPassed: true,
    merchantReimbursementAndDisputeProcessPassed: true,
    customerTermsAndShopParticipationApproved: true,
    authenticatedCustomerAndMerchantAcceptancePassed: true,
    ownerSpecificProductionReleaseApproval: true,
  } as const;
  assert.deepEqual(reviewBronzePilotRelease(all), {reviewReady:true,missingEvidence:[]});
  for (const key of Object.keys(all) as Array<keyof typeof all>) {
    const changed = {...all, [key]: typeof all[key] === "boolean" ? false : 0};
    const result = reviewBronzePilotRelease(changed);
    assert.equal(result.reviewReady, false, `Missing ${key} must block release review`);
    assert.ok(result.missingEvidence.includes(key), `Explain which gate failed: ${key}`);
  }
  assert.equal(policy.rollout, "NOT_LIVE");
});
