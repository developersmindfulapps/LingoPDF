import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/Button";
import { ExtensionCtaButton } from "@/components/ExtensionCtaButton";
import { Badge } from "@/components/Badge";
import { PricingDisplay } from "@/components/PricingDisplay";
import { ProductCard } from "@/components/ProductCard";
import { PrivacyIllustration } from "@/components/PrivacyIllustration";
import { siteConfig } from "@/lib/siteConfig";

export default function Home() {
  const germanPricing = siteConfig.pricing.german;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-warm-ivory)] text-[var(--color-charcoal)] antialiased selection:bg-[var(--color-soft-sage)] selection:text-[var(--color-forest-green)]">
      {/* 1. Navigation */}
      <Navbar />

      <main className="flex-1">
        {/* 2. Hero Section */}
        <section className="relative overflow-hidden pt-12 pb-20 sm:pt-16 sm:pb-28 lg:pt-20 lg:pb-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
              {/* Left Column: Headline, Copy & CTAs */}
              <div className="lg:col-span-7 flex flex-col items-start text-left z-10">
                {/* Eyebrow */}
                <span className="text-xs sm:text-sm font-bold uppercase tracking-widest text-[var(--color-terracotta)] mb-4 inline-block">
                  Read without losing your flow
                </span>

                {/* Main Heading */}
                <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[var(--color-forest-green)] leading-[1.08] mb-6">
                  Your PDFs. Their
                  <br />
                  language.
                  <br />
                  Finally,{" "}
                  <span className="italic font-serif text-[var(--color-terracotta)] font-normal">
                    understood.
                  </span>
                </h1>

                {/* Description */}
                <p className="font-sans text-base sm:text-lg lg:text-xl text-[var(--color-charcoal)]/80 max-w-xl leading-relaxed mb-8">
                  Read German PDFs with effortless inline word lookup. A lightweight browser extension for native Chrome and web PDFs, without leaving your document to access translation services.
                </p>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto mb-10">
                  <ExtensionCtaButton label="Get the German Extension" size="lg" />
                  <Button variant="secondary" size="lg" href="#how-it-works">
                    See How It Works
                  </Button>
                </div>

                {/* Trust Points */}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-6 border-t border-[var(--color-soft-sage)] w-full">
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-[var(--color-charcoal)]/80">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-forest-green)]/10 text-[var(--color-forest-green)]">
                      ✓
                    </span>
                    <span>No cloud account for PDFs</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-[var(--color-charcoal)]/80">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-forest-green)]/10 text-[var(--color-forest-green)]">
                      ✓
                    </span>
                    <span>Local dictionary lookup</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-[var(--color-charcoal)]/80">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-forest-green)]/10 text-[var(--color-forest-green)]">
                      ✓
                    </span>
                    <span>Local OCR for scanned PDFs</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-[var(--color-charcoal)]/80">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-forest-green)]/10 text-[var(--color-forest-green)]">
                      ✓
                    </span>
                    <span>Works offline after activation</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-[var(--color-charcoal)]/80">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-forest-green)]/10 text-[var(--color-forest-green)]">
                      ✓
                    </span>
                    <span>One-time purchase</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Actual PDF Reader Screenshot in Subtle Document Frame */}
              <div className="lg:col-span-5 flex justify-center lg:justify-end">
                <div className="relative w-full max-w-[500px] rounded-2xl bg-white p-3 sm:p-4 shadow-2xl border border-[var(--color-soft-sage)] transition-transform duration-300 hover:scale-[1.01]">
                  {/* Mock PDF Toolbar */}
                  <div className="mb-3 flex items-center justify-between rounded-lg bg-[var(--color-warm-ivory)] px-3 py-2 text-xs font-mono text-[var(--color-charcoal)]/70 border border-[var(--color-soft-sage)]/60">
                    <div className="flex items-center gap-2 truncate">
                      <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-terracotta)]/70" />
                      <span className="truncate font-sans font-medium text-[var(--color-forest-green)]">
                        Grammatik_B1_Lektion_4.pdf
                      </span>
                    </div>
                    <span className="shrink-0 text-[11px] font-sans text-[var(--color-charcoal)]/60">
                      Page 1 / 14
                    </span>
                  </div>

                  {/* Actual PDF Reader Interface Screenshot */}
                  <div className="relative overflow-hidden rounded-xl border border-neutral-100 bg-white">
                    <Image
                      src="/images/pdf-reader-ui.png"
                      alt="LingoPDF PDF Reader displaying German grammar document with inline floating dictionary tooltip for the verb Kommen"
                      width={565}
                      height={508}
                      priority
                      className="w-full h-auto object-contain block"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Three Product-Benefit Blocks */}
        <section className="py-16 sm:py-24 border-t border-[var(--color-soft-sage)]/60 bg-[var(--color-warm-ivory)]/40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[var(--color-forest-green)]">
                Understand the document, not just the words.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10">
              {/* Benefit 1 */}
              <div className="flex flex-col items-start p-8 rounded-2xl bg-white border border-[var(--color-soft-sage)] shadow-xs">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-warm-ivory)] border border-[var(--color-soft-sage)] text-[var(--color-forest-green)] mb-6">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h3 className="font-heading text-xl font-bold text-[var(--color-forest-green)] mb-3">
                  Read in context
                </h3>
                <p className="text-sm text-[var(--color-charcoal)]/80 leading-relaxed font-sans">
                  Look up German words and phrases on the page without context-switching to browser tabs, external dictionaries, or third-party web apps.
                </p>
              </div>

              {/* Benefit 2 */}
              <div className="flex flex-col items-start p-8 rounded-2xl bg-white border border-[var(--color-soft-sage)] shadow-xs">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-warm-ivory)] border border-[var(--color-soft-sage)] text-[var(--color-forest-green)] mb-6">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="font-heading text-xl font-bold text-[var(--color-forest-green)] mb-3">
                  Minimal delay
                </h3>
                <p className="text-sm text-[var(--color-charcoal)]/80 leading-relaxed font-sans">
                  Instant 50ms dictionary lookups ensure you stay in your document’s flow, with zero cloud round-trips for everyday vocabulary.
                </p>
              </div>

              {/* Benefit 3 */}
              <div className="flex flex-col items-start p-8 rounded-2xl bg-white border border-[var(--color-soft-sage)] shadow-xs">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-warm-ivory)] border border-[var(--color-soft-sage)] text-[var(--color-forest-green)] mb-6">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <h3 className="font-heading text-xl font-bold text-[var(--color-forest-green)] mb-3">
                  Buy once
                </h3>
                <p className="text-sm text-[var(--color-charcoal)]/80 leading-relaxed font-sans">
                  A fair license with a one-time purchase. No monthly recurring fees, hidden tokens, or locked-in subscriptions.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Featured German–English Product Section */}
        <section id="featured-product" className="py-20 sm:py-28">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="rounded-3xl border border-[var(--color-soft-sage)] bg-white p-8 sm:p-12 lg:p-16 shadow-sm">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
                {/* Left: Focused crop & composition of actual reader UI */}
                <div className="lg:col-span-6 flex justify-center">
                  <div className="w-full rounded-2xl bg-[var(--color-warm-ivory)]/50 p-4 border border-[var(--color-soft-sage)]/70 shadow-inner">
                    <div className="overflow-hidden rounded-xl bg-white shadow-md border border-[var(--color-soft-sage)]">
                      <Image
                        src="/images/pdf-reader-ui.png"
                        alt="Authentic LingoPDF reader showing on-demand vocabulary translation for German PDF texts"
                        width={565}
                        height={508}
                        className="w-full h-auto object-cover object-top scale-[1.03] transition-transform duration-500 hover:scale-[1.05]"
                      />
                    </div>
                  </div>
                </div>

                {/* Right: Product Details, Tags, Pricing & CTA */}
                <div className="lg:col-span-6 flex flex-col items-start">
                  <Badge variant="forest" className="mb-3">
                    Available Now
                  </Badge>

                  <h2 className="font-heading text-3xl sm:text-4xl font-bold text-[var(--color-forest-green)] tracking-tight mb-1">
                    LingoPDF PDF Reader
                  </h2>

                  <span className="text-sm font-semibold text-[var(--color-terracotta)] mb-4">
                    German → English Edition
                  </span>

                  <p className="font-sans text-sm sm:text-base text-[var(--color-charcoal)]/80 leading-relaxed mb-6">
                    Read German PDFs effortlessly with on-demand vocabulary lookup. Built for academic papers, legal contracts, literature, and everyday PDFs with instant dictionary results.
                  </p>

                  {/* Feature Tags */}
                  <div className="flex flex-wrap gap-2.5 mb-8">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-warm-ivory)] border border-[var(--color-soft-sage)] text-xs font-medium text-[var(--color-forest-green)]">
                      ✓ Native Chrome &amp; Web PDFs
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-warm-ivory)] border border-[var(--color-soft-sage)] text-xs font-medium text-[var(--color-forest-green)]">
                      ✓ Offline / OCR Support
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-warm-ivory)] border border-[var(--color-soft-sage)] text-xs font-medium text-[var(--color-forest-green)]">
                      ✓ 400k+ Word Pairs
                    </span>
                  </div>

                  {/* Configurable Pricing Presentation */}
                  <div className="mb-6">
                    <PricingDisplay
                      price={germanPricing.price}
                      originalPrice={germanPricing.originalPrice}
                      isPromoActive={germanPricing.isPromoActive}
                      currency={germanPricing.currency}
                      periodDescription={germanPricing.periodDescription}
                    />
                  </div>

                  <ExtensionCtaButton label="Get Product" size="lg" className="w-full sm:w-auto" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Upcoming Language Products */}
        <section id="products" className="py-20 sm:py-28 bg-[var(--color-warm-ivory)] border-t border-[var(--color-soft-sage)]/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[var(--color-forest-green)]">
                One reading experience. More languages ahead.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {siteConfig.products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>

        {/* 6. Three-Step “How It Works” Section */}
        <section id="how-it-works" className="py-20 sm:py-28 bg-white border-t border-[var(--color-soft-sage)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[var(--color-forest-green)]">
                Simple to use. Powerful results.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 lg:gap-12">
              {/* Step 1 */}
              <div className="flex flex-col items-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-forest-green)] text-white font-heading font-bold text-lg mb-6 shadow-sm">
                  01
                </div>
                <h3 className="font-heading text-xl font-bold text-[var(--color-forest-green)] mb-3">
                  Open your PDF
                </h3>
                <p className="text-sm text-[var(--color-charcoal)]/80 leading-relaxed font-sans max-w-xs">
                  Open any German PDF document directly inside your Chrome or Edge browser window.
                </p>
              </div>

              {/* Step 2 */}
              <div className="flex flex-col items-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-forest-green)] text-white font-heading font-bold text-lg mb-6 shadow-sm">
                  02
                </div>
                <h3 className="font-heading text-xl font-bold text-[var(--color-forest-green)] mb-3">
                  Select a word
                </h3>
                <p className="text-sm text-[var(--color-charcoal)]/80 leading-relaxed font-sans max-w-xs">
                  Hover or click on any unfamiliar word while reading to reveal instant grammar and definitions.
                </p>
              </div>

              {/* Step 3 */}
              <div className="flex flex-col items-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-forest-green)] text-white font-heading font-bold text-lg mb-6 shadow-sm">
                  03
                </div>
                <h3 className="font-heading text-xl font-bold text-[var(--color-forest-green)] mb-3">
                  Understand the meaning
                </h3>
                <p className="text-sm text-[var(--color-charcoal)]/80 leading-relaxed font-sans max-w-xs">
                  See full translations and verb forms without losing your place or interrupting your train of thought.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 7. Dark Forest-Green Privacy and Local-Processing Section */}
        <section id="privacy" className="py-20 lg:py-28 bg-[var(--color-forest-green)] text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
              {/* Left Column: Privacy Principles */}
              <div className="lg:col-span-7 flex flex-col items-start">
                <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-6">
                  Your documents stay yours.
                </h2>

                <p className="font-sans text-base sm:text-lg text-[#E8E4D9]/90 leading-relaxed mb-8 max-w-xl">
                  LingoPDF is designed around local document processing. No OCR or dictionary lookups require sending your PDF contents to a remote cloud server.
                </p>

                <div className="space-y-4 w-full mb-8">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-terracotta)] text-white text-xs font-bold">
                      ✓
                    </span>
                    <span className="text-sm sm:text-base font-medium text-white">
                      Local-first execution
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-terracotta)] text-white text-xs font-bold">
                      ✓
                    </span>
                    <span className="text-sm sm:text-base font-medium text-white">
                      Zero external storage
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-terracotta)] text-white text-xs font-bold">
                      ✓
                    </span>
                    <span className="text-sm sm:text-base font-medium text-white">
                      Works fully offline
                    </span>
                  </div>
                </div>

                <Link
                  href="/privacy"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-terracotta)] hover:text-[#e8906f] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-terracotta)] rounded-md px-1 py-0.5"
                >
                  <span>Learn about Privacy</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </div>

              {/* Right Column: Privacy Illustration */}
              <div className="lg:col-span-5 flex justify-center">
                <PrivacyIllustration />
              </div>
            </div>
          </div>
        </section>

        {/* 8. Final Pricing CTA */}
        <section id="pricing" className="py-20 sm:py-28 bg-[var(--color-warm-ivory)]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-[var(--color-forest-green)] mb-12">
              Start reading with confidence.
            </h2>

            <div className="max-w-md mx-auto rounded-3xl border border-[var(--color-soft-sage)] bg-white p-8 sm:p-10 shadow-lg text-center">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-forest-green)]/80 mb-3 block">
                German–English Extension
              </span>

              <div className="my-6">
                <PricingDisplay
                  price={germanPricing.price}
                  originalPrice={germanPricing.originalPrice}
                  isPromoActive={germanPricing.isPromoActive}
                  currency={germanPricing.currency}
                  periodDescription={germanPricing.periodDescription}
                  align="center"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-left my-8 py-6 border-y border-[var(--color-soft-sage)]/70 text-xs sm:text-sm text-[var(--color-charcoal)]/80">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--color-terracotta)] font-bold">✓</span>
                  <span>One-time payment</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--color-terracotta)] font-bold">✓</span>
                  <span>Up to 2 active devices</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--color-terracotta)] font-bold">✓</span>
                  <span>Lifetime updates</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--color-terracotta)] font-bold">✓</span>
                  <span>5 free lookups / day</span>
                </div>
              </div>

              <ExtensionCtaButton label="Get the Extension" size="lg" fullWidth className="mb-3" />

              <span className="text-xs text-[var(--color-charcoal)]/60 block">
                3-day money-back guarantee
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* 9. Footer */}
      <Footer />
    </div>
  );
}
