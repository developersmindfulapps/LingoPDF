"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import type { CustomerDeviceOverview } from "@/lib/licensing/service";

interface DevicesClientProps {
  user: {
    id: string;
    email: string;
    name?: string;
  };
  initialOverview: CustomerDeviceOverview;
}

export function DevicesClient({ initialOverview }: DevicesClientProps) {
  const [overview] = useState<CustomerDeviceOverview>(initialOverview);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Countdown timer for generated activation code
  useEffect(() => {
    if (!expiresAt) {
      return;
    }

    const updateTimer = () => {
      const remaining = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      setTimeLeftSeconds(remaining);
      if (remaining <= 0) {
        setGeneratedCode(null);
        setExpiresAt(null);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const handleGenerateCode = async () => {
    setIsGenerating(true);
    setError(null);
    setCopied(false);

    try {
      const res = await fetch("/api/licensing/activation-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate activation code.");
      }

      setGeneratedCode(data.activationCode);
      if (data.expiresAt) {
        setExpiresAt(new Date(data.expiresAt));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyCode = async () => {
    if (!generatedCode) return;
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Page Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E8E4D9] text-[#193C32] text-xs font-semibold uppercase tracking-wider mb-3">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Licence & Device Management
        </div>
        <h1 className="font-heading text-3xl sm:text-4xl font-bold text-[#193C32]">
          Extension Device Activation
        </h1>
        <p className="mt-2 text-base text-[#242923]/80">
          Manage your active device and generate secure single-use codes to activate the LingoPDF Chrome extension.
        </p>
      </div>

      {/* Account & Licence Status Banner */}
      <div className="bg-white rounded-2xl border border-[#E8E4D9] p-6 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <div className="text-xs font-semibold text-[#242923]/60 uppercase tracking-wider">Product Edition</div>
            <div className="mt-1 font-heading text-lg font-bold text-[#193C32]">German → English</div>
            <div className="text-xs text-[#242923]/70 mt-0.5">Vocabulary Reader Edition</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-[#242923]/60 uppercase tracking-wider">Licence Status</div>
            <div className="mt-1 flex items-center gap-2">
              {overview.hasEntitlement && overview.entitlementStatus === "active" ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
                  <span className="font-heading text-lg font-bold text-emerald-800">Active</span>
                </>
              ) : (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
                  <span className="font-heading text-lg font-bold text-amber-800">No Active Licence</span>
                </>
              )}
            </div>
            <div className="text-xs text-[#242923]/70 mt-0.5">
              {overview.source === "complimentary_promo_code"
                ? "Complimentary Promotional Licence"
                : overview.source === "purchase"
                ? "Direct Customer Purchase"
                : "Licence Required"}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-[#242923]/60 uppercase tracking-wider">Device Policy</div>
            <div className="mt-1 font-heading text-lg font-bold text-[#193C32]">
              {overview.isDeviceBound ? "1 / 1 Device Active" : "0 / 1 Device Active"}
            </div>
            <div className="text-xs text-[#242923]/70 mt-0.5">1 Active Device per Licence</div>
          </div>
        </div>
      </div>

      {/* Conditional Content */}
      {!overview.hasEntitlement || overview.entitlementStatus !== "active" ? (
        /* No Active Licence State */
        <div className="bg-[#F8F5EE] border-2 border-dashed border-[#E8E4D9] rounded-2xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="font-heading text-xl font-bold text-[#193C32]">
            Active German Edition Licence Required
          </h3>
          <p className="text-sm text-[#242923]/80 max-w-lg mx-auto">
            You do not currently hold an active German → English licence. LingoPDF is a paid product for normal reading. If you received a complimentary promotional gift code, you can redeem it below.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link
              href="/account/redeem"
              className="px-5 py-2.5 bg-[#193C32] text-white rounded-xl font-medium text-sm hover:bg-[#193C32]/90 transition"
            >
              Redeem Promotional Code
            </Link>
            <Link
              href="/products/german-english"
              className="px-5 py-2.5 border border-[#193C32] text-[#193C32] rounded-xl font-medium text-sm hover:bg-white transition"
            >
              View German Edition
            </Link>
          </div>
        </div>
      ) : overview.isDeviceBound && overview.deviceBinding ? (
        /* Device Is Bound State */
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-[#E8E4D9] p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-[#E8E4D9] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-heading font-bold text-lg text-[#193C32]">
                    {overview.deviceBinding.deviceLabel}
                  </h3>
                  <p className="text-xs text-[#242923]/60">
                    Extension Version {overview.deviceBinding.clientVersion}
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                Active Device
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="p-4 rounded-xl bg-[#F8F5EE] border border-[#E8E4D9]">
                <div className="text-xs text-[#242923]/60 font-medium">Activated On</div>
                <div className="mt-1 font-semibold text-[#193C32]">
                  {new Date(overview.deviceBinding.boundAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-[#F8F5EE] border border-[#E8E4D9]">
                <div className="text-xs text-[#242923]/60 font-medium">Last Online Validation</div>
                <div className="mt-1 font-semibold text-[#193C32]">
                  {new Date(overview.deviceBinding.lastValidatedAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Device Transfer & Replacement Notice */}
          <div className="bg-[#F8F5EE] rounded-2xl border border-[#E8E4D9] p-6 space-y-3">
            <div className="flex items-center gap-2 text-[#193C32] font-heading font-bold text-base">
              <svg className="w-5 h-5 text-[#D87854]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Need to move your licence to another computer?
            </div>
            <p className="text-sm text-[#242923]/80 leading-relaxed">
              In accordance with our one-device-per-licence policy, an active licence can only be bound to one Chrome extension at a time. If you have purchased a new computer, reinstalled Chrome, or need to transfer your licence, our support team can perform a verified device transfer for your account.
            </p>
            <div className="pt-2">
              <Link
                href="/support"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#E8E4D9] hover:border-[#193C32] text-[#193C32] font-semibold text-sm rounded-xl transition shadow-sm"
              >
                Contact Support for Device Transfer →
              </Link>
            </div>
          </div>
        </div>
      ) : (
        /* No Device Bound: Ready to Generate Activation Code */
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-[#E8E4D9] p-8 shadow-sm space-y-6">
            <div>
              <h2 className="font-heading text-xl font-bold text-[#193C32]">
                Activate LingoPDF on Your Device
              </h2>
              <p className="text-sm text-[#242923]/80 mt-1">
                Generate a secure, single-use activation code. Enter it in your LingoPDF Chrome extension to complete activation.
              </p>
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-3">
                <svg className="w-5 h-5 text-red-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <div className="font-semibold">Activation Code Error</div>
                  <div className="mt-0.5 text-xs text-red-700">{error}</div>
                </div>
              </div>
            )}

            {!generatedCode ? (
              <div className="pt-2">
                <button
                  onClick={handleGenerateCode}
                  disabled={isGenerating}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#193C32] hover:bg-[#193C32]/90 text-white font-medium text-sm rounded-xl transition shadow-sm disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Generating Secure Code...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      Generate Activation Code
                    </>
                  )}
                </button>
                <p className="text-xs text-[#242923]/60 mt-3">
                  Each code is single-use, valid for 10 minutes, and bound to your German edition licence.
                </p>
              </div>
            ) : (
              /* One-Time Code Display */
              <div className="space-y-6 border-t border-[#E8E4D9] pt-6">
                <div className="bg-[#F8F5EE] border-2 border-[#193C32]/20 rounded-2xl p-6 text-center space-y-3">
                  <div className="flex items-center justify-center gap-2 text-xs font-semibold text-[#D87854] uppercase tracking-wider">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Valid for {formatCountdown(timeLeftSeconds)}
                  </div>
                  <div className="font-mono text-2xl sm:text-3xl font-extrabold tracking-widest text-[#193C32] select-all">
                    {generatedCode}
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={handleCopyCode}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#E8E4D9] hover:border-[#193C32] text-[#193C32] font-semibold text-xs rounded-xl transition shadow-sm"
                    >
                      {copied ? (
                        <>
                          <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Copied to Clipboard!
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy Code
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Instructions */}
                <div className="space-y-3 bg-white p-4 rounded-xl border border-[#E8E4D9]">
                  <h4 className="font-heading font-bold text-sm text-[#193C32]">Next Steps:</h4>
                  <ol className="list-decimal list-inside space-y-2 text-xs text-[#242923]/80">
                    <li>Open the <strong>LingoPDF</strong> extension in Google Chrome.</li>
                    <li>Paste or type this activation code into the extension prompt.</li>
                    <li>Click <strong>Activate Extension</strong>. Your browser will generate a local secure key and bind your device.</li>
                  </ol>
                </div>

                <div className="text-center">
                  <button
                    onClick={handleGenerateCode}
                    disabled={isGenerating}
                    className="text-xs text-[#D87854] hover:underline font-semibold"
                  >
                    Need a new code? Click here to invalidate this code and generate a new one.
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
