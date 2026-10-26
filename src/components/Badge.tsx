import React from "react";

export interface BadgeProps {
  children: React.ReactNode;
  variant?: "success" | "neutral" | "accent" | "forest";
  className?: string;
}

export function Badge({
  children,
  variant = "neutral",
  className = "",
}: BadgeProps) {
  const variantStyles = {
    forest: "bg-[var(--color-forest-green)] text-white",
    success: "bg-emerald-100 text-emerald-800 border border-emerald-200",
    neutral: "bg-[var(--color-soft-sage)] text-[var(--color-charcoal)]/80",
    accent: "bg-[var(--color-terracotta)]/15 text-[var(--color-terracotta)] font-semibold",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium tracking-wide uppercase ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
