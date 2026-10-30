import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy — LingoPDF",
  description:
    "Learn how LingoPDF approaches privacy, local-first document processing, browser extension operations, account authentication, and data practices.",
  alternates: {
    canonical: "https://lingopdf.in/privacy",
  },
  openGraph: {
    title: "Privacy Policy — LingoPDF",
    description:
      "Plain-English explanation of our local-first document processing principles, extension functionality, implemented account systems, and data handling.",
    url: "https://lingopdf.in/privacy",
    type: "website",
  },
};

const SECTIONS = [
  { id: "introduction", title: "1. Introduction and Scope" },
  { id: "information-we-collect", title: "2. Information We Collect" },
  { id: "account-authentication", title: "3. Account Registration and Authentication" },
  { id: "payments-refunds", title: "4. Payments and Refunds (Not Yet Implemented)" },
  { id: "how-we-use-information", title: "5. How the Website Uses Information" },
  { id: "extension-local-processing", title: "6. Extension Functionality and Local PDF Processing" },
  { id: "ocr-dictionary-lookup", title: "7. OCR and Dictionary Lookup" },
  { id: "license-device-management", title: "8. License Activation and Device Management (Planned)" },
  { id: "usage-limits-logs", title: "9. Usage Limits and Operational Quota" },
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

          {/* Document Content */}
          <div className="space-y-12 text-[var(--color-charcoal)]/90 font-sans leading-relaxed text-sm sm:text-base">
            {/* 1. Introduction and Scope */}
            <section id="introduction" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                1. Introduction and Scope
              </h2>
              <p>
                Welcome to LingoPDF. This Privacy Policy explains how information is handled when you
                visit our website (<strong>https://lingopdf.in</strong>), interact with our account
                services, or use the LingoPDF browser extension software, including the LingoPDF PDF
                Reader for German to English.
              </p>
              <p>
                LingoPDF operates on a <strong>local-first architecture</strong>: our reading tools are
                engineered to execute vocabulary definitions, grammatical parsing, and optical
                character recognition (OCR) directly inside your personal browser sandbox rather than
                streaming your personal reading materials to remote cloud servers.
              </p>
              <p>
                This document clearly describes our active practices and implemented features, while
                accurately distinguishing future capabilities (such as commercial payment processing
                and device seat management) that will launch in upcoming project phases.
              </p>
            </section>

            {/* 2. Information We Collect */}
            <section id="information-we-collect" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                2. Information We Collect
              </h2>
              <p>
                Depending on how you interact with LingoPDF, we collect and process the following
                categories of information:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Account &amp; Profile Details:</strong> When you register an account, we
                  collect your email address and optional display name.
                </li>
                <li>
                  <strong>Authentication Credentials &amp; Tokens:</strong> We store passwords strictly
                  in cryptographically hashed form (using Argon2id). Single-use tokens for email
                  verification and password resets are stored strictly as SHA-256 hashes with short-lived
                  expiration windows.
                </li>
                <li>
                  <strong>Session Metadata:</strong> When you sign in, we record session timestamps,
                  your browser User-Agent string, and IP address for account security and session
                  management.
                </li>
                <li>
                  <strong>Website Logs &amp; Diagnostics:</strong> Standard web server access logs (such
                  as IP address, request method, requested URL, response code, and timestamp) collected
                  by our hosting infrastructure to monitor availability and defend against abuse.
                </li>
                <li>
                  <strong>Support Communications:</strong> When you email our team at{" "}
                  <a href="mailto:support@lingopdf.in" className="text-[var(--color-forest-green)] underline">
                    support@lingopdf.in
                  </a>
                  , we retain your email address and message contents to assist you.
                </li>
              </ul>
              <p>
                We do not track the documents you open in the extension, we do not log your reading
                history, and we do not sell or monetize personal data.
              </p>
            </section>

            {/* 3. Account Registration and Authentication */}
            <section id="account-authentication" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                3. Account Registration and Authentication
              </h2>
              <p>
                User accounts are fully implemented on https://lingopdf.in. Account creation allows you
                to register credentials that will be used to manage your profile and future licenses.
              </p>
              <p>When interacting with our authentication system:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Registration:</strong> You supply an email address, password, and optional name.
                  Passwords are automatically hashed before persistence using the industry-standard
                  Argon2id hashing algorithm.
                </li>
                <li>
                  <strong>Email Verification:</strong> A single-use verification token is generated, hashed
                  using SHA-256, and stored with a 24-hour expiration. An email containing the activation
                  link is sent via our transactional email provider (Resend).
                </li>
                <li>
                  <strong>Sessions:</strong> Successful login creates an opaque 32-byte session token stored
                  in an HttpOnly, secure cookie (<code>lingopdf_session</code>), with the token hash stored
                  in our database. Sessions expire after 30 days.
                </li>
                <li>
                  <strong>Password Resets:</strong> Reset requests generate single-use, 1-hour expiration
                  tokens sent via email. Upon completing a reset, the token is consumed immediately and all
                  existing active sessions across all devices are automatically revoked.
                </li>
              </ul>
            </section>

            {/* 4. Payments and Refunds (Not Yet Implemented) */}
            <section id="payments-refunds" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                4. Payments and Refunds (Not Yet Implemented)
              </h2>
              <p>
                <strong>Payment processing and commercial checkout are not currently active on this website.</strong>{" "}
                We do not currently collect, process, or store credit cards, debit cards, bank account
                numbers, or billing information.
              </p>
              <p>
                When commercial purchasing launches (Phase 7A), all monetary transactions will be handled
                exclusively by an external, PCI-DSS compliant third-party payment processor. LingoPDF will
                never store full credit card numbers on our servers.
              </p>
              <p>
                <strong>Refund Policy:</strong> All paid licenses will include a contractual{" "}
                <strong>three (3) calendar day money-back guarantee</strong> calculated from the exact date
                and time of your original purchase. Refund requests must be directed to{" "}
                <a href="mailto:support@lingopdf.in" className="text-[var(--color-forest-green)] underline">
                  support@lingopdf.in
                </a>
                . Upon refund issuance, the associated license key will be deactivated. This contractual
                guarantee operates in addition to, and does not limit or waive, any non-excludable statutory
                consumer rights available in your jurisdiction.
              </p>
            </section>

            {/* 5. How the Website Uses Information */}
            <section id="how-we-use-information" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                5. How the Website Uses Information
              </h2>
              <p>We process collected information strictly for operational and security purposes:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>To register, authenticate, and maintain your account profile.</li>
                <li>To dispatch essential transactional emails (verification links and password reset requests).</li>
                <li>To secure our authentication routes using IP-based rate limiting against credential abuse.</li>
                <li>To deliver web pages, assets, and documentation reliably to your client device.</li>
                <li>To respond promptly to support inquiries sent to our support mailbox.</li>
              </ul>
              <p>We do not sell personal data to third parties, nor do we run behavioral ad-tracking scripts.</p>
            </section>

            {/* 6. Extension Functionality and Local PDF Processing */}
            <section id="extension-local-processing" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                6. Extension Functionality and Local PDF Processing
              </h2>
              <p>
                The LingoPDF browser extension is designed with a core commitment to user document
                confidentiality:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Local Document Sandboxing:</strong> When you open a PDF document in your
                  browser, the entire document file is parsed and rendered locally within your browser
                  tab.
                </li>
                <li>
                  <strong>Zero Document Uploads:</strong> LingoPDF does not transmit your PDF pages, text
                  extracts, scanned images, or document contents to remote servers or cloud AI services
                  for vocabulary lookups.
                </li>
                <li>
                  <strong>No Reading History Dossiers:</strong> We do not log which files you read, how long
                  you spend on individual pages, or the specific vocabulary words you select.
                </li>
              </ul>
            </section>

            {/* 7. OCR and Dictionary Lookup */}
            <section id="ocr-dictionary-lookup" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                7. OCR and Dictionary Lookup
              </h2>
              <p>
                All linguistic and optical recognition tools in the LingoPDF extension execute locally:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Local Lexical Datasets:</strong> Comprehensive German–English lexical datasets,
                  definition mappings, and grammatical inflections reside within the extension&apos;s
                  packaged assets, enabling sub-50ms lookup times without remote network requests.
                </li>
                <li>
                  <strong>Client-Side OCR:</strong> For scanned or image-based PDF documents, optical
                  character recognition runs entirely using client-side WebAssembly / JavaScript compute
                  on your computer. Image bitmaps are processed in local memory and are never uploaded
                  to an external server.
                </li>
              </ul>
            </section>

            {/* 8. License Activation and Device Management (Planned) */}
            <section id="license-device-management" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                8. License Activation and Device Management (Planned)
              </h2>
              <p>
                Commercial license activation and device management are <strong>planned features</strong>{" "}
                scheduled for introduction in Phase 7A. They are not currently operational.
              </p>
              <p>
                When implemented, commercial licensing will operate under the following privacy principles:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  A brief network call during initial license activation will verify the validity of your
                  license key.
                </li>
                <li>
                  A pseudonymized cryptographic device identifier will enforce the approved seat limit of
                  a <strong>maximum of two (2) active browser installations or personal devices</strong> per
                  lifetime license.
                </li>
                <li>
                  Following successful one-time activation, paid functionality is engineered to work
                  completely offline without requiring continuous network connectivity or periodic
                  heartbeat pings.
                </li>
              </ul>
            </section>

            {/* 9. Usage Limits and Operational Quota */}
            <section id="usage-limits-logs" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                9. Usage Limits and Operational Quota
              </h2>
              <p>
                LingoPDF offers a permanent free tier of <strong>five (5) word lookups per calendar day</strong>.
                There is no time-based free trial (such as a 3-day or 7-day trial).
              </p>
              <p>
                Based on our actual extension architecture, this daily quota is tracked and stored
                <strong> locally within your browser storage</strong> (using extension storage / LocalStorage)
                associated with calendar dates. Daily lookup counts are not sent to or stored on remote
                servers.
              </p>
            </section>

            {/* 10. Cookies and Similar Technologies */}
            <section id="cookies-technologies" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                10. Cookies and Similar Technologies
              </h2>
              <p>
                We use strictly necessary cookies to operate our authenticated user services and maintain
                functional site preferences:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <code>lingopdf_session</code>: Strictly necessary authentication cookie. Generated upon
                  successful login, configured with <code>HttpOnly</code>, <code>Secure</code> in production,
                  <code>SameSite=Lax</code>, and a 30-day lifetime. Used solely to keep you signed in.
                </li>
                <li>
                  <code>lingopdf_region</code>: Functional preference cookie used to remember your manual
                  currency and regional pricing selection across page visits.
                </li>
              </ul>
              <p>
                We do not use third-party advertising cookies, cross-site tracker beacons, or canvas
                fingerprinting technologies.
              </p>
            </section>

            {/* 11. Third-Party Service Providers */}
            <section id="third-party-providers" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                11. Third-Party Service Providers
              </h2>
              <p>
                To provide dependable web services, we engage the following infrastructure providers:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>MongoDB Atlas:</strong> Managed cloud database infrastructure used to store
                  registered account records, hashed credentials, verification hashes, and session
                  records with network encryption in transit and at rest.
                </li>
                <li>
                  <strong>Resend:</strong> Transactional email service provider used to deliver account
                  verification links and password reset instructions.
                </li>
                <li>
                  <strong>Cloud Hosting / Edge Infrastructure (e.g. Vercel):</strong> Web application
                  hosting, static asset caching, and serverless execution for web endpoints.
                </li>
              </ul>
              <p>
                Each provider processes only the minimum data strictly necessary to execute their designated
                infrastructure service.
              </p>
            </section>

            {/* 12. Data Retention */}
            <section id="data-retention" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                12. Data Retention
              </h2>
              <p>We adhere to data minimization principles across all systems:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>User Accounts:</strong> Account profiles and hashed credentials are retained for
                  as long as your account remains active, or until you request account deletion.
                </li>
                <li>
                  <strong>Sessions:</strong> Active sessions expire automatically after 30 days of inactivity.
                </li>
                <li>
                  <strong>Tokens:</strong> Email verification tokens expire after 24 hours. Password reset
                  tokens expire after 1 hour. Both are deleted immediately upon consumption.
                </li>
                <li>
                  <strong>Server Logs:</strong> Web hosting access logs are rotated and purged on standard
                  hosting provider maintenance schedules.
                </li>
                <li>
                  <strong>Support Inquiries:</strong> Direct customer email correspondence is retained only
                  as long as needed to resolve your query and maintain record continuity.
                </li>
              </ul>
            </section>

            {/* 13. Data Security */}
            <section id="data-security" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                13. Data Security
              </h2>
              <p>We apply robust modern security controls across our platform:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Password Security:</strong> Passwords are hashed using the memory-hard Argon2id
                  algorithm with unique per-user salts. Plaintext passwords are never saved.
                </li>
                <li>
                  <strong>Token Hashing:</strong> Security tokens (email verification and password resets)
                  are stored only as cryptographic SHA-256 hashes. If the database were compromised, raw
                  tokens cannot be retrieved.
                </li>
                <li>
                  <strong>Transit Encryption:</strong> All public website routes enforce HTTPS with modern
                  TLS encryption.
                </li>
                <li>
                  <strong>Cookie Hardening:</strong> Authentication cookies use <code>HttpOnly</code> and{" "}
                  <code>Secure</code> flags with <code>SameSite=Lax</code> to protect against cross-site
                  scripting (XSS) and cross-site request forgery (CSRF).
                </li>
                <li>
                  <strong>Abuse Prevention:</strong> Public authentication endpoints (login, register,
                  password reset, verification) enforce IP-based rate limiting to protect against brute-force
                  attacks.
                </li>
              </ul>
            </section>

            {/* 14. International Data Transfers */}
            <section id="international-transfers" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                14. International Data Transfers
              </h2>
              <p>
                Our hosting infrastructure, database nodes (MongoDB Atlas), and email dispatch systems
                (Resend) may operate in secure data center locations globally. By using https://lingopdf.in
                and creating an account, you acknowledge that your information may be transferred to and
                processed in these facilities in accordance with this Privacy Policy.
              </p>
            </section>

            {/* 15. Children's Privacy */}
            <section id="childrens-privacy" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                15. Children&apos;s Privacy
              </h2>
              <p>
                LingoPDF is intended for general student, research, and adult reading audiences. We do not
                knowingly collect or solicit personal information from children under 13 years of age (or
                applicable local age threshold). If we discover that a child has created an account, we will
                promptly delete that account and associated records upon notice.
              </p>
            </section>

            {/* 16. User Privacy Rights and Choices */}
            <section id="user-rights" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                16. User Privacy Rights and Choices
              </h2>
              <p>
                Depending on your location and applicable privacy laws, you may exercise specific rights
                regarding your personal information:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>The right to request confirmation of the personal data we hold about you.</li>
                <li>The right to request correction of inaccurate or outdated profile details.</li>
                <li>The right to request deletion of your account and associated authentication records.</li>
                <li>The right to withdraw consent for email communications.</li>
              </ul>
              <p>
                To exercise any of these rights, contact us at{" "}
                <a href="mailto:support@lingopdf.in" className="text-[var(--color-forest-green)] underline">
                  support@lingopdf.in
                </a>
                .
              </p>
            </section>

            {/* 17. Policy Updates */}
            <section id="policy-updates" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                17. Policy Updates
              </h2>
              <p>
                We may update this Privacy Policy from time to time as new features (such as commercial
                licensing or additional language editions) are released. When changes are made, we will
                update the &ldquo;Last updated&rdquo; date at the top of this document. Material updates
                will be communicated with notice on our website.
              </p>
            </section>

            {/* 18. Contact Information */}
            <section id="contact-information" className="scroll-mt-24 space-y-4">
              <h2 className="font-heading text-2xl font-bold text-[var(--color-forest-green)]">
                18. Contact Information
              </h2>
              <p>
                For any questions, concerns, or privacy requests regarding this Privacy Policy or our
                local-first reading architecture, please reach out to:
              </p>
              <div className="rounded-2xl border border-[var(--color-soft-sage)] bg-white p-5 sm:p-6 shadow-2xs max-w-md">
                <p className="font-semibold text-[var(--color-forest-green)] mb-1">
                  LingoPDF Support Team
                </p>
                <p className="text-sm text-[var(--color-charcoal)]/80 mb-2">
                  General Inquiries, Privacy Requests &amp; Account Assistance:
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
                  Formal registered corporate entity and statutory postal address details will be
                  formally published upon commercial business registration.
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
