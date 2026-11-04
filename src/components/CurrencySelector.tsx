"use client";

import React, { useTransition } from "react";
import {
  REGIONAL_PRICING,
  SupportedRegionCode,
  RegionalPricingConfig,
} from "@/lib/pricing/config";

const DEFAULT_INTERNATIONAL_OPTIONS: RegionalPricingConfig[] = [
  REGIONAL_PRICING.US,
  REGIONAL_PRICING.EU,
  REGIONAL_PRICING.DEFAULT,
];

export interface CurrencySelectorProps {
  currentRegion: SupportedRegionCode;
  availableRegions?: Pick<
    RegionalPricingConfig,
    "regionCode" | "label" | "currency" | "currencySymbol" | "price"
  >[];
  onRegionChange?: (newPricing: RegionalPricingConfig) => void;
  className?: string;
  size?: "sm" | "md";
}

export function CurrencySelector({
  currentRegion,
  availableRegions,
  onRegionChange,
  className = "",
  size = "md",
}: CurrencySelectorProps) {
  const [isPending, startTransition] = useTransition();

  // Indian users must not see an INR override option because INR is mandatory
  if (currentRegion === "IN") {
    return null;
  }

  // Filter options so INR ("IN") is never selectable in the international currency selector
  const permittedOptions = (
    availableRegions && availableRegions.length > 0
      ? availableRegions
      : DEFAULT_INTERNATIONAL_OPTIONS
  ).filter((plan) => plan.regionCode !== "IN");

  if (permittedOptions.length <= 1) {
    return null;
  }

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedCode = e.target.value as SupportedRegionCode;
    if (selectedCode === "IN") return;

    const newConfig = REGIONAL_PRICING[selectedCode];
    if (!newConfig) return;

    startTransition(async () => {
      try {
        const res = await fetch("/api/pricing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ regionCode: selectedCode }),
        });

        if (res.ok) {
          const data = await res.json();
          if (onRegionChange && data.pricing) {
            onRegionChange(data.pricing);
            return;
          }
        }
      } catch (err) {
        console.error("Failed to persist currency preference:", err);
      }
    });
  };

  const selectSizeClasses =
    size === "sm"
      ? "text-xs py-1 px-2.5"
      : "text-xs sm:text-sm py-1.5 px-3";

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <label
        htmlFor="currency-selector"
        className="text-xs font-medium text-[var(--color-charcoal)]/70 uppercase tracking-wider"
      >
        Region / Currency:
      </label>
      <div className="relative inline-block">
        <select
          id="currency-selector"
          value={currentRegion}
          onChange={handleSelect}
          disabled={isPending}
          className={`${selectSizeClasses} font-medium text-[var(--color-forest-green)] bg-white border border-[var(--color-soft-sage)] hover:border-[var(--color-forest-green)]/40 rounded-lg shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-forest-green)] cursor-pointer transition-colors pr-7`}
          aria-label="Select currency and region"
        >
          {permittedOptions.map((plan) => (
            <option key={plan.regionCode} value={plan.regionCode}>
              {plan.label}
            </option>
          ))}
        </select>
        <span
          className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[var(--color-charcoal)]/50 text-xs"
          aria-hidden="true"
        >
          ▾
        </span>
      </div>
    </div>
  );
}
