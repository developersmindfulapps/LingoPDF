import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Account Sign In — LingoPDF",
  description: "Account functionality is currently unavailable during the private promotional preview.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-warm-ivory)] text-[var(--color-charcoal)] antialiased selection:bg-[var(--color-soft-sage)] selection:text-[var(--color-forest-green)]">
      <Navbar />

      <main className="flex-1 flex items-center justify-center py-16 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-lg">
          <div className="bg-white rounded-3xl border border-[var(--color-soft-sage)] p-8 sm:p-10 shadow-lg text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-warm-ivory)] border border-[var(--color-soft-sage)] text-[var(--color-terracotta)] text-xs font-bold uppercase tracking-wider">
              Private Promotional Preview
            </div>

            <div className="space-y-3">
              <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-forest-green)]">
                Account Sign In Unavailable
              </h1>
              <p className="text-sm sm:text-base text-[var(--color-charcoal)]/80 leading-relaxed font-sans">
                Account functionality is currently unavailable during our limited promotional preview.
                LingoPDF is currently being shared with a small group of selected testers. During this preview, invited participants can use the German vocabulary-building PDF reader free of charge without creating an account or signing in on the website.
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--color-soft-sage)] bg-[var(--color-warm-ivory)]/40 p-4 text-xs text-[var(--color-charcoal)]/75 space-y-2">
              <p>
                If you are an invited tester experiencing issues with your promotional extension access, or if you have questions about future commercial availability, please contact our support team.
              </p>
              <p className="font-semibold text-[var(--color-forest-green)]">
                <a href="mailto:support@lingopdf.in" className="underline">
                  support@lingopdf.in
                </a>
              </p>
            </div>

            <div className="pt-2">
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-xl bg-[var(--color-forest-green)] px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#122B24] active:bg-[#0c1f1a] transition-colors"
              >
                ← Return to Homepage
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
