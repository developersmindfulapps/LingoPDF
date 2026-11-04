import {
  REGIONAL_PRICING,
  EUROZONE_COUNTRY_CODES,
  SupportedRegionCode,
  RegionalPricingConfig,
  DEFAULT_REGION_CODE,
} from "./config";
import type { AffordabilityCountryRule } from "@/lib/db/models";
import { getCountryInfo, GATEWAY_SUPPORTED_CURRENCIES } from "./countries";

export const REGION_COOKIE_NAME = "lingopdf_region";

const ISO_COUNTRY_CODE_REGEX = /^[A-Z]{2}$/;
const RESERVED_PSEUDO_COUNTRIES = new Set(["XX", "T1", "ZZ"]);

/**
 * Validates and normalizes an ISO 3166-1 alpha-2 country code.
 * Rejects malformed strings, longer identifiers, or reserved proxy pseudo-codes ("XX", "T1").
 */
export function normalizeCountryCode(rawCountry?: string | null): string | null {
  if (!rawCountry || typeof rawCountry !== "string") {
    return null;
  }

  const normalized = rawCountry.trim().toUpperCase();
  if (!ISO_COUNTRY_CODE_REGEX.test(normalized)) {
    return null;
  }

  if (RESERVED_PSEUDO_COUNTRIES.has(normalized)) {
    return null;
  }

  return normalized;
}

/**
 * Normalizes an arbitrary country code (ISO 3166-1 alpha-2) to a supported region code.
 */
export function mapCountryToRegionCode(countryCode?: string | null): SupportedRegionCode {
  const normalized = normalizeCountryCode(countryCode);
  if (!normalized) return DEFAULT_REGION_CODE;

  if (normalized === "IN") return "IN";
  if (normalized === "US") return "US";
  if (EUROZONE_COUNTRY_CODES.has(normalized) || normalized === "EU") return "EU";

  return DEFAULT_REGION_CODE;
}

/**
 * Validates if a string is an explicitly supported region code.
 */
export function isSupportedRegionCode(code?: unknown): code is SupportedRegionCode {
  if (typeof code !== "string" || !code) return false;
  return code in REGIONAL_PRICING;
}

/**
 * Checks whether a region code is permitted for an international (non-India) buyer.
 * International buyers may choose USD ("US" / "DEFAULT") or EUR ("EU"), but NEVER INR ("IN").
 */
export function isPermittedInternationalRegion(
  code?: unknown
): code is Exclude<SupportedRegionCode, "IN"> {
  return code === "US" || code === "EU" || code === "DEFAULT";
}

/**
 * Validates whether a user with the given server-detected country is allowed
 * to select the requested region code.
 *
 * Rules:
 * 1. India-detected users ("IN") must use "IN" (INR) and cannot switch to USD or EUR.
 * 2. International users (any non-"IN" country or null) may choose USD ("US"/"DEFAULT") or EUR ("EU"),
 *    and must NEVER be able to select "IN" (INR).
 */
export function isRegionSelectionAllowed(
  detectedCountry: string | null,
  requestedRegion: unknown
): requestedRegion is SupportedRegionCode {
  if (!isSupportedRegionCode(requestedRegion)) {
    return false;
  }

  const normalizedCountry = normalizeCountryCode(detectedCountry);

  if (normalizedCountry === "IN") {
    return requestedRegion === "IN";
  }

  return isPermittedInternationalRegion(requestedRegion);
}

/**
 * Returns the list of regional pricing configurations permitted for a visitor's detected country.
 * - For India ("IN"): only [REGIONAL_PRICING.IN] (INR is mandatory; no currency override dropdown).
 * - For International: USD and EUR options only; INR is never included.
 */
export function getPermittedRegionsForCountry(
  detectedCountry: string | null
): RegionalPricingConfig[] {
  const normalizedCountry = normalizeCountryCode(detectedCountry);

  if (normalizedCountry === "IN") {
    return [REGIONAL_PRICING.IN];
  }

  return [
    REGIONAL_PRICING.US,
    REGIONAL_PRICING.EU,
    REGIONAL_PRICING.DEFAULT,
  ];
}

/**
 * Detects visitor country strictly from trusted server-side deployment proxy headers.
 * Never relies on browser locale, client payloads, or untrusted forwarding headers.
 *
 * Trusted Header Precedence:
 * 1. `x-lingopdf-region`: Explicitly restricted to non-production development/test environments.
 *    Ignored unconditionally when `NODE_ENV === "production"` or `VERCEL_ENV === "production"`.
 * 2. `cf-ipcountry`: Evaluated BEFORE Vercel headers ONLY when `TRUST_CLOUDFLARE_PROXY === "true"`
 *    is explicitly configured (because an upstream Cloudflare proxy causes Vercel edge headers to reflect
 *    Cloudflare's egress PoP rather than the end user). Must only be enabled when origin access is locked
 *    exclusively to Cloudflare.
 * 3. `x-vercel-ip-country`: Authoritative country header injected by the Vercel Edge network, trusted
 *    ONLY when `process.env.VERCEL === "1"` confirms execution inside the Vercel runtime.
 *
 * Untrusted headers such as `x-country-code` or `cloudfront-viewer-country` are never trusted.
 */
export function detectCountryFromHeaders(headers: {
  get(name: string): string | null;
}): string | null {
  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production";

  if (!isProduction) {
    const devOverride = normalizeCountryCode(headers.get("x-lingopdf-region"));
    if (devOverride) {
      return devOverride;
    }
  }

  if (process.env.TRUST_CLOUDFLARE_PROXY === "true") {
    const cloudflareCountry = normalizeCountryCode(headers.get("cf-ipcountry"));
    if (cloudflareCountry) {
      return cloudflareCountry;
    }
  }

  if (process.env.VERCEL === "1") {
    const vercelCountry = normalizeCountryCode(headers.get("x-vercel-ip-country"));
    if (vercelCountry) {
      return vercelCountry;
    }
  }

  return null;
}

/**
 * Resolves the effective region code for a request under strict regional pricing enforcement.
 *
 * Enforcement Rules:
 * 1. If server-detected country is India ("IN"), the effective region is ALWAYS "IN" (INR).
 *    Cookies and manual preferences cannot override India's mandatory INR pricing.
 * 2. If server-detected country is NOT India, the effective region can NEVER be "IN" (INR).
 *    - A valid manual cookie preference for USD ("US" / "DEFAULT") or EUR ("EU") is honored.
 *    - Any manipulated cookie containing "IN" is ignored.
 *    - Otherwise, falls back to the country's mapped region ("US", "EU", or "DEFAULT").
 */
export function resolveRegionCode(
  detectedCountry: string | null,
  manualCookieRegion?: string | null
): SupportedRegionCode {
  const normalizedCountry = normalizeCountryCode(detectedCountry);

  // Rule 1: India-detected buyers always receive INR
  if (normalizedCountry === "IN") {
    return "IN";
  }

  // Rule 2 & 3: International buyers may choose USD or EUR, never INR
  if (manualCookieRegion && isPermittedInternationalRegion(manualCookieRegion)) {
    return manualCookieRegion;
  }

  if (normalizedCountry) {
    const mapped = mapCountryToRegionCode(normalizedCountry);
    if (mapped !== "IN") {
      return mapped;
    }
  }

  return DEFAULT_REGION_CODE;
}

/**
 * Authoritative Server-Side Pricing Lookup.
 *
 * Enforces regional restrictions so international users can never obtain INR pricing
 * and India-detected users always receive INR pricing.
 *
 * @param detectedCountryOrRegion Server-detected ISO country code (or region code in non-India fallback)
 * @param manualRegionPreference Optional user-selected currency/region preference
 */
export function getAuthoritativePricing(
  detectedCountryOrRegion: string | null | undefined,
  manualRegionPreference?: string | null
): RegionalPricingConfig {
  const effectiveRegion = resolveRegionCode(
    detectedCountryOrRegion ?? null,
    manualRegionPreference ?? null
  );

  return REGIONAL_PRICING[effectiveRegion] || REGIONAL_PRICING[DEFAULT_REGION_CODE];
}

export type PricingTier =
  | "india"
  | "us"
  | "eurozone"
  | "affordability"
  | "international";

export interface CentralPricingResult {
  countryCode: string | null;
  countryName: string;
  pricingTier: PricingTier;
  currency: string;
  currencySymbol: string;
  basePriceSubunits: number; // integer minor units
  basePrice: number; // main unit integer/number for display
  formattedDisplayPrice: string;
  pricingRuleId: string;
  isAffordability: boolean;
  isGatewaySupported: boolean;
  isFallbackUsd?: boolean;
  usdFallbackPriceSubunits?: number;
  periodDescription: string;
}

/**
 * Authoritative Central Regional & Affordability Pricing Engine.
 *
 * Precedence Order:
 * 1. India (IN): ₹1,299 INR (129,900 paise)
 * 2. United States (US): $75 USD (7,500 cents)
 * 3. Explicit Eurozone country (DE, FR, IT, ES, etc.): €75 EUR (7,500 cents)
 * 4. Active Affordability Country Rule: configured country price (or USD fallback if local currency is unsupported)
 * 5. Standard International Fallback: $75 USD (7,500 cents)
 */
export function resolveCentralPricing(options: {
  countryCode?: string | null;
  affordabilityRules?: AffordabilityCountryRule[] | null;
}): CentralPricingResult {
  const normalizedCountry = normalizeCountryCode(options.countryCode);

  // 1. India (IN)
  if (normalizedCountry === "IN") {
    return {
      countryCode: "IN",
      countryName: "India",
      pricingTier: "india",
      currency: "INR",
      currencySymbol: "₹",
      basePriceSubunits: 129900,
      basePrice: 1299,
      formattedDisplayPrice: "₹1,299",
      pricingRuleId: "rule_in_canonical",
      isAffordability: false,
      isGatewaySupported: true,
      periodDescription: "One-time payment • Lifetime license",
    };
  }

  // 2. United States (US)
  if (normalizedCountry === "US") {
    return {
      countryCode: "US",
      countryName: "United States",
      pricingTier: "us",
      currency: "USD",
      currencySymbol: "$",
      basePriceSubunits: 7500,
      basePrice: 75,
      formattedDisplayPrice: "$75",
      pricingRuleId: "rule_us_canonical",
      isAffordability: false,
      isGatewaySupported: true,
      periodDescription: "One-time payment • Lifetime license",
    };
  }

  // 3. Explicit Eurozone Country (DE, FR, IT, ES, etc.)
  if (normalizedCountry && EUROZONE_COUNTRY_CODES.has(normalizedCountry)) {
    const info = getCountryInfo(normalizedCountry);
    return {
      countryCode: normalizedCountry,
      countryName: info?.name || "Eurozone",
      pricingTier: "eurozone",
      currency: "EUR",
      currencySymbol: "€",
      basePriceSubunits: 7500,
      basePrice: 75,
      formattedDisplayPrice: "€75",
      pricingRuleId: "rule_eurozone_canonical",
      isAffordability: false,
      isGatewaySupported: true,
      periodDescription: "One-time payment • Lifetime license",
    };
  }

  // 4. Active, explicitly configured affordability-country rule
  if (normalizedCountry && Array.isArray(options.affordabilityRules)) {
    const rule = options.affordabilityRules.find(
      (r) => r.isActive && r.countryCode.toUpperCase() === normalizedCountry
    );

    if (rule) {
      const isGatewaySupported =
        rule.isGatewaySupportedCurrency &&
        GATEWAY_SUPPORTED_CURRENCIES.has(rule.currency.toUpperCase());

      if (isGatewaySupported) {
        const displayPrice = `${rule.currencySymbol}${Number(
          rule.basePriceSubunits / 100
        ).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

        return {
          countryCode: normalizedCountry,
          countryName: rule.countryName,
          pricingTier: "affordability",
          currency: rule.currency.toUpperCase(),
          currencySymbol: rule.currencySymbol,
          basePriceSubunits: rule.basePriceSubunits,
          basePrice: Math.round(rule.basePriceSubunits / 100),
          formattedDisplayPrice: displayPrice,
          pricingRuleId: `rule_affordability_${normalizedCountry}`,
          isAffordability: true,
          isGatewaySupported: true,
          periodDescription: "One-time payment • Lifetime license",
        };
      } else {
        // Fall back to configured USD amount
        const fallbackSubunits = rule.usdFallbackPriceSubunits || 2400;
        const fallbackDollars = Math.round(fallbackSubunits / 100);
        return {
          countryCode: normalizedCountry,
          countryName: rule.countryName,
          pricingTier: "affordability",
          currency: "USD",
          currencySymbol: "$",
          basePriceSubunits: fallbackSubunits,
          basePrice: fallbackDollars,
          formattedDisplayPrice: `$${fallbackDollars}`,
          pricingRuleId: `rule_affordability_${normalizedCountry}_usd_fallback`,
          isAffordability: true,
          isGatewaySupported: false,
          isFallbackUsd: true,
          usdFallbackPriceSubunits: fallbackSubunits,
          periodDescription: "One-time payment • Lifetime license",
        };
      }
    }
  }

  // 5. Standard International Fallback
  const info = normalizedCountry ? getCountryInfo(normalizedCountry) : null;
  return {
    countryCode: normalizedCountry ?? "DEFAULT",
    countryName:
      info?.name ||
      (normalizedCountry && normalizedCountry !== "DEFAULT"
        ? normalizedCountry
        : "International"),
    pricingTier: "international",
    currency: "USD",
    currencySymbol: "$",
    basePriceSubunits: 7500,
    basePrice: 75,
    formattedDisplayPrice: "$75",
    pricingRuleId: "rule_international_canonical",
    isAffordability: false,
    isGatewaySupported: true,
    periodDescription: "One-time payment • Lifetime license",
  };
}
