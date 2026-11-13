"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ListPromoCodesResult,
  PromoCodeItemSummary,
  PromoCodeStats,
} from "@/lib/promoCodes/service";

interface PromoCodesClientProps {
  initialData: ListPromoCodesResult;
  stats: PromoCodeStats;
}

export function PromoCodesClient({ initialData, stats: initialStats }: PromoCodesClientProps) {
  const [data, setData] = useState<ListPromoCodesResult>(initialData);
  const [stats, setStats] = useState<PromoCodeStats>(initialStats);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  // Generate Modal state
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [labelInput, setLabelInput] = useState("");
  const [expiresAtInput, setExpiresAtInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Newly generated code display modal
  const [newlyGeneratedCode, setNewlyGeneratedCode] = useState<{
    code: string;
    label: string | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Disable modal state
  const [disablingItem, setDisablingItem] = useState<PromoCodeItemSummary | null>(null);
  const [disableReason, setDisableReason] = useState("");
  const [isDisabling, setIsDisabling] = useState(false);
  const [disableError, setDisableError] = useState<string | null>(null);

  // Details modal state
  const [viewingItem, setViewingItem] = useState<PromoCodeItemSummary | null>(null);

  const fetchCodes = async (newStatus = statusFilter, newQuery = searchQuery) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (newStatus && newStatus !== "all") params.set("status", newStatus);
      if (newQuery) params.set("q", newQuery);
      const res = await fetch(`/api/admin/promo-codes?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setData({
          items: json.items,
          total: json.total,
          page: json.page,
          limit: json.limit,
          totalPages: json.totalPages,
        });
        if (json.stats) {
          setStats(json.stats);
        }
      }
    } catch (err) {
      console.error("Failed to fetch promo codes", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (status: string) => {
    setStatusFilter(status);
    fetchCodes(status, searchQuery);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCodes(statusFilter, searchQuery);
  };

  const handleGenerateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setGenerateError(null);

    try {
      const res = await fetch("/api/admin/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          label: labelInput.trim() || null,
          expiresAt: expiresAtInput ? new Date(expiresAtInput).toISOString() : null,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setGenerateError(json.error || "Failed to generate promo code.");
        return;
      }

      setShowGenerateModal(false);
      setLabelInput("");
      setExpiresAtInput("");
      setNewlyGeneratedCode({
        code: json.fullCode,
        label: json.promoCode.label,
      });
      setCopied(false);
      fetchCodes();
    } catch {
      setGenerateError("Network error. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDisableSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disablingItem) return;

    setIsDisabling(true);
    setDisableError(null);

    try {
      const res = await fetch("/api/admin/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "disable",
          id: disablingItem.id,
          reason: disableReason.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setDisableError(json.error || "Failed to disable promo code.");
        return;
      }

      setDisablingItem(null);
      setDisableReason("");
      fetchCodes();
    } catch {
      setDisableError("Network error. Please try again.");
    } finally {
      setIsDisabling(false);
    }
  };

  const handleCopyCode = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return "—";
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#193C32]">
            100% Single-Use Complimentary Licence Codes
          </h1>
          <p className="text-xs sm:text-sm text-[#242923]/70 mt-1">
            Generate and manage individual, cryptographically secure 100% discount codes for product
            reviewers, instructors, and promotional partners.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setGenerateError(null);
            setShowGenerateModal(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-heading text-xs font-semibold text-white bg-[#193C32] hover:bg-[#122B24] active:scale-[0.99] transition-all shadow-xs cursor-pointer"
        >
          <span>+ Generate Promo Code</span>
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="rounded-xl border border-[#E8E4D9] bg-white p-4 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#242923]/60">
            Total Codes
          </div>
          <div className="font-heading text-2xl font-bold text-[#193C32] mt-1">{stats.total}</div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">
            Active &amp; Available
          </div>
          <div className="font-heading text-2xl font-bold text-emerald-900 mt-1">{stats.active}</div>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-800">
            Redeemed
          </div>
          <div className="font-heading text-2xl font-bold text-blue-900 mt-1">{stats.redeemed}</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">
            Expired
          </div>
          <div className="font-heading text-2xl font-bold text-amber-900 mt-1">{stats.expired}</div>
        </div>
        <div className="rounded-xl border border-[#E8E4D9] bg-stone-50 p-4 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#242923]/60">
            Disabled
          </div>
          <div className="font-heading text-2xl font-bold text-[#242923]/80 mt-1">{stats.disabled}</div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="rounded-xl border border-[#E8E4D9] bg-white p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: "all", label: "All" },
            { id: "active", label: `Active (${stats.active})` },
            { id: "redeemed", label: `Redeemed (${stats.redeemed})` },
            { id: "expired", label: `Expired (${stats.expired})` },
            { id: "disabled", label: `Disabled (${stats.disabled})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleFilterChange(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === tab.id
                  ? "bg-[#193C32] text-white"
                  : "text-[#242923]/70 hover:bg-[#E8E4D9]/40"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search label, masked code, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-[#E8E4D9] text-xs bg-white text-[#242923] placeholder-[#242923]/40 focus:outline-none focus:ring-2 focus:ring-[#193C32]"
          />
          <button
            type="submit"
            className="px-3 py-1.5 rounded-lg bg-[#E8E4D9]/60 hover:bg-[#E8E4D9] text-xs font-semibold text-[#193C32] transition-colors cursor-pointer"
          >
            Search
          </button>
        </form>
      </div>

      {/* Codes Table */}
      <div className="rounded-xl border border-[#E8E4D9] bg-white shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-[#242923]/60">Loading promotional codes...</div>
        ) : data.items.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <h3 className="font-heading text-base font-bold text-[#193C32]">No promotional codes found</h3>
            <p className="text-xs text-[#242923]/60 max-w-sm mx-auto">
              No single-use complimentary codes match the selected criteria. Generate one using the button above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E8E4D9] bg-[#F8F5EE]/60 text-[#242923]/70 uppercase font-semibold text-[10px] tracking-wider">
                  <th className="py-3 px-4">Identifier / Code</th>
                  <th className="py-3 px-4">Label / Purpose</th>
                  <th className="py-3 px-4">Edition &amp; Discount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4">Expires</th>
                  <th className="py-3 px-4">Redeemed By</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E4D9]/60">
                {data.items.map((item) => (
                  <tr key={item.id} className="hover:bg-[#F8F5EE]/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-[#193C32]">
                      <div>{item.codeMasked}</div>
                      <div className="text-[10px] text-[#242923]/40 mt-0.5">#{item.id.slice(0, 8)}…</div>
                    </td>
                    <td className="py-3 px-4 text-[#242923]/90 font-medium">
                      {item.label || <span className="text-[#242923]/40 italic">Unlabeled</span>}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-[#193C32]">German → English</span>
                      <div className="text-[10px] text-emerald-800 font-bold">100% Complimentary</div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          item.status === "active"
                            ? "bg-emerald-100 text-emerald-900 border border-emerald-200"
                            : item.status === "redeemed"
                            ? "bg-blue-100 text-blue-900 border border-blue-200"
                            : item.status === "disabled"
                            ? "bg-stone-100 text-stone-800 border border-stone-200"
                            : "bg-amber-100 text-amber-900 border border-amber-200"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#242923]/70">
                      <div>{formatDate(item.createdAt)}</div>
                      <div className="text-[10px] text-[#242923]/40">{item.createdByEmail}</div>
                    </td>
                    <td className="py-3 px-4 text-[#242923]/70">
                      {item.expiresAt ? formatDate(item.expiresAt) : <span className="text-[#242923]/40">Never</span>}
                    </td>
                    <td className="py-3 px-4">
                      {item.redeemedByEmail ? (
                        <div>
                          <span className="font-medium text-[#193C32]">{item.redeemedByEmail}</span>
                          <div className="text-[10px] text-[#242923]/50">{formatDate(item.redeemedAt)}</div>
                        </div>
                      ) : (
                        <span className="text-[#242923]/40 italic">Unredeemed</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <button
                          type="button"
                          onClick={() => setViewingItem(item)}
                          className="px-2 py-1 rounded border border-[#E8E4D9] text-[11px] font-semibold text-[#193C32] hover:bg-[#E8E4D9]/40 transition-colors cursor-pointer"
                        >
                          Details
                        </button>
                        {item.status === "active" && (
                          <button
                            type="button"
                            onClick={() => {
                              setDisablingItem(item);
                              setDisableReason("");
                              setDisableError(null);
                            }}
                            className="px-2 py-1 rounded border border-rose-200 bg-rose-50/50 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                          >
                            Disable
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: Generate Promo Code */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-[#E8E4D9] p-6 shadow-xl space-y-4">
            <div>
              <h3 className="font-heading text-lg font-bold text-[#193C32]">
                Generate 100% Complimentary Code
              </h3>
              <p className="text-xs text-[#242923]/70 mt-1 leading-relaxed">
                Creates a single-use, 100% discount promotional code granting one user a full German → English
                edition licence.
              </p>
            </div>

            {generateError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                {generateError}
              </div>
            )}

            <form onSubmit={handleGenerateSubmit} className="space-y-4">
              {/* Product and Discount Invariants Display */}
              <div className="p-3 rounded-xl bg-[#F8F5EE] border border-[#E8E4D9] space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#242923]/60">Product Edition:</span>
                  <span className="font-semibold text-[#193C32]">German → English (Fixed)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#242923]/60">Discount:</span>
                  <span className="font-bold text-emerald-800">100% Complimentary (Fixed)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#242923]/60">Redemption Limit:</span>
                  <span className="font-semibold text-[#193C32]">Exactly 1 single use</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#242923] mb-1">
                  Recipient or Campaign Label <span className="text-[#242923]/50 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  maxLength={100}
                  placeholder="e.g. Prof. Schmidt - Goethe University"
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#E8E4D9] text-xs bg-white text-[#242923] focus:outline-none focus:ring-2 focus:ring-[#193C32]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#242923] mb-1">
                  Expiration Date <span className="text-[#242923]/50 font-normal">(Optional)</span>
                </label>
                <input
                  type="datetime-local"
                  value={expiresAtInput}
                  onChange={(e) => setExpiresAtInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#E8E4D9] text-xs bg-white text-[#242923] focus:outline-none focus:ring-2 focus:ring-[#193C32]"
                />
                <p className="text-[11px] text-[#242923]/50 mt-1">
                  Leave empty if this code should never expire.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => setShowGenerateModal(false)}
                  className="px-4 py-2 rounded-lg border border-[#E8E4D9] text-xs font-semibold text-[#242923] hover:bg-[#E8E4D9]/40 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGenerating}
                  className="px-4 py-2 rounded-lg font-heading text-xs font-semibold text-white bg-[#193C32] hover:bg-[#122B24] disabled:opacity-60 cursor-pointer"
                >
                  {isGenerating ? "Generating..." : "Generate Code"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Newly Generated Code (One-Time Reveal) */}
      {newlyGeneratedCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-[#E8E4D9] p-6 shadow-xl space-y-4">
            <div className="text-center space-y-1">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 mb-2">
                ✓
              </div>
              <h3 className="font-heading text-lg font-bold text-[#193C32]">
                Promotional Code Generated
              </h3>
              {newlyGeneratedCode.label && (
                <p className="text-xs text-[#242923]/70">{newlyGeneratedCode.label}</p>
              )}
            </div>

            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800 block">
                Single-Use Promotional Code
              </span>
              <div className="font-mono text-xl font-bold tracking-wider text-emerald-950 select-all">
                {newlyGeneratedCode.code}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
              <strong>Security Notice:</strong> Copy and share this code with the recipient now. For security,
              the full code will <strong>not be displayed again</strong> and cannot be recovered from the database.
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
              <button
                type="button"
                onClick={() => handleCopyCode(newlyGeneratedCode.code)}
                className="w-full sm:flex-1 py-2.5 rounded-xl font-heading text-xs font-semibold text-white bg-[#193C32] hover:bg-[#122B24] transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>{copied ? "Copied to Clipboard!" : "Copy Code"}</span>
              </button>
              <button
                type="button"
                onClick={() => setNewlyGeneratedCode(null)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-[#E8E4D9] text-xs font-semibold text-[#242923] hover:bg-[#E8E4D9]/40 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Disable Promo Code */}
      {disablingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-[#E8E4D9] p-6 shadow-xl space-y-4">
            <div>
              <h3 className="font-heading text-lg font-bold text-rose-900">
                Disable Promotional Code
              </h3>
              <p className="text-xs text-[#242923]/70 mt-1 leading-relaxed">
                Are you sure you want to disable code <strong>{disablingItem.codeMasked}</strong>?
                Once disabled, this code can no longer be redeemed.
              </p>
            </div>

            {disableError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                {disableError}
              </div>
            )}

            <form onSubmit={handleDisableSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#242923] mb-1">
                  Reason for Disabling <span className="text-[#242923]/50 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Campaign ended early or recipient changed"
                  value={disableReason}
                  onChange={(e) => setDisableReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#E8E4D9] text-xs bg-white text-[#242923] focus:outline-none focus:ring-2 focus:ring-[#193C32]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isDisabling}
                  onClick={() => setDisablingItem(null)}
                  className="px-4 py-2 rounded-lg border border-[#E8E4D9] text-xs font-semibold text-[#242923] hover:bg-[#E8E4D9]/40 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDisabling}
                  className="px-4 py-2 rounded-lg font-heading text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 disabled:opacity-60 cursor-pointer"
                >
                  {isDisabling ? "Disabling..." : "Confirm Disable"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Details Modal */}
      {viewingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-[#E8E4D9] p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-lg font-bold text-[#193C32]">
                Promotional Code Details
              </h3>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  viewingItem.status === "active"
                    ? "bg-emerald-100 text-emerald-900"
                    : viewingItem.status === "redeemed"
                    ? "bg-blue-100 text-blue-900"
                    : "bg-stone-100 text-stone-800"
                }`}
              >
                {viewingItem.status}
              </span>
            </div>

            <div className="space-y-3 text-xs divide-y divide-[#E8E4D9]/60">
              <div className="pt-2 flex justify-between">
                <span className="text-[#242923]/60">Masked Code:</span>
                <span className="font-mono font-bold text-[#193C32]">{viewingItem.codeMasked}</span>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-[#242923]/60">Internal Label:</span>
                <span className="font-medium">{viewingItem.label || "None"}</span>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-[#242923]/60">Product Edition:</span>
                <span className="font-semibold text-[#193C32]">German → English</span>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-[#242923]/60">Discount:</span>
                <span className="font-bold text-emerald-800">100% Complimentary</span>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-[#242923]/60">Created By:</span>
                <span>{viewingItem.createdByEmail}</span>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-[#242923]/60">Created At:</span>
                <span>{formatDate(viewingItem.createdAt)}</span>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-[#242923]/60">Expires At:</span>
                <span>{viewingItem.expiresAt ? formatDate(viewingItem.expiresAt) : "Never"}</span>
              </div>

              {viewingItem.redeemedByEmail && (
                <>
                  <div className="pt-2 flex justify-between">
                    <span className="text-[#242923]/60">Redeemed By:</span>
                    <span className="font-semibold text-[#193C32]">{viewingItem.redeemedByEmail}</span>
                  </div>
                  <div className="pt-2 flex justify-between">
                    <span className="text-[#242923]/60">Redeemed At:</span>
                    <span>{formatDate(viewingItem.redeemedAt)}</span>
                  </div>
                  {viewingItem.entitlementId && (
                    <div className="pt-2 flex justify-between">
                      <span className="text-[#242923]/60">Granted Entitlement:</span>
                      <Link
                        href={`/admin/entitlements`}
                        className="font-mono text-[#193C32] underline hover:text-[#D87854]"
                      >
                        #{viewingItem.entitlementId.slice(0, 8)}…
                      </Link>
                    </div>
                  )}
                </>
              )}

              {viewingItem.disabledAt && (
                <>
                  <div className="pt-2 flex justify-between">
                    <span className="text-[#242923]/60">Disabled At:</span>
                    <span>{formatDate(viewingItem.disabledAt)}</span>
                  </div>
                  <div className="pt-2 flex justify-between">
                    <span className="text-[#242923]/60">Disable Reason:</span>
                    <span>{viewingItem.disableReason || "None provided"}</span>
                  </div>
                </>
              )}
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingItem(null)}
                className="px-4 py-2 rounded-lg border border-[#E8E4D9] text-xs font-semibold text-[#242923] hover:bg-[#E8E4D9]/40 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
