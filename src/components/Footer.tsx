import React from "react";
import Link from "next/link";
import { LingoPDFLogo } from "./LingoPDFLogo";

export function Footer() {
  return (
    <footer className="w-full bg-[var(--color-warm-ivory)] border-t border-[var(--color-soft-sage)] pt-16 pb-12 text-[var(--color-charcoal)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-[var(--color-soft-sage)]">
          {/* Brand Column */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center">
              <LingoPDFLogo variant="horizontal" isDecorative className="h-9" />
            </div>
            <p className="text-sm text-[var(--color-charcoal)]/80 max-w-sm leading-relaxed font-sans">
              LingoPDF creates focused tools for readers, researchers, and students to read foreign language texts without losing their focus or flow.
            </p>
          </div>

          {/* Products Column */}
          <div className="space-y-3">
            <h4 className="font-heading text-xs font-bold uppercase tracking-wider text-[var(--color-forest-green)]">
              Products
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/products/german-english" className="text-[var(--color-charcoal)]/80 hover:text-[var(--color-forest-green)] transition-colors">
                  German PDF Reader
                </Link>
              </li>
              <li>
                <a href="#products" className="text-[var(--color-charcoal)]/60 hover:text-[var(--color-forest-green)] transition-colors">
                  French Reader (Coming)
                </a>
              </li>
              <li>
                <a href="#products" className="text-[var(--color-charcoal)]/60 hover:text-[var(--color-forest-green)] transition-colors">
                  Italian Reader (Coming)
                </a>
              </li>
            </ul>
          </div>

          {/* Support Column */}
          <div className="space-y-3">
            <h4 className="font-heading text-xs font-bold uppercase tracking-wider text-[var(--color-forest-green)]">
              Support
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a href="#pricing" className="text-[var(--color-charcoal)]/80 hover:text-[var(--color-forest-green)] transition-colors">
                  Help Center
                </a>
              </li>
              <li>
                <a href="#pricing" className="text-[var(--color-charcoal)]/80 hover:text-[var(--color-forest-green)] transition-colors">
                  Contact
                </a>
              </li>
              <li>
                <a href="#pricing" className="text-[var(--color-charcoal)]/80 hover:text-[var(--color-forest-green)] transition-colors">
                  Refund Policy
                </a>
              </li>
            </ul>
          </div>

          {/* Legal Column */}
          <div className="space-y-3">
            <h4 className="font-heading text-xs font-bold uppercase tracking-wider text-[var(--color-forest-green)]">
              Legal
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/privacy" className="text-[var(--color-charcoal)]/80 hover:text-[var(--color-forest-green)] transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-[var(--color-charcoal)]/80 hover:text-[var(--color-forest-green)] transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--color-charcoal)]/60">
          <p>© 2026 LingoPDF. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
