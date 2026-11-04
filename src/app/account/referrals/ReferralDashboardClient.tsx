"use client";

import React, { useState } from "react";
import { CustomerReferralStats } from "@/lib/referrals/service";

export interface ReferralDashboardClientProps {
  initialStats: CustomerReferralStats;
  userName: string | null;
  userEmail: string;
}

export function ReferralDashboardClient({
  initialStats,
  userName,
}: ReferralDashboardClientProps) {
  const [stats, setStats] = useState<CustomerReferralStats>(initialStats);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const [regenerateSuccess, setRegenerateSuccess] = useState<string | null>(null);

  const readyToShareMessage = `Read German PDFs effortlessly with instant inline vocabulary lookups! Use my code ${stats.referralCode} to get 10% off your LingoPDF lifetime license: ${stats.shareableUrl}`;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(stats.referralCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(stats.shareableUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "10% off LingoPDF — German-to-English Vocabulary Reader",
          text: `Read German PDFs without losing your flow. Use my code ${stats.referralCode} to save 10% on your license!`,
          url: stats.shareableUrl,
        });
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2000);
      } catch {
        // User cancelled or share failed
      }
    } else {
      // Clipboard fallback
      await handleCopyLink();
    }
  };

  const handleRegenerateCode = async () => {
    setIsRegenerating(true);
    setRegenerateError(null);
    setRegenerateSuccess(null);

    try {
      const res = await fetch("/api/referrals/regenerate", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        setRegenerateError(data.error || "Failed to generate new referral code.");
        setIsRegenerating(false);
        return;
      }

      setRegenerateSuccess(data.message || "New referral code created successfully!");
      if (data.newCode) {
        setStats((prev) => ({
          ...prev,
          referralCode: data.newCode,
          shareableUrl: data.shareableUrl || prev.shareableUrl,
          successfulPaidReferrals: 0,
          remainingCapacity: data.maxCapacity || 50,
          isExhausted: false,
          canRegenerate: false,
        }));
      }
      // Reload page to refresh all server-side referral and history metrics
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch {
      setRegenerateError("A network error occurred while generating your new code. Please try again.");
      setIsRegenerating(false);
    }
  };

  const formatMinorUnits = (subunits: number, currency: string) => {
    const symbol = currency === "INR" ? "₹" : currency === "EUR" ? "€" : "$";
    const amount = (subunits / 100).toFixed(2);
    return `${symbol}${amount} ${currency}`;
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-terracotta)] mb-1 block">
          Partner &amp; Referrals
        </span>
        <h1 className="font-heading text-3xl font-extrabold text-[var(--color-forest-green)] tracking-tight">
          Your Referral Rewards
        </h1>
        <p className="mt-1 text-sm text-[var(--color-charcoal)]/80 max-w-2xl">
          Welcome{userName ? `, ${userName}` : ""}. Share your unique code or link with friends, students, and colleagues. When they purchase a lifetime license, they get <strong>10% off</strong> and you earn <strong>10% referral commission</strong>.
        </p>
      </div>

      {/* Quota Exhaustion & Code Regeneration Banner */}
      {stats.isExhausted && (
        <div className="rounded-3xl border border-amber-300 bg-amber-50/80 p-6 sm:p-8 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-amber-200/80 text-amber-900 text-xs font-bold uppercase tracking-wider">
                <span>⚠️ Quota Reached (50 / 50)</span>
              </div>
              <h2 className="font-heading text-xl font-bold text-amber-950">
                Your referral code {stats.referralCode} has reached its limit
              </h2>
              <p className="text-xs sm:text-sm text-amber-900/90 leading-relaxed font-sans max-w-xl">
                This referral code has completed all 50 successful redemptions and is now exhausted. It can no longer be used for new discounts or purchases. All your historical commissions and earnings remain safe and intact.
              </p>
            </div>

            {stats.canRegenerate && (
              <div className="shrink-0">
                <button
                  type="button"
                  onClick={handleRegenerateCode}
                  disabled={isRegenerating}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[var(--color-forest-green)] text-white text-sm font-semibold hover:bg-[#122B24] active:bg-[#0c1f1a] transition-all disabled:opacity-60 shadow-sm"
                >
                  {isRegenerating ? (
                    <>
                      <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Generating Code...</span>
                    </>
                  ) : (
                    <span>Create New Referral Code →</span>
                  )}
                </button>
              </div>
            )}
          </div>

          {regenerateError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              {regenerateError}
            </div>
          )}

          {regenerateSuccess && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 font-semibold">
              ✓ {regenerateSuccess} Reloading...
            </div>
          )}
        </div>
      )}

      {/* Share Box Card */}
      <div className="bg-white rounded-3xl border border-[var(--color-soft-sage)] p-6 sm:p-8 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          {/* Referral Code Showcase */}
          <div className="rounded-2xl border border-[var(--color-soft-sage)] bg-[var(--color-warm-ivory)]/50 p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-charcoal)]/70">
                Your Referral Code
              </span>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  stats.isExhausted
                    ? "bg-amber-100 text-amber-900 border border-amber-200"
                    : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                }`}
              >
                {stats.isExhausted ? "Exhausted (50/50)" : "Active Code"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-2xl font-black text-[var(--color-forest-green)] tracking-wider">
                {stats.referralCode}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="px-3 py-1.5 rounded-lg bg-[var(--color-forest-green)] text-white text-xs font-semibold hover:bg-[#122B24] transition-colors"
              >
                {copiedCode ? "✓ Copied!" : "Copy Code"}
              </button>
            </div>
          </div>

          {/* Shareable Link Box */}
          <div className="rounded-2xl border border-[var(--color-soft-sage)] bg-[var(--color-warm-ivory)]/50 p-5 space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-charcoal)]/70">
              Personal Referral Link
            </span>
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-xs text-[var(--color-charcoal)] truncate max-w-[200px] sm:max-w-[260px]">
                {stats.shareableUrl}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-2.5 py-1.5 rounded-lg border border-[var(--color-soft-sage)] bg-white text-xs font-semibold text-[var(--color-forest-green)] hover:bg-[var(--color-soft-sage)]/40 transition-colors"
                >
                  {copiedLink ? "✓ Copied" : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  className="px-2.5 py-1.5 rounded-lg bg-[var(--color-forest-green)] text-white text-xs font-semibold hover:bg-[#122B24] transition-colors flex items-center gap-1"
                >
                  <span>Share</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Ready to Share Social Snippet */}
        <div className="rounded-2xl border border-[var(--color-soft-sage)]/60 bg-[var(--color-warm-ivory)]/30 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-forest-green)]">
              Ready-to-Share Message (Social, Telegram, WhatsApp)
            </span>
            {shareSuccess && (
              <span className="text-xs text-emerald-700 font-semibold">
                ✓ Shared successfully
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--color-charcoal)]/80 italic font-sans leading-relaxed">
            &ldquo;{readyToShareMessage}&rdquo;
          </p>
        </div>
      </div>

      {/* Progress & Conversion Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-[var(--color-soft-sage)] p-6 shadow-xs space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-charcoal)]/60">
            Registered Referrals
          </span>
          <div className="font-heading text-3xl font-bold text-[var(--color-forest-green)]">
            {stats.registeredCount}
          </div>
          <p className="text-[11px] text-[var(--color-charcoal)]/60">
            Users who created an account with your referral link or code.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-[var(--color-soft-sage)] p-6 shadow-xs space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-charcoal)]/60">
            Successful Paid Referrals
          </span>
          <div className="font-heading text-3xl font-bold text-[var(--color-forest-green)]">
            {stats.successfulPaidReferrals}{" "}
            <span className="text-xs text-[var(--color-charcoal)]/50 font-normal">
              / {stats.maxCapacity} cap
            </span>
          </div>
          <p className="text-[11px] text-[var(--color-charcoal)]/60">
            Paid conversions that earned you 10% commission.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-[var(--color-soft-sage)] p-6 shadow-xs space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-charcoal)]/60">
            Remaining Capacity
          </span>
          <div className="font-heading text-3xl font-bold text-[var(--color-forest-green)]">
            {stats.remainingCapacity}
          </div>
          <p className="text-[11px] text-[var(--color-charcoal)]/60">
            {stats.isExhausted
              ? "Code exhausted. Create a new referral code above to continue."
              : "Slots remaining on this code before reaching 50 redemptions."}
          </p>
        </div>
      </div>

      {/* Historical Referral Codes Table */}
      {stats.historicalCodes && stats.historicalCodes.length > 0 && (
        <div className="bg-white rounded-3xl border border-[var(--color-soft-sage)] p-6 sm:p-8 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading text-lg font-bold text-[var(--color-forest-green)]">
                Referral Code History
              </h2>
              <p className="text-xs text-[var(--color-charcoal)]/70">
                All referral codes generated for your account and their individual redemption capacity.
              </p>
            </div>
            <span className="text-xs font-medium text-[var(--color-charcoal)]/60">
              {stats.historicalCodes.length} code{stats.historicalCodes.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--color-soft-sage)] text-[var(--color-charcoal)]/60 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Referral Code</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Redemptions</th>
                  <th className="py-2.5 px-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-soft-sage)]/60">
                {stats.historicalCodes.map((item) => (
                  <tr key={item.code} className="hover:bg-[var(--color-warm-ivory)]/30">
                    <td className="py-3 px-3 font-mono font-bold text-[var(--color-forest-green)]">
                      {item.code}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          item.status === "exhausted"
                            ? "bg-amber-100 text-amber-900"
                            : item.status === "active"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-neutral-100 text-neutral-800"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-[var(--color-charcoal)]">
                      {item.successfulPaidReferrals} / {item.maxCapacity}
                    </td>
                    <td className="py-3 px-3 text-[var(--color-charcoal)]/60">
                      {new Date(item.createdAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Earnings Breakdown by Currency */}
      <div className="bg-white rounded-3xl border border-[var(--color-soft-sage)] p-6 sm:p-8 shadow-sm space-y-6">
        <div>
          <h2 className="font-heading text-xl font-bold text-[var(--color-forest-green)]">
            Commissions &amp; Earnings by Currency
          </h2>
          <p className="text-xs text-[var(--color-charcoal)]/70 mt-1">
            Commissions are earned in the purchase currency (INR, USD, or EUR) at 10% of the actual paid amount after discounts. Unpaid commissions become eligible for payout after the 72-hour refund guarantee window.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(["INR", "USD", "EUR"] as const).map((curr) => {
            const data = stats.earningsByCurrency[curr];
            return (
              <div
                key={curr}
                className="rounded-2xl border border-[var(--color-soft-sage)] bg-[var(--color-warm-ivory)]/40 p-5 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-[var(--color-soft-sage)]/60 pb-2">
                  <span className="font-bold text-sm text-[var(--color-forest-green)]">
                    {curr} Earnings
                  </span>
                  <span className="text-xs font-semibold text-[var(--color-charcoal)]/60">
                    Total: {formatMinorUnits(data.totalEarnedSubunits, curr)}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--color-charcoal)]/70">
                      Pending (72h Hold):
                    </span>
                    <span className="font-mono font-medium text-[var(--color-charcoal)]">
                      {formatMinorUnits(data.pendingSubunits, curr)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-[var(--color-charcoal)]/70">
                      Eligible / Approved:
                    </span>
                    <span className="font-mono font-medium text-emerald-700">
                      {formatMinorUnits(data.eligibleSubunits, curr)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-[var(--color-charcoal)]/70">
                      Paid to Date:
                    </span>
                    <span className="font-mono font-medium text-[var(--color-forest-green)]">
                      {formatMinorUnits(data.paidSubunits, curr)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Program Terms & Invariants Notice */}
      <div className="rounded-2xl border border-[var(--color-soft-sage)] bg-white p-5 text-xs text-[var(--color-charcoal)]/80 space-y-2">
        <div className="font-bold uppercase tracking-wider text-[var(--color-forest-green)]">
          Referral Program Guidelines
        </div>
        <ul className="list-disc list-inside space-y-1 leading-relaxed">
          <li>Referred users receive a 10% discount on their lifetime license purchase.</li>
          <li>You earn a 10% commission on the actual purchase amount paid after all discounts.</li>
          <li>Registering an account does not count as a successful referral; only a completed paid purchase consumes a referral slot.</li>
          <li>Each referral code has an allowance of 50 successful paid redemptions. When your current code reaches 50 redemptions, you can create a new code with its own 50-redemption allowance.</li>
          <li>Commissions are paid in the original purchase currency after an exact 72-hour guarantee hold period.</li>
          <li>Self-referrals (referring your own alternate accounts) are strictly prohibited.</li>
        </ul>
      </div>
    </div>
  );
}
