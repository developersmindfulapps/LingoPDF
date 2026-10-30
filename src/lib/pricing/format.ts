import { RegionalPricingConfig } from "./config";

/**
 * Formats a numeric price into a localized display string based on regional pricing configuration.
 * Separates presentation logic from underlying data values.
 */
export function formatPrice(
  amount: number,
  config: Pick<RegionalPricingConfig, "currency" | "currencySymbol" | "symbolPosition">
): string {
  const formattedNumber = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);

  if (config.symbolPosition === "suffix") {
    return `${formattedNumber} ${config.currencySymbol}`;
  }
  return `${config.currencySymbol}${formattedNumber}`;
}

/**
 * Formats an amount with standard international currency code (e.g. "999 INR" or "$49 USD").
 */
export function formatPriceWithCurrencyCode(
  amount: number,
  config: Pick<RegionalPricingConfig, "currency" | "currencySymbol" | "symbolPosition">
): string {
  const formatted = formatPrice(amount, config);
  return `${formatted} ${config.currency}`;
}
