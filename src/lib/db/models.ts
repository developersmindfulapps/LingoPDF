import {
  ObjectId,
  Collection,
  Db,
  IndexSpecification,
  CreateIndexesOptions,
  Document,
} from "mongodb";

// ---------------------------------------------------------------------------
// 1. Canonical Collection Names & Commercial Policy Constants
// ---------------------------------------------------------------------------

export const COLLECTION_NAMES = {
  users: "users",
  sessions: "sessions",
  rateLimits: "rate_limits",
  purchases: "purchases",
  entitlements: "entitlements",
  promotionSettings: "promotion_settings",
  referralProfiles: "referral_profiles",
  commissions: "commissions",
  payouts: "payouts",
  paymentWebhooks: "payment_webhooks",
  adminAuditLogs: "admin_audit_logs",
  purchaseEvidence: "purchase_evidence",
  commissionAdjustments: "commission_adjustments",
} as const;

export type CollectionName =
  (typeof COLLECTION_NAMES)[keyof typeof COLLECTION_NAMES];

/**
 * Authoritative Stage 3B.1 / 3B.3 commercial policy constants.
 */
export const ALLOWED_PROMOTIONAL_DISCOUNT_PERCENTS = [5, 10, 15, 20] as const;
export type PromotionalDiscountPercent =
  (typeof ALLOWED_PROMOTIONAL_DISCOUNT_PERCENTS)[number];

export const REFERRAL_CUSTOMER_DISCOUNT_PERCENT = 10 as const;
export const REFERRAL_COMMISSION_PERCENT = 10 as const;
export const COMMISSION_HOLD_WINDOW_HOURS = 72 as const;
export const COMMISSION_HOLD_WINDOW_MS =
  COMMISSION_HOLD_WINDOW_HOURS * 60 * 60 * 1000; // 259,200,000 ms (exact 72 hours)
export const MAX_SUCCESSFUL_REFERRALS_PER_USER = 50 as const;
export const MIN_ELIGIBLE_COMMISSIONS_FOR_PAYOUT = 5 as const;
export const DEFAULT_AFFORDABILITY_TARGET_INR = 2000 as const;

// ---------------------------------------------------------------------------
// 2. Shared Commercial & Lifecycle Enumerations
// ---------------------------------------------------------------------------

export type AccountStatus = "active" | "suspended";
export type UserRole = "customer" | "admin";

export type SupportedCurrency = "INR" | "USD" | "EUR";
export type PurchaseRegion = "IN" | "US" | "EU";
export type PaymentProvider = "razorpay";

export type PurchaseStatus =
  | "pending"
  | "captured"
  | "refunded"
  | "partially_refunded"
  | "disputed"
  | "chargeback_lost"
  | "failed";

export type EntitlementStatus = "active" | "suspended" | "revoked";

export type EntitlementRestrictionReason =
  | "refund_pending"
  | "chargeback_open"
  | "admin_suspended";

export type EntitlementRevocationReason =
  | "refunded"
  | "chargeback_lost"
  | "fraud"
  | "admin_revoked";

export type PromotionMode = "promo" | "normal";
export type PromotionSettingsId = "global_referral_promo";

export type ReferralProfileStatus = "active" | "suspended" | "revoked";
export type ReferralPayoutMethod =
  | "upi"
  | "bank_transfer"
  | "international_wire"
  | "unset";

export type CommissionStatus =
  | "pending"
  | "eligible"
  | "approved"
  | "paid"
  | "cancelled";

export type CommissionCancellationReason =
  | "refund"
  | "chargeback"
  | "fraud"
  | "self_referral"
  | "duplicate_abuse"
  | "admin_cancelled";

export type PayoutStatus =
  | "draft"
  | "approved"
  | "processing"
  | "paid"
  | "failed"
  | "cancelled";

export type WebhookProcessingStatus =
  | "received"
  | "processing"
  | "processed"
  | "ignored"
  | "failed";

export type AdminAuditOutcome = "success" | "failure";

export type CommissionAdjustmentReason =
  | "post_payout_refund"
  | "post_payout_chargeback"
  | "post_payout_fraud"
  | "manual_reconciliation";

export type CommissionAdjustmentResolutionStatus =
  | "open"
  | "offset_applied"
  | "waived"
  | "written_off";

export type RefundRequestStatus =
  | "pending_review"
  | "approved_pending_gateway"
  | "rejected"
  | "withdrawn"
  | "completed"
  | "failed";

export type DisputeWorkflowStatus =
  | "open"
  | "under_review"
  | "won"
  | "withdrawn"
  | "lost";

export interface PurchaseRefundRequest {
  requestId: string;
  purchaseId: ObjectId;
  userId: ObjectId;
  amountSubunits: number;
  currency: SupportedCurrency;
  reason: string;
  status: RefundRequestStatus;
  requestedAt: Date;
  purchaseCapturedAt: Date;
  guaranteeDeadlineAt: Date;
  isWithin72hGuarantee: boolean;
  isExceptionalOverride: boolean;
  reviewedByAdminId: ObjectId | null;
  reviewedByAdminEmail: string | null;
  reviewedAt: Date | null;
  decisionReason: string | null;
  providerRefundId: string | null;
  updatedAt: Date;
}

export interface PurchaseDisputeRecord {
  disputeId: string;
  purchaseId: ObjectId;
  userId: ObjectId;
  disputedAmountSubunits: number;
  currency: SupportedCurrency;
  status: DisputeWorkflowStatus;
  reasonCode: string;
  openedAt: Date;
  evidenceDeadlineAt: Date | null;
  resolvedAt: Date | null;
  outcomeReason: string | null;
  adminNotes: string | null;
  referrerNotifiedAt: Date | null;
  updatedByAdminId: ObjectId | null;
  updatedByAdminEmail: string | null;
  updatedAt: Date;
}

export type PromotionCampaignStatus =
  | "active"
  | "inactive"
  | "scheduled"
  | "expired";

export interface PromotionCampaignRecord {
  campaignId: string;
  name: string;
  code: string; // Normalized uppercase unique code
  discountPercent: PromotionalDiscountPercent; // Strictly 5, 10, 15, or 20
  status: PromotionCampaignStatus;
  startsAt: Date;
  endsAt: Date;
  createdByAdminId: ObjectId;
  createdByAdminEmail: string;
  updatedByAdminId: ObjectId;
  updatedByAdminEmail: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReferralRiskMonitoringConfig {
  /**
   * Optional operator-configured risk review thresholds.
   * Null indicates no automated threshold is configured (never fabricates unapproved policy numbers).
   */
  maxPendingReservationsBeforeReview: number | null;
  maxDailyRedemptionsBeforeReview: number | null;
  requireManualReviewOnVelocityAlert: boolean;
}

export interface ReferralSuspensionHistoryEntry {
  action: "suspended" | "reinstated" | "risk_hold_overridden";
  reason: string;
  actorUserId: ObjectId;
  actorEmail: string;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// 3. Collection Document Models
// ---------------------------------------------------------------------------

export interface UserDocument {
  _id: ObjectId;
  email: string; // Stored in normalized lowercase
  passwordHash: string;
  name?: string;
  role?: UserRole; // Defaults to "customer" when omitted on pre-Stage-3B.3 documents
  status: AccountStatus;
  isEmailVerified: boolean;
  emailVerificationTokenHash?: string; // SHA-256 hash of single-use verification token
  emailVerificationExpires?: Date; // 24-hour expiry
  passwordResetTokenHash?: string; // SHA-256 hash of single-use password reset token
  passwordResetExpires?: Date; // 1-hour expiry
  // Legacy fields retained for backwards compatibility
  emailVerificationToken?: string;
  passwordResetToken?: string;
  // Additive Stage 3B.4 account restriction metadata
  suspendedAt?: Date | null;
  suspensionReason?: string | null;
  suspendedByAdminId?: ObjectId | null;
  // Additive Workstream B referral attribution metadata
  referredByCode?: string | null;
  referredByUserId?: ObjectId | null;
  referralAttributedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionDocument {
  _id: ObjectId;
  userId: ObjectId;
  tokenHash: string; // SHA-256 hash of the opaque session token
  createdAt: Date;
  expiresAt: Date;
  lastActiveAt: Date;
  userAgent?: string;
  ipAddress?: string;
}

export interface RateLimitDocument {
  _id: string; // Deterministic HMAC rate-limit bucket key
  count: number;
  resetAt: Date; // Window expiration timestamp (TTL-indexed)
  updatedAt: Date;
}

export interface PurchasePricingSnapshot {
  basePriceSubunits: number; // Integer minor units (paise/cents)
  discountPercentApplied: 0 | PromotionalDiscountPercent; // 0 when none; 10 for referral; 5/10/15/20 for promo
  discountSubunits: number;
  taxSubunits: number;
  totalSubunits: number;
  promoApplied: boolean;
  referralCodeApplied: string | null;
}

export interface PurchaseDocument {
  _id: ObjectId;
  userId: ObjectId;
  productSlug: string; // e.g., "german-english"
  editionVersion: string; // e.g., "1.0"
  region: PurchaseRegion;
  currency: SupportedCurrency;
  pricingSnapshot: PurchasePricingSnapshot;
  paymentProvider: PaymentProvider;
  /**
   * Optional at initial purchase document creation before provider order initialization;
   * enforced unique across all documents where `providerOrderId` is a string via partial unique index.
   */
  providerOrderId: string | null;
  /**
   * Optional until payment authorization/capture; enforced unique across all documents
   * where `providerPaymentId` is a string via partial unique index.
   */
  providerPaymentId: string | null;
  /**
   * Mandatory at initial purchase creation to guarantee checkout idempotency.
   */
  idempotencyKey: string;
  status: PurchaseStatus;
  referrerUserId: ObjectId | null;
  referralProfileId: ObjectId | null;
  capturedAt: Date | null;
  refundedAt: Date | null;
  disputedAt: Date | null;
  // Additive Stage 3B.4 internal refund & dispute workflow subdocuments
  refundRequest?: PurchaseRefundRequest | null;
  refundHistory?: PurchaseRefundRequest[];
  disputeRecord?: PurchaseDisputeRecord | null;
  disputeHistory?: PurchaseDisputeRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EntitlementDocument {
  _id: ObjectId;
  userId: ObjectId;
  purchaseId: ObjectId;
  productSlug: string;
  status: EntitlementStatus;
  /**
   * Independent restriction flags (Stage 3B.1 §5): resolving one restriction
   * must not restore `status: "active"` while any other restriction remains present.
   */
  activeRestrictionReasons: EntitlementRestrictionReason[];
  revocationReason: EntitlementRevocationReason | null;
  maxActiveDevices: 1;
  activeInstallationIdHash: string | null;
  deviceBoundAt: Date | null;
  lastValidatedAt: Date | null;
  offlineLeaseExpiresAt: Date | null;
  suspendedAt: Date | null;
  revokedAt: Date | null;
  // Additive Stage 3B.4 device replacement support metadata
  deviceReplacementCount?: number;
  lastDeviceResetAt?: Date | null;
  lastDeviceResetReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AffordabilityCountryRule {
  countryCode: string; // ISO 3166-1 alpha-2 uppercase, e.g. "KZ", "MN", "KE"
  countryName: string;
  currency: string; // 3-letter ISO currency code
  currencySymbol: string; // Presentation only (e.g. "₸", "₮", "KSh")
  basePriceSubunits: number; // Smallest unit of local currency (e.g. 1000000 for 10,000.00 KZT)
  usdFallbackPriceSubunits: number; // USD fallback in cents (e.g. 2400 for $24.00)
  isGatewaySupportedCurrency: boolean; // Verified provider support for direct checkout
  isActive: boolean; // Admin enabled/disabled status
  notes?: string | null;
  referenceExchangeRateToInr?: number | null; // e.g. 0.17 (1 KZT = 0.17 INR)
  approximateInrEquivalent?: number | null; // Reference INR estimate for admin preview
  updatedByAdminEmail: string;
  updatedAt: Date;
}

export interface PromotionSettingsDocument {
  _id: PromotionSettingsId;
  mode: PromotionMode;
  /**
   * Promotional discount percent when `mode === "promo"` (must be 5, 10, 15, or 20).
   * Set to 0 when `mode === "normal"`. Never stacks with referral discounts.
   */
  promotionalDiscountPercent: 0 | PromotionalDiscountPercent;
  /**
   * Referral customer discount is fixed at 10%.
   */
  referralCustomerDiscountPercent: typeof REFERRAL_CUSTOMER_DISCOUNT_PERCENT;
  /**
   * Referrer commission is fixed at 10% of actual purchase amount paid after discounts.
   */
  referrerCommissionPercent: typeof REFERRAL_COMMISSION_PERCENT;
  /**
   * Referral redemption cap is fixed at 50 successful paid redemptions.
   */
  maxSuccessfulReferralsPerUser: typeof MAX_SUCCESSFUL_REFERRALS_PER_USER;
  /**
   * Commission eligibility hold window is fixed at 72 hours from exact purchase timestamp.
   */
  holdWindowHours: typeof COMMISSION_HOLD_WINDOW_HOURS;
  /**
   * Minimum eligible commissions across all currencies combined required for payout.
   */
  minEligibleCommissionsForPayout: typeof MIN_ELIGIBLE_COMMISSIONS_FOR_PAYOUT;
  // Additive Stage 3B.4 promotional campaign & operational settings metadata
  activeCampaignId?: string | null;
  campaigns?: PromotionCampaignRecord[];
  riskMonitoringConfig?: ReferralRiskMonitoringConfig;
  productAvailability?: Record<string, "available" | "coming_soon" | "maintenance">;
  // Additive Workstream C regional & affordability pricing metadata
  affordabilityTargetInr?: number; // Target reference in INR (default: 2000)
  affordabilityRules?: AffordabilityCountryRule[];
  updatedByAdminId: ObjectId | null;
  updatedAt: Date;
  createdAt: Date;
}

export interface ReferralProfileDocument {
  _id: ObjectId;
  userId: ObjectId;
  qualifyingPurchaseId: ObjectId;
  referralCode: string; // Normalized uppercase
  status: ReferralProfileStatus;
  maxReferralsCap: typeof MAX_SUCCESSFUL_REFERRALS_PER_USER; // 50
  pendingReservedCount: number;
  successfulConversionsCount: number;
  payoutMethod: ReferralPayoutMethod;
  payoutDetailsEncryptedOrRef: string | null;
  // Additive Stage 3B.4 referral administration & risk hold metadata
  suspendedAt?: Date | null;
  suspensionReason?: string | null;
  suspendedByAdminId?: ObjectId | null;
  riskReviewRequired?: boolean;
  riskHoldReason?: string | null;
  adminOverrideReason?: string | null;
  suspensionHistory?: ReferralSuspensionHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CommissionDocument {
  _id: ObjectId;
  referrerUserId: ObjectId;
  referralProfileId: ObjectId;
  referredUserId: ObjectId;
  purchaseId: ObjectId;
  currency: SupportedCurrency;
  /**
   * Actual purchase amount paid after discounts (integer minor units).
   */
  netCollectedSubunits: number;
  /**
   * Fixed at 10% of actual purchase amount paid after discounts.
   */
  commissionRatePercent: typeof REFERRAL_COMMISSION_PERCENT;
  commissionAmountSubunits: number;
  status: CommissionStatus;
  /**
   * Exact timestamp of the purchase from which the 72-hour refund window is measured.
   */
  purchaseCapturedAt: Date;
  /**
   * Exact end of the 72-hour refund window (`purchaseCapturedAt + 72 hours`).
   */
  holdUntil: Date;
  /**
   * True when an unpaid commission is held due to an open dispute or pending refund.
   */
  isDisputedHold: boolean;
  eligibleAt: Date | null;
  approvedAt: Date | null;
  approvedByAdminId: ObjectId | null;
  payoutId: ObjectId | null;
  paidAt: Date | null;
  cancelledAt: Date | null;
  cancellationReason: CommissionCancellationReason | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PayoutDocument {
  _id: ObjectId;
  referrerUserId: ObjectId;
  referralProfileId: ObjectId;
  currency: SupportedCurrency;
  totalAmountSubunits: number;
  commissionIds: ObjectId[];
  status: PayoutStatus;
  payoutMethod: Exclude<ReferralPayoutMethod, "unset">;
  /**
   * Optional until external payout execution; enforced unique across all documents
   * where `externalTransferReference` is a string via partial unique index.
   */
  externalTransferReference: string | null;
  createdByAdminId: ObjectId;
  approvedByAdminId: ObjectId | null;
  paidAt: Date | null;
  failureReason: string | null;
  notes: string | null;
  // Additive Stage 3B.4 payout initiation & review metadata
  initiationType?: "admin_first_payout" | "referrer_requested";
  requestedAt?: Date | null;
  rejectedAt?: Date | null;
  rejectionReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentWebhookDocument {
  _id: ObjectId;
  provider: PaymentProvider;
  eventId: string;
  eventType: string;
  signatureVerified: boolean;
  payloadHash: string; // SHA-256 hex digest of raw webhook payload
  payloadSummary: Record<string, unknown>; // Redacted summary metadata
  relatedOrderId: string | null;
  relatedPaymentId: string | null;
  processingStatus: WebhookProcessingStatus;
  attempts: number;
  lastError: string | null;
  receivedAt: Date;
  processedAt: Date | null;
}

export interface AdminAuditLogDocument {
  _id: ObjectId;
  actorUserId: ObjectId | null;
  actorEmail: string;
  actorRole: "admin" | "system_bootstrap";
  action: string;
  targetCollection: string;
  targetId: string;
  outcome: AdminAuditOutcome;
  reason: string | null;
  correlationId: string;
  ipAddressHash: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface PurchaseEvidenceDocument {
  _id: ObjectId;
  purchaseId: ObjectId;
  userId: ObjectId;
  emailSnapshot: string;
  productSlug: string;
  editionVersion: string;
  region: PurchaseRegion;
  currency: SupportedCurrency;
  amountSubunits: number;
  providerOrderId: string;
  providerPaymentId: string;
  /**
   * Non-sensitive payment method summary only (e.g., "upi", "card_last4_4242").
   * Never store raw card PAN, CVV, or bank credentials.
   */
  paymentMethodSummary: string;
  ipAddressHash: string | null;
  countryCodeSnapshot: string | null;
  userAgentSnapshot: string | null;
  termsVersionAccepted: string;
  refundPolicyVersionAccepted: string;
  acceptedAt: Date;
  extensionActivatedAt: Date | null;
  firstInstallationIdHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommissionAdjustmentDocument {
  _id: ObjectId;
  commissionId: ObjectId;
  purchaseId: ObjectId;
  payoutId: ObjectId;
  referrerUserId: ObjectId;
  currency: SupportedCurrency;
  adjustmentAmountSubunits: number;
  reason: CommissionAdjustmentReason;
  resolutionStatus: CommissionAdjustmentResolutionStatus;
  offsetPayoutId: ObjectId | null;
  createdByAdminId: ObjectId | null;
  resolvedByAdminId: ObjectId | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProvisionedIndexSummary {
  collection: string;
  indexName: string;
}

// ---------------------------------------------------------------------------
// 4. Controlled Index Provisioning (`npm run db:indexes`)
// ---------------------------------------------------------------------------

/**
 * Creates an index on a collection and safely reconciles `IndexOptionsConflict` (code 85)
 * or `IndexKeySpecsConflict` (code 86) when upgrading an index definition (e.g., migrating
 * from an unconditional or sparse unique index to a partial unique index).
 */
async function createOrReconcileIndex<TSchema extends Document>(
  collection: Collection<TSchema>,
  indexSpec: IndexSpecification,
  options?: CreateIndexesOptions
): Promise<string> {
  try {
    return options
      ? await collection.createIndex(indexSpec, options)
      : await collection.createIndex(indexSpec);
  } catch (err: unknown) {
    const code =
      typeof err === "object" && err !== null && "code" in err
        ? (err as { code?: number }).code
        : undefined;

    if (
      (code === 85 || code === 86) &&
      typeof collection.dropIndex === "function"
    ) {
      const defaultIndexName =
        options?.name ||
        Object.entries(indexSpec as Record<string, unknown>)
          .map(([k, v]) => `${k}_${String(v)}`)
          .join("_");
      await collection.dropIndex(defaultIndexName);
      return options
        ? await collection.createIndex(indexSpec, options)
        : await collection.createIndex(indexSpec);
    }
    throw err;
  }
}

/**
 * Provision required collections and indexes explicitly.
 * Intended to be invoked by controlled provisioning scripts (`npm run db:indexes`)
 * rather than lazily during cold-start request handling.
 *
 * Note: `admin_audit_logs` and `purchase_evidence` intentionally have NO TTL
 * indexes because audit and dispute evidence records must be retained.
 */
export async function ensureIndexes(db: Db): Promise<ProvisionedIndexSummary[]> {
  const usersCollection = db.collection<UserDocument>(COLLECTION_NAMES.users);
  const sessionsCollection = db.collection<SessionDocument>(
    COLLECTION_NAMES.sessions
  );
  const rateLimitsCollection = db.collection<RateLimitDocument>(
    COLLECTION_NAMES.rateLimits
  );
  const purchasesCollection = db.collection<PurchaseDocument>(
    COLLECTION_NAMES.purchases
  );
  const entitlementsCollection = db.collection<EntitlementDocument>(
    COLLECTION_NAMES.entitlements
  );
  const promotionSettingsCollection = db.collection<PromotionSettingsDocument>(
    COLLECTION_NAMES.promotionSettings
  );
  const referralProfilesCollection = db.collection<ReferralProfileDocument>(
    COLLECTION_NAMES.referralProfiles
  );
  const commissionsCollection = db.collection<CommissionDocument>(
    COLLECTION_NAMES.commissions
  );
  const payoutsCollection = db.collection<PayoutDocument>(
    COLLECTION_NAMES.payouts
  );
  const paymentWebhooksCollection = db.collection<PaymentWebhookDocument>(
    COLLECTION_NAMES.paymentWebhooks
  );
  const adminAuditLogsCollection = db.collection<AdminAuditLogDocument>(
    COLLECTION_NAMES.adminAuditLogs
  );
  const purchaseEvidenceCollection = db.collection<PurchaseEvidenceDocument>(
    COLLECTION_NAMES.purchaseEvidence
  );
  const commissionAdjustmentsCollection =
    db.collection<CommissionAdjustmentDocument>(
      COLLECTION_NAMES.commissionAdjustments
    );

  const indexTasks: Array<{
    collection: CollectionName;
    run: () => Promise<string>;
  }> = [
    // 1. users (5 indexes)
    {
      collection: COLLECTION_NAMES.users,
      run: () =>
        createOrReconcileIndex(usersCollection, { email: 1 }, { unique: true }),
    },
    {
      collection: COLLECTION_NAMES.users,
      run: () =>
        createOrReconcileIndex(
          usersCollection,
          { emailVerificationTokenHash: 1 },
          { unique: true, sparse: true }
        ),
    },
    {
      collection: COLLECTION_NAMES.users,
      run: () =>
        createOrReconcileIndex(
          usersCollection,
          { passwordResetTokenHash: 1 },
          { unique: true, sparse: true }
        ),
    },
    {
      collection: COLLECTION_NAMES.users,
      run: () =>
        createOrReconcileIndex(usersCollection, { role: 1, status: 1 }),
    },
    {
      collection: COLLECTION_NAMES.users,
      run: () =>
        createOrReconcileIndex(
          usersCollection,
          { referredByUserId: 1 },
          { sparse: true }
        ),
    },

    // 2. sessions (3 indexes)
    {
      collection: COLLECTION_NAMES.sessions,
      run: () => createOrReconcileIndex(sessionsCollection, { userId: 1 }),
    },
    {
      collection: COLLECTION_NAMES.sessions,
      run: () =>
        createOrReconcileIndex(
          sessionsCollection,
          { tokenHash: 1 },
          { unique: true }
        ),
    },
    {
      collection: COLLECTION_NAMES.sessions,
      run: () =>
        createOrReconcileIndex(
          sessionsCollection,
          { expiresAt: 1 },
          { expireAfterSeconds: 0 }
        ),
    },

    // 3. rate_limits (1 index)
    {
      collection: COLLECTION_NAMES.rateLimits,
      run: () =>
        createOrReconcileIndex(
          rateLimitsCollection,
          { resetAt: 1 },
          { expireAfterSeconds: 0 }
        ),
    },

    // 4. purchases (6 indexes)
    // providerOrderId and providerPaymentId use partialFilterExpression: { <field>: { $type: "string" } }
    // so multiple records with null/absent optional provider identifiers can coexist while duplicate
    // populated string identifiers are strictly rejected with E11000.
    {
      collection: COLLECTION_NAMES.purchases,
      run: () =>
        createOrReconcileIndex(
          purchasesCollection,
          { providerOrderId: 1 },
          {
            unique: true,
            partialFilterExpression: { providerOrderId: { $type: "string" } },
          }
        ),
    },
    {
      collection: COLLECTION_NAMES.purchases,
      run: () =>
        createOrReconcileIndex(
          purchasesCollection,
          { providerPaymentId: 1 },
          {
            unique: true,
            partialFilterExpression: { providerPaymentId: { $type: "string" } },
          }
        ),
    },
    {
      collection: COLLECTION_NAMES.purchases,
      run: () =>
        createOrReconcileIndex(
          purchasesCollection,
          { idempotencyKey: 1 },
          { unique: true }
        ),
    },
    {
      collection: COLLECTION_NAMES.purchases,
      run: () =>
        createOrReconcileIndex(purchasesCollection, {
          userId: 1,
          productSlug: 1,
          status: 1,
        }),
    },
    {
      collection: COLLECTION_NAMES.purchases,
      run: () =>
        createOrReconcileIndex(purchasesCollection, {
          referrerUserId: 1,
          status: 1,
        }),
    },
    {
      collection: COLLECTION_NAMES.purchases,
      run: () =>
        createOrReconcileIndex(purchasesCollection, {
          status: 1,
          createdAt: -1,
        }),
    },

    // 5. entitlements (4 indexes)
    // { userId: 1, productSlug: 1 } uses partialFilterExpression: { status: { $in: ["active", "suspended"] } }
    // so a user can never have duplicate active or suspended entitlements for the same edition, while
    // historical "revoked" entitlements are preserved if the user legitimately repurchases later.
    {
      collection: COLLECTION_NAMES.entitlements,
      run: () =>
        createOrReconcileIndex(
          entitlementsCollection,
          { purchaseId: 1 },
          { unique: true }
        ),
    },
    {
      collection: COLLECTION_NAMES.entitlements,
      run: () =>
        createOrReconcileIndex(
          entitlementsCollection,
          { userId: 1, productSlug: 1 },
          {
            unique: true,
            partialFilterExpression: {
              status: { $in: ["active", "suspended"] },
            },
          }
        ),
    },
    {
      collection: COLLECTION_NAMES.entitlements,
      run: () =>
        createOrReconcileIndex(entitlementsCollection, {
          status: 1,
          productSlug: 1,
        }),
    },
    {
      collection: COLLECTION_NAMES.entitlements,
      run: () =>
        createOrReconcileIndex(
          entitlementsCollection,
          { activeInstallationIdHash: 1 },
          { sparse: true }
        ),
    },

    // 6. promotion_settings (1 index)
    {
      collection: COLLECTION_NAMES.promotionSettings,
      run: () =>
        createOrReconcileIndex(promotionSettingsCollection, {
          mode: 1,
          updatedAt: -1,
        }),
    },

    // 7. referral_profiles (4 indexes)
    {
      collection: COLLECTION_NAMES.referralProfiles,
      run: () =>
        createOrReconcileIndex(
          referralProfilesCollection,
          { userId: 1 },
          { unique: true }
        ),
    },
    {
      collection: COLLECTION_NAMES.referralProfiles,
      run: () =>
        createOrReconcileIndex(
          referralProfilesCollection,
          { referralCode: 1 },
          { unique: true }
        ),
    },
    {
      collection: COLLECTION_NAMES.referralProfiles,
      run: () =>
        createOrReconcileIndex(
          referralProfilesCollection,
          { qualifyingPurchaseId: 1 },
          { unique: true }
        ),
    },
    {
      collection: COLLECTION_NAMES.referralProfiles,
      run: () =>
        createOrReconcileIndex(referralProfilesCollection, {
          status: 1,
          successfulConversionsCount: -1,
        }),
    },

    // 8. commissions (4 indexes)
    {
      collection: COLLECTION_NAMES.commissions,
      run: () =>
        createOrReconcileIndex(
          commissionsCollection,
          { purchaseId: 1 },
          { unique: true }
        ),
    },
    {
      collection: COLLECTION_NAMES.commissions,
      run: () =>
        createOrReconcileIndex(commissionsCollection, {
          referrerUserId: 1,
          currency: 1,
          status: 1,
        }),
    },
    {
      collection: COLLECTION_NAMES.commissions,
      run: () =>
        createOrReconcileIndex(commissionsCollection, {
          status: 1,
          holdUntil: 1,
        }),
    },
    {
      collection: COLLECTION_NAMES.commissions,
      run: () =>
        createOrReconcileIndex(
          commissionsCollection,
          { payoutId: 1 },
          { sparse: true }
        ),
    },

    // 9. payouts (3 indexes)
    {
      collection: COLLECTION_NAMES.payouts,
      run: () =>
        createOrReconcileIndex(payoutsCollection, {
          referrerUserId: 1,
          currency: 1,
          status: 1,
        }),
    },
    {
      collection: COLLECTION_NAMES.payouts,
      run: () =>
        createOrReconcileIndex(payoutsCollection, {
          status: 1,
          createdAt: -1,
        }),
    },
    {
      collection: COLLECTION_NAMES.payouts,
      run: () =>
        createOrReconcileIndex(
          payoutsCollection,
          { externalTransferReference: 1 },
          {
            unique: true,
            partialFilterExpression: {
              externalTransferReference: { $type: "string" },
            },
          }
        ),
    },

    // 10. payment_webhooks (3 indexes)
    {
      collection: COLLECTION_NAMES.paymentWebhooks,
      run: () =>
        createOrReconcileIndex(
          paymentWebhooksCollection,
          { provider: 1, eventId: 1 },
          { unique: true }
        ),
    },
    {
      collection: COLLECTION_NAMES.paymentWebhooks,
      run: () =>
        createOrReconcileIndex(paymentWebhooksCollection, {
          processingStatus: 1,
          receivedAt: 1,
        }),
    },
    {
      collection: COLLECTION_NAMES.paymentWebhooks,
      run: () =>
        createOrReconcileIndex(
          paymentWebhooksCollection,
          { relatedPaymentId: 1 },
          { sparse: true }
        ),
    },

    // 11. admin_audit_logs (4 indexes — NO TTL deletion index)
    {
      collection: COLLECTION_NAMES.adminAuditLogs,
      run: () =>
        createOrReconcileIndex(adminAuditLogsCollection, {
          actorUserId: 1,
          createdAt: -1,
        }),
    },
    {
      collection: COLLECTION_NAMES.adminAuditLogs,
      run: () =>
        createOrReconcileIndex(adminAuditLogsCollection, {
          targetCollection: 1,
          targetId: 1,
          createdAt: -1,
        }),
    },
    {
      collection: COLLECTION_NAMES.adminAuditLogs,
      run: () =>
        createOrReconcileIndex(adminAuditLogsCollection, {
          action: 1,
          createdAt: -1,
        }),
    },
    {
      collection: COLLECTION_NAMES.adminAuditLogs,
      run: () =>
        createOrReconcileIndex(adminAuditLogsCollection, { correlationId: 1 }),
    },

    // 12. purchase_evidence (3 indexes — NO TTL deletion index)
    {
      collection: COLLECTION_NAMES.purchaseEvidence,
      run: () =>
        createOrReconcileIndex(
          purchaseEvidenceCollection,
          { purchaseId: 1 },
          { unique: true }
        ),
    },
    {
      collection: COLLECTION_NAMES.purchaseEvidence,
      run: () =>
        createOrReconcileIndex(
          purchaseEvidenceCollection,
          { providerPaymentId: 1 },
          { unique: true }
        ),
    },
    {
      collection: COLLECTION_NAMES.purchaseEvidence,
      run: () =>
        createOrReconcileIndex(purchaseEvidenceCollection, {
          userId: 1,
          createdAt: -1,
        }),
    },

    // 13. commission_adjustments (3 indexes)
    {
      collection: COLLECTION_NAMES.commissionAdjustments,
      run: () =>
        createOrReconcileIndex(
          commissionAdjustmentsCollection,
          { commissionId: 1 },
          { unique: true }
        ),
    },
    {
      collection: COLLECTION_NAMES.commissionAdjustments,
      run: () =>
        createOrReconcileIndex(commissionAdjustmentsCollection, {
          referrerUserId: 1,
          currency: 1,
          resolutionStatus: 1,
        }),
    },
    {
      collection: COLLECTION_NAMES.commissionAdjustments,
      run: () =>
        createOrReconcileIndex(commissionAdjustmentsCollection, {
          purchaseId: 1,
        }),
    },
  ];

  const resolvedNames: string[] = [];
  for (const task of indexTasks) {
    resolvedNames.push(await task.run());
  }

  return indexTasks.map((task, idx) => ({
    collection: task.collection,
    indexName: resolvedNames[idx],
  }));
}

// ---------------------------------------------------------------------------
// 5. Typed Collection Accessors (Decoupled from Cold-Start Index Creation)
// ---------------------------------------------------------------------------

/**
 * Application-level append-only wrapper for `admin_audit_logs`.
 * Blocks update, replace, delete, bulkWrite, and drop operations across all
 * application code paths that access `getAdminAuditLogsCollection(db)`.
 *
 * Note: This enforces append-only behavior at the application data-access layer.
 * It is not a substitute for MongoDB database-level RBAC when connecting with a
 * read/write database user on MongoDB Atlas M0.
 */
export interface AppendOnlyAdminAuditCollection {
  insertOne: Collection<AdminAuditLogDocument>["insertOne"];
  find: Collection<AdminAuditLogDocument>["find"];
  findOne: Collection<AdminAuditLogDocument>["findOne"];
  countDocuments: Collection<AdminAuditLogDocument>["countDocuments"];
  updateOne: (...args: unknown[]) => Promise<never>;
  updateMany: (...args: unknown[]) => Promise<never>;
  replaceOne: (...args: unknown[]) => Promise<never>;
  findOneAndUpdate: (...args: unknown[]) => Promise<never>;
  findOneAndReplace: (...args: unknown[]) => Promise<never>;
  deleteOne: (...args: unknown[]) => Promise<never>;
  deleteMany: (...args: unknown[]) => Promise<never>;
  findOneAndDelete: (...args: unknown[]) => Promise<never>;
  bulkWrite: (...args: unknown[]) => Promise<never>;
  drop: (...args: unknown[]) => Promise<never>;
}

export class ImmutableRecordError extends Error {
  public readonly code = "IMMUTABLE_RECORD_VIOLATION";

  constructor(message: string) {
    super(message);
    this.name = "ImmutableRecordError";
  }
}

export class AuditLogMutationForbiddenError extends ImmutableRecordError {
  constructor(operationName: string) {
    super(
      `Operation "${operationName}" is forbidden on append-only collection "admin_audit_logs"`
    );
  }
}

export function wrapAppendOnlyAdminAuditCollection(
  raw: Collection<AdminAuditLogDocument>
): AppendOnlyAdminAuditCollection {
  const rejectMutation = (opName: string) => {
    return async (): Promise<never> => {
      throw new AuditLogMutationForbiddenError(opName);
    };
  };

  return Object.freeze({
    insertOne:
      typeof raw.insertOne === "function"
        ? raw.insertOne.bind(raw)
        : (undefined as unknown as Collection<AdminAuditLogDocument>["insertOne"]),
    find:
      typeof raw.find === "function"
        ? raw.find.bind(raw)
        : (undefined as unknown as Collection<AdminAuditLogDocument>["find"]),
    findOne:
      typeof raw.findOne === "function"
        ? raw.findOne.bind(raw)
        : (undefined as unknown as Collection<AdminAuditLogDocument>["findOne"]),
    countDocuments:
      typeof raw.countDocuments === "function"
        ? raw.countDocuments.bind(raw)
        : (undefined as unknown as Collection<AdminAuditLogDocument>["countDocuments"]),
    updateOne: rejectMutation("updateOne"),
    updateMany: rejectMutation("updateMany"),
    replaceOne: rejectMutation("replaceOne"),
    findOneAndUpdate: rejectMutation("findOneAndUpdate"),
    findOneAndReplace: rejectMutation("findOneAndReplace"),
    deleteOne: rejectMutation("deleteOne"),
    deleteMany: rejectMutation("deleteMany"),
    findOneAndDelete: rejectMutation("findOneAndDelete"),
    bulkWrite: rejectMutation("bulkWrite"),
    drop: rejectMutation("drop"),
  });
}

export async function getUsersCollection(
  db: Db
): Promise<Collection<UserDocument>> {
  return db.collection<UserDocument>(COLLECTION_NAMES.users);
}

export async function getSessionsCollection(
  db: Db
): Promise<Collection<SessionDocument>> {
  return db.collection<SessionDocument>(COLLECTION_NAMES.sessions);
}

export async function getRateLimitsCollection(
  db: Db
): Promise<Collection<RateLimitDocument>> {
  return db.collection<RateLimitDocument>(COLLECTION_NAMES.rateLimits);
}

export async function getPurchasesCollection(
  db: Db
): Promise<Collection<PurchaseDocument>> {
  return db.collection<PurchaseDocument>(COLLECTION_NAMES.purchases);
}

export async function getEntitlementsCollection(
  db: Db
): Promise<Collection<EntitlementDocument>> {
  return db.collection<EntitlementDocument>(COLLECTION_NAMES.entitlements);
}

export async function getPromotionSettingsCollection(
  db: Db
): Promise<Collection<PromotionSettingsDocument>> {
  return db.collection<PromotionSettingsDocument>(
    COLLECTION_NAMES.promotionSettings
  );
}

export async function getReferralProfilesCollection(
  db: Db
): Promise<Collection<ReferralProfileDocument>> {
  return db.collection<ReferralProfileDocument>(
    COLLECTION_NAMES.referralProfiles
  );
}

export async function getCommissionsCollection(
  db: Db
): Promise<Collection<CommissionDocument>> {
  return db.collection<CommissionDocument>(COLLECTION_NAMES.commissions);
}

export async function getPayoutsCollection(
  db: Db
): Promise<Collection<PayoutDocument>> {
  return db.collection<PayoutDocument>(COLLECTION_NAMES.payouts);
}

export async function getPaymentWebhooksCollection(
  db: Db
): Promise<Collection<PaymentWebhookDocument>> {
  return db.collection<PaymentWebhookDocument>(COLLECTION_NAMES.paymentWebhooks);
}

/**
 * Returns the append-only protected `admin_audit_logs` collection accessor.
 * Update, replace, and delete methods are blocked across all application callers.
 */
export async function getAdminAuditLogsCollection(
  db: Db
): Promise<AppendOnlyAdminAuditCollection> {
  const raw = db.collection<AdminAuditLogDocument>(
    COLLECTION_NAMES.adminAuditLogs
  );
  return wrapAppendOnlyAdminAuditCollection(raw);
}

export async function getPurchaseEvidenceCollection(
  db: Db
): Promise<Collection<PurchaseEvidenceDocument>> {
  return db.collection<PurchaseEvidenceDocument>(
    COLLECTION_NAMES.purchaseEvidence
  );
}

export async function getCommissionAdjustmentsCollection(
  db: Db
): Promise<Collection<CommissionAdjustmentDocument>> {
  return db.collection<CommissionAdjustmentDocument>(
    COLLECTION_NAMES.commissionAdjustments
  );
}
