import { SupportedCurrency } from "@/lib/db/models";

const CURRENCY_CONFIG: Record<
  SupportedCurrency,
  { symbol: string; code: SupportedCurrency; locale: string }
> = {
  INR: { symbol: "₹", code: "INR", locale: "en-IN" },
  USD: { symbol: "$", code: "USD", locale: "en-US" },
  EUR: { symbol: "€", code: "EUR", locale: "en-IE" },
};

/**
 * Formats integer minor units (paise/cents) into a human-readable currency string
 * with currency code (e.g., "₹1,299.00 INR" or "$59.00 USD").
 * Never mixes currencies or loses minor-unit precision.
 */
export function formatSubunitsWithCode(
  subunits: number,
  currency: SupportedCurrency
): string {
  const cfg = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.USD;
  const majorUnits = (Number.isFinite(subunits) ? subunits : 0) / 100;
  const formatted = new Intl.NumberFormat(cfg.locale, {
    minimumFractionDigits: majorUnits % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(majorUnits);
  return `${cfg.symbol}${formatted} ${cfg.code}`;
}

export const formatMinorUnits = formatSubunitsWithCode;

export function formatSubunitsShort(

  subunits: number,
  currency: SupportedCurrency
): string {
  const cfg = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.USD;
  const majorUnits = (Number.isFinite(subunits) ? subunits : 0) / 100;
  const formatted = new Intl.NumberFormat(cfg.locale, {
    minimumFractionDigits: majorUnits % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(majorUnits);
  return `${cfg.symbol}${formatted}`;
}

export function formatAdminTimestamp(
  value: Date | string | null | undefined
): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

export function formatGuaranteeWindowStatus(
  purchaseCapturedAt: Date | string | null | undefined,
  referenceNow: Date = new Date()
): {
  isWithinWindow: boolean;
  remainingMs: number;
  label: string;
} {
  if (!purchaseCapturedAt) {
    return {
      isWithinWindow: false,
      remainingMs: 0,
      label: "Uncaptured purchase",
    };
  }
  const capturedDate =
    purchaseCapturedAt instanceof Date
      ? purchaseCapturedAt
      : new Date(purchaseCapturedAt);
  if (Number.isNaN(capturedDate.getTime())) {
    return {
      isWithinWindow: false,
      remainingMs: 0,
      label: "Invalid timestamp",
    };
  }

  const deadlineMs = capturedDate.getTime() + 72 * 60 * 60 * 1000;
  const remainingMs = deadlineMs - referenceNow.getTime();
  if (remainingMs <= 0) {
    const elapsedHours = Math.floor(Math.abs(remainingMs) / (60 * 60 * 1000));
    return {
      isWithinWindow: false,
      remainingMs: 0,
      label: `Expired (${elapsedHours}h past 72h window)`,
    };
  }

  const hours = Math.floor(remainingMs / (60 * 60 * 1000));
  const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
  return {
    isWithinWindow: true,
    remainingMs,
    label: `${hours}h ${minutes}m remaining (within 72h guarantee)`,
  };
}

export const formatGuaranteeCountdown = formatGuaranteeWindowStatus;

