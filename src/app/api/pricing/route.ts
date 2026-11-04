import { NextRequest, NextResponse } from "next/server";
import {
  detectCountryFromHeaders,
  resolveRegionCode,
  isSupportedRegionCode,
  isRegionSelectionAllowed,
  getPermittedRegionsForCountry,
  getAuthoritativePricing,
  resolveCentralPricing,
  REGION_COOKIE_NAME,
} from "@/lib/pricing/resolve";
import { getDb } from "@/lib/db/mongodb";
import { getPromotionSettingsCollection } from "@/lib/db/models";
import { enforceIpRateLimit } from "@/lib/auth/rateLimit";
import { enforceCsrfProtection } from "@/lib/security/csrf";
import { logger } from "@/lib/observability/logger";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
  Vary: "Cookie, x-vercel-ip-country, cf-ipcountry",
};

export async function GET(request: NextRequest) {
  const detectedCountry = detectCountryFromHeaders(request.headers);
  const cookieRegion = request.cookies.get(REGION_COOKIE_NAME)?.value || null;
  const effectiveRegion = resolveRegionCode(detectedCountry, cookieRegion);

  let affordabilityRules = null;
  try {
    const db = await getDb();
    const promoCol = await getPromotionSettingsCollection(db);
    const settings = await promoCol.findOne({ _id: "global_referral_promo" });
    if (settings?.affordabilityRules) {
      affordabilityRules = settings.affordabilityRules;
    }
  } catch {
    // Graceful fallback if database connection is unavailable
  }

  const centralPricing = resolveCentralPricing({
    countryCode: detectedCountry,
    affordabilityRules,
  });

  const legacyPricing = {
    regionCode: effectiveRegion,
    countryName: centralPricing.countryName,
    currency: centralPricing.currency,
    currencySymbol: centralPricing.currencySymbol,
    symbolPosition: "prefix" as const,
    basePrice: centralPricing.basePrice,
    price: centralPricing.basePrice,
    isPromoActive: false,
    periodDescription: centralPricing.periodDescription,
    label: `${centralPricing.countryName} (${centralPricing.currencySymbol} ${centralPricing.currency})`,
  };

  const permittedRegions = getPermittedRegionsForCountry(detectedCountry);
  const availableRegions = permittedRegions.map((p) => ({
    regionCode: p.regionCode,
    countryName: p.countryName,
    currency: p.currency,
    currencySymbol: p.currencySymbol,
    price: p.price,
    basePrice: p.basePrice,
    label: p.label,
  }));

  return NextResponse.json(
    {
      detectedCountry,
      effectiveRegion,
      canSelectCurrency: centralPricing.isAffordability ? false : permittedRegions.length > 1,
      pricing: legacyPricing,
      centralPricing,
      availableRegions,
    },
    {
      status: 200,
      headers: NO_STORE_HEADERS,
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    // 1. CSRF / Origin validation
    const csrfBlocked = enforceCsrfProtection(request, "pricing.preference");
    if (csrfBlocked) {
      return csrfBlocked;
    }

    // 2. Persistent IP rate limiting (max 30 preference updates per 15 minutes per IP)
    const { blockedResponse } = await enforceIpRateLimit({
      request,
      policy: "pricingPreference",
      rateLimitExceededMessage:
        "Too many currency preference changes. Please try again later.",
    });
    if (blockedResponse) {
      return blockedResponse;
    }

    // 3. Parse JSON body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body", code: "INVALID_JSON" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const rawRegionCode =
      typeof body === "object" && body !== null && "regionCode" in body
        ? (body as { regionCode?: unknown }).regionCode
        : undefined;
    const rawCurrency =
      typeof body === "object" && body !== null && "currency" in body
        ? (body as { currency?: unknown }).currency
        : undefined;

    const currencyToRegionMap: Record<string, string> = {
      INR: "IN",
      USD: "US",
      EUR: "EU",
    };

    const regionCode =
      rawRegionCode !== undefined
        ? rawRegionCode
        : typeof rawCurrency === "string" && rawCurrency in currencyToRegionMap
          ? currencyToRegionMap[rawCurrency]
          : undefined;

    if (!isSupportedRegionCode(regionCode)) {
      return NextResponse.json(
        {
          error: "Invalid or unsupported region or currency code",
          code: "INVALID_REGION_CODE",
        },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    // 4. Authoritative regional restriction check
    const detectedCountry = detectCountryFromHeaders(request.headers);
    if (!isRegionSelectionAllowed(detectedCountry, regionCode)) {
      logger.security("pricing_unauthorized_region_selection_rejected", {
        detectedCountry,
        requestedRegion: regionCode,
      });
      return NextResponse.json(
        {
          error:
            detectedCountry === "IN"
              ? "Buyers located in India are billed exclusively in INR."
              : "INR pricing is restricted to buyers located in India. International buyers may select USD or EUR.",
          code: "REGION_NOT_PERMITTED",
        },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const authoritativePricing = getAuthoritativePricing(
      detectedCountry,
      regionCode
    );

    const response = NextResponse.json(
      {
        success: true,
        regionCode: authoritativePricing.regionCode,
        pricing: authoritativePricing,
      },
      { status: 200, headers: NO_STORE_HEADERS }
    );

    // Set preference cookie for 1 year
    const isProduction = process.env.NODE_ENV === "production";
    response.cookies.set({
      name: REGION_COOKIE_NAME,
      value: authoritativePricing.regionCode,
      httpOnly: false, // Accessible client-side for immediate state sync; never trusted without server geo check
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    logger.error("pricing_post_unexpected_error", { error });
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
