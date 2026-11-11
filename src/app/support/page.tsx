import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { FaqAccordion, type FaqItem } from "@/components/FaqAccordion";
import { ContactFormClient } from "./ContactFormClient";

export const metadata: Metadata = {
  title: "LingoPDF Support | Help & Frequently Asked Questions",
  description:
    "Find answers to common LingoPDF questions or contact our support team for assistance with the German vocabulary-building PDF reader.",
  alternates: {
    canonical: "https://www.lingopdf.in/support",
  },
  openGraph: {
    title: "LingoPDF Support | Help & Frequently Asked Questions",
    description:
      "Find answers to common LingoPDF questions or contact our support team for assistance with the German vocabulary-building PDF reader.",
    url: "https://www.lingopdf.in/support",
    type: "website",
  },
};

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "What is LingoPDF?",
    answer:
      "LingoPDF is a vocabulary-building PDF reader that helps you understand unfamiliar German words while reading. Select a word to see its English meaning and relevant grammatical information without switching to another application.",
  },
  {
    question: "Which languages are currently supported?",
    answer:
      "The currently available edition focuses on German-to-English vocabulary lookup. Additional language editions, including French and Italian, are planned for the future.",
  },
  {
    question: "Does LingoPDF translate the entire PDF?",
    answer:
      "No. LingoPDF is designed for vocabulary learning, not whole-document translation. It helps you understand individual words and their meanings in the context of your reading.",
  },
  {
    question: "Can I use LingoPDF with scanned PDFs?",
    answer:
      "Yes. LingoPDF includes local OCR functionality for scanned PDF pages. OCR processing happens on your device, and scanned page images are not uploaded to LingoPDF servers.",
  },
  {
    question: "Are my PDF documents uploaded to your servers?",
    answer:
      "No. PDF reading, text processing, dictionary lookup and OCR are designed to run locally on your device. LingoPDF does not upload your PDF contents to its servers.",
  },
  {
    question: "Does LingoPDF work offline?",
    answer:
      "The current extension's PDF reading and local dictionary functionality are designed for offline use. Future commercial licensing may require periodic online verification. Consult the product documentation for the current release's requirements.",
  },
  {
    question: "Is LingoPDF free?",
    answer:
      "LingoPDF is currently available free of charge to a limited group of invited testers during its private promotional preview. There is no permanent public free tier or free trial planned for the commercial launch.",
  },
  {
    question: "How can I report a problem or request help?",
    answer:
      "You can use the contact form on this page or email support@lingopdf.in. Please include a description of the issue and the browser you are using. Never send passwords or sensitive personal information.",
  },
];

export default function SupportPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-warm-ivory)] text-[var(--color-charcoal)] antialiased selection:bg-[var(--color-soft-sage)] selection:text-[var(--color-forest-green)]">
      {/* FAQ Schema for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <Navbar />

      <main className="flex-1 py-12 sm:py-16 lg:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Hero Section */}
          <section className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
            <span className="inline-block text-xs sm:text-sm font-bold uppercase tracking-widest text-[var(--color-terracotta)] mb-3">
              Customer Support &amp; Knowledge Base
            </span>
            <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[var(--color-forest-green)] mb-6">
              We&apos;re here to help.
            </h1>
            <p className="text-base sm:text-lg text-[var(--color-charcoal)]/80 leading-relaxed font-sans mb-6">
              Whether you have a question about using LingoPDF, encounter a problem while reading a
              PDF, or need assistance, we&apos;re happy to help.
            </p>
            <p className="text-sm sm:text-base text-[var(--color-charcoal)]/70 font-sans">
              Find quick answers to common questions in our FAQ below, or submit a request directly
              to our team using the contact form or by emailing{" "}
              <a
                href="mailto:support@lingopdf.in"
                className="font-semibold text-[var(--color-forest-green)] underline hover:text-[var(--color-terracotta)] transition-colors"
              >
                support@lingopdf.in
              </a>
              .
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <a
                href="#contact"
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl font-heading font-semibold text-white bg-[var(--color-forest-green)] hover:bg-[#122B24] transition-all shadow-xs"
              >
                Contact Support
              </a>
              <a
                href="#faq"
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl font-heading font-semibold text-[var(--color-forest-green)] bg-white border border-[var(--color-soft-sage)] hover:border-[var(--color-forest-green)]/40 transition-all shadow-xs"
              >
                Browse FAQs
              </a>
            </div>
          </section>

          {/* Quick Support Info Cards */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16 sm:mb-20">
            <div className="bg-white rounded-2xl border border-[var(--color-soft-sage)] p-6 shadow-2xs">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-warm-ivory)] border border-[var(--color-soft-sage)] flex items-center justify-center text-[var(--color-forest-green)] mb-4">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                  />
                </svg>
              </div>
              <h2 className="font-heading text-lg font-bold text-[var(--color-forest-green)] mb-1">
                Email Us Directly
              </h2>
              <p className="text-sm text-[var(--color-charcoal)]/70 mb-3 font-sans">
                For general inquiries, feedback, or technical help.
              </p>
              <a
                href="mailto:support@lingopdf.in"
                className="text-sm font-semibold font-mono text-[var(--color-forest-green)] underline hover:text-[var(--color-terracotta)]"
              >
                support@lingopdf.in
              </a>
            </div>

            <div className="bg-white rounded-2xl border border-[var(--color-soft-sage)] p-6 shadow-2xs">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-warm-ivory)] border border-[var(--color-soft-sage)] flex items-center justify-center text-[var(--color-forest-green)] mb-4">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                  />
                </svg>
              </div>
              <h2 className="font-heading text-lg font-bold text-[var(--color-forest-green)] mb-1">
                Local-First Privacy
              </h2>
              <p className="text-sm text-[var(--color-charcoal)]/70 mb-3 font-sans">
                PDF reading, OCR, and vocabulary lookups remain strictly local to your machine.
              </p>
              <Link
                href="/privacy"
                className="text-sm font-semibold text-[var(--color-forest-green)] underline hover:text-[var(--color-terracotta)]"
              >
                Read Privacy Policy →
              </Link>
            </div>

            <div className="bg-white rounded-2xl border border-[var(--color-soft-sage)] p-6 shadow-2xs">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-warm-ivory)] border border-[var(--color-soft-sage)] flex items-center justify-center text-[var(--color-forest-green)] mb-4">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h2 className="font-heading text-lg font-bold text-[var(--color-forest-green)] mb-1">
                Preview Access
              </h2>
              <p className="text-sm text-[var(--color-charcoal)]/70 mb-3 font-sans">
                Currently available during private promotional preview for invited testers.
              </p>
              <Link
                href="/#pricing"
                className="text-sm font-semibold text-[var(--color-forest-green)] underline hover:text-[var(--color-terracotta)]"
              >
                Preview Details →
              </Link>
            </div>
          </section>

          {/* Frequently Asked Questions Section */}
          <section id="faq" className="scroll-mt-24 mb-16 sm:mb-20">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <span className="text-xs sm:text-sm font-bold uppercase tracking-widest text-[var(--color-terracotta)] mb-2 block">
                Got Questions?
              </span>
              <h2 className="font-heading text-2xl sm:text-3xl font-bold text-[var(--color-forest-green)]">
                Frequently Asked Questions
              </h2>
              <p className="text-sm sm:text-base text-[var(--color-charcoal)]/75 mt-2 font-sans">
                Here are answers to the most common questions about the current German-to-English
                edition of LingoPDF.
              </p>
            </div>

            <FaqAccordion items={FAQ_ITEMS} />
          </section>

          {/* Contact Form Section */}
          <section id="contact" className="scroll-mt-24">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <span className="text-xs sm:text-sm font-bold uppercase tracking-widest text-[var(--color-terracotta)] mb-2 block">
                Get in Touch
              </span>
              <h2 className="font-heading text-2xl sm:text-3xl font-bold text-[var(--color-forest-green)]">
                Contact Our Support Team
              </h2>
              <p className="text-sm sm:text-base text-[var(--color-charcoal)]/75 mt-2 font-sans">
                Need more help or have a suggestion? Send us a message and we&apos;ll be in touch.
              </p>
            </div>

            <ContactFormClient />
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
