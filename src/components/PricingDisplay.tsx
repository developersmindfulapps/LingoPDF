"use client";

import React, { useState, useEffect } from "react";
import {
  REGIONAL_PRICING,
  RegionalPricingConfig,
  SupportedRegionCode,
  DEFAULT_REGION_CODE,
} from "@/lib/pricing/config";
import { formatPrice } from "@/lib/pricing/format";
import { CurrencySelector } from "./CurrencySelector";

export interface PricingDisplayProps {
  price?: number;
  originalPrice?: number;
  isPromoActive?: boolean;
  currency?: string;
  periodDescription?: string;
  className?: string;
  align?: "left" | "center";
  showSelector?: boolean;
  initialRegion?: SupportedRegionCode;
}

export function PricingDisplay({
  price: staticPrice,
  originalPrice: staticOriginalPrice,
  isPromoActive: staticIsPromoActive = false,
  periodDescription: staticPeriodDescription = "One-time payment • Lifetime license",
  className = "",
  align = "left",
  showSelector = true,
  initialRegion = DEFAULT_REGION_CODE,
}: PricingDisplayProps) {
  const [pricing, setPricing] = useState<RegionalPricingConfig>(
    REGIONAL_PRICING[initialRegion] || REGIONAL_PRICING[DEFAULT_REGION_CODE]
  );
  const [hasDetected, setHasDetected] = useState(false);

  // Automatically detect visitor region server-side via edge headers on initial load
  useEffect(() => {
    let isMounted = true;
    async function detectVisitorPricing() {
      try {
        const res = await fetch("/api/pricing");
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.pricing) {
            setPricing(data.pricing);
            setHasDetected(true);
          }
        }
      } catch {
        // Fall back gracefully to initialRegion default
      }
    }

    if (!hasDetected) {
      detectVisitorPricing();
    }

    return () => {
      isMounted = false;
    };
  }, [hasDetected]);

  // If static props are explicitly provided without selector, honor them
  const activePrice = showSelector ? pricing.price : staticPrice ?? pricing.price;
  const activeOriginalPrice = showSelector
    ? pricing.originalPrice
    : staticOriginalPrice ?? pricing.originalPrice;
  const activePromo = showSelector
    ? pricing.isPromoActive
    : staticIsPromoActive ?? pricing.isPromoActive;
  const activePeriodDescription = showSelector
    ? pricing.periodDescription
    : staticPeriodDescription ?? pricing.periodDescription;

  const formattedCurrent = formatPrice(activePrice, pricing);
  const formattedOriginal = activeOriginalPrice
    ? formatPrice(activeOriginalPrice, pricing)
    : null;

  const showCrossedOut =
    activePromo && activeOriginalPrice && activeOriginalPrice > activePrice;

  const alignStyles =
    align === "center" ? "items-center text-center" : "items-start text-left";

  return (
    <div className={`flex flex-col ${alignStyles} ${className}`}>
      {/* Optional Country / Currency Selector */}
      {showSelector && (
        <div className="mb-3">
          <CurrencySelector
            currentRegion={pricing.regionCode}
            onRegionChange={(newConfig) => setPricing(newConfig)}
            size="sm"
          />
        </div>
      )}

      {/* Main Price Numbers */}
      <div className="flex items-baseline gap-3">
        <span className="font-heading text-4xl sm:text-5xl font-bold tracking-tight text-[var(--color-forest-green)]">
          {formattedCurrent}
        </span>
        {showCrossedOut && formattedOriginal && (
          <span className="text-xl sm:text-2xl font-normal text-[var(--color-charcoal)]/40 line-through">
            {formattedOriginal}
          </span>
        )}
      </div>

      {/* Period Description */}
      {activePeriodDescription && (
        <span className="mt-1 text-xs sm:text-sm text-[var(--color-charcoal)]/70">
          {activePeriodDescription}
        </span>
      )}

      {/* Status note for proposed/tentative pricing */}
      {showSelector && pricing.isTentative && pricing.statusNote && (
        <p className="mt-1.5 text-xs text-[var(--color-charcoal)]/60 italic max-w-xs">
          *{pricing.statusNote}
        </p>
      )}
    </div>
  );
}
