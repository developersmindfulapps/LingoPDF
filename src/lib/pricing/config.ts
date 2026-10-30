/**
 * Regional Pricing Configuration for LingoPDF
 *
 * Centralised regional pricing definitions.
 * Display formatting is strictly separated from numeric price values.
 *
 * Commercial decisions:
 * - India (IN): INR pricing. Proposed price point: ₹899 or ₹999 (to be finalised before checkout implementation).
 * - United States (US): USD pricing. Initially proposed at $49 (reference $89).
 * - Europe (EU): EUR pricing to be configured (tentatively €49).
 * - Other countries (DEFAULT): USD fallback at $49.
 *
 * Note: These prices are proposed / tentative. They must not be treated as final
 * until formally approved prior to Phase 7A checkout deployment.
 */

export type SupportedRegionCode = "IN" | "US" | "EU" | "DEFAULT";

export interface RegionalPricingConfig {
  regionCode: SupportedRegionCode;
  countryName: string;
  currency: string;
  currencySymbol: string;
  symbolPosition: "prefix" | "suffix";
  price: number;
  originalPrice?: number;
  isPromoActive: boolean;
  periodDescription: string;
  isTentative: boolean;
  statusNote: string;
  label: string;
}

export const REGIONAL_PRICING: Record<SupportedRegionCode, RegionalPricingConfig> = {
  IN: {
    regionCode: "IN",
    countryName: "India",
    currency: "INR",
    currencySymbol: "₹",
    symbolPosition: "prefix",
    price: 999, // Proposed price point: ₹899 or ₹999 to be finalised before checkout
    originalPrice: 1499,
    isPromoActive: true,
    periodDescription: "One-time payment • Lifetime license",
    isTentative: true,
    statusNote: "Proposed price point (₹899 or ₹999) — to be finalised before checkout.",
    label: "India (₹ INR)",
  },
  US: {
    regionCode: "US",
    countryName: "United States",
    currency: "USD",
    currencySymbol: "$",
    symbolPosition: "prefix",
    price: 49,
    originalPrice: 89,
    isPromoActive: true,
    periodDescription: "One-time payment • Lifetime license",
    isTentative: true,
    statusNote: "Initially proposed pricing ($49 promo, reference $89).",
    label: "United States ($ USD)",
  },
  EU: {
    regionCode: "EU",
    countryName: "European Union",
    currency: "EUR",
    currencySymbol: "€",
    symbolPosition: "prefix",
    price: 49,
    originalPrice: 89,
    isPromoActive: true,
    periodDescription: "One-time payment • Lifetime license",
    isTentative: true,
    statusNote: "EUR pricing to be finalised before checkout implementation.",
    label: "Europe (€ EUR)",
  },
  DEFAULT: {
    regionCode: "DEFAULT",
    countryName: "International",
    currency: "USD",
    currencySymbol: "$",
    symbolPosition: "prefix",
    price: 49,
    originalPrice: 89,
    isPromoActive: true,
    periodDescription: "One-time payment • Lifetime license",
    isTentative: true,
    statusNote: "International fallback pricing in USD.",
    label: "International ($ USD)",
  },
};

/**
 * ISO 3166-1 alpha-2 country codes that use the Euro.
 */
export const EUROZONE_COUNTRY_CODES = new Set([
  "AT", "BE", "CY", "EE", "FI", "FR", "DE", "GR", "IE", "IT",
  "LV", "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES",
]);

export const DEFAULT_REGION_CODE: SupportedRegionCode = "DEFAULT";
