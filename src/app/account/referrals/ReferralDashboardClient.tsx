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
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  const readyToShareMessage = `Read German PDFs effortlessly with instant inline vocabulary lookups! Use my code ${initialStats.referralCode} to get 10% off your LingoPDF lifetime license: ${initialStats.shareableUrl}`;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(initialStats.referralCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(initialStats.shareableUrl);
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
          text: `Read German PDFs without losing your flow. Use my code ${initialStats.referralCode} to save 10% on your license!`,
          url: initialStats.shareableUrl,
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

      {/* Share Box Card */}
      <div className="bg-white rounded-3xl border border-[var(--color-soft-sage)] p-6 sm:p-8 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          {/* Referral Code Showcase */}
          <div className="rounded-2xl border border-[var(--color-soft-sage)] bg-[var(--color-warm-ivory)]/50 p-5 space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-charcoal)]/70">
              Your Referral Code
            </span>
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-2xl font-black text-[var(--color-forest-green)] tracking-wider">
                {initialStats.referralCode}
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
                {initialStats.shareableUrl}
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
            {initialStats.registeredCount}
          </div>
          <p className="text-[11px] text-[var(--color-charcoal)]/60">
            Users who created an account with your link or code.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-[var(--color-soft-sage)] p-6 shadow-xs space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-charcoal)]/60">
            Successful Paid Referrals
          </span>
          <div className="font-heading text-3xl font-bold text-[var(--color-forest-green)]">
            {initialStats.successfulPaidReferrals}{" "}
            <span className="text-xs text-[var(--color-charcoal)]/50 font-normal">
              / {initialStats.maxCapacity} cap
            </span>
          </div>
          <p className="text-[11px] text-[var(--color-charcoal)]/60">
            Paid conversions that earned you commission.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-[var(--color-soft-sage)] p-6 shadow-xs space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-charcoal)]/60">
            Remaining Capacity
          </span>
          <div className="font-heading text-3xl font-bold text-[var(--color-forest-green)]">
            {initialStats.remainingCapacity}
          </div>
          <p className="text-[11px] text-[var(--color-charcoal)]/60">
            Slots remaining before reaching the 50 lifetime conversion limit.
          </p>
        </div>
      </div>

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
            const data = initialStats.earningsByCurrency[curr];
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
          <li>Each user has a maximum capacity of 50 successful lifetime referrals.</li>
          <li>Commissions are paid in the original purchase currency after an exact 72-hour guarantee hold period.</li>
          <li>Self-referrals (referring your own alternate accounts) are strictly prohibited.</li>
        </ul>
      </div>
    </div>
  );
}
