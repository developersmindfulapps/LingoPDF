import { NextRequest, NextResponse } from "next/server";
import { REGIONAL_PRICING } from "@/lib/pricing/config";
import {
  detectCountryFromHeaders,
  resolveRegionCode,
  isSupportedRegionCode,
  getAuthoritativePricing,
  REGION_COOKIE_NAME,
} from "@/lib/pricing/resolve";

export async function GET(request: NextRequest) {
  const detectedCountry = detectCountryFromHeaders(request.headers);
  const cookieRegion = request.cookies.get(REGION_COOKIE_NAME)?.value || null;
  const effectiveRegion = resolveRegionCode(detectedCountry, cookieRegion);
  const pricing = getAuthoritativePricing(effectiveRegion);

  const availableRegions = Object.values(REGIONAL_PRICING).map((p) => ({
    regionCode: p.regionCode,
    countryName: p.countryName,
    currency: p.currency,
    currencySymbol: p.currencySymbol,
    price: p.price,
    label: p.label,
  }));

  return NextResponse.json({
    detectedCountry,
    effectiveRegion,
    pricing,
    availableRegions,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const regionCode = body?.regionCode;

    if (!isSupportedRegionCode(regionCode)) {
      return NextResponse.json(
        {
          error: "Invalid or unsupported region code",
          supported: Object.keys(REGIONAL_PRICING),
        },
        { status: 400 }
      );
    }

    const response = NextResponse.json({
      success: true,
      regionCode,
      pricing: getAuthoritativePricing(regionCode),
    });

    // Set preference cookie for 1 year
    const isProduction = process.env.NODE_ENV === "production";
    response.cookies.set({
      name: REGION_COOKIE_NAME,
      value: regionCode,
      httpOnly: false, // Accessible client-side for immediate state sync
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body" },
      { status: 400 }
    );
  }
}
