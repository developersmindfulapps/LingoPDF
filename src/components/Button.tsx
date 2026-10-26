import React from "react";

export interface ButtonProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "outline" | "terracotta";
  size?: "sm" | "md" | "lg";
  href?: string;
  target?: string;
  rel?: string;
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  title?: string;
  "aria-label"?: string;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  href,
  target,
  rel,
  onClick,
  className = "",
  type = "button",
  disabled = false,
  title,
  "aria-label": ariaLabel,
}: ButtonProps) {
  const baseStyles =
    "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-forest-green)] select-none disabled:opacity-80 disabled:cursor-not-allowed cursor-pointer";

  const sizeStyles = {
    sm: "px-3.5 py-1.5 text-xs sm:text-sm min-h-[36px]",
    md: "px-5 py-2.5 text-sm sm:text-base min-h-[44px]",
    lg: "px-7 py-3.5 text-base sm:text-lg min-h-[50px] font-semibold",
  };

  const variantStyles = {
    primary:
      "bg-[var(--color-forest-green)] text-white hover:bg-[#122B24] active:bg-[#0c1f1a] shadow-sm hover:shadow",
    secondary:
      "bg-white/90 hover:bg-white text-[var(--color-forest-green)] border border-[var(--color-soft-sage)] hover:border-[var(--color-forest-green)]/30 shadow-xs",
    outline:
      "bg-transparent hover:bg-[var(--color-soft-sage)]/50 text-[var(--color-forest-green)] border border-[var(--color-forest-green)]",
    terracotta:
      "bg-[var(--color-terracotta)] text-white hover:bg-[#c26744] active:bg-[#af5a3a] shadow-sm",
  };

  const combinedClasses = `${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`;

  if (href && !disabled) {
    return (
      <a
        href={href}
        target={target}
        rel={rel}
        title={title}
        className={combinedClasses}
        aria-label={ariaLabel}
        onClick={onClick}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      type={type}
      className={combinedClasses}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}
