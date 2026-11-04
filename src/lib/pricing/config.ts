/**
 * Regional Pricing Configuration for LingoPDF
 *
 * Centralised, authoritative regional pricing definitions.
 * Display formatting is strictly separated from numeric price values.
 *
 * Confirmed base prices (before discounts):
 * - India (IN): INR 1,299 (₹1,299)
 * - United States (US): USD 75 ($75)
 * - Europe (EU): EUR 75 (€75)
 * - International fallback (DEFAULT): USD 75 ($75)
 */

export type SupportedRegionCode = "IN" | "US" | "EU" | "DEFAULT";

/**
 * Confirmed promotional discount tiers for the future discount engine.
 * Admin can select one: 5%, 10%, 15%, or 20%.
 */
export const SUPPORTED_PROMO_DISCOUNT_PERCENTAGES = [5, 10, 15, 20] as const;
export type PromoDiscountPercentage = (typeof SUPPORTED_PROMO_DISCOUNT_PERCENTAGES)[number];

export interface RegionalPricingConfig {
  regionCode: SupportedRegionCode;
  countryName: string;
  currency: string;
  currencySymbol: string;
  symbolPosition: "prefix" | "suffix";
  basePrice: number; // Canonical source of truth for base price (before discounts)
  readonly price: number; // Backward-compatible read-only alias derived directly from basePrice
  originalPrice?: number;
  isPromoActive: boolean;
  periodDescription: string;
  isTentative?: boolean;
  statusNote?: string;
  label: string;
}

export const REGIONAL_PRICING: Record<SupportedRegionCode, RegionalPricingConfig> = {
  IN: {
    regionCode: "IN",
    countryName: "India",
    currency: "INR",
    currencySymbol: "₹",
    symbolPosition: "prefix",
    basePrice: 1299,
    get price() {
      return this.basePrice;
    },
    isPromoActive: false,
    periodDescription: "One-time payment • Lifetime license",
    label: "India (₹ INR)",
  },
  US: {
    regionCode: "US",
    countryName: "United States",
    currency: "USD",
    currencySymbol: "$",
    symbolPosition: "prefix",
    basePrice: 75,
    get price() {
      return this.basePrice;
    },
    isPromoActive: false,
    periodDescription: "One-time payment • Lifetime license",
    label: "United States ($ USD)",
  },
  EU: {
    regionCode: "EU",
    countryName: "Europe",
    currency: "EUR",
    currencySymbol: "€",
    symbolPosition: "prefix",
    basePrice: 75,
    get price() {
      return this.basePrice;
    },
    isPromoActive: false,
    periodDescription: "One-time payment • Lifetime license",
    label: "Europe (€ EUR)",
  },
  DEFAULT: {
    regionCode: "DEFAULT",
    countryName: "International",
    currency: "USD",
    currencySymbol: "$",
    symbolPosition: "prefix",
    basePrice: 75,
    get price() {
      return this.basePrice;
    },
    isPromoActive: false,
    periodDescription: "One-time payment • Lifetime license",
    label: "International ($ USD)",
  },
};

/**
 * ISO 3166-1 alpha-2 country codes that use the Euro.
 * Includes Bulgaria (BG) which adopted the Euro on 1 January 2026 as the 21st Eurozone member.
 */
export const EUROZONE_COUNTRY_CODES = new Set([
  "AT", "BE", "BG", "CY", "EE", "FI", "FR", "DE", "GR", "HR", "IE", "IT",
  "LV", "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES",
]);

export const DEFAULT_REGION_CODE: SupportedRegionCode = "DEFAULT";
