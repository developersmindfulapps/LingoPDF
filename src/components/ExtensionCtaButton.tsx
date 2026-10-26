import React from "react";
import { Button } from "./Button";
import { extensionStoreConfig } from "@/lib/siteConfig";

export interface ExtensionCtaButtonProps {
  label?: string;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary";
  className?: string;
  fullWidth?: boolean;
}

export function ExtensionCtaButton({
  label = "Get the Extension",
  size = "md",
  variant = "primary",
  className = "",
  fullWidth = false,
}: ExtensionCtaButtonProps) {
  const isPublished = extensionStoreConfig.isPublished;
  const storeUrl = extensionStoreConfig.storeUrl;

  const widthClass = fullWidth ? "w-full" : "";

  if (isPublished && storeUrl) {
    return (
      <Button
        variant={variant}
        size={size}
        href={storeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${widthClass} ${className}`}
      >
        {label}
      </Button>
    );
  }

  // Pre-publication state: Temporarily disables install action with clear "Coming soon" communication
  return (
    <Button
      variant={variant}
      size={size}
      disabled
      title={extensionStoreConfig.unavailableTooltip}
      aria-label={`${label} — ${extensionStoreConfig.unavailableTooltip}`}
      className={`${widthClass} ${className}`}
    >
      <span>{label}</span>
      <span className="ml-2 rounded bg-white/20 px-1.5 py-0.5 text-xs font-normal tracking-wide text-white">
        {extensionStoreConfig.comingSoonText}
      </span>
    </Button>
  );
}
