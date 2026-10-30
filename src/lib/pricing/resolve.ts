import {
  REGIONAL_PRICING,
  EUROZONE_COUNTRY_CODES,
  SupportedRegionCode,
  RegionalPricingConfig,
  DEFAULT_REGION_CODE,
} from "./config";

export const REGION_COOKIE_NAME = "lingopdf_region";

/**
 * Normalizes an arbitrary country code (ISO 3166-1 alpha-2) to a supported region code.
 */
export function mapCountryToRegionCode(countryCode?: string | null): SupportedRegionCode {
  if (!countryCode) return DEFAULT_REGION_CODE;

  const normalized = countryCode.trim().toUpperCase();

  if (normalized === "IN") return "IN";
  if (normalized === "US") return "US";
  if (EUROZONE_COUNTRY_CODES.has(normalized) || normalized === "EU") return "EU";

  return DEFAULT_REGION_CODE;
}

/**
 * Validates if a string is an explicitly supported region code.
 */
export function isSupportedRegionCode(code?: string | null): code is SupportedRegionCode {
  if (!code) return false;
  return code in REGIONAL_PRICING;
}

/**
 * Detects visitor country from trusted server-side request headers.
 * Never relies on browser locale alone to establish visitor's country.
 *
 * Supported edge proxy headers:
 * - x-lingopdf-region: explicit test/developer override header
 * - x-vercel-ip-country: Vercel Edge network geo header
 * - cf-ipcountry: Cloudflare CDN geo header
 * - cloudfront-viewer-country: AWS CloudFront edge header
 * - x-country-code: generic edge reverse proxy geo header
 */
export function detectCountryFromHeaders(headers: Headers): string | null {
  const customOverride = headers.get("x-lingopdf-region");
  if (customOverride) return customOverride.trim().toUpperCase();

  const vercelCountry = headers.get("x-vercel-ip-country");
  if (vercelCountry) return vercelCountry.trim().toUpperCase();

  const cloudflareCountry = headers.get("cf-ipcountry");
  if (cloudflareCountry && cloudflareCountry !== "XX" && cloudflareCountry !== "T1") {
    return cloudflareCountry.trim().toUpperCase();
  }

  const cloudfrontCountry = headers.get("cloudfront-viewer-country");
  if (cloudfrontCountry) return cloudfrontCountry.trim().toUpperCase();

  const genericCountry = headers.get("x-country-code");
  if (genericCountry) return genericCountry.trim().toUpperCase();

  return null;
}

/**
 * Resolves the effective region code for a request.
 * Priority:
 * 1. Manual user override stored in cookie (if valid supported region)
 * 2. Server-side country detection from edge headers
 * 3. Default fallback (DEFAULT / USD)
 */
export function resolveRegionCode(
  detectedCountry: string | null,
  manualCookieRegion: string | null
): SupportedRegionCode {
  // 1. Manual choice takes precedence if valid
  if (manualCookieRegion && isSupportedRegionCode(manualCookieRegion)) {
    return manualCookieRegion;
  }

  // 2. Server-side detected country
  if (detectedCountry) {
    return mapCountryToRegionCode(detectedCountry);
  }

  // 3. Fallback
  return DEFAULT_REGION_CODE;
}

/**
 * Authoritative Server-Side Pricing Lookup
 *
 * This function MUST be used by future checkout routes (Phase 7A) to establish the
 * authoritative charging amount and currency.
 *
 * Never trust client-submitted pricing amounts or client-side country signals.
 */
export function getAuthoritativePricing(regionCodeOrCountry: string): RegionalPricingConfig {
  let regionCode: SupportedRegionCode;

  if (isSupportedRegionCode(regionCodeOrCountry)) {
    regionCode = regionCodeOrCountry;
  } else {
    regionCode = mapCountryToRegionCode(regionCodeOrCountry);
  }

  return REGIONAL_PRICING[regionCode] || REGIONAL_PRICING[DEFAULT_REGION_CODE];
}
