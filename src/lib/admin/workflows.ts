import crypto from "node:crypto";
import { ClientSession, Db, MongoClient, ObjectId } from "mongodb";
import {
  AffordabilityCountryRule,
  ALLOWED_PROMOTIONAL_DISCOUNT_PERCENTS,
  COLLECTION_NAMES,
  COMMISSION_HOLD_WINDOW_HOURS,
  COMMISSION_HOLD_WINDOW_MS,
  CommissionAdjustmentReason,
  CommissionAdjustmentResolutionStatus,
  EntitlementRevocationReason,
  getCommissionAdjustmentsCollection,
  getCommissionsCollection,
  getEntitlementsCollection,
  getPayoutsCollection,
  getPromotionSettingsCollection,
  getPurchasesCollection,
  getReferralProfilesCollection,
  getSessionsCollection,
  getUsersCollection,
  MAX_SUCCESSFUL_REFERRALS_PER_USER,
  MIN_ELIGIBLE_COMMISSIONS_FOR_PAYOUT,
  PayoutDocument,
  PromotionalDiscountPercent,
  PromotionCampaignRecord,
  PromotionMode,
  PurchaseDisputeRecord,
  PurchaseRefundRequest,
  REFERRAL_COMMISSION_PERCENT,
  REFERRAL_CUSTOMER_DISCOUNT_PERCENT,
  ReferralPayoutMethod,
  SupportedCurrency,
} from "@/lib/db/models";
import {
  applyEntitlementRestriction,
  assertCommissionCanBecomeEligible,
  assertPayoutBatchConsistency,
  assertValidCommissionTransition,
  assertValidPurchaseTransition,
  buildCommissionAdjustmentDocument,
  buildPayoutDocument,
  DataValidationError,
  InvalidStateTransitionError,
  placeUnpaidCommissionOnDisputeHold,
  resolveEntitlementRestriction,
  revokeEntitlementState,
  runInReplicaSetTransaction,
} from "@/lib/db/repositories";
import { isProtectedPricingCountry } from "@/lib/pricing/countries";
import {
  AuthenticatedAdminContext,
  getConfiguredAdminEmailAllowlist,
  resolveUserRole,
} from "@/lib/auth/admin";
import { executeAuditedAdminAction } from "@/lib/audit/adminAudit";

export interface AdminMutationContext {
  db: Db;
  client?: MongoClient | null;
  actor: Pick<AuthenticatedAdminContext, "userId" | "email" | "role">;
  reason: string;
  ipAddressHash?: string | null;
  userAgent?: string | null;
  now?: Date;
}

/**
 * Revalidates the administrator identity against the live `users` collection in `db`
 * before every sensitive administrative mutation.
 * Ensures a normal user or a recently suspended/demoted admin can never execute mutations.
 */
export async function assertLiveAdminActor(
  db: Db,
  actor: Pick<AuthenticatedAdminContext, "userId" | "email" | "role">
): Promise<void> {
  if (!actor || actor.role !== "admin" || !(actor.userId instanceof ObjectId)) {
    throw new DataValidationError("Admin authorization required.");
  }

  const usersCol = await getUsersCollection(db);
  const liveUser = await usersCol.findOne({ _id: actor.userId });
  if (!liveUser) {
    throw new DataValidationError("Administrator account not found.");
  }
  if (liveUser.status !== "active") {
    throw new DataValidationError("Administrator account is suspended.");
  }
  if (liveUser.isEmailVerified !== true) {
    throw new DataValidationError(
      "Administrator account requires a verified email address."
    );
  }
  if (resolveUserRole(liveUser) !== "admin") {
    throw new DataValidationError("Insufficient privileges: admin role required.");
  }

  const allowlist = getConfiguredAdminEmailAllowlist();
  if (allowlist && !allowlist.has(liveUser.email.trim().toLowerCase())) {
    throw new DataValidationError(
      "Administrator email is not in ADMIN_EMAIL_ALLOWLIST."
    );
  }
}

function assertValidReason(reason: string | undefined | null): string {
  const trimmed = reason?.trim() || "";
  if (trimmed.length < 5) {
    throw new DataValidationError(
      "An explicit administrator reason of at least 5 characters is required."
    );
  }
  return trimmed;
}

/**
 * Executes a multi-document workflow inside a replica-set ACID transaction when
 * a live `MongoClient` is provided, or directly when running against an in-memory unit-test mock Db.
 */
async function executeWithOptionalTransaction<T>(
  ctx: { db: Db; client?: MongoClient | null },
  fn: (session?: ClientSession) => Promise<T>
): Promise<T> {
  if (ctx.client) {
    return runInReplicaSetTransaction(ctx.client, ctx.db, (session) =>
      fn(session)
    );
  }
  return fn(undefined);
}

// ---------------------------------------------------------------------------
// 1. User Account Suspension & Restoration (Distinct from Entitlements)
// ---------------------------------------------------------------------------

export async function suspendUserAccountByAdmin(
  ctx: AdminMutationContext,
  targetUserIdStr: string
) {
  await assertLiveAdminActor(ctx.db, ctx.actor);
  const reason = assertValidReason(ctx.reason);
  const now = ctx.now || new Date();
  const targetUserId = new ObjectId(targetUserIdStr);

  if (targetUserId.equals(ctx.actor.userId)) {
    throw new InvalidStateTransitionError(
      "Administrators cannot suspend their own active account."
    );
  }

  const usersCol = await getUsersCollection(ctx.db);
  const sessionsCol = await getSessionsCollection(ctx.db);

  const existingUser = await usersCol.findOne({ _id: targetUserId });
  if (!existingUser) {
    throw new DataValidationError("Target user not found.");
  }
  if (existingUser.status === "suspended") {
    throw new InvalidStateTransitionError("User account is already suspended.");
  }

  return executeAuditedAdminAction({
    db: ctx.db,
    actor: ctx.actor,
    action: "user.suspend_account",
    targetCollection: COLLECTION_NAMES.users,
    targetId: targetUserId,
    reason,
    ipAddressHash: ctx.ipAddressHash,
    userAgent: ctx.userAgent,
    metadata: {
      previousStatus: existingUser.status,
      newStatus: "suspended",
      targetEmail: existingUser.email,
    },
    operation: async () => {
      await usersCol.updateOne(
        { _id: targetUserId },
        {
          $set: {
            status: "suspended",
            suspendedAt: now,
            suspensionReason: reason,
            suspendedByAdminId: ctx.actor.userId,
            updatedAt: now,
          },
        }
      );
      // Revoke active web login sessions while leaving entitlements and purchase records untouched
      await sessionsCol.deleteMany({ userId: targetUserId });
      return { userId: targetUserId.toString(), status: "suspended" as const };
    },
  });
}

export async function restoreUserAccountByAdmin(
  ctx: AdminMutationContext,
  targetUserIdStr: string
) {
  await assertLiveAdminActor(ctx.db, ctx.actor);
  const reason = assertValidReason(ctx.reason);
  const now = ctx.now || new Date();
  const targetUserId = new ObjectId(targetUserIdStr);

  const usersCol = await getUsersCollection(ctx.db);
  const existingUser = await usersCol.findOne({ _id: targetUserId });
  if (!existingUser) {
    throw new DataValidationError("Target user not found.");
  }
  if (existingUser.status !== "suspended") {
    throw new InvalidStateTransitionError(
      "User account is already active and not suspended."
    );
  }

  return executeAuditedAdminAction({
    db: ctx.db,
    actor: ctx.actor,
    action: "user.restore_account",
    targetCollection: COLLECTION_NAMES.users,
    targetId: targetUserId,
    reason,
    ipAddressHash: ctx.ipAddressHash,
    userAgent: ctx.userAgent,
    metadata: {
      previousStatus: existingUser.status,
      newStatus: "active",
      previousSuspensionReason: existingUser.suspensionReason ?? null,
      targetEmail: existingUser.email,
    },
    operation: async () => {
      await usersCol.updateOne(
        { _id: targetUserId },
        {
          $set: {
            status: "active",
            suspendedAt: null,
            suspensionReason: null,
            suspendedByAdminId: null,
            updatedAt: now,
          },
        }
      );
      return { userId: targetUserId.toString(), status: "active" as const };
    },
  });
}

// ---------------------------------------------------------------------------
// 2. Entitlement Management & Device Replacement Workflows
// ---------------------------------------------------------------------------

export async function suspendEntitlementByAdmin(
  ctx: AdminMutationContext,
  entitlementIdStr: string
) {
  await assertLiveAdminActor(ctx.db, ctx.actor);
  const reason = assertValidReason(ctx.reason);
  const now = ctx.now || new Date();
  const entitlementId = new ObjectId(entitlementIdStr);

  const entitlementsCol = await getEntitlementsCollection(ctx.db);
  const ent = await entitlementsCol.findOne({ _id: entitlementId });
  if (!ent) {
    throw new DataValidationError("Entitlement not found.");
  }
  if (ent.activeRestrictionReasons.includes("admin_suspended")) {
    throw new InvalidStateTransitionError(
      'Entitlement already has the "admin_suspended" restriction active.'
    );
  }

  const patch = applyEntitlementRestriction(ent, "admin_suspended", now);

  return executeAuditedAdminAction({
    db: ctx.db,
    actor: ctx.actor,
    action: "entitlement.suspend",
    targetCollection: COLLECTION_NAMES.entitlements,
    targetId: entitlementId,
    reason,
    ipAddressHash: ctx.ipAddressHash,
    userAgent: ctx.userAgent,
    metadata: {
      previousStatus: ent.status,
      previousRestrictions: ent.activeRestrictionReasons,
      newStatus: patch.status,
      newRestrictions: patch.activeRestrictionReasons,
    },
    operation: async () => {
      await entitlementsCol.updateOne({ _id: entitlementId }, { $set: patch });
      return {
        entitlementId: entitlementId.toString(),
        status: patch.status,
        activeRestrictionReasons: patch.activeRestrictionReasons,
      };
    },
  });
}

export async function restoreEntitlementByAdmin(
  ctx: AdminMutationContext,
  entitlementIdStr: string
) {
  await assertLiveAdminActor(ctx.db, ctx.actor);
  const reason = assertValidReason(ctx.reason);
  const now = ctx.now || new Date();
  const entitlementId = new ObjectId(entitlementIdStr);

  const entitlementsCol = await getEntitlementsCollection(ctx.db);
  const ent = await entitlementsCol.findOne({ _id: entitlementId });
  if (!ent) {
    throw new DataValidationError("Entitlement not found.");
  }
  if (!ent.activeRestrictionReasons.includes("admin_suspended")) {
    throw new InvalidStateTransitionError(
      'Entitlement does not have an active "admin_suspended" restriction to clear.'
    );
  }

  const patch = resolveEntitlementRestriction(ent, "admin_suspended", now);

  return executeAuditedAdminAction({
    db: ctx.db,
    actor: ctx.actor,
    action: "entitlement.restore",
    targetCollection: COLLECTION_NAMES.entitlements,
    targetId: entitlementId,
    reason,
    ipAddressHash: ctx.ipAddressHash,
    userAgent: ctx.userAgent,
    metadata: {
      previousStatus: ent.status,
      previousRestrictions: ent.activeRestrictionReasons,
      newStatus: patch.status,
      remainingRestrictions: patch.activeRestrictionReasons,
    },
    operation: async () => {
      await entitlementsCol.updateOne({ _id: entitlementId }, { $set: patch });
      return {
        entitlementId: entitlementId.toString(),
        status: patch.status,
        activeRestrictionReasons: patch.activeRestrictionReasons,
      };
    },
  });
}

export async function revokeEntitlementByAdmin(
  ctx: AdminMutationContext,
  entitlementIdStr: string,
  revocationReason: EntitlementRevocationReason = "admin_revoked"
) {
  await assertLiveAdminActor(ctx.db, ctx.actor);
  const reason = assertValidReason(ctx.reason);
  const now = ctx.now || new Date();
  const entitlementId = new ObjectId(entitlementIdStr);

  const entitlementsCol = await getEntitlementsCollection(ctx.db);
  const ent = await entitlementsCol.findOne({ _id: entitlementId });
  if (!ent) {
    throw new DataValidationError("Entitlement not found.");
  }

  const patch = revokeEntitlementState(ent, revocationReason, now);

  return executeAuditedAdminAction({
    db: ctx.db,
    actor: ctx.actor,
    action: "entitlement.revoke",
    targetCollection: COLLECTION_NAMES.entitlements,
    targetId: entitlementId,
    reason,
    ipAddressHash: ctx.ipAddressHash,
    userAgent: ctx.userAgent,
    metadata: {
      previousStatus: ent.status,
      newStatus: "revoked",
      revocationReason,
      purchaseId: ent.purchaseId.toString(),
    },
    operation: async () => {
      // Never delete historical entitlement documents; update status to "revoked"
      await entitlementsCol.updateOne({ _id: entitlementId }, { $set: patch });
      return {
        entitlementId: entitlementId.toString(),
        status: patch.status,
        revocationReason: patch.revocationReason,
      };
    },
  });
}

export async function processDeviceReplacementByAdmin(
  ctx: AdminMutationContext,
  entitlementIdStr: string
) {
  await assertLiveAdminActor(ctx.db, ctx.actor);
  const reason = assertValidReason(ctx.reason);
  const now = ctx.now || new Date();
  const entitlementId = new ObjectId(entitlementIdStr);

  const entitlementsCol = await getEntitlementsCollection(ctx.db);
  const ent = await entitlementsCol.findOne({ _id: entitlementId });
  if (!ent) {
    throw new DataValidationError("Entitlement not found.");
  }
  if (ent.status === "revoked") {
    throw new InvalidStateTransitionError(
      "Cannot process device replacement on a permanently revoked entitlement."
    );
  }

  const nextReplacementCount = (ent.deviceReplacementCount ?? 0) + 1;

  return executeAuditedAdminAction({
    db: ctx.db,
    actor: ctx.actor,
    action: "entitlement.replace_device",
    targetCollection: COLLECTION_NAMES.entitlements,
    targetId: entitlementId,
    reason,
    ipAddressHash: ctx.ipAddressHash,
    userAgent: ctx.userAgent,
    metadata: {
      previousInstallationIdHash: ent.activeInstallationIdHash,
      newInstallationIdHash: null,
      deviceReplacementCount: nextReplacementCount,
    },
    operation: async () => {
      await entitlementsCol.updateOne(
        { _id: entitlementId },
        {
          $set: {
            activeInstallationIdHash: null,
            deviceBoundAt: null,
            offlineLeaseExpiresAt: null,
            deviceReplacementCount: nextReplacementCount,
            lastDeviceResetAt: now,
            lastDeviceResetReason: reason,
            updatedAt: now,
          },
        }
      );
      return {
        entitlementId: entitlementId.toString(),
        deviceReplacementCount: nextReplacementCount,
        activeInstallationIdHash: null,
      };
    },
  });
}

// ---------------------------------------------------------------------------
// 3. Refund Request, Review & Decision Workflows (Section 8)
// ---------------------------------------------------------------------------

export async function createInternalRefundRequest(
  ctx: AdminMutationContext,
  purchaseIdStr: string
) {
  await assertLiveAdminActor(ctx.db, ctx.actor);
  const reason = assertValidReason(ctx.reason);
  const now = ctx.now || new Date();
  const purchaseId = new ObjectId(purchaseIdStr);

  const purchasesCol = await getPurchasesCollection(ctx.db);
  const entitlementsCol = await getEntitlementsCollection(ctx.db);
  const commissionsCol = await getCommissionsCollection(ctx.db);

  const purchase = await purchasesCol.findOne({ _id: purchaseId });
  if (!purchase) {
    throw new DataValidationError("Purchase not found.");
  }
  if (purchase.status !== "captured") {
    throw new InvalidStateTransitionError(
      `Refund requests can only be opened for captured purchases (current status: "${purchase.status}").`
    );
  }
  if (
    purchase.refundRequest &&
    (purchase.refundRequest.status === "pending_review" ||
      purchase.refundRequest.status === "approved_pending_gateway" ||
      purchase.refundRequest.status === "completed")
  ) {
    throw new InvalidStateTransitionError(
      `Purchase already has an active or completed refund request (${purchase.refundRequest.status}).`
    );
  }

  const capturedAt = purchase.capturedAt || purchase.createdAt;
  const guaranteeDeadlineAt = new Date(
    capturedAt.getTime() + COMMISSION_HOLD_WINDOW_MS
  );
  const isWithin72hGuarantee =
    now.getTime() <= guaranteeDeadlineAt.getTime();

  const refundRequest: PurchaseRefundRequest = {
    requestId: `refreq_${crypto.randomBytes(6).toString("hex")}`,
    purchaseId: purchase._id,
    userId: purchase.userId,
    amountSubunits: purchase.pricingSnapshot.totalSubunits, // Full refund only (no partial refunds)
    currency: purchase.currency,
    reason,
    status: "pending_review",
    requestedAt: now,
    purchaseCapturedAt: capturedAt,
    guaranteeDeadlineAt,
    isWithin72hGuarantee,
    isExceptionalOverride: false,
    reviewedByAdminId: null,
    reviewedByAdminEmail: null,
    reviewedAt: null,
    decisionReason: null,
    providerRefundId: null,
    updatedAt: now,
  };

  return executeAuditedAdminAction({
    db: ctx.db,
    actor: ctx.actor,
    action: "refund.create_request",
    targetCollection: COLLECTION_NAMES.purchases,
    targetId: purchaseId,
    reason,
    ipAddressHash: ctx.ipAddressHash,
    userAgent: ctx.userAgent,
    metadata: {
      requestId: refundRequest.requestId,
      amountSubunits: refundRequest.amountSubunits,
      currency: refundRequest.currency,
      isWithin72hGuarantee,
    },
    operation: async () => {
      return executeWithOptionalTransaction(ctx, async (session) => {
        const prevHistory = purchase.refundHistory || [];
        await purchasesCol.updateOne(
          { _id: purchaseId },
          {
            $set: {
              refundRequest,
              refundHistory: [...prevHistory, refundRequest],
              updatedAt: now,
            },
          },
          session ? { session } : undefined
        );

        // Temporarily suspend entitlement with "refund_pending"
        const ent = await entitlementsCol.findOne(
          { purchaseId },
          session ? { session } : undefined
        );
        if (ent && ent.status !== "revoked") {
          const entPatch = applyEntitlementRestriction(
            ent,
            "refund_pending",
            now
          );
          await entitlementsCol.updateOne(
            { _id: ent._id },
            { $set: entPatch },
            session ? { session } : undefined
          );
        }

        // Hold unpaid commission if present
        const comm = await commissionsCol.findOne(
          { purchaseId },
          session ? { session } : undefined
        );
        if (comm && comm.status !== "paid" && comm.status !== "cancelled") {
          const commPatch = placeUnpaidCommissionOnDisputeHold(comm, now);
          await commissionsCol.updateOne(
            { _id: comm._id },
            { $set: commPatch },
            session ? { session } : undefined
          );
        }

        return refundRequest;
      });
    },
  });
}

export async function approveRefundRequestByAdmin(
  ctx: AdminMutationContext,
  purchaseIdStr: string,
  options?: { isExceptionalOverride?: boolean }
) {
  await assertLiveAdminActor(ctx.db, ctx.actor);
  const reason = assertValidReason(ctx.reason);
  const now = ctx.now || new Date();
  const purchaseId = new ObjectId(purchaseIdStr);

  const purchasesCol = await getPurchasesCollection(ctx.db);
  const purchase = await purchasesCol.findOne({ _id: purchaseId });
  if (!purchase || !purchase.refundRequest) {
    throw new DataValidationError("Refund request not found for this purchase.");
  }

  const req = purchase.refundRequest;
  if (req.status !== "pending_review") {
    throw new InvalidStateTransitionError(
      `Only "pending_review" refund requests can be approved (found "${req.status}").`
    );
  }

  const isOverride = Boolean(options?.isExceptionalOverride);
  if (!req.isWithin72hGuarantee && !isOverride) {
    throw new InvalidStateTransitionError(
      `Standard money-back guarantee is strictly ${COMMISSION_HOLD_WINDOW_HOURS} hours from the purchase timestamp. An explicit exceptional override is required to approve a request outside the 72-hour window.`
    );
  }

  const updatedReq: PurchaseRefundRequest = {
    ...req,
    status: "approved_pending_gateway",
    isExceptionalOverride: !req.isWithin72hGuarantee && isOverride,
    reviewedByAdminId: ctx.actor.userId,
    reviewedByAdminEmail: ctx.actor.email,
    reviewedAt: now,
    decisionReason: reason,
    updatedAt: now,
  };

  return executeAuditedAdminAction({
    db: ctx.db,
    actor: ctx.actor,
    action: "refund.approve_request",
    targetCollection: COLLECTION_NAMES.purchases,
    targetId: purchaseId,
    reason,
    ipAddressHash: ctx.ipAddressHash,
    userAgent: ctx.userAgent,
    metadata: {
      requestId: req.requestId,
      previousStatus: req.status,
      newStatus: updatedReq.status,
      isWithin72hGuarantee: req.isWithin72hGuarantee,
      isExceptionalOverride: updatedReq.isExceptionalOverride,
      gatewayExecutionNote:
        "Internal approval recorded; actual payment-provider refund execution remains deferred until Razorpay integration.",
    },
    operation: async () => {
      // Important: Do NOT mark purchase.status = "refunded" or fabricate a completed gateway refund!
      const prevHistory = (purchase.refundHistory || []).filter(
        (h) => h.requestId !== req.requestId
      );
      await purchasesCol.updateOne(
        { _id: purchaseId },
        {
          $set: {
            refundRequest: updatedReq,
            refundHistory: [...prevHistory, updatedReq],
            updatedAt: now,
          },
        }
      );
      return updatedReq;
    },
  });
}

export async function rejectRefundRequestByAdmin(
  ctx: AdminMutationContext,
  purchaseIdStr: string
) {
  await assertLiveAdminActor(ctx.db, ctx.actor);
  const reason = assertValidReason(ctx.reason);
  const now = ctx.now || new Date();
  const purchaseId = new ObjectId(purchaseIdStr);

  const purchasesCol = await getPurchasesCollection(ctx.db);
  const entitlementsCol = await getEntitlementsCollection(ctx.db);
  const commissionsCol = await getCommissionsCollection(ctx.db);

  const purchase = await purchasesCol.findOne({ _id: purchaseId });
  if (!purchase || !purchase.refundRequest) {
    throw new DataValidationError("Refund request not found for this purchase.");
  }

  const req = purchase.refundRequest;
  if (
    req.status !== "pending_review" &&
    req.status !== "approved_pending_gateway"
  ) {
    throw new InvalidStateTransitionError(
      `Cannot reject a refund request in status "${req.status}".`
    );
  }

  const updatedReq: PurchaseRefundRequest = {
    ...req,
    status: "rejected",
    reviewedByAdminId: ctx.actor.userId,
    reviewedByAdminEmail: ctx.actor.email,
    reviewedAt: now,
    decisionReason: reason,
    updatedAt: now,
  };

  return executeAuditedAdminAction({
    db: ctx.db,
    actor: ctx.actor,
    action: "refund.reject_request",
    targetCollection: COLLECTION_NAMES.purchases,
    targetId: purchaseId,
    reason,
    ipAddressHash: ctx.ipAddressHash,
    userAgent: ctx.userAgent,
    metadata: {
      requestId: req.requestId,
      previousStatus: req.status,
      newStatus: "rejected",
    },
    operation: async () => {
      return executeWithOptionalTransaction(ctx, async (session) => {
        const prevHistory = (purchase.refundHistory || []).filter(
          (h) => h.requestId !== req.requestId
        );
        await purchasesCol.updateOne(
          { _id: purchaseId },
          {
            $set: {
              refundRequest: updatedReq,
              refundHistory: [...prevHistory, updatedReq],
              updatedAt: now,
            },
          },
          session ? { session } : undefined
        );

        // Clear "refund_pending" on entitlement; only restores "active" if NO other restriction remains!
        const ent = await entitlementsCol.findOne(
          { purchaseId },
          session ? { session } : undefined
        );
        let updatedEntitlementStatus = ent?.status ?? null;
        if (ent && ent.status !== "revoked") {
          const entPatch = resolveEntitlementRestriction(
            ent,
            "refund_pending",
            now
          );
          await entitlementsCol.updateOne(
            { _id: ent._id },
            { $set: entPatch },
            session ? { session } : undefined
          );
          updatedEntitlementStatus = entPatch.status;
        }

        // Release commission dispute hold ONLY if no active dispute remains on the purchase
        const hasOpenDispute =
          purchase.status === "disputed" ||
          purchase.disputeRecord?.status === "open" ||
          purchase.disputeRecord?.status === "under_review";

        const comm = await commissionsCol.findOne(
          { purchaseId },
          session ? { session } : undefined
        );
        if (comm && comm.isDisputedHold && !hasOpenDispute) {
          await commissionsCol.updateOne(
            { _id: comm._id },
            {
              $set: {
                isDisputedHold: false,
                updatedAt: now,
              },
            },
            session ? { session } : undefined
          );
        }

        return {
          refundRequest: updatedReq,
          entitlementStatus: updatedEntitlementStatus,
        };
      });
    },
  });
}

export async function initiateGatewayRefundByAdmin(
  ctx: AdminMutationContext,
  purchaseIdStr: string
) {
  await assertLiveAdminActor(ctx.db, ctx.actor);
  const reason = assertValidReason(ctx.reason);
  const purchaseId = new ObjectId(purchaseIdStr);

  return executeAuditedAdminAction({
    db: ctx.db,
    actor: ctx.actor,
    action: "refund.initiate_gateway",
    targetCollection: COLLECTION_NAMES.purchases,
    targetId: purchaseId,
    reason,
    ipAddressHash: ctx.ipAddressHash,
    userAgent: ctx.userAgent,
    operation: async () => {
      throw new InvalidStateTransitionError(
        "Live Razorpay refund initiation is deferred until Stage 3C gateway integration. Refusing to fabricate a provider refund event."
      );
    },
  });
}

// ---------------------------------------------------------------------------
// 4. Dispute & Chargeback Management Workflows (Section 9)
// ---------------------------------------------------------------------------

export async function openInternalDisputeRecord(
  ctx: AdminMutationContext,
  purchaseIdStr: string,
  options?: {
    reasonCode?: string;
    evidenceDeadlineAt?: string | null;
    adminNotes?: string | null;
  }
) {
  await assertLiveAdminActor(ctx.db, ctx.actor);
  const reason = assertValidReason(ctx.reason);
  const now = ctx.now || new Date();
  const purchaseId = new ObjectId(purchaseIdStr);

  const purchasesCol = await getPurchasesCollection(ctx.db);
  const entitlementsCol = await getEntitlementsCollection(ctx.db);
  const commissionsCol = await getCommissionsCollection(ctx.db);

  const purchase = await purchasesCol.findOne({ _id: purchaseId });
  if (!purchase) {
    throw new DataValidationError("Purchase not found.");
  }

  assertValidPurchaseTransition(purchase.status, "disputed");

  const deadlineDate = options?.evidenceDeadlineAt
    ? new Date(options.evidenceDeadlineAt)
    : null;
  const validDeadline =
    deadlineDate && !Number.isNaN(deadlineDate.getTime()) ? deadlineDate : null;

  const disputeRecord: PurchaseDisputeRecord = {
    disputeId: `disp_${crypto.randomBytes(6).toString("hex")}`,
    purchaseId: purchase._id,
    userId: purchase.userId,
    disputedAmountSubunits: purchase.pricingSnapshot.totalSubunits,
    currency: purchase.currency,
    status: "open",
    reasonCode: options?.reasonCode?.trim() || "chargeback_opened",
    openedAt: now,
    evidenceDeadlineAt: validDeadline,
    resolvedAt: null,
    outcomeReason: null,
    adminNotes: options?.adminNotes?.trim() || reason,
    referrerNotifiedAt: purchase.referrerUserId ? now : null,
    updatedByAdminId: ctx.actor.userId,
    updatedByAdminEmail: ctx.actor.email,
    updatedAt: now,
  };

  return executeAuditedAdminAction({
    db: ctx.db,
    actor: ctx.actor,
    action: "dispute.open",
    targetCollection: COLLECTION_NAMES.purchases,
    targetId: purchaseId,
    reason,
    ipAddressHash: ctx.ipAddressHash,
    userAgent: ctx.userAgent,
    metadata: {
      disputeId: disputeRecord.disputeId,
      previousPurchaseStatus: purchase.status,
      newPurchaseStatus: "disputed",
      disputedAmountSubunits: disputeRecord.disputedAmountSubunits,
      currency: disputeRecord.currency,
    },
    operation: async () => {
      return executeWithOptionalTransaction(ctx, async (session) => {
        const prevHistory = purchase.disputeHistory || [];
        await purchasesCol.updateOne(
          { _id: purchaseId },
          {
            $set: {
              status: "disputed",
              disputedAt: now,
              disputeRecord,
              disputeHistory: [...prevHistory, disputeRecord],
              updatedAt: now,
            },
          },
          session ? { session } : undefined
        );

        // 1. Suspend entitlement with "chargeback_open"
        const ent = await entitlementsCol.findOne(
          { purchaseId },
          session ? { session } : undefined
        );
        if (ent && ent.status !== "revoked") {
          const entPatch = applyEntitlementRestriction(
            ent,
            "chargeback_open",
            now
          );
          await entitlementsCol.updateOne(
            { _id: ent._id },
            { $set: entPatch },
            session ? { session } : undefined
          );
        }

        // 2. Freeze unpaid related commission (preserve paid commissions!)
        const comm = await commissionsCol.findOne(
          { purchaseId },
          session ? { session } : undefined
        );
        if (comm && comm.status !== "paid" && comm.status !== "cancelled") {
          const commPatch = placeUnpaidCommissionOnDisputeHold(comm, now);
          await commissionsCol.updateOne(
            { _id: comm._id },
            { $set: commPatch },
            session ? { session } : undefined
          );
        }

        return disputeRecord;
      });
    },
  });
}

export async function updateDisputeNotesByAdmin(
  ctx: AdminMutationContext,
  purchaseIdStr: string,
  options: {
    adminNotes?: string | null;
    evidenceDeadlineAt?: string | null;
  }
) {
  await assertLiveAdminActor(ctx.db, ctx.actor);
  const reason = assertValidReason(ctx.reason);
  const now = ctx.now || new Date();
  const purchaseId = new ObjectId(purchaseIdStr);

  const purchasesCol = await getPurchasesCollection(ctx.db);
  const purchase = await purchasesCol.findOne({ _id: purchaseId });
  if (!purchase || !purchase.disputeRecord) {
    throw new DataValidationError("Dispute record not found for this purchase.");
  }

  const disp = purchase.disputeRecord;
  if (disp.status !== "open" && disp.status !== "under_review") {
    throw new InvalidStateTransitionError(
      `Cannot update notes on a resolved dispute (${disp.status}).`
    );
  }

  const deadlineDate = options.evidenceDeadlineAt
    ? new Date(options.evidenceDeadlineAt)
    : disp.evidenceDeadlineAt;

  const updatedDisp: PurchaseDisputeRecord = {
    ...disp,
    status: "under_review",
    adminNotes: options.adminNotes?.trim() || disp.adminNotes,
    evidenceDeadlineAt:
      deadlineDate && !Number.isNaN(new Date(deadlineDate).getTime())
        ? new Date(deadlineDate)
        : disp.evidenceDeadlineAt,
    updatedByAdminId: ctx.actor.userId,
    updatedByAdminEmail: ctx.actor.email,
    updatedAt: now,
  };

  return executeAuditedAdminAction({
    db: ctx.db,
    actor: ctx.actor,
    action: "dispute.update_notes",
    targetCollection: COLLECTION_NAMES.purchases,
    targetId: purchaseId,
    reason,
    ipAddressHash: ctx.ipAddressHash,
    userAgent: ctx.userAgent,
    metadata: {
      disputeId: disp.disputeId,
      status: updatedDisp.status,
    },
    operation: async () => {
      const prevHistory = (purchase.disputeHistory || []).filter(
        (h) => h.disputeId !== disp.disputeId
      );
      await purchasesCol.updateOne(
        { _id: purchaseId },
        {
          $set: {
            disputeRecord: updatedDisp,
            disputeHistory: [...prevHistory, updatedDisp],
            updatedAt: now,
          },
        }
      );
      return updatedDisp;
    },
  });
}

export async function resolveDisputeOutcomeByAdmin(
  ctx: AdminMutationContext,
  purchaseIdStr: string,
  outcome: "won" | "withdrawn" | "lost"
) {
  await assertLiveAdminActor(ctx.db, ctx.actor);
  const reason = assertValidReason(ctx.reason);
  const now = ctx.now || new Date();
  const purchaseId = new ObjectId(purchaseIdStr);

  const purchasesCol = await getPurchasesCollection(ctx.db);
  const entitlementsCol = await getEntitlementsCollection(ctx.db);
  const commissionsCol = await getCommissionsCollection(ctx.db);
  const adjustmentsCol = await getCommissionAdjustmentsCollection(ctx.db);

  const purchase = await purchasesCol.findOne({ _id: purchaseId });
  if (!purchase) {
    throw new DataValidationError("Purchase not found.");
  }

  const nextPurchaseStatus =
    outcome === "lost" ? "chargeback_lost" : "captured";
  assertValidPurchaseTransition(purchase.status, nextPurchaseStatus);

  const currentDisp: PurchaseDisputeRecord = purchase.disputeRecord || {
    disputeId: `disp_${purchase._id.toString().slice(-8)}`,
    purchaseId: purchase._id,
    userId: purchase.userId,
    disputedAmountSubunits: purchase.pricingSnapshot.totalSubunits,
    currency: purchase.currency,
    status: "open",
    reasonCode: "chargeback_inquiry",
    openedAt: purchase.disputedAt || purchase.updatedAt,
    evidenceDeadlineAt: null,
    resolvedAt: null,
    outcomeReason: null,
    adminNotes: null,
    referrerNotifiedAt: null,
    updatedByAdminId: null,
    updatedByAdminEmail: null,
    updatedAt: purchase.updatedAt,
  };

  if (
    currentDisp.status === "won" ||
    currentDisp.status === "withdrawn" ||
    currentDisp.status === "lost"
  ) {
    throw new InvalidStateTransitionError(
      `Dispute is already resolved with outcome "${currentDisp.status}".`
    );
  }

  const resolvedDisp: PurchaseDisputeRecord = {
    ...currentDisp,
    status: outcome,
    resolvedAt: now,
    outcomeReason: reason,
    updatedByAdminId: ctx.actor.userId,
    updatedByAdminEmail: ctx.actor.email,
    updatedAt: now,
  };

  return executeAuditedAdminAction({
    db: ctx.db,
    actor: ctx.actor,
    action: `dispute.resolve_${outcome}`,
    targetCollection: COLLECTION_NAMES.purchases,
    targetId: purchaseId,
    reason,
    ipAddressHash: ctx.ipAddressHash,
    userAgent: ctx.userAgent,
    metadata: {
      disputeId: resolvedDisp.disputeId,
      outcome,
      previousPurchaseStatus: purchase.status,
      newPurchaseStatus: nextPurchaseStatus,
    },
    operation: async () => {
      return executeWithOptionalTransaction(ctx, async (session) => {
        const prevHistory = (purchase.disputeHistory || []).filter(
          (h) => h.disputeId !== resolvedDisp.disputeId
        );
        await purchasesCol.updateOne(
          { _id: purchaseId },
          {
            $set: {
              status: nextPurchaseStatus,
              disputeRecord: resolvedDisp,
              disputeHistory: [...prevHistory, resolvedDisp],
              updatedAt: now,
            },
          },
          session ? { session } : undefined
        );

        const ent = await entitlementsCol.findOne(
          { purchaseId },
          session ? { session } : undefined
        );
        const comm = await commissionsCol.findOne(
          { purchaseId },
          session ? { session } : undefined
        );

        if (outcome === "won" || outcome === "withdrawn") {
          // Restore entitlement ONLY if no other restriction remains
          if (ent && ent.status !== "revoked") {
            const entPatch = resolveEntitlementRestriction(
              ent,
              "chargeback_open",
              now
            );
            await entitlementsCol.updateOne(
              { _id: ent._id },
              { $set: entPatch },
              session ? { session } : undefined
            );
          }

          // Release commission hold ONLY if no pending refund request remains
          const hasPendingRefund =
            purchase.refundRequest?.status === "pending_review" ||
            purchase.refundRequest?.status === "approved_pending_gateway";

          if (comm && comm.isDisputedHold && !hasPendingRefund) {
            await commissionsCol.updateOne(
              { _id: comm._id },
              {
                $set: {
                  isDisputedHold: false,
                  updatedAt: now,
                },
              },
              session ? { session } : undefined
            );
          }
        } else if (outcome === "lost") {
          // Permanently revoke entitlement
          if (ent && ent.status !== "revoked") {
            const revokePatch = revokeEntitlementState(
              ent,
              "chargeback_lost",
              now
            );
            await entitlementsCol.updateOne(
              { _id: ent._id },
              { $set: revokePatch },
              session ? { session } : undefined
            );
          }

          // Commission treatment on lost dispute:
          // - If unpaid: transition to "cancelled" ("chargeback")
          // - If already "paid": preserve paid commission (terminal!) and create a separate CommissionAdjustmentDocument
          if (comm) {
            if (comm.status === "paid") {
              const existingAdj = await adjustmentsCol.findOne(
                { commissionId: comm._id },
                session ? { session } : undefined
              );
              if (!existingAdj) {
                const adjDoc = buildCommissionAdjustmentDocument(
                  {
                    commissionId: comm._id,
                    purchaseId: purchase._id,
                    payoutId: comm.payoutId || new ObjectId(),
                    referrerUserId: comm.referrerUserId,
                    currency: comm.currency,
                    adjustmentAmountSubunits: comm.commissionAmountSubunits,
                    reason: "post_payout_chargeback",
                    createdByAdminId: ctx.actor.userId,
                    notes: `Recorded following lost dispute (${resolvedDisp.disputeId}): ${reason}`,
                  },
                  now
                );
                await adjustmentsCol.insertOne(
                  adjDoc,
                  session ? { session } : undefined
                );
              }
            } else if (comm.status !== "cancelled") {
              assertValidCommissionTransition(comm.status, "cancelled");
              await commissionsCol.updateOne(
                { _id: comm._id },
                {
                  $set: {
                    status: "cancelled",
                    isDisputedHold: false,
                    cancelledAt: now,
                    cancellationReason: "chargeback",
                    updatedAt: now,
                  },
                },
                session ? { session } : undefined
              );
            }
          }
        }

        return resolvedDisp;
      });
    },
  });
}

// ---------------------------------------------------------------------------
// 5. Promotions Management Workflows (Section 10)
// ---------------------------------------------------------------------------

export async function createPromotionCampaignByAdmin(
  ctx: AdminMutationContext,
  input: {
    name: string;
    code: string;
    discountPercent: number;
    startsAt: Date | string;
    endsAt: Date | string;
    activateImmediately?: boolean;
  }
) {
  await assertLiveAdminActor(ctx.db, ctx.actor);
  const reason = assertValidReason(ctx.reason);
  const now = ctx.now || new Date();

  if (
    !(ALLOWED_PROMOTIONAL_DISCOUNT_PERCENTS as readonly number[]).includes(
      input.discountPercent
    )
  ) {
    throw new DataValidationError(
      "Promotional discount percentage must be one of the approved values: 5%, 10%, 15%, or 20%."
    );
  }

  const startsAt =
    input.startsAt instanceof Date ? input.startsAt : new Date(input.startsAt);
  const endsAt =
    input.endsAt instanceof Date ? input.endsAt : new Date(input.endsAt);

  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    throw new DataValidationError("Invalid promotion start or end timestamp.");
  }
  if (endsAt.getTime() <= startsAt.getTime()) {
    throw new DataValidationError(
      "Promotion end timestamp must be strictly after start timestamp."
    );
  }
  if (input.activateImmediately && endsAt.getTime() <= now.getTime()) {
    throw new InvalidStateTransitionError(
      "Cannot activate an already expired promotion."
    );
  }

  const normalizedCode = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,24}$/.test(normalizedCode)) {
    throw new DataValidationError(
      "Promotion code must be 3-24 uppercase alphanumeric characters."
    );
  }

  const promoCol = await getPromotionSettingsCollection(ctx.db);
  const existingSettings = await promoCol.findOne({
    _id: "global_referral_promo",
  });
  const currentCampaigns = existingSettings?.campaigns || [];

  if (
    currentCampaigns.some(
      (c) => c.code.toUpperCase() === normalizedCode
    )
  ) {
    throw new DataValidationError(
      `A promotion with code "${normalizedCode}" already exists.`
    );
  }

  const discountPct = input.discountPercent as PromotionalDiscountPercent;
  const shouldActivate = Boolean(input.activateImmediately);

  const newCampaign: PromotionCampaignRecord = {
    campaignId: `promo_${crypto.randomBytes(6).toString("hex")}`,
    name: input.name.trim(),
    code: normalizedCode,
    discountPercent: discountPct,
    status: shouldActivate
      ? "active"
      : endsAt.getTime() <= now.getTime()
        ? "expired"
        : "inactive",
    startsAt,
    endsAt,
    createdByAdminId: ctx.actor.userId,
    createdByAdminEmail: ctx.actor.email,
    updatedByAdminId: ctx.actor.userId,
    updatedByAdminEmail: ctx.actor.email,
    createdAt: now,
    updatedAt: now,
  };

  const updatedCampaigns = currentCampaigns.map((c) =>
    shouldActivate && c.status === "active"
      ? { ...c, status: "inactive" as const, updatedAt: now }
      : c
  );
  updatedCampaigns.unshift(newCampaign);

  const nextMode: PromotionMode = shouldActivate
    ? "promo"
    : existingSettings?.mode || "normal";
  const nextPromoPercent: 0 | PromotionalDiscountPercent = shouldActivate
    ? discountPct
    : existingSettings?.promotionalDiscountPercent || 0;

  return executeAuditedAdminAction({
    db: ctx.db,
    actor: ctx.actor,
    action: "promotion.create",
    targetCollection: COLLECTION_NAMES.promotionSettings,
    targetId: "global_referral_promo",
    reason,
    ipAddressHash: ctx.ipAddressHash,
    userAgent: ctx.userAgent,
    metadata: {
      campaignId: newCampaign.campaignId,
      code: newCampaign.code,
      discountPercent: newCampaign.discountPercent,
      status: newCampaign.status,
      mode: nextMode,
    },
    operation: async () => {
      await promoCol.updateOne(
        { _id: "global_referral_promo" },
        {
          $set: {
            mode: nextMode,
            promotionalDiscountPercent: nextPromoPercent,
            referralCustomerDiscountPercent: REFERRAL_CUSTOMER_DISCOUNT_PERCENT,
            referrerCommissionPercent: REFERRAL_COMMISSION_PERCENT,
            maxSuccessfulReferralsPerUser: MAX_SUCCESSFUL_REFERRALS_PER_USER,
            holdWindowHours: COMMISSION_HOLD_WINDOW_HOURS,
            minEligibleCommissionsForPayout:
              MIN_ELIGIBLE_COMMISSIONS_FOR_PAYOUT,
            activeCampaignId: shouldActivate
              ? newCampaign.campaignId
              : existingSettings?.activeCampaignId ?? null,
            campaigns: updatedCampaigns,
            updatedByAdminId: ctx.actor.userId,
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        { upsert: true }
      );
      return newCampaign;
    },
  });
}

export async function updatePromotionCampaignStatusByAdmin(
  ctx: AdminMutationContext,
  campaignId: string,
  targetAction: "activate" | "deactivate"
) {
  await assertLiveAdminActor(ctx.db, ctx.actor);
  const reason = assertValidReason(ctx.reason);
  const now = ctx.now || new Date();

  const promoCol = await getPromotionSettingsCollection(ctx.db);
  const settings = await promoCol.findOne({ _id: "global_referral_promo" });
  if (!settings || !settings.campaigns) {
    throw new DataValidationError("Promotion campaign not found.");
  }

  const target = settings.campaigns.find((c) => c.campaignId === campaignId);
  if (!target) {
    throw new DataValidationError("Promotion campaign not found.");
  }

  const endsAtDate =
    target.endsAt instanceof Date ? target.endsAt : new Date(target.endsAt);
  if (targetAction === "activate") {
    if (endsAtDate.getTime() <= now.getTime()) {
      throw new InvalidStateTransitionError(
        "Cannot activate an expired promotion campaign."
      );
    }
    if (target.status === "active") {
      throw new InvalidStateTransitionError(
        "Promotion campaign is already active."
      );
    }
  } else {
    if (target.status !== "active") {
      throw new InvalidStateTransitionError(
        "Promotion campaign is already inactive."
      );
    }
  }

  const updatedCampaigns = settings.campaigns.map((c) => {
    if (c.campaignId === campaignId) {
      return {
        ...c,
        status:
          targetAction === "activate"
            ? ("active" as const)
            : ("inactive" as const),
        updatedByAdminId: ctx.actor.userId,
        updatedByAdminEmail: ctx.actor.email,
        updatedAt: now,
      };
    }
    if (targetAction === "activate" && c.status === "active") {
      return {
        ...c,
        status: "inactive" as const,
        updatedByAdminId: ctx.actor.userId,
        updatedByAdminEmail: ctx.actor.email,
        updatedAt: now,
      };
    }
    return c;
  });

  const nextMode: PromotionMode =
    targetAction === "activate" ? "promo" : "normal";
  const nextDiscountPercent: 0 | PromotionalDiscountPercent =
    targetAction === "activate" ? target.discountPercent : 0;

  return executeAuditedAdminAction({
    db: ctx.db,
    actor: ctx.actor,
    action: `promotion.${targetAction}`,
    targetCollection: COLLECTION_NAMES.promotionSettings,
    targetId: "global_referral_promo",
    reason,
    ipAddressHash: ctx.ipAddressHash,
    userAgent: ctx.userAgent,
    metadata: {
      campaignId: target.campaignId,
      code: target.code,
      discountPercent: target.discountPercent,
      previousStatus: target.status,
      newStatus: targetAction === "activate" ? "active" : "inactive",
      globalMode: nextMode,
    },
    operation: async () => {
      await promoCol.updateOne(
        { _id: "global_referral_promo" },
        {
          $set: {
            mode: nextMode,
            promotionalDiscountPercent: nextDiscountPercent,
            activeCampaignId:
              targetAction === "activate" ? target.campaignId : null,
            campaigns: updatedCampaigns,
            updatedByAdminId: ctx.actor.userId,
            updatedAt: now,
          },
        }
      );
      return {
        campaignId: target.campaignId,
        mode: nextMode,
        promotionalDiscountPercent: nextDiscountPercent,
      };
    },
  });
}

export async function setGlobalPromotionModeByAdmin(
  ctx: AdminMutationContext,
  mode: PromotionMode,
  promotionalDiscountPercent: number
) {
  await assertLiveAdminActor(ctx.db, ctx.actor);
  const reason = assertValidReason(ctx.reason);
  const now = ctx.now || new Date();

  if (mode === "promo") {
    if (
      !(ALLOWED_PROMOTIONAL_DISCOUNT_PERCENTS as readonly number[]).includes(
        promotionalDiscountPercent
      )
    ) {
      throw new DataValidationError(
        "When mode is 'promo', promotionalDiscountPercent must be 5, 10, 15, or 20."
      );
    }
  } else if (promotionalDiscountPercent !== 0) {
    throw new DataValidationError(
      "When mode is 'normal', promotionalDiscountPercent must be 0."
    );
  }

  const resolvedPct = (
    mode === "promo" ? promotionalDiscountPercent : 0
  ) as 0 | PromotionalDiscountPercent;

  const promoCol = await getPromotionSettingsCollection(ctx.db);
  const existing = await promoCol.findOne({ _id: "global_referral_promo" });

  return executeAuditedAdminAction({
    db: ctx.db,
    actor: ctx.actor,
    action: "promotion.set_global_mode",
    targetCollection: COLLECTION_NAMES.promotionSettings,
    targetId: "global_referral_promo",
    reason,
    ipAddressHash: ctx.ipAddressHash,
    userAgent: ctx.userAgent,
    metadata: {
      previousMode: existing?.mode ?? "normal",
      newMode: mode,
      previousDiscountPercent: existing?.promotionalDiscountPercent ?? 0,
      newDiscountPercent: resolvedPct,
    },
    operation: async () => {
      await promoCol.updateOne(
        { _id: "global_referral_promo" },
        {
          $set: {
            mode,
            promotionalDiscountPercent: resolvedPct,
            referralCustomerDiscountPercent: REFERRAL_CUSTOMER_DISCOUNT_PERCENT,
            referrerCommissionPercent: REFERRAL_COMMISSION_PERCENT,
            maxSuccessfulReferralsPerUser: MAX_SUCCESSFUL_REFERRALS_PER_USER,
            holdWindowHours: COMMISSION_HOLD_WINDOW_HOURS,
            minEligibleCommissionsForPayout:
              MIN_ELIGIBLE_COMMISSIONS_FOR_PAYOUT,
            updatedByAdminId: ctx.actor.userId,
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        { upsert: true }
      );
      return { mode, promotionalDiscountPercent: resolvedPct };
    },
  });
}

// ---------------------------------------------------------------------------
// 6. Referral Management & Atomic 50-Redemption Cap Enforcement (Section 11)
// ---------------------------------------------------------------------------

/**
 * Atomically reserves 1 referral redemption slot on an active referral profile,
 * enforcing:
 * - `status === "active"`
 * - `riskReviewRequired !== true`
 * - `pendingReservedCount + successfulConversionsCount < maxReferralsCap (50)`
 */
export async function reserveReferralCapacityAtomically(
  db: Db,
  referralProfileId: ObjectId,
  now = new Date()
) {
  const referralProfilesCol = await getReferralProfilesCollection(db);
  const promoCol = await getPromotionSettingsCollection(db);
  const settings = await promoCol.findOne({ _id: "global_referral_promo" });
  const maxPendingThreshold =
    settings?.riskMonitoringConfig?.maxPendingReservationsBeforeReview ?? null;

  const updated = await referralProfilesCol.findOneAndUpdate(
    {
      _id: referralProfileId,
      status: "active",
      riskReviewRequired: { $ne: true },
      $expr: {
        $lt: [
          { $add: ["$pendingReservedCount", "$successfulConversionsCount"] },
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
    throw new InvalidStateTransitionError(
      "Referral profile is inactive, flagged for risk review, or has reached its lifetime 50-redemption capacity."
    );
  }

  // If operator configured a pending-reservation risk threshold and it is crossed, flag for review
  if (
    maxPendingThreshold !== null &&
    updated.pendingReservedCount >= maxPendingThreshold
  ) {
    await referralProfilesCol.updateOne(
      { _id: referralProfileId },
      {
        $set: {
          riskReviewRequired: true,
          riskHoldReason: `Crossed configured pending reservation threshold (${maxPendingThreshold})`,
          updatedAt: now,
        },
      }
    );
  }

  return updated;
}

/**
 * Releases a pending reservation when a checkout attempt fails or is abandoned.
 * Failed and abandoned purchases do not consume lifetime referral capacity.
 */
export async function releaseAbandonedReferralReservation(
  db: Db,
  referralProfileId: ObjectId,
  now = new Date()
) {
  const referralProfilesCol = await getReferralProfilesCollection(db);
  const updated = await referralProfilesCol.findOneAndUpdate(
    { _id: referralProfileId, pendingReservedCount: { $gt: 0 } },
    {
      $inc: { pendingReservedCount: -1 },
      $set: { updatedAt: now },
    },
    { returnDocument: "after" }
  );
  return updated;
}

/**
 * Converts a pending reservation into a permanent successful paid redemption.
 * Note: Refunded captured purchases NEVER decrement `successfulConversionsCount`
 * (a refunded purchase does not restore redemption capacity).
 */
export async function finalizeCapturedReferralRedemption(
  db: Db,
  referralProfileId: ObjectId,
  now = new Date()
) {
  const referralProfilesCol = await getReferralProfilesCollection(db);
  const updated = await referralProfilesCol.findOneAndUpdate(
    {
      _id: referralProfileId,
      pendingReservedCount: { $gt: 0 },
      successfulConversionsCount: { $lt: MAX_SUCCESSFUL_REFERRALS_PER_USER },
    },
    {
      $inc: {
        pendingReservedCount: -1,
        successfulConversionsCount: 1,
      },
      $set: { updatedAt: now },
    },
    { returnDocument: "after" }
  );

  if (!updated) {
    throw new InvalidStateTransitionError(
      "Unable to finalize referral conversion: no pending reservation or 50-redemption cap reached."
    );
  }

  if (updated.successfulConversionsCount >= MAX_SUCCESSFUL_REFERRALS_PER_USER) {
    await referralProfilesCol.updateOne(
      { _id: updated._id, status: { $ne: "exhausted" } },
      { $set: { status: "exhausted", exhaustedAt: now, updatedAt: now } }
    );
  }

  return updated;
}

export async function suspendReferralProfileByAdmin(
  ctx: AdminMutationContext,
  referralProfileIdStr: string
) {
  await assertLiveAdminActor(ctx.db, ctx.actor);
  const reason = assertValidReason(ctx.reason);
  const now = ctx.now || new Date();
  const referralProfileId = new ObjectId(referralProfileIdStr);

  const referralProfilesCol = await getReferralProfilesCollection(ctx.db);
  const payoutsCol = await getPayoutsCollection(ctx.db);

  const profile = await referralProfilesCol.findOne({ _id: referralProfileId });
  if (!profile) {
    throw new DataValidationError("Referral profile not found.");
  }
  if (profile.status === "suspended") {
    throw new InvalidStateTransitionError(
      "Referral profile is already suspended."
    );
  }

  const historyEntry = {
    action: "suspended" as const,
    reason,
    actorUserId: ctx.actor.userId,
    actorEmail: ctx.actor.email,
    createdAt: now,
  };

  return executeAuditedAdminAction({
    db: ctx.db,
    actor: ctx.actor,
    action: "referral.suspend",
    targetCollection: COLLECTION_NAMES.referralProfiles,
    targetId: referralProfileId,
    reason,
    ipAddressHash: ctx.ipAddressHash,
    userAgent: ctx.userAgent,
    metadata: {
      referralCode: profile.referralCode,
      previousStatus: profile.status,
      newStatus: "suspended",
    },
    operation: async () => {
      await referralProfilesCol.updateOne(
        { _id: referralProfileId },
        {
          $set: {
            status: "suspended",
            suspendedAt: now,
            suspensionReason: reason,
            suspendedByAdminId: ctx.actor.userId,
            suspensionHistory: [
              ...(profile.suspensionHistory || []),
              historyEntry,
            ],
            updatedAt: now,
          },
        }
      );

      // Hold pending draft payouts for this referrer while preserving earned commissions
      await payoutsCol.updateMany(
        {
          referralProfileId,
          status: "draft",
        },
        {
          $set: {
            notes: `Held due to referral profile suspension: ${reason}`,
            updatedAt: now,
          },
        }
      );

      return {
        referralProfileId: referralProfileId.toString(),
        status: "suspended" as const,
      };
    },
  });
}

export async function reinstateReferralProfileByAdmin(
  ctx: AdminMutationContext,
  referralProfileIdStr: string
) {
  await assertLiveAdminActor(ctx.db, ctx.actor);
  const reason = assertValidReason(ctx.reason);
  const now = ctx.now || new Date();
  const referralProfileId = new ObjectId(referralProfileIdStr);

  const referralProfilesCol = await getReferralProfilesCollection(ctx.db);
  const profile = await referralProfilesCol.findOne({ _id: referralProfileId });
  if (!profile) {
    throw new DataValidationError("Referral profile not found.");
  }
  if (profile.status !== "suspended") {
    throw new InvalidStateTransitionError(
      `Only suspended referral profiles can be reinstated (found "${profile.status}").`
    );
  }

  const historyEntry = {
    action: "reinstated" as const,
    reason,
    actorUserId: ctx.actor.userId,
    actorEmail: ctx.actor.email,
    createdAt: now,
  };

  return executeAuditedAdminAction({
    db: ctx.db,
    actor: ctx.actor,
    action: "referral.reinstate",
    targetCollection: COLLECTION_NAMES.referralProfiles,
    targetId: referralProfileId,
    reason,
    ipAddressHash: ctx.ipAddressHash,
    userAgent: ctx.userAgent,
    metadata: {
      referralCode: profile.referralCode,
      previousStatus: profile.status,
      newStatus: "active",
      note: "Reinstatement does not automatically release unrelated commission or payout restrictions.",
    },
    operation: async () => {
      // Reinstatement restores referral profile activity without releasing commission dispute holds or payout restrictions
      await referralProfilesCol.updateOne(
        { _id: referralProfileId },
        {
          $set: {
            status: "active",
            suspendedAt: null,
            suspensionReason: null,
            suspendedByAdminId: null,
            suspensionHistory: [
              ...(profile.suspensionHistory || []),
              historyEntry,
            ],
            updatedAt: now,
          },
        }
      );

      return {
        referralProfileId: referralProfileId.toString(),
        status: "active" as const,
      };
    },
  });
}

export async function overrideReferralRiskHoldByAdmin(
  ctx: AdminMutationContext,
  referralProfileIdStr: string
) {
  await assertLiveAdminActor(ctx.db, ctx.actor);
  const reason = assertValidReason(ctx.reason);
  const now = ctx.now || new Date();
  const referralProfileId = new ObjectId(referralProfileIdStr);

  const referralProfilesCol = await getReferralProfilesCollection(ctx.db);
  const profile = await referralProfilesCol.findOne({ _id: referralProfileId });
  if (!profile) {
    throw new DataValidationError("Referral profile not found.");
  }

  const historyEntry = {
    action: "risk_hold_overridden" as const,
    reason,
    actorUserId: ctx.actor.userId,
    actorEmail: ctx.actor.email,
    createdAt: now,
  };

  return executeAuditedAdminAction({
    db: ctx.db,
    actor: ctx.actor,
    action: "referral.override_risk_hold",
    targetCollection: COLLECTION_NAMES.referralProfiles,
    targetId: referralProfileId,
    reason,
    ipAddressHash: ctx.ipAddressHash,
    userAgent: ctx.userAgent,
    metadata: {
      referralCode: profile.referralCode,
      previousRiskHoldReason: profile.riskHoldReason ?? null,
    },
    operation: async () => {
      await referralProfilesCol.updateOne(
        { _id: referralProfileId },
        {
          $set: {
            riskReviewRequired: false,
            riskHoldReason: null,
            adminOverrideReason: reason,
            suspensionHistory: [
              ...(profile.suspensionHistory || []),
              historyEntry,
            ],
            updatedAt: now,
          },
        }
      );
      return {
        referralProfileId: referralProfileId.toString(),
        riskReviewRequired: false,
      };
    },
  });
}

// ---------------------------------------------------------------------------
// 7. Commission Management Workflows (Section 12)
// ---------------------------------------------------------------------------

export async function evaluateCommissionEligibilityByAdmin(
  ctx: AdminMutationContext,
  commissionIdStr: string
) {
  await assertLiveAdminActor(ctx.db, ctx.actor);
  const reason = assertValidReason(ctx.reason);
  const now = ctx.now || new Date();
  const commissionId = new ObjectId(commissionIdStr);

  const commissionsCol = await getCommissionsCollection(ctx.db);
  const purchasesCol = await getPurchasesCollection(ctx.db);

  const comm = await commissionsCol.findOne({ _id: commissionId });
  if (!comm) {
    throw new DataValidationError("Commission not found.");
  }

  const purchase = await purchasesCol.findOne({ _id: comm.purchaseId });
  if (!purchase) {
    throw new DataValidationError("Underlying purchase not found.");
  }

  const hasOpenDispute =
    purchase.status === "disputed" ||
    purchase.disputeRecord?.status === "open" ||
    purchase.disputeRecord?.status === "under_review";

  const hasPendingRefund =
    purchase.refundRequest?.status === "pending_review" ||
    purchase.refundRequest?.status === "approved_pending_gateway";

  return executeAuditedAdminAction({
    db: ctx.db,
    actor: ctx.actor,
    action: "commission.evaluate_eligibility",
    targetCollection: COLLECTION_NAMES.commissions,
    targetId: commissionId,
    reason,
    ipAddressHash: ctx.ipAddressHash,
    userAgent: ctx.userAgent,
    metadata: {
      purchaseId: comm.purchaseId.toString(),
      holdUntil: comm.holdUntil.toISOString(),
      evaluatedAt: now.toISOString(),
    },
    operation: async () => {
      // Enforces exact 72h holdUntil, captured purchase, and no dispute/refund holds
      assertCommissionCanBecomeEligible(comm, {
        now,
        purchaseStatus: purchase.status,
        hasOpenDispute,
        hasPendingRefund,
      });

      await commissionsCol.updateOne(
        { _id: commissionId },
        {
          $set: {
            status: "eligible",
            eligibleAt: now,
            updatedAt: now,
          },
        }
      );

      return {
        commissionId: commissionId.toString(),
        status: "eligible" as const,
        eligibleAt: now.toISOString(),
      };
    },
  });
}

export async function approveCommissionByAdmin(
  ctx: AdminMutationContext,
  commissionIdStr: string
) {
  await assertLiveAdminActor(ctx.db, ctx.actor);
  const reason = assertValidReason(ctx.reason);
  const now = ctx.now || new Date();
  const commissionId = new ObjectId(commissionIdStr);

  const commissionsCol = await getCommissionsCollection(ctx.db);
  const comm = await commissionsCol.findOne({ _id: commissionId });
  if (!comm) {
    throw new DataValidationError("Commission not found.");
  }

  return executeAuditedAdminAction({
    db: ctx.db,
    actor: ctx.actor,
    action: "commission.approve",
    targetCollection: COLLECTION_NAMES.commissions,
    targetId: commissionId,
    reason,
    ipAddressHash: ctx.ipAddressHash,
    userAgent: ctx.userAgent,
    metadata: {
      previousStatus: comm.status,
      newStatus: "approved",
      currency: comm.currency,
      commissionAmountSubunits: comm.commissionAmountSubunits,
    },
    operation: async () => {
      assertValidCommissionTransition(comm.status, "approved", {
        isDisputedHold: comm.isDisputedHold,
        now,
        purchaseCapturedAt: comm.purchaseCapturedAt,
        holdUntil: comm.holdUntil,
      });

      await commissionsCol.updateOne(
        { _id: commissionId },
        {
          $set: {
            status: "approved",
            approvedAt: now,
            approvedByAdminId: ctx.actor.userId,
            updatedAt: now,
          },
        }
      );

      return {
        commissionId: commissionId.toString(),
        status: "approved" as const,
      };
    },
  });
}

export async function createCommissionAdjustmentByAdmin(
  ctx: AdminMutationContext,
  commissionIdStr: string,
  adjustmentReason: CommissionAdjustmentReason = "manual_reconciliation"
) {
  await assertLiveAdminActor(ctx.db, ctx.actor);
  const reason = assertValidReason(ctx.reason);
  const now = ctx.now || new Date();
  const commissionId = new ObjectId(commissionIdStr);

  const commissionsCol = await getCommissionsCollection(ctx.db);
  const adjustmentsCol = await getCommissionAdjustmentsCollection(ctx.db);

  const comm = await commissionsCol.findOne({ _id: commissionId });
  if (!comm) {
    throw new DataValidationError("Commission not found.");
  }
  if (comm.status !== "paid") {
    throw new InvalidStateTransitionError(
      'Post-payout commission adjustments can only be recorded for terminal "paid" commissions.'
    );
  }

  const existingAdj = await adjustmentsCol.findOne({ commissionId });
  if (existingAdj) {
    throw new InvalidStateTransitionError(
      "An adjustment record already exists for this paid commission."
    );
  }

  const adjDoc = buildCommissionAdjustmentDocument(
    {
      commissionId: comm._id,
      purchaseId: comm.purchaseId,
      payoutId: comm.payoutId || new ObjectId(),
      referrerUserId: comm.referrerUserId,
      currency: comm.currency,
      adjustmentAmountSubunits: comm.commissionAmountSubunits,
      reason: adjustmentReason,
      createdByAdminId: ctx.actor.userId,
      notes: reason,
    },
    now
  );

  return executeAuditedAdminAction({
    db: ctx.db,
    actor: ctx.actor,
    action: "commission.create_adjustment",
    targetCollection: COLLECTION_NAMES.commissionAdjustments,
    targetId: adjDoc._id,
    reason,
    ipAddressHash: ctx.ipAddressHash,
    userAgent: ctx.userAgent,
    metadata: {
      commissionId: comm._id.toString(),
      currency: comm.currency,
      adjustmentAmountSubunits: adjDoc.adjustmentAmountSubunits,
      adjustmentReason,
      paidCommissionPreserved: true,
    },
    operation: async () => {
      await adjustmentsCol.insertOne(adjDoc);
      return adjDoc;
    },
  });
}

export async function resolveCommissionAdjustmentByAdmin(
  ctx: AdminMutationContext,
  adjustmentIdStr: string,
  resolutionStatus: Exclude<CommissionAdjustmentResolutionStatus, "open">
) {
  await assertLiveAdminActor(ctx.db, ctx.actor);
  const reason = assertValidReason(ctx.reason);
  const now = ctx.now || new Date();
  const adjustmentId = new ObjectId(adjustmentIdStr);

  const adjustmentsCol = await getCommissionAdjustmentsCollection(ctx.db);
  const adj = await adjustmentsCol.findOne({ _id: adjustmentId });
  if (!adj) {
    throw new DataValidationError("Commission adjustment not found.");
  }
  if (adj.resolutionStatus !== "open") {
    throw new InvalidStateTransitionError(
      `Adjustment is already resolved with status "${adj.resolutionStatus}".`
    );
  }

  return executeAuditedAdminAction({
    db: ctx.db,
    actor: ctx.actor,
    action: "commission.resolve_adjustment",
    targetCollection: COLLECTION_NAMES.commissionAdjustments,
    targetId: adjustmentId,
    reason,
    ipAddressHash: ctx.ipAddressHash,
    userAgent: ctx.userAgent,
    metadata: {
      commissionId: adj.commissionId.toString(),
      previousResolutionStatus: adj.resolutionStatus,
      newResolutionStatus: resolutionStatus,
    },
    operation: async () => {
      await adjustmentsCol.updateOne(
        { _id: adjustmentId },
        {
          $set: {
            resolutionStatus,
            resolvedByAdminId: ctx.actor.userId,
            notes: `${adj.notes ? adj.notes + " | " : ""}Resolved (${resolutionStatus}): ${reason}`,
            updatedAt: now,
          },
        }
      );
      return {
        adjustmentId: adjustmentId.toString(),
        resolutionStatus,
      };
    },
  });
}

// ---------------------------------------------------------------------------
// 8. Payout Management Workflows (Section 13)
// ---------------------------------------------------------------------------

export async function createPayoutBatchByAdmin(
  ctx: AdminMutationContext,
  input: {
    referrerUserIdStr: string;
    currency: SupportedCurrency;
    payoutMethod?: Exclude<ReferralPayoutMethod, "unset">;
    commissionIdsStr?: string[];
  }
) {
  await assertLiveAdminActor(ctx.db, ctx.actor);
  const reason = assertValidReason(ctx.reason);
  const now = ctx.now || new Date();
  const referrerUserId = new ObjectId(input.referrerUserIdStr);

  const referralProfilesCol = await getReferralProfilesCollection(ctx.db);
  const commissionsCol = await getCommissionsCollection(ctx.db);
  const payoutsCol = await getPayoutsCollection(ctx.db);

  const profile = await referralProfilesCol.findOne({ userId: referrerUserId });
  if (!profile) {
    throw new DataValidationError("Referral profile not found for referrer.");
  }
  if (profile.status !== "active") {
    throw new InvalidStateTransitionError(
      `Cannot create a payout batch while referral profile status is "${profile.status}".`
    );
  }

  // Fetch all unpaid eligible/approved commissions for this referrer across ALL currencies
  const allReferrerUnpaidCommissions = await commissionsCol
    .find({
      referrerUserId,
      status: { $in: ["eligible", "approved"] },
      isDisputedHold: false,
      payoutId: null,
    })
    .toArray();

  // Select target batch commissions in the requested single currency
  const requestedIdsSet =
    input.commissionIdsStr && input.commissionIdsStr.length > 0
      ? new Set(input.commissionIdsStr)
      : null;

  const batchCommissions = allReferrerUnpaidCommissions.filter((c) => {
    if (requestedIdsSet) {
      return requestedIdsSet.has(c._id.toString());
    }
    return c.currency === input.currency && c.status === "approved";
  });

  if (batchCommissions.length === 0) {
    throw new DataValidationError(
      `No unbatched "approved" commissions found for ${input.currency}. Approve eligible commissions first.`
    );
  }

  // Ensure none of the selected commissions are already assigned to a payout batch
  for (const c of batchCommissions) {
    if (c.payoutId !== null) {
      throw new InvalidStateTransitionError(
        `Commission ${c._id.toString()} is already assigned to payout ${c.payoutId.toString()}.`
      );
    }
  }

  const totalAmountSubunits = batchCommissions.reduce(
    (sum, c) => sum + c.commissionAmountSubunits,
    0
  );

  const resolvedPayoutMethod: Exclude<ReferralPayoutMethod, "unset"> =
    input.payoutMethod ||
    (profile.payoutMethod !== "unset"
      ? profile.payoutMethod
      : input.currency === "INR"
        ? "upi"
        : "international_wire");

  const payoutInput = {
    referrerUserId,
    referralProfileId: profile._id,
    currency: input.currency,
    totalAmountSubunits,
    commissionIds: batchCommissions.map((c) => c._id),
    payoutMethod: resolvedPayoutMethod,
    createdByAdminId: ctx.actor.userId,
    notes: reason,
  };

  // Enforces 5-commission cross-currency threshold, single-currency batch, no disputed holds, and sum consistency
  assertPayoutBatchConsistency(
    payoutInput,
    batchCommissions,
    allReferrerUnpaidCommissions
  );

  // Determine whether this is the referrer's first payout (admin-initiated) or a subsequent payout
  const priorPaidPayoutCount = await payoutsCol.countDocuments({
    referrerUserId,
    status: "paid",
  });
  const initiationType: "admin_first_payout" | "referrer_requested" =
    priorPaidPayoutCount === 0 ? "admin_first_payout" : "referrer_requested";

  const payoutDoc: PayoutDocument = {
    ...buildPayoutDocument(payoutInput, now),
    initiationType,
    requestedAt: now,
  };

  return executeAuditedAdminAction({
    db: ctx.db,
    actor: ctx.actor,
    action: "payout.create_batch",
    targetCollection: COLLECTION_NAMES.payouts,
    targetId: payoutDoc._id,
    reason,
    ipAddressHash: ctx.ipAddressHash,
    userAgent: ctx.userAgent,
    metadata: {
      referrerUserId: referrerUserId.toString(),
      currency: payoutDoc.currency,
      totalAmountSubunits: payoutDoc.totalAmountSubunits,
      commissionCount: payoutDoc.commissionIds.length,
      initiationType,
    },
    operation: async () => {
      return executeWithOptionalTransaction(ctx, async (session) => {
        // Reserve commissions atomically so they can never be included in another payout batch
        const updateRes = await commissionsCol.updateMany(
          {
            _id: { $in: payoutDoc.commissionIds },
            payoutId: null,
            status: "approved",
            isDisputedHold: false,
          },
          {
            $set: {
              payoutId: payoutDoc._id,
              updatedAt: now,
            },
          },
          session ? { session } : undefined
        );

        if (updateRes.modifiedCount !== payoutDoc.commissionIds.length) {
          throw new InvalidStateTransitionError(
            "Concurrent payout reservation conflict: one or more commissions were already reserved or modified."
          );
        }

        await payoutsCol.insertOne(
          payoutDoc,
          session ? { session } : undefined
        );
        return payoutDoc;
      });
    },
  });
}

export async function transitionPayoutStatusByAdmin(
  ctx: AdminMutationContext,
  payoutIdStr: string,
  targetAction:
    | "approve"
    | "reject"
    | "mark_processing"
    | "mark_failed"
    | "mark_paid",
  options?: {
    externalTransferReference?: string | null;
    verifiedProviderEvidence?: boolean;
  }
) {
  await assertLiveAdminActor(ctx.db, ctx.actor);
  const reason = assertValidReason(ctx.reason);
  const now = ctx.now || new Date();
  const payoutId = new ObjectId(payoutIdStr);

  const payoutsCol = await getPayoutsCollection(ctx.db);
  const commissionsCol = await getCommissionsCollection(ctx.db);

  const payout = await payoutsCol.findOne({ _id: payoutId });
  if (!payout) {
    throw new DataValidationError("Payout batch not found.");
  }

  return executeAuditedAdminAction({
    db: ctx.db,
    actor: ctx.actor,
    action: `payout.${targetAction}`,
    targetCollection: COLLECTION_NAMES.payouts,
    targetId: payoutId,
    reason,
    ipAddressHash: ctx.ipAddressHash,
    userAgent: ctx.userAgent,
    metadata: {
      previousStatus: payout.status,
      targetAction,
      currency: payout.currency,
      totalAmountSubunits: payout.totalAmountSubunits,
    },
    operation: async () => {
      if (targetAction === "approve") {
        if (payout.status !== "draft") {
          throw new InvalidStateTransitionError(
            `Only "draft" (Pending Review) payouts can be approved (found "${payout.status}").`
          );
        }
        await payoutsCol.updateOne(
          { _id: payoutId },
          {
            $set: {
              status: "approved",
              approvedByAdminId: ctx.actor.userId,
              notes: reason,
              updatedAt: now,
            },
          }
        );
        return { payoutId: payoutId.toString(), status: "approved" as const };
      }

      if (targetAction === "reject") {
        if (payout.status !== "draft" && payout.status !== "approved") {
          throw new InvalidStateTransitionError(
            `Cannot reject a payout in status "${payout.status}".`
          );
        }
        return executeWithOptionalTransaction(ctx, async (session) => {
          await payoutsCol.updateOne(
            { _id: payoutId },
            {
              $set: {
                status: "cancelled",
                rejectedAt: now,
                rejectionReason: reason,
                updatedAt: now,
              },
            },
            session ? { session } : undefined
          );
          // Release reserved commissions so they remain "approved" and unbatched
          await commissionsCol.updateMany(
            { _id: { $in: payout.commissionIds }, payoutId: payout._id },
            {
              $set: {
                payoutId: null,
                updatedAt: now,
              },
            },
            session ? { session } : undefined
          );
          return {
            payoutId: payoutId.toString(),
            status: "cancelled" as const,
          };
        });
      }

      if (targetAction === "mark_processing") {
        if (payout.status !== "approved") {
          throw new InvalidStateTransitionError(
            `Only "approved" payouts can transition to "processing" (found "${payout.status}").`
          );
        }
        await payoutsCol.updateOne(
          { _id: payoutId },
          {
            $set: {
              status: "processing",
              notes: reason,
              updatedAt: now,
            },
          }
        );
        return { payoutId: payoutId.toString(), status: "processing" as const };
      }

      if (targetAction === "mark_failed") {
        if (payout.status !== "processing" && payout.status !== "approved") {
          throw new InvalidStateTransitionError(
            `Only "approved" or "processing" payouts can be marked "failed" (found "${payout.status}").`
          );
        }
        return executeWithOptionalTransaction(ctx, async (session) => {
          await payoutsCol.updateOne(
            { _id: payoutId },
            {
              $set: {
                status: "failed",
                failureReason: reason,
                updatedAt: now,
              },
            },
            session ? { session } : undefined
          );
          // Release commissions from failed batch so they can be re-batched once payout method is fixed
          await commissionsCol.updateMany(
            { _id: { $in: payout.commissionIds }, payoutId: payout._id },
            {
              $set: {
                payoutId: null,
                updatedAt: now,
              },
            },
            session ? { session } : undefined
          );
          return { payoutId: payoutId.toString(), status: "failed" as const };
        });
      }

      if (targetAction === "mark_paid") {
        if (
          !options?.verifiedProviderEvidence ||
          !options?.externalTransferReference?.trim()
        ) {
          throw new InvalidStateTransitionError(
            "Cannot mark payout as paid without verified payment-provider transfer evidence. Live payout provider execution is deferred to Stage 3C."
          );
        }
        if (payout.status !== "processing" && payout.status !== "approved") {
          throw new InvalidStateTransitionError(
            `Only "approved" or "processing" payouts can be marked "paid" (found "${payout.status}").`
          );
        }
        const transferRef = options.externalTransferReference.trim();

        return executeWithOptionalTransaction(ctx, async (session) => {
          await payoutsCol.updateOne(
            { _id: payoutId },
            {
              $set: {
                status: "paid",
                externalTransferReference: transferRef,
                paidAt: now,
                updatedAt: now,
              },
            },
            session ? { session } : undefined
          );
          await commissionsCol.updateMany(
            {
              _id: { $in: payout.commissionIds },
              payoutId: payout._id,
              status: "approved",
            },
            {
              $set: {
                status: "paid",
                paidAt: now,
                updatedAt: now,
              },
            },
            session ? { session } : undefined
          );
          return {
            payoutId: payoutId.toString(),
            status: "paid" as const,
            externalTransferReference: transferRef,
          };
        });
      }

      throw new DataValidationError(`Unsupported payout action: ${targetAction}`);
    },
  });
}

// ---------------------------------------------------------------------------
// 9. Operational Settings Update Workflow (Section 15)
// ---------------------------------------------------------------------------

export async function updateOperationalSettingsByAdmin(
  ctx: AdminMutationContext,
  input: {
    maxPendingReservationsBeforeReview: number | null;
    maxDailyRedemptionsBeforeReview: number | null;
    requireManualReviewOnVelocityAlert: boolean;
    productAvailability?: Record<
      string,
      "available" | "coming_soon" | "maintenance"
    >;
  }
) {
  await assertLiveAdminActor(ctx.db, ctx.actor);
  const reason = assertValidReason(ctx.reason);
  const now = ctx.now || new Date();

  const promoCol = await getPromotionSettingsCollection(ctx.db);
  const existing = await promoCol.findOne({ _id: "global_referral_promo" });

  return executeAuditedAdminAction({
    db: ctx.db,
    actor: ctx.actor,
    action: "settings.update_operational",
    targetCollection: COLLECTION_NAMES.promotionSettings,
    targetId: "global_referral_promo",
    reason,
    ipAddressHash: ctx.ipAddressHash,
    userAgent: ctx.userAgent,
    metadata: {
      previousRiskConfig: existing?.riskMonitoringConfig ?? null,
      newRiskConfig: {
        maxPendingReservationsBeforeReview:
          input.maxPendingReservationsBeforeReview,
        maxDailyRedemptionsBeforeReview: input.maxDailyRedemptionsBeforeReview,
        requireManualReviewOnVelocityAlert:
          input.requireManualReviewOnVelocityAlert,
      },
      productAvailability: input.productAvailability ?? null,
    },
    operation: async () => {
      await promoCol.updateOne(
        { _id: "global_referral_promo" },
        {
          $set: {
            mode: existing?.mode ?? "normal",
            promotionalDiscountPercent:
              existing?.promotionalDiscountPercent ?? 0,
            referralCustomerDiscountPercent: REFERRAL_CUSTOMER_DISCOUNT_PERCENT,
            referrerCommissionPercent: REFERRAL_COMMISSION_PERCENT,
            maxSuccessfulReferralsPerUser: MAX_SUCCESSFUL_REFERRALS_PER_USER,
            holdWindowHours: COMMISSION_HOLD_WINDOW_HOURS,
            minEligibleCommissionsForPayout:
              MIN_ELIGIBLE_COMMISSIONS_FOR_PAYOUT,
            riskMonitoringConfig: {
              maxPendingReservationsBeforeReview:
                input.maxPendingReservationsBeforeReview,
              maxDailyRedemptionsBeforeReview:
                input.maxDailyRedemptionsBeforeReview,
              requireManualReviewOnVelocityAlert:
                input.requireManualReviewOnVelocityAlert,
            },
            ...(input.productAvailability
              ? { productAvailability: input.productAvailability }
              : {}),
            updatedByAdminId: ctx.actor.userId,
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        { upsert: true }
      );

      return {
        updated: true,
        riskMonitoringConfig: {
          maxPendingReservationsBeforeReview:
            input.maxPendingReservationsBeforeReview,
          maxDailyRedemptionsBeforeReview:
            input.maxDailyRedemptionsBeforeReview,
          requireManualReviewOnVelocityAlert:
            input.requireManualReviewOnVelocityAlert,
        },
      };
    },
  });
}

export async function updateAffordabilityTargetByAdmin(
  ctx: AdminMutationContext,
  targetInr: number
) {
  await assertLiveAdminActor(ctx.db, ctx.actor);
  const reason = assertValidReason(ctx.reason);
  const now = ctx.now || new Date();

  const promoCol = await getPromotionSettingsCollection(ctx.db);
  const existing = await promoCol.findOne({ _id: "global_referral_promo" });

  return executeAuditedAdminAction({
    db: ctx.db,
    actor: ctx.actor,
    action: "settings.update_affordability_target",
    targetCollection: COLLECTION_NAMES.promotionSettings,
    targetId: "global_referral_promo",
    reason,
    ipAddressHash: ctx.ipAddressHash,
    userAgent: ctx.userAgent,
    metadata: {
      previousTargetInr: existing?.affordabilityTargetInr ?? 2000,
      newTargetInr: targetInr,
    },
    operation: async () => {
      await promoCol.updateOne(
        { _id: "global_referral_promo" },
        {
          $set: {
            affordabilityTargetInr: targetInr,
            updatedByAdminId: ctx.actor.userId,
            updatedAt: now,
          },
          $setOnInsert: {
            mode: "normal",
            promotionalDiscountPercent: 0,
            referralCustomerDiscountPercent: REFERRAL_CUSTOMER_DISCOUNT_PERCENT,
            referrerCommissionPercent: REFERRAL_COMMISSION_PERCENT,
            maxSuccessfulReferralsPerUser: MAX_SUCCESSFUL_REFERRALS_PER_USER,
            holdWindowHours: COMMISSION_HOLD_WINDOW_HOURS,
            minEligibleCommissionsForPayout: MIN_ELIGIBLE_COMMISSIONS_FOR_PAYOUT,
            createdAt: now,
          },
        },
        { upsert: true }
      );
      return { updated: true, affordabilityTargetInr: targetInr };
    },
  });
}

export async function addAffordabilityRuleByAdmin(
  ctx: AdminMutationContext,
  input: Omit<AffordabilityCountryRule, "updatedByAdminEmail" | "updatedAt">
) {
  await assertLiveAdminActor(ctx.db, ctx.actor);
  const reason = assertValidReason(ctx.reason);
  const now = ctx.now || new Date();
  const upperCode = input.countryCode.trim().toUpperCase();

  if (isProtectedPricingCountry(upperCode)) {
    throw new DataValidationError(
      `Country "${upperCode}" belongs to a protected standard pricing market (India, US, or Eurozone) and cannot be added as an affordability rule.`
    );
  }

  const promoCol = await getPromotionSettingsCollection(ctx.db);
  const existing = await promoCol.findOne({ _id: "global_referral_promo" });
  const rules = existing?.affordabilityRules || [];

  if (rules.some((r) => r.countryCode.toUpperCase() === upperCode)) {
    throw new DataValidationError(
      `An affordability pricing rule for country code "${upperCode}" already exists. Edit the existing rule instead.`
    );
  }

  const newRule: AffordabilityCountryRule = {
    ...input,
    countryCode: upperCode,
    currency: input.currency.trim().toUpperCase(),
    updatedByAdminEmail: ctx.actor.email,
    updatedAt: now,
  };

  const updatedRules = [...rules, newRule];

  return executeAuditedAdminAction({
    db: ctx.db,
    actor: ctx.actor,
    action: "settings.add_affordability_rule",
    targetCollection: COLLECTION_NAMES.promotionSettings,
    targetId: `affordability_rule_${upperCode}`,
    reason,
    ipAddressHash: ctx.ipAddressHash,
    userAgent: ctx.userAgent,
    metadata: {
      addedRule: newRule,
    },
    operation: async () => {
      await promoCol.updateOne(
        { _id: "global_referral_promo" },
        {
          $set: {
            affordabilityRules: updatedRules,
            updatedByAdminId: ctx.actor.userId,
            updatedAt: now,
          },
          $setOnInsert: {
            mode: "normal",
            promotionalDiscountPercent: 0,
            referralCustomerDiscountPercent: REFERRAL_CUSTOMER_DISCOUNT_PERCENT,
            referrerCommissionPercent: REFERRAL_COMMISSION_PERCENT,
            maxSuccessfulReferralsPerUser: MAX_SUCCESSFUL_REFERRALS_PER_USER,
            holdWindowHours: COMMISSION_HOLD_WINDOW_HOURS,
            minEligibleCommissionsForPayout: MIN_ELIGIBLE_COMMISSIONS_FOR_PAYOUT,
            createdAt: now,
          },
        },
        { upsert: true }
      );
      return { added: true, rule: newRule };
    },
  });
}

export async function updateAffordabilityRuleByAdmin(
  ctx: AdminMutationContext,
  countryCodeOrInput:
    | string
    | (Partial<AffordabilityCountryRule> & { countryCode: string }),
  maybeInput?: Partial<AffordabilityCountryRule>
) {
  await assertLiveAdminActor(ctx.db, ctx.actor);
  const reason = assertValidReason(ctx.reason);
  const now = ctx.now || new Date();
  const rawCountryCode =
    typeof countryCodeOrInput === "string"
      ? countryCodeOrInput
      : countryCodeOrInput.countryCode;
  const upperCode = (rawCountryCode || "").trim().toUpperCase();
  if (isProtectedPricingCountry(upperCode)) {
    throw new DataValidationError(
      `Country "${upperCode}" belongs to a protected standard pricing market (India, US, or Eurozone) and cannot be configured as an affordability country.`
    );
  }
  const input =
    typeof countryCodeOrInput === "string"
      ? maybeInput || {}
      : countryCodeOrInput;

  const promoCol = await getPromotionSettingsCollection(ctx.db);
  const existing = await promoCol.findOne({ _id: "global_referral_promo" });
  const rules = existing?.affordabilityRules || [];

  const ruleIndex = rules.findIndex((r) => r.countryCode.toUpperCase() === upperCode);
  if (ruleIndex === -1) {
    throw new DataValidationError(
      `Affordability pricing rule for country code "${upperCode}" not found.`
    );
  }

  const prevRule = rules[ruleIndex];
  const updatedRule: AffordabilityCountryRule = {
    ...prevRule,
    ...input,
    countryCode: upperCode,
    currency: (input.currency || prevRule.currency).trim().toUpperCase(),
    updatedByAdminEmail: ctx.actor.email,
    updatedAt: now,
  };

  const updatedRules = [...rules];
  updatedRules[ruleIndex] = updatedRule;

  return executeAuditedAdminAction({
    db: ctx.db,
    actor: ctx.actor,
    action: "settings.update_affordability_rule",
    targetCollection: COLLECTION_NAMES.promotionSettings,
    targetId: `affordability_rule_${upperCode}`,
    reason,
    ipAddressHash: ctx.ipAddressHash,
    userAgent: ctx.userAgent,
    metadata: {
      countryCode: upperCode,
      previousRule: prevRule,
      updatedRule,
    },
    operation: async () => {
      await promoCol.updateOne(
        { _id: "global_referral_promo" },
        {
          $set: {
            affordabilityRules: updatedRules,
            updatedByAdminId: ctx.actor.userId,
            updatedAt: now,
          },
        }
      );
      return { updated: true, rule: updatedRule };
    },
  });
}

export async function toggleAffordabilityRuleByAdmin(
  ctx: AdminMutationContext,
  countryCode: string,
  isActive: boolean
) {
  await assertLiveAdminActor(ctx.db, ctx.actor);
  const reason = assertValidReason(ctx.reason);
  const now = ctx.now || new Date();
  const upperCode = countryCode.trim().toUpperCase();
  if (isProtectedPricingCountry(upperCode)) {
    throw new DataValidationError(
      `Country "${upperCode}" belongs to a protected standard pricing market (India, US, or Eurozone) and cannot be toggled as an affordability country.`
    );
  }

  const promoCol = await getPromotionSettingsCollection(ctx.db);
  const existing = await promoCol.findOne({ _id: "global_referral_promo" });
  const rules = existing?.affordabilityRules || [];

  const ruleIndex = rules.findIndex((r) => r.countryCode.toUpperCase() === upperCode);
  if (ruleIndex === -1) {
    throw new DataValidationError(
      `Affordability pricing rule for country code "${upperCode}" not found.`
    );
  }

  const prevRule = rules[ruleIndex];
  const updatedRule: AffordabilityCountryRule = {
    ...prevRule,
    isActive,
    updatedByAdminEmail: ctx.actor.email,
    updatedAt: now,
  };

  const updatedRules = [...rules];
  updatedRules[ruleIndex] = updatedRule;

  return executeAuditedAdminAction({
    db: ctx.db,
    actor: ctx.actor,
    action: "settings.toggle_affordability_rule",
    targetCollection: COLLECTION_NAMES.promotionSettings,
    targetId: `affordability_rule_${upperCode}`,
    reason,
    ipAddressHash: ctx.ipAddressHash,
    userAgent: ctx.userAgent,
    metadata: {
      countryCode: upperCode,
      previousActive: prevRule.isActive,
      newActive: isActive,
    },
    operation: async () => {
      await promoCol.updateOne(
        { _id: "global_referral_promo" },
        {
          $set: {
            affordabilityRules: updatedRules,
            updatedByAdminId: ctx.actor.userId,
            updatedAt: now,
          },
        }
      );
      return { toggled: true, countryCode: upperCode, isActive };
    },
  });
}
