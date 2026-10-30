import { REGIONAL_PRICING } from "./pricing/config";

export interface ProductItem {
  id: string;
  name: string;
  languagePair: string;
  status: "available" | "coming_soon";
  badge: string;
  description: string;
  href: string;
  features?: string[];
}

export interface PricingConfig {
  price: number;
  originalPrice?: number;
  isPromoActive: boolean;
  currency: string;
  periodDescription: string;
}

/**
 * Extension Store Configuration
 *
 * Centralized destination for the official Chrome Web Store listing for LingoPDF PDF Reader.
 * Update CHROME_WEB_STORE_URL or NEXT_PUBLIC_CHROME_WEB_STORE_URL once published.
 *
 * When CHROME_WEB_STORE_URL is null/empty (pre-publication):
 * - CTAs do not perform unintended redirects to unrelated sections of the homepage.
 * - CTAs render a clearly communicated, accessible "Coming soon" state.
 */
export const CHROME_WEB_STORE_URL: string | null =
  process.env.NEXT_PUBLIC_CHROME_WEB_STORE_URL || null;

export const extensionStoreConfig = {
  storeUrl: CHROME_WEB_STORE_URL,
  isPublished: Boolean(CHROME_WEB_STORE_URL && CHROME_WEB_STORE_URL.trim() !== ""),
  unavailableTooltip: "Chrome Web Store listing coming soon",
  comingSoonText: "Coming soon",
};

export const siteConfig = {
  name: "LingoPDF",
  tagline: "Your PDFs. Their language. Finally, understood.",
  description:
    "Read German PDFs with effortless inline word lookup. A lightweight browser extension for native Chrome and web PDFs, without leaving your document to access translation services.",
  regionalPricing: REGIONAL_PRICING,
  pricing: {
    german: {
      price: 49,
      originalPrice: 89,
      isPromoActive: true,
      currency: "$",
      periodDescription: "One-time payment • Lifetime license",
    } as PricingConfig,
  },
  products: [
    {
      id: "german",
      name: "LingoPDF PDF Reader",
      languagePair: "German → English",
      status: "available",
      badge: "Online",
      description: "Available now for immediate download and installation with full vocabulary coverage.",
      href: "/products/german-english",
      features: [
        "Native Chrome & Web PDFs",
        "Offline / OCR Support",
        "400k+ Word Pairs",
      ],
    },
    {
      id: "french",
      name: "LingoPDF French Reader",
      languagePair: "French → English",
      status: "coming_soon",
      badge: "Coming Soon",
      description: "Currently in development. Full vocabulary coverage with contextual definitions and verb conjugations.",
      href: "#",
      features: [
        "Comprehensive vocabulary",
        "Conjugation engine",
        "Contextual definitions",
      ],
    },
    {
      id: "italian",
      name: "LingoPDF Italian Reader",
      languagePair: "Italian → English",
      status: "coming_soon",
      badge: "Coming Soon",
      description: "Planned support for Italian vocabulary, contextual definitions, and verb conjugations.",
      href: "#",
      features: [
        "Planned Italian vocabulary support",
        "Contextual definitions",
        "Verb conjugation tables",
      ],
    },
  ] as ProductItem[],
  navLinks: [
    { label: "Products", href: "/#products" },
    { label: "How It Works", href: "/#how-it-works" },
    { label: "Pricing", href: "/#pricing" },
    { label: "Privacy", href: "/privacy" },
  ],
};
