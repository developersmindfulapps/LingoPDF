"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function RegisterForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [registeredSuccess, setRegisteredSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage("Please enter your email address.");
      return;
    }
    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters long.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          password,
          name: name.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.code === "RATE_LIMITED") {
          setErrorMessage("Too many registration attempts. Please wait a few minutes before trying again.");
        } else if (data.code === "EMAIL_EXISTS") {
          setErrorMessage("An account with this email address already exists. Please sign in instead.");
        } else if (data.code === "DB_UNAVAILABLE") {
          setErrorMessage("Registration service is temporarily unavailable. Please try again shortly.");
        } else {
          setErrorMessage(data.error || "Unable to complete registration. Please check your information.");
        }
        setIsLoading(false);
        return;
      }

      // Registration succeeded & session cookie was established
      setIsLoading(false);
      setRegisteredSuccess(true);
    } catch {
      setErrorMessage("An unexpected network error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  if (registeredSuccess) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-forest-green)]/10 text-[var(--color-forest-green)]">
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>

        <div className="space-y-2">
          <h2 className="font-heading text-xl font-bold text-[var(--color-forest-green)]">
            Account Created Successfully
          </h2>
          <p className="text-sm text-[var(--color-charcoal)]/80 leading-relaxed font-sans">
            Welcome to LingoPDF! Your account has been registered.
          </p>
        </div>

        {/* Clear Notice on Email Verification status */}
        <div className="rounded-2xl border border-[var(--color-soft-sage)] bg-[var(--color-warm-ivory)]/60 p-4 text-left space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--color-terracotta)]">
            <span>Notice: Email Verification</span>
          </div>
          <p className="text-xs text-[var(--color-charcoal)]/80 leading-relaxed font-sans">
            Email verification delivery is not yet configured on this system. No verification email was sent. Your account is active for initial exploration and full email verification will be activated in an upcoming update.
          </p>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={() => {
              router.push("/");
              router.refresh();
            }}
            className="w-full rounded-xl bg-[var(--color-forest-green)] py-3 px-4 font-semibold text-white shadow-sm hover:bg-[#122B24] transition-all"
          >
            Continue to LingoPDF
          </button>
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

      {/* Name Field (Optional) */}
      <div>
        <label
          htmlFor="register-name"
          className="block text-xs font-bold uppercase tracking-wider text-[var(--color-forest-green)] mb-1.5"
        >
          Name <span className="font-normal lowercase text-[var(--color-charcoal)]/60">(optional)</span>
        </label>
        <input
          id="register-name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isLoading}
          placeholder="Your name"
          className="w-full rounded-xl border border-[var(--color-soft-sage)] bg-[var(--color-warm-ivory)]/40 px-4 py-2.5 text-sm text-[var(--color-charcoal)] placeholder-[var(--color-charcoal)]/40 focus:border-[var(--color-forest-green)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-forest-green)]/20 transition-all disabled:opacity-60"
        />
      </div>

      {/* Email Field */}
      <div>
        <label
          htmlFor="register-email"
          className="block text-xs font-bold uppercase tracking-wider text-[var(--color-forest-green)] mb-1.5"
        >
          Email Address
        </label>
        <input
          id="register-email"
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

      {/* Password Field */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label
            htmlFor="register-password"
            className="block text-xs font-bold uppercase tracking-wider text-[var(--color-forest-green)]"
          >
            Password
          </label>
          <span className="text-[11px] text-[var(--color-charcoal)]/60">Min. 8 characters</span>
        </div>
        <div className="relative">
          <input
            id="register-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            placeholder="••••••••"
            className="w-full rounded-xl border border-[var(--color-soft-sage)] bg-[var(--color-warm-ivory)]/40 px-4 py-2.5 pr-11 text-sm text-[var(--color-charcoal)] placeholder-[var(--color-charcoal)]/40 focus:border-[var(--color-forest-green)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-forest-green)]/20 transition-all disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[var(--color-charcoal)]/50 hover:text-[var(--color-forest-green)] focus:outline-none focus-visible:text-[var(--color-forest-green)]"
          >
            {showPassword ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Terms acknowledgement */}
      <p className="text-[11px] text-[var(--color-charcoal)]/60 leading-relaxed">
        By creating an account, you acknowledge our{" "}
        <Link href="/terms" className="underline hover:text-[var(--color-forest-green)]">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline hover:text-[var(--color-forest-green)]">
          Privacy Policy
        </Link>
        .
      </p>

      {/* Submit Button */}
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
            <span>Creating account...</span>
          </>
        ) : (
          <span>Create Account</span>
        )}
      </button>

      {/* Link to Login */}
      <div className="pt-4 border-t border-[var(--color-soft-sage)]/60 text-center">
        <p className="text-xs sm:text-sm text-[var(--color-charcoal)]/70">
          Already have an account?{" "}
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
