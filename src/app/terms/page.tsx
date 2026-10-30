import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Terms of Service — LingoPDF",
  description:
    "Review the Terms of Service governing your use of the LingoPDF website (https://lingopdf.in) and the LingoPDF PDF Reader browser extension.",
  alternates: {
    canonical: "https://lingopdf.in/terms",
  },
  openGraph: {
    title: "Terms of Service — LingoPDF",
    description:
      "Terms of Service, license terms, usage limits, and refund policies for LingoPDF.",
    url: "https://lingopdf.in/terms",
    type: "website",
  },
};

const SECTIONS = [
  { id: "acceptance", title: "1. Acceptance of Terms" },
  { id: "product-description", title: "2. Product Description and Supported Languages" },
  { id: "free-tier", title: "3. Free-Tier Usage Limits" },
  { id: "paid-licenses", title: "4. Paid Licenses, Permitted Use, and Installation Limits" },
  { id: "purchases-pricing", title: "5. One-Time Purchases and Regional Pricing" },
  { id: "money-back-guarantee", title: "6. Three-Day Money-Back Guarantee" },
  { id: "account-responsibilities", title: "7. Account Responsibilities" },
  { id: "acceptable-use", title: "8. Acceptable Use and Prohibited Abuse" },
  { id: "intellectual-property", title: "9. Intellectual Property" },
  { id: "availability-compatibility", title: "10. Product Availability, Updates, and Compatibility" },
  { id: "disclaimers-liability", title: "11. Warranty Disclaimers and Limitation of Liability" },
  { id: "suspension-termination", title: "12. Suspension or Termination" },
  { id: "changes-to-terms", title: "13. Changes to the Terms" },
  { id: "governing-law", title: "14. Governing Law and Dispute Resolution" },
  { id: "contact-information", title: "15. Contact Information" },
];

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-warm-ivory)] text-[var(--color-charcoal)] antialiased selection:bg-[var(--color-soft-sage)] selection:text-[var(--color-forest-green)]">
      <Navbar />

      <main className="flex-1 py-12 sm:py-16 lg:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-12 border-b border-[var(--color-soft-sage)] pb-8">
            <span className="text-xs sm:text-sm font-bold uppercase tracking-widest text-[var(--color-terracotta)] mb-3 block">
              Legal Documentation
            </span>
            <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[var(--color-forest-green)] mb-4">
              Terms of Service
            </h1>
            <p className="text-sm sm:text-base text-[var(--color-charcoal)]/70 font-sans">
              Last updated: October 2026 • Operational for https://lingopdf.in
            </p>
          </div>

          {/* Table of Contents */}
          <nav
            aria-label="Table of contents"
            className="mb-14 rounded-2xl border border-[var(--color-soft-sage)] bg-white p-6 sm:p-8 shadow-2xs"
          >
            <h2 className="font-heading text-lg font-bold text-[var(--color-forest-green)] mb-4">
              Table of Contents
            </h2>
            <ol className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs sm:text-sm font-sans">
              {SECTIONS.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="text-[var(--color-charcoal)]/80 hover:text-[var(--color-forest-green)] hover:underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-forest-green)] rounded px-1 py-0.5 block"
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          {/* Terms Content */}
          <div className="space-y-12 text-[var(--color-charcoal)]/90 font-sans leading-relaxed text-sm sm:text-base">
            {/* 1. Acceptance of terms */}
            <section id="acceptance" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                1. Acceptance of Terms
              </h2>
              <p>
                By accessing our website (<strong>https://lingopdf.in</strong>), registering an account,
                or downloading, installing, or using the LingoPDF PDF Reader browser extension, you agree
                to be bound by these Terms of Service. If you do not agree with any part of these terms,
                you must not access the website or use the extension software.
              </p>
              <p>
                These terms govern your access to both our public and authenticated web resources and the
                local client-side software tools we provide.
              </p>
            </section>

            {/* 2. Product description and supported languages */}
            <section id="product-description" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                2. Product Description and Supported Languages
              </h2>
              <p>
                LingoPDF develops browser-based reading software designed to provide contextual
                vocabulary definitions and grammatical insights for foreign-language documents.
              </p>
              <p>
                The primary implemented product is the{" "}
                <strong>LingoPDF PDF Reader — German → English</strong>, which features native PDF word
                selection, local dictionary definitions, grammatical inflection parsing, and client-side
                optical character recognition (OCR) for compatible scanned PDF documents.
              </p>
              <p>
                Additional language editions (including French → English and Italian → English) are
                currently in development and have not yet been commercially released. Mention of planned
                language editions represents our forward-looking product roadmap and does not constitute
                a binding delivery commitment, specific timeline, or immediate product entitlement.
              </p>
            </section>

            {/* 3. Free-tier usage limits */}
            <section id="free-tier" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                3. Free-Tier Usage Limits
              </h2>
              <p>
                LingoPDF provides a complimentary free tier that allows prospective users to test the
                extension with a limit of{" "}
                <strong>five (5) free word lookups per calendar day</strong>.
              </p>
              <p>
                <strong>No Time-Based Free Trial:</strong> We do not offer or impose a time-limited free
                trial (such as a 3-day or 7-day trial). The five-lookups-per-day allowance is ongoing and
                renews daily.
              </p>
              <p>
                This lookup limit is monitored and stored locally within your browser storage session.
                Attempting to circumvent, script, reset, or tamper with local storage or browser memory
                to bypass the daily free quota is strictly prohibited under our acceptable use policy.
              </p>
            </section>

            {/* 4. Paid licenses, permitted use, and the two-active-installation limit */}
            <section id="paid-licenses" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                4. Paid Licenses, Permitted Use, and Installation Limits
              </h2>
              <p>
                <em>Please note: Commercial licensing and online checkout are not yet active on this website. Commercial licenses will become available upon the launch of commercial licensing (Phase 7A).</em>
              </p>
              <p>
                When commercially available, purchasing a lifetime license grants you a non-exclusive,
                non-transferable, revocable personal license to install and execute the extension for
                personal, academic, or professional reading activities.
              </p>
              <p>
                <strong>Device Installation Limit:</strong> Each individual license permits activation on
                a maximum of <strong>two (2) active browser installations or personal devices</strong>{" "}
                concurrently for your own use (for example, a primary desktop workstation and a personal
                laptop). Sharing license keys, reselling activation codes, or deploying a single license
                across multi-user environments or shared pools is strictly forbidden.
              </p>
              <p>
                <strong>Offline Functionality:</strong> Following successful one-time license activation,
                paid functionality is engineered to work completely offline without requiring continuous
                internet connectivity.
              </p>
            </section>

            {/* 5. One-time purchases and regional pricing */}
            <section id="purchases-pricing" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                5. One-Time Purchases and Regional Pricing
              </h2>
              <p>
                LingoPDF operates on a <strong>one-time payment</strong> model for a lifetime license.
                We do not charge recurring subscriptions, monthly renewal fees, or mandatory annual dues.
              </p>
              <p>
                <strong>Regional Pricing Model:</strong> We are preparing country-specific regional pricing
                to ensure fair access across markets:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>India:</strong> INR pricing, with a proposed price point of ₹899 or ₹999 to be
                  finalised prior to checkout implementation.
                </li>
                <li>
                  <strong>United States:</strong> USD pricing, initially proposed at $49 (reference $89).
                </li>
                <li>
                  <strong>Europe:</strong> EUR pricing to be configured prior to checkout implementation.
                </li>
                <li>
                  <strong>Other Countries:</strong> USD fallback or appropriate regional currency where
                  supported by our future payment infrastructure.
                </li>
              </ul>
              <p>
                All prices displayed prior to checkout launch are proposed or tentative and are subject to
                final approval before commercial orders go live. The displayed currency and actual checkout
                currency will match. You are responsible for any applicable local sales taxes, VAT, or
                banking transaction fees imposed by your jurisdiction or financial institution.
              </p>
            </section>

            {/* 6. Three-day money-back guarantee */}
            <section id="money-back-guarantee" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                6. Three-Day Money-Back Guarantee
              </h2>
              <p>
                We provide a contractual{" "}
                <strong>three (3) calendar day money-back guarantee</strong> calculated from the exact date
                and time of your original purchase.
              </p>
              <p>
                If the LingoPDF PDF Reader does not meet your personal reading requirements, you may
                request a full refund within three calendar days of purchase by contacting our support team
                at:
              </p>
              <p className="font-mono text-sm text-[var(--color-forest-green)]">
                <a href="mailto:support@lingopdf.in" className="underline">
                  support@lingopdf.in
                </a>
              </p>
              <p>
                Upon issuance of a refund, the associated license key will be deactivated and access to
                paid features will conclude.
              </p>
              <p>
                <strong>Statutory Rights:</strong> This contractual guarantee operates in addition to, and
                does not limit, exclude, or waive, any mandatory consumer guarantees or statutory rights
                that cannot be lawfully excluded under applicable consumer protection legislation in your
                jurisdiction.
              </p>
            </section>

            {/* 7. Account responsibilities */}
            <section id="account-responsibilities" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                7. Account Responsibilities
              </h2>
              <p>
                User accounts are implemented on https://lingopdf.in. When creating an account, you agree
                to provide accurate registration information and to maintain the confidentiality of your
                account password and security credentials.
              </p>
              <p>
                You are responsible for all activities conducted through your account credentials. You
                agree to notify us immediately at{" "}
                <a href="mailto:support@lingopdf.in" className="text-[var(--color-forest-green)] underline">
                  support@lingopdf.in
                </a>{" "}
                if you suspect unauthorized access to or compromise of your account.
              </p>
              <p>
                LingoPDF is not liable for losses caused by compromised passwords or voluntary credential
                sharing by the account holder.
              </p>
            </section>

            {/* 8. Acceptable use and prohibited abuse */}
            <section id="acceptable-use" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                8. Acceptable Use and Prohibited Abuse
              </h2>
              <p>You agree not to engage in any of the following prohibited behaviors:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  Decompiling, disassembling, reverse engineering, or attempting to derive the source
                  code of the extension, except where expressly permitted by applicable mandatory law.
                </li>
                <li>
                  Extracting, scraping, bulk-exporting, or redistributing the underlying lexical datasets,
                  dictionary entries, or grammatical inflection tables bundled with the software.
                </li>
                <li>
                  Circumventing licensing controls, tampering with activation mechanisms, spoofing client-side
                  parameters, or distributing unauthorized key generation utilities.
                </li>
                <li>
                  Interfering with the operation, security, or network availability of the website, API
                  endpoints, or associated database infrastructure.
                </li>
                <li>
                  Attempting to bypass or tamper with the five-word daily free tier limit.
                </li>
              </ul>
            </section>

            {/* 9. Intellectual property */}
            <section id="intellectual-property" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                9. Intellectual Property
              </h2>
              <p>
                All software, user interfaces, branding, visual identity, logos, domain names, and
                proprietary dictionary compilations provided by LingoPDF are the intellectual property
                of the creator and operator of LingoPDF (&ldquo;LingoPDF&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;)
                and its licensors.
              </p>
              <p>
                Your purchase grants you an installation license as specified in Section 4; it does not
                convey ownership of the software, trademarks, or lexical databases. All rights not
                expressly granted are reserved.
              </p>
            </section>

            {/* 10. Product availability, updates, and compatibility */}
            <section id="availability-compatibility" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                10. Product Availability, Updates, and Compatibility
              </h2>
              <p>
                We strive to keep the LingoPDF extension compatible with modern versions of Chromium-based
                browsers (such as Google Chrome and Microsoft Edge). However, we cannot guarantee
                continuous, uninterrupted compatibility with obsolete operating systems, unsupported
                third-party browser forks, or malformed, password-protected, or non-standard PDF formats.
              </p>
              <p>
                We may release software updates, bug patches, and dictionary revisions from time to time.
                Certain updates may be necessary to maintain compatibility with updated browser APIs or
                security standards.
              </p>
            </section>

            {/* 11. Warranty disclaimers and limitation of liability */}
            <section id="disclaimers-liability" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                11. Warranty Disclaimers and Limitation of Liability
              </h2>
              <p>
                The software and website are provided on an <strong>&ldquo;as is&rdquo;</strong> and{" "}
                <strong>&ldquo;as available&rdquo;</strong> basis without warranties of any kind, either
                express or implied, including but not limited to implied warranties of merchantability,
                fitness for a particular purpose, or non-infringement.
              </p>
              <p>
                While our dictionary and local OCR engines are curated with care, we do not warrant that
                translation results or OCR transcriptions will be completely error-free, exhaustive, or
                sufficient for specialized legal, medical, sworn, or official regulatory translations.
              </p>
              <p>
                To the maximum extent permitted by applicable law, in no event shall LingoPDF be liable
                for indirect, incidental, special, consequential, or punitive damages arising out of your
                use of or inability to use the product. Our aggregate liability for any claims arising
                under these terms shall not exceed the amount actually paid by you for the product.
                Nothing in these terms limits or excludes liability that cannot be lawfully limited under
                applicable mandatory consumer protection statutes.
              </p>
            </section>

            {/* 12. Suspension or termination */}
            <section id="suspension-termination" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                12. Suspension or Termination
              </h2>
              <p>
                We reserve the right to suspend or terminate website account access if we detect evidence
                of account credential stuffing, brute-force attacks, security abuse, or severe violations
                of our acceptable use policy.
              </p>
              <p>
                When commercial licensing is deployed in Phase 7A, we will similarly maintain the right
                to revoke a license key and restrict access to future updates if license fraud, unauthorized
                reselling, or concurrent activation beyond the permitted two-device seat limit is identified.
              </p>
            </section>

            {/* 13. Changes to the terms */}
            <section id="changes-to-terms" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                13. Changes to the Terms
              </h2>
              <p>
                We may revise these Terms of Service periodically to reflect product updates, regulatory
                developments, or shifts in our business operations. When amendments occur, we will post
                the updated version here and revise the &ldquo;Last updated&rdquo; timestamp at the top
                of this page.
              </p>
              <p>
                Continued use of the website or extension following notice of changes constitutes
                acceptance of the revised terms.
              </p>
            </section>

            {/* 14. Governing law and dispute resolution */}
            <section id="governing-law" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                14. Governing Law and Dispute Resolution
              </h2>
              <p>
                These terms shall be governed by and construed in accordance with applicable law. The
                definitive legal jurisdiction, designated dispute resolution venue, and registered business
                entity details will be formally published alongside official company registration records
                prior to the launch of commercial transactions.
              </p>
              <p>
                In the event of any disagreement or dispute, we strongly encourage contacting us first
                at{" "}
                <a href="mailto:support@lingopdf.in" className="text-[var(--color-forest-green)] underline">
                  support@lingopdf.in
                </a>{" "}
                to reach an amicable, informal resolution.
              </p>
            </section>

            {/* 15. Contact information */}
            <section id="contact-information" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                15. Contact Information
              </h2>
              <p>
                If you have questions regarding these Terms of Service, license terms, or refund
                requests, please contact:
              </p>
              <div className="rounded-2xl border border-[var(--color-soft-sage)] bg-white p-5 sm:p-6 shadow-2xs max-w-md">
                <p className="font-semibold text-[var(--color-forest-green)] mb-1">
                  LingoPDF Legal &amp; Customer Support
                </p>
                <p className="text-sm text-[var(--color-charcoal)]/80 mb-2">
                  Customer Inquiries &amp; Refund Assistance:
                </p>
                <p className="text-sm font-mono text-[var(--color-forest-green)]">
                  <a href="mailto:support@lingopdf.in" className="underline">
                    support@lingopdf.in
                  </a>
                </p>
                <p className="text-xs text-[var(--color-charcoal)]/60 mt-3">
                  Website: <a href="https://lingopdf.in" className="underline">https://lingopdf.in</a>
                </p>
                <p className="text-xs text-[var(--color-charcoal)]/60 mt-1">
                  Formal registered corporate entity details, statutory registration numbers, and
                  official service-of-process addresses will be formally published upon commercial business
                  registration.
                </p>
              </div>
            </section>
          </div>

          {/* Bottom Return / Back to top navigation */}
          <div className="mt-16 pt-8 border-t border-[var(--color-soft-sage)] flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-forest-green)] hover:underline"
            >
              <span>← Return to Home</span>
            </Link>
            <a
              href="#acceptance"
              className="text-xs sm:text-sm font-medium text-[var(--color-charcoal)]/70 hover:text-[var(--color-forest-green)]"
            >
              Back to top ↑
            </a>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
