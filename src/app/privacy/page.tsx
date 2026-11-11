import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy — LingoPDF",
  description:
    "Learn how LingoPDF handles information with local-first document processing, browser extension operations, and account authentication.",
  alternates: {
    canonical: "https://www.lingopdf.in/privacy",
  },
  openGraph: {
    title: "Privacy Policy — LingoPDF",
    description:
      "Plain-English explanation of our local-first document processing principles, extension functionality, implemented account systems, and data handling.",
    url: "https://www.lingopdf.in/privacy",
    type: "website",
  },
};

const SECTIONS = [
  { id: "information-we-collect", title: "1. Information We Collect" },
  { id: "account-authentication", title: "2. Account Registration and Authentication" },
  { id: "payments-purchases", title: "3. Payments and Purchases" },
  { id: "referral-programme", title: "4. Referral Programme" },
  { id: "extension-local-processing", title: "5. Extension Functionality and Local PDF Processing" },
  { id: "ocr-dictionary-data", title: "6. OCR and Dictionary Data" },
  { id: "licence-activation", title: "7. Licence Activation and Device Management" },
  { id: "usage-limits", title: "8. Usage Limits and Commercial Access" },
  { id: "cookies-technologies", title: "9. Cookies and Similar Technologies" },
  { id: "third-party-providers", title: "10. Third-Party Service Providers" },
  { id: "data-retention", title: "11. Data Retention" },
  { id: "data-security", title: "12. Data Security" },
  { id: "international-transfers", title: "13. International Data Transfers" },
  { id: "childrens-privacy", title: "14. Children's Privacy" },
  { id: "privacy-rights", title: "15. Your Privacy Rights and Choices" },
  { id: "policy-changes", title: "16. Changes to This Policy" },
  { id: "contact-information", title: "17. Contact Information" },
];

export default function PrivacyPolicyPage() {
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
              Privacy Policy
            </h1>
            <p className="text-sm sm:text-base text-[var(--color-charcoal)]/70 font-sans mb-6">
              Last updated: November 4, 2026 • Operational for https://www.lingopdf.in
            </p>
            <div className="space-y-4 text-sm sm:text-base text-[var(--color-charcoal)]/90 leading-relaxed font-sans">
              <p>
                This Privacy Policy explains how LingoPDF handles information when you visit{" "}
                <a href="https://www.lingopdf.in" className="text-[var(--color-forest-green)] underline">
                  https://www.lingopdf.in
                </a>
                , create or use an account, contact our support team, or use the LingoPDF browser extension.
              </p>
              <p>
                LingoPDF is designed around local-first document processing. The current extension processes
                PDF documents, text selection, dictionary lookups and OCR locally in your browser. It does not
                upload your PDF documents or their contents to LingoPDF servers for these functions.
              </p>
              <p>
                This Policy distinguishes between currently operating services and planned commercial
                features that are not yet active.
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

          {/* Document Content */}
          <div className="space-y-12 text-[var(--color-charcoal)]/90 font-sans leading-relaxed text-sm sm:text-base">
            {/* 1. Information We Collect */}
            <section id="information-we-collect" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                1. Information We Collect
              </h2>
              <p>Depending on how you use LingoPDF, we may process the following information:</p>

              <div className="space-y-3 pt-1">
                <h3 className="font-heading text-base sm:text-lg font-semibold text-[var(--color-forest-green)]">
                  Account information
                </h3>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>Email address and optional display name supplied during registration.</li>
                  <li>Passwords, stored as secure cryptographic hashes rather than plaintext.</li>
                  <li>Email verification and password-reset token hashes and their expiration information.</li>
                  <li>Account status, verification status and account timestamps.</li>
                </ul>
              </div>

              <div className="space-y-3 pt-1">
                <h3 className="font-heading text-base sm:text-lg font-semibold text-[var(--color-forest-green)]">
                  Authentication and security information
                </h3>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>Hashed session identifiers and session expiration information.</li>
                  <li>Session creation and activity timestamps.</li>
                  <li>
                    Browser User-Agent information and IP address where collected for security, abuse prevention
                    and operational purposes.
                  </li>
                  <li>Rate-limit and security-event records.</li>
                </ul>
              </div>

              <div className="space-y-3 pt-1">
                <h3 className="font-heading text-base sm:text-lg font-semibold text-[var(--color-forest-green)]">
                  Referral information
                </h3>
                <p>If you use the referral programme, we may process:</p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>Your referral code and referral link.</li>
                  <li>The referral code used during registration or purchase.</li>
                  <li>Referral attribution and the associated account relationship.</li>
                  <li>Referral activity and programme eligibility information.</li>
                </ul>
                <p className="text-xs sm:text-sm text-[var(--color-charcoal)]/75">
                  Referral attribution does not itself mean that a purchase has occurred or that a commission has been earned.
                </p>
              </div>

              <div className="space-y-3 pt-1">
                <h3 className="font-heading text-base sm:text-lg font-semibold text-[var(--color-forest-green)]">
                  Support communications
                </h3>
                <p>
                  If you submit an inquiry through our website contact form (
                  <Link href="/support" className="text-[var(--color-forest-green)] underline">
                    https://www.lingopdf.in/support
                  </Link>
                  ) or write to{" "}
                  <a href="mailto:support@lingopdf.in" className="text-[var(--color-forest-green)] underline">
                    support@lingopdf.in
                  </a>
                  , we process your name, email address, subject, message contents, and optional browser information (if supplied) so that our support team can assist you and respond. We also process technical security and rate-limiting metadata (such as IP address digests and request timestamps) to prevent abuse and protect our systems.
                </p>
              </div>

              <div className="space-y-3 pt-1">
                <h3 className="font-heading text-base sm:text-lg font-semibold text-[var(--color-forest-green)]">
                  Website and infrastructure logs
                </h3>
                <p>
                  Our hosting and infrastructure providers may process technical information such as request
                  URLs, IP addresses, timestamps, response codes and diagnostic information to operate, secure
                  and troubleshoot the website.
                </p>
              </div>

              <p className="font-semibold text-[var(--color-forest-green)] pt-2">
                We do not sell personal information.
              </p>
            </section>

            {/* 2. Account Registration and Authentication */}
            <section id="account-authentication" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                2. Account Registration and Authentication
              </h2>
              <p>
                LingoPDF accounts are operated through{" "}
                <a href="https://www.lingopdf.in" className="text-[var(--color-forest-green)] underline">
                  https://www.lingopdf.in
                </a>
                .
              </p>
              <p>Our authentication system currently uses:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Argon2id password hashing.</li>
                <li>Hashed, single-use email verification and password-reset tokens.</li>
                <li>Email verification links sent through Resend.</li>
                <li>An opaque authentication session token held in a secure, HttpOnly cookie.</li>
                <li>Server-side session validation and expiration.</li>
              </ul>
              <p>
                Password-reset tokens are time-limited. Completing a password reset revokes existing active sessions.
              </p>
              <p>
                Please keep your account credentials confidential and contact us if you suspect unauthorized access.
              </p>
            </section>

            {/* 3. Payments and Purchases */}
            <section id="payments-purchases" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                3. Payments and Purchases
              </h2>
              <p>Online checkout and payment processing are not currently active.</p>
              <p>
                LingoPDF does not currently collect or process payment-card or bank-account details through its website.
              </p>
              <p>
                When commercial checkout becomes operational, payments will be handled through an external payment
                service provider. The provider may process payment and transaction information under its own
                privacy policy and terms.
              </p>
              <p>
                LingoPDF may retain purchase-related records needed to provide purchased products, manage
                entitlements, respond to support requests, administer refunds and comply with applicable legal obligations.
              </p>
              <p>
                We do not intend to store full payment-card numbers or card security codes on LingoPDF servers.
              </p>
            </section>

            {/* 4. Referral Programme */}
            <section id="referral-programme" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                4. Referral Programme
              </h2>
              <p>
                LingoPDF supports referral-code attribution. When a user registers using a referral code, we may
                associate that registration with the referring account.
              </p>
              <p>
                The referral system may also process redemption, discount, commission and payout records as commercial
                purchasing features become operational.
              </p>
              <p>
                Referral attribution information is used to administer the programme, prevent abuse and maintain
                accurate records. A referral registration alone does not create a paid purchase or an earned commission.
              </p>
              <p>Payment and payout processing are not currently active.</p>
            </section>

            {/* 5. Extension Functionality and Local PDF Processing */}
            <section id="extension-local-processing" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                5. Extension Functionality and Local PDF Processing
              </h2>
              <p>The LingoPDF German-to-English PDF Reader is designed to process documents locally.</p>
              <p>In the current extension:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>PDF documents are opened and processed in the browser.</li>
                <li>PDF pages and text are rendered locally.</li>
                <li>Selected German vocabulary is looked up using dictionary data bundled with the extension.</li>
                <li>OCR for supported scanned documents runs locally using bundled software and language data.</li>
                <li>Document contents are not uploaded to LingoPDF servers for these reading and lookup functions.</li>
              </ul>
              <p>
                LingoPDF does not intentionally collect a history of the PDF files you open, the pages you read or
                the words you select.
              </p>
              <p>
                The extension&apos;s local processing design does not mean that your browser, operating system or
                other installed software cannot independently collect information. Their handling of information is
                governed by their respective providers.
              </p>
            </section>

            {/* 6. OCR and Dictionary Data */}
            <section id="ocr-dictionary-data" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                6. OCR and Dictionary Data
              </h2>
              <p>Dictionary lookup and OCR functionality currently operate locally within the extension.</p>
              <p>
                The extension uses bundled dictionary datasets and local processing resources. It does not send
                selected words, extracted PDF text or scanned page images to a LingoPDF cloud translation or AI
                service for these functions.
              </p>
            </section>

            {/* 7. Licence Activation and Device Management */}
            <section id="licence-activation" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                7. Licence Activation and Device Management
              </h2>
              <p>
                Commercial licence activation and device management are planned features and are not currently operational.
              </p>
              <p>When introduced, these features may require:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>A licence or activation identifier.</li>
                <li>Account and purchase verification.</li>
                <li>A pseudonymous device or installation identifier.</li>
                <li>Activation, deactivation and licence-status records.</li>
                <li>
                  Limited communication with LingoPDF servers to verify licence status and manage the permitted device.
                </li>
              </ul>
              <p>
                The intended commercial policy is one active device per purchase. Further details will be disclosed
                when the activation system is implemented.
              </p>
            </section>

            {/* 8. Usage Limits and Commercial Access */}
            <section id="usage-limits" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                8. Usage Limits and Commercial Access
              </h2>
              <p>
                LingoPDF does not offer a permanent five-lookup-per-day free tier or a time-limited free trial as
                part of its approved commercial model.
              </p>
              <p>
                The current extension build does not yet contain the planned commercial payment and
                licence-enforcement system. Access arrangements for testing or distribution should not be
                interpreted as a permanent free entitlement or a commercial licence.
              </p>
              <p>Commercial access controls will be described when they become operational.</p>
            </section>

            {/* 9. Cookies and Similar Technologies */}
            <section id="cookies-technologies" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                9. Cookies and Similar Technologies
              </h2>
              <p>
                LingoPDF uses strictly necessary technologies to operate its website and authenticated account services.
              </p>
              <p>These include:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <code>lingopdf_session</code>: An authentication cookie used to maintain a signed-in session. It is
                  configured with security attributes including HttpOnly, SameSite and Secure in production.
                </li>
                <li>
                  <strong>Security and rate-limit mechanisms:</strong> Server-side controls used to protect account
                  and website endpoints.
                </li>
              </ul>
              <p>
                Our website infrastructure may also use technical mechanisms necessary for hosting, security and
                reliable delivery.
              </p>
              <p>
                We do not intentionally use behavioural advertising trackers or sell personal information for
                advertising purposes.
              </p>
            </section>

            {/* 10. Third-Party Service Providers */}
            <section id="third-party-providers" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                10. Third-Party Service Providers
              </h2>
              <p>
                LingoPDF currently relies on infrastructure providers to operate its website and account services.
                These include:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>MongoDB Atlas:</strong> Account, authentication, session and application data storage, and rate-limiting persistence.
                </li>
                <li>
                  <strong>Resend:</strong> Transactional email delivery, including account verification, password-reset links, and support contact form transmissions.
                </li>
                <li>
                  <strong>Vercel:</strong> Website hosting, application delivery and server-side execution.
                </li>
              </ul>
              <p>
                These providers may process information on our behalf to deliver their services and are subject to
                their own privacy and security practices.
              </p>
              <p>
                When payment processing becomes operational, the relevant payment provider will be identified in the
                applicable purchasing information.
              </p>
            </section>

            {/* 11. Data Retention */}
            <section id="data-retention" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                11. Data Retention
              </h2>
              <p>
                We retain information for as long as reasonably necessary for the purposes described in this Policy,
                subject to applicable legal requirements.
              </p>
              <p>Examples include:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Account information:</strong> Retained while an account remains active and as needed to
                  handle account-related obligations.
                </li>
                <li>
                  <strong>Authentication sessions:</strong> Retained until expiration or revocation.
                </li>
                <li>
                  <strong>Verification and password-reset tokens:</strong> Time-limited and invalidated after use or
                  expiration.
                </li>
                <li>
                  <strong>Security records:</strong> Retained as reasonably necessary for security, abuse prevention
                  and troubleshooting.
                </li>
                <li>
                  <strong>Support correspondence:</strong> Retained as necessary to resolve and document support
                  matters.
                </li>
                <li>
                  <strong>Referral records:</strong> Retained as necessary to administer referral attribution and
                  programme integrity.
                </li>
                <li>
                  <strong>Financial, purchase and dispute records:</strong> When commercial transactions become
                  operational, relevant records may be retained for accounting, tax, fraud prevention, chargeback
                  handling and legal compliance.
                </li>
              </ul>
              <p>
                We may retain certain records after an account is closed where necessary to comply with legal
                obligations, resolve disputes or protect our legitimate interests.
              </p>
            </section>

            {/* 12. Data Security */}
            <section id="data-security" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                12. Data Security
              </h2>
              <p>We use technical and organisational safeguards designed to protect information, including:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Password hashing using Argon2id.</li>
                <li>Cryptographic hashing of authentication tokens.</li>
                <li>HTTPS for public website communications.</li>
                <li>Secure authentication-cookie settings.</li>
                <li>Server-side authorization checks.</li>
                <li>Rate limiting and abuse-prevention controls.</li>
                <li>Access restrictions for administrative functions.</li>
              </ul>
              <p>
                No online service can guarantee absolute security. Users should use strong, unique passwords and
                protect their account credentials.
              </p>
            </section>

            {/* 13. International Data Transfers */}
            <section id="international-transfers" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                13. International Data Transfers
              </h2>
              <p>
                Our infrastructure providers may process information in data centres located outside your country of
                residence.
              </p>
              <p>
                Where information is transferred internationally, we will take steps required by applicable
                data-protection laws and the arrangements governing our service providers.
              </p>
            </section>

            {/* 14. Children's Privacy */}
            <section id="childrens-privacy" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                14. Children&apos;s Privacy
              </h2>
              <p>
                LingoPDF is not directed to children under 13. We do not knowingly collect personal information from
                children under 13.
              </p>
              <p>
                If we become aware that an account has been created by a child below the applicable minimum age, we
                will take appropriate steps in accordance with applicable law.
              </p>
            </section>

            {/* 15. Your Privacy Rights and Choices */}
            <section id="privacy-rights" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                15. Your Privacy Rights and Choices
              </h2>
              <p>Depending on your location and applicable law, you may have rights to:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Request access to personal information we hold about you.</li>
                <li>Request correction of inaccurate information.</li>
                <li>Request deletion of your account and eligible associated information.</li>
                <li>Raise concerns about how your information is processed.</li>
                <li>Exercise other rights provided by applicable data-protection law.</li>
              </ul>
              <p>
                Some information may need to be retained where legally required or necessary to resolve disputes,
                prevent fraud or meet legitimate operational obligations.
              </p>
              <p>
                To make a privacy request, contact{" "}
                <a href="mailto:support@lingopdf.in" className="text-[var(--color-forest-green)] underline">
                  support@lingopdf.in
                </a>
                .
              </p>
            </section>

            {/* 16. Changes to This Policy */}
            <section id="policy-changes" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                16. Changes to This Policy
              </h2>
              <p>
                We may update this Policy as LingoPDF develops new features, introduces commercial services or changes
                its data-processing practices.
              </p>
              <p>
                The revised date will be shown at the top of this page. Material changes will be communicated through
                an appropriate website notice or other suitable channel.
              </p>
            </section>

            {/* 17. Contact Information */}
            <section id="contact-information" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                17. Contact Information
              </h2>
              <p>For privacy questions, data requests or account-related concerns:</p>
              <div className="rounded-2xl border border-[var(--color-soft-sage)] bg-white p-5 sm:p-6 shadow-2xs max-w-md">
                <p className="font-semibold text-[var(--color-forest-green)] mb-1">LingoPDF Support</p>
                <p className="text-sm text-[var(--color-charcoal)]/80 mb-2">
                  Privacy Requests &amp; Account Assistance:
                </p>
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

          {/* Bottom Back to Top / Home Navigation */}
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
