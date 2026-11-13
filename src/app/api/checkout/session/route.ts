import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db/mongodb";
import { validateSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { enforceIpRateLimit, enforceEmailRateLimit } from "@/lib/auth/rateLimit";
import { enforceCsrfProtection } from "@/lib/security/csrf";
import {
  COLLECTION_NAMES,
  PromotionSettingsDocument,
  PurchaseRegion,
  SupportedCurrency,
} from "@/lib/db/models";
import { buildPurchaseDocument } from "@/lib/db/repositories";
import {
  resolveCentralPricing,
  normalizeCountryCode,
  REGION_COOKIE_NAME,
} from "@/lib/pricing/resolve";
import {
  findActiveReferralProfileByCode,
  calculateReferralPurchasePricing,
  reserveReferralCapacityAtomically,
  releaseReferralReservation,
} from "@/lib/referrals/service";
import {
  getPaddleInstance,
  getPaddlePriceId,
  getPaddleProductId,
} from "@/lib/paddle/config";
import { logger } from "@/lib/observability/logger";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
};

export async function POST(request: NextRequest) {
  // 1. CSRF Protection
  const csrfBlocked = enforceCsrfProtection(request, "checkout.session");
  if (csrfBlocked) return csrfBlocked;

  // 2. IP Rate Limiting (20 attempts per 15 minutes)
  const { blockedResponse: ipBlocked } = await enforceIpRateLimit({
    request,
    policy: "checkoutSession",
    rateLimitExceededMessage:
      "Too many checkout session requests from this network. Please try again shortly.",
  });
  if (ipBlocked) return ipBlocked;

  let db;
  try {
    db = await getDb();
  } catch (err) {
    logger.error("checkout_session_db_unavailable", { error: err });
    return NextResponse.json(
      {
        error: "Database service unavailable. Please try again shortly.",
        code: "DB_UNAVAILABLE",
      },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }

  // 3. Authenticate customer from session cookie
  let sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    try {
      const cookieStore = await cookies();
      sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    } catch {
      // Standalone test fallback
    }
  }

  if (!sessionToken) {
    return NextResponse.json(
      {
        error: "Please sign in to proceed with checkout.",
        code: "UNAUTHORIZED",
      },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  const sessionResult = await validateSession(db, sessionToken);
  if (!sessionResult || !sessionResult.user) {
    return NextResponse.json(
      {
        error: "Your session has expired. Please sign in again.",
        code: "SESSION_EXPIRED",
      },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  const user = sessionResult.user;
  if (user.status !== "active") {
    return NextResponse.json(
      {
        error: "Your account is not active.",
        code: "ACCOUNT_SUSPENDED",
      },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  // 4. Per-account rate limiting
  const emailBlocked = await enforceEmailRateLimit({
    policy: "checkoutSession",
    email: user.email,
    rateLimitExceededMessage:
      "Too many checkout attempts on this account. Please wait before trying again.",
  });
  if (emailBlocked) return emailBlocked;

  // 5. Check if user already holds an active or suspended licence
  const entitlementsCollection = db.collection(COLLECTION_NAMES.entitlements);
  const existingEntitlement = await entitlementsCollection.findOne({
    userId: user._id,
    productSlug: "german",
    status: { $in: ["active", "suspended"] },
  });

  if (existingEntitlement) {
    return NextResponse.json(
      {
        error:
          "Your account already holds an active German → English licence. Each account is limited to one active licence per edition.",
        code: "ALREADY_ENTITLED",
      },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  // 6. Parse request body
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    // Empty body is acceptable
  }

  const rawReferralCode =
    typeof body?.referralCode === "string" ? body.referralCode : null;
  const requestedRegion =
    typeof body?.region === "string" ? body.region : null;

  // 7. Resolve country and regional pricing
  const headerCountry =
    request.headers.get("x-vercel-ip-country") ||
    request.headers.get("cf-ipcountry");
  const cookieRegion = request.cookies.get(REGION_COOKIE_NAME)?.value;

  // Determine effective detected country
  let effectiveCountry = normalizeCountryCode(headerCountry);
  if (!effectiveCountry && requestedRegion) {
    effectiveCountry = normalizeCountryCode(requestedRegion);
  }
  if (!effectiveCountry && cookieRegion) {
    effectiveCountry = normalizeCountryCode(cookieRegion);
  }

  // Fetch promotion settings for affordability / campaign
  const promoSettingsDoc =
    await db
      .collection<PromotionSettingsDocument>(COLLECTION_NAMES.promotionSettings)
      .findOne({ _id: "global_referral_promo" });

  const centralPricing = resolveCentralPricing({
    countryCode: effectiveCountry,
    affordabilityRules: promoSettingsDoc?.affordabilityRules ?? null,
  });

  // Strict Regional Pricing & Paddle Catalogue Alignment
  // The Paddle Sandbox catalogue (pri_01m78d26fhwp2ggq8fy9w7srvp) supports:
  // - India (IN): INR 1,299
  // - Eurozone (EU, 21 member states): EUR 75
  // - US & International fallback: USD 75
  // Until affordability catalogue price overrides exist in Paddle, any affordability tier
  // must explicitly and safely fall back to the standard international USD 75 price.
  // Never silently charge an unsupported local currency or arbitrary amount.
  let resolvedRegion: PurchaseRegion = "US";
  let resolvedCurrency: SupportedCurrency = "USD";
  let basePriceSubunits = 7500;

  if (centralPricing.pricingTier === "india" || effectiveCountry === "IN") {
    resolvedRegion = "IN";
    resolvedCurrency = "INR";
    basePriceSubunits = 129900;
  } else if (centralPricing.pricingTier === "eurozone") {
    resolvedRegion = "EU";
    resolvedCurrency = "EUR";
    basePriceSubunits = 7500;
  } else {
    // US or International fallback
    if (requestedRegion === "EU" && effectiveCountry !== "IN") {
      resolvedRegion = "EU";
      resolvedCurrency = "EUR";
      basePriceSubunits = 7500;
    } else {
      resolvedRegion = "US";
      resolvedCurrency = "USD";
      basePriceSubunits = 7500;
    }

    if (centralPricing.isAffordability) {
      logger.info("checkout_affordability_usd_fallback_enforced", {
        country: effectiveCountry,
        originalTier: centralPricing.pricingTier,
        fallbackCurrency: "USD",
        fallbackAmountSubunits: 7500,
      });
    }
  }

  // 8. Commercial Policy: Referral vs Promotional Discount (Mutually Exclusive)
  let referralProfile: Awaited<ReturnType<typeof findActiveReferralProfileByCode>> = null;
  let referralCodeApplied: string | null = null;
  let isReferralValid = false;

  if (rawReferralCode && rawReferralCode.trim()) {
    const normalized = rawReferralCode.trim().toUpperCase();
    const profile = await findActiveReferralProfileByCode(db, normalized);
    // Enforce no self-referral
    if (profile && !profile.userId.equals(user._id)) {
      referralProfile = profile;
      referralCodeApplied = profile.referralCode;
      isReferralValid = true;
    }
  }

  // Promotional campaign check (only if referral is not applied)
  let promoApplied = false;
  let promoDiscountPercent: 5 | 10 | 15 | 20 | undefined = undefined;

  if (!isReferralValid && promoSettingsDoc && promoSettingsDoc.mode === "promo") {
    const configuredPct = promoSettingsDoc.promotionalDiscountPercent;
    if (
      configuredPct === 5 ||
      configuredPct === 10 ||
      configuredPct === 15 ||
      configuredPct === 20
    ) {
      promoApplied = true;
      promoDiscountPercent = configuredPct;
    }
  }

  // Compute pricing snapshot using canonical helper
  const pricingCalculation = calculateReferralPurchasePricing({
    basePriceSubunits,
    taxSubunits: 0,
    referralProfile: isReferralValid ? referralProfile : null,
    promoApplied,
    promoDiscountPercent,
  });

  const purchaseId = new ObjectId();

  // 9. Atomic Referral Capacity Reservation
  let capacityReserved = false;
  if (isReferralValid && referralProfile) {
    const reserveResult = await reserveReferralCapacityAtomically(db, {
      referrerUserId: referralProfile.userId,
      referralCode: referralProfile.referralCode,
      purchaserUserId: user._id,
      purchaseId,
    });

    if (!reserveResult.ok) {
      logger.warn("checkout_referral_capacity_exhausted", {
        referralCode: referralProfile.referralCode,
        reason: reserveResult.reason,
      });
      // Fallback: continue without referral discount if capacity exhausted
      isReferralValid = false;
      referralProfile = null;
      referralCodeApplied = null;
    } else {
      capacityReserved = true;
    }
  }

  // 10. Create Pending Purchase Document
  const idempotencyKey = `chk_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
  const now = new Date();

  let purchaseDoc;
  try {
    purchaseDoc = buildPurchaseDocument(
      {
        userId: user._id,
        productSlug: "german",
        editionVersion: "1.0",
        region: resolvedRegion,
        currency: resolvedCurrency,
        pricingSnapshot: {
          basePriceSubunits: pricingCalculation.basePriceSubunits,
          discountPercentApplied: pricingCalculation.discountPercentApplied,
          discountSubunits: pricingCalculation.discountSubunits,
          taxSubunits: 0,
          totalSubunits: pricingCalculation.totalSubunits,
          promoApplied: pricingCalculation.promoApplied,
          referralCodeApplied: isReferralValid ? referralCodeApplied : null,
        },
        paymentProvider: "paddle",
        providerOrderId: null,
        providerPaymentId: null,
        idempotencyKey,
        status: "pending",
        referrerUserId: isReferralValid && referralProfile ? referralProfile.userId : null,
        referralProfileId: isReferralValid && referralProfile ? referralProfile._id : null,
        paddleTransactionId: null,
        paddleCustomerId: null,
        paddleCheckoutUrl: null,
      },
      now
    );

    purchaseDoc._id = purchaseId;

    await db.collection(COLLECTION_NAMES.purchases).insertOne(purchaseDoc);
  } catch (dbErr) {
    if (capacityReserved && referralProfile) {
      await releaseReferralReservation(db, {
        referrerUserId: referralProfile.userId,
      }).catch(() => {});
    }
    logger.error("checkout_purchase_insert_failed", { error: dbErr });
    return NextResponse.json(
      { error: "Failed to initialize purchase session.", code: "PURCHASE_INIT_FAILED" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  // 11. Create Paddle Sandbox Transaction
  const priceId = getPaddlePriceId();
  const productId = getPaddleProductId();
  const paddle = getPaddleInstance();

  const discountPercent = pricingCalculation.discountPercentApplied;
  let inlineDiscount = undefined;
  if (discountPercent > 0) {
    const desc = isReferralValid && referralCodeApplied
      ? `10% Referral Discount (${referralCodeApplied})`
      : `${discountPercent}% Promotional Discount`;

    inlineDiscount = {
      type: "percentage" as const,
      amount: String(discountPercent),
      description: desc,
    };
  }

  let transaction;
  try {
    transaction = await paddle.transactions.create({
      items: [{ priceId, quantity: 1 }],
      customData: {
        purchaseId: purchaseDoc._id.toString(),
        userId: user._id.toString(),
        customerEmail: user.email,
        productId,
        productSlug: "german",
      },
      ...(inlineDiscount ? { discount: inlineDiscount } : {}),
    });

    // Update purchase document with transaction details
    await db.collection(COLLECTION_NAMES.purchases).updateOne(
      { _id: purchaseDoc._id },
      {
        $set: {
          providerOrderId: transaction.id,
          paddleTransactionId: transaction.id,
          paddleCheckoutUrl: transaction.checkout?.url || null,
          updatedAt: new Date(),
        },
      }
    );
  } catch (paddleErr: unknown) {
    const err = paddleErr as { code?: string; message?: string; detail?: string };
    logger.error("checkout_paddle_transaction_failed", {
      code: err.code,
      message: err.message,
      detail: err.detail,
    });

    // Release capacity reservation if Paddle call failed
    if (capacityReserved && referralProfile) {
      await releaseReferralReservation(db, {
        referrerUserId: referralProfile.userId,
      }).catch(() => {});
    }

    if (err.code === "transaction_default_checkout_url_not_set") {
      return NextResponse.json(
        {
          error:
            "Paddle Sandbox checkout requires a Default Payment Link configured in the Paddle Sandbox dashboard (Checkout > Checkout configuration > Default payment link).",
          code: "DEFAULT_CHECKOUT_URL_NOT_SET",
          detail: err.detail || err.message,
        },
        { status: 503, headers: NO_STORE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        error: "Unable to initiate payment with Paddle. Please try again.",
        code: "GATEWAY_ERROR",
        detail: err.message || "Paddle transaction creation failed",
      },
      { status: 502, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(
    {
      success: true,
      transactionId: transaction.id,
      purchaseId: purchaseDoc._id.toString(),
      currency: resolvedCurrency,
      amountSubunits: pricingCalculation.totalSubunits,
      checkoutUrl: transaction.checkout?.url || null,
      pricing: {
        basePriceSubunits,
        discountPercentApplied: discountPercent,
        discountSubunits: pricingCalculation.discountSubunits,
        totalSubunits: pricingCalculation.totalSubunits,
        currency: resolvedCurrency,
        referralCodeApplied: isReferralValid ? referralCodeApplied : null,
      },
    },
    { status: 200, headers: NO_STORE_HEADERS }
  );
}
