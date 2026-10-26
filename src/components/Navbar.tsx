"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { siteConfig } from "@/lib/siteConfig";
import { ExtensionCtaButton } from "./ExtensionCtaButton";
import { LingoPDFLogo } from "./LingoPDFLogo";

interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  isEmailVerified: boolean;
  status: string;
}

export function Navbar() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function checkSession() {
      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setUser(data.user || null);
          }
        }
      } catch {
        // Silently fail if network/server is unavailable
      } finally {
        if (isMounted) {
          setIsLoadingSession(false);
        }
      }
    }
    checkSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-[var(--color-warm-ivory)]/95 backdrop-blur-md border-b border-[var(--color-soft-sage)]/70 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">
          {/* Approved LingoPDF Logo Lockup */}
          <Link
            href="/"
            className="flex items-center shrink-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-forest-green)] rounded-lg p-1 transition-opacity hover:opacity-95"
            aria-label="LingoPDF Home"
          >
            <LingoPDFLogo variant="responsive" priority />
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8" aria-label="Main Navigation">
            {siteConfig.navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm font-medium text-[var(--color-charcoal)]/80 hover:text-[var(--color-forest-green)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-forest-green)] rounded-md px-1 py-0.5"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Right Action Buttons */}
          <div className="hidden md:flex items-center gap-4">
            {!isLoadingSession && user ? (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-[var(--color-charcoal)]/90 truncate max-w-[150px]">
                  {user.name || user.email.split("@")[0]}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-xs font-semibold text-[var(--color-charcoal)]/70 hover:text-[var(--color-terracotta)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-forest-green)] rounded px-1.5 py-1"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <Link
                  href="/login"
                  className="text-sm font-medium text-[var(--color-charcoal)]/80 hover:text-[var(--color-forest-green)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-forest-green)] rounded-md px-2 py-1"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="text-xs font-bold uppercase tracking-wider text-[var(--color-forest-green)] hover:text-[#122B24] border border-[var(--color-soft-sage)] hover:border-[var(--color-forest-green)]/40 rounded-lg px-2.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-forest-green)]"
                >
                  Create Account
                </Link>
              </div>
            )}
            <ExtensionCtaButton label="Get the Extension" size="md" />
          </div>

          {/* Mobile Hamburger Button */}
          <div className="flex md:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-lg text-[var(--color-charcoal)] hover:bg-[var(--color-soft-sage)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-forest-green)]"
              aria-controls="mobile-menu"
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle navigation menu"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                aria-hidden="true"
              >
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[var(--color-soft-sage)] bg-[var(--color-warm-ivory)] px-4 pt-3 pb-6 space-y-3" id="mobile-menu">
          <nav className="flex flex-col space-y-2">
            {siteConfig.navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2 text-base font-medium text-[var(--color-charcoal)] hover:bg-[var(--color-soft-sage)]/50 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="pt-3 border-t border-[var(--color-soft-sage)] flex flex-col gap-2.5">
            {!isLoadingSession && user ? (
              <div className="flex flex-col gap-2 px-3 py-1">
                <span className="text-sm font-medium text-[var(--color-charcoal)]">
                  Signed in as <strong>{user.name || user.email}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full text-left py-1 text-sm font-medium text-[var(--color-terracotta)] hover:underline"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2 text-sm font-medium text-[var(--color-charcoal)] hover:text-[var(--color-forest-green)]"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2 text-sm font-semibold text-[var(--color-forest-green)] bg-white border border-[var(--color-soft-sage)] rounded-lg"
                >
                  Create Account
                </Link>
              </>
            )}
            <ExtensionCtaButton label="Get the Extension" size="md" fullWidth />
          </div>
        </div>
      )}
    </header>
  );
}
