import React from "react";
import Image from "next/image";

export interface LingoPDFLogoProps {
  variant?: "horizontal" | "emblem" | "responsive";
  reversed?: boolean;
  className?: string;
  priority?: boolean;
  isDecorative?: boolean;
}

export function LingoPDFLogo({
  variant = "horizontal",
  reversed = false,
  className = "",
  priority = false,
  isDecorative = false,
}: LingoPDFLogoProps) {
  const horizontalSrc = reversed
    ? "/images/lingopdf-logo-reversed.svg"
    : "/images/lingopdf-logo.svg";

  const emblemSrc = "/images/lingopdf-emblem.svg";

  const ariaAttributes = isDecorative
    ? ({ "aria-hidden": true } as const)
    : ({ role: "img", "aria-label": "LingoPDF Logo" } as const);

  if (variant === "emblem") {
    return (
      <div className={`relative inline-flex items-center ${className}`} {...ariaAttributes}>
        <Image
          src={emblemSrc}
          alt={isDecorative ? "" : "LingoPDF emblem"}
          width={40}
          height={40}
          priority={priority}
          className="h-9 w-auto object-contain"
        />
      </div>
    );
  }

  if (variant === "responsive") {
    return (
      <div className={`relative inline-flex items-center shrink-0 ${className}`} {...ariaAttributes}>
        {/* Full horizontal lockup scales cleanly */}
        <div className="flex items-center shrink-0">
          <Image
            src={horizontalSrc}
            alt={isDecorative ? "" : "LingoPDF"}
            width={256}
            height={64}
            priority={priority}
            className="h-8 sm:h-9 md:h-10 w-auto object-contain"
          />
        </div>
      </div>
    );
  }

  // Default: Full horizontal logo lockup
  return (
    <div className={`relative inline-flex items-center shrink-0 ${className}`} {...ariaAttributes}>
      <Image
        src={horizontalSrc}
        alt={isDecorative ? "" : "LingoPDF"}
        width={256}
        height={64}
        priority={priority}
        className="h-8 sm:h-9 md:h-10 w-auto object-contain"
      />
    </div>
  );
}
