import crypto from "node:crypto";
import { Db, ObjectId } from "mongodb";
import { sendReferralQuotaReachedEmail } from "@/lib/email/resend";
import { logger } from "@/lib/observability/logger";
import {
  CommissionDocument,
  getCommissionsCollection,
  getReferralProfilesCollection,
  getUsersCollection,
  MAX_SUCCESSFUL_REFERRALS_PER_USER,
  ReferralProfileDocument,
  SupportedCurrency,
  UserDocument,
} from "@/lib/db/models";

export const REFERRAL_CODE_REGEX = /^[A-Z0-9_-]{4,24}$/;

/**
 * Derives a human-readable prefix strictly from a user's display name.
 * - Extracts uppercase letters A-Z only.
 * - Trims to between 3 and 10 characters.
 * - Falls back to "LINGO" only when the display name contains no usable characters.
 * - Does NOT use the email address as the prefix source.
 */
export function deriveReferralPrefix(displayName?: string | null): string {
  if (!displayName || typeof displayName !== "string") {
    return "LINGO";
  }

  // Take the first token before spaces or punctuation
  const rawToken = displayName.split(/[\s_\-.]+/)[0] || "";
  const cleaned = rawToken.toUpperCase().replace(/[^A-Z]/g, "");

  if (cleaned.length >= 3) {
    return cleaned.slice(0, 10);
  }

  // If first token is too short, try the full display name letters
  const fullCleaned = displayName.toUpperCase().replace(/[^A-Z]/g, "");
  if (fullCleaned.length >= 3) {
    return fullCleaned.slice(0, 10);
  }

  return "LINGO";
}

/**
 * Generates a 4-digit numeric string in the range [1111, 9999] using
 * crypto.randomInt(1111, 10000) converted to a string, ensuring no zeroes.
 */
export function generateFourDigitSuffix(): string {
  let num: number;
  do {
    num = crypto.randomInt(1111, 10000);
  } while (String(num).includes("0"));
  return String(num);
}

/**
 * Formats a full human-readable referral code: [PREFIX][4_DIGITS], e.g. "RAJAT4821"
 */
export function formatHumanReadableReferralCode(prefix: string): string {
  const cleanPrefix = deriveReferralPrefix(prefix);
  return `${cleanPrefix}${generateFourDigitSuffix()}`;
}

/**
 * Validates a referral code format.
 */
export function isValidReferralCodeFormat(code: unknown): code is string {
  if (typeof code !== "string") return false;
  const trimmed = code.trim().toUpperCase();
  return REFERRAL_CODE_REGEX.test(trimmed);
}

/**
 * Finds an active referral profile by code (case-insensitive lookup).
 * Returns null if not found or not active.
 */
export async function findActiveReferralProfileByCode(
  db: Db,
  rawCode: string
): Promise<ReferralProfileDocument | null> {
  if (!isValidReferralCodeFormat(rawCode)) {
    return null;
  }

  const referralProfilesCol = await getReferralProfilesCollection(db);
  const normalizedCode = rawCode.trim().toUpperCase();

  const profile = await referralProfilesCol.findOne({
    referralCode: normalizedCode,
    status: "active",
  });

  return profile;
}

export interface ReferralValidationResult {
  valid: boolean;
  code: string;
  discountPercent: number;
  message: string;
  error?: string;
}

/**
 * Public server-side referral code validator.
 * Prevents account enumeration while providing clear discount confirmation.
 */
export async function validateCustomerReferralCode(
  db: Db,
  rawCode: string,
  currentUserId?: string | ObjectId | null
): Promise<ReferralValidationResult> {
  const normalizedCode = (rawCode || "").trim().toUpperCase();

  if (!isValidReferralCodeFormat(normalizedCode)) {
    return {
      valid: false,
      code: normalizedCode,
      discountPercent: 0,
      message: "Please enter a valid 4–24 character referral code.",
      error: "INVALID_FORMAT",
    };
  }

  const profile = await findActiveReferralProfileByCode(db, normalizedCode);

  if (!profile) {
    return {
      valid: false,
      code: normalizedCode,
      discountPercent: 0,
      message: "This referral code is not recognized or is no longer active.",
      error: "CODE_NOT_FOUND",
    };
  }

  // Self-referral prohibition check
  if (currentUserId && profile.userId.toString() === currentUserId.toString()) {
    return {
      valid: false,
      code: normalizedCode,
      discountPercent: 0,
      message: "You cannot apply your own referral code.",
      error: "SELF_REFERRAL_FORBIDDEN",
    };
  }

  // Check capacity limit
  if (
    profile.successfulConversionsCount >= profile.maxReferralsCap ||
    profile.riskReviewRequired
  ) {
    return {
      valid: false,
      code: normalizedCode,
      discountPercent: 0,
      message: "This referral program slot has reached capacity.",
      error: "CAPACITY_REACHED",
    };
  }

  return {
    valid: true,
    code: normalizedCode,
    discountPercent: 10,
    message: "10% Referral Discount will be applied at checkout!",
  };
}

/**
 * Retrieves or lazily creates a stable referral profile for an authenticated user.
 * Guarantees uniqueness, concurrency safety, and human-readable formatting [PREFIX][4_DIGITS].
 */
export async function getOrCreateReferralProfile(
  db: Db,
  user: UserDocument,
  now = new Date()
): Promise<ReferralProfileDocument> {
  const referralProfilesCol = await getReferralProfilesCollection(db);

  // 1. Check if user already has an active referral profile, or any profile
  const existingActive = await referralProfilesCol.findOne({
    userId: user._id,
    status: "active",
  });
  if (existingActive) {
    return existingActive;
  }
  const existingAny = await referralProfilesCol.findOne(
    { userId: user._id },
    { sort: { createdAt: -1 } }
  );
  if (existingAny) {
    return existingAny;
  }

  // 2. Derive base prefix strictly from user's display name (not email)
  const prefix = deriveReferralPrefix(user.name);

  // 3. Attempt unique insertion with collision retry
  let attempts = 0;
  const maxAttempts = 15;

  while (attempts < maxAttempts) {
    attempts++;
    const candidateCode = `${prefix}${generateFourDigitSuffix()}`;

    // Synthetic qualifying purchase ID for organic referrer profiles
    const qualifyingPurchaseId = new ObjectId();

    const newProfile: ReferralProfileDocument = {
      _id: new ObjectId(),
      userId: user._id,
      qualifyingPurchaseId,
      referralCode: candidateCode,
      status: "active",
      maxReferralsCap: MAX_SUCCESSFUL_REFERRALS_PER_USER,
      pendingReservedCount: 0,
      successfulConversionsCount: 0,
      payoutMethod: "unset",
      payoutDetailsEncryptedOrRef: null,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await referralProfilesCol.insertOne(newProfile);
      return newProfile;
    } catch (err: unknown) {
      // E11000 duplicate key error on referralCode or userId
      const isDuplicateKey =
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code?: number }).code === 11000;

      if (!isDuplicateKey) {
        throw err;
      }

      // Check if another concurrent request created the profile for this user
      const existingAfterCollision = await referralProfilesCol.findOne({
        userId: user._id,
      });
      if (existingAfterCollision) {
        return existingAfterCollision;
      }

      // If duplicate referralCode, loop around to try another 4-digit suffix
    }
  }

  throw new Error(
    "Failed to generate a unique referral code after multiple attempts. Please try again."
  );
}

export interface HistoricalReferralCodeSummary {
  code: string;
  referralCode: string;
  status: string;
  successfulPaidReferrals: number;
  successfulConversionsCount: number;
  maxCapacity: number;
  maxReferralsCap: number;
  createdAt: string;
  exhaustedAt: string | null;
}

export interface CustomerReferralStats {
  referralCode: string;
  shareableUrl: string;
  registeredCount: number;
  successfulPaidReferrals: number;
  remainingCapacity: number;
  maxCapacity: number;
  isExhausted: boolean;
  canRegenerate: boolean;
  historicalCodes?: HistoricalReferralCodeSummary[];
  earningsByCurrency: Record<
    SupportedCurrency,
    {
      pendingSubunits: number;
      eligibleSubunits: number;
      paidSubunits: number;
      totalEarnedSubunits: number;
    }
  >;
}

/**
 * Returns customer-facing referral dashboard statistics for the authenticated user.
 * Segregates earnings cleanly by currency (INR, USD, EUR) without combining them.
 */
export async function getCustomerReferralDashboardData(
  db: Db,
  user: UserDocument
): Promise<CustomerReferralStats> {
  const profile = await getOrCreateReferralProfile(db, user);
  const usersCol = await getUsersCollection(db);
  const commissionsCol = await getCommissionsCollection(db);

  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.lingopdf.in";
  const shareableUrl = `${appBaseUrl}/r/${profile.referralCode}`;

  const referralProfilesCol = await getReferralProfilesCollection(db);
  const [registeredCount, userCommissions, allProfiles] = await Promise.all([
    usersCol.countDocuments({ referredByUserId: user._id }),
    commissionsCol.find({ referrerUserId: user._id }).toArray(),
    referralProfilesCol.find({ userId: user._id }).sort({ createdAt: -1 }).toArray(),
  ]);

  const earningsByCurrency: CustomerReferralStats["earningsByCurrency"] = {
    INR: {
      pendingSubunits: 0,
      eligibleSubunits: 0,
      paidSubunits: 0,
      totalEarnedSubunits: 0,
    },
    USD: {
      pendingSubunits: 0,
      eligibleSubunits: 0,
      paidSubunits: 0,
      totalEarnedSubunits: 0,
    },
    EUR: {
      pendingSubunits: 0,
      eligibleSubunits: 0,
      paidSubunits: 0,
      totalEarnedSubunits: 0,
    },
  };

  for (const c of userCommissions) {
    const cur = c.currency as SupportedCurrency;
    if (!earningsByCurrency[cur]) continue;

    if (c.status === "paid") {
      earningsByCurrency[cur].paidSubunits += c.commissionAmountSubunits;
      earningsByCurrency[cur].totalEarnedSubunits += c.commissionAmountSubunits;
    } else if (c.status === "eligible" || c.status === "approved") {
      earningsByCurrency[cur].eligibleSubunits += c.commissionAmountSubunits;
      earningsByCurrency[cur].totalEarnedSubunits += c.commissionAmountSubunits;
    } else if (c.status === "pending") {
      earningsByCurrency[cur].pendingSubunits += c.commissionAmountSubunits;
      earningsByCurrency[cur].totalEarnedSubunits += c.commissionAmountSubunits;
    }
  }

  const remainingCapacity = Math.max(
    0,
    profile.maxReferralsCap -
      profile.successfulConversionsCount -
      profile.pendingReservedCount
  );

  const isExhausted =
    profile.status === "exhausted" ||
    profile.successfulConversionsCount >= profile.maxReferralsCap;
  const canRegenerate = isExhausted;

  const historicalCodes: HistoricalReferralCodeSummary[] = allProfiles.map((p) => ({
    code: p.referralCode,
    referralCode: p.referralCode,
    status: p.status,
    successfulPaidReferrals: p.successfulConversionsCount,
    successfulConversionsCount: p.successfulConversionsCount,
    maxCapacity: p.maxReferralsCap,
    maxReferralsCap: p.maxReferralsCap,
    createdAt: p.createdAt ? p.createdAt.toISOString() : "",
    exhaustedAt: p.exhaustedAt ? p.exhaustedAt.toISOString() : null,
  }));

  return {
    referralCode: profile.referralCode,
    shareableUrl,
    registeredCount,
    successfulPaidReferrals: profile.successfulConversionsCount,
    remainingCapacity,
    maxCapacity: profile.maxReferralsCap,
    isExhausted,
    canRegenerate,
    historicalCodes,
    earningsByCurrency,
  };
}

export interface ReserveCapacityOptions {
  referrerUserId: ObjectId;
  referralCode: string;
  purchaserUserId: ObjectId;
  purchaseId: ObjectId;
  now?: Date;
}

export interface ReserveCapacityResult {
  ok: boolean;
  profileId?: ObjectId;
  reason?:
    | "self_referral_forbidden"
    | "referral_not_found"
    | "referral_inactive"
    | "capacity_exhausted";
}

/**
 * Atomically reserves 1 slot of referral capacity during checkout.
 * Enforces self-referral prevention and the strict 50 lifetime conversion cap.
 */
export async function reserveReferralCapacityAtomically(
  db: Db,
  options: ReserveCapacityOptions
): Promise<ReserveCapacityResult> {
  const { referrerUserId, referralCode, purchaserUserId, now = new Date() } = options;

  if (referrerUserId.equals(purchaserUserId)) {
    return { ok: false, reason: "self_referral_forbidden" };
  }

  const profilesCol = await getReferralProfilesCollection(db);

  // Atomically increment pendingReservedCount only if (successful + pending) < 50
  const updated = await profilesCol.findOneAndUpdate(
    {
      userId: referrerUserId,
      referralCode: referralCode.trim().toUpperCase(),
      status: "active",
      $expr: {
        $lt: [
          { $add: ["$successfulConversionsCount", "$pendingReservedCount"] },
          "$maxReferralsCap",
        ],
      },
    },
    {
      $inc: { pendingReservedCount: 1 },
      $set: { updatedAt: now },
    },
    { returnDocument: "after" }
  );

  if (!updated) {
    const existing = await profilesCol.findOne({
      userId: referrerUserId,
      referralCode: referralCode.trim().toUpperCase(),
    });

    if (!existing) {
      return { ok: false, reason: "referral_not_found" };
    }
    if (existing.status !== "active") {
      return { ok: false, reason: "referral_inactive" };
    }
    return { ok: false, reason: "capacity_exhausted" };
  }

  return { ok: true, profileId: updated._id };
}

export interface ReleaseCapacityOptions {
  referrerUserId: ObjectId;
  now?: Date;
}

/**
 * Releases a pending capacity reservation when checkout fails, is abandoned, or payment expires.
 * Invariant 4: Failed or abandoned checkouts never consume capacity.
 */
export async function releaseReferralReservation(
  db: Db,
  options: ReleaseCapacityOptions
): Promise<void> {
  const { referrerUserId, now = new Date() } = options;
  const profilesCol = await getReferralProfilesCollection(db);

  await profilesCol.updateOne(
    {
      userId: referrerUserId,
      pendingReservedCount: { $gt: 0 },
    },
    {
      $inc: { pendingReservedCount: -1 },
      $set: { updatedAt: now },
    }
  );
}

export interface FinalizeRedemptionOptions {
  referrerUserId: ObjectId;
  purchaserUserId: ObjectId;
  purchaseId: ObjectId;
  currency: SupportedCurrency;
  paidAmountMinor: number;
  capturedAt?: Date;
}

export interface FinalizeRedemptionResult {
  ok: boolean;
  commissionId: ObjectId;
}

/**
 * Finalizes referral capacity consumption upon successful payment capture.
 * - Invariant 3: Only successful paid purchases consume 1 of the 50 lifetime slots.
 * - Invariant 8: Commission is 10% of the actual collected amount after discount.
 * - Invariant 9: Commission hold is exactly 72 hours from the purchase timestamp.
 */
export async function finalizeCapturedReferralRedemption(
  db: Db,
  options: FinalizeRedemptionOptions
): Promise<FinalizeRedemptionResult> {
  const {
    referrerUserId,
    purchaserUserId,
    purchaseId,
    currency,
    paidAmountMinor,
    capturedAt = new Date(),
  } = options;

  const profilesCol = await getReferralProfilesCollection(db);
  const commissionsCol = await getCommissionsCollection(db);

  // Atomically transition 1 pending reservation to successful conversion
  const updatedProfile = await profilesCol.findOneAndUpdate(
    {
      userId: referrerUserId,
      pendingReservedCount: { $gt: 0 },
    },
    {
      $inc: { pendingReservedCount: -1, successfulConversionsCount: 1 },
      $set: { updatedAt: capturedAt },
    },
    { returnDocument: "after" }
  );

  if (!updatedProfile) {
    throw new Error("REFERRAL_RESERVATION_NOT_FOUND");
  }

  // If this purchase completed the 50-redemption quota, mark the code as exhausted
  if (
    updatedProfile.successfulConversionsCount >= updatedProfile.maxReferralsCap &&
    updatedProfile.status !== "exhausted"
  ) {
    await profilesCol.updateOne(
      { _id: updatedProfile._id },
      {
        $set: {
          status: "exhausted",
          exhaustedAt: capturedAt,
          updatedAt: capturedAt,
        },
      }
    );
    updatedProfile.status = "exhausted";
    updatedProfile.exhaustedAt = capturedAt;
  }

  // Calculate 10% commission on actual collected amount
  const commissionAmount = Math.round(paidAmountMinor * 0.1);
  const holdUntil = new Date(capturedAt.getTime() + 72 * 60 * 60 * 1000);

  const commissionDoc: CommissionDocument = {
    _id: new ObjectId(),
    referrerUserId,
    referralProfileId: updatedProfile._id,
    referredUserId: purchaserUserId,
    purchaseId,
    currency,
    netCollectedSubunits: paidAmountMinor,
    commissionRatePercent: 10,
    commissionAmountSubunits: commissionAmount,
    status: "pending",
    purchaseCapturedAt: capturedAt,
    holdUntil,
    isDisputedHold: false,
    eligibleAt: null,
    approvedAt: null,
    approvedByAdminId: null,
    payoutId: null,
    paidAt: null,
    cancelledAt: null,
    cancellationReason: null,
    createdAt: capturedAt,
    updatedAt: capturedAt,
  };

  await commissionsCol.insertOne(commissionDoc);

  return { ok: true, commissionId: commissionDoc._id };
}

export interface CalculatePurchasePricingOptions {
  basePriceSubunits: number;
  taxSubunits?: number;
  referralProfile?: ReferralProfileDocument | null;
  promoApplied?: boolean;
  promoDiscountPercent?: 5 | 10 | 15 | 20;
}

export interface CalculatedPurchasePricing {
  basePriceSubunits: number;
  discountPercentApplied: 0 | 10 | 5 | 15 | 20;
  discountSubunits: number;
  taxSubunits: number;
  totalSubunits: number;
  promoApplied: boolean;
  referralCodeApplied: string | null;
  referrerUserId: ObjectId | null;
  referralProfileId: ObjectId | null;
  commissionAmountSubunits: number;
}

/**
 * Authoritative Server-Side Purchase Pricing Calculator.
 * - Prevents customer price, discount, and referrer ID manipulation.
 * - Prohibits stacking promotional and referral discounts.
 * - Applies exact 10% referral discount when a valid referral profile is provided.
 * - Calculates 10% commission on the actual net collected amount after discount.
 */
export function calculateReferralPurchasePricing(
  options: CalculatePurchasePricingOptions
): CalculatedPurchasePricing {
  const {
    basePriceSubunits,
    taxSubunits = 0,
    referralProfile,
    promoApplied = false,
    promoDiscountPercent,
  } = options;

  if (basePriceSubunits <= 0) {
    throw new Error("INVALID_BASE_PRICE");
  }

  const hasReferral = Boolean(
    referralProfile && referralProfile.status === "active"
  );
  const hasPromo = Boolean(promoApplied && promoDiscountPercent);

  // Invariant 7: Promotional and referral discounts NEVER stack
  if (hasReferral && hasPromo) {
    throw new Error("DISCOUNT_STACKING_PROHIBITED");
  }

  let discountPercentApplied: 0 | 10 | 5 | 15 | 20 = 0;
  let discountSubunits = 0;
  let referralCodeApplied: string | null = null;
  let referrerUserId: ObjectId | null = null;
  let referralProfileId: ObjectId | null = null;

  if (hasReferral && referralProfile) {
    // Invariant 6: Customer referral discount is fixed at 10%
    discountPercentApplied = 10;
    discountSubunits = Math.floor((basePriceSubunits * 10) / 100);
    referralCodeApplied = referralProfile.referralCode;
    referrerUserId = referralProfile.userId;
    referralProfileId = referralProfile._id;
  } else if (hasPromo && promoDiscountPercent) {
    discountPercentApplied = promoDiscountPercent;
    discountSubunits = Math.floor((basePriceSubunits * promoDiscountPercent) / 100);
  }

  const totalSubunits = basePriceSubunits - discountSubunits + taxSubunits;

  // Invariant 8: Commission is 10% of the actual collected amount after discount
  const commissionAmountSubunits = hasReferral
    ? Math.round(totalSubunits * 0.1)
    : 0;

  return {
    basePriceSubunits,
    discountPercentApplied,
    discountSubunits,
    taxSubunits,
    totalSubunits,
    promoApplied: hasPromo,
    referralCodeApplied,
    referrerUserId,
    referralProfileId,
    commissionAmountSubunits,
  };
}

/**
 * Triggers an idempotent, durable quota-completion email notification when a code reaches 50 redemptions.
 * Guaranteed to execute at most once per referral code via atomic status transition.
 * Email delivery failures are safely recorded and do not fail the purchase.
 */
export async function triggerReferralQuotaNotification(
  db: Db,
  profile: ReferralProfileDocument,
  now = new Date()
): Promise<void> {
  const profilesCol = await getReferralProfilesCollection(db);

  // 1. Atomically claim notification execution rights
  const claim = await profilesCol.findOneAndUpdate(
    {
      _id: profile._id,
      quotaNotificationStatus: { $in: [null, undefined] },
    },
    {
      $set: {
        quotaNotificationStatus: "pending",
        updatedAt: now,
      },
    },
    { returnDocument: "after" }
  );

  if (!claim) {
    // Already claimed or previously sent (e.g. duplicate webhook replay); exit safely
    return;
  }

  // 2. Retrieve referrer email and name
  try {
    const usersCol = await getUsersCollection(db);
    const referrer = await usersCol.findOne({ _id: profile.userId });
    if (!referrer || !referrer.email) {
      await profilesCol.updateOne(
        { _id: profile._id },
        {
          $set: {
            quotaNotificationStatus: "failed",
            quotaNotificationError: "Referrer user or email not found",
            updatedAt: new Date(),
          },
        }
      );
      return;
    }

    // 3. Send notification email via Resend
    const sendResult = await sendReferralQuotaReachedEmail({
      to: referrer.email,
      name: referrer.name || undefined,
      referralCode: profile.referralCode,
    });

    if (sendResult.success) {
      await profilesCol.updateOne(
        { _id: profile._id },
        {
          $set: {
            quotaNotificationStatus: "sent",
            quotaNotificationSentAt: new Date(),
            quotaNotificationMessageId: sendResult.messageId || null,
            updatedAt: new Date(),
          },
        }
      );
    } else {
      await profilesCol.updateOne(
        { _id: profile._id },
        {
          $set: {
            quotaNotificationStatus: "failed",
            quotaNotificationError: sendResult.error || "Email delivery failed",
            updatedAt: new Date(),
          },
        }
      );
      logger.error("referral_quota_email_delivery_failed", {
        profileId: profile._id.toString(),
        code: sendResult.code,
      });
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error("referral_quota_notification_exception", {
      profileId: profile._id.toString(),
      error: errorMsg,
    });
    await profilesCol.updateOne(
      { _id: profile._id },
      {
        $set: {
          quotaNotificationStatus: "failed",
          quotaNotificationError: errorMsg,
          updatedAt: new Date(),
        },
      }
    ).catch(() => {});
  }
}

/**
 * Regenerates a new referral code for an existing referrer who has fully exhausted their current code.
 * Strict Server Enforcement:
 * - Current code must have completed all 50 successful redemptions.
 * - Previous code is marked as permanently exhausted.
 * - Only one active code may exist per referrer.
 * - Race conditions and concurrent requests are strictly prevented by database partial unique index.
 */
export async function regenerateReferralCode(
  db: Db,
  user: UserDocument,
  now = new Date()
): Promise<ReferralProfileDocument> {
  const profilesCol = await getReferralProfilesCollection(db);

  // 1. Verify user's current referral status:
  // Must NOT have any active code that hasn't completed all 50 redemptions
  const activeProfiles = await profilesCol
    .find({ userId: user._id, status: { $ne: "exhausted" } })
    .toArray();

  for (const p of activeProfiles) {
    if (p.successfulConversionsCount < p.maxReferralsCap) {
      throw new Error(
        "QUOTA_NOT_EXHAUSTED: Current referral code has not reached its limit of 50 successful redemptions."
      );
    }
    // If it reached 50 but status wasn't marked "exhausted" yet, transition it now
    if (p.status !== "exhausted") {
      await profilesCol.updateOne(
        { _id: p._id },
        { $set: { status: "exhausted", exhaustedAt: p.exhaustedAt || now, updatedAt: now } }
      );
    }
  }

  // Double check no active code remains
  const activeCheck = await profilesCol.findOne({
    userId: user._id,
    status: { $ne: "exhausted" },
  });
  if (activeCheck) {
    throw new Error(
      "ACTIVE_CODE_ALREADY_EXISTS: You already have an active referral code."
    );
  }

  // 2. Generate a new unique code [PREFIX][4_DIGITS] with collision handling
  const prefix = deriveReferralPrefix(user.name);
  let attempts = 0;
  const maxAttempts = 15;

  while (attempts < maxAttempts) {
    attempts++;
    const candidateCode = `${prefix}${generateFourDigitSuffix()}`;
    const qualifyingPurchaseId = new ObjectId();

    const newProfile: ReferralProfileDocument = {
      _id: new ObjectId(),
      userId: user._id,
      qualifyingPurchaseId,
      referralCode: candidateCode,
      status: "active",
      maxReferralsCap: MAX_SUCCESSFUL_REFERRALS_PER_USER,
      pendingReservedCount: 0,
      successfulConversionsCount: 0,
      payoutMethod: "unset",
      payoutDetailsEncryptedOrRef: null,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await profilesCol.insertOne(newProfile);
      return newProfile;
    } catch (err: unknown) {
      const isDuplicateKey =
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code?: number }).code === 11000;

      if (!isDuplicateKey) {
        throw err;
      }

      // If duplicate key was on userId, another concurrent request already created the new code
      const existingActive = await profilesCol.findOne({
        userId: user._id,
        status: { $ne: "exhausted" },
      });
      if (existingActive) {
        return existingActive;
      }

      // If duplicate was on candidateCode, loop around for another 4-digit suffix
    }
  }

  throw new Error(
    "Failed to generate a unique referral code after multiple attempts. Please try again."
  );
}
