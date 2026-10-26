import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy — LingoPDF",
  description:
    "Learn how LingoPDF approaches privacy, local document processing, browser extension operations, and account information.",
  openGraph: {
    title: "Privacy Policy — LingoPDF",
    description:
      "Plain-English explanation of our local-first document processing principles, extension functionality, and planned account systems.",
    type: "website",
  },
};

const SECTIONS = [
  { id: "introduction", title: "1. Introduction and Scope" },
  { id: "information-we-collect", title: "2. Information We Collect" },
  { id: "account-registration", title: "3. Account and Registration Information (Planned)" },
  { id: "payments-refunds", title: "4. Payments and Refunds (Planned)" },
  { id: "how-we-use-information", title: "5. How the Website Uses Information" },
  { id: "extension-local-processing", title: "6. Extension Functionality and Local PDF Processing" },
  { id: "ocr-dictionary-lookup", title: "7. OCR and Dictionary Lookup" },
  { id: "license-device-management", title: "8. License Activation and Device Management (Planned)" },
  { id: "usage-limits-logs", title: "9. Usage Limits and Operational Logs" },
  { id: "cookies-technologies", title: "10. Cookies and Similar Technologies" },
  { id: "third-party-providers", title: "11. Third-Party Service Providers" },
  { id: "data-retention", title: "12. Data Retention" },
  { id: "data-security", title: "13. Data Security" },
  { id: "international-transfers", title: "14. International Data Transfers" },
  { id: "childrens-privacy", title: "15. Children's Privacy" },
  { id: "user-rights", title: "16. User Privacy Rights and Choices" },
  { id: "policy-updates", title: "17. Policy Updates" },
  { id: "contact-information", title: "18. Contact Information" },
];

export default function PrivacyPolicyPage() {
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
              Privacy Policy
            </h1>
            <p className="text-sm sm:text-base text-[var(--color-charcoal)]/70 font-sans">
              Last updated: October 2026 • Effective upon product launch
            </p>
          </div>

          {/* Table of Contents */}
          <nav
            aria-label="Table of contents"
            className="mb-14 rounded-2xl border border-[var(--color-soft-sage)] bg-white p-6 sm:p-8 shadow-xs"
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
            {/* 1. Introduction and Scope */}
            <section id="introduction" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                1. Introduction and Scope
              </h2>
              <p>
                Welcome to LingoPDF. This Privacy Policy explains how information is handled when you
                visit our informational website (lingopdf.com) and when you interact with our
                browser extension software, including the LingoPDF PDF Reader for German to English.
              </p>
              <p>
                LingoPDF is a newly launched product designed with a local-first philosophy: our
                reading tools are engineered to execute vocabulary definitions and text recognition
                directly on your personal device rather than streaming your personal reading
                materials to remote servers. This document clearly distinguishes between the features
                available today and planned capabilities that will roll out with future releases.
              </p>
            </section>

            {/* 2. Information We Collect */}
            <section id="information-we-collect" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                2. Information We Collect
              </h2>
              <p>
                Depending on your interaction with LingoPDF, different categories of information may
                be collected:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Website Browsing Data:</strong> Standard server access logs (such as your IP
                  address, browser user-agent, operating system, referring URL, and timestamp)
                  generated when your browser requests web pages from our hosting infrastructure.
                </li>
                <li>
                  <strong>Communication Details:</strong> If you voluntarily contact us for support or
                  inquiries, we retain your communication history and email address to resolve your
                  request.
                </li>
                <li>
                  <strong>Planned Customer Data:</strong> When customer accounts and checkout become
                  active, we will process contact and license record information as outlined below.
                </li>
              </ul>
              <p>
                We do not collect or monitor your continuous reading activity, nor do we build
                behavioral reading dossiers from your local document usage.
              </p>
            </section>

            {/* 3. Account and Registration Information */}
            <section id="account-registration" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                3. Account and Registration Information (Planned)
              </h2>
              <p>
                User accounts and customer registration systems are not active on the current website.
                Today, visitors browse public documentation and product overviews without creating
                credentials or providing personal contact details.
              </p>
              <p>
                In a subsequent phase, when purchasing or managing full licenses, we plan to implement
                an account system that collects:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Your name and valid email address for delivery of license credentials.</li>
                <li>Hashed account authentication credentials.</li>
                <li>License status and transaction identifier references.</li>
              </ul>
              <p>
                Detailed specifications for account management, profile updates, and account deletion
                mechanisms will be formally confirmed upon deployment of the authentication system.
              </p>
            </section>

            {/* 4. Payments and Refunds */}
            <section id="payments-refunds" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                4. Payments and Refunds (Planned)
              </h2>
              <p>
                LingoPDF does not currently collect, process, or store credit card details or bank
                account credentials.
              </p>
              <p>
                When online transactions launch, commercial payments will be handled by a qualified
                third-party payment processor under PCI-DSS compliance standards. Our internal systems
                will only receive non-sensitive confirmation metadata, such as transaction IDs, order
                timestamps, product tier identifiers, and payment status.
              </p>
              <p>
                All purchases will be backed by our published seven-day money-back guarantee, handled
                either automatically through your customer portal or upon request to our support team.
              </p>
            </section>

            {/* 5. How the Website Uses Information */}
            <section id="how-we-use-information" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                5. How the Website Uses Information
              </h2>
              <p>Information gathered through the public website is strictly used to:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Deliver web pages, assets, and documentation reliably to your client device.</li>
                <li>Diagnose operational network issues, maintain uptime, and defend against malicious traffic.</li>
                <li>Respond to direct support questions, feature requests, or technical bug reports.</li>
                <li>Provide purchase validation and license issuance once commercial orders are live.</li>
              </ul>
              <p>We do not monetize your data or sell personal information to third-party data brokers.</p>
            </section>

            {/* 6. Extension Functionality and Local PDF Processing */}
            <section id="extension-local-processing" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                6. Extension Functionality and Local PDF Processing
              </h2>
              <p>
                The primary purpose of the LingoPDF browser extension is to assist you while reading
                foreign language documents. The core architectural principle governing the extension is
                local execution:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>No Cloud Uploads for Reading:</strong> When you open a PDF in your browser,
                  the contents of your document remain strictly within your local browser sandbox.
                </li>
                <li>
                  <strong>Zero Document Ingestion:</strong> LingoPDF does not upload full pages, text
                  extracts, or file attachments to remote translation servers to fulfill ordinary word
                  lookups.
                </li>
                <li>
                  <strong>Separation of Concerns:</strong> While website authentication, licensing, and
                  customer account management necessarily involve remote network communication, your
                  personal PDF text reading stream is kept decoupled from remote servers.
                </li>
              </ul>
            </section>

            {/* 7. OCR and Dictionary Lookup */}
            <section id="ocr-dictionary-lookup" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                7. OCR and Dictionary Lookup
              </h2>
              <p>
                Our language lookup tools are packaged to run locally inside your browser environment:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Dictionary Engine:</strong> Comprehensive German–English lexical datasets and
                  grammatical inflection mappings reside within your local installation files, allowing
                  instant definitions without round-trip network queries.
                </li>
                <li>
                  <strong>Local OCR:</strong> For supported scanned documents, optical character
                  recognition executes locally using device compute resources. Raster image data is
                  analyzed on your computer without remote image streaming.
                </li>
              </ul>
              <p>
                Because linguistic data is bundled locally, word lookups do not leak the specific
                sentences, paragraphs, or academic material you are studying to third-party analytics.
              </p>
            </section>

            {/* 8. License Activation and Device Management */}
            <section id="license-device-management" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                8. License Activation and Device Management (Planned)
              </h2>
              <p>
                Full unlimited access to LingoPDF will require a valid license key or account
                verification. When this infrastructure is deployed, activation will require a brief,
                secure network request to confirm:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>The validity and expiration status of your license key.</li>
                <li>
                  An anonymized cryptographic device or browser profile identifier to prevent license
                  abuse across unauthorized concurrent seats.
                </li>
              </ul>
              <p>
                Once successfully activated, paid tier functionality is engineered to work completely
                offline without continuous network pings or periodic heartbeat checks.
              </p>
            </section>

            {/* 9. Usage Limits and Operational Logs */}
            <section id="usage-limits-logs" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                9. Usage Limits and Operational Logs
              </h2>
              <p>
                LingoPDF includes a planned free tier offering five complimentary word lookups per day.
                This quota is tracked locally inside your browser storage (such as HTML5 LocalStorage or
                extension storage APIs) without requiring remote quota counters.
              </p>
              <p>
                If automated error reporting or diagnostic logs are added in future versions, crash reports
                will exclude PDF document content, and telemetry settings will remain transparently
                controllable within extension options.
              </p>
            </section>

            {/* 10. Cookies and Similar Technologies */}
            <section id="cookies-technologies" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                10. Cookies and Similar Technologies
              </h2>
              <p>
                The public informational website does not deploy third-party advertising cookies,
                cross-site tracking beacons, or invasive user fingerprinters.
              </p>
              <p>
                As account and checkout services are introduced, strictly necessary session cookies will
                be used to authenticate authenticated user sessions and maintain shopping cart state.
                Details on any non-essential analytics cookies will be presented with appropriate consent
                controls prior to implementation.
              </p>
            </section>

            {/* 11. Third-Party Service Providers */}
            <section id="third-party-providers" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                11. Third-Party Service Providers
              </h2>
              <p>
                We partner with dependable third-party infrastructure providers to host and maintain our
                web presence:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Web Hosting & Edge Delivery:</strong> High-reliability cloud hosting providers
                  to serve our web application assets and cache static documentation.
                </li>
                <li>
                  <strong>Future Payment Processing:</strong> Qualified billing vendors to process credit
                  cards and manage tax compliance.
                </li>
                <li>
                  <strong>Future Transactional Email:</strong> Trusted email delivery services to dispatch
                  license codes, receipts, and security alerts.
                </li>
              </ul>
              <p>
                Service providers are granted access only to the data strictly necessary to execute their
                designated infrastructure roles.
              </p>
            </section>

            {/* 12. Data Retention */}
            <section id="data-retention" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                12. Data Retention
              </h2>
              <p>
                We adhere to strict data minimization principles:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Server access logs are rotated and permanently purged on a routine operational schedule.</li>
                <li>Direct customer support correspondence is retained only as long as needed to address your inquiry.</li>
                <li>
                  When customer purchase accounts are deployed, transaction and license history records
                  will be maintained for as long as your account remains active and as required by
                  statutory tax and accounting obligations.
                </li>
              </ul>
            </section>

            {/* 13. Data Security */}
            <section id="data-security" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                13. Data Security
              </h2>
              <p>
                We employ standard modern security controls to protect information transmitted over the
                internet:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Enforced Transport Layer Security (TLS/HTTPS) across all public website routes.</li>
                <li>Least-privilege operational access controls to hosting and deployment environments.</li>
                <li>Local sandboxing of document rendering routines within standard browser security perimeters.</li>
              </ul>
              <p>
                While we take rigorous measures to safeguard data integrity, no method of digital
                transmission or electronic storage is completely infallible.
              </p>
            </section>

            {/* 14. International Data Transfers */}
            <section id="international-transfers" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                14. International Data Transfers
              </h2>
              <p>
                Our hosting infrastructure and future vendor nodes may reside in different jurisdictions
                around the world. If personal information is transferred internationally for website
                hosting, account delivery, or billing, we ensure appropriate data transfer mechanisms
                and contract protections are upheld.
              </p>
            </section>

            {/* 15. Children's Privacy */}
            <section id="childrens-privacy" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                15. Children&apos;s Privacy
              </h2>
              <p>
                LingoPDF is intended for general student, research, and adult reading audiences. We do not
                knowingly solicit or collect personal information from children under 13 years of age (or
                equivalent local legal threshold). If we discover that a child has inadvertently
                registered or provided data, we will promptly delete that information from our records.
              </p>
            </section>

            {/* 16. User Privacy Rights and Choices */}
            <section id="user-rights" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                16. User Privacy Rights and Choices
              </h2>
              <p>
                Depending on your geographic location and applicable regional privacy statutes (such as the
                GDPR or UK Data Protection Act), you may possess specific rights regarding personal data:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>The right to request confirmation of whether we hold personal data about you.</li>
                <li>The right to request a portable copy of personal information you provided.</li>
                <li>The right to request correction of inaccurate or incomplete records.</li>
                <li>The right to request deletion of your personal account data, subject to legal retention obligations.</li>
              </ul>
              <p>
                To exercise any of these privileges, please reach out via our contact channels below.
              </p>
            </section>

            {/* 17. Policy Updates */}
            <section id="policy-updates" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                17. Policy Updates
              </h2>
              <p>
                We may revise this Privacy Policy periodically as new product features, payment systems,
                or language modules are introduced. When updates occur, we will update the &ldquo;Last
                updated&rdquo; date at the top of this page. Significant structural changes to data handling
                will be accompanied by prominent website notices.
              </p>
            </section>

            {/* 18. Contact Information */}
            <section id="contact-information" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                18. Contact Information
              </h2>
              <p>
                If you have questions, feedback, or privacy-related requests regarding this policy or our
                local-first document processing principles, please contact our privacy and support team:
              </p>
              <div className="rounded-2xl border border-[var(--color-soft-sage)] bg-white p-5 sm:p-6 shadow-xs max-w-md">
                <p className="font-semibold text-[var(--color-forest-green)] mb-1">
                  LingoPDF Support & Privacy Team
                </p>
                <p className="text-sm text-[var(--color-charcoal)]/80 mb-2">
                  General Inquiries & Privacy Requests:
                </p>
                <p className="text-sm font-mono text-[var(--color-forest-green)]">
                  privacy@lingopdf.com
                </p>
                <p className="text-xs text-[var(--color-charcoal)]/60 mt-3">
                  Registered corporate entity and physical postal address details will be formally published
                  alongside company registration records at commercial release.
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
              href="#introduction"
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
