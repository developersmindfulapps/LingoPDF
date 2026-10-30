"use client";

import React, { useTransition } from "react";
import {
  REGIONAL_PRICING,
  SupportedRegionCode,
  RegionalPricingConfig,
} from "@/lib/pricing/config";

export interface CurrencySelectorProps {
  currentRegion: SupportedRegionCode;
  onRegionChange?: (newPricing: RegionalPricingConfig) => void;
  className?: string;
  size?: "sm" | "md";
}

export function CurrencySelector({
  currentRegion,
  onRegionChange,
  className = "",
  size = "md",
}: CurrencySelectorProps) {
  const [isPending, startTransition] = useTransition();

  const handleSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedCode = e.target.value as SupportedRegionCode;
    const newConfig = REGIONAL_PRICING[selectedCode];
    if (!newConfig) return;

    if (onRegionChange) {
      onRegionChange(newConfig);
    }

    startTransition(async () => {
      try {
        await fetch("/api/pricing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ regionCode: selectedCode }),
        });
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
          {Object.values(REGIONAL_PRICING).map((plan) => (
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
