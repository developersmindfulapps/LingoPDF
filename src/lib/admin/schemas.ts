import { z } from "zod";
import { ALLOWED_PROMOTIONAL_DISCOUNT_PERCENTS } from "@/lib/db/models";
import { isProtectedPricingCountry, isValidIsoCountryCode } from "@/lib/pricing/countries";

export const objectIdStringSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, { message: "Invalid 24-character hex ObjectId" });

export const adminReasonSchema = z
  .string()
  .trim()
  .min(5, {
    message:
      "Explicit administrator reason is required (minimum 5 characters)",
  })
  .max(1000, { message: "Administrator reason cannot exceed 1000 characters" });

export const adminConfirmationSchema = z.literal(true, {
  message: "Explicit administrator confirmation is required",
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const overviewPeriodSchema = z
  .enum(["7d", "30d", "90d", "all"])
  .default("30d");

export type OverviewPeriod = z.infer<typeof overviewPeriodSchema>;

export const promotionalDiscountPercentSchema = z
  .number()
  .int()
  .refine(
    (val): val is 5 | 10 | 15 | 20 =>
      (ALLOWED_PROMOTIONAL_DISCOUNT_PERCENTS as readonly number[]).includes(val),
    {
      message:
        "Promotional discount percentage must be one of the approved values: 5%, 10%, 15%, or 20%",
    }
  );

// ---------------------------------------------------------------------------
// 1. User Management Schemas
// ---------------------------------------------------------------------------

export const adminUsersFilterSchema = paginationQuerySchema.extend({
  q: z.string().trim().max(200).optional().default(""),
  status: z.enum(["all", "active", "suspended"]).optional().default("all"),
  verified: z
    .enum(["all", "verified", "unverified"])
    .optional()
    .default("all"),
  role: z.enum(["all", "customer", "admin"]).optional().default("all"),
  sort: z
    .enum(["newest", "oldest", "email_asc", "email_desc"])
    .optional()
    .default("newest"),
});

export const userStatusMutationSchema = z.object({
  actionType: z.enum(["user.suspend", "user.restore"]),
  userId: objectIdStringSchema,
  reason: adminReasonSchema,
  confirmed: adminConfirmationSchema,
});

// ---------------------------------------------------------------------------
// 2. Purchase Management Schemas
// ---------------------------------------------------------------------------

export const adminPurchasesFilterSchema = paginationQuerySchema.extend({
  q: z.string().trim().max(200).optional().default(""),
  status: z
    .enum([
      "all",
      "pending",
      "captured",
      "refunded",
      "partially_refunded",
      "disputed",
      "chargeback_lost",
      "failed",
    ])
    .optional()
    .default("all"),
  currency: z.enum(["all", "INR", "USD", "EUR"]).optional().default("all"),
  productSlug: z.string().trim().max(100).optional().default("all"),
  dateFrom: z.string().trim().max(40).optional().default(""),
  dateTo: z.string().trim().max(40).optional().default(""),
});

// ---------------------------------------------------------------------------
// 3. Entitlement Management Schemas
// ---------------------------------------------------------------------------

export const adminEntitlementsFilterSchema = paginationQuerySchema.extend({
  q: z.string().trim().max(200).optional().default(""),
  status: z
    .enum(["all", "active", "suspended", "revoked"])
    .optional()
    .default("all"),
  productSlug: z.string().trim().max(100).optional().default("all"),
  dateFrom: z.string().trim().max(40).optional().default(""),
  dateTo: z.string().trim().max(40).optional().default(""),
});

export const entitlementMutationSchema = z.object({
  actionType: z.enum([
    "entitlement.suspend",
    "entitlement.restore",
    "entitlement.revoke",
    "entitlement.replace_device",
  ]),
  entitlementId: objectIdStringSchema,
  revocationReason: z
    .enum(["refunded", "chargeback_lost", "fraud", "admin_revoked"])
    .optional(),
  reason: adminReasonSchema,
  confirmed: adminConfirmationSchema,
});

// ---------------------------------------------------------------------------
// 4. Refund Management Schemas
// ---------------------------------------------------------------------------

export const adminRefundsFilterSchema = paginationQuerySchema.extend({
  q: z.string().trim().max(200).optional().default(""),
  status: z
    .enum([
      "all",
      "pending_review",
      "approved_pending_gateway",
      "rejected",
      "withdrawn",
      "completed",
      "failed",
    ])
    .optional()
    .default("all"),
  currency: z.enum(["all", "INR", "USD", "EUR"]).optional().default("all"),
  windowFilter: z
    .enum(["all", "within_72h", "outside_72h"])
    .optional()
    .default("all"),
});

export const refundMutationSchema = z.object({
  actionType: z.enum([
    "refund.create_request",
    "refund.approve",
    "refund.reject",
    "refund.initiate_gateway",
  ]),
  purchaseId: objectIdStringSchema,
  isExceptionalOverride: z.boolean().optional().default(false),
  reason: adminReasonSchema,
  confirmed: adminConfirmationSchema,
});

// ---------------------------------------------------------------------------
// 5. Dispute & Chargeback Management Schemas
// ---------------------------------------------------------------------------

export const adminDisputesFilterSchema = paginationQuerySchema.extend({
  q: z.string().trim().max(200).optional().default(""),
  status: z
    .enum(["all", "open", "under_review", "won", "withdrawn", "lost"])
    .optional()
    .default("all"),
  currency: z.enum(["all", "INR", "USD", "EUR"]).optional().default("all"),
});

export const disputeMutationSchema = z.object({
  actionType: z.enum([
    "dispute.open",
    "dispute.update_notes",
    "dispute.resolve_won",
    "dispute.resolve_withdrawn",
    "dispute.resolve_lost",
  ]),
  purchaseId: objectIdStringSchema,
  reasonCode: z.string().trim().min(2).max(100).optional(),
  evidenceDeadlineAt: z.string().trim().max(64).optional().nullable(),
  adminNotes: z.string().trim().max(2000).optional().nullable(),
  reason: adminReasonSchema,
  confirmed: adminConfirmationSchema,
});

// ---------------------------------------------------------------------------
// 6. Promotions Management Schemas
// ---------------------------------------------------------------------------

export const promotionCreateMutationSchema = z
  .object({
    actionType: z.literal("promotion.create"),
    name: z.string().trim().min(3).max(120),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(
        /^[A-Z0-9_-]{3,24}$/,
        "Promotion code must be 3-24 uppercase alphanumeric characters"
      ),
    discountPercent: promotionalDiscountPercentSchema,
    startsAt: z.string().trim().min(1),
    endsAt: z.string().trim().min(1),
    activateImmediately: z.boolean().optional().default(false),
    reason: adminReasonSchema,
    confirmed: adminConfirmationSchema,
  })
  .superRefine((data, ctx) => {
    const start = new Date(data.startsAt);
    const end = new Date(data.endsAt);
    if (Number.isNaN(start.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid start timestamp",
        path: ["startsAt"],
      });
      return;
    }
    if (Number.isNaN(end.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid end timestamp",
        path: ["endsAt"],
      });
      return;
    }
    if (end.getTime() <= start.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Promotion end timestamp must be strictly after start timestamp",
        path: ["endsAt"],
      });
    }
  });

export const promotionStatusMutationSchema = z.object({
  actionType: z.enum(["promotion.activate", "promotion.deactivate"]),
  campaignId: z.string().trim().min(1).max(64),
  reason: adminReasonSchema,
  confirmed: adminConfirmationSchema,
});

export const promotionGlobalModeMutationSchema = z.object({
  actionType: z.literal("promotion.set_global_mode"),
  mode: z.enum(["promo", "normal"]),
  promotionalDiscountPercent: z
    .number()
    .int()
    .refine((v) => v === 0 || v === 5 || v === 10 || v === 15 || v === 20, {
      message: "Discount percent must be 0, 5, 10, 15, or 20",
    }),
  reason: adminReasonSchema,
  confirmed: adminConfirmationSchema,
});

// ---------------------------------------------------------------------------
// 7. Referral Management Schemas
// ---------------------------------------------------------------------------

export const adminReferralsFilterSchema = paginationQuerySchema.extend({
  q: z.string().trim().max(200).optional().default(""),
  status: z
    .enum(["all", "active", "suspended", "revoked"])
    .optional()
    .default("all"),
  riskFilter: z
    .enum(["all", "flagged", "normal"])
    .optional()
    .default("all"),
});

export const referralMutationSchema = z.object({
  actionType: z.enum([
    "referral.suspend",
    "referral.reinstate",
    "referral.override_risk",
  ]),
  referralProfileId: objectIdStringSchema,
  reason: adminReasonSchema,
  confirmed: adminConfirmationSchema,
});

// ---------------------------------------------------------------------------
// 8. Commission Management Schemas
// ---------------------------------------------------------------------------

export const adminCommissionsFilterSchema = paginationQuerySchema.extend({
  q: z.string().trim().max(200).optional().default(""),
  status: z
    .enum([
      "all",
      "pending",
      "held",
      "eligible",
      "approved",
      "included_in_payout",
      "paid",
      "cancelled",
      "adjusted",
    ])
    .optional()
    .default("all"),
  currency: z.enum(["all", "INR", "USD", "EUR"]).optional().default("all"),
  referrerUserId: z.string().trim().max(64).optional().default(""),
  dateFrom: z.string().trim().max(40).optional().default(""),
  dateTo: z.string().trim().max(40).optional().default(""),
});

export const commissionMutationSchema = z.object({
  actionType: z.enum([
    "commission.evaluate_eligibility",
    "commission.approve",
    "commission.create_adjustment",
    "commission.resolve_adjustment",
  ]),
  commissionId: objectIdStringSchema.optional(),
  adjustmentId: objectIdStringSchema.optional(),
  adjustmentReason: z
    .enum([
      "post_payout_refund",
      "post_payout_chargeback",
      "post_payout_fraud",
      "manual_reconciliation",
    ])
    .optional(),
  resolutionStatus: z
    .enum(["offset_applied", "waived", "written_off"])
    .optional(),
  reason: adminReasonSchema,
  confirmed: adminConfirmationSchema,
});

// ---------------------------------------------------------------------------
// 9. Payout Management Schemas
// ---------------------------------------------------------------------------

export const adminPayoutsFilterSchema = paginationQuerySchema.extend({
  q: z.string().trim().max(200).optional().default(""),
  status: z
    .enum([
      "all",
      "draft",
      "approved",
      "processing",
      "paid",
      "failed",
      "cancelled",
    ])
    .optional()
    .default("all"),
  currency: z.enum(["all", "INR", "USD", "EUR"]).optional().default("all"),
});

export const payoutMutationSchema = z.object({
  actionType: z.enum([
    "payout.create_batch",
    "payout.approve",
    "payout.reject",
    "payout.mark_processing",
    "payout.mark_failed",
    "payout.mark_paid",
  ]),
  payoutId: objectIdStringSchema.optional(),
  referrerUserId: objectIdStringSchema.optional(),
  currency: z.enum(["INR", "USD", "EUR"]).optional(),
  payoutMethod: z
    .enum(["upi", "bank_transfer", "international_wire"])
    .optional(),
  commissionIds: z.array(objectIdStringSchema).optional(),
  externalTransferReference: z.string().trim().max(128).optional().nullable(),
  reason: adminReasonSchema,
  confirmed: adminConfirmationSchema,
});

// ---------------------------------------------------------------------------
// 10. Audit Logs & Operational Settings Schemas
// ---------------------------------------------------------------------------

export const adminAuditLogsFilterSchema = paginationQuerySchema.extend({
  q: z.string().trim().max(200).optional().default(""),
  actorEmail: z.string().trim().max(200).optional().default(""),
  actionFilter: z.string().trim().max(120).optional().default(""),
  targetCollection: z.string().trim().max(80).optional().default("all"),
  outcome: z.enum(["all", "success", "failure"]).optional().default("all"),
  dateFrom: z.string().trim().max(40).optional().default(""),
  dateTo: z.string().trim().max(40).optional().default(""),
});

export const operationalSettingsMutationSchema = z.object({
  actionType: z.literal("settings.update_operational"),
  maxPendingReservationsBeforeReview: z
    .number()
    .int()
    .min(1)
    .max(50)
    .nullable(),
  maxDailyRedemptionsBeforeReview: z
    .number()
    .int()
    .min(1)
    .max(50)
    .nullable(),
  requireManualReviewOnVelocityAlert: z.boolean(),
  productAvailability: z
    .record(
      z.string().trim().min(1).max(64),
      z.enum(["available", "coming_soon", "maintenance"])
    )
    .optional(),
  reason: adminReasonSchema,
  confirmed: adminConfirmationSchema,
});

export const updateAffordabilityTargetSchema = z.object({
  actionType: z.literal("settings.update_affordability_target"),
  affordabilityTargetInr: z.number().int().min(500).max(50000),
  reason: adminReasonSchema,
  confirmed: adminConfirmationSchema,
});

export const addAffordabilityRuleSchema = z
  .object({
    actionType: z.literal("settings.add_affordability_rule"),
    countryCode: z.string().trim().length(2).toUpperCase(),
    countryName: z.string().trim().min(2).max(64),
    currency: z.string().trim().length(3).toUpperCase(),
    currencySymbol: z.string().trim().min(1).max(8),
    basePriceSubunits: z.number().int().positive(),
    usdFallbackPriceSubunits: z.number().int().positive(),
    isGatewaySupportedCurrency: z.boolean().default(false),
    isActive: z.boolean().default(true),
    notes: z.string().trim().max(500).nullable().optional(),
    referenceExchangeRateToInr: z.number().positive().nullable().optional(),
    approximateInrEquivalent: z.number().int().positive().nullable().optional(),
    reason: adminReasonSchema,
    confirmed: adminConfirmationSchema,
  })
  .superRefine((data, ctx) => {
    if (!isValidIsoCountryCode(data.countryCode)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Country code "${data.countryCode}" is not a recognized ISO country code.`,
        path: ["countryCode"],
      });
      return;
    }
    if (isProtectedPricingCountry(data.countryCode)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Country "${data.countryCode}" belongs to a protected standard pricing market (India, US, or Eurozone) and cannot be configured as an affordability country.`,
        path: ["countryCode"],
      });
    }
  });

export const updateAffordabilityRuleSchema = z
  .object({
    actionType: z.literal("settings.update_affordability_rule"),
    countryCode: z.string().trim().length(2).toUpperCase(),
    countryName: z.string().trim().min(2).max(64).optional(),
    currency: z.string().trim().length(3).toUpperCase().optional(),
    currencySymbol: z.string().trim().min(1).max(8).optional(),
    basePriceSubunits: z.number().int().positive().optional(),
    usdFallbackPriceSubunits: z.number().int().positive().optional(),
    isGatewaySupportedCurrency: z.boolean().optional(),
    isActive: z.boolean().optional(),
    notes: z.string().trim().max(500).nullable().optional(),
    referenceExchangeRateToInr: z.number().positive().nullable().optional(),
    approximateInrEquivalent: z.number().int().positive().nullable().optional(),
    reason: adminReasonSchema,
    confirmed: adminConfirmationSchema,
  })
  .superRefine((data, ctx) => {
    if (!isValidIsoCountryCode(data.countryCode)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Country code "${data.countryCode}" is not a recognized ISO country code.`,
        path: ["countryCode"],
      });
      return;
    }
    if (isProtectedPricingCountry(data.countryCode)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Country "${data.countryCode}" belongs to a protected standard pricing market (India, US, or Eurozone) and cannot be configured as an affordability country.`,
        path: ["countryCode"],
      });
    }
  });

export const toggleAffordabilityRuleSchema = z
  .object({
    actionType: z.literal("settings.toggle_affordability_rule"),
    countryCode: z.string().trim().length(2).toUpperCase(),
    isActive: z.boolean(),
    reason: adminReasonSchema,
    confirmed: adminConfirmationSchema,
  })
  .superRefine((data, ctx) => {
    if (!isValidIsoCountryCode(data.countryCode)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Country code "${data.countryCode}" is not a recognized ISO country code.`,
        path: ["countryCode"],
      });
      return;
    }
    if (isProtectedPricingCountry(data.countryCode)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Country "${data.countryCode}" belongs to a protected standard pricing market (India, US, or Eurozone) and cannot be toggled as an affordability country.`,
        path: ["countryCode"],
      });
    }
  });
