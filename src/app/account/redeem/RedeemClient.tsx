"use client";

import React, { useState } from "react";
import Link from "next/link";

interface RedeemClientProps {
  userEmail: string;
  hasExistingEntitlement: boolean;
}

export function RedeemClient({ userEmail, hasExistingEntitlement }: RedeemClientProps) {
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAlreadyEntitled, setIsAlreadyEntitled] = useState(hasExistingEntitlement);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmed = code.trim();
    if (!trimmed) {
      setErrorMessage("Please enter your promotional code.");
      return;
    }

    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/promo-codes/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrorMessage(
          json.error ||
            "Failed to redeem code. Please verify the code and try again."
        );
        return;
      }

      setSuccessMessage(
        json.message ||
          "Your complimentary German → English LingoPDF licence has been successfully granted."
      );
      setCode("");
      setIsAlreadyEntitled(true);
    } catch {
      setErrorMessage(
        "A network error occurred. Please check your connection and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Page Header */}
      <div>
        <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-terracotta)] block mb-2">
          Licence Redemption
        </span>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[var(--color-forest-green)]">
          Redeem Promotional Licence
        </h1>
        <p className="text-sm text-[var(--color-charcoal)]/75 mt-2 leading-relaxed">
          Received a 100% complimentary promotional code from LingoPDF? Enter it below to grant
          your account (<strong>{userEmail}</strong>) a full German → English edition licence.
        </p>
      </div>

      {/* Existing Entitlement Banner (if already active) */}
      {isAlreadyEntitled && !successMessage && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6 flex items-start gap-4 shadow-2xs">
          <div className="w-8 h-8 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-800 shrink-0 font-bold">
            ✓
          </div>
          <div className="space-y-1">
            <h2 className="font-heading text-sm font-bold text-emerald-950">
              German → English Licence Active
            </h2>
            <p className="text-xs text-emerald-900 leading-relaxed">
              Your account currently holds an active German → English edition licence. Each LingoPDF
              account is limited to one licence per language edition.
            </p>
          </div>
        </div>
      )}

      {/* Success Banner */}
      {successMessage && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 sm:p-8 space-y-4 shadow-xs"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 text-base font-bold">
              ✓
            </div>
            <div>
              <h2 className="font-heading text-lg font-bold text-emerald-950">
                Licence Successfully Granted
              </h2>
              <p className="text-sm font-medium text-emerald-900 mt-1 leading-relaxed">
                {successMessage}
              </p>
            </div>
          </div>

          {/* Planned Extension Activation Notice */}
          <div className="p-4 rounded-xl bg-white/80 border border-emerald-200/80 text-xs text-emerald-950 space-y-1.5 leading-relaxed">
            <p className="font-bold text-emerald-900 uppercase tracking-wider text-[11px]">
              Next Steps &amp; Extension Activation
            </p>
            <p>
              Your account entitlement is active in the LingoPDF database. You can now generate a single-use
              activation code in your account to bind your Chrome extension.
            </p>
          </div>

          <div className="pt-2 flex flex-wrap gap-3">
            <Link
              href="/account/devices"
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-[var(--color-forest-green)] hover:bg-[#122B24] transition-colors"
            >
              Activate Extension Now →
            </Link>
            <Link
              href="/products/german-english"
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--color-forest-green)] bg-white border border-[var(--color-soft-sage)] hover:bg-[#E8E4D9]/40 transition-colors"
            >
              Explore German Edition
            </Link>
          </div>
        </div>
      )}

      {/* Redemption Form Card */}
      {!successMessage && (
        <div className="bg-white rounded-2xl border border-[var(--color-soft-sage)] p-6 sm:p-8 shadow-xs space-y-6">
          <div>
            <h2 className="font-heading text-base font-bold text-[var(--color-forest-green)]">
              Enter Your Code
            </h2>
            <p className="text-xs text-[var(--color-charcoal)]/70 mt-1">
              Codes are formatted as <code className="font-mono text-[#193C32] font-semibold">LINGO-GIFT-XXXX-XXXX</code> and can each be redeemed only once.
            </p>
          </div>

          {errorMessage && (
            <div
              role="alert"
              aria-live="assertive"
              className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-3"
            >
              <span className="text-rose-600 font-bold shrink-0">✕</span>
              <div className="leading-relaxed font-medium">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label
                htmlFor="promo-code"
                className="block text-xs font-semibold text-[var(--color-charcoal)] mb-1.5"
              >
                Promotional Code
              </label>
              <input
                id="promo-code"
                name="code"
                type="text"
                required
                maxLength={50}
                autoComplete="off"
                placeholder="LINGO-GIFT-XXXX-XXXX"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                disabled={isSubmitting || (isAlreadyEntitled && !successMessage)}
                className="w-full px-4 py-3 rounded-xl border border-[var(--color-soft-sage)] font-mono text-sm tracking-wider uppercase bg-white text-[var(--color-charcoal)] placeholder-[var(--color-charcoal)]/40 focus:outline-none focus:ring-2 focus:ring-[var(--color-forest-green)] hover:border-[var(--color-forest-green)]/40 transition-all disabled:opacity-50"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || (isAlreadyEntitled && !successMessage)}
                className="w-full sm:w-auto px-8 py-3 rounded-xl font-heading text-xs font-semibold text-white bg-[var(--color-forest-green)] hover:bg-[#122B24] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <span>Redeem Licence</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Helpful Information Box */}
      <div className="rounded-2xl border border-[var(--color-soft-sage)] bg-[#F8F5EE] p-5 text-xs text-[var(--color-charcoal)]/75 space-y-2 leading-relaxed">
        <h3 className="font-heading font-bold text-[var(--color-forest-green)] uppercase tracking-wider text-[11px]">
          About Promotional Licences
        </h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Every promotional code grants a 100% full edition licence with zero payment required.</li>
          <li>Codes are strictly single-use and become invalid immediately upon redemption.</li>
          <li>Each customer account may hold one active licence per language edition under our 1-device policy.</li>
          <li>Need assistance? Reach out to <a href="mailto:support@lingopdf.in" className="underline font-semibold text-[var(--color-forest-green)]">support@lingopdf.in</a>.</li>
        </ul>
      </div>
    </div>
  );
}
