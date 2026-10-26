import React from "react";

export function PrivacyIllustration({ className = "" }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg
        viewBox="0 0 400 360"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full max-w-[380px] h-auto drop-shadow-lg"
        role="img"
        aria-label="Illustration showing local-first document privacy with offline documents, a protective security shield, and a local computer."
      >
        {/* Soft Background Circular Plaque */}
        <circle cx="200" cy="180" r="140" fill="#E8E4D9" />
        <circle cx="200" cy="180" r="125" fill="#F8F5EE" opacity="0.9" />

        {/* Decorative Botanical Laurel Accents (Brand Identity) */}
        <g stroke="#193C32" strokeWidth="2.5" strokeLinecap="round" opacity="0.85">
          {/* Left Laurel */}
          <path d="M95 195 C90 160, 105 130, 125 105" fill="none" />
          <path d="M96 175 C85 170, 80 160, 85 150 C95 155, 98 165, 96 175 Z" fill="#193C32" />
          <path d="M107 148 C98 140, 96 130, 104 122 C112 128, 112 138, 107 148 Z" fill="#193C32" />
          <path d="M124 122 C116 112, 118 102, 128 96 C134 104, 132 114, 124 122 Z" fill="#193C32" />

          {/* Right Laurel */}
          <path d="M305 195 C310 160, 295 130, 275 105" fill="none" />
          <path d="M304 175 C315 170, 320 160, 315 150 C305 155, 302 165, 304 175 Z" fill="#193C32" />
          <path d="M293 148 C302 140, 304 130, 296 122 C288 128, 288 138, 293 148 Z" fill="#193C32" />
          <path d="M276 122 C284 112, 282 102, 272 96 C266 104, 268 114, 276 122 Z" fill="#193C32" />
        </g>

        {/* Document Stack (Back Sheet) */}
        <rect
          x="150"
          y="85"
          width="110"
          height="140"
          rx="8"
          fill="#FFFFFF"
          stroke="#D8D3C5"
          strokeWidth="2"
          transform="rotate(6 205 155)"
        />

        {/* Document Stack (Front Sheet) */}
        <g filter="url(#shadow-doc)">
          <rect
            x="145"
            y="95"
            width="110"
            height="140"
            rx="8"
            fill="#FFFFFF"
            stroke="#E8E4D9"
            strokeWidth="2"
          />

          {/* Document Header Line & Text Mock Lines */}
          <rect x="160" y="115" width="40" height="4" rx="2" fill="#D87854" />
          <line x1="160" y1="130" x2="235" y2="130" stroke="#E8E4D9" strokeWidth="3" strokeLinecap="round" />
          <line x1="160" y1="142" x2="225" y2="142" stroke="#E8E4D9" strokeWidth="3" strokeLinecap="round" />
          <line x1="160" y1="154" x2="230" y2="154" stroke="#E8E4D9" strokeWidth="3" strokeLinecap="round" />
          <line x1="160" y1="166" x2="210" y2="166" stroke="#E8E4D9" strokeWidth="3" strokeLinecap="round" />

          {/* PDF Brand Badge on Document */}
          <rect x="180" y="180" width="40" height="24" rx="4" fill="#D87854" />
          <text
            x="200"
            y="196"
            fill="#FFFFFF"
            fontSize="11"
            fontWeight="bold"
            fontFamily="system-ui, sans-serif"
            textAnchor="middle"
          >
            PDF
          </text>
        </g>

        {/* Local Laptop / Workstation (Right foreground) */}
        <g id="laptop" transform="translate(240, 185)">
          {/* Laptop Base */}
          <path
            d="M5 55 L75 55 C78 55, 80 57, 78 59 L70 63 C69 64, 68 64, 66 64 L14 64 C12 64, 11 64, 10 63 L2 59 C0 57, 2 55, 5 55 Z"
            fill="#193C32"
          />
          {/* Laptop Screen Bezel */}
          <rect x="12" y="10" width="56" height="44" rx="4" fill="#242923" />
          {/* Laptop Screen Display */}
          <rect x="15" y="13" width="50" height="38" rx="2" fill="#FFFFFF" />
          {/* Local Waveform / Processing Lines */}
          <path
            d="M20 32 L26 32 L30 25 L34 38 L38 29 L42 34 L48 34 L52 32 L60 32"
            stroke="#193C32"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        {/* Protective Security Shield (Foreground Left/Center) */}
        <g id="shield" transform="translate(170, 190)">
          <path
            d="M30 5 C45 5, 55 0, 55 0 C55 0, 55 25, 55 35 C55 52, 43 65, 30 72 C17 65, 5 52, 5 35 C5 25, 5 0, 5 0 C5 0, 15 5, 30 5 Z"
            fill="#193C32"
            stroke="#FFFFFF"
            strokeWidth="3"
          />
          {/* Lock Icon Inside Shield */}
          <rect x="22" y="32" width="16" height="14" rx="2" fill="#E8E4D9" />
          <path
            d="M25 32 V26 C25 23.2, 27.2 21, 30 21 C32.8 21, 35 23.2, 35 26 V32"
            stroke="#E8E4D9"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="30" cy="38" r="1.5" fill="#193C32" />
        </g>

        {/* Small Data Packet Indicator Dots (Indicating Local Storage Only) */}
        <circle cx="280" cy="165" r="3" fill="#D87854" />
        <circle cx="292" cy="160" r="2.5" fill="#D87854" opacity="0.6" />
        <circle cx="302" cy="168" r="2" fill="#D87854" opacity="0.4" />

        <defs>
          <filter id="shadow-doc" x="135" y="88" width="130" height="160" filterUnits="userSpaceOnUse">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.08" floodColor="#242923" />
          </filter>
        </defs>
      </svg>
    </div>
  );
}
