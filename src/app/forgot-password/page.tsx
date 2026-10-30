import React, { Suspense } from "react";
import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Forgot Password — LingoPDF",
  description: "Request a password reset link for your LingoPDF account.",
};

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-warm-ivory)] text-[var(--color-charcoal)] antialiased selection:bg-[var(--color-soft-sage)] selection:text-[var(--color-forest-green)]">
      <Navbar />

      <main className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl border border-[var(--color-soft-sage)] p-8 sm:p-10 shadow-lg">
            <div className="text-center mb-8">
              <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-terracotta)] mb-2 block">
                Account Recovery
              </span>
              <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-forest-green)]">
                Reset your password
              </h1>
              <p className="mt-2 text-sm text-[var(--color-charcoal)]/70 font-sans">
                Enter your registered email address and we&apos;ll send you a link to reset your password.
              </p>
            </div>

            <Suspense fallback={<div className="h-48 flex items-center justify-center text-sm text-[var(--color-charcoal)]/50">Loading...</div>}>
              <ForgotPasswordForm />
            </Suspense>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
