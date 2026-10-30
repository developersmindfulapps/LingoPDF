"use client";

import React, { useState } from "react";
import Link from "next/link";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setErrorMessage("Please enter your email address.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.code === "RATE_LIMITED") {
          setErrorMessage("Too many reset requests. Please wait a few minutes before trying again.");
        } else {
          setErrorMessage(data.error || "Unable to process password reset request.");
        }
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
      setIsSubmitted(true);
    } catch {
      setErrorMessage("A network error occurred. Please check your connection and try again.");
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-forest-green)]/10 text-[var(--color-forest-green)]">
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        </div>

        <div className="space-y-2">
          <h2 className="font-heading text-xl font-bold text-[var(--color-forest-green)]">
            Check Your Email
          </h2>
          <p className="text-sm text-[var(--color-charcoal)]/80 leading-relaxed font-sans">
            If an account is associated with <strong className="text-[var(--color-forest-green)]">{email}</strong>, we have sent instructions to reset your password.
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--color-soft-sage)] bg-[var(--color-warm-ivory)]/40 p-4 text-left space-y-1">
          <p className="text-xs text-[var(--color-charcoal)]/80 font-sans leading-relaxed">
            • Password reset links expire in <strong>1 hour</strong> for your security.<br />
            • Don&apos;t see the email? Be sure to check your spam or junk folder.
          </p>
        </div>

        <div className="pt-2">
          <Link
            href="/login"
            className="w-full inline-block rounded-xl bg-[var(--color-forest-green)] py-3 px-4 font-semibold text-white shadow-sm hover:bg-[#122B24] transition-all"
          >
            Return to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {errorMessage && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-xl border border-[var(--color-terracotta)]/30 bg-[var(--color-terracotta)]/10 p-3.5 text-xs sm:text-sm text-[var(--color-charcoal)] leading-relaxed flex items-start gap-2.5"
        >
          <span className="text-[var(--color-terracotta)] font-bold text-base leading-none">!</span>
          <span>{errorMessage}</span>
        </div>
      )}

      <div>
        <label
          htmlFor="forgot-email"
          className="block text-xs font-bold uppercase tracking-wider text-[var(--color-forest-green)] mb-1.5"
        >
          Email Address
        </label>
        <input
          id="forgot-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          placeholder="you@example.com"
          className="w-full rounded-xl border border-[var(--color-soft-sage)] bg-[var(--color-warm-ivory)]/40 px-4 py-2.5 text-sm text-[var(--color-charcoal)] placeholder-[var(--color-charcoal)]/40 focus:border-[var(--color-forest-green)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-forest-green)]/20 transition-all disabled:opacity-60"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-xl bg-[var(--color-forest-green)] py-3 px-4 font-semibold text-white shadow-sm hover:bg-[#122B24] active:bg-[#0c1f1a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-forest-green)] transition-all duration-150 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Sending instructions...</span>
          </>
        ) : (
          <span>Send Reset Instructions</span>
        )}
      </button>

      <div className="pt-4 border-t border-[var(--color-soft-sage)]/60 text-center">
        <p className="text-xs sm:text-sm text-[var(--color-charcoal)]/70">
          Remember your password?{" "}
          <Link
            href="/login"
            className="font-semibold text-[var(--color-forest-green)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-forest-green)] rounded"
          >
            Sign in
          </Link>
        </p>
      </div>
    </form>
  );
}
