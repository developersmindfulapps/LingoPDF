import React from "react";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/Button";
import { ExtensionCtaButton } from "@/components/ExtensionCtaButton";
import { PricingDisplay } from "@/components/PricingDisplay";
import { PrivacyIllustration } from "@/components/PrivacyIllustration";
import { FaqAccordion } from "@/components/FaqAccordion";
import { siteConfig } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "LingoPDF PDF Reader — German to English Browser Extension",
  description:
    "Read German PDFs with effortless inline word lookup. Features local dictionary definitions, OCR for scanned documents, and offline capability after activation.",
  openGraph: {
    title: "LingoPDF PDF Reader — German to English",
    description:
      "Understand German PDFs without losing your flow. Local dictionary lookup, local OCR for scanned pages, and offline operation after activation.",
    type: "website",
  },
};

const FAQ_ITEMS = [
  {
    question: "What is LingoPDF PDF Reader?",
    answer:
      "LingoPDF PDF Reader is a lightweight browser extension built to help you read German PDFs effortlessly. It provides instant, contextual vocabulary and grammar lookups right on the page without requiring you to switch between browser tabs or external translation tools.",
  },
  {
    question: "Does it work with scanned PDFs?",
    answer:
      "Yes. The extension includes built-in local OCR (Optical Character Recognition) capabilities to detect and recognize text on supported scanned PDF documents, allowing you to select and inspect words as easily as in digital-native PDFs.",
  },
  {
    question: "Does my PDF get uploaded to a server?",
    answer:
      "No. LingoPDF is built around local-first document processing. Ordinary dictionary lookups and local OCR operations run directly within your browser session without transmitting your PDF contents to remote translation servers.",
  },
  {
    question: "Can I use it offline?",
    answer:
      "Yes. Once purchased and activated, all core dictionary data and processing tools run locally on your machine, enabling full offline reading support without an active internet connection.",
  },
  {
    question: "Is this a subscription?",
    answer:
      "No. LingoPDF is offered as a single one-time payment for a lifetime license with no recurring fees, hidden charges, or active subscription renewals.",
  },
  {
    question: "How does the free tier work?",
    answer:
      "You can explore LingoPDF with up to five free word lookups per day. To unlock unlimited lookups, offline access, and full OCR support, simply activate your lifetime license.",
  },
  {
    question: "What is the refund policy?",
    answer:
      "We offer a 7-day money-back guarantee from your date of purchase, subject to our standard published refund terms. If LingoPDF does not meet your reading needs, contact support for a prompt refund.",
  },
];

export default function GermanEnglishProductPage() {
  const germanPricing = siteConfig.pricing.german;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-warm-ivory)] text-[var(--color-charcoal)] antialiased selection:bg-[var(--color-soft-sage)] selection:text-[var(--color-forest-green)]">
      {/* 1. Global Navigation */}
      <Navbar />

      <main className="flex-1">
        {/* Section A: Product Hero */}
        <section className="relative overflow-hidden pt-12 pb-20 sm:pt-16 sm:pb-24 lg:pt-20 lg:pb-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
              {/* Left Column: Eyebrow, Heading, Copy, CTAs, Trust points */}
              <div className="lg:col-span-7 flex flex-col items-start text-left z-10">
                <span className="text-xs sm:text-sm font-bold uppercase tracking-widest text-[var(--color-terracotta)] mb-4 inline-block">
                  LingoPDF PDF Reader · German → English
                </span>

                <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[var(--color-forest-green)] leading-[1.1] mb-6">
                  Understand German PDFs without losing your flow.
                </h1>

                <p className="font-sans text-base sm:text-lg lg:text-xl text-[var(--color-charcoal)]/80 max-w-xl leading-relaxed mb-8">
                  Look up German words directly inside your PDFs with a local dictionary and OCR for scanned pages. Stay focused on what you&apos;re reading instead of constantly switching between applications.
                </p>

                {/* Primary & Secondary CTAs */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto mb-10">
                  <ExtensionCtaButton label="Get the Extension" size="lg" />
                  <Button variant="secondary" size="lg" href="#how-it-works">
                    How It Works
                  </Button>
                </div>

                {/* Concise Trust Points */}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-6 border-t border-[var(--color-soft-sage)] w-full">
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
                    <span>OCR for scanned PDFs</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-[var(--color-charcoal)]/80">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-forest-green)]/10 text-[var(--color-forest-green)]">
                      ✓
                    </span>
                    <span>Offline use after activation</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-[var(--color-charcoal)]/80">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-forest-green)]/10 text-[var(--color-forest-green)]">
                      ✓
                    </span>
                    <span>One-time purchase</span>
                  </div>
                </div>
              </div>

              {/* Right Column: PDF Reader Screenshot in Clean Frame */}
              <div className="lg:col-span-5 flex justify-center lg:justify-end">
                <div className="relative w-full max-w-[500px] rounded-2xl bg-white p-3 sm:p-4 shadow-2xl border border-[var(--color-soft-sage)] transition-transform duration-300 hover:scale-[1.01]">
                  {/* Subtle PDF Document Top Bar */}
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

                  {/* PDF Reader Screenshot */}
                  <div className="relative overflow-hidden rounded-xl border border-neutral-100 bg-white">
                    <Image
                      src="/images/pdf-reader-ui.png"
                      alt="LingoPDF PDF Reader interface showing a German document with selected word 'Kommen' and an inline dictionary tooltip explaining its definition"
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

        {/* Section B: Product Benefits */}
        <section className="py-16 sm:py-24 border-t border-[var(--color-soft-sage)]/60 bg-[var(--color-warm-ivory)]/40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-[var(--color-forest-green)]">
                Everything you need to keep reading.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10">
              {/* Benefit 1 */}
              <div className="flex flex-col items-start p-8 rounded-2xl bg-white border border-[var(--color-soft-sage)] shadow-xs">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-warm-ivory)] border border-[var(--color-soft-sage)] text-[var(--color-forest-green)] mb-6">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h3 className="font-heading text-xl font-bold text-[var(--color-forest-green)] mb-3">
                  Read in context
                </h3>
                <p className="text-sm text-[var(--color-charcoal)]/80 leading-relaxed font-sans">
                  Select words inside the PDF and view their meanings without repeatedly switching to another application.
                </p>
              </div>

              {/* Benefit 2 */}
              <div className="flex flex-col items-start p-8 rounded-2xl bg-white border border-[var(--color-soft-sage)] shadow-xs">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-warm-ivory)] border border-[var(--color-soft-sage)] text-[var(--color-forest-green)] mb-6">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5zM6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
                  </svg>
                </div>
                <h3 className="font-heading text-xl font-bold text-[var(--color-forest-green)] mb-3">
                  Read scanned documents
                </h3>
                <p className="text-sm text-[var(--color-charcoal)]/80 leading-relaxed font-sans">
                  Use local OCR resources to recognize text on supported scanned PDF pages.
                </p>
              </div>

              {/* Benefit 3 */}
              <div className="flex flex-col items-start p-8 rounded-2xl bg-white border border-[var(--color-soft-sage)] shadow-xs">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-warm-ivory)] border border-[var(--color-soft-sage)] text-[var(--color-forest-green)] mb-6">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                </div>
                <h3 className="font-heading text-xl font-bold text-[var(--color-forest-green)] mb-3">
                  Keep your documents local
                </h3>
                <p className="text-sm text-[var(--color-charcoal)]/80 leading-relaxed font-sans">
                  Dictionary lookup and OCR are designed to run locally. Ordinary word lookups do not require uploading PDF contents to a translation server.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section C: How It Works */}
        <section id="how-it-works" className="py-20 sm:py-28 bg-[var(--color-warm-ivory)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16 sm:mb-20">
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[var(--color-terracotta)] mb-3 block">
                Workflow
              </span>
              <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-[var(--color-forest-green)]">
                From unfamiliar words to understanding.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 lg:gap-12 relative">
              {/* Step 1 */}
              <div className="flex flex-col items-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-forest-green)] text-white font-heading font-bold text-lg mb-6 shadow-sm">
                  01
                </div>
                <h3 className="font-heading text-xl font-bold text-[var(--color-forest-green)] mb-3">
                  Open your PDF
                </h3>
                <p className="text-sm text-[var(--color-charcoal)]/80 leading-relaxed font-sans max-w-xs">
                  Open a supported PDF directly in the extension&apos;s reader inside Chrome or Edge.
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
                  Select or hover over any German word directly on the page to trigger instant analysis.
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
                  Read the dictionary result and grammatical inflection details, then continue reading effortlessly.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section D: Product Demonstration */}
        <section className="py-20 sm:py-28 border-t border-[var(--color-soft-sage)]/60 bg-[var(--color-warm-ivory)]/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-14">
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[var(--color-terracotta)] mb-3 block">
                Interface in Action
              </span>
              <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-[var(--color-forest-green)] mb-4">
                Designed to preserve your reading concentration.
              </h2>
              <p className="text-base text-[var(--color-charcoal)]/80 font-sans">
                Experience how LingoPDF integrates directly into your document workflow without disruptive tab switching.
              </p>
            </div>

            <div className="max-w-5xl mx-auto rounded-3xl bg-white p-4 sm:p-8 shadow-xl border border-[var(--color-soft-sage)]">
              {/* Document Browser Frame */}
              <div className="mb-4 flex items-center justify-between rounded-xl bg-[var(--color-warm-ivory)] px-4 py-2.5 text-xs font-mono text-[var(--color-charcoal)]/70 border border-[var(--color-soft-sage)]">
                <div className="flex items-center gap-2 truncate">
                  <span className="h-3 w-3 rounded-full bg-[var(--color-terracotta)]/80" />
                  <span className="truncate font-sans font-medium text-[var(--color-forest-green)]">
                    Grammatik_B1_Lektion_4.pdf — LingoPDF Reader Mode
                  </span>
                </div>
                <span className="shrink-0 text-xs font-sans text-[var(--color-charcoal)]/60">
                  German → English
                </span>
              </div>

              {/* Expanded Interface Demonstration */}
              <div className="overflow-hidden rounded-2xl border border-[var(--color-soft-sage)]/60 bg-white shadow-inner">
                <Image
                  src="/images/pdf-reader-ui.png"
                  alt="Expanded demonstration of LingoPDF PDF Reader displaying a German document with selected verb 'Kommen' and an inline floating dictionary lookup"
                  width={1130}
                  height={1016}
                  className="w-full h-auto object-cover"
                />
              </div>

              {/* Explanatory Callouts */}
              <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-[var(--color-soft-sage)]/60 text-left">
                <div>
                  <h4 className="font-heading text-base font-bold text-[var(--color-forest-green)] mb-1.5 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[var(--color-forest-green)]" />
                    German document
                  </h4>
                  <p className="text-xs sm:text-sm text-[var(--color-charcoal)]/80 leading-relaxed font-sans">
                    Read native or scanned German text in an uncluttered document reader built for long sessions.
                  </p>
                </div>
                <div>
                  <h4 className="font-heading text-base font-bold text-[var(--color-forest-green)] mb-1.5 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[var(--color-forest-green)]" />
                    Selected word
                  </h4>
                  <p className="text-xs sm:text-sm text-[var(--color-charcoal)]/80 leading-relaxed font-sans">
                    Highlight or click any word on the page to target its exact grammatical root form.
                  </p>
                </div>
                <div>
                  <h4 className="font-heading text-base font-bold text-[var(--color-forest-green)] mb-1.5 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[var(--color-terracotta)]" />
                    Floating dictionary result
                  </h4>
                  <p className="text-xs sm:text-sm text-[var(--color-charcoal)]/80 leading-relaxed font-sans">
                    Instantly view concise contextual English translations, parts of speech, and usage definitions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section E: Feature List */}
        <section id="features" className="py-20 sm:py-28 bg-[var(--color-warm-ivory)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[var(--color-terracotta)] mb-3 block">
                Capabilities
              </span>
              <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-[var(--color-forest-green)]">
                Built specifically for readers, researchers, and students.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {/* Feature 1 */}
              <div className="p-6 sm:p-7 rounded-2xl bg-white border border-[var(--color-soft-sage)] shadow-xs">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-warm-ivory)] text-[var(--color-forest-green)] font-bold text-sm mb-4">
                  01
                </div>
                <h3 className="font-heading text-lg font-bold text-[var(--color-forest-green)] mb-2">
                  Native PDF text selection
                </h3>
                <p className="text-sm text-[var(--color-charcoal)]/80 leading-relaxed font-sans">
                  Select words directly on standard digital PDF pages just like native browser text.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="p-6 sm:p-7 rounded-2xl bg-white border border-[var(--color-soft-sage)] shadow-xs">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-warm-ivory)] text-[var(--color-forest-green)] font-bold text-sm mb-4">
                  02
                </div>
                <h3 className="font-heading text-lg font-bold text-[var(--color-forest-green)] mb-2">
                  Local OCR for supported scanned PDFs
                </h3>
                <p className="text-sm text-[var(--color-charcoal)]/80 leading-relaxed font-sans">
                  Recognize text on supported scanned document pages locally without remote processing.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="p-6 sm:p-7 rounded-2xl bg-white border border-[var(--color-soft-sage)] shadow-xs">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-warm-ivory)] text-[var(--color-forest-green)] font-bold text-sm mb-4">
                  03
                </div>
                <h3 className="font-heading text-lg font-bold text-[var(--color-forest-green)] mb-2">
                  Local dictionary lookup
                </h3>
                <p className="text-sm text-[var(--color-charcoal)]/80 leading-relaxed font-sans">
                  Comprehensive German–English dictionary queries execute instantly on your device.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="p-6 sm:p-7 rounded-2xl bg-white border border-[var(--color-soft-sage)] shadow-xs">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-warm-ivory)] text-[var(--color-forest-green)] font-bold text-sm mb-4">
                  04
                </div>
                <h3 className="font-heading text-lg font-bold text-[var(--color-forest-green)] mb-2">
                  German word forms and inflections
                </h3>
                <p className="text-sm text-[var(--color-charcoal)]/80 leading-relaxed font-sans">
                  Resolves conjugated verbs, declensions, and grammatical forms where supported.
                </p>
              </div>

              {/* Feature 5 */}
              <div className="p-6 sm:p-7 rounded-2xl bg-white border border-[var(--color-soft-sage)] shadow-xs">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-warm-ivory)] text-[var(--color-forest-green)] font-bold text-sm mb-4">
                  05
                </div>
                <h3 className="font-heading text-lg font-bold text-[var(--color-forest-green)] mb-2">
                  Side-by-side dictionary results
                </h3>
                <p className="text-sm text-[var(--color-charcoal)]/80 leading-relaxed font-sans">
                  Tooltip results render directly alongside your document to preserve your reading focus.
                </p>
              </div>

              {/* Feature 6 */}
              <div className="p-6 sm:p-7 rounded-2xl bg-white border border-[var(--color-soft-sage)] shadow-xs">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-warm-ivory)] text-[var(--color-forest-green)] font-bold text-sm mb-4">
                  06
                </div>
                <h3 className="font-heading text-lg font-bold text-[var(--color-forest-green)] mb-2">
                  Offline use after paid activation
                </h3>
                <p className="text-sm text-[var(--color-charcoal)]/80 leading-relaxed font-sans">
                  Read and inspect documents completely offline without requiring an active internet connection.
                </p>
              </div>

              {/* Feature 7 (Spans 3 cols on large screen or centers) */}
              <div className="p-6 sm:p-7 rounded-2xl bg-white border border-[var(--color-soft-sage)] shadow-xs md:col-span-2 lg:col-span-3">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-warm-ivory)] text-[var(--color-forest-green)] font-bold text-sm">
                    07
                  </div>
                  <div>
                    <h3 className="font-heading text-lg font-bold text-[var(--color-forest-green)] mb-2">
                      One-time purchase rather than a subscription
                    </h3>
                    <p className="text-sm text-[var(--color-charcoal)]/80 leading-relaxed font-sans max-w-3xl">
                      A fair, transparent license model. Pay once and keep using the reader without recurring monthly fees.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section F: Privacy Section (Reusing visual style from homepage) */}
        <section id="privacy" className="py-20 lg:py-28 bg-[var(--color-forest-green)] text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
              {/* Left Column: Privacy Principles */}
              <div className="lg:col-span-7 flex flex-col items-start">
                <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-6">
                  Your documents stay yours.
                </h2>

                <p className="font-sans text-base sm:text-lg text-[#E8E4D9]/90 leading-relaxed mb-8 max-w-xl">
                  LingoPDF is designed around local document processing. Ordinary dictionary lookups and local OCR operations do not require uploading your PDF contents to a remote translation server.
                </p>

                <div className="space-y-4 w-full mb-8">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-terracotta)] text-white text-xs font-bold">
                      ✓
                    </span>
                    <span className="text-sm sm:text-base font-medium text-white">
                      Local dictionary and OCR execution
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-terracotta)] text-white text-xs font-bold">
                      ✓
                    </span>
                    <span className="text-sm sm:text-base font-medium text-white">
                      Zero remote document storage
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-terracotta)] text-white text-xs font-bold">
                      ✓
                    </span>
                    <span className="text-sm sm:text-base font-medium text-white">
                      Operates offline after license activation
                    </span>
                  </div>
                </div>

                <Link
                  href="/privacy"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-terracotta)] hover:text-[#e8906f] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-terracotta)] rounded-md px-1 py-0.5"
                >
                  <span>Learn about our Privacy Policy</span>
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

        {/* Section G: Pricing Section */}
        <section id="pricing" className="py-20 sm:py-28 bg-[var(--color-warm-ivory)]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[var(--color-terracotta)] mb-3 block">
              Investment
            </span>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-[var(--color-forest-green)] mb-12">
              Simple pricing. Keep reading.
            </h2>

            <div className="max-w-md mx-auto rounded-3xl border border-[var(--color-soft-sage)] bg-white p-8 sm:p-10 shadow-lg text-center">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-forest-green)]/80 mb-3 block">
                LingoPDF PDF Reader — German → English
              </span>

              <div className="my-6">
                <PricingDisplay
                  price={germanPricing.price}
                  originalPrice={germanPricing.originalPrice}
                  isPromoActive={germanPricing.isPromoActive}
                  currency={germanPricing.currency}
                  periodDescription="One-time payment • No subscription"
                  align="center"
                />
              </div>

              <div className="space-y-3 text-left my-8 py-6 border-y border-[var(--color-soft-sage)]/70 text-xs sm:text-sm text-[var(--color-charcoal)]/80">
                <div className="flex items-center gap-2.5">
                  <span className="text-[var(--color-terracotta)] font-bold">✓</span>
                  <span>One-time payment for lifetime license</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-[var(--color-terracotta)] font-bold">✓</span>
                  <span>No subscription or recurring charges</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-[var(--color-terracotta)] font-bold">✓</span>
                  <span>Seven-day money-back guarantee</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-[var(--color-terracotta)] font-bold">✓</span>
                  <span>Five free word lookups per day before upgrading</span>
                </div>
              </div>

              <ExtensionCtaButton label="Get the Extension" size="lg" fullWidth className="mb-4" />

              <p className="text-xs text-[var(--color-charcoal)]/60 leading-relaxed font-sans">
                Full unlimited access requires purchase and activation. 7-day money-back guarantee.
              </p>
            </div>
          </div>
        </section>

        {/* Section H: Frequently Asked Questions */}
        <section id="faq" className="py-20 sm:py-28 border-t border-[var(--color-soft-sage)]/60 bg-[var(--color-warm-ivory)]/40">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[var(--color-terracotta)] mb-3 block">
                Questions & Answers
              </span>
              <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-[var(--color-forest-green)]">
                Frequently asked questions.
              </h2>
            </div>

            <FaqAccordion items={FAQ_ITEMS} />
          </div>
        </section>

        {/* Section I: Final CTA */}
        <section className="py-20 sm:py-28 bg-[var(--color-warm-ivory)] border-t border-[var(--color-soft-sage)]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[var(--color-forest-green)] mb-6">
              Ready to read German with confidence?
            </h2>

            <p className="font-sans text-base sm:text-lg text-[var(--color-charcoal)]/80 max-w-xl mx-auto leading-relaxed mb-10">
              Spend less time switching tools and more time understanding what you read.
            </p>

            <div className="flex justify-center">
              <ExtensionCtaButton label="Get the Extension" size="lg" />
            </div>
          </div>
        </section>
      </main>

      {/* 9. Global Footer */}
      <Footer />
    </div>
  );
}
