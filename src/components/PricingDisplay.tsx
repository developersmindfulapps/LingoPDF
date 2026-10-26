import React from "react";

export interface PricingDisplayProps {
  price: number;
  originalPrice?: number;
  isPromoActive?: boolean;
  currency?: string;
  periodDescription?: string;
  className?: string;
  align?: "left" | "center";
}

export function PricingDisplay({
  price,
  originalPrice,
  isPromoActive = false,
  currency = "$",
  periodDescription = "One-time payment • No subscription",
  className = "",
  align = "left",
}: PricingDisplayProps) {
  const showCrossedOut = isPromoActive && originalPrice && originalPrice > price;

  const alignStyles = align === "center" ? "items-center text-center" : "items-start text-left";

  return (
    <div className={`flex flex-col ${alignStyles} ${className}`}>
      <div className="flex items-baseline gap-3">
        <span className="font-heading text-4xl sm:text-5xl font-bold tracking-tight text-[var(--color-forest-green)]">
          {currency}{price}
        </span>
        {showCrossedOut && (
          <span className="text-xl sm:text-2xl font-normal text-[var(--color-charcoal)]/40 line-through">
            {currency}{originalPrice}
          </span>
        )}
      </div>
      {periodDescription && (
        <span className="mt-1 text-xs sm:text-sm text-[var(--color-charcoal)]/70">
          {periodDescription}
        </span>
      )}
    </div>
  );
}
