import React, { Suspense } from "react";
import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign In — LingoPDF",
  description: "Sign in to your LingoPDF account to manage your profile and license.",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-warm-ivory)] text-[var(--color-charcoal)] antialiased selection:bg-[var(--color-soft-sage)] selection:text-[var(--color-forest-green)]">
      <Navbar />

      <main className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl border border-[var(--color-soft-sage)] p-8 sm:p-10 shadow-lg">
            <div className="text-center mb-8">
              <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-terracotta)] mb-2 block">
                Welcome Back
              </span>
              <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-forest-green)]">
                Sign in to LingoPDF
              </h1>
              <p className="mt-2 text-sm text-[var(--color-charcoal)]/70 font-sans">
                Access your account, settings, and license status.
              </p>
            </div>

            <Suspense fallback={<div className="h-64 flex items-center justify-center text-sm text-[var(--color-charcoal)]/50">Loading sign in...</div>}>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
