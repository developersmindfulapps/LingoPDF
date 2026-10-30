"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type VerificationStatus =
  | "loading"
  | "success"
  | "already_verified"
  | "expired"
  | "invalid"
  | "no_token";

export function VerifyEmailClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<VerificationStatus>(
    token ? "loading" : "no_token"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Resend form state
  const [resendEmail, setResendEmail] = useState("");
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    let isMounted = true;

    async function verify() {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();

        if (!isMounted) return;

        if (res.ok) {
          if (data.status === "already_verified") {
            setStatus("already_verified");
          } else {
            setStatus("success");
          }
        } else {
          if (data.code === "TOKEN_EXPIRED") {
            setStatus("expired");
            if (data.email) setResendEmail(data.email);
            setErrorMessage(data.error);
          } else {
            setStatus("invalid");
            setErrorMessage(data.error || "Invalid or used verification link.");
          }
        }
      } catch {
        if (!isMounted) return;
        setStatus("invalid");
        setErrorMessage("Network error occurred during email verification.");
      }
    }

    verify();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    setResendError(null);
    setResendSuccess(false);

    const emailTrimmed = resendEmail.trim();
    if (!emailTrimmed) {
      setResendError("Please enter your email address.");
      return;
    }

    setIsResending(true);

    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailTrimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResendError(data.error || "Unable to send verification email.");
      } else {
        setResendSuccess(true);
      }
    } catch {
      setResendError("A network error occurred. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  // 1. Loading State
  if (status === "loading") {
    return (
      <div className="text-center py-8 space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-forest-green)]/10">
          <svg
            className="h-6 w-6 animate-spin text-[var(--color-forest-green)]"
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
        </div>
        <p className="text-sm font-medium text-[var(--color-charcoal)]/80">
          Verifying your email address...
        </p>
      </div>
    );
  }

  // 2. Success State
  if (status === "success") {
    return (
      <div className="text-center space-y-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-forest-green)]/10 text-[var(--color-forest-green)]">
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>

        <div className="space-y-2">
          <h2 className="font-heading text-xl font-bold text-[var(--color-forest-green)]">
            Email Verified Successfully!
          </h2>
          <p className="text-sm text-[var(--color-charcoal)]/80 leading-relaxed font-sans">
            Your email address has been verified. You now have full access to your LingoPDF account.
          </p>
        </div>

        <div className="pt-2">
          <Link
            href="/login"
            className="w-full inline-block rounded-xl bg-[var(--color-forest-green)] py-3 px-4 font-semibold text-white shadow-sm hover:bg-[#122B24] transition-all"
          >
            Sign In to Continue
          </Link>
        </div>
      </div>
    );
  }

  // 3. Already Verified State
  if (status === "already_verified") {
    return (
      <div className="text-center space-y-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-soft-sage)] text-[var(--color-forest-green)]">
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <div className="space-y-2">
          <h2 className="font-heading text-xl font-bold text-[var(--color-forest-green)]">
            Already Verified
          </h2>
          <p className="text-sm text-[var(--color-charcoal)]/80 leading-relaxed font-sans">
            Your email address is already verified. You can sign in to your account at any time.
          </p>
        </div>

        <div className="pt-2">
          <Link
            href="/login"
            className="w-full inline-block rounded-xl bg-[var(--color-forest-green)] py-3 px-4 font-semibold text-white shadow-sm hover:bg-[#122B24] transition-all"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  // 4. Expired State
  if (status === "expired") {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-terracotta)]/10 text-[var(--color-terracotta)]">
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <div className="space-y-2">
          <h2 className="font-heading text-xl font-bold text-[var(--color-forest-green)]">
            Verification Link Expired
          </h2>
          <p className="text-sm text-[var(--color-charcoal)]/80 leading-relaxed font-sans">
            {errorMessage || "Verification links are valid for 24 hours. Please request a new link below."}
          </p>
        </div>

        {/* Resend Form */}
        <div className="rounded-2xl border border-[var(--color-soft-sage)] bg-[var(--color-warm-ivory)]/40 p-5 text-left space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-forest-green)]">
            Request New Verification Link
          </h3>

          {resendSuccess ? (
            <div className="rounded-xl border border-[var(--color-forest-green)]/30 bg-[var(--color-forest-green)]/10 p-3 text-xs text-[var(--color-forest-green)] font-medium">
              A new verification link has been sent to your email address if an account exists.
            </div>
          ) : (
            <form onSubmit={handleResend} className="space-y-3">
              {resendError && (
                <div className="rounded-xl border border-[var(--color-terracotta)]/30 bg-[var(--color-terracotta)]/10 p-2.5 text-xs text-[var(--color-charcoal)]">
                  {resendError}
                </div>
              )}
              <input
                type="email"
                required
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={isResending}
                className="w-full rounded-xl border border-[var(--color-soft-sage)] bg-white px-3.5 py-2 text-sm text-[var(--color-charcoal)] focus:border-[var(--color-forest-green)] focus:outline-none"
              />
              <button
                type="submit"
                disabled={isResending}
                className="w-full rounded-xl bg-[var(--color-forest-green)] py-2.5 px-4 text-xs font-semibold text-white hover:bg-[#122B24] transition-all disabled:opacity-60"
              >
                {isResending ? "Sending..." : "Send New Verification Link"}
              </button>
            </form>
          )}
        </div>

        <div>
          <Link href="/login" className="text-xs font-medium text-[var(--color-forest-green)] hover:underline">
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  // 5. Invalid / Used State or No Token
  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-terracotta)]/10 text-[var(--color-terracotta)]">
        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      </div>

      <div className="space-y-2">
        <h2 className="font-heading text-xl font-bold text-[var(--color-forest-green)]">
          {status === "no_token" ? "Verify Your Email" : "Invalid Verification Link"}
        </h2>
        <p className="text-sm text-[var(--color-charcoal)]/80 leading-relaxed font-sans">
          {status === "no_token"
            ? "Please check your email inbox and click the verification link we sent you."
            : errorMessage || "This link is invalid or has already been used. You can request a new verification link below."}
        </p>
      </div>

      {/* Resend Form */}
      <div className="rounded-2xl border border-[var(--color-soft-sage)] bg-[var(--color-warm-ivory)]/40 p-5 text-left space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-forest-green)]">
          Need a New Link?
        </h3>

        {resendSuccess ? (
          <div className="rounded-xl border border-[var(--color-forest-green)]/30 bg-[var(--color-forest-green)]/10 p-3 text-xs text-[var(--color-forest-green)] font-medium">
            A new verification link has been sent to your email address if an unverified account exists.
          </div>
        ) : (
          <form onSubmit={handleResend} className="space-y-3">
            {resendError && (
              <div className="rounded-xl border border-[var(--color-terracotta)]/30 bg-[var(--color-terracotta)]/10 p-2.5 text-xs text-[var(--color-charcoal)]">
                {resendError}
              </div>
            )}
            <input
              type="email"
              required
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={isResending}
              className="w-full rounded-xl border border-[var(--color-soft-sage)] bg-white px-3.5 py-2 text-sm text-[var(--color-charcoal)] focus:border-[var(--color-forest-green)] focus:outline-none"
            />
            <button
              type="submit"
              disabled={isResending}
              className="w-full rounded-xl bg-[var(--color-forest-green)] py-2.5 px-4 text-xs font-semibold text-white hover:bg-[#122B24] transition-all disabled:opacity-60"
            >
              {isResending ? "Sending..." : "Resend Verification Link"}
            </button>
          </form>
        )}
      </div>

      <div>
        <Link href="/login" className="text-xs font-medium text-[var(--color-forest-green)] hover:underline">
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}
