import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/lib/db/mongodb";
import { findActiveReferralProfileByCode } from "@/lib/referrals/service";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export interface ReferralLandingProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({
  params,
}: ReferralLandingProps): Promise<Metadata> {
  const { code } = await params;
  const upperCode = (code || "").toUpperCase();
  return {
    title: `You've been invited to LingoPDF — Save 10% with code ${upperCode}`,
    description: `Read German PDFs without losing your flow. Use referral code ${upperCode} to claim an exclusive 10% discount on your LingoPDF lifetime license.`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function ReferralLandingPage({
  params,
}: ReferralLandingProps) {
  const { code } = await params;
  const upperCode = (code || "").trim().toUpperCase();

  let db;
  try {
    db = await getDb();
  } catch {
    // If DB is offline, fall back gracefully
    db = null;
  }

  const profile = db
    ? await findActiveReferralProfileByCode(db, upperCode)
    : null;

  const isValidCode = Boolean(profile);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-warm-ivory)] text-[var(--color-charcoal)] antialiased selection:bg-[var(--color-soft-sage)] selection:text-[var(--color-forest-green)]">
      <Navbar />

      <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="w-full max-w-2xl space-y-8">
          {/* Top Banner / Discount Header */}
          <div className="bg-white rounded-3xl border border-[var(--color-soft-sage)] p-8 sm:p-10 shadow-lg text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold uppercase tracking-wider">
              <span>🎁 Special Invitation • 10% Referral Discount</span>
            </div>

            <div className="space-y-3">
              <h1 className="font-heading text-3xl sm:text-4xl font-extrabold text-[var(--color-forest-green)] tracking-tight">
                Master German PDFs with Instant Inline Lookups
              </h1>
              <p className="text-base text-[var(--color-charcoal)]/80 leading-relaxed max-w-xl mx-auto">
                LingoPDF PDF Reader helps you read German documents and build vocabulary in context with effortless inline word lookup, local dictionary definitions, and built-in local OCR for scanned pages.
              </p>
            </div>

            {/* Referral Code Showcase */}
            <div className="rounded-2xl border border-[var(--color-forest-green)]/30 bg-[var(--color-warm-ivory)]/70 p-6 max-w-md mx-auto space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-charcoal)]/60">
                Your Exclusive Referral Code
              </div>
              <div className="font-mono text-2xl font-black tracking-wider text-[var(--color-forest-green)]">
                {upperCode}
              </div>
              {isValidCode ? (
                <div className="text-xs font-medium text-emerald-700">
                  ✓ Verified active referral code — 10% discount ready
                </div>
              ) : (
                <div className="text-xs text-[var(--color-charcoal)]/70">
                  Discount applied automatically during account creation
                </div>
              )}
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <Link
                href={`/register?ref=${encodeURIComponent(upperCode)}`}
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-[var(--color-forest-green)] px-6 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-[#122B24] active:bg-[#0c1f1a] transition-colors"
              >
                Claim 10% Discount &amp; Create Account →
              </Link>
              <Link
                href={`/login?callbackUrl=${encodeURIComponent(`/products/german-english`)}`}
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-[var(--color-soft-sage)] bg-white px-5 py-3.5 text-sm font-semibold text-[var(--color-charcoal)] hover:bg-[var(--color-soft-sage)]/40 transition-colors"
              >
                Sign In to Existing Account
              </Link>
            </div>

            {/* Mobile / Instagram In-App Browser Guidance */}
            <div className="pt-6 border-t border-[var(--color-soft-sage)]/60 text-left text-xs text-[var(--color-charcoal)]/75 space-y-2">
              <div className="font-bold uppercase tracking-wider text-[var(--color-forest-green)] flex items-center gap-1.5">
                <span>📱 Viewing on Mobile or Instagram?</span>
              </div>
              <p className="leading-relaxed">
                LingoPDF PDF Reader is a desktop browser extension for Google Chrome. You can create your account and lock in your 10% discount right now on your phone. When you open your laptop or desktop Chrome browser, simply sign in at{" "}
                <strong className="text-[var(--color-forest-green)]">lingopdf.in</strong> to activate your license on your computer.
              </p>
            </div>
          </div>

          {/* Key Product Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="bg-white rounded-2xl border border-[var(--color-soft-sage)] p-5 space-y-1.5 shadow-xs">
              <div className="text-xl">📖</div>
              <h3 className="font-heading font-bold text-sm text-[var(--color-forest-green)]">
                Local-First Lookups
              </h3>
              <p className="text-xs text-[var(--color-charcoal)]/70">
                Instant German-to-English dictionary lookups right on the PDF page.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-[var(--color-soft-sage)] p-5 space-y-1.5 shadow-xs">
              <div className="text-xl">🔍</div>
              <h3 className="font-heading font-bold text-sm text-[var(--color-forest-green)]">
                Scanned PDF OCR
              </h3>
              <p className="text-xs text-[var(--color-charcoal)]/70">
                Built-in local OCR recognizes text in historical and scanned documents.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-[var(--color-soft-sage)] p-5 space-y-1.5 shadow-xs">
              <div className="text-xl">🔒</div>
              <h3 className="font-heading font-bold text-sm text-[var(--color-forest-green)]">
                100% Private
              </h3>
              <p className="text-xs text-[var(--color-charcoal)]/70">
                Your private documents never get uploaded or transmitted to external servers.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
