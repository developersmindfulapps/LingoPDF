import { ClientSession, Db, MongoClient, ObjectId } from "mongodb";
import { z } from "zod";
import {
  ALLOWED_PROMOTIONAL_DISCOUNT_PERCENTS,
  COMMISSION_HOLD_WINDOW_HOURS,
  COMMISSION_HOLD_WINDOW_MS,
  CommissionAdjustmentDocument,
  CommissionAdjustmentReason,
  CommissionAdjustmentResolutionStatus,
  CommissionDocument,
  CommissionStatus,
  EntitlementDocument,
  EntitlementRestrictionReason,
  EntitlementRevocationReason,
  EntitlementStatus,
  ImmutableRecordError,
  MAX_SUCCESSFUL_REFERRALS_PER_USER,
  MIN_ELIGIBLE_COMMISSIONS_FOR_PAYOUT,
  PaymentProvider,
  PaymentWebhookDocument,
  PayoutDocument,
  PayoutStatus,
  PromotionalDiscountPercent,
  PromotionMode,
  PromotionSettingsDocument,
  PurchaseDocument,
  PurchaseEvidenceDocument,
  PurchaseRegion,
  PurchaseStatus,
  REFERRAL_COMMISSION_PERCENT,
  REFERRAL_CUSTOMER_DISCOUNT_PERCENT,
  ReferralPayoutMethod,
  ReferralProfileDocument,
  ReferralProfileStatus,
  SupportedCurrency,
  WebhookProcessingStatus,
} from "@/lib/db/models";

export {
  ImmutableRecordError,
  ALLOWED_PROMOTIONAL_DISCOUNT_PERCENTS,
  REFERRAL_CUSTOMER_DISCOUNT_PERCENT,
  REFERRAL_COMMISSION_PERCENT,
  COMMISSION_HOLD_WINDOW_HOURS,
  COMMISSION_HOLD_WINDOW_MS,
  MAX_SUCCESSFUL_REFERRALS_PER_USER,
  MIN_ELIGIBLE_COMMISSIONS_FOR_PAYOUT,
};

// ---------------------------------------------------------------------------
// 1. Domain & Data-Access Errors
// ---------------------------------------------------------------------------

export class InvalidStateTransitionError extends Error {
  public readonly code = "INVALID_STATE_TRANSITION";

  constructor(message: string) {
    super(message);
    this.name = "InvalidStateTransitionError";
  }
}

export class DataValidationError extends Error {
  public readonly code = "DATA_VALIDATION_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "DataValidationError";
  }
}

export class TopologyVerificationError extends Error {
  public readonly code = "TOPOLOGY_VERIFICATION_FAILED";

  constructor(message: string) {
    super(message);
    this.name = "TopologyVerificationError";
  }
}

// ---------------------------------------------------------------------------
// 2. Shared Primitive Validators
// ---------------------------------------------------------------------------

const objectIdSchema = z.custom<ObjectId>(
  (val) => val instanceof ObjectId,
  { message: "Must be a valid MongoDB ObjectId instance" }
);

export const supportedCurrencySchema = z.enum(["INR", "USD", "EUR"]);
export const purchaseRegionSchema = z.enum(["IN", "US", "EU"]);
export const paymentProviderSchema = z.enum(["razorpay", "paddle"]);

const nonNegativeSubunitsSchema = z
  .number()
  .int({ message: "Monetary subunits must be an integer" })
  .min(0, { message: "Monetary subunits cannot be negative" });

const positiveSubunitsSchema = z
  .number()
  .int({ message: "Monetary subunits must be an integer" })
  .min(1, { message: "Monetary subunits must be greater than zero" });

const allowedPromoPercentSet = new Set<number>(
  ALLOWED_PROMOTIONAL_DISCOUNT_PERCENTS
);

// ---------------------------------------------------------------------------
// 3. Purchase Validation & State-Transition Guards
// ---------------------------------------------------------------------------

export const purchaseCreateSchema = z
  .object({
    userId: objectIdSchema,
    productSlug: z.string().trim().min(1).max(100),
    editionVersion: z.string().trim().min(1).max(32),
    region: purchaseRegionSchema,
    currency: supportedCurrencySchema,
    pricingSnapshot: z.object({
      basePriceSubunits: positiveSubunitsSchema,
      discountPercentApplied: z
        .union([
          z.literal(0),
          z.literal(5),
          z.literal(10),
          z.literal(15),
          z.literal(20),
        ])
        .optional(),
      discountSubunits: nonNegativeSubunitsSchema,
      taxSubunits: nonNegativeSubunitsSchema,
      totalSubunits: positiveSubunitsSchema,
      promoApplied: z.boolean(),
      referralCodeApplied: z
        .string()
        .trim()
        .toUpperCase()
        .min(3)
        .max(32)
        .nullable(),
    }),
    paymentProvider: paymentProviderSchema,
    providerOrderId: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .nullable()
      .optional()
      .default(null),
    providerPaymentId: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .nullable()
      .optional()
      .default(null),
    idempotencyKey: z.string().trim().min(8).max(128),
    status: z
      .enum([
        "pending",
        "captured",
        "refunded",
        "partially_refunded",
        "disputed",
        "chargeback_lost",
        "failed",
      ])
      .default("pending"),
    referrerUserId: objectIdSchema.nullable().default(null),
    referralProfileId: objectIdSchema.nullable().default(null),
    paddleTransactionId: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .nullable()
      .optional()
      .default(null),
    paddleCustomerId: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .nullable()
      .optional()
      .default(null),
    paddleCheckoutUrl: z
      .string()
      .trim()
      .nullable()
      .optional()
      .default(null),
  })
  .superRefine((data, ctx) => {
    // 1. Region <-> currency invariant check per Stage 3B.1
    if (data.region === "IN" && data.currency !== "INR") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "India (IN) purchases must use INR currency",
        path: ["currency"],
      });
    }
    if (data.region !== "IN" && data.currency === "INR") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "International purchases must never use INR currency",
        path: ["currency"],
      });
    }

    // 2. Promotion and referral discounts cannot stack
    const hasPromo = data.pricingSnapshot.promoApplied === true;
    const hasReferral = data.pricingSnapshot.referralCodeApplied !== null;

    if (hasPromo && hasReferral) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Promotional and referral discounts cannot stack",
        path: ["pricingSnapshot", "promoApplied"],
      });
      return;
    }

    // 3. Enforce discount percentage and amount rules
    const base = data.pricingSnapshot.basePriceSubunits;
    const discount = data.pricingSnapshot.discountSubunits;
    const explicitPct = data.pricingSnapshot.discountPercentApplied;

    if (hasReferral) {
      if (
        explicitPct !== undefined &&
        explicitPct !== REFERRAL_CUSTOMER_DISCOUNT_PERCENT
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Referral customer discount is fixed at ${REFERRAL_CUSTOMER_DISCOUNT_PERCENT}%`,
          path: ["pricingSnapshot", "discountPercentApplied"],
        });
      }
      const expectedReferralDiscount = Math.floor(
        (base * REFERRAL_CUSTOMER_DISCOUNT_PERCENT) / 100
      );
      if (discount !== expectedReferralDiscount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Referral discountSubunits (${discount}) must equal ${REFERRAL_CUSTOMER_DISCOUNT_PERCENT}% of basePriceSubunits (${expectedReferralDiscount})`,
          path: ["pricingSnapshot", "discountSubunits"],
        });
      }
    } else if (hasPromo) {
      if (explicitPct !== undefined && !allowedPromoPercentSet.has(explicitPct)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Promotional discount percent must be 5%, 10%, 15%, or 20%",
          path: ["pricingSnapshot", "discountPercentApplied"],
        });
      }
      const matchingPct = ALLOWED_PROMOTIONAL_DISCOUNT_PERCENTS.find(
        (pct) => Math.floor((base * pct) / 100) === discount
      );
      if (
        !matchingPct ||
        (explicitPct !== undefined && explicitPct !== matchingPct)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Promotional discountSubunits must match an approved 5%, 10%, 15%, or 20% discount of basePriceSubunits",
          path: ["pricingSnapshot", "discountSubunits"],
        });
      }
    } else {
      if (explicitPct !== undefined && explicitPct !== 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "discountPercentApplied must be 0 when neither promotional nor referral discount is applied",
          path: ["pricingSnapshot", "discountPercentApplied"],
        });
      }
      if (discount !== 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "discountSubunits must be 0 when neither promotional nor referral discount is applied",
          path: ["pricingSnapshot", "discountSubunits"],
        });
      }
    }

    // 4. Total subunits arithmetic check
    const expectedTotal =
      data.pricingSnapshot.basePriceSubunits -
      data.pricingSnapshot.discountSubunits +
      data.pricingSnapshot.taxSubunits;

    if (expectedTotal !== data.pricingSnapshot.totalSubunits) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "pricingSnapshot.totalSubunits must equal basePriceSubunits - discountSubunits + taxSubunits",
        path: ["pricingSnapshot", "totalSubunits"],
      });
    }

    // 5. Captured purchases must have populated providerOrderId and providerPaymentId
    if (data.status === "captured") {
      if (!data.providerOrderId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Captured purchase requires a populated providerOrderId",
          path: ["providerOrderId"],
        });
      }
      if (!data.providerPaymentId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Captured purchase requires a populated providerPaymentId",
          path: ["providerPaymentId"],
        });
      }
    }

    // 6. Self-referral prohibition
    if (data.referrerUserId && data.referrerUserId.equals(data.userId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Self-referral is prohibited on purchase creation",
        path: ["referrerUserId"],
      });
    }
  });

export type PurchaseCreateInput = z.input<typeof purchaseCreateSchema>;

export function buildPurchaseDocument(
  input: PurchaseCreateInput,
  now = new Date()
): PurchaseDocument {
  const parsed = purchaseCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new DataValidationError(
      parsed.error.issues[0]?.message || "Invalid purchase document input"
    );
  }

  const d = parsed.data;
  let resolvedPct: 0 | PromotionalDiscountPercent = 0;
  if (d.pricingSnapshot.referralCodeApplied !== null) {
    resolvedPct = REFERRAL_CUSTOMER_DISCOUNT_PERCENT;
  } else if (d.pricingSnapshot.promoApplied) {
    resolvedPct =
      (d.pricingSnapshot.discountPercentApplied as PromotionalDiscountPercent) ??
      ALLOWED_PROMOTIONAL_DISCOUNT_PERCENTS.find(
        (pct) =>
          Math.floor((d.pricingSnapshot.basePriceSubunits * pct) / 100) ===
          d.pricingSnapshot.discountSubunits
      )!;
  }

  return {
    _id: new ObjectId(),
    userId: d.userId,
    productSlug: d.productSlug,
    editionVersion: d.editionVersion,
    region: d.region as PurchaseRegion,
    currency: d.currency as SupportedCurrency,
    pricingSnapshot: {
      basePriceSubunits: d.pricingSnapshot.basePriceSubunits,
      discountPercentApplied: resolvedPct,
      discountSubunits: d.pricingSnapshot.discountSubunits,
      taxSubunits: d.pricingSnapshot.taxSubunits,
      totalSubunits: d.pricingSnapshot.totalSubunits,
      promoApplied: d.pricingSnapshot.promoApplied,
      referralCodeApplied: d.pricingSnapshot.referralCodeApplied,
    },
    paymentProvider: d.paymentProvider as PaymentProvider,
    providerOrderId: d.providerOrderId ?? null,
    providerPaymentId: d.providerPaymentId ?? null,
    idempotencyKey: d.idempotencyKey,
    status: d.status as PurchaseStatus,
    referrerUserId: d.referrerUserId,
    referralProfileId: d.referralProfileId,
    capturedAt: d.status === "captured" ? now : null,
    refundedAt:
      d.status === "refunded" || d.status === "partially_refunded" ? now : null,
    disputedAt: d.status === "disputed" ? now : null,
    paddleTransactionId: d.paddleTransactionId ?? null,
    paddleCustomerId: d.paddleCustomerId ?? null,
    paddleCheckoutUrl: d.paddleCheckoutUrl ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export const PURCHASE_ALLOWED_TRANSITIONS: Record<
  PurchaseStatus,
  readonly PurchaseStatus[]
> = {
  pending: ["captured", "failed"],
  captured: ["refunded", "partially_refunded", "disputed"],
  partially_refunded: ["refunded", "disputed"],
  disputed: ["captured", "refunded", "chargeback_lost"],
  refunded: [],
  chargeback_lost: [],
  failed: [],
} as const;

export function assertValidPurchaseTransition(
  currentStatus: PurchaseStatus,
  nextStatus: PurchaseStatus
): void {
  const allowed = PURCHASE_ALLOWED_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw new InvalidStateTransitionError(
      `Invalid purchase status transition from "${currentStatus}" to "${nextStatus}"`
    );
  }
}

const IMMUTABLE_PURCHASE_FIELDS = new Set([
  "_id",
  "userId",
  "productSlug",
  "editionVersion",
  "region",
  "currency",
  "pricingSnapshot",
  "paymentProvider",
  "idempotencyKey",
  "referrerUserId",
  "referralProfileId",
  "createdAt",
]);

export function assertImmutablePurchaseFieldsNotModified(
  updateFields: Record<string, unknown>,
  existingPurchase?: Pick<PurchaseDocument, "providerOrderId" | "providerPaymentId">
): void {
  for (const key of Object.keys(updateFields)) {
    const rootKey = key.split(".")[0];
    if (IMMUTABLE_PURCHASE_FIELDS.has(rootKey)) {
      throw new ImmutableRecordError(
        `Purchase field "${rootKey}" is immutable after creation and cannot be modified`
      );
    }
    if (
      rootKey === "providerOrderId" &&
      existingPurchase?.providerOrderId &&
      updateFields[key] !== existingPurchase.providerOrderId
    ) {
      throw new ImmutableRecordError(
        'Purchase field "providerOrderId" cannot be overwritten once populated'
      );
    }
    if (
      rootKey === "providerPaymentId" &&
      existingPurchase?.providerPaymentId &&
      updateFields[key] !== existingPurchase.providerPaymentId
    ) {
      throw new ImmutableRecordError(
        'Purchase field "providerPaymentId" cannot be overwritten once populated'
      );
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Entitlement Validation & Independent Multi-Restriction State Machine
// ---------------------------------------------------------------------------

export const entitlementCreateSchema = z.object({
  userId: objectIdSchema,
  purchaseId: objectIdSchema,
  productSlug: z.string().trim().min(1).max(100),
  activeRestrictionReasons: z
    .array(z.enum(["refund_pending", "chargeback_open", "admin_suspended"]))
    .default([]),
  revocationReason: z
    .enum(["refunded", "chargeback_lost", "fraud", "admin_revoked"])
    .nullable()
    .default(null),
});

export type EntitlementCreateInput = z.input<typeof entitlementCreateSchema>;

export function computeEntitlementStatus(
  activeRestrictionReasons: readonly EntitlementRestrictionReason[],
  revocationReason: EntitlementRevocationReason | null
): EntitlementStatus {
  if (revocationReason !== null) {
    return "revoked";
  }
  if (activeRestrictionReasons.length > 0) {
    return "suspended";
  }
  return "active";
}

export function buildEntitlementDocument(
  input: EntitlementCreateInput,
  now = new Date()
): EntitlementDocument {
  const parsed = entitlementCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new DataValidationError(
      parsed.error.issues[0]?.message || "Invalid entitlement document input"
    );
  }

  const d = parsed.data;
  const uniqueRestrictions = Array.from(new Set(d.activeRestrictionReasons));
  const status = computeEntitlementStatus(
    uniqueRestrictions,
    d.revocationReason
  );

  return {
    _id: new ObjectId(),
    userId: d.userId,
    purchaseId: d.purchaseId,
    productSlug: d.productSlug,
    status,
    activeRestrictionReasons: uniqueRestrictions,
    revocationReason: d.revocationReason,
    maxActiveDevices: 1,
    activeInstallationIdHash: null,
    deviceBoundAt: null,
    lastValidatedAt: null,
    offlineLeaseExpiresAt: null,
    suspendedAt: status === "suspended" ? now : null,
    revokedAt: status === "revoked" ? now : null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Applies an independent restriction reason (e.g. "chargeback_open" or "admin_suspended")
 * to an entitlement. Revoked entitlements are terminal and cannot be modified.
 */
export function applyEntitlementRestriction(
  entitlement: EntitlementDocument,
  reason: EntitlementRestrictionReason,
  now = new Date()
): Pick<
  EntitlementDocument,
  "status" | "activeRestrictionReasons" | "suspendedAt" | "updatedAt"
> {
  if (entitlement.status === "revoked" || entitlement.revocationReason !== null) {
    throw new InvalidStateTransitionError(
      "Cannot apply suspension restriction to a permanently revoked entitlement"
    );
  }

  const nextReasons = Array.from(
    new Set([...entitlement.activeRestrictionReasons, reason])
  );

  return {
    status: "suspended",
    activeRestrictionReasons: nextReasons,
    suspendedAt: entitlement.suspendedAt ?? now,
    updatedAt: now,
  };
}

/**
 * Resolves a single restriction reason on an entitlement (Stage 3B.1 §5).
 * Only restores `status: "active"` if NO other independent restriction reasons remain
 * and the entitlement has not been permanently revoked.
 */
export function resolveEntitlementRestriction(
  entitlement: EntitlementDocument,
  reasonToClear: EntitlementRestrictionReason,
  now = new Date()
): Pick<
  EntitlementDocument,
  "status" | "activeRestrictionReasons" | "suspendedAt" | "updatedAt"
> {
  if (entitlement.status === "revoked" || entitlement.revocationReason !== null) {
    throw new InvalidStateTransitionError(
      "Cannot restore a permanently revoked entitlement"
    );
  }

  const remainingReasons = entitlement.activeRestrictionReasons.filter(
    (r) => r !== reasonToClear
  );
  const nextStatus = computeEntitlementStatus(
    remainingReasons,
    entitlement.revocationReason
  );

  return {
    status: nextStatus,
    activeRestrictionReasons: remainingReasons,
    suspendedAt: nextStatus === "suspended" ? entitlement.suspendedAt ?? now : null,
    updatedAt: now,
  };
}

/**
 * Permanently revokes an entitlement (terminal state).
 * Once revoked, the historical entitlement document remains in `entitlements` with
 * `status: "revoked"`, allowing the user to receive a new `"active"` entitlement
 * if they make a legitimate future repurchase of the same edition.
 */
export function revokeEntitlementState(
  entitlement: EntitlementDocument,
  revocationReason: EntitlementRevocationReason,
  now = new Date()
): Pick<
  EntitlementDocument,
  | "status"
  | "revocationReason"
  | "revokedAt"
  | "activeInstallationIdHash"
  | "offlineLeaseExpiresAt"
  | "updatedAt"
> {
  if (entitlement.status === "revoked") {
    throw new InvalidStateTransitionError("Entitlement is already revoked");
  }

  return {
    status: "revoked",
    revocationReason,
    revokedAt: now,
    activeInstallationIdHash: null,
    offlineLeaseExpiresAt: null,
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// 5. Promotion Settings & Referral Profile Validation
// ---------------------------------------------------------------------------

export const promotionSettingsSchema = z
  .object({
    mode: z.enum(["promo", "normal"]),
    promotionalDiscountPercent: z
      .union([
        z.literal(0),
        z.literal(5),
        z.literal(10),
        z.literal(15),
        z.literal(20),
      ])
      .optional(),
    referralCustomerDiscountPercent: z
      .literal(REFERRAL_CUSTOMER_DISCOUNT_PERCENT)
      .default(REFERRAL_CUSTOMER_DISCOUNT_PERCENT),
    referrerCommissionPercent: z
      .literal(REFERRAL_COMMISSION_PERCENT)
      .default(REFERRAL_COMMISSION_PERCENT),
    maxSuccessfulReferralsPerUser: z
      .literal(MAX_SUCCESSFUL_REFERRALS_PER_USER)
      .default(MAX_SUCCESSFUL_REFERRALS_PER_USER),
    holdWindowHours: z
      .literal(COMMISSION_HOLD_WINDOW_HOURS)
      .default(COMMISSION_HOLD_WINDOW_HOURS),
    minEligibleCommissionsForPayout: z
      .literal(MIN_ELIGIBLE_COMMISSIONS_FOR_PAYOUT)
      .default(MIN_ELIGIBLE_COMMISSIONS_FOR_PAYOUT),
    updatedByAdminId: objectIdSchema.nullable().default(null),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "promo") {
      const pct = data.promotionalDiscountPercent ?? 10;
      if (!allowedPromoPercentSet.has(pct)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'When mode is "promo", promotionalDiscountPercent must be 5, 10, 15, or 20',
          path: ["promotionalDiscountPercent"],
        });
      }
    } else if (
      data.mode === "normal" &&
      data.promotionalDiscountPercent !== undefined &&
      data.promotionalDiscountPercent !== 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'When mode is "normal", promotionalDiscountPercent must be 0',
        path: ["promotionalDiscountPercent"],
      });
    }
  });

export type PromotionSettingsInput = z.input<typeof promotionSettingsSchema>;

export function buildPromotionSettingsDocument(
  input: PromotionSettingsInput,
  now = new Date()
): PromotionSettingsDocument {
  const parsed = promotionSettingsSchema.safeParse(input);
  if (!parsed.success) {
    throw new DataValidationError(
      parsed.error.issues[0]?.message || "Invalid promotion settings input"
    );
  }

  const d = parsed.data;
  const resolvedPromoPct: 0 | PromotionalDiscountPercent =
    d.mode === "promo"
      ? ((d.promotionalDiscountPercent ?? 10) as PromotionalDiscountPercent)
      : 0;

  return {
    _id: "global_referral_promo",
    mode: d.mode as PromotionMode,
    promotionalDiscountPercent: resolvedPromoPct,
    referralCustomerDiscountPercent: REFERRAL_CUSTOMER_DISCOUNT_PERCENT,
    referrerCommissionPercent: REFERRAL_COMMISSION_PERCENT,
    maxSuccessfulReferralsPerUser: MAX_SUCCESSFUL_REFERRALS_PER_USER,
    holdWindowHours: COMMISSION_HOLD_WINDOW_HOURS,
    minEligibleCommissionsForPayout: MIN_ELIGIBLE_COMMISSIONS_FOR_PAYOUT,
    updatedByAdminId: d.updatedByAdminId,
    updatedAt: now,
    createdAt: now,
  };
}

export const referralProfileCreateSchema = z
  .object({
    userId: objectIdSchema,
    qualifyingPurchaseId: objectIdSchema,
    referralCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(
        /^[A-Z0-9_-]{4,24}$/,
        "Referral code must be 4-24 uppercase alphanumeric characters"
      ),
    status: z.enum(["active", "exhausted", "suspended", "revoked"]).default("active"),
    maxReferralsCap: z
      .literal(MAX_SUCCESSFUL_REFERRALS_PER_USER)
      .default(MAX_SUCCESSFUL_REFERRALS_PER_USER),
    pendingReservedCount: z.number().int().min(0).default(0),
    successfulConversionsCount: z.number().int().min(0).default(0),
    payoutMethod: z
      .enum(["upi", "bank_transfer", "international_wire", "unset"])
      .default("unset"),
    payoutDetailsEncryptedOrRef: z.string().trim().max(512).nullable().default(null),
  })
  .superRefine((data, ctx) => {
    if (
      data.pendingReservedCount + data.successfulConversionsCount >
      data.maxReferralsCap
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `pendingReservedCount + successfulConversionsCount cannot exceed maxReferralsCap (${MAX_SUCCESSFUL_REFERRALS_PER_USER})`,
        path: ["pendingReservedCount"],
      });
    }
  });

export type ReferralProfileCreateInput = z.input<
  typeof referralProfileCreateSchema
>;

export function buildReferralProfileDocument(
  input: ReferralProfileCreateInput,
  now = new Date()
): ReferralProfileDocument {
  const parsed = referralProfileCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new DataValidationError(
      parsed.error.issues[0]?.message || "Invalid referral profile input"
    );
  }

  const d = parsed.data;
  return {
    _id: new ObjectId(),
    userId: d.userId,
    qualifyingPurchaseId: d.qualifyingPurchaseId,
    referralCode: d.referralCode,
    status: d.status as ReferralProfileStatus,
    maxReferralsCap: MAX_SUCCESSFUL_REFERRALS_PER_USER,
    pendingReservedCount: d.pendingReservedCount,
    successfulConversionsCount: d.successfulConversionsCount,
    payoutMethod: d.payoutMethod as ReferralPayoutMethod,
    payoutDetailsEncryptedOrRef: d.payoutDetailsEncryptedOrRef,
    createdAt: now,
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// 6. Commission, Payout & Commission Adjustment Validation and Guards
// ---------------------------------------------------------------------------

/**
 * Computes the exact end of the 72-hour refund window measured from the exact
 * purchase timestamp (`purchaseCapturedAt + 72 hours`).
 */
export function computeCommissionHoldUntil(purchaseCapturedAt: Date): Date {
  return new Date(purchaseCapturedAt.getTime() + COMMISSION_HOLD_WINDOW_MS);
}

export const commissionCreateSchema = z
  .object({
    referrerUserId: objectIdSchema,
    referralProfileId: objectIdSchema,
    referredUserId: objectIdSchema,
    purchaseId: objectIdSchema,
    currency: supportedCurrencySchema,
    netCollectedSubunits: positiveSubunitsSchema,
    commissionRatePercent: z
      .literal(REFERRAL_COMMISSION_PERCENT, {
        message: `Referral commission rate is fixed at ${REFERRAL_COMMISSION_PERCENT}%`,
      })
      .default(REFERRAL_COMMISSION_PERCENT),
    commissionAmountSubunits: positiveSubunitsSchema,
    purchaseCapturedAt: z.date({
      message: "purchaseCapturedAt (exact purchase timestamp) is required",
    }),
    holdUntil: z.date().optional(),
    isDisputedHold: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.referrerUserId.equals(data.referredUserId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Self-referral commission creation is prohibited",
        path: ["referredUserId"],
      });
    }

    const expectedCommission = Math.floor(
      (data.netCollectedSubunits * REFERRAL_COMMISSION_PERCENT) / 100
    );
    if (data.commissionAmountSubunits !== expectedCommission) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `commissionAmountSubunits (${data.commissionAmountSubunits}) must equal ${REFERRAL_COMMISSION_PERCENT}% of netCollectedSubunits (${expectedCommission})`,
        path: ["commissionAmountSubunits"],
      });
    }

    if (data.holdUntil !== undefined) {
      const expectedHoldUntilMs =
        data.purchaseCapturedAt.getTime() + COMMISSION_HOLD_WINDOW_MS;
      if (data.holdUntil.getTime() !== expectedHoldUntilMs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `holdUntil must equal exact purchaseCapturedAt + ${COMMISSION_HOLD_WINDOW_HOURS} hours`,
          path: ["holdUntil"],
        });
      }
    }
  });

export type CommissionCreateInput = z.input<typeof commissionCreateSchema>;

export function buildCommissionDocument(
  input: CommissionCreateInput,
  now = new Date()
): CommissionDocument {
  const parsed = commissionCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new DataValidationError(
      parsed.error.issues[0]?.message || "Invalid commission input"
    );
  }

  const d = parsed.data;
  const computedHoldUntil = computeCommissionHoldUntil(d.purchaseCapturedAt);

  return {
    _id: new ObjectId(),
    referrerUserId: d.referrerUserId,
    referralProfileId: d.referralProfileId,
    referredUserId: d.referredUserId,
    purchaseId: d.purchaseId,
    currency: d.currency as SupportedCurrency,
    netCollectedSubunits: d.netCollectedSubunits,
    commissionRatePercent: REFERRAL_COMMISSION_PERCENT,
    commissionAmountSubunits: d.commissionAmountSubunits,
    status: "pending",
    purchaseCapturedAt: d.purchaseCapturedAt,
    holdUntil: computedHoldUntil,
    isDisputedHold: d.isDisputedHold,
    eligibleAt: null,
    approvedAt: null,
    approvedByAdminId: null,
    payoutId: null,
    paidAt: null,
    cancelledAt: null,
    cancellationReason: null,
    createdAt: now,
    updatedAt: now,
  };
}

export const COMMISSION_ALLOWED_TRANSITIONS: Record<
  CommissionStatus,
  readonly CommissionStatus[]
> = {
  pending: ["eligible", "cancelled"],
  eligible: ["approved", "pending", "cancelled"], // "pending" allowed when placed back on dispute hold
  approved: ["paid", "pending", "cancelled"], // "pending" allowed when placed back on dispute hold prior to payout
  paid: [], // Strictly terminal! Paid commissions must NEVER be automatically cancelled or clawed back
  cancelled: [],
} as const;

export interface CommissionTransitionValidationOptions {
  isDisputedHold?: boolean;
  now?: Date;
  purchaseCapturedAt?: Date;
  holdUntil?: Date;
}

export function assertValidCommissionTransition(
  currentStatus: CommissionStatus,
  nextStatus: CommissionStatus,
  options?: CommissionTransitionValidationOptions
): void {
  if (currentStatus === "paid") {
    throw new InvalidStateTransitionError(
      'Paid commissions are terminal and cannot be transitioned to "cancelled" or automatically clawed back. Record a post-payout entry in "commission_adjustments" instead.'
    );
  }

  const allowed = COMMISSION_ALLOWED_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw new InvalidStateTransitionError(
      `Invalid commission status transition from "${currentStatus}" to "${nextStatus}"`
    );
  }

  if (
    options?.isDisputedHold &&
    (nextStatus === "eligible" ||
      nextStatus === "approved" ||
      nextStatus === "paid")
  ) {
    throw new InvalidStateTransitionError(
      `Disputed unpaid commission must remain on hold and cannot transition to "${nextStatus}"`
    );
  }

  if (nextStatus === "eligible" && options?.now) {
    if (options.purchaseCapturedAt) {
      const exact72hExpiryMs =
        options.purchaseCapturedAt.getTime() + COMMISSION_HOLD_WINDOW_MS;
      if (options.now.getTime() < exact72hExpiryMs) {
        throw new InvalidStateTransitionError(
          `Commission cannot become eligible before the exact ${COMMISSION_HOLD_WINDOW_HOURS}-hour refund window from purchase timestamp expires`
        );
      }
    }
    if (options.holdUntil && options.now.getTime() < options.holdUntil.getTime()) {
      throw new InvalidStateTransitionError(
        `Commission cannot become eligible before holdUntil (${options.holdUntil.toISOString()})`
      );
    }
  }
}

/**
 * Enforces all eligibility requirements before a pending commission can transition
 * to `"eligible"`:
 * 1. Commission must currently be `"pending"`.
 * 2. Neither the commission nor its purchase may have an active dispute or pending refund.
 * 3. Underlying purchase must be in `"captured"` status.
 * 4. Current timestamp `now` must be `>= purchaseCapturedAt + 72 hours` (exact 72-hour refund window).
 */
export function assertCommissionCanBecomeEligible(
  commission: Pick<
    CommissionDocument,
    "status" | "purchaseCapturedAt" | "holdUntil" | "isDisputedHold"
  >,
  context: {
    now: Date;
    purchaseStatus: PurchaseStatus;
    hasOpenDispute?: boolean;
    hasPendingRefund?: boolean;
  }
): void {
  if (commission.status !== "pending") {
    throw new InvalidStateTransitionError(
      `Only "pending" commissions can transition to "eligible" (found "${commission.status}")`
    );
  }

  if (
    commission.isDisputedHold ||
    context.hasOpenDispute ||
    context.hasPendingRefund ||
    context.purchaseStatus === "disputed"
  ) {
    throw new InvalidStateTransitionError(
      "Disputed or refund-pending unpaid commissions must remain on hold"
    );
  }

  if (context.purchaseStatus !== "captured") {
    throw new InvalidStateTransitionError(
      `Commission cannot become eligible when underlying purchase status is "${context.purchaseStatus}"`
    );
  }

  const exact72hExpiryMs =
    commission.purchaseCapturedAt.getTime() + COMMISSION_HOLD_WINDOW_MS;
  if (
    context.now.getTime() < exact72hExpiryMs ||
    context.now.getTime() < commission.holdUntil.getTime()
  ) {
    throw new InvalidStateTransitionError(
      `Commission cannot become eligible before the exact ${COMMISSION_HOLD_WINDOW_HOURS}-hour refund window from purchase timestamp expires`
    );
  }
}

/**
 * Places an unpaid commission (`"pending"`, `"eligible"`, or `"approved"`) on hold
 * when its underlying purchase enters a dispute or pending refund state.
 * Paid commissions can never be placed on hold or clawed back.
 */
export function placeUnpaidCommissionOnDisputeHold(
  commission: Pick<CommissionDocument, "status" | "isDisputedHold">,
  now = new Date()
): Pick<
  CommissionDocument,
  | "status"
  | "isDisputedHold"
  | "eligibleAt"
  | "approvedAt"
  | "approvedByAdminId"
  | "updatedAt"
> {
  if (commission.status === "paid") {
    throw new InvalidStateTransitionError(
      'Paid commissions cannot be placed on unpaid dispute hold or automatically clawed back. Record a post-payout entry in "commission_adjustments" instead.'
    );
  }
  if (commission.status === "cancelled") {
    throw new InvalidStateTransitionError(
      "Cancelled commissions cannot be placed on dispute hold"
    );
  }

  return {
    status: "pending",
    isDisputedHold: true,
    eligibleAt: null,
    approvedAt: null,
    approvedByAdminId: null,
    updatedAt: now,
  };
}

const IMMUTABLE_COMMISSION_FIELDS = new Set([
  "_id",
  "referrerUserId",
  "referralProfileId",
  "referredUserId",
  "purchaseId",
  "currency",
  "netCollectedSubunits",
  "commissionRatePercent",
  "commissionAmountSubunits",
  "purchaseCapturedAt",
  "holdUntil",
  "createdAt",
]);

export function assertImmutableCommissionFieldsNotModified(
  updateFields: Record<string, unknown>
): void {
  for (const key of Object.keys(updateFields)) {
    const rootKey = key.split(".")[0];
    if (IMMUTABLE_COMMISSION_FIELDS.has(rootKey)) {
      throw new ImmutableRecordError(
        `Commission financial field "${rootKey}" is immutable after creation`
      );
    }
  }
}

export const payoutCreateSchema = z.object({
  referrerUserId: objectIdSchema,
  referralProfileId: objectIdSchema,
  currency: supportedCurrencySchema,
  totalAmountSubunits: positiveSubunitsSchema,
  commissionIds: z
    .array(objectIdSchema)
    .min(1, "Payout must reference at least one approved commission"),
  payoutMethod: z.enum(["upi", "bank_transfer", "international_wire"]),
  externalTransferReference: z
    .string()
    .trim()
    .min(1)
    .max(128)
    .nullable()
    .optional()
    .default(null),
  createdByAdminId: objectIdSchema,
  notes: z.string().trim().max(1000).nullable().default(null),
});

export type PayoutCreateInput = z.input<typeof payoutCreateSchema>;

/**
 * Verifies that a referrer has at least 5 eligible/approved unpaid commissions
 * across ALL currencies combined (`INR`, `USD`, `EUR`) and none of the counted
 * commissions are on dispute hold.
 */
export function assertReferrerPayoutEligibility(
  referrerUserId: ObjectId,
  allReferrerCommissionsAcrossCurrencies: readonly Pick<
    CommissionDocument,
    "_id" | "referrerUserId" | "currency" | "status" | "isDisputedHold"
  >[]
): void {
  const qualifyingCount = allReferrerCommissionsAcrossCurrencies.filter(
    (c) =>
      c.referrerUserId.equals(referrerUserId) &&
      !c.isDisputedHold &&
      (c.status === "eligible" || c.status === "approved")
  ).length;

  if (qualifyingCount < MIN_ELIGIBLE_COMMISSIONS_FOR_PAYOUT) {
    throw new InvalidStateTransitionError(
      `Payout eligibility requires at least ${MIN_ELIGIBLE_COMMISSIONS_FOR_PAYOUT} eligible commissions across all currencies combined (found ${qualifyingCount})`
    );
  }
}

/**
 * Enforces Stage 3B.1 / 3B.3 payout invariants:
 * 1. Referrer must have at least 5 eligible/approved commissions across all currencies combined.
 * 2. All commissions in a specific payout batch must belong to the same referrer.
 * 3. All commissions in the batch must match the payout's exact currency (never mix INR, USD, EUR).
 * 4. No commission in the batch may be on dispute hold (`isDisputedHold === false`).
 * 5. All commissions in the batch must be in `"approved"` status.
 * 6. Sum of commission amounts in the batch must equal `totalAmountSubunits`.
 */
export function assertPayoutBatchConsistency(
  payoutInput: PayoutCreateInput,
  batchCommissions: readonly Pick<
    CommissionDocument,
    | "_id"
    | "referrerUserId"
    | "currency"
    | "status"
    | "commissionAmountSubunits"
    | "isDisputedHold"
  >[],
  allReferrerCommissionsAcrossCurrencies?: readonly Pick<
    CommissionDocument,
    "_id" | "referrerUserId" | "currency" | "status" | "isDisputedHold"
  >[]
): void {
  if (batchCommissions.length === 0) {
    throw new DataValidationError("Payout batch cannot be empty");
  }

  let sumSubunits = 0;
  for (const comm of batchCommissions) {
    if (!comm.referrerUserId.equals(payoutInput.referrerUserId)) {
      throw new DataValidationError(
        `Commission ${comm._id.toString()} belongs to a different referrer`
      );
    }
    if (comm.currency !== payoutInput.currency) {
      throw new DataValidationError(
        `Currency mismatch in payout batch: commission ${comm._id.toString()} is in ${comm.currency}, expected ${payoutInput.currency}`
      );
    }
    if (comm.isDisputedHold) {
      throw new InvalidStateTransitionError(
        `Commission ${comm._id.toString()} is on dispute hold and cannot be included in a payout batch`
      );
    }
    if (comm.status !== "approved") {
      throw new InvalidStateTransitionError(
        `Commission ${comm._id.toString()} must be in "approved" status before payout (found "${comm.status}")`
      );
    }
    sumSubunits += comm.commissionAmountSubunits;
  }

  if (sumSubunits !== payoutInput.totalAmountSubunits) {
    throw new DataValidationError(
      `Payout totalAmountSubunits (${payoutInput.totalAmountSubunits}) does not match sum of approved commissions (${sumSubunits})`
    );
  }

  // Verify the minimum 5 eligible/approved commissions threshold across all currencies combined
  assertReferrerPayoutEligibility(
    payoutInput.referrerUserId,
    allReferrerCommissionsAcrossCurrencies ?? batchCommissions
  );
}

export function buildPayoutDocument(
  input: PayoutCreateInput,
  now = new Date()
): PayoutDocument {
  const parsed = payoutCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new DataValidationError(
      parsed.error.issues[0]?.message || "Invalid payout input"
    );
  }

  const d = parsed.data;
  return {
    _id: new ObjectId(),
    referrerUserId: d.referrerUserId,
    referralProfileId: d.referralProfileId,
    currency: d.currency as SupportedCurrency,
    totalAmountSubunits: d.totalAmountSubunits,
    commissionIds: d.commissionIds,
    status: "draft" as PayoutStatus,
    payoutMethod: d.payoutMethod,
    externalTransferReference: d.externalTransferReference ?? null,
    createdByAdminId: d.createdByAdminId,
    approvedByAdminId: null,
    paidAt: null,
    failureReason: null,
    notes: d.notes,
    createdAt: now,
    updatedAt: now,
  };
}

export const commissionAdjustmentCreateSchema = z.object({
  commissionId: objectIdSchema,
  purchaseId: objectIdSchema,
  payoutId: objectIdSchema,
  referrerUserId: objectIdSchema,
  currency: supportedCurrencySchema,
  adjustmentAmountSubunits: positiveSubunitsSchema,
  reason: z.enum([
    "post_payout_refund",
    "post_payout_chargeback",
    "post_payout_fraud",
    "manual_reconciliation",
  ]),
  createdByAdminId: objectIdSchema.nullable().default(null),
  notes: z.string().trim().max(1000).nullable().default(null),
});

export type CommissionAdjustmentCreateInput = z.input<
  typeof commissionAdjustmentCreateSchema
>;

export function buildCommissionAdjustmentDocument(
  input: CommissionAdjustmentCreateInput,
  now = new Date()
): CommissionAdjustmentDocument {
  const parsed = commissionAdjustmentCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new DataValidationError(
      parsed.error.issues[0]?.message || "Invalid commission adjustment input"
    );
  }

  const d = parsed.data;
  return {
    _id: new ObjectId(),
    commissionId: d.commissionId,
    purchaseId: d.purchaseId,
    payoutId: d.payoutId,
    referrerUserId: d.referrerUserId,
    currency: d.currency as SupportedCurrency,
    adjustmentAmountSubunits: d.adjustmentAmountSubunits,
    reason: d.reason as CommissionAdjustmentReason,
    resolutionStatus: "open" as CommissionAdjustmentResolutionStatus,
    offsetPayoutId: null,
    createdByAdminId: d.createdByAdminId,
    resolvedByAdminId: null,
    notes: d.notes,
    createdAt: now,
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// 7. Payment Webhooks & Purchase Evidence Validation and Immutability Guards
// ---------------------------------------------------------------------------

export const paymentWebhookCreateSchema = z.object({
  provider: paymentProviderSchema,
  eventId: z.string().trim().min(1).max(128),
  eventType: z.string().trim().min(1).max(128),
  signatureVerified: z.literal(true, {
    message: "Only signature-verified payment webhooks may be persisted",
  }),
  payloadHash: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{64}$/i, "payloadHash must be a 64-character SHA-256 hex digest"),
  payloadSummary: z.record(z.string(), z.unknown()).default({}),
  relatedOrderId: z.string().trim().min(1).max(128).nullable().default(null),
  relatedPaymentId: z.string().trim().min(1).max(128).nullable().default(null),
});

export type PaymentWebhookCreateInput = z.input<
  typeof paymentWebhookCreateSchema
>;

export function buildPaymentWebhookDocument(
  input: PaymentWebhookCreateInput,
  now = new Date()
): PaymentWebhookDocument {
  const parsed = paymentWebhookCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new DataValidationError(
      parsed.error.issues[0]?.message || "Invalid payment webhook input"
    );
  }

  const d = parsed.data;
  return {
    _id: new ObjectId(),
    provider: d.provider as PaymentProvider,
    eventId: d.eventId,
    eventType: d.eventType,
    signatureVerified: d.signatureVerified,
    payloadHash: d.payloadHash.toLowerCase(),
    payloadSummary: d.payloadSummary,
    relatedOrderId: d.relatedOrderId,
    relatedPaymentId: d.relatedPaymentId,
    processingStatus: "received" as WebhookProcessingStatus,
    attempts: 1,
    lastError: null,
    receivedAt: now,
    processedAt: null,
  };
}

const MUTABLE_WEBHOOK_FIELDS = new Set([
  "processingStatus",
  "attempts",
  "lastError",
  "processedAt",
  "leaseExpiresAt",
]);

export function assertImmutableWebhookFieldsNotModified(
  updateFields: Record<string, unknown>
): void {
  for (const key of Object.keys(updateFields)) {
    const rootKey = key.split(".")[0];
    if (!MUTABLE_WEBHOOK_FIELDS.has(rootKey)) {
      throw new ImmutableRecordError(
        `Payment webhook field "${rootKey}" is immutable after ingestion`
      );
    }
  }
}

/**
 * Detects prohibited raw card PAN (13-19 consecutive digits, with or without spaces/hyphens)
 * or CVV/CVC labels in paymentMethodSummary strings (Stage 3B.1 §6).
 */
const PROHIBITED_PAN_DIGIT_REGEX = /(?:\d[ -]*?){12,19}/;
const PROHIBITED_CARD_SECRET_LABELS_REGEX = /\b(?:cvv|cvc|cvv2|cvc2|pan|pin)\b/i;

export const purchaseEvidenceCreateSchema = z
  .object({
    purchaseId: objectIdSchema,
    userId: objectIdSchema,
    emailSnapshot: z.string().trim().toLowerCase().email().max(254),
    productSlug: z.string().trim().min(1).max(100),
    editionVersion: z.string().trim().min(1).max(32),
    region: purchaseRegionSchema,
    currency: supportedCurrencySchema,
    amountSubunits: positiveSubunitsSchema,
    providerOrderId: z.string().trim().min(1).max(128),
    providerPaymentId: z.string().trim().min(1).max(128),
    paymentMethodSummary: z.string().trim().min(1).max(128),
    ipAddressHash: z.string().trim().max(128).nullable().default(null),
    countryCodeSnapshot: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/)
      .nullable()
      .default(null),
    userAgentSnapshot: z.string().trim().max(512).nullable().default(null),
    termsVersionAccepted: z.string().trim().min(1).max(64),
    refundPolicyVersionAccepted: z.string().trim().min(1).max(64),
    acceptedAt: z.date(),
  })
  .superRefine((data, ctx) => {
    if (
      PROHIBITED_PAN_DIGIT_REGEX.test(data.paymentMethodSummary) ||
      PROHIBITED_CARD_SECRET_LABELS_REGEX.test(data.paymentMethodSummary)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "paymentMethodSummary must never contain raw card PAN digits or CVV/CVC data",
        path: ["paymentMethodSummary"],
      });
    }
  });

export type PurchaseEvidenceCreateInput = z.input<
  typeof purchaseEvidenceCreateSchema
>;

export function buildPurchaseEvidenceDocument(
  input: PurchaseEvidenceCreateInput,
  now = new Date()
): PurchaseEvidenceDocument {
  const parsed = purchaseEvidenceCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new DataValidationError(
      parsed.error.issues[0]?.message || "Invalid purchase evidence input"
    );
  }

  const d = parsed.data;
  return {
    _id: new ObjectId(),
    purchaseId: d.purchaseId,
    userId: d.userId,
    emailSnapshot: d.emailSnapshot,
    productSlug: d.productSlug,
    editionVersion: d.editionVersion,
    region: d.region as PurchaseRegion,
    currency: d.currency as SupportedCurrency,
    amountSubunits: d.amountSubunits,
    providerOrderId: d.providerOrderId,
    providerPaymentId: d.providerPaymentId,
    paymentMethodSummary: d.paymentMethodSummary,
    ipAddressHash: d.ipAddressHash,
    countryCodeSnapshot: d.countryCodeSnapshot,
    userAgentSnapshot: d.userAgentSnapshot,
    termsVersionAccepted: d.termsVersionAccepted,
    refundPolicyVersionAccepted: d.refundPolicyVersionAccepted,
    acceptedAt: d.acceptedAt,
    extensionActivatedAt: null,
    firstInstallationIdHash: null,
    createdAt: now,
    updatedAt: now,
  };
}

const MUTABLE_PURCHASE_EVIDENCE_FIELDS = new Set([
  "extensionActivatedAt",
  "firstInstallationIdHash",
  "updatedAt",
]);

/**
 * Prevents arbitrary mutation of checkout/dispute evidence snapshots.
 * Only first-activation telemetry fields (`extensionActivatedAt`, `firstInstallationIdHash`, `updatedAt`)
 * may be recorded after initial evidence creation.
 */
export function assertImmutablePurchaseEvidenceFieldsNotModified(
  updateFields: Record<string, unknown>
): void {
  for (const key of Object.keys(updateFields)) {
    const rootKey = key.split(".")[0];
    if (!MUTABLE_PURCHASE_EVIDENCE_FIELDS.has(rootKey)) {
      throw new ImmutableRecordError(
        `Purchase evidence field "${rootKey}" is immutable and cannot be modified`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// 8. MongoDB Topology & Replica-Set Transaction Verification
// ---------------------------------------------------------------------------

export interface DatabaseTopologyReport {
  isReplicaSet: boolean;
  setName: string | null;
  isWritablePrimary: boolean;
  logicalSessionTimeoutMinutes: number | null;
  maxWireVersion: number | null;
  supportsTransactions: boolean;
}

/**
 * Inspects the active MongoDB deployment via `{ hello: 1 }` to verify whether
 * replica-set multi-document transactions are genuinely supported.
 */
export async function verifyDatabaseTopology(
  db: Db
): Promise<DatabaseTopologyReport> {
  const hello = await db.command({ hello: 1 });
  const setName = typeof hello.setName === "string" ? hello.setName : null;
  const isWritablePrimary = Boolean(hello.isWritablePrimary);
  const logicalSessionTimeoutMinutes =
    typeof hello.logicalSessionTimeoutMinutes === "number"
      ? hello.logicalSessionTimeoutMinutes
      : null;
  const maxWireVersion =
    typeof hello.maxWireVersion === "number" ? hello.maxWireVersion : null;

  const isReplicaSet = Boolean(setName && setName.length > 0);
  const supportsTransactions =
    isReplicaSet &&
    logicalSessionTimeoutMinutes !== null &&
    logicalSessionTimeoutMinutes > 0 &&
    (maxWireVersion === null || maxWireVersion >= 7);

  return {
    isReplicaSet,
    setName,
    isWritablePrimary,
    logicalSessionTimeoutMinutes,
    maxWireVersion,
    supportsTransactions,
  };
}

/**
 * Executes a multi-document callback inside a MongoDB replica-set ACID transaction.
 * Never silently falls back to non-atomic writes if transactions are unsupported.
 */
export async function runInReplicaSetTransaction<T>(
  client: MongoClient,
  db: Db,
  operation: (session: ClientSession) => Promise<T>
): Promise<T> {
  const topology = await verifyDatabaseTopology(db);
  if (!topology.supportsTransactions) {
    throw new TopologyVerificationError(
      "MongoDB deployment does not support multi-document replica-set transactions; refusing to fall back to non-atomic execution"
    );
  }

  const session = client.startSession();
  try {
    let result!: T;
    await session.withTransaction(
      async () => {
        result = await operation(session);
      },
      {
        readConcern: { level: "majority" },
        writeConcern: { w: "majority" },
        readPreference: "primary",
      }
    );
    return result;
  } finally {
    await session.endSession();
  }
}
