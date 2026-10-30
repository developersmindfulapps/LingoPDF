import React, { Suspense } from "react";
import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { VerifyEmailClient } from "./VerifyEmailClient";

export const metadata: Metadata = {
  title: "Verify Email — LingoPDF",
  description: "Verify your email address to access your LingoPDF account.",
};

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-warm-ivory)] text-[var(--color-charcoal)] antialiased selection:bg-[var(--color-soft-sage)] selection:text-[var(--color-forest-green)]">
      <Navbar />

      <main className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl border border-[var(--color-soft-sage)] p-8 sm:p-10 shadow-lg">
            <Suspense
              fallback={
                <div className="h-48 flex items-center justify-center text-sm text-[var(--color-charcoal)]/50">
                  Loading verification...
                </div>
              }
            >
              <VerifyEmailClient />
            </Suspense>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
