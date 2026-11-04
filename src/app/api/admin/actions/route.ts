import { NextRequest, NextResponse } from "next/server";
import { Db, MongoClient } from "mongodb";
import { getDb, getMongoClient } from "@/lib/db/mongodb";
import {
  DataValidationError,
  ImmutableRecordError,
  InvalidStateTransitionError,
} from "@/lib/db/repositories";
import {
  detectClientRoleEscalationAttempt,
  requireAdminRequest,
} from "@/lib/auth/admin";
import {
  buildIpRateLimitKey,
  enforceIpRateLimit,
} from "@/lib/auth/rateLimit";
import { enforceCsrfProtection } from "@/lib/security/csrf";
import {
  commissionMutationSchema,
  disputeMutationSchema,
  entitlementMutationSchema,
  operationalSettingsMutationSchema,
  payoutMutationSchema,
  promotionCreateMutationSchema,
  promotionGlobalModeMutationSchema,
  promotionStatusMutationSchema,
  referralMutationSchema,
  refundMutationSchema,
  userStatusMutationSchema,
  updateAffordabilityTargetSchema,
  addAffordabilityRuleSchema,
  updateAffordabilityRuleSchema,
  toggleAffordabilityRuleSchema,
} from "@/lib/admin/schemas";
import {
  approveCommissionByAdmin,
  approveRefundRequestByAdmin,
  createCommissionAdjustmentByAdmin,
  createInternalRefundRequest,
  createPayoutBatchByAdmin,
  createPromotionCampaignByAdmin,
  evaluateCommissionEligibilityByAdmin,
  initiateGatewayRefundByAdmin,
  openInternalDisputeRecord,
  overrideReferralRiskHoldByAdmin,
  processDeviceReplacementByAdmin,
  reinstateReferralProfileByAdmin,
  rejectRefundRequestByAdmin,
  resolveCommissionAdjustmentByAdmin,
  resolveDisputeOutcomeByAdmin,
  restoreEntitlementByAdmin,
  restoreUserAccountByAdmin,
  revokeEntitlementByAdmin,
  setGlobalPromotionModeByAdmin,
  suspendEntitlementByAdmin,
  suspendReferralProfileByAdmin,
  suspendUserAccountByAdmin,
  transitionPayoutStatusByAdmin,
  updateDisputeNotesByAdmin,
  updateOperationalSettingsByAdmin,
  updatePromotionCampaignStatusByAdmin,
  updateAffordabilityTargetByAdmin,
  addAffordabilityRuleByAdmin,
  updateAffordabilityRuleByAdmin,
  toggleAffordabilityRuleByAdmin,
} from "@/lib/admin/workflows";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
};

// Optional test-only dependency injection hook (never active in production)
let injectedAdminTestDb: { db: Db; client: MongoClient | null } | null = null;

export function setAdminActionsTestDb(
  override: { db: Db; client: MongoClient | null } | null
): void {
  if (
    (process.env.NODE_ENV === "production" ||
      process.env.VERCEL_ENV === "production") &&
    override !== null
  ) {
    throw new Error("Cannot inject test DB in production.");
  }
  injectedAdminTestDb = override;
}

export async function POST(request: NextRequest) {
  // 1. Strict CSRF validation
  const csrfDenied = enforceCsrfProtection(request, "admin-actions");
  if (csrfDenied) {
    return csrfDenied;
  }

  // 2. Persistent IP rate limiting for sensitive administrative mutations
  const { blockedResponse, clientIp } = await enforceIpRateLimit({
    request,
    policy: "adminMutation",
    rateLimitExceededMessage:
      "Too many administrative mutation requests. Please wait before trying again.",
  });
  if (blockedResponse) {
    return blockedResponse;
  }

  // 3. Server-side live database admin authorization check
  const dbOverride = injectedAdminTestDb?.db;
  const authGuard = await requireAdminRequest(request, dbOverride);
  if (!authGuard.authorized) {
    return authGuard.deniedResponse;
  }

  // 4. Parse JSON payload safely
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body.", code: "INVALID_JSON" },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Request body must be a JSON object.", code: "INVALID_PAYLOAD" },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  // 5. Reject client-side role escalation fields
  const escalatedField = detectClientRoleEscalationAttempt(body);
  if (escalatedField) {
    return NextResponse.json(
      {
        error: `Forbidden privilege field "${escalatedField}" in request payload.`,
        code: "ROLE_ESCALATION_FORBIDDEN",
      },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  const record = body as Record<string, unknown>;
  const actionType = typeof record.actionType === "string" ? record.actionType : "";

  let db: Db;
  let client: MongoClient | null = null;
  try {
    if (injectedAdminTestDb) {
      db = injectedAdminTestDb.db;
      client = injectedAdminTestDb.client;
    } else {
      client = await getMongoClient();
      db = await getDb();
    }
  } catch {
    return NextResponse.json(
      { error: "Database connection unavailable.", code: "DB_UNAVAILABLE" },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }

  const ipAddressHash = clientIp
    ? buildIpRateLimitKey("admin-audit", clientIp)
    : null;
  const userAgent = request.headers.get("user-agent") || null;

  try {
    // Dispatch based on validated actionType
    if (actionType === "user.suspend" || actionType === "user.restore") {
      const parsed = userStatusMutationSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error: parsed.error.issues[0]?.message || "Invalid user action payload.",
            code: "VALIDATION_ERROR",
          },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }
      const ctx = {
        db,
        client,
        actor: authGuard.context,
        reason: parsed.data.reason,
        ipAddressHash,
        userAgent,
      };
      const outcome =
        parsed.data.actionType === "user.suspend"
          ? await suspendUserAccountByAdmin(ctx, parsed.data.userId)
          : await restoreUserAccountByAdmin(ctx, parsed.data.userId);

      return NextResponse.json(
        {
          ok: true,
          result: outcome.result,
          auditId: outcome.auditLog._id.toString(),
        },
        { status: 200, headers: NO_STORE_HEADERS }
      );
    }

    if (actionType.startsWith("entitlement.")) {
      const parsed = entitlementMutationSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error:
              parsed.error.issues[0]?.message ||
              "Invalid entitlement action payload.",
            code: "VALIDATION_ERROR",
          },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }
      const ctx = {
        db,
        client,
        actor: authGuard.context,
        reason: parsed.data.reason,
        ipAddressHash,
        userAgent,
      };
      let outcome;
      if (parsed.data.actionType === "entitlement.suspend") {
        outcome = await suspendEntitlementByAdmin(
          ctx,
          parsed.data.entitlementId
        );
      } else if (parsed.data.actionType === "entitlement.restore") {
        outcome = await restoreEntitlementByAdmin(
          ctx,
          parsed.data.entitlementId
        );
      } else if (parsed.data.actionType === "entitlement.revoke") {
        outcome = await revokeEntitlementByAdmin(
          ctx,
          parsed.data.entitlementId,
          parsed.data.revocationReason || "admin_revoked"
        );
      } else {
        outcome = await processDeviceReplacementByAdmin(
          ctx,
          parsed.data.entitlementId
        );
      }

      return NextResponse.json(
        {
          ok: true,
          result: outcome.result,
          auditId: outcome.auditLog._id.toString(),
        },
        { status: 200, headers: NO_STORE_HEADERS }
      );
    }

    if (actionType.startsWith("refund.")) {
      const parsed = refundMutationSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error:
              parsed.error.issues[0]?.message ||
              "Invalid refund action payload.",
            code: "VALIDATION_ERROR",
          },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }
      const ctx = {
        db,
        client,
        actor: authGuard.context,
        reason: parsed.data.reason,
        ipAddressHash,
        userAgent,
      };
      let outcome;
      if (parsed.data.actionType === "refund.create_request") {
        outcome = await createInternalRefundRequest(
          ctx,
          parsed.data.purchaseId
        );
      } else if (parsed.data.actionType === "refund.approve") {
        outcome = await approveRefundRequestByAdmin(
          ctx,
          parsed.data.purchaseId,
          { isExceptionalOverride: parsed.data.isExceptionalOverride }
        );
      } else if (parsed.data.actionType === "refund.reject") {
        outcome = await rejectRefundRequestByAdmin(
          ctx,
          parsed.data.purchaseId
        );
      } else {
        outcome = await initiateGatewayRefundByAdmin(
          ctx,
          parsed.data.purchaseId
        );
      }

      return NextResponse.json(
        {
          ok: true,
          result: outcome.result,
          auditId: outcome.auditLog._id.toString(),
        },
        { status: 200, headers: NO_STORE_HEADERS }
      );
    }

    if (actionType.startsWith("dispute.")) {
      const parsed = disputeMutationSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error:
              parsed.error.issues[0]?.message ||
              "Invalid dispute action payload.",
            code: "VALIDATION_ERROR",
          },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }
      const ctx = {
        db,
        client,
        actor: authGuard.context,
        reason: parsed.data.reason,
        ipAddressHash,
        userAgent,
      };
      let outcome;
      if (parsed.data.actionType === "dispute.open") {
        outcome = await openInternalDisputeRecord(ctx, parsed.data.purchaseId, {
          reasonCode: parsed.data.reasonCode,
          evidenceDeadlineAt: parsed.data.evidenceDeadlineAt,
          adminNotes: parsed.data.adminNotes,
        });
      } else if (parsed.data.actionType === "dispute.update_notes") {
        outcome = await updateDisputeNotesByAdmin(ctx, parsed.data.purchaseId, {
          adminNotes: parsed.data.adminNotes,
          evidenceDeadlineAt: parsed.data.evidenceDeadlineAt,
        });
      } else if (parsed.data.actionType === "dispute.resolve_won") {
        outcome = await resolveDisputeOutcomeByAdmin(
          ctx,
          parsed.data.purchaseId,
          "won"
        );
      } else if (parsed.data.actionType === "dispute.resolve_withdrawn") {
        outcome = await resolveDisputeOutcomeByAdmin(
          ctx,
          parsed.data.purchaseId,
          "withdrawn"
        );
      } else {
        outcome = await resolveDisputeOutcomeByAdmin(
          ctx,
          parsed.data.purchaseId,
          "lost"
        );
      }

      return NextResponse.json(
        {
          ok: true,
          result: outcome.result,
          auditId: outcome.auditLog._id.toString(),
        },
        { status: 200, headers: NO_STORE_HEADERS }
      );
    }

    if (actionType === "promotion.create") {
      const parsed = promotionCreateMutationSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error:
              parsed.error.issues[0]?.message ||
              "Invalid promotion creation payload.",
            code: "VALIDATION_ERROR",
          },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }
      const ctx = {
        db,
        client,
        actor: authGuard.context,
        reason: parsed.data.reason,
        ipAddressHash,
        userAgent,
      };
      const outcome = await createPromotionCampaignByAdmin(ctx, {
        name: parsed.data.name,
        code: parsed.data.code,
        discountPercent: parsed.data.discountPercent,
        startsAt: parsed.data.startsAt,
        endsAt: parsed.data.endsAt,
        activateImmediately: parsed.data.activateImmediately,
      });

      return NextResponse.json(
        {
          ok: true,
          result: outcome.result,
          auditId: outcome.auditLog._id.toString(),
        },
        { status: 200, headers: NO_STORE_HEADERS }
      );
    }

    if (
      actionType === "promotion.activate" ||
      actionType === "promotion.deactivate"
    ) {
      const parsed = promotionStatusMutationSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error:
              parsed.error.issues[0]?.message ||
              "Invalid promotion status payload.",
            code: "VALIDATION_ERROR",
          },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }
      const ctx = {
        db,
        client,
        actor: authGuard.context,
        reason: parsed.data.reason,
        ipAddressHash,
        userAgent,
      };
      const outcome = await updatePromotionCampaignStatusByAdmin(
        ctx,
        parsed.data.campaignId,
        parsed.data.actionType === "promotion.activate"
          ? "activate"
          : "deactivate"
      );

      return NextResponse.json(
        {
          ok: true,
          result: outcome.result,
          auditId: outcome.auditLog._id.toString(),
        },
        { status: 200, headers: NO_STORE_HEADERS }
      );
    }

    if (actionType === "promotion.set_global_mode") {
      const parsed = promotionGlobalModeMutationSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error:
              parsed.error.issues[0]?.message ||
              "Invalid global promotion mode payload.",
            code: "VALIDATION_ERROR",
          },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }
      const ctx = {
        db,
        client,
        actor: authGuard.context,
        reason: parsed.data.reason,
        ipAddressHash,
        userAgent,
      };
      const outcome = await setGlobalPromotionModeByAdmin(
        ctx,
        parsed.data.mode,
        parsed.data.promotionalDiscountPercent
      );

      return NextResponse.json(
        {
          ok: true,
          result: outcome.result,
          auditId: outcome.auditLog._id.toString(),
        },
        { status: 200, headers: NO_STORE_HEADERS }
      );
    }

    if (actionType.startsWith("referral.")) {
      const parsed = referralMutationSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error:
              parsed.error.issues[0]?.message ||
              "Invalid referral action payload.",
            code: "VALIDATION_ERROR",
          },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }
      const ctx = {
        db,
        client,
        actor: authGuard.context,
        reason: parsed.data.reason,
        ipAddressHash,
        userAgent,
      };
      let outcome;
      if (parsed.data.actionType === "referral.suspend") {
        outcome = await suspendReferralProfileByAdmin(
          ctx,
          parsed.data.referralProfileId
        );
      } else if (parsed.data.actionType === "referral.reinstate") {
        outcome = await reinstateReferralProfileByAdmin(
          ctx,
          parsed.data.referralProfileId
        );
      } else {
        outcome = await overrideReferralRiskHoldByAdmin(
          ctx,
          parsed.data.referralProfileId
        );
      }

      return NextResponse.json(
        {
          ok: true,
          result: outcome.result,
          auditId: outcome.auditLog._id.toString(),
        },
        { status: 200, headers: NO_STORE_HEADERS }
      );
    }

    if (actionType.startsWith("commission.")) {
      const parsed = commissionMutationSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error:
              parsed.error.issues[0]?.message ||
              "Invalid commission action payload.",
            code: "VALIDATION_ERROR",
          },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }
      const ctx = {
        db,
        client,
        actor: authGuard.context,
        reason: parsed.data.reason,
        ipAddressHash,
        userAgent,
      };
      let outcome;
      if (parsed.data.actionType === "commission.evaluate_eligibility") {
        if (!parsed.data.commissionId) {
          throw new DataValidationError("commissionId is required.");
        }
        outcome = await evaluateCommissionEligibilityByAdmin(
          ctx,
          parsed.data.commissionId
        );
      } else if (parsed.data.actionType === "commission.approve") {
        if (!parsed.data.commissionId) {
          throw new DataValidationError("commissionId is required.");
        }
        outcome = await approveCommissionByAdmin(
          ctx,
          parsed.data.commissionId
        );
      } else if (parsed.data.actionType === "commission.create_adjustment") {
        if (!parsed.data.commissionId) {
          throw new DataValidationError("commissionId is required.");
        }
        outcome = await createCommissionAdjustmentByAdmin(
          ctx,
          parsed.data.commissionId,
          parsed.data.adjustmentReason || "manual_reconciliation"
        );
      } else {
        if (!parsed.data.adjustmentId || !parsed.data.resolutionStatus) {
          throw new DataValidationError(
            "adjustmentId and resolutionStatus are required."
          );
        }
        outcome = await resolveCommissionAdjustmentByAdmin(
          ctx,
          parsed.data.adjustmentId,
          parsed.data.resolutionStatus
        );
      }

      return NextResponse.json(
        {
          ok: true,
          result: outcome.result,
          auditId: outcome.auditLog._id.toString(),
        },
        { status: 200, headers: NO_STORE_HEADERS }
      );
    }

    if (actionType.startsWith("payout.")) {
      const parsed = payoutMutationSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error:
              parsed.error.issues[0]?.message ||
              "Invalid payout action payload.",
            code: "VALIDATION_ERROR",
          },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }
      const ctx = {
        db,
        client,
        actor: authGuard.context,
        reason: parsed.data.reason,
        ipAddressHash,
        userAgent,
      };
      let outcome;
      if (parsed.data.actionType === "payout.create_batch") {
        if (!parsed.data.referrerUserId || !parsed.data.currency) {
          throw new DataValidationError(
            "referrerUserId and currency are required to create a payout batch."
          );
        }
        outcome = await createPayoutBatchByAdmin(ctx, {
          referrerUserIdStr: parsed.data.referrerUserId,
          currency: parsed.data.currency,
          payoutMethod: parsed.data.payoutMethod,
          commissionIdsStr: parsed.data.commissionIds,
        });
      } else {
        if (!parsed.data.payoutId) {
          throw new DataValidationError("payoutId is required.");
        }
        const shortAction = parsed.data.actionType.replace("payout.", "") as
          | "approve"
          | "reject"
          | "mark_processing"
          | "mark_failed"
          | "mark_paid";

        // Note: From the Admin UI route, verifiedProviderEvidence is strictly false
        // because live payout provider integration is deferred until Stage 3C.
        outcome = await transitionPayoutStatusByAdmin(
          ctx,
          parsed.data.payoutId,
          shortAction,
          {
            externalTransferReference: parsed.data.externalTransferReference,
            verifiedProviderEvidence: false,
          }
        );
      }

      return NextResponse.json(
        {
          ok: true,
          result: outcome.result,
          auditId: outcome.auditLog._id.toString(),
        },
        { status: 200, headers: NO_STORE_HEADERS }
      );
    }

    if (actionType === "settings.update_operational") {
      const parsed = operationalSettingsMutationSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error:
              parsed.error.issues[0]?.message ||
              "Invalid operational settings payload.",
            code: "VALIDATION_ERROR",
          },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }
      const ctx = {
        db,
        client,
        actor: authGuard.context,
        reason: parsed.data.reason,
        ipAddressHash,
        userAgent,
      };
      const outcome = await updateOperationalSettingsByAdmin(ctx, {
        maxPendingReservationsBeforeReview:
          parsed.data.maxPendingReservationsBeforeReview,
        maxDailyRedemptionsBeforeReview:
          parsed.data.maxDailyRedemptionsBeforeReview,
        requireManualReviewOnVelocityAlert:
          parsed.data.requireManualReviewOnVelocityAlert,
        productAvailability: parsed.data.productAvailability,
      });

      return NextResponse.json(
        {
          ok: true,
          result: outcome.result,
          auditId: outcome.auditLog._id.toString(),
        },
        { status: 200, headers: NO_STORE_HEADERS }
      );
    }

    if (actionType === "settings.update_affordability_target") {
      const parsed = updateAffordabilityTargetSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error:
              parsed.error.issues[0]?.message ||
              "Invalid affordability target payload.",
            code: "VALIDATION_ERROR",
          },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }
      const ctx = {
        db,
        client,
        actor: authGuard.context,
        reason: parsed.data.reason,
        ipAddressHash,
        userAgent,
      };
      const outcome = await updateAffordabilityTargetByAdmin(
        ctx,
        parsed.data.affordabilityTargetInr
      );

      return NextResponse.json(
        {
          ok: true,
          result: outcome.result,
          auditId: outcome.auditLog._id.toString(),
        },
        { status: 200, headers: NO_STORE_HEADERS }
      );
    }

    if (actionType === "settings.add_affordability_rule") {
      const parsed = addAffordabilityRuleSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error:
              parsed.error.issues[0]?.message ||
              "Invalid add affordability rule payload.",
            code: "VALIDATION_ERROR",
          },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }
      const ctx = {
        db,
        client,
        actor: authGuard.context,
        reason: parsed.data.reason,
        ipAddressHash,
        userAgent,
      };
      const outcome = await addAffordabilityRuleByAdmin(ctx, {
        countryCode: parsed.data.countryCode,
        countryName: parsed.data.countryName,
        currency: parsed.data.currency,
        currencySymbol: parsed.data.currencySymbol,
        basePriceSubunits: parsed.data.basePriceSubunits,
        usdFallbackPriceSubunits: parsed.data.usdFallbackPriceSubunits,
        isGatewaySupportedCurrency: parsed.data.isGatewaySupportedCurrency,
        isActive: parsed.data.isActive,
        notes: parsed.data.notes,
        referenceExchangeRateToInr: parsed.data.referenceExchangeRateToInr,
        approximateInrEquivalent: parsed.data.approximateInrEquivalent,
      });

      return NextResponse.json(
        {
          ok: true,
          result: outcome.result,
          auditId: outcome.auditLog._id.toString(),
        },
        { status: 200, headers: NO_STORE_HEADERS }
      );
    }

    if (actionType === "settings.update_affordability_rule") {
      const parsed = updateAffordabilityRuleSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error:
              parsed.error.issues[0]?.message ||
              "Invalid update affordability rule payload.",
            code: "VALIDATION_ERROR",
          },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }
      const ctx = {
        db,
        client,
        actor: authGuard.context,
        reason: parsed.data.reason,
        ipAddressHash,
        userAgent,
      };
      const outcome = await updateAffordabilityRuleByAdmin(
        ctx,
        parsed.data.countryCode,
        {
          countryName: parsed.data.countryName,
          currency: parsed.data.currency,
          currencySymbol: parsed.data.currencySymbol,
          basePriceSubunits: parsed.data.basePriceSubunits,
          usdFallbackPriceSubunits: parsed.data.usdFallbackPriceSubunits,
          isGatewaySupportedCurrency: parsed.data.isGatewaySupportedCurrency,
          isActive: parsed.data.isActive,
          notes: parsed.data.notes,
          referenceExchangeRateToInr: parsed.data.referenceExchangeRateToInr,
          approximateInrEquivalent: parsed.data.approximateInrEquivalent,
        }
      );

      return NextResponse.json(
        {
          ok: true,
          result: outcome.result,
          auditId: outcome.auditLog._id.toString(),
        },
        { status: 200, headers: NO_STORE_HEADERS }
      );
    }

    if (actionType === "settings.toggle_affordability_rule") {
      const parsed = toggleAffordabilityRuleSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error:
              parsed.error.issues[0]?.message ||
              "Invalid toggle affordability rule payload.",
            code: "VALIDATION_ERROR",
          },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }
      const ctx = {
        db,
        client,
        actor: authGuard.context,
        reason: parsed.data.reason,
        ipAddressHash,
        userAgent,
      };
      const outcome = await toggleAffordabilityRuleByAdmin(
        ctx,
        parsed.data.countryCode,
        parsed.data.isActive
      );

      return NextResponse.json(
        {
          ok: true,
          result: outcome.result,
          auditId: outcome.auditLog._id.toString(),
        },
        { status: 200, headers: NO_STORE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        error: `Unsupported or prohibited administrative action "${actionType}".`,
        code: "UNSUPPORTED_ADMIN_ACTION",
      },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  } catch (err: unknown) {
    if (err instanceof DataValidationError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }
    if (err instanceof InvalidStateTransitionError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 409, headers: NO_STORE_HEADERS }
      );
    }
    if (err instanceof ImmutableRecordError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 422, headers: NO_STORE_HEADERS }
      );
    }

    const message =
      err instanceof Error
        ? err.message
        : "Administrative operation failed.";
    return NextResponse.json(
      { error: message, code: "ADMIN_OPERATION_FAILED" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
