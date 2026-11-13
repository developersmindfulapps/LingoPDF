import crypto from "node:crypto";
import { ClientSession, Db, Filter, MongoClient, ObjectId } from "mongodb";
import {
  COLLECTION_NAMES,
  EntitlementDocument,
  getEntitlementsCollection,
  getPromoCodesCollection,
  PromoCodeDocument,
  PromoCodeStatus,
  UserDocument,
} from "@/lib/db/models";
import {
  runInReplicaSetTransaction,
  verifyDatabaseTopology,
} from "@/lib/db/repositories";
import { recordAdminAuditLog } from "@/lib/audit/adminAudit";
import { AuthenticatedAdminContext } from "@/lib/auth/admin";
import { logger } from "@/lib/observability/logger";

const PROMO_CHARSET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // 32 chars, no 0, 1, I, O

/**
 * Generates a cryptographically secure random promotional code in the format:
 * LINGO-GIFT-XXXX-XXXX
 * Provides 40 bits of entropy (>1.09 trillion combinations).
 */
export function generateCryptographicPromoCode(): string {
  const bytes = crypto.randomBytes(8);
  let p1 = "";
  let p2 = "";
  for (let i = 0; i < 4; i++) {
    p1 += PROMO_CHARSET[bytes[i] % 32];
  }
  for (let i = 4; i < 8; i++) {
    p2 += PROMO_CHARSET[bytes[i] % 32];
  }
  return `LINGO-GIFT-${p1}-${p2}`;
}

/**
 * Normalizes user-submitted promo codes:
 * Trims whitespace, uppercases, replaces multiple spaces with single dash.
 */
export function normalizePromoCode(rawCode: string): string {
  if (!rawCode || typeof rawCode !== "string") return "";
  return rawCode.trim().toUpperCase().replace(/\s+/g, "-");
}

/**
 * Computes deterministic SHA-256 hex digest of the normalized promotional code.
 */
export function hashPromoCode(code: string): string {
  const normalized = normalizePromoCode(code);
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

/**
 * Produces a display-safe masked representation (e.g., LINGO-GIFT-••••-F3A9).
 * Preserves the prefix and suffix for administration while protecting the secret.
 */
export function maskPromoCode(code: string): string {
  const normalized = normalizePromoCode(code);
  const parts = normalized.split("-");
  if (parts.length >= 4) {
    return `${parts[0]}-${parts[1]}-••••-${parts[3]}`;
  }
  if (normalized.length > 8) {
    return `${normalized.slice(0, 6)}••••${normalized.slice(-4)}`;
  }
  return "LINGO-GIFT-••••";
}

export interface CreatePromoCodeInput {
  label?: string | null;
  expiresAt?: Date | string | null;
  discountPercent?: number; // Must be strictly 100
  productEdition?: string; // Must be strictly "german"
}

export interface CreatePromoCodeResult {
  promoCode: PromoCodeDocument;
  fullCode: string; // Plaintext code returned ONLY at creation time
}

/**
 * Admin action: Creates a 100% single-use complimentary promotional code.
 * Strictly enforces that discount is 100% and product edition is "german".
 */
export async function createPromotionalCode(
  db: Db,
  input: CreatePromoCodeInput,
  admin: AuthenticatedAdminContext
): Promise<CreatePromoCodeResult> {
  // 1. Invariant enforcement: discount must be strictly 100%
  if (input.discountPercent !== undefined && input.discountPercent !== 100) {
    throw new Error("Complimentary licence codes must have exactly 100% discount.");
  }

  // 2. Invariant enforcement: product edition must be German -> English ("german")
  if (input.productEdition !== undefined && input.productEdition !== "german") {
    throw new Error("Complimentary licence codes are currently restricted to the German edition.");
  }

  // 3. Validate expiration date if provided
  let expiresAt: Date | null = null;
  if (input.expiresAt) {
    const parsed = new Date(input.expiresAt);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error("Invalid expiration date format.");
    }
    if (parsed <= new Date()) {
      throw new Error("Expiration date must be in the future.");
    }
    expiresAt = parsed;
  }

  const label = input.label?.trim() || null;
  if (label && label.length > 100) {
    throw new Error("Internal label cannot exceed 100 characters.");
  }

  const promoCodes = await getPromoCodesCollection(db);

  // 4. Generate unique cryptographic code with collision retry
  let fullCode = "";
  let codeHash = "";
  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const candidate = generateCryptographicPromoCode();
    const candidateHash = hashPromoCode(candidate);
    const existing = await promoCodes.findOne({ codeHash: candidateHash });
    if (!existing) {
      fullCode = candidate;
      codeHash = candidateHash;
      break;
    }
  }

  if (!fullCode) {
    throw new Error("Failed to generate a unique promotional code. Please try again.");
  }

  const now = new Date();
  const codeMasked = maskPromoCode(fullCode);

  const doc: PromoCodeDocument = {
    _id: new ObjectId(),
    codeHash,
    codeMasked,
    codePrefix: "LINGO-GIFT",
    label,
    productEdition: "german",
    discountPercent: 100,
    maxRedemptions: 1,
    status: "active",
    createdBy: admin.userId,
    createdByEmail: admin.email,
    createdAt: now,
    expiresAt,
    redeemedBy: null,
    redeemedByEmail: null,
    redeemedAt: null,
    entitlementId: null,
    disabledAt: null,
    disabledBy: null,
    disableReason: null,
    updatedAt: now,
  };

  await promoCodes.insertOne(doc);

  // 5. Append-only Admin Audit Log
  await recordAdminAuditLog(db, {
    actor: {
      userId: admin.userId,
      email: admin.email,
      role: admin.role,
    },
    action: "promo_code.create",
    targetCollection: COLLECTION_NAMES.promoCodes,
    targetId: doc._id,
    outcome: "success",
    metadata: {
      promoCodeId: doc._id.toString(),
      codeMasked,
      label,
      productEdition: "german",
      discountPercent: 100,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
    },
  });

  logger.info("promo_code_created", {
    promoCodeId: doc._id.toString(),
    codeMasked,
    createdBy: admin.email,
  });

  return { promoCode: doc, fullCode };
}

/**
 * Admin action: Disables an unused promotional code.
 * Never allows disabling an already redeemed code or revoking granted entitlements through this action.
 */
export async function disablePromotionalCode(
  db: Db,
  promoCodeId: ObjectId,
  reason: string | null,
  admin: AuthenticatedAdminContext
): Promise<PromoCodeDocument> {
  const promoCodes = await getPromoCodesCollection(db);
  const codeDoc = await promoCodes.findOne({ _id: promoCodeId });

  if (!codeDoc) {
    throw new Error("Promotional code not found.");
  }

  if (codeDoc.status === "redeemed") {
    throw new Error("Cannot disable an already redeemed promotional code.");
  }

  if (codeDoc.status === "disabled") {
    return codeDoc;
  }

  const now = new Date();
  const cleanReason = reason?.trim() || null;

  await promoCodes.updateOne(
    { _id: promoCodeId },
    {
      $set: {
        status: "disabled",
        disabledAt: now,
        disabledBy: admin.userId,
        disableReason: cleanReason,
        updatedAt: now,
      },
    }
  );

  const updatedDoc = (await promoCodes.findOne({ _id: promoCodeId }))!;

  // Append-only Admin Audit Log
  await recordAdminAuditLog(db, {
    actor: {
      userId: admin.userId,
      email: admin.email,
      role: admin.role,
    },
    action: "promo_code.disable",
    targetCollection: COLLECTION_NAMES.promoCodes,
    targetId: promoCodeId,
    outcome: "success",
    reason: cleanReason,
    metadata: {
      promoCodeId: promoCodeId.toString(),
      codeMasked: codeDoc.codeMasked,
      previousStatus: codeDoc.status,
    },
  });

  logger.info("promo_code_disabled", {
    promoCodeId: promoCodeId.toString(),
    disabledBy: admin.email,
    reason: cleanReason,
  });

  return updatedDoc;
}

export interface ListPromoCodesParams {
  page?: number;
  limit?: number;
  status?: string;
  q?: string;
}

export interface PromoCodeItemSummary {
  id: string;
  codeMasked: string;
  label: string | null;
  productEdition: string;
  discountPercent: number;
  status: PromoCodeStatus;
  createdAt: string;
  expiresAt: string | null;
  redeemedByEmail: string | null;
  redeemedAt: string | null;
  entitlementId: string | null;
  disabledAt: string | null;
  disableReason: string | null;
  createdByEmail: string;
}

export interface ListPromoCodesResult {
  items: PromoCodeItemSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Lists promotional codes with filtering, searching, and pagination.
 */
export async function listPromotionalCodes(
  db: Db,
  params: ListPromoCodesParams = {}
): Promise<ListPromoCodesResult> {
  const promoCodes = await getPromoCodesCollection(db);
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 25));
  const skip = (page - 1) * limit;

  const filter: Filter<PromoCodeDocument> = {};
  const now = new Date();

  if (params.status && params.status !== "all") {
    if (params.status === "expired") {
      filter.$or = [
        { status: "expired" },
        { status: "active", expiresAt: { $ne: null, $lte: now } },
      ];
    } else if (params.status === "active") {
      filter.status = "active";
      filter.$and = [
        {
          $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
        },
      ];
    } else {
      filter.status = params.status as PromoCodeStatus;
    }
  }

  const q = params.q?.trim();
  if (q) {
    const safeRegex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [
      { label: safeRegex },
      { codeMasked: safeRegex },
      { redeemedByEmail: safeRegex },
      { createdByEmail: safeRegex },
    ];
  }

  const [total, rawItems] = await Promise.all([
    promoCodes.countDocuments(filter),
    promoCodes
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
  ]);

  const items: PromoCodeItemSummary[] = rawItems.map((doc) => {
    let effectiveStatus = doc.status;
    if (
      doc.status === "active" &&
      doc.expiresAt &&
      doc.expiresAt <= now
    ) {
      effectiveStatus = "expired";
    }

    return {
      id: doc._id.toString(),
      codeMasked: doc.codeMasked,
      label: doc.label,
      productEdition: doc.productEdition,
      discountPercent: doc.discountPercent,
      status: effectiveStatus,
      createdAt: doc.createdAt.toISOString(),
      expiresAt: doc.expiresAt ? doc.expiresAt.toISOString() : null,
      redeemedByEmail: doc.redeemedByEmail,
      redeemedAt: doc.redeemedAt ? doc.redeemedAt.toISOString() : null,
      entitlementId: doc.entitlementId ? doc.entitlementId.toString() : null,
      disabledAt: doc.disabledAt ? doc.disabledAt.toISOString() : null,
      disableReason: doc.disableReason,
      createdByEmail: doc.createdByEmail,
    };
  });

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

export interface PromoCodeStats {
  total: number;
  active: number;
  redeemed: number;
  disabled: number;
  expired: number;
}

/**
 * Aggregates summary counts of promotional codes.
 */
export async function getPromotionalCodeStats(db: Db): Promise<PromoCodeStats> {
  const promoCodes = await getPromoCodesCollection(db);
  const now = new Date();

  const [total, active, redeemed, disabled, expired] = await Promise.all([
    promoCodes.countDocuments({}),
    promoCodes.countDocuments({
      status: "active",
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    }),
    promoCodes.countDocuments({ status: "redeemed" }),
    promoCodes.countDocuments({ status: "disabled" }),
    promoCodes.countDocuments({
      $or: [
        { status: "expired" },
        { status: "active", expiresAt: { $ne: null, $lte: now } },
      ],
    }),
  ]);

  return { total, active, redeemed, disabled, expired };
}

export interface RedeemPromoCodeResult {
  success: boolean;
  message: string;
  code?: string;
  entitlementId?: string;
}

/**
 * Customer action: Atomically redeems a single-use 100% complimentary promotional code.
 *
 * Requirements enforced:
 * 1. Checks customer account status (active only).
 * 2. Checks customer does not already have an active/suspended entitlement for German edition.
 * 3. Atomically claims the code so concurrent attempts fail cleanly.
 * 4. Creates full edition EntitlementDocument (source: "complimentary_promo_code", maxActiveDevices: 1).
 * 5. Links entitlement to the promo code.
 * 6. Never creates fake payment/purchase records or referral commissions.
 * 7. Transaction rollback if entitlement grant fails.
 */
export async function redeemPromotionalCode(
  db: Db,
  client: MongoClient,
  params: {
    code: string;
    user: UserDocument;
  }
): Promise<RedeemPromoCodeResult> {
  const { code, user } = params;

  // 1. Customer account eligibility check
  if (user.status !== "active") {
    return {
      success: false,
      code: "ACCOUNT_SUSPENDED",
      message: "Your account is not eligible to redeem promotional codes.",
    };
  }

  // 2. Check for existing active or suspended entitlement for "german" edition
  const entitlements = await getEntitlementsCollection(db);
  const existingActive = await entitlements.findOne({
    userId: user._id,
    productSlug: "german",
    status: { $in: ["active", "suspended"] },
  });

  if (existingActive) {
    return {
      success: false,
      code: "ALREADY_ENTITLED",
      message:
        "Your account already has an active German → English edition licence. Each account may hold only one active licence per edition.",
    };
  }

  // 3. Compute code hash
  const normalized = normalizePromoCode(code);
  if (!normalized) {
    return {
      success: false,
      code: "INVALID_CODE",
      message: "Please enter a valid promotional code.",
    };
  }

  const codeHash = hashPromoCode(normalized);
  const promoCodes = await getPromoCodesCollection(db);
  const now = new Date();

  // 4. Verify database topology for multi-document transaction support
  let supportsTx = false;
  try {
    const topology = await verifyDatabaseTopology(db);
    supportsTx = topology.supportsTransactions;
  } catch {
    supportsTx = false;
  }

  const executeAtomicRedeem = async (session?: ClientSession): Promise<RedeemPromoCodeResult> => {
    const sessionOption = session ? { session } : {};

    // 4a. Atomically claim the promo code (CAS query on status: "active" and unexpired)
    const claimedCode = await promoCodes.findOneAndUpdate(
      {
        codeHash,
        status: "active",
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      },
      {
        $set: {
          status: "redeemed",
          redeemedBy: user._id,
          redeemedByEmail: user.email,
          redeemedAt: now,
          updatedAt: now,
        },
      },
      {
        returnDocument: "after",
        ...sessionOption,
      }
    );

    if (!claimedCode) {
      // Find out why claiming failed to return a helpful message
      const existingCode = await promoCodes.findOne({ codeHash }, sessionOption);
      if (!existingCode) {
        return {
          success: false,
          code: "INVALID_CODE",
          message: "Invalid promotional code. Please check your code and try again.",
        };
      }
      if (existingCode.status === "redeemed") {
        return {
          success: false,
          code: "ALREADY_REDEEMED",
          message: "This promotional code has already been redeemed and cannot be used again.",
        };
      }
      if (existingCode.status === "disabled") {
        return {
          success: false,
          code: "DISABLED_CODE",
          message: "This promotional code has been disabled by an administrator.",
        };
      }
      if (existingCode.expiresAt && existingCode.expiresAt <= now) {
        return {
          success: false,
          code: "EXPIRED_CODE",
          message: "This promotional code has expired.",
        };
      }
      return {
        success: false,
        code: "INVALID_CODE",
        message: "This promotional code is not valid for redemption.",
      };
    }

    // 4b. Create the full German -> English edition entitlement
    const entitlementId = new ObjectId();
    const entitlementDoc: EntitlementDocument = {
      _id: entitlementId,
      userId: user._id,
      purchaseId: null,
      productSlug: "german",
      status: "active",
      activeRestrictionReasons: [],
      revocationReason: null,
      maxActiveDevices: 1,
      activeInstallationIdHash: null,
      deviceBoundAt: null,
      lastValidatedAt: null,
      offlineLeaseExpiresAt: null,
      deviceReplacementCount: 0,
      suspendedAt: null,
      revokedAt: null,
      source: "complimentary_promo_code",
      promoCodeId: claimedCode._id,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await entitlements.insertOne(entitlementDoc, sessionOption);
    } catch (insertErr: unknown) {
      // In standalone mode without transactions, revert claimedCode on duplicate or insert error
      if (!session) {
        await promoCodes.updateOne(
          { _id: claimedCode._id },
          {
            $set: {
              status: "active",
              redeemedBy: null,
              redeemedByEmail: null,
              redeemedAt: null,
              updatedAt: new Date(),
            },
          }
        );
      }
      throw insertErr;
    }

    // 4c. Link the created entitlement to the promo code record
    await promoCodes.updateOne(
      { _id: claimedCode._id },
      { $set: { entitlementId } },
      sessionOption
    );

    logger.info("promo_code_redeemed_successfully", {
      promoCodeId: claimedCode._id.toString(),
      userId: user._id.toString(),
      entitlementId: entitlementId.toString(),
    });

    return {
      success: true,
      entitlementId: entitlementId.toString(),
      message:
        "Your complimentary German → English LingoPDF licence has been successfully granted.",
    };
  };

  try {
    if (supportsTx) {
      return await runInReplicaSetTransaction(client, db, executeAtomicRedeem);
    }
    return await executeAtomicRedeem();
  } catch (err: unknown) {
    logger.error("promo_code_redemption_error", { error: err });
    return {
      success: false,
      code: "REDEMPTION_FAILED",
      message:
        "An unexpected error occurred while redeeming your code. Please try again shortly.",
    };
  }
}
