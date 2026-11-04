import React from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export default function ReferralCodeLoading() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-warm-ivory)]">
      <Navbar />
      <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="w-full max-w-2xl bg-white rounded-3xl border border-[var(--color-soft-sage)] p-8 text-center space-y-6 animate-pulse">
          <div className="h-6 w-48 bg-stone-200 rounded mx-auto"></div>
          <div className="h-10 w-80 bg-stone-100 rounded mx-auto"></div>
          <div className="h-24 bg-stone-50 rounded-2xl"></div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
