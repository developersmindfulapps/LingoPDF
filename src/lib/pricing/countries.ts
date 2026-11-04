import { EUROZONE_COUNTRY_CODES } from "./config";

export interface IsoCountryInfo {
  code: string;
  name: string;
  defaultCurrency: string;
  defaultSymbol: string;
}

/**
 * Standard payment gateway supported currencies for international charge.
 *
 * IMPORTANT NOTE ON PAYMENT GATEWAY INTEGRATION & VERIFICATION STATUS:
 * Live Razorpay payment gateway integration, live webhook processing, and
 * provider-level international currency verification remain deferred until Stage 3C.
 *
 * Currencies in this set represent standard configured/anticipated international settlement
 * currencies rather than provider-confirmed capabilities.
 *
 * Until payment gateway support for a local currency is independently verified and confirmed
 * with live provider credentials, any affordability rule for a country using an unverified
 * local currency automatically falls back to its configured USD fallback amount
 * (`usdFallbackPriceSubunits`), preserving clean and safe checkout execution.
 */
export const GATEWAY_SUPPORTED_CURRENCIES = new Set([
  "INR",
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "SGD",
  "AED",
]);

/**
 * Static reference exchange rate table to Indian Rupee (INR) for administrative pricing estimates.
 *
 * PROVENANCE & OPERATIONAL USAGE:
 * - These exchange rates are static, illustrative reference estimates compiled as indicative benchmarks
 *   (effective reference date: 2026-11-01) based on central bank reference snapshots (e.g. RBI, BOM, CBK, CBN, SARB)
 *   and forex benchmarks.
 * - They are NOT live, streaming, or bank-verified exchange rate feeds.
 * - They are strictly informational and used solely inside the administrative dashboard to calculate suggested
 *   approximate price points against the ₹2,000 INR affordability target benchmark.
 * - In accordance with commercial invariants, they NEVER dynamically modify or re-rate configured customer checkout prices.
 */
export const REFERENCE_EXCHANGE_RATES_TO_INR: Record<
  string,
  { rateToInr: number; source: string; updatedAt: string }
> = {
  KZT: { rateToInr: 0.17, source: "RBI Reference Snapshot (Illustrative)", updatedAt: "2026-11-01" },
  MNT: { rateToInr: 0.024, source: "BOM Reference Snapshot (Illustrative)", updatedAt: "2026-11-01" },
  KES: { rateToInr: 0.65, source: "CBK Reference Snapshot (Illustrative)", updatedAt: "2026-11-01" },
  NGN: { rateToInr: 0.055, source: "CBN Reference Snapshot (Illustrative)", updatedAt: "2026-11-01" },
  ZAR: { rateToInr: 4.75, source: "SARB Reference Snapshot (Illustrative)", updatedAt: "2026-11-01" },
  EGP: { rateToInr: 1.72, source: "CBE Reference Snapshot (Illustrative)", updatedAt: "2026-11-01" },
  GHS: { rateToInr: 5.3, source: "BOG Reference Snapshot (Illustrative)", updatedAt: "2026-11-01" },
  USD: { rateToInr: 85.0, source: "Forex Benchmark (Illustrative)", updatedAt: "2026-11-01" },
  EUR: { rateToInr: 92.0, source: "Forex Benchmark (Illustrative)", updatedAt: "2026-11-01" },
};

/**
 * Curated ISO 3166-1 alpha-2 countries.
 */
export const ISO_COUNTRY_LIST: IsoCountryInfo[] = [
  // Standard Protected Markets
  { code: "IN", name: "India", defaultCurrency: "INR", defaultSymbol: "₹" },
  { code: "US", name: "United States", defaultCurrency: "USD", defaultSymbol: "$" },
  // Eurozone (21 Member States — includes Bulgaria BG as 21st member as of 1 Jan 2026)
  { code: "DE", name: "Germany", defaultCurrency: "EUR", defaultSymbol: "€" },
  { code: "FR", name: "France", defaultCurrency: "EUR", defaultSymbol: "€" },
  { code: "IT", name: "Italy", defaultCurrency: "EUR", defaultSymbol: "€" },
  { code: "ES", name: "Spain", defaultCurrency: "EUR", defaultSymbol: "€" },
  { code: "NL", name: "Netherlands", defaultCurrency: "EUR", defaultSymbol: "€" },
  { code: "BE", name: "Belgium", defaultCurrency: "EUR", defaultSymbol: "€" },
  { code: "AT", name: "Austria", defaultCurrency: "EUR", defaultSymbol: "€" },
  { code: "IE", name: "Ireland", defaultCurrency: "EUR", defaultSymbol: "€" },
  { code: "PT", name: "Portugal", defaultCurrency: "EUR", defaultSymbol: "€" },
  { code: "GR", name: "Greece", defaultCurrency: "EUR", defaultSymbol: "€" },
  { code: "FI", name: "Finland", defaultCurrency: "EUR", defaultSymbol: "€" },
  { code: "SK", name: "Slovakia", defaultCurrency: "EUR", defaultSymbol: "€" },
  { code: "SI", name: "Slovenia", defaultCurrency: "EUR", defaultSymbol: "€" },
  { code: "LU", name: "Luxembourg", defaultCurrency: "EUR", defaultSymbol: "€" },
  { code: "LT", name: "Lithuania", defaultCurrency: "EUR", defaultSymbol: "€" },
  { code: "LV", name: "Latvia", defaultCurrency: "EUR", defaultSymbol: "€" },
  { code: "EE", name: "Estonia", defaultCurrency: "EUR", defaultSymbol: "€" },
  { code: "CY", name: "Cyprus", defaultCurrency: "EUR", defaultSymbol: "€" },
  { code: "MT", name: "Malta", defaultCurrency: "EUR", defaultSymbol: "€" },
  { code: "HR", name: "Croatia", defaultCurrency: "EUR", defaultSymbol: "€" },
  { code: "BG", name: "Bulgaria", defaultCurrency: "EUR", defaultSymbol: "€" },

  // Potential Affordability Candidates (Curated)
  { code: "KZ", name: "Kazakhstan", defaultCurrency: "KZT", defaultSymbol: "₸" },
  { code: "MN", name: "Mongolia", defaultCurrency: "MNT", defaultSymbol: "₮" },
  { code: "KE", name: "Kenya", defaultCurrency: "KES", defaultSymbol: "KSh" },
  { code: "NG", name: "Nigeria", defaultCurrency: "NGN", defaultSymbol: "₦" },
  { code: "ZA", name: "South Africa", defaultCurrency: "ZAR", defaultSymbol: "R" },
  { code: "EG", name: "Egypt", defaultCurrency: "EGP", defaultSymbol: "E£" },
  { code: "GH", name: "Ghana", defaultCurrency: "GHS", defaultSymbol: "GH₵" },
  { code: "TZ", name: "Tanzania", defaultCurrency: "TZS", defaultSymbol: "TSh" },
  { code: "UG", name: "Uganda", defaultCurrency: "UGX", defaultSymbol: "USh" },
  { code: "RW", name: "Rwanda", defaultCurrency: "RWF", defaultSymbol: "FRw" },
  { code: "ET", name: "Ethiopia", defaultCurrency: "ETB", defaultSymbol: "Br" },
  { code: "UZ", name: "Uzbekistan", defaultCurrency: "UZS", defaultSymbol: "so'm" },
  { code: "KG", name: "Kyrgyzstan", defaultCurrency: "KGS", defaultSymbol: "сом" },

  // Standard International Markets
  { code: "GB", name: "United Kingdom", defaultCurrency: "GBP", defaultSymbol: "£" },
  { code: "CA", name: "Canada", defaultCurrency: "CAD", defaultSymbol: "CA$" },
  { code: "AU", name: "Australia", defaultCurrency: "AUD", defaultSymbol: "A$" },
  { code: "JP", name: "Japan", defaultCurrency: "JPY", defaultSymbol: "¥" },
  { code: "CH", name: "Switzerland", defaultCurrency: "CHF", defaultSymbol: "CHF" },
  { code: "SG", name: "Singapore", defaultCurrency: "SGD", defaultSymbol: "S$" },
  { code: "AE", name: "United Arab Emirates", defaultCurrency: "AED", defaultSymbol: "AED" },
  { code: "BR", name: "Brazil", defaultCurrency: "BRL", defaultSymbol: "R$" },
  { code: "MX", name: "Mexico", defaultCurrency: "MXN", defaultSymbol: "MX$" },
];

const ISO_MAP = new Map(ISO_COUNTRY_LIST.map((c) => [c.code, c]));

/**
 * Validates whether a country code is a known ISO code.
 */
export function isValidIsoCountryCode(code?: string | null): boolean {
  if (!code || typeof code !== "string") return false;
  return ISO_MAP.has(code.toUpperCase());
}

/**
 * Returns country info for a given code.
 */
export function getCountryInfo(code?: string | null): IsoCountryInfo | null {
  if (!code || typeof code !== "string") return null;
  return ISO_MAP.get(code.toUpperCase()) || null;
}

/**
 * Checks whether a country belongs to a protected canonical pricing tier:
 * India (IN), United States (US), or any Eurozone country.
 * Affordability rules cannot override these markets.
 */
export function isProtectedPricingCountry(code?: string | null): boolean {
  if (!code || typeof code !== "string") return false;
  const upper = code.toUpperCase();
  return upper === "IN" || upper === "US" || EUROZONE_COUNTRY_CODES.has(upper);
}

/**
 * Calculates suggested local price and USD fallback for a country based on the target INR amount.
 */
export function calculateSuggestedAffordabilityPrice(
  currency: string,
  targetInr = 2000
): {
  suggestedLocalPrice: number;
  suggestedLocalSubunits: number;
  suggestedUsdFallbackSubunits: number;
  referenceRateToInr: number | null;
  approximateInrEquivalent: number;
} {
  const upperCur = currency.toUpperCase();
  const rateInfo = REFERENCE_EXCHANGE_RATES_TO_INR[upperCur];
  const usdRate = REFERENCE_EXCHANGE_RATES_TO_INR.USD?.rateToInr || 85.0;

  // USD fallback target: targetInr / usdRate in cents, rounded to whole dollars
  const usdDollars = Math.round(targetInr / usdRate);
  const suggestedUsdFallbackSubunits = usdDollars * 100;

  if (!rateInfo || rateInfo.rateToInr <= 0) {
    return {
      suggestedLocalPrice: usdDollars,
      suggestedLocalSubunits: suggestedUsdFallbackSubunits,
      suggestedUsdFallbackSubunits,
      referenceRateToInr: null,
      approximateInrEquivalent: targetInr,
    };
  }

  // targetInr / rateToInr gives raw units
  const rawUnits = targetInr / rateInfo.rateToInr;
  let roundedUnits = Math.round(rawUnits);

  // Round smartly to clean psychological price points
  if (roundedUnits > 10000) {
    roundedUnits = Math.round(roundedUnits / 500) * 500;
  } else if (roundedUnits > 1000) {
    roundedUnits = Math.round(roundedUnits / 100) * 100;
  } else if (roundedUnits > 100) {
    roundedUnits = Math.round(roundedUnits / 10) * 10;
  }

  const approximateInr = Math.round(roundedUnits * rateInfo.rateToInr);

  return {
    suggestedLocalPrice: roundedUnits,
    suggestedLocalSubunits: roundedUnits * 100,
    suggestedUsdFallbackSubunits,
    referenceRateToInr: rateInfo.rateToInr,
    approximateInrEquivalent: approximateInr,
  };
}
