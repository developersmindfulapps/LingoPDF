import { Db, Filter, ObjectId } from "mongodb";
import {
  AdminAuditLogDocument,
  ALLOWED_PROMOTIONAL_DISCOUNT_PERCENTS,
  COLLECTION_NAMES,
  COMMISSION_HOLD_WINDOW_HOURS,
  CommissionAdjustmentDocument,
  CommissionDocument,
  EntitlementDocument,
  getCommissionAdjustmentsCollection,
  getCommissionsCollection,
  getEntitlementsCollection,
  getPaymentWebhooksCollection,
  getPayoutsCollection,
  getPromotionSettingsCollection,
  getPurchaseEvidenceCollection,
  getPurchasesCollection,
  getRateLimitsCollection,
  getReferralProfilesCollection,
  getUsersCollection,
  MAX_SUCCESSFUL_REFERRALS_PER_USER,
  MIN_ELIGIBLE_COMMISSIONS_FOR_PAYOUT,
  PayoutDocument,
  PromotionCampaignRecord,
  PromotionSettingsDocument,
  PurchaseDisputeRecord,
  PurchaseDocument,
  PurchaseRefundRequest,
  REFERRAL_COMMISSION_PERCENT,
  REFERRAL_CUSTOMER_DISCOUNT_PERCENT,
  ReferralProfileDocument,
  SupportedCurrency,
  UserDocument,
} from "@/lib/db/models";
import { verifyDatabaseTopology } from "@/lib/db/repositories";
import { getProtectedAdminAuditLogsCollection } from "@/lib/audit/adminAudit";
import { sanitizeUser } from "@/lib/auth/session";
import { resolveUserRole, getConfiguredAdminEmailAllowlist } from "@/lib/auth/admin";
import {
  MIN_HMAC_SECRET_LENGTH,
  RATE_LIMIT_POLICIES,
} from "@/lib/auth/rateLimit";
import { siteConfig } from "@/lib/siteConfig";
import { OverviewPeriod } from "./schemas";

export function escapeRegex(raw: string): string {
  return raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function clampPagination(page?: number, limit?: number) {
  const safePage = Math.max(1, Math.min(10000, Math.trunc(page || 1)));
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit || 20)));
  const skip = (safePage - 1) * safeLimit;
  return { page: safePage, limit: safeLimit, skip };
}

export function resolvePeriodStartDate(
  period: OverviewPeriod,
  now = new Date()
): Date | null {
  switch (period) {
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "90d":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "all":
    default:
      return null;
  }
}

export interface CurrencyTotalsMap {
  INR: number;
  USD: number;
  EUR: number;
}

export function emptyCurrencyTotals(): CurrencyTotalsMap {
  return { INR: 0, USD: 0, EUR: 0 };
}

// ---------------------------------------------------------------------------
// 1. Admin Overview Query (`/admin`)
// ---------------------------------------------------------------------------

export async function getAdminOverviewData(
  db: Db,
  period: OverviewPeriod = "30d",
  now = new Date()
) {
  const periodStart = resolvePeriodStartDate(period, now);
  const usersCol = await getUsersCollection(db);
  const purchasesCol = await getPurchasesCollection(db);
  const entitlementsCol = await getEntitlementsCollection(db);
  const referralProfilesCol = await getReferralProfilesCollection(db);
  const commissionsCol = await getCommissionsCollection(db);
  const payoutsCol = await getPayoutsCollection(db);
  const auditCol = await getProtectedAdminAuditLogsCollection(db);

  const periodFilter = periodStart ? { createdAt: { $gte: periodStart } } : {};

  const [
    totalUsers,
    verifiedUsers,
    suspendedUsers,
    newUsersInPeriod,
    totalPurchases,
    capturedPurchasesCount,
    failedPurchasesCount,
    disputedPurchasesCount,
    activeEntitlements,
    suspendedEntitlements,
    revokedEntitlements,
    totalReferralProfiles,
    activeReferralProfiles,
    suspendedReferralProfiles,
    pendingCommissionsCount,
    eligibleCommissionsCount,
    approvedCommissionsCount,
    paidCommissionsCount,
    heldCommissionsCount,
    pendingPayoutsCount,
    recentPurchasesRaw,
    recentUsersRaw,
    recentAuditRaw,
  ] = await Promise.all([
    usersCol.countDocuments({}),
    usersCol.countDocuments({ isEmailVerified: true }),
    usersCol.countDocuments({ status: "suspended" }),
    usersCol.countDocuments(periodFilter),
    purchasesCol.countDocuments(periodFilter),
    purchasesCol.countDocuments({ ...periodFilter, status: "captured" }),
    purchasesCol.countDocuments({ ...periodFilter, status: "failed" }),
    purchasesCol.countDocuments({ status: "disputed" }),
    entitlementsCol.countDocuments({ status: "active" }),
    entitlementsCol.countDocuments({ status: "suspended" }),
    entitlementsCol.countDocuments({ status: "revoked" }),
    referralProfilesCol.countDocuments({}),
    referralProfilesCol.countDocuments({ status: "active" }),
    referralProfilesCol.countDocuments({ status: "suspended" }),
    commissionsCol.countDocuments({ status: "pending", isDisputedHold: false }),
    commissionsCol.countDocuments({ status: "eligible", isDisputedHold: false }),
    commissionsCol.countDocuments({ status: "approved", isDisputedHold: false }),
    commissionsCol.countDocuments({ status: "paid" }),
    commissionsCol.countDocuments({ isDisputedHold: true }),
    payoutsCol.countDocuments({ status: { $in: ["draft", "approved", "processing"] } }),
    purchasesCol.find(periodFilter).sort({ createdAt: -1 }).limit(8).toArray(),
    usersCol.find(periodFilter).sort({ createdAt: -1 }).limit(8).toArray(),
    auditCol.find({}).sort({ createdAt: -1 }).limit(8).toArray(),
  ]);

  // Compute currency-segregated gross captured revenue & daily series (bounded query)
  const capturedPurchasesDocs = await purchasesCol
    .find({
      ...periodFilter,
      status: {
        $in: ["captured", "refunded", "partially_refunded", "disputed", "chargeback_lost"],
      },
      capturedAt: { $ne: null },
    })
    .sort({ capturedAt: -1 })
    .limit(500)
    .toArray();

  const grossCapturedRevenueByCurrency = emptyCurrencyTotals();
  const netRetainedRevenueByCurrency = emptyCurrencyTotals();
  const timeSeriesMap = new Map<
    string,
    { date: string; INR: number; USD: number; EUR: number; count: number }
  >();

  for (const p of capturedPurchasesDocs) {
    const cur = p.currency;
    const total = p.pricingSnapshot?.totalSubunits || 0;
    if (cur === "INR" || cur === "USD" || cur === "EUR") {
      grossCapturedRevenueByCurrency[cur] += total;
      if (p.status === "captured") {
        netRetainedRevenueByCurrency[cur] += total;
      }
      const dateStr = (p.capturedAt || p.createdAt).toISOString().slice(0, 10);
      const bucket = timeSeriesMap.get(dateStr) || {
        date: dateStr,
        INR: 0,
        USD: 0,
        EUR: 0,
        count: 0,
      };
      bucket[cur] += total;
      bucket.count += 1;
      timeSeriesMap.set(dateStr, bucket);
    }
  }

  const revenueSeries = Array.from(timeSeriesMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14);

  // Count pending refund requests and open disputes from purchases
  const allRefundAndDisputePurchases = await purchasesCol
    .find({
      $or: [
        { "refundRequest.status": { $in: ["pending_review", "approved_pending_gateway"] } },
        { "disputeRecord.status": { $in: ["open", "under_review"] } },
        { status: "disputed" },
      ],
    })
    .limit(200)
    .toArray();

  let pendingRefundRequestsCount = 0;
  let approvedPendingGatewayRefundsCount = 0;
  let openDisputesCount = 0;

  for (const p of allRefundAndDisputePurchases) {
    if (p.refundRequest?.status === "pending_review") {
      pendingRefundRequestsCount += 1;
    } else if (p.refundRequest?.status === "approved_pending_gateway") {
      approvedPendingGatewayRefundsCount += 1;
    }
    if (
      p.disputeRecord?.status === "open" ||
      p.disputeRecord?.status === "under_review" ||
      (!p.disputeRecord && p.status === "disputed")
    ) {
      openDisputesCount += 1;
    }
  }

  // Referral successful redemptions sum
  const allProfiles = await referralProfilesCol.find({}).limit(500).toArray();
  const totalSuccessfulRedemptions = allProfiles.reduce(
    (acc, rp) => acc + (rp.successfulConversionsCount || 0),
    0
  );
  const flaggedRiskReferralsCount = allProfiles.filter(
    (rp) => rp.riskReviewRequired === true
  ).length;

  // Commission totals by currency
  const unpaidCommissionsDocs = await commissionsCol
    .find({ status: { $in: ["pending", "eligible", "approved"] } })
    .limit(500)
    .toArray();
  const eligibleCommissionTotalsByCurrency = emptyCurrencyTotals();
  const pendingCommissionTotalsByCurrency = emptyCurrencyTotals();
  const heldCommissionTotalsByCurrency = emptyCurrencyTotals();

  for (const c of unpaidCommissionsDocs) {
    const cur = c.currency;
    if (c.isDisputedHold) {
      heldCommissionTotalsByCurrency[cur] += c.commissionAmountSubunits;
    } else if (c.status === "eligible" || c.status === "approved") {
      eligibleCommissionTotalsByCurrency[cur] += c.commissionAmountSubunits;
    } else if (c.status === "pending") {
      pendingCommissionTotalsByCurrency[cur] += c.commissionAmountSubunits;
    }
  }

  // Enrich recent purchases with user email
  const recentBuyerIds = Array.from(
    new Set(recentPurchasesRaw.map((p) => p.userId.toString()))
  ).map((id) => new ObjectId(id));
  const recentBuyerDocs =
    recentBuyerIds.length > 0
      ? await usersCol.find({ _id: { $in: recentBuyerIds } }).toArray()
      : [];
  const buyerEmailById = new Map(
    recentBuyerDocs.map((u) => [u._id.toString(), u.email])
  );

  // Operational alerts
  const alerts: Array<{
    id: string;
    severity: "critical" | "warning" | "info";
    title: string;
    message: string;
    href: string;
  }> = [];

  if (openDisputesCount > 0) {
    alerts.push({
      id: "open-disputes",
      severity: "critical",
      title: `${openDisputesCount} Open Dispute(s) / Chargeback(s)`,
      message:
        "Associated entitlements are suspended and unpaid commissions are frozen pending dispute resolution.",
      href: "/admin/disputes",
    });
  }
  if (pendingRefundRequestsCount > 0) {
    alerts.push({
      id: "pending-refunds",
      severity: "warning",
      title: `${pendingRefundRequestsCount} Refund Request(s) Pending Review`,
      message:
        "Review customer refund requests within the 72-hour money-back guarantee window.",
      href: "/admin/refunds",
    });
  }
  if (flaggedRiskReferralsCount > 0) {
    alerts.push({
      id: "flagged-referrals",
      severity: "warning",
      title: `${flaggedRiskReferralsCount} Referral Profile(s) Flagged for Risk Review`,
      message:
        "Referral redemptions are paused for flagged profiles until an administrator reviews them.",
      href: "/admin/referrals?riskFilter=flagged",
    });
  }
  if (pendingPayoutsCount > 0) {
    alerts.push({
      id: "pending-payouts",
      severity: "info",
      title: `${pendingPayoutsCount} Payout Batch(es) Awaiting Action`,
      message:
        "Inspect single-currency payout batches in the Payouts module.",
      href: "/admin/payouts",
    });
  }

  return {
    period,
    metrics: {
      totalUsers,
      verifiedUsers,
      suspendedUsers,
      newUsersInPeriod,
      totalPurchases,
      capturedPurchasesCount,
      failedPurchasesCount,
      disputedPurchasesCount,
      grossCapturedRevenueByCurrency,
      netRetainedRevenueByCurrency,
      activeEntitlements,
      suspendedEntitlements,
      revokedEntitlements,
      pendingRefundRequestsCount,
      approvedPendingGatewayRefundsCount,
      openDisputesCount,
      totalReferralProfiles,
      activeReferralProfiles,
      suspendedReferralProfiles,
      totalSuccessfulRedemptions,
      pendingCommissionsCount,
      eligibleCommissionsCount:
        eligibleCommissionsCount + approvedCommissionsCount,
      paidCommissionsCount,
      heldCommissionsCount,
      eligibleCommissionTotalsByCurrency,
      pendingCommissionTotalsByCurrency,
      heldCommissionTotalsByCurrency,
      pendingPayoutsCount,
    },
    revenueSeries,
    alerts,
    recentPurchases: recentPurchasesRaw.map((p) => ({
      id: p._id.toString(),
      userId: p.userId.toString(),
      userEmail: buyerEmailById.get(p.userId.toString()) || "Unknown user",
      productSlug: p.productSlug,
      currency: p.currency,
      totalSubunits: p.pricingSnapshot.totalSubunits,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
    })),
    recentUsers: recentUsersRaw.map((u) => sanitizeUser(u)),
    recentAuditLogs: recentAuditRaw.map((a) => ({
      id: a._id.toString(),
      actorEmail: a.actorEmail,
      action: a.action,
      targetCollection: a.targetCollection,
      targetId: a.targetId,
      outcome: a.outcome,
      reason: a.reason,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}

// ---------------------------------------------------------------------------
// 2. User Listing & User Details Queries (`/admin/users`, `/admin/users/[id]`)
// ---------------------------------------------------------------------------

export async function listAdminUsers(
  db: Db,
  params: {
    page?: number;
    limit?: number;
    q?: string;
    status?: "all" | "active" | "suspended";
    verified?: "all" | "verified" | "unverified";
    role?: "all" | "customer" | "admin";
    sort?: "newest" | "oldest" | "email_asc" | "email_desc";
  }
) {
  const { page, limit, skip } = clampPagination(params.page, params.limit);
  const usersCol = await getUsersCollection(db);
  const purchasesCol = await getPurchasesCollection(db);
  const entitlementsCol = await getEntitlementsCollection(db);

  const filter: Filter<UserDocument> = {};
  const q = params.q?.trim() || "";
  if (q) {
    const safeRegex = new RegExp(escapeRegex(q), "i");
    if (/^[a-fA-F0-9]{24}$/.test(q)) {
      filter._id = new ObjectId(q);
    } else {
      filter.$or = [{ email: safeRegex }, { name: safeRegex }];
    }
  }

  if (params.status && params.status !== "all") {
    filter.status = params.status;
  }
  if (params.verified === "verified") {
    filter.isEmailVerified = true;
  } else if (params.verified === "unverified") {
    filter.isEmailVerified = false;
  }
  if (params.role === "admin") {
    filter.role = "admin";
  } else if (params.role === "customer") {
    filter.$and = [
      ...(filter.$and || []),
      { $or: [{ role: "customer" }, { role: { $exists: false } }] },
    ];
  }

  const sortSpec: Record<string, 1 | -1> =
    params.sort === "oldest"
      ? { createdAt: 1 }
      : params.sort === "email_asc"
        ? { email: 1 }
        : params.sort === "email_desc"
          ? { email: -1 }
          : { createdAt: -1 };

  const [total, rawUsers] = await Promise.all([
    usersCol.countDocuments(filter),
    usersCol.find(filter).sort(sortSpec).skip(skip).limit(limit).toArray(),
  ]);

  const userIds = rawUsers.map((u) => u._id);
  const [userPurchases, userEntitlements] =
    userIds.length > 0
      ? await Promise.all([
          purchasesCol
            .find({ userId: { $in: userIds } })
            .limit(500)
            .toArray(),
          entitlementsCol
            .find({ userId: { $in: userIds } })
            .limit(500)
            .toArray(),
        ])
      : [[], []];

  const purchaseCountMap = new Map<string, { total: number; captured: number }>();
  for (const p of userPurchases) {
    const key = p.userId.toString();
    const cur = purchaseCountMap.get(key) || { total: 0, captured: 0 };
    cur.total += 1;
    if (p.status === "captured") cur.captured += 1;
    purchaseCountMap.set(key, cur);
  }

  const entitlementMap = new Map<
    string,
    { active: number; suspended: number; revoked: number }
  >();
  for (const e of userEntitlements) {
    const key = e.userId.toString();
    const cur = entitlementMap.get(key) || {
      active: 0,
      suspended: 0,
      revoked: 0,
    };
    cur[e.status] += 1;
    entitlementMap.set(key, cur);
  }

  const items = rawUsers.map((u) => {
    const safe = sanitizeUser(u);
    const key = u._id.toString();
    return {
      ...safe,
      suspensionReason: u.suspensionReason ?? null,
      suspendedAt: u.suspendedAt ? u.suspendedAt.toISOString() : null,
      purchaseCounts: purchaseCountMap.get(key) || { total: 0, captured: 0 },
      entitlementSummary: entitlementMap.get(key) || {
        active: 0,
        suspended: 0,
        revoked: 0,
      },
    };
  });

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getAdminUserDetails(db: Db, userIdStr: string) {
  if (!/^[a-fA-F0-9]{24}$/.test(userIdStr)) {
    return null;
  }
  const userId = new ObjectId(userIdStr);
  const usersCol = await getUsersCollection(db);
  const user = await usersCol.findOne({ _id: userId });
  if (!user) return null;

  const purchasesCol = await getPurchasesCollection(db);
  const entitlementsCol = await getEntitlementsCollection(db);
  const referralProfilesCol = await getReferralProfilesCollection(db);
  const commissionsCol = await getCommissionsCollection(db);
  const payoutsCol = await getPayoutsCollection(db);
  const auditCol = await getProtectedAdminAuditLogsCollection(db);

  const [
    purchases,
    entitlements,
    referralProfile,
    commissions,
    payouts,
    auditLogs,
  ] = await Promise.all([
    purchasesCol
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray(),
    entitlementsCol
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray(),
    referralProfilesCol.findOne({ userId }),
    commissionsCol
      .find({ referrerUserId: userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray(),
    payoutsCol
      .find({ referrerUserId: userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray(),
    auditCol
      .find({
        $or: [
          { targetCollection: COLLECTION_NAMES.users, targetId: userIdStr },
          { actorUserId: userId },
        ],
      })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray(),
  ]);

  const refundRecords = purchases
    .filter((p) => Boolean(p.refundRequest))
    .map((p) => p.refundRequest!);

  const disputeRecords = purchases
    .filter((p) => Boolean(p.disputeRecord))
    .map((p) => p.disputeRecord!);

  return {
    user: {
      ...sanitizeUser(user),
      role: resolveUserRole(user),
      suspensionReason: user.suspensionReason ?? null,
      suspendedAt: user.suspendedAt ? user.suspendedAt.toISOString() : null,
      updatedAt: user.updatedAt.toISOString(),
    },
    purchases: purchases.map((p) => ({
      id: p._id.toString(),
      productSlug: p.productSlug,
      editionVersion: p.editionVersion,
      region: p.region,
      currency: p.currency,
      pricingSnapshot: p.pricingSnapshot,
      status: p.status,
      providerOrderId: p.providerOrderId,
      providerPaymentId: p.providerPaymentId,
      capturedAt: p.capturedAt ? p.capturedAt.toISOString() : null,
      refundedAt: p.refundedAt ? p.refundedAt.toISOString() : null,
      disputedAt: p.disputedAt ? p.disputedAt.toISOString() : null,
      refundRequest: p.refundRequest ?? null,
      disputeRecord: p.disputeRecord ?? null,
      createdAt: p.createdAt.toISOString(),
    })),
    entitlements: entitlements.map((e) => ({
      id: e._id.toString(),
      purchaseId: e.purchaseId ? e.purchaseId.toString() : null,
      productSlug: e.productSlug,
      status: e.status,
      activeRestrictionReasons: e.activeRestrictionReasons,
      revocationReason: e.revocationReason,
      maxActiveDevices: e.maxActiveDevices,
      activeInstallationIdHash: e.activeInstallationIdHash,
      deviceBoundAt: e.deviceBoundAt ? e.deviceBoundAt.toISOString() : null,
      lastValidatedAt: e.lastValidatedAt
        ? e.lastValidatedAt.toISOString()
        : null,
      deviceReplacementCount: e.deviceReplacementCount ?? 0,
      lastDeviceResetAt: e.lastDeviceResetAt
        ? e.lastDeviceResetAt.toISOString()
        : null,
      lastDeviceResetReason: e.lastDeviceResetReason ?? null,
      suspendedAt: e.suspendedAt ? e.suspendedAt.toISOString() : null,
      revokedAt: e.revokedAt ? e.revokedAt.toISOString() : null,
      createdAt: e.createdAt.toISOString(),
    })),
    refundRecords,
    disputeRecords,
    referralProfile: referralProfile
      ? {
          id: referralProfile._id.toString(),
          referralCode: referralProfile.referralCode,
          status: referralProfile.status,
          maxReferralsCap: referralProfile.maxReferralsCap,
          pendingReservedCount: referralProfile.pendingReservedCount,
          successfulConversionsCount:
            referralProfile.successfulConversionsCount,
          remainingCapacity: Math.max(
            0,
            referralProfile.maxReferralsCap -
              referralProfile.successfulConversionsCount -
              referralProfile.pendingReservedCount
          ),
          payoutMethod: referralProfile.payoutMethod,
          riskReviewRequired: referralProfile.riskReviewRequired ?? false,
          riskHoldReason: referralProfile.riskHoldReason ?? null,
          suspensionReason: referralProfile.suspensionReason ?? null,
          createdAt: referralProfile.createdAt.toISOString(),
        }
      : null,
    commissions: commissions.map((c) => ({
      id: c._id.toString(),
      purchaseId: c.purchaseId.toString(),
      currency: c.currency,
      netCollectedSubunits: c.netCollectedSubunits,
      commissionAmountSubunits: c.commissionAmountSubunits,
      status: c.status,
      isDisputedHold: c.isDisputedHold,
      holdUntil: c.holdUntil.toISOString(),
      createdAt: c.createdAt.toISOString(),
    })),
    payouts: payouts.map((po) => ({
      id: po._id.toString(),
      currency: po.currency,
      totalAmountSubunits: po.totalAmountSubunits,
      status: po.status,
      payoutMethod: po.payoutMethod,
      createdAt: po.createdAt.toISOString(),
    })),
    auditLogs: auditLogs.map((a) => ({
      id: a._id.toString(),
      actorEmail: a.actorEmail,
      action: a.action,
      targetCollection: a.targetCollection,
      targetId: a.targetId,
      outcome: a.outcome,
      reason: a.reason,
      metadata: a.metadata,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}

// ---------------------------------------------------------------------------
// 3. Purchase Listing & Details Queries (`/admin/purchases`, `/admin/purchases/[id]`)
// ---------------------------------------------------------------------------

export async function listAdminPurchases(
  db: Db,
  params: {
    page?: number;
    limit?: number;
    q?: string;
    status?: string;
    currency?: string;
    productSlug?: string;
    dateFrom?: string;
    dateTo?: string;
  }
) {
  const { page, limit, skip } = clampPagination(params.page, params.limit);
  const purchasesCol = await getPurchasesCollection(db);
  const usersCol = await getUsersCollection(db);

  const filter: Filter<PurchaseDocument> = {};
  const q = params.q?.trim() || "";
  if (q) {
    if (/^[a-fA-F0-9]{24}$/.test(q)) {
      filter.$or = [{ _id: new ObjectId(q) }, { userId: new ObjectId(q) }];
    } else {
      const safeRegex = new RegExp(escapeRegex(q), "i");
      const matchingUsers = await usersCol
        .find({ email: safeRegex })
        .limit(50)
        .toArray();
      const matchingUserIds = matchingUsers.map((u) => u._id);
      filter.$or = [
        ...(matchingUserIds.length > 0
          ? [{ userId: { $in: matchingUserIds } }]
          : []),
        { providerOrderId: safeRegex },
        { providerPaymentId: safeRegex },
        { idempotencyKey: safeRegex },
        { "pricingSnapshot.referralCodeApplied": safeRegex },
      ];
    }
  }

  if (params.status && params.status !== "all") {
    filter.status = params.status as PurchaseDocument["status"];
  }
  if (params.currency && params.currency !== "all") {
    filter.currency = params.currency as SupportedCurrency;
  }
  if (params.productSlug && params.productSlug !== "all") {
    filter.productSlug = params.productSlug;
  }
  if (params.dateFrom || params.dateTo) {
    const createdAtFilter: Record<string, Date> = {};
    if (params.dateFrom) {
      const fromDate = new Date(params.dateFrom);
      if (!Number.isNaN(fromDate.getTime())) createdAtFilter.$gte = fromDate;
    }
    if (params.dateTo) {
      const toDate = new Date(params.dateTo);
      if (!Number.isNaN(toDate.getTime())) createdAtFilter.$lte = toDate;
    }
    if (Object.keys(createdAtFilter).length > 0) {
      filter.createdAt = createdAtFilter;
    }
  }

  const [total, rawPurchases] = await Promise.all([
    purchasesCol.countDocuments(filter),
    purchasesCol
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
  ]);

  const buyerIds = Array.from(
    new Set(rawPurchases.map((p) => p.userId.toString()))
  ).map((id) => new ObjectId(id));
  const buyers =
    buyerIds.length > 0
      ? await usersCol.find({ _id: { $in: buyerIds } }).toArray()
      : [];
  const buyerById = new Map(buyers.map((u) => [u._id.toString(), u]));

  const items = rawPurchases.map((p) => {
    const buyer = buyerById.get(p.userId.toString());
    return {
      id: p._id.toString(),
      userId: p.userId.toString(),
      userEmail: buyer?.email || "Unknown user",
      userName: buyer?.name || null,
      productSlug: p.productSlug,
      editionVersion: p.editionVersion,
      region: p.region,
      currency: p.currency,
      pricingSnapshot: p.pricingSnapshot,
      paymentProvider: p.paymentProvider,
      providerOrderId: p.providerOrderId,
      providerPaymentId: p.providerPaymentId,
      idempotencyKey: p.idempotencyKey,
      status: p.status,
      referrerUserId: p.referrerUserId ? p.referrerUserId.toString() : null,
      capturedAt: p.capturedAt ? p.capturedAt.toISOString() : null,
      refundedAt: p.refundedAt ? p.refundedAt.toISOString() : null,
      disputedAt: p.disputedAt ? p.disputedAt.toISOString() : null,
      refundRequestStatus: p.refundRequest?.status ?? null,
      disputeStatus: p.disputeRecord?.status ?? null,
      createdAt: p.createdAt.toISOString(),
    };
  });

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getAdminPurchaseDetails(db: Db, purchaseIdStr: string) {
  if (!/^[a-fA-F0-9]{24}$/.test(purchaseIdStr)) {
    return null;
  }
  const purchaseId = new ObjectId(purchaseIdStr);
  const purchasesCol = await getPurchasesCollection(db);
  const purchase = await purchasesCol.findOne({ _id: purchaseId });
  if (!purchase) return null;

  const usersCol = await getUsersCollection(db);
  const entitlementsCol = await getEntitlementsCollection(db);
  const evidenceCol = await getPurchaseEvidenceCollection(db);
  const commissionsCol = await getCommissionsCollection(db);
  const adjustmentsCol = await getCommissionAdjustmentsCollection(db);
  const webhooksCol = await getPaymentWebhooksCollection(db);
  const auditCol = await getProtectedAdminAuditLogsCollection(db);

  const [
    buyer,
    referrer,
    entitlement,
    evidence,
    commission,
    adjustments,
    webhooks,
    auditLogs,
  ] = await Promise.all([
    usersCol.findOne({ _id: purchase.userId }),
    purchase.referrerUserId
      ? usersCol.findOne({ _id: purchase.referrerUserId })
      : Promise.resolve(null),
    entitlementsCol.findOne({ purchaseId }),
    evidenceCol.findOne({ purchaseId }),
    commissionsCol.findOne({ purchaseId }),
    adjustmentsCol.find({ purchaseId }).sort({ createdAt: -1 }).toArray(),
    purchase.providerOrderId || purchase.providerPaymentId
      ? webhooksCol
          .find({
            $or: [
              ...(purchase.providerOrderId
                ? [{ relatedOrderId: purchase.providerOrderId }]
                : []),
              ...(purchase.providerPaymentId
                ? [{ relatedPaymentId: purchase.providerPaymentId }]
                : []),
            ],
          })
          .sort({ receivedAt: -1 })
          .limit(20)
          .toArray()
      : Promise.resolve([]),
    auditCol
      .find({
        targetCollection: COLLECTION_NAMES.purchases,
        targetId: purchaseIdStr,
      })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray(),
  ]);

  return {
    purchase: {
      id: purchase._id.toString(),
      userId: purchase.userId.toString(),
      userEmail: buyer?.email || "Unknown user",
      userName: buyer?.name || null,
      productSlug: purchase.productSlug,
      editionVersion: purchase.editionVersion,
      region: purchase.region,
      currency: purchase.currency,
      pricingSnapshot: purchase.pricingSnapshot,
      paymentProvider: purchase.paymentProvider,
      providerOrderId: purchase.providerOrderId,
      providerPaymentId: purchase.providerPaymentId,
      idempotencyKey: purchase.idempotencyKey,
      status: purchase.status,
      referrerUserId: purchase.referrerUserId
        ? purchase.referrerUserId.toString()
        : null,
      referrerEmail: referrer?.email || null,
      referralProfileId: purchase.referralProfileId
        ? purchase.referralProfileId.toString()
        : null,
      capturedAt: purchase.capturedAt
        ? purchase.capturedAt.toISOString()
        : null,
      refundedAt: purchase.refundedAt
        ? purchase.refundedAt.toISOString()
        : null,
      disputedAt: purchase.disputedAt
        ? purchase.disputedAt.toISOString()
        : null,
      refundRequest: purchase.refundRequest ?? null,
      refundHistory: purchase.refundHistory ?? [],
      disputeRecord: purchase.disputeRecord ?? null,
      disputeHistory: purchase.disputeHistory ?? [],
      createdAt: purchase.createdAt.toISOString(),
      updatedAt: purchase.updatedAt.toISOString(),
    },
    entitlement: entitlement
      ? {
          id: entitlement._id.toString(),
          status: entitlement.status,
          activeRestrictionReasons: entitlement.activeRestrictionReasons,
          revocationReason: entitlement.revocationReason,
          activeInstallationIdHash: entitlement.activeInstallationIdHash,
          deviceBoundAt: entitlement.deviceBoundAt
            ? entitlement.deviceBoundAt.toISOString()
            : null,
          lastValidatedAt: entitlement.lastValidatedAt
            ? entitlement.lastValidatedAt.toISOString()
            : null,
          deviceReplacementCount: entitlement.deviceReplacementCount ?? 0,
        }
      : null,
    evidence: evidence
      ? {
          id: evidence._id.toString(),
          emailSnapshot: evidence.emailSnapshot,
          paymentMethodSummary: evidence.paymentMethodSummary,
          countryCodeSnapshot: evidence.countryCodeSnapshot,
          termsVersionAccepted: evidence.termsVersionAccepted,
          refundPolicyVersionAccepted: evidence.refundPolicyVersionAccepted,
          acceptedAt: evidence.acceptedAt.toISOString(),
          extensionActivatedAt: evidence.extensionActivatedAt
            ? evidence.extensionActivatedAt.toISOString()
            : null,
        }
      : null,
    commission: commission
      ? {
          id: commission._id.toString(),
          referrerUserId: commission.referrerUserId.toString(),
          currency: commission.currency,
          netCollectedSubunits: commission.netCollectedSubunits,
          commissionAmountSubunits: commission.commissionAmountSubunits,
          status: commission.status,
          isDisputedHold: commission.isDisputedHold,
          holdUntil: commission.holdUntil.toISOString(),
          paidAt: commission.paidAt ? commission.paidAt.toISOString() : null,
          cancellationReason: commission.cancellationReason,
        }
      : null,
    adjustments: adjustments.map((adj) => ({
      id: adj._id.toString(),
      adjustmentAmountSubunits: adj.adjustmentAmountSubunits,
      currency: adj.currency,
      reason: adj.reason,
      resolutionStatus: adj.resolutionStatus,
      createdAt: adj.createdAt.toISOString(),
    })),
    webhooks: webhooks.map((wh) => ({
      id: wh._id.toString(),
      eventId: wh.eventId,
      eventType: wh.eventType,
      processingStatus: wh.processingStatus,
      receivedAt: wh.receivedAt.toISOString(),
    })),
    auditLogs: auditLogs.map((a) => ({
      id: a._id.toString(),
      actorEmail: a.actorEmail,
      action: a.action,
      outcome: a.outcome,
      reason: a.reason,
      metadata: a.metadata,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}

// ---------------------------------------------------------------------------
// 4. Entitlements Listing Query (`/admin/entitlements`)
// ---------------------------------------------------------------------------

export async function listAdminEntitlements(
  db: Db,
  params: {
    page?: number;
    limit?: number;
    q?: string;
    status?: string;
    productSlug?: string;
    dateFrom?: string;
    dateTo?: string;
  }
) {
  const { page, limit, skip } = clampPagination(params.page, params.limit);
  const entitlementsCol = await getEntitlementsCollection(db);
  const usersCol = await getUsersCollection(db);

  const filter: Filter<EntitlementDocument> = {};
  const q = params.q?.trim() || "";
  if (q) {
    if (/^[a-fA-F0-9]{24}$/.test(q)) {
      const objId = new ObjectId(q);
      filter.$or = [{ _id: objId }, { userId: objId }, { purchaseId: objId }];
    } else {
      const safeRegex = new RegExp(escapeRegex(q), "i");
      const matchingUsers = await usersCol
        .find({ email: safeRegex })
        .limit(50)
        .toArray();
      const matchingUserIds = matchingUsers.map((u) => u._id);
      filter.$or = [
        ...(matchingUserIds.length > 0
          ? [{ userId: { $in: matchingUserIds } }]
          : []),
        { activeInstallationIdHash: safeRegex },
      ];
    }
  }

  if (params.status && params.status !== "all") {
    filter.status = params.status as EntitlementDocument["status"];
  }
  if (params.productSlug && params.productSlug !== "all") {
    filter.productSlug = params.productSlug;
  }
  if (params.dateFrom || params.dateTo) {
    const createdAtFilter: Record<string, Date> = {};
    if (params.dateFrom) {
      const d = new Date(params.dateFrom);
      if (!Number.isNaN(d.getTime())) createdAtFilter.$gte = d;
    }
    if (params.dateTo) {
      const d = new Date(params.dateTo);
      if (!Number.isNaN(d.getTime())) createdAtFilter.$lte = d;
    }
    if (Object.keys(createdAtFilter).length > 0) {
      filter.createdAt = createdAtFilter;
    }
  }

  const [total, rawEntitlements] = await Promise.all([
    entitlementsCol.countDocuments(filter),
    entitlementsCol
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
  ]);

  const userIds = Array.from(
    new Set(rawEntitlements.map((e) => e.userId.toString()))
  ).map((id) => new ObjectId(id));
  const users =
    userIds.length > 0
      ? await usersCol.find({ _id: { $in: userIds } }).toArray()
      : [];
  const userById = new Map(users.map((u) => [u._id.toString(), u]));

  const items = rawEntitlements.map((e) => {
    const u = userById.get(e.userId.toString());
    return {
      id: e._id.toString(),
      userId: e.userId.toString(),
      userEmail: u?.email || "Unknown user",
      purchaseId: e.purchaseId ? e.purchaseId.toString() : null,
      productSlug: e.productSlug,
      status: e.status,
      activeRestrictionReasons: e.activeRestrictionReasons,
      revocationReason: e.revocationReason,
      maxActiveDevices: e.maxActiveDevices,
      activeInstallationIdHash: e.activeInstallationIdHash,
      deviceBoundAt: e.deviceBoundAt ? e.deviceBoundAt.toISOString() : null,
      lastValidatedAt: e.lastValidatedAt
        ? e.lastValidatedAt.toISOString()
        : null,
      deviceReplacementCount: e.deviceReplacementCount ?? 0,
      lastDeviceResetAt: e.lastDeviceResetAt
        ? e.lastDeviceResetAt.toISOString()
        : null,
      lastDeviceResetReason: e.lastDeviceResetReason ?? null,
      suspendedAt: e.suspendedAt ? e.suspendedAt.toISOString() : null,
      revokedAt: e.revokedAt ? e.revokedAt.toISOString() : null,
      createdAt: e.createdAt.toISOString(),
    };
  });

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

// ---------------------------------------------------------------------------
// 5. Refunds Queue Query (`/admin/refunds`)
// ---------------------------------------------------------------------------

export async function listAdminRefunds(
  db: Db,
  params: {
    page?: number;
    limit?: number;
    q?: string;
    status?: string;
    currency?: string;
    windowFilter?: string;
  }
) {
  const { page, limit, skip } = clampPagination(params.page, params.limit);
  const purchasesCol = await getPurchasesCollection(db);
  const usersCol = await getUsersCollection(db);
  const entitlementsCol = await getEntitlementsCollection(db);
  const evidenceCol = await getPurchaseEvidenceCollection(db);

  const filter: Filter<PurchaseDocument> = {
    $or: [
      { refundRequest: { $ne: null } },
      { status: { $in: ["refunded", "partially_refunded"] } },
    ],
  };

  if (params.currency && params.currency !== "all") {
    filter.currency = params.currency as SupportedCurrency;
  }
  if (params.status && params.status !== "all") {
    filter["refundRequest.status"] = params.status;
  }
  if (params.windowFilter === "within_72h") {
    filter["refundRequest.isWithin72hGuarantee"] = true;
  } else if (params.windowFilter === "outside_72h") {
    filter["refundRequest.isWithin72hGuarantee"] = false;
  }

  const q = params.q?.trim() || "";
  if (q) {
    if (/^[a-fA-F0-9]{24}$/.test(q)) {
      filter._id = new ObjectId(q);
    } else {
      const safeRegex = new RegExp(escapeRegex(q), "i");
      const matchingUsers = await usersCol
        .find({ email: safeRegex })
        .limit(50)
        .toArray();
      const matchingUserIds = matchingUsers.map((u) => u._id);
      filter.$and = [
        ...(filter.$and || []),
        {
          $or: [
            ...(matchingUserIds.length > 0
              ? [{ userId: { $in: matchingUserIds } }]
              : []),
            { "refundRequest.requestId": safeRegex },
            { "refundRequest.reason": safeRegex },
          ],
        },
      ];
    }
  }

  const [total, rawPurchases] = await Promise.all([
    purchasesCol.countDocuments(filter),
    purchasesCol
      .find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
  ]);

  const userIds = Array.from(
    new Set(rawPurchases.map((p) => p.userId.toString()))
  ).map((id) => new ObjectId(id));
  const purchaseIds = rawPurchases.map((p) => p._id);

  const [users, entitlements, evidences] = await Promise.all([
    userIds.length > 0
      ? usersCol.find({ _id: { $in: userIds } }).toArray()
      : Promise.resolve([]),
    purchaseIds.length > 0
      ? entitlementsCol.find({ purchaseId: { $in: purchaseIds } }).toArray()
      : Promise.resolve([]),
    purchaseIds.length > 0
      ? evidenceCol.find({ purchaseId: { $in: purchaseIds } }).toArray()
      : Promise.resolve([]),
  ]);

  const userById = new Map(users.map((u) => [u._id.toString(), u]));
  const entByPurchaseId = new Map(
    entitlements
      .filter((e) => Boolean(e.purchaseId))
      .map((e) => [e.purchaseId!.toString(), e])
  );
  const evByPurchaseId = new Map(
    evidences.map((ev) => [ev.purchaseId.toString(), ev])
  );

  const items = rawPurchases.map((p) => {
    const u = userById.get(p.userId.toString());
    const ent = entByPurchaseId.get(p._id.toString());
    const ev = evByPurchaseId.get(p._id.toString());
    const req: PurchaseRefundRequest = p.refundRequest || {
      requestId: `legacy_ref_${p._id.toString().slice(-8)}`,
      purchaseId: p._id,
      userId: p.userId,
      amountSubunits: p.pricingSnapshot.totalSubunits,
      currency: p.currency,
      reason: "Completed refund record",
      status: p.status === "refunded" ? "completed" : "pending_review",
      requestedAt: p.refundedAt || p.updatedAt,
      purchaseCapturedAt: p.capturedAt || p.createdAt,
      guaranteeDeadlineAt: new Date(
        (p.capturedAt || p.createdAt).getTime() + 72 * 60 * 60 * 1000
      ),
      isWithin72hGuarantee: true,
      isExceptionalOverride: false,
      reviewedByAdminId: null,
      reviewedByAdminEmail: null,
      reviewedAt: p.refundedAt,
      decisionReason: null,
      providerRefundId: null,
      updatedAt: p.updatedAt,
    };

    return {
      requestId: req.requestId,
      purchaseId: p._id.toString(),
      userId: p.userId.toString(),
      userEmail: u?.email || ev?.emailSnapshot || "Unknown customer",
      productSlug: p.productSlug,
      amountSubunits: req.amountSubunits,
      currency: req.currency,
      reason: req.reason,
      status: req.status,
      purchaseStatus: p.status,
      requestedAt: new Date(req.requestedAt).toISOString(),
      purchaseCapturedAt: new Date(req.purchaseCapturedAt).toISOString(),
      guaranteeDeadlineAt: new Date(req.guaranteeDeadlineAt).toISOString(),
      isWithin72hGuarantee: req.isWithin72hGuarantee,
      isExceptionalOverride: req.isExceptionalOverride,
      reviewedByAdminEmail: req.reviewedByAdminEmail,
      reviewedAt: req.reviewedAt
        ? new Date(req.reviewedAt).toISOString()
        : null,
      decisionReason: req.decisionReason,
      entitlementStatus: ent?.status || null,
      entitlementRestrictions: ent?.activeRestrictionReasons || [],
      evidenceSummary: ev
        ? {
            paymentMethodSummary: ev.paymentMethodSummary,
            refundPolicyVersionAccepted: ev.refundPolicyVersionAccepted,
            extensionActivatedAt: ev.extensionActivatedAt
              ? ev.extensionActivatedAt.toISOString()
              : null,
          }
        : null,
    };
  });

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

// ---------------------------------------------------------------------------
// 6. Disputes & Chargebacks Query (`/admin/disputes`)
// ---------------------------------------------------------------------------

export async function listAdminDisputes(
  db: Db,
  params: {
    page?: number;
    limit?: number;
    q?: string;
    status?: string;
    currency?: string;
  }
) {
  const { page, limit, skip } = clampPagination(params.page, params.limit);
  const purchasesCol = await getPurchasesCollection(db);
  const usersCol = await getUsersCollection(db);
  const entitlementsCol = await getEntitlementsCollection(db);
  const commissionsCol = await getCommissionsCollection(db);
  const evidenceCol = await getPurchaseEvidenceCollection(db);

  const filter: Filter<PurchaseDocument> = {
    $or: [
      { disputeRecord: { $ne: null } },
      { status: { $in: ["disputed", "chargeback_lost"] } },
    ],
  };

  if (params.currency && params.currency !== "all") {
    filter.currency = params.currency as SupportedCurrency;
  }
  if (params.status && params.status !== "all") {
    filter["disputeRecord.status"] = params.status;
  }

  const q = params.q?.trim() || "";
  if (q) {
    if (/^[a-fA-F0-9]{24}$/.test(q)) {
      filter._id = new ObjectId(q);
    } else {
      const safeRegex = new RegExp(escapeRegex(q), "i");
      const matchingUsers = await usersCol
        .find({ email: safeRegex })
        .limit(50)
        .toArray();
      const matchingUserIds = matchingUsers.map((u) => u._id);
      filter.$and = [
        ...(filter.$and || []),
        {
          $or: [
            ...(matchingUserIds.length > 0
              ? [{ userId: { $in: matchingUserIds } }]
              : []),
            { "disputeRecord.disputeId": safeRegex },
            { "disputeRecord.reasonCode": safeRegex },
          ],
        },
      ];
    }
  }

  const [total, rawPurchases] = await Promise.all([
    purchasesCol.countDocuments(filter),
    purchasesCol
      .find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
  ]);

  const userIds = Array.from(
    new Set(rawPurchases.map((p) => p.userId.toString()))
  ).map((id) => new ObjectId(id));
  const purchaseIds = rawPurchases.map((p) => p._id);

  const [users, entitlements, commissions, evidences] = await Promise.all([
    userIds.length > 0
      ? usersCol.find({ _id: { $in: userIds } }).toArray()
      : Promise.resolve([]),
    purchaseIds.length > 0
      ? entitlementsCol.find({ purchaseId: { $in: purchaseIds } }).toArray()
      : Promise.resolve([]),
    purchaseIds.length > 0
      ? commissionsCol.find({ purchaseId: { $in: purchaseIds } }).toArray()
      : Promise.resolve([]),
    purchaseIds.length > 0
      ? evidenceCol.find({ purchaseId: { $in: purchaseIds } }).toArray()
      : Promise.resolve([]),
  ]);

  const userById = new Map(users.map((u) => [u._id.toString(), u]));
  const entByPurchaseId = new Map(
    entitlements
      .filter((e) => Boolean(e.purchaseId))
      .map((e) => [e.purchaseId!.toString(), e])
  );
  const commByPurchaseId = new Map(
    commissions.map((c) => [c.purchaseId.toString(), c])
  );
  const evByPurchaseId = new Map(
    evidences.map((ev) => [ev.purchaseId.toString(), ev])
  );

  const items = rawPurchases.map((p) => {
    const u = userById.get(p.userId.toString());
    const ent = entByPurchaseId.get(p._id.toString());
    const comm = commByPurchaseId.get(p._id.toString());
    const ev = evByPurchaseId.get(p._id.toString());
    const disp: PurchaseDisputeRecord = p.disputeRecord || {
      disputeId: `disp_${p._id.toString().slice(-8)}`,
      purchaseId: p._id,
      userId: p.userId,
      disputedAmountSubunits: p.pricingSnapshot.totalSubunits,
      currency: p.currency,
      status: p.status === "chargeback_lost" ? "lost" : "open",
      reasonCode: "chargeback_inquiry",
      openedAt: p.disputedAt || p.updatedAt,
      evidenceDeadlineAt: null,
      resolvedAt: p.status === "chargeback_lost" ? p.updatedAt : null,
      outcomeReason: null,
      adminNotes: null,
      referrerNotifiedAt: null,
      updatedByAdminId: null,
      updatedByAdminEmail: null,
      updatedAt: p.updatedAt,
    };

    return {
      disputeId: disp.disputeId,
      purchaseId: p._id.toString(),
      userId: p.userId.toString(),
      userEmail: u?.email || ev?.emailSnapshot || "Unknown customer",
      disputedAmountSubunits: disp.disputedAmountSubunits,
      currency: disp.currency,
      status: disp.status,
      purchaseStatus: p.status,
      reasonCode: disp.reasonCode,
      openedAt: new Date(disp.openedAt).toISOString(),
      evidenceDeadlineAt: disp.evidenceDeadlineAt
        ? new Date(disp.evidenceDeadlineAt).toISOString()
        : null,
      resolvedAt: disp.resolvedAt
        ? new Date(disp.resolvedAt).toISOString()
        : null,
      outcomeReason: disp.outcomeReason,
      adminNotes: disp.adminNotes,
      entitlementStatus: ent?.status || null,
      entitlementRestrictions: ent?.activeRestrictionReasons || [],
      commissionImpact: comm
        ? {
            commissionId: comm._id.toString(),
            status: comm.status,
            isDisputedHold: comm.isDisputedHold,
            amountSubunits: comm.commissionAmountSubunits,
            currency: comm.currency,
          }
        : null,
      evidence: ev
        ? {
            paymentMethodSummary: ev.paymentMethodSummary,
            termsVersionAccepted: ev.termsVersionAccepted,
            refundPolicyVersionAccepted: ev.refundPolicyVersionAccepted,
            acceptedAt: ev.acceptedAt.toISOString(),
            extensionActivatedAt: ev.extensionActivatedAt
              ? ev.extensionActivatedAt.toISOString()
              : null,
          }
        : null,
    };
  });

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

// ---------------------------------------------------------------------------
// 7. Promotions Management Query (`/admin/promotions`)
// ---------------------------------------------------------------------------

export async function getPromotionsAdminData(db: Db) {
  const promoCol = await getPromotionSettingsCollection(db);
  const existing = await promoCol.findOne({ _id: "global_referral_promo" });

  const settings: PromotionSettingsDocument = existing || {
    _id: "global_referral_promo",
    mode: "normal",
    promotionalDiscountPercent: 0,
    referralCustomerDiscountPercent: REFERRAL_CUSTOMER_DISCOUNT_PERCENT,
    referrerCommissionPercent: REFERRAL_COMMISSION_PERCENT,
    maxSuccessfulReferralsPerUser: MAX_SUCCESSFUL_REFERRALS_PER_USER,
    holdWindowHours: COMMISSION_HOLD_WINDOW_HOURS,
    minEligibleCommissionsForPayout: MIN_ELIGIBLE_COMMISSIONS_FOR_PAYOUT,
    activeCampaignId: null,
    campaigns: [],
    updatedByAdminId: null,
    updatedAt: new Date(),
    createdAt: new Date(),
  };

  const now = new Date();
  const campaigns: Array<
    Omit<PromotionCampaignRecord, "startsAt" | "endsAt" | "createdAt" | "updatedAt" | "createdByAdminId" | "updatedByAdminId"> & {
      startsAt: string;
      endsAt: string;
      createdAt: string;
      updatedAt: string;
      isExpired: boolean;
    }
  > = (settings.campaigns || []).map((c) => {
    const endsAtDate = c.endsAt instanceof Date ? c.endsAt : new Date(c.endsAt);
    const isExpired = endsAtDate.getTime() <= now.getTime();
    return {
      campaignId: c.campaignId,
      name: c.name,
      code: c.code,
      discountPercent: c.discountPercent,
      status: isExpired && c.status !== "inactive" ? "expired" : c.status,
      startsAt: (c.startsAt instanceof Date ? c.startsAt : new Date(c.startsAt)).toISOString(),
      endsAt: endsAtDate.toISOString(),
      createdByAdminEmail: c.createdByAdminEmail,
      updatedByAdminEmail: c.updatedByAdminEmail,
      createdAt: (c.createdAt instanceof Date ? c.createdAt : new Date(c.createdAt)).toISOString(),
      updatedAt: (c.updatedAt instanceof Date ? c.updatedAt : new Date(c.updatedAt)).toISOString(),
      isExpired,
    };
  });

  return {
    mode: settings.mode,
    promotionalDiscountPercent: settings.promotionalDiscountPercent,
    activeCampaignId: settings.activeCampaignId ?? null,
    allowedDiscountPercents: Array.from(ALLOWED_PROMOTIONAL_DISCOUNT_PERCENTS),
    referralCustomerDiscountPercent: settings.referralCustomerDiscountPercent,
    referrerCommissionPercent: settings.referrerCommissionPercent,
    updatedAt: settings.updatedAt.toISOString(),
    campaigns,
  };
}

// ---------------------------------------------------------------------------
// 8. Referral Management Query (`/admin/referrals`)
// ---------------------------------------------------------------------------

export async function listAdminReferrals(
  db: Db,
  params: {
    page?: number;
    limit?: number;
    q?: string;
    status?: string;
    riskFilter?: string;
  }
) {
  const { page, limit, skip } = clampPagination(params.page, params.limit);
  const referralProfilesCol = await getReferralProfilesCollection(db);
  const usersCol = await getUsersCollection(db);
  const commissionsCol = await getCommissionsCollection(db);

  const filter: Filter<ReferralProfileDocument> = {};
  if (params.status && params.status !== "all") {
    filter.status = params.status as ReferralProfileDocument["status"];
  }
  if (params.riskFilter === "flagged") {
    filter.riskReviewRequired = true;
  } else if (params.riskFilter === "normal") {
    filter.riskReviewRequired = { $ne: true };
  }

  const q = params.q?.trim() || "";
  if (q) {
    if (/^[a-fA-F0-9]{24}$/.test(q)) {
      const objId = new ObjectId(q);
      filter.$or = [{ _id: objId }, { userId: objId }];
    } else {
      const safeRegex = new RegExp(escapeRegex(q), "i");
      const matchingUsers = await usersCol
        .find({ email: safeRegex })
        .limit(50)
        .toArray();
      const matchingUserIds = matchingUsers.map((u) => u._id);
      filter.$or = [
        ...(matchingUserIds.length > 0
          ? [{ userId: { $in: matchingUserIds } }]
          : []),
        { referralCode: safeRegex },
      ];
    }
  }

  const [total, rawProfiles] = await Promise.all([
    referralProfilesCol.countDocuments(filter),
    referralProfilesCol
      .find(filter)
      .sort({ successfulConversionsCount: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
  ]);

  const referrerUserIds = rawProfiles.map((rp) => rp.userId);
  const [users, commissions] = await Promise.all([
    referrerUserIds.length > 0
      ? usersCol.find({ _id: { $in: referrerUserIds } }).toArray()
      : Promise.resolve([]),
    referrerUserIds.length > 0
      ? commissionsCol
          .find({ referrerUserId: { $in: referrerUserIds } })
          .limit(500)
          .toArray()
      : Promise.resolve([]),
  ]);

  const userById = new Map(users.map((u) => [u._id.toString(), u]));
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.lingopdf.in";

  const items = rawProfiles.map((rp) => {
    const u = userById.get(rp.userId.toString());
    const rpComms = commissions.filter((c) =>
      c.referrerUserId.equals(rp.userId)
    );

    const eligibleByCurrency = emptyCurrencyTotals();
    const pendingByCurrency = emptyCurrencyTotals();
    const heldByCurrency = emptyCurrencyTotals();

    for (const c of rpComms) {
      if (c.isDisputedHold) {
        heldByCurrency[c.currency] += c.commissionAmountSubunits;
      } else if (c.status === "eligible" || c.status === "approved") {
        eligibleByCurrency[c.currency] += c.commissionAmountSubunits;
      } else if (c.status === "pending") {
        pendingByCurrency[c.currency] += c.commissionAmountSubunits;
      }
    }

    const remainingCapacity = Math.max(
      0,
      rp.maxReferralsCap -
        rp.successfulConversionsCount -
        rp.pendingReservedCount
    );

    return {
      id: rp._id.toString(),
      userId: rp.userId.toString(),
      referrerEmail: u?.email || "Unknown user",
      referrerName: u?.name || null,
      referralCode: rp.referralCode,
      referralLink: `${appBaseUrl}/?ref=${encodeURIComponent(rp.referralCode)}`,
      status: rp.status,
      successfulConversionsCount: rp.successfulConversionsCount,
      pendingReservedCount: rp.pendingReservedCount,
      maxReferralsCap: rp.maxReferralsCap,
      remainingCapacity,
      payoutMethod: rp.payoutMethod,
      eligibleByCurrency,
      pendingByCurrency,
      heldByCurrency,
      riskReviewRequired: rp.riskReviewRequired ?? false,
      riskHoldReason: rp.riskHoldReason ?? null,
      suspensionReason: rp.suspensionReason ?? null,
      suspensionHistory: (rp.suspensionHistory || []).map((h) => ({
        action: h.action,
        reason: h.reason,
        actorEmail: h.actorEmail,
        createdAt: new Date(h.createdAt).toISOString(),
      })),
      createdAt: rp.createdAt.toISOString(),
    };
  });

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

// ---------------------------------------------------------------------------
// 9. Commission Ledger Query (`/admin/commissions`)
// ---------------------------------------------------------------------------

export async function listAdminCommissions(
  db: Db,
  params: {
    page?: number;
    limit?: number;
    q?: string;
    status?: string;
    currency?: string;
    referrerUserId?: string;
    dateFrom?: string;
    dateTo?: string;
  }
) {
  const { page, limit, skip } = clampPagination(params.page, params.limit);
  const commissionsCol = await getCommissionsCollection(db);
  const adjustmentsCol = await getCommissionAdjustmentsCollection(db);
  const usersCol = await getUsersCollection(db);

  const filter: Filter<CommissionDocument> = {};
  if (params.currency && params.currency !== "all") {
    filter.currency = params.currency as SupportedCurrency;
  }
  if (
    params.referrerUserId &&
    /^[a-fA-F0-9]{24}$/.test(params.referrerUserId)
  ) {
    filter.referrerUserId = new ObjectId(params.referrerUserId);
  }

  if (params.status && params.status !== "all") {
    if (params.status === "held") {
      filter.isDisputedHold = true;
    } else if (params.status === "included_in_payout") {
      filter.payoutId = { $ne: null };
    } else if (params.status === "adjusted") {
      const allAdjustments = await adjustmentsCol
        .find({})
        .limit(500)
        .toArray();
      const adjustedCommissionIds = allAdjustments.map((a) => a.commissionId);
      filter._id = { $in: adjustedCommissionIds };
    } else {
      filter.status = params.status as CommissionDocument["status"];
    }
  }

  if (params.dateFrom || params.dateTo) {
    const createdAtFilter: Record<string, Date> = {};
    if (params.dateFrom) {
      const d = new Date(params.dateFrom);
      if (!Number.isNaN(d.getTime())) createdAtFilter.$gte = d;
    }
    if (params.dateTo) {
      const d = new Date(params.dateTo);
      if (!Number.isNaN(d.getTime())) createdAtFilter.$lte = d;
    }
    if (Object.keys(createdAtFilter).length > 0) {
      filter.createdAt = createdAtFilter;
    }
  }

  const q = params.q?.trim() || "";
  if (q) {
    if (/^[a-fA-F0-9]{24}$/.test(q)) {
      const objId = new ObjectId(q);
      filter.$or = [
        { _id: objId },
        { purchaseId: objId },
        { referrerUserId: objId },
      ];
    } else {
      const safeRegex = new RegExp(escapeRegex(q), "i");
      const matchingUsers = await usersCol
        .find({ email: safeRegex })
        .limit(50)
        .toArray();
      const matchingUserIds = matchingUsers.map((u) => u._id);
      if (matchingUserIds.length > 0) {
        filter.referrerUserId = { $in: matchingUserIds };
      } else {
        filter._id = new ObjectId("000000000000000000000000");
      }
    }
  }

  const [total, rawCommissions, rawAdjustments] = await Promise.all([
    commissionsCol.countDocuments(filter),
    commissionsCol
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    adjustmentsCol.find({}).sort({ createdAt: -1 }).limit(100).toArray(),
  ]);

  const userIds = Array.from(
    new Set(
      rawCommissions.flatMap((c) => [
        c.referrerUserId.toString(),
        c.referredUserId.toString(),
      ])
    )
  ).map((id) => new ObjectId(id));

  const users =
    userIds.length > 0
      ? await usersCol.find({ _id: { $in: userIds } }).toArray()
      : [];
  const userById = new Map(users.map((u) => [u._id.toString(), u]));

  const adjustmentByCommissionId = new Map<
    string,
    CommissionAdjustmentDocument
  >();
  for (const adj of rawAdjustments) {
    adjustmentByCommissionId.set(adj.commissionId.toString(), adj);
  }

  const now = new Date();
  const items = rawCommissions.map((c) => {
    const referrer = userById.get(c.referrerUserId.toString());
    const referred = userById.get(c.referredUserId.toString());
    const adj = adjustmentByCommissionId.get(c._id.toString());
    const isHoldWindowElapsed = now.getTime() >= c.holdUntil.getTime();

    let holdReason: string | null = null;
    if (c.isDisputedHold) {
      holdReason = "Open dispute or pending refund hold";
    } else if (c.status === "pending" && !isHoldWindowElapsed) {
      holdReason = "Within mandatory 72-hour refund window";
    }

    return {
      id: c._id.toString(),
      referrerUserId: c.referrerUserId.toString(),
      referrerEmail: referrer?.email || "Unknown referrer",
      referredUserId: c.referredUserId.toString(),
      referredEmail: referred?.email || "Unknown buyer",
      purchaseId: c.purchaseId.toString(),
      currency: c.currency,
      netCollectedSubunits: c.netCollectedSubunits,
      commissionRatePercent: c.commissionRatePercent,
      commissionAmountSubunits: c.commissionAmountSubunits,
      status: c.status,
      isDisputedHold: c.isDisputedHold,
      holdReason,
      isHoldWindowElapsed,
      purchaseCapturedAt: c.purchaseCapturedAt.toISOString(),
      holdUntil: c.holdUntil.toISOString(),
      eligibleAt: c.eligibleAt ? c.eligibleAt.toISOString() : null,
      approvedAt: c.approvedAt ? c.approvedAt.toISOString() : null,
      payoutId: c.payoutId ? c.payoutId.toString() : null,
      paidAt: c.paidAt ? c.paidAt.toISOString() : null,
      cancellationReason: c.cancellationReason,
      adjustment: adj
        ? {
            id: adj._id.toString(),
            adjustmentAmountSubunits: adj.adjustmentAmountSubunits,
            reason: adj.reason,
            resolutionStatus: adj.resolutionStatus,
            notes: adj.notes,
            createdAt: adj.createdAt.toISOString(),
          }
        : null,
      createdAt: c.createdAt.toISOString(),
    };
  });

  return {
    items,
    adjustments: rawAdjustments.map((adj) => ({
      id: adj._id.toString(),
      commissionId: adj.commissionId.toString(),
      purchaseId: adj.purchaseId.toString(),
      payoutId: adj.payoutId.toString(),
      referrerUserId: adj.referrerUserId.toString(),
      currency: adj.currency,
      adjustmentAmountSubunits: adj.adjustmentAmountSubunits,
      reason: adj.reason,
      resolutionStatus: adj.resolutionStatus,
      notes: adj.notes,
      createdAt: adj.createdAt.toISOString(),
    })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

// ---------------------------------------------------------------------------
// 10. Payouts Management Query (`/admin/payouts`)
// ---------------------------------------------------------------------------

export async function listAdminPayouts(
  db: Db,
  params: {
    page?: number;
    limit?: number;
    q?: string;
    status?: string;
    currency?: string;
  }
) {
  const { page, limit, skip } = clampPagination(params.page, params.limit);
  const payoutsCol = await getPayoutsCollection(db);
  const commissionsCol = await getCommissionsCollection(db);
  const referralProfilesCol = await getReferralProfilesCollection(db);
  const usersCol = await getUsersCollection(db);

  const filter: Filter<PayoutDocument> = {};
  if (params.status && params.status !== "all") {
    filter.status = params.status as PayoutDocument["status"];
  }
  if (params.currency && params.currency !== "all") {
    filter.currency = params.currency as SupportedCurrency;
  }

  const q = params.q?.trim() || "";
  if (q) {
    if (/^[a-fA-F0-9]{24}$/.test(q)) {
      const objId = new ObjectId(q);
      filter.$or = [{ _id: objId }, { referrerUserId: objId }];
    } else {
      const safeRegex = new RegExp(escapeRegex(q), "i");
      const matchingUsers = await usersCol
        .find({ email: safeRegex })
        .limit(50)
        .toArray();
      const matchingUserIds = matchingUsers.map((u) => u._id);
      filter.$or = [
        ...(matchingUserIds.length > 0
          ? [{ referrerUserId: { $in: matchingUserIds } }]
          : []),
        { externalTransferReference: safeRegex },
      ];
    }
  }

  const [total, rawPayouts, allEligibleOrApprovedCommissions, allProfiles] =
    await Promise.all([
      payoutsCol.countDocuments(filter),
      payoutsCol
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      commissionsCol
        .find({
          status: { $in: ["eligible", "approved"] },
          isDisputedHold: false,
          payoutId: null,
        })
        .limit(500)
        .toArray(),
      referralProfilesCol.find({}).limit(200).toArray(),
    ]);

  const userIds = Array.from(
    new Set([
      ...rawPayouts.map((po) => po.referrerUserId.toString()),
      ...allProfiles.map((rp) => rp.userId.toString()),
    ])
  ).map((id) => new ObjectId(id));

  const users =
    userIds.length > 0
      ? await usersCol.find({ _id: { $in: userIds } }).toArray()
      : [];
  const userById = new Map(users.map((u) => [u._id.toString(), u]));

  const items = rawPayouts.map((po) => {
    const referrer = userById.get(po.referrerUserId.toString());
    return {
      id: po._id.toString(),
      referrerUserId: po.referrerUserId.toString(),
      referrerEmail: referrer?.email || "Unknown referrer",
      referralProfileId: po.referralProfileId.toString(),
      currency: po.currency,
      totalAmountSubunits: po.totalAmountSubunits,
      commissionCount: po.commissionIds.length,
      commissionIds: po.commissionIds.map((id) => id.toString()),
      status: po.status,
      payoutMethod: po.payoutMethod,
      initiationType: po.initiationType || "admin_first_payout",
      externalTransferReference: po.externalTransferReference,
      failureReason: po.failureReason,
      rejectionReason: po.rejectionReason ?? null,
      notes: po.notes,
      paidAt: po.paidAt ? po.paidAt.toISOString() : null,
      createdAt: po.createdAt.toISOString(),
    };
  });

  // Compute referrer payout readiness summary (5-commission cross-currency threshold)
  const referrerEligibilitySummary = allProfiles.map((rp) => {
    const refComms = allEligibleOrApprovedCommissions.filter((c) =>
      c.referrerUserId.equals(rp.userId)
    );
    const totalQualifyingAcrossCurrencies = refComms.length;
    const meetsFiveCommissionThreshold =
      totalQualifyingAcrossCurrencies >= MIN_ELIGIBLE_COMMISSIONS_FOR_PAYOUT;

    const batchesByCurrency = (["INR", "USD", "EUR"] as const).map((cur) => {
      const curComms = refComms.filter((c) => c.currency === cur);
      const approvedComms = curComms.filter((c) => c.status === "approved");
      return {
        currency: cur,
        qualifyingCount: curComms.length,
        approvedCount: approvedComms.length,
        approvedTotalSubunits: approvedComms.reduce(
          (sum, c) => sum + c.commissionAmountSubunits,
          0
        ),
        approvedCommissionIds: approvedComms.map((c) => c._id.toString()),
      };
    });

    const u = userById.get(rp.userId.toString());
    return {
      referrerUserId: rp.userId.toString(),
      referrerEmail: u?.email || "Unknown referrer",
      referralCode: rp.referralCode,
      payoutMethod: rp.payoutMethod,
      totalQualifyingAcrossCurrencies,
      meetsFiveCommissionThreshold,
      batchesByCurrency,
    };
  });

  return {
    items,
    referrerEligibilitySummary,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

// ---------------------------------------------------------------------------
// 11. Audit Log Viewer Query (`/admin/audit-logs`)
// ---------------------------------------------------------------------------

export async function listAdminAuditLogs(
  db: Db,
  params: {
    page?: number;
    limit?: number;
    q?: string;
    actorEmail?: string;
    actionFilter?: string;
    targetCollection?: string;
    outcome?: string;
    dateFrom?: string;
    dateTo?: string;
  }
) {
  const { page, limit, skip } = clampPagination(params.page, params.limit);
  const auditCol = await getProtectedAdminAuditLogsCollection(db);

  const filter: Filter<AdminAuditLogDocument> = {};
  if (params.actorEmail?.trim()) {
    filter.actorEmail = new RegExp(
      escapeRegex(params.actorEmail.trim()),
      "i"
    );
  }
  if (params.actionFilter?.trim()) {
    filter.action = new RegExp(escapeRegex(params.actionFilter.trim()), "i");
  }
  if (params.targetCollection && params.targetCollection !== "all") {
    filter.targetCollection = params.targetCollection;
  }
  if (params.outcome && params.outcome !== "all") {
    filter.outcome = params.outcome as AdminAuditLogDocument["outcome"];
  }
  if (params.dateFrom || params.dateTo) {
    const createdAtFilter: Record<string, Date> = {};
    if (params.dateFrom) {
      const d = new Date(params.dateFrom);
      if (!Number.isNaN(d.getTime())) createdAtFilter.$gte = d;
    }
    if (params.dateTo) {
      const d = new Date(params.dateTo);
      if (!Number.isNaN(d.getTime())) createdAtFilter.$lte = d;
    }
    if (Object.keys(createdAtFilter).length > 0) {
      filter.createdAt = createdAtFilter;
    }
  }

  const q = params.q?.trim() || "";
  if (q) {
    const safeRegex = new RegExp(escapeRegex(q), "i");
    filter.$or = [
      { action: safeRegex },
      { targetId: safeRegex },
      { correlationId: safeRegex },
      { reason: safeRegex },
      { actorEmail: safeRegex },
    ];
  }

  const [total, rawLogs] = await Promise.all([
    auditCol.countDocuments(filter),
    auditCol
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
  ]);

  return {
    items: rawLogs.map((a) => ({
      id: a._id.toString(),
      actorUserId: a.actorUserId ? a.actorUserId.toString() : "system_bootstrap",
      actorEmail: a.actorEmail,
      actorRole: a.actorRole,
      action: a.action,
      targetCollection: a.targetCollection,
      targetId: a.targetId,
      outcome: a.outcome,
      reason: a.reason,
      correlationId: a.correlationId,
      ipAddressHash: a.ipAddressHash,
      userAgent: a.userAgent,
      metadata: a.metadata,
      createdAt: a.createdAt.toISOString(),
    })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

// ---------------------------------------------------------------------------
// 12. System Settings & Operational Health Queries (`/admin/settings`, `/admin/system`)
// ---------------------------------------------------------------------------

export async function getAdminSettingsData(db: Db) {
  const promoCol = await getPromotionSettingsCollection(db);
  const existing = await promoCol.findOne({ _id: "global_referral_promo" });

  const defaultProductAvailability: Record<
    string,
    "available" | "coming_soon" | "maintenance"
  > = {};
  for (const prod of siteConfig.products) {
    defaultProductAvailability[prod.id] = prod.status;
  }

  return {
    fixedCommercialInvariants: {
      refundGuaranteeWindowHours: COMMISSION_HOLD_WINDOW_HOURS,
      commissionEligibilityHoldHours: COMMISSION_HOLD_WINDOW_HOURS,
      referralCustomerDiscountPercent: REFERRAL_CUSTOMER_DISCOUNT_PERCENT,
      referrerCommissionPercent: REFERRAL_COMMISSION_PERCENT,
      maxSuccessfulReferralsPerUser: MAX_SUCCESSFUL_REFERRALS_PER_USER,
      minEligibleCommissionsForPayout: MIN_ELIGIBLE_COMMISSIONS_FOR_PAYOUT,
      allowedPromotionPercentages: Array.from(
        ALLOWED_PROMOTIONAL_DISCOUNT_PERCENTS
      ),
      discountsNeverStack: true,
      oneActiveDevicePerPurchase: true,
    },
    promotionMode: existing?.mode ?? "normal",
    promotionalDiscountPercent: existing?.promotionalDiscountPercent ?? 0,
    affordabilityTargetInr: existing?.affordabilityTargetInr ?? 2000,
    affordabilityRules: (existing?.affordabilityRules ?? []).map((rule) => ({
      ...rule,
      updatedAt: rule.updatedAt ? rule.updatedAt.toISOString() : null,
    })),
    standardRegionalPricing: {
      india: {
        market: "India",
        countryCode: "IN",
        currency: "INR",
        formattedPrice: "₹1,299",
        amountSubunits: 129900,
      },
      unitedStates: {
        market: "United States",
        countryCode: "US",
        currency: "USD",
        formattedPrice: "$75",
        amountSubunits: 7500,
      },
      eurozone: {
        market: "Eurozone",
        countryCodesCount: 21,
        currency: "EUR",
        formattedPrice: "€75",
        amountSubunits: 7500,
      },
      standardInternational: {
        market: "Standard International",
        countryCode: "DEFAULT",
        currency: "USD",
        formattedPrice: "$75",
        amountSubunits: 7500,
      },
    },
    riskMonitoringConfig: existing?.riskMonitoringConfig ?? {
      maxPendingReservationsBeforeReview: null,
      maxDailyRedemptionsBeforeReview: null,
      requireManualReviewOnVelocityAlert: true,
    },
    productAvailability:
      existing?.productAvailability ?? defaultProductAvailability,
    updatedAt: existing?.updatedAt ? existing.updatedAt.toISOString() : null,
  };
}

export async function getAdminSystemHealthData(db: Db) {
  let dbConnected = false;
  let topologyReport = null;
  let indexVerification = {
    status: "Unknown" as "Operational" | "Degraded" | "Unknown",
    expectedCount: 44,
    observedNonDefaultCount: 0,
    collectionsChecked: 0,
  };
  let activeRateLimitBuckets = 0;

  try {
    topologyReport = await verifyDatabaseTopology(db);
    dbConnected = true;

    const collectionNames = Object.values(COLLECTION_NAMES);
    let nonDefaultIndexes = 0;
    for (const colName of collectionNames) {
      try {
        const indexes = await db.collection(colName).indexes();
        // Subtract the default `_id_` index per collection
        nonDefaultIndexes += Math.max(0, indexes.length - 1);
      } catch {
        // Collection may not exist yet if empty
      }
    }
    indexVerification = {
      status: nonDefaultIndexes >= 44 ? "Operational" : "Degraded",
      expectedCount: 44,
      observedNonDefaultCount: nonDefaultIndexes,
      collectionsChecked: collectionNames.length,
    };

    const rateLimitsCol = await getRateLimitsCollection(db);
    activeRateLimitBuckets = await rateLimitsCol.countDocuments({});
  } catch {
    dbConnected = false;
  }

  // Safely check environment configuration without ever exposing raw values or secrets
  const rawHmac = process.env.RATE_LIMIT_HMAC_SECRET?.trim() || "";
  const hmacValid =
    rawHmac.length >= MIN_HMAC_SECRET_LENGTH && new Set(rawHmac).size >= 8;

  const hasAppUrl = Boolean(process.env.NEXT_PUBLIC_APP_URL?.trim());
  const hasMongoUri = Boolean(process.env.MONGODB_URI?.trim());
  const hasResendKey = Boolean(process.env.RESEND_API_KEY?.trim());
  const hasEmailFrom = Boolean(process.env.EMAIL_FROM?.trim());
  const isEmailMock = process.env.EMAIL_MOCK === "true";
  const allowlist = getConfiguredAdminEmailAllowlist();

  return {
    checkedAt: new Date().toISOString(),
    database: {
      status: dbConnected ? "Operational" : "Degraded",
      databaseName: db.databaseName,
      topology: topologyReport,
      atlasTierNote:
        "MongoDB Atlas M0 Free-Tier Replica Set: Multi-document ACID transactions supported; automated cloud snapshots/PITR and fine-grained database-user RBAC require manual mongodump/application-level append-only enforcement.",
    },
    indexes: indexVerification,
    rateLimiting: {
      status: dbConnected && (hmacValid || process.env.NODE_ENV !== "production")
        ? "Operational"
        : "Degraded",
      hmacSecretConfigured: hmacValid ? "Configured" : "Not configured",
      activeBucketsCount: activeRateLimitBuckets,
      policiesCount: Object.keys(RATE_LIMIT_POLICIES).length,
    },
    emailProvider: {
      status: isEmailMock
        ? "Configured (Mock Mode)"
        : hasResendKey && hasEmailFrom
          ? "Configured"
          : "Not configured",
      provider: "Resend",
      healthNote:
        "Configuration verified without live outbound ping; domain delivery verified only on dispatch.",
    },
    paymentGateway: {
      status: "Not configured",
      provider: "Razorpay (Deferred to Stage 3C)",
      detail:
        "Live Razorpay order capture, refund execution, dispute webhook ingestion, and payout transfers are intentionally deferred until Stage 3C gateway integration.",
    },
    securityConfig: {
      appUrlConfigured: hasAppUrl ? "Configured" : "Not configured",
      mongoUriConfigured: hasMongoUri ? "Configured" : "Not configured",
      adminAllowlistStatus: allowlist
        ? `Configured (${allowlist.size} allowlisted admin email(s))`
        : "Optional (Using MongoDB role === 'admin' check)",
      cloudflareProxyTrust:
        process.env.TRUST_CLOUDFLARE_PROXY === "true"
          ? "Enabled"
          : "Disabled (Default safe mode)",
    },
    backgroundJobs: {
      status: "Configured (On-Demand / TTL)",
      detail:
        "Session and rate-limit cleanup run via MongoDB TTL indexes; commission eligibility transitions run deterministically via server-side verification.",
    },
  };
}
