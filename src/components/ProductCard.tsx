import React from "react";
import Link from "next/link";
import { Badge } from "./Badge";
import type { ProductItem } from "@/lib/siteConfig";

export interface ProductCardProps {
  product: ProductItem;
}

export function ProductCard({ product }: ProductCardProps) {
  const isAvailable = product.status === "available";

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-[var(--color-soft-sage)] bg-white p-6 sm:p-8 shadow-xs hover:shadow-md transition-shadow duration-200">
      <div>
        <div className="flex items-center justify-between mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-warm-ivory)] border border-[var(--color-soft-sage)] text-[var(--color-forest-green)]">
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          </div>
          <Badge variant={isAvailable ? "success" : "neutral"}>
            {product.badge}
          </Badge>
        </div>

        <h3 className="font-heading text-xl font-bold text-[var(--color-forest-green)] mb-2">
          {product.languagePair}
        </h3>

        <p className="text-sm text-[var(--color-charcoal)]/80 leading-relaxed mb-6 font-sans">
          {product.description}
        </p>
      </div>

      <div className="pt-4 border-t border-[var(--color-soft-sage)]/60">
        {isAvailable ? (
          <Link
            href={product.href}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-forest-green)] hover:text-[#122B24] transition-colors group"
          >
            <span>View Product</span>
            <span className="transform transition-transform group-hover:translate-x-1" aria-hidden="true">
              →
            </span>
          </Link>
        ) : (
          <span className="text-xs font-medium text-[var(--color-charcoal)]/50 tracking-wide uppercase">
            In development
          </span>
        )}
      </div>
    </div>
  );
}
