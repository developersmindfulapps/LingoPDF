import React, { Suspense } from "react";
import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = {
  title: "Create Account — LingoPDF",
  description: "Create a LingoPDF account to manage your licenses and reading preferences.",
};

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-warm-ivory)] text-[var(--color-charcoal)] antialiased selection:bg-[var(--color-soft-sage)] selection:text-[var(--color-forest-green)]">
      <Navbar />

      <main className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl border border-[var(--color-soft-sage)] p-8 sm:p-10 shadow-lg">
            <div className="text-center mb-8">
              <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-terracotta)] mb-2 block">
                Get Started
              </span>
              <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-forest-green)]">
                Create your LingoPDF account
              </h1>
              <p className="mt-2 text-sm text-[var(--color-charcoal)]/70 font-sans">
                Set up your profile to manage licenses and reading tools.
              </p>
            </div>

            <Suspense fallback={<div className="h-64 flex items-center justify-center text-sm text-[var(--color-charcoal)]/50">Loading registration...</div>}>
              <RegisterForm />
            </Suspense>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
