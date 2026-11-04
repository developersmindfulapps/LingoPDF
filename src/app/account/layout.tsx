import React from "react";
import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Account — LingoPDF",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-warm-ivory)] text-[var(--color-charcoal)] antialiased selection:bg-[var(--color-soft-sage)] selection:text-[var(--color-forest-green)]">
      <Navbar />
      <main className="flex-1 py-10 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full">
        {children}
      </main>
      <Footer />
    </div>
  );
}
