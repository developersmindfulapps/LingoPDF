import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Terms of Use — LingoPDF",
  description:
    "Review the Terms of Use governing your access to https://www.lingopdf.in, your LingoPDF account, and your use of the LingoPDF browser extension.",
  alternates: {
    canonical: "https://www.lingopdf.in/terms",
  },
  openGraph: {
    title: "Terms of Use — LingoPDF",
    description:
      "Terms of Use, licence terms, regional pricing, referral programme, and refund policies for LingoPDF.",
    url: "https://www.lingopdf.in/terms",
    type: "website",
  },
};

const SECTIONS = [
  { id: "product-description", title: "1. Product Description" },
  { id: "current-availability", title: "2. Current Availability and Commercial Features" },
  { id: "accounts-security", title: "3. Accounts and Security" },
  { id: "purchases-editions", title: "4. Purchases and Language Editions" },
  { id: "pricing-regional", title: "5. Pricing and Regional Pricing" },
  { id: "promotions-referrals", title: "6. Promotional Discounts and Referral Programme" },
  { id: "money-back-guarantee", title: "7. Three-Day Money-Back Guarantee" },
  { id: "licence-device-restrictions", title: "8. Licence and Device Restrictions" },
  { id: "acceptable-use", title: "9. Acceptable Use" },
  { id: "intellectual-property", title: "10. Intellectual Property and Third-Party Materials" },
  { id: "updates-compatibility", title: "11. Updates, Availability and Compatibility" },
  { id: "suspension-termination", title: "12. Suspension and Termination" },
  { id: "warranty-liability", title: "13. Warranty Disclaimer and Limitation of Liability" },
  { id: "governing-law", title: "14. Governing Law and Disputes" },
  { id: "changes-to-terms", title: "15. Changes to These Terms" },
  { id: "contact-information", title: "16. Contact Information" },
];

export default function TermsOfUsePage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-warm-ivory)] text-[var(--color-charcoal)] antialiased selection:bg-[var(--color-soft-sage)] selection:text-[var(--color-forest-green)]">
      <Navbar />

      <main className="flex-1 py-12 sm:py-16 lg:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div id="overview" className="scroll-mt-24 mb-12 border-b border-[var(--color-soft-sage)] pb-8">
            <span className="text-xs sm:text-sm font-bold uppercase tracking-widest text-[var(--color-terracotta)] mb-3 block">
              Legal Documentation
            </span>
            <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[var(--color-forest-green)] mb-4">
              Terms of Use
            </h1>
            <p className="text-sm sm:text-base text-[var(--color-charcoal)]/70 font-sans mb-6">
              Last updated: November 4, 2026 • Operational for https://www.lingopdf.in
            </p>
            <div className="space-y-4 text-sm sm:text-base text-[var(--color-charcoal)]/90 leading-relaxed font-sans">
              <p>
                These Terms of Use govern your access to{" "}
                <a href="https://www.lingopdf.in" className="text-[var(--color-forest-green)] underline">
                  https://www.lingopdf.in
                </a>
                , your LingoPDF account and your use of the LingoPDF browser extension.
              </p>
              <p>
                By accessing the website, registering an account, downloading or installing the extension, or
                using LingoPDF services, you agree to these Terms. If you do not agree, do not use the service.
              </p>
              <p>
                These Terms distinguish current functionality from commercial features that are planned but not
                yet operational.
              </p>
            </div>
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
            {/* 1. Product Description */}
            <section id="product-description" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                1. Product Description
              </h2>
              <p>
                LingoPDF provides PDF-reading software designed to help users build vocabulary while reading
                foreign-language documents.
              </p>
              <p>
                The currently developed edition is <strong>LingoPDF German → English PDF Reader</strong>.
              </p>
              <p>Its functionality includes:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>PDF reading and text selection.</li>
                <li>German word detection.</li>
                <li>English dictionary meanings and grammatical information.</li>
                <li>Local dictionary lookup.</li>
                <li>Local OCR for supported scanned PDF documents.</li>
              </ul>
              <p>
                LingoPDF is a vocabulary-building reading tool. It is not represented as a complete document
                translator or a certified translation service.
              </p>
              <p>
                Additional language editions may be developed. Mention of future editions does not guarantee a
                release date or create an entitlement to those editions.
              </p>
            </section>

            {/* 2. Current Availability and Commercial Features */}
            <section id="current-availability" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                2. Current Availability and Commercial Features
              </h2>
              <p>
                The current extension build does not yet include the planned commercial payment, licence
                activation and device-verification systems.
              </p>
              <p>Online checkout and paid licence activation are not currently operational.</p>
              <p>
                The absence of a payment gate in a development, testing or distribution build does not create a
                permanent free entitlement, ownership right or commercial licence.
              </p>
              <p>
                During the current limited private promotional preview, LingoPDF is shared with a small group of
                selected testers free of charge. Invited participants are not required to purchase a licence to
                participate in the promotional preview. This preview is temporary and does not constitute a permanent
                free tier or guarantee perpetual access.
              </p>
              <p>LingoPDF may change access arrangements as commercial features are introduced.</p>
            </section>

            {/* 3. Accounts and Security */}
            <section id="accounts-security" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                3. Accounts and Security
              </h2>
              <p>
                You must provide accurate information when creating an account and keep your credentials
                confidential.
              </p>
              <p>
                You are responsible for activity conducted through your account. You must notify{" "}
                <a href="mailto:support@lingopdf.in" className="text-[var(--color-forest-green)] underline">
                  support@lingopdf.in
                </a>{" "}
                if you suspect unauthorized access.
              </p>
              <p>
                We may restrict or suspend accounts where reasonably necessary to protect users, the service or its
                security.
              </p>
            </section>

            {/* 4. Purchases and Language Editions */}
            <section id="purchases-editions" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                4. Purchases and Language Editions
              </h2>
              <p>When commercial checkout becomes available, LingoPDF will operate on a one-time purchase model.</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Each language edition requires a separate purchase.</li>
                <li>A purchase grants access to the edition identified at checkout.</li>
                <li>Future updates for that purchased edition are included, subject to these Terms.</li>
                <li>A purchase does not automatically include other current or future language editions.</li>
                <li>Purchases are personal and non-transferable unless we expressly authorize otherwise.</li>
              </ul>
              <p>
                There is no recurring subscription or mandatory annual renewal under the approved pricing model.
              </p>
            </section>

            {/* 5. Pricing and Regional Pricing */}
            <section id="pricing-regional" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                5. Pricing and Regional Pricing
              </h2>
              <p>The approved standard prices for the German-to-English edition are:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>India:</strong> ₹1,299 INR.
                </li>
                <li>
                  <strong>United States:</strong> $75 USD.
                </li>
                <li>
                  <strong>Eurozone:</strong> €75 EUR.
                </li>
                <li>
                  <strong>Standard international pricing:</strong> $75 USD.
                </li>
                <li>
                  <strong>Selected affordability countries:</strong> Admin-configured local-currency prices where
                  supported, with a configured USD fallback where local-currency checkout is unavailable.
                </li>
              </ul>
              <p>
                Regional pricing is determined using the applicable country and pricing rules. INR pricing is
                reserved for customers detected in India. Customers outside India cannot select INR as their
                checkout currency.
              </p>
              <p>
                Affordability pricing is available only in selected countries configured by LingoPDF. It is not
                automatically available in every country.
              </p>
              <p>
                The final price, currency and applicable discount will be shown before a commercial order is placed.
                The checkout amount and currency will be the authoritative purchase details.
              </p>
              <p>
                Payment processing is not currently active. The prices above describe the approved commercial
                pricing model and do not indicate that checkout is already available.
              </p>
            </section>

            {/* 6. Promotional Discounts and Referral Programme */}
            <section id="promotions-referrals" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                6. Promotional Discounts and Referral Programme
              </h2>
              <p>LingoPDF may offer promotional discounts and referral benefits.</p>

              <div className="space-y-3 pt-1">
                <h3 className="font-heading text-base sm:text-lg font-semibold text-[var(--color-forest-green)]">
                  Promotional discounts
                </h3>
                <p>
                  Promotional discounts may be offered at 5%, 10%, 15% or 20%, subject to the applicable campaign
                  terms and availability.
                </p>
              </div>

              <div className="space-y-3 pt-1">
                <h3 className="font-heading text-base sm:text-lg font-semibold text-[var(--color-forest-green)]">
                  Referral discounts
                </h3>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>Eligible referral codes may provide a 10% customer discount.</li>
                  <li>
                    A customer may use either an applicable promotional discount or a referral discount on a
                    purchase. Discounts cannot be combined.
                  </li>
                </ul>
              </div>

              <div className="space-y-3 pt-1">
                <h3 className="font-heading text-base sm:text-lg font-semibold text-[var(--color-forest-green)]">
                  Referral participation
                </h3>
                <ul className="list-disc pl-5 space-y-2">
                  <li>
                    A referrer may receive a commission equal to 10% of the actual amount collected for an eligible
                    referred purchase after discounts, subject to the referral programme rules.
                  </li>
                  <li>
                    Referral codes have a lifetime limit of 50 successful paid redemptions. Registrations, abandoned
                    checkouts and failed or unpaid purchases do not count as successful redemptions. A refund does
                    not restore a consumed redemption slot.
                  </li>
                  <li>
                    Commission eligibility is subject to a 72-hour hold from the purchase timestamp and any
                    applicable refund, dispute or fraud restrictions.
                  </li>
                  <li>
                    The minimum payout threshold is five eligible commissions across currencies combined. Payout
                    batches are processed separately by currency. The first payout is subject to administrative
                    review and initiation; subsequent payouts may be requested by the referrer.
                  </li>
                  <li>
                    Commissions subject to an open payment dispute may be placed on hold. The final treatment of
                    those commissions depends on the dispute outcome. Already-paid commissions are not automatically
                    clawed back.
                  </li>
                  <li>
                    Referral participation is subject to verification, abuse prevention and applicable programme
                    controls. LingoPDF may suspend referral activity where fraud, manipulation or abuse is reasonably
                    suspected.
                  </li>
                </ul>
                <p className="text-xs sm:text-sm text-[var(--color-charcoal)]/75">
                  Referral commission and payout processing will become operational only when the relevant commercial
                  payment systems are launched.
                </p>
              </div>
            </section>

            {/* 7. Three-Day Money-Back Guarantee */}
            <section id="money-back-guarantee" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                7. Three-Day Money-Back Guarantee
              </h2>
              <p>Each eligible commercial purchase includes a 72-hour money-back guarantee.</p>
              <p>The 72-hour period begins at the exact timestamp of the successful purchase.</p>
              <p>
                You may request a full refund within that period by contacting:
              </p>
              <p className="font-mono text-sm text-[var(--color-forest-green)]">
                <a href="mailto:support@lingopdf.in" className="underline">
                  support@lingopdf.in
                </a>
              </p>
              <p>
                The standard guarantee provides a full refund. Partial refunds are not offered as a standard customer
                option.
              </p>
              <p>
                Refund requests are subject to review and confirmation. Submitting a request does not itself mean that
                a refund has been approved or completed.
              </p>
              <p>Where a full refund is approved and completed, the associated paid entitlement will be revoked.</p>
              <p>
                After the 72-hour guarantee period, refunds are not available under the standard guarantee. This does
                not limit any mandatory statutory consumer rights that apply to you.
              </p>
              <p>
                Where a payment dispute or chargeback is opened, access and unpaid referral commissions may be
                restricted while the dispute is reviewed. The consequences will depend on the outcome and any other
                applicable restrictions.
              </p>
              <p>This refund process will apply when commercial payment processing is operational.</p>
            </section>

            {/* 8. Licence and Device Restrictions */}
            <section id="licence-device-restrictions" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                8. Licence and Device Restrictions
              </h2>
              <p>Each commercial purchase is intended to permit use on one active device.</p>
              <p>Commercial activation and device-management controls are planned and are not yet operational.</p>
              <p>When implemented:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>A licence will be associated with the relevant account and purchase.</li>
                <li>One active device will be permitted per purchase.</li>
                <li>Device replacement will require a support request and verification.</li>
                <li>The existing device binding may be revoked before a replacement device is activated.</li>
                <li>Sharing, reselling or distributing activation credentials is prohibited.</li>
                <li>
                  Following successful activation, the product is intended to support offline use, subject to the
                  planned offline-verification and grace-period rules.
                </li>
              </ul>
              <p>
                The technical enforcement of these restrictions will apply once the licensing system is launched.
              </p>
            </section>

            {/* 9. Acceptable Use */}
            <section id="acceptable-use" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                9. Acceptable Use
              </h2>
              <p>You agree not to:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Use LingoPDF for unlawful activities.</li>
                <li>Interfere with the security, availability or operation of the website or extension.</li>
                <li>Attempt unauthorized access to accounts, APIs, databases or administrative functions.</li>
                <li>Distribute malware or use the service to compromise another person&apos;s device or data.</li>
                <li>
                  Redistribute the extension, proprietary dictionary compilations or other protected materials without
                  authorization.
                </li>
                <li>
                  Scrape, bulk-extract or commercially redistribute bundled dictionary datasets except where permitted
                  by applicable law or the relevant dataset licence.
                </li>
                <li>Circumvent commercial licensing, activation or access controls once implemented.</li>
                <li>
                  Abuse referral codes, manipulate referral attribution or create fraudulent transactions or
                  commission claims.
                </li>
              </ul>
              <p>
                Nothing in these Terms prohibits activities that cannot lawfully be restricted under applicable
                mandatory law.
              </p>
            </section>

            {/* 10. Intellectual Property and Third-Party Materials */}
            <section id="intellectual-property" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                10. Intellectual Property and Third-Party Materials
              </h2>
              <p>
                LingoPDF&apos;s software, website design, branding, logos and original product materials are
                protected by applicable intellectual-property laws.
              </p>
              <p>
                Unless otherwise stated, these materials belong to the creator and operator of LingoPDF or the
                relevant licensors.
              </p>
              <p>
                The extension may include third-party software, dictionary datasets, OCR resources and other
                components subject to their own licences and notices.
              </p>
              <p>
                Nothing in these Terms transfers ownership of LingoPDF&apos;s intellectual property to you. Your
                right to use the product is limited to the access or licence expressly granted to you.
              </p>
            </section>

            {/* 11. Updates, Availability and Compatibility */}
            <section id="updates-compatibility" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                11. Updates, Availability and Compatibility
              </h2>
              <p>We may release updates, bug fixes, compatibility changes and dictionary improvements.</p>
              <p>
                We aim to support compatible versions of modern Chromium-based browsers. However, we do not
                guarantee uninterrupted availability or compatibility with every browser, operating system, PDF file
                or third-party environment.
              </p>
              <p>
                Some PDFs may be malformed, password-protected, image-only or otherwise incompatible with particular
                features.
              </p>
              <p>
                We may modify, improve, suspend or discontinue features where reasonably necessary for maintenance,
                security, legal compliance or product development.
              </p>
            </section>

            {/* 12. Suspension and Termination */}
            <section id="suspension-termination" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                12. Suspension and Termination
              </h2>
              <p>We may suspend or terminate access where reasonably necessary in response to:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Serious violations of these Terms.</li>
                <li>Fraudulent activity or payment abuse.</li>
                <li>Unauthorized redistribution or resale.</li>
                <li>Security threats or attempts to compromise the service.</li>
                <li>Referral manipulation or commission abuse.</li>
                <li>Legal or regulatory requirements.</li>
              </ul>
              <p>
                Where commercial licensing is operational, restrictions may also affect the associated licence and
                entitlement, subject to applicable law and the relevant purchase and refund conditions.
              </p>
              <p>We will not treat a mere technical error or an unverified allegation as proof of misconduct.</p>
            </section>

            {/* 13. Warranty Disclaimer and Limitation of Liability */}
            <section id="warranty-liability" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                13. Warranty Disclaimer and Limitation of Liability
              </h2>
              <p>
                To the maximum extent permitted by applicable law, the website and software are provided on an
                &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis.
              </p>
              <p>We do not warrant that:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Dictionary definitions will always be complete or suitable for every context.</li>
                <li>OCR output will be entirely accurate.</li>
                <li>The product will support every PDF or browser environment.</li>
                <li>The website or extension will be continuously available without interruption.</li>
              </ul>
              <p>
                LingoPDF is a vocabulary-learning and reading aid. It is not a substitute for certified, legal,
                medical, sworn or official translation services.
              </p>
              <p>
                To the maximum extent permitted by law, LingoPDF will not be liable for indirect, incidental,
                special or consequential losses arising from use of the service.
              </p>
              <p>
                Nothing in these Terms excludes or limits liability that cannot lawfully be excluded or limited under
                applicable law, including mandatory consumer rights.
              </p>
            </section>

            {/* 14. Governing Law and Disputes */}
            <section id="governing-law" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                14. Governing Law and Disputes
              </h2>
              <p>
                The applicable governing law, jurisdiction and formal dispute-resolution arrangements must be
                confirmed and published with the relevant business registration details before commercial
                transactions begin.
              </p>
              <p>
                If you have a concern or dispute, please contact{" "}
                <a href="mailto:support@lingopdf.in" className="text-[var(--color-forest-green)] underline">
                  support@lingopdf.in
                </a>{" "}
                first so that we can attempt to resolve it informally.
              </p>
              <p>Nothing in this section removes any mandatory rights or remedies available under applicable law.</p>
            </section>

            {/* 15. Changes to These Terms */}
            <section id="changes-to-terms" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                15. Changes to These Terms
              </h2>
              <p>
                We may update these Terms to reflect product changes, new commercial features, legal requirements or
                operational developments.
              </p>
              <p>
                The latest revision date will be displayed at the top of this page. Material changes will be
                communicated through an appropriate website notice or other suitable channel.
              </p>
            </section>

            {/* 16. Contact Information */}
            <section id="contact-information" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                16. Contact Information
              </h2>
              <p>For questions about these Terms, accounts, purchases, referrals or refunds:</p>
              <div className="rounded-2xl border border-[var(--color-soft-sage)] bg-white p-5 sm:p-6 shadow-2xs max-w-md">
                <p className="font-semibold text-[var(--color-forest-green)] mb-1">LingoPDF Support</p>
                <p className="text-sm text-[var(--color-charcoal)]/80 mb-2">Customer &amp; Account Assistance:</p>
                <p className="text-sm font-mono text-[var(--color-forest-green)]">
                  <a href="mailto:support@lingopdf.in" className="underline">
                    support@lingopdf.in
                  </a>
                </p>
                <p className="text-xs text-[var(--color-charcoal)]/60 mt-3">
                  Website:{" "}
                  <a href="https://www.lingopdf.in" className="underline">
                    https://www.lingopdf.in
                  </a>
                </p>
                <p className="text-xs text-[var(--color-charcoal)]/60 mt-1">
                  Business registration details and the applicable formal service address will be added when the
                  relevant business registration is completed.
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
              href="#overview"
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
