/**
 * R5.2N — pure offline Rewards policy and release-gate review.
 * NO DATABASE ROUTES, CUSTOMER GRANTS, PAYMENT ACTIONS OR FEATURE ACTIVATION.
 *
 * The backend alone must ultimately derive eligible paid-and-collected units
 * from authenticated immutable order evidence. This module does not verify
 * purchases and MUST NOT be called with browser-supplied counts to award credit.
 * See LOCAL_EATS_MASTER_PLAN.md RW-01, RW-08, RW-18, RW-19, RW-20.
 */
export const REWARDS_POLICY_R52N = Object.freeze({
  rollout: "NOT_LIVE",
  firstPilot: Object.freeze({
    kind: "BRONZE_ONLY",
    qualifyingUnitsForOneGift: 4,
    giftsPerCustomer: 1,
    maximumParticipants: 12,
    maxGiftMinor: 2_500, // R25.00
    approvedPlanningCeilingMinor: 50_000, // R500.00, NOT deposited funds
    maximumCommittedGiftExposureMinor: 30_000, // R300.00
    uncommittedPlanningBufferMinor: 20_000, // R200.00
  }),
  futureOnly: Object.freeze({
    silverAtTotalUnits: 4,
    goldAtTotalUnits: 24, // +20 after Silver
    platinumAtTotalUnits: 54, // +30 after Gold
    goldCreditMinor: 8_000, // R80.00, not pilot-funded
    platinumCreditMinor: 15_000, // R150.00, not pilot-funded
    creditValidityCalendarMonths: 36,
    enabledInFirstPilot: false,
  }),
});

export interface PilotReleaseEvidence {
  /** Real owner-confirmed money set aside; budget ceiling alone is not money. */
  ringfencedFundingMinor: number;
  /**
   * Evidence must be from a verified independent restore of the actual
   * isolated staging project's backup, not a disposable synthetic database.
   */
  actualStagingRestorePassed: boolean;
  pickupOrderReadAndWriteAcceptancePassed: boolean;
  serverVerifiedCollectedPaymentEvidencePassed: boolean;
  immutablePurchaseIdempotencyPassed: boolean;
  merchantReimbursementAndDisputeProcessPassed: boolean;
  customerTermsAndShopParticipationApproved: boolean;
  authenticatedCustomerAndMerchantAcceptancePassed: boolean;
  ownerSpecificProductionReleaseApproval: boolean;
}

/** Not an activation action. Only lists outstanding proof needed for review. */
export function reviewBronzePilotRelease(
  evidence: Partial<PilotReleaseEvidence> = {},
): {readonly reviewReady: boolean; readonly missingEvidence: readonly string[]} {
  const required: readonly (keyof PilotReleaseEvidence)[] = [
    "actualStagingRestorePassed",
    "pickupOrderReadAndWriteAcceptancePassed",
    "serverVerifiedCollectedPaymentEvidencePassed",
    "immutablePurchaseIdempotencyPassed",
    "merchantReimbursementAndDisputeProcessPassed",
    "customerTermsAndShopParticipationApproved",
    "authenticatedCustomerAndMerchantAcceptancePassed",
    "ownerSpecificProductionReleaseApproval",
  ];
  const missingEvidence = required.filter(key => evidence[key] !== true);
  if (evidence.ringfencedFundingMinor !== REWARDS_POLICY_R52N.firstPilot.approvedPlanningCeilingMinor) {
    missingEvidence.unshift("ringfencedFundingMinor");
  }
  return {reviewReady: missingEvidence.length === 0, missingEvidence};
}

export function projectBronzeMissionReadOnly(verifiedEligiblePaidCollectedUnits: number): {
  readonly thresholdUnits: 4;
  readonly progressUnits: number;
  readonly thresholdReached: boolean;
  readonly grantsMade: 0;
  readonly creditBalanceMinor: 0;
} {
  if (!Number.isSafeInteger(verifiedEligiblePaidCollectedUnits) || verifiedEligiblePaidCollectedUnits < 0) {
    throw new Error("INVALID_VERIFIED_UNIT_COUNT");
  }
  const progressUnits = Math.min(verifiedEligiblePaidCollectedUnits, 4);
  return {
    thresholdUnits: 4,
    progressUnits,
    thresholdReached: verifiedEligiblePaidCollectedUnits >= 4,
    grantsMade: 0,
    creditBalanceMinor: 0,
  };
}

/**
 * A static, non-authorizing projection of funded exposure.
 * No customer is enrolled by this function, and no promise is created.
 */
export function reviewPilotCapacity(participants: number, giftCapMinor: number): {
  readonly withinPlanningCap: boolean;
  readonly maximumGiftExposureMinor: number;
  readonly remainingPlanningBufferMinor: number;
} {
  if (!Number.isSafeInteger(participants) || participants < 0 ||
    !Number.isSafeInteger(giftCapMinor) || giftCapMinor < 0) {
    throw new Error("INVALID_PILOT_CAPACITY");
  }
  const cap = REWARDS_POLICY_R52N.firstPilot;
  const exposure = participants * giftCapMinor;
  if (!Number.isSafeInteger(exposure)) throw new Error("PILOT_CAPACITY_OVERFLOW");
  return {
    withinPlanningCap: participants <= cap.maximumParticipants &&
      giftCapMinor <= cap.maxGiftMinor && exposure <= cap.maximumCommittedGiftExposureMinor,
    maximumGiftExposureMinor: exposure,
    remainingPlanningBufferMinor: Math.max(0, cap.approvedPlanningCeilingMinor - exposure),
  };
}
