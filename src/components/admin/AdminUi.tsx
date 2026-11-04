"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function AdminStatusBadge({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  const normalized = (status || "").toLowerCase();
  let classes =
    "bg-[#E8E4D9] text-[#242923] border-[#d6d0c0]";

  if (
    [
      "active",
      "captured",
      "eligible",
      "approved",
      "paid",
      "completed",
      "won",
      "withdrawn",
      "success",
      "operational",
      "configured",
      "verified",
      "promo",
    ].includes(normalized)
  ) {
    classes =
      "bg-emerald-50 text-emerald-900 border-emerald-200";
  } else if (
    [
      "pending",
      "pending_review",
      "approved_pending_gateway",
      "under_review",
      "draft",
      "processing",
      "scheduled",
      "partially_refunded",
      "held",
      "open",
      "configured (mock mode)",
      "configured (on-demand / ttl)",
    ].includes(normalized)
  ) {
    classes =
      "bg-amber-50 text-amber-900 border-amber-200";
  } else if (
    [
      "suspended",
      "revoked",
      "disputed",
      "chargeback_lost",
      "failed",
      "rejected",
      "lost",
      "cancelled",
      "failure",
      "degraded",
    ].includes(normalized)
  ) {
    classes =
      "bg-red-50 text-red-900 border-red-200";
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${classes}`}
    >
      {label || status.replace(/_/g, " ")}
    </span>
  );
}

export function AdminCopyId({
  value,
  href,
  prefixChars = 8,
}: {
  value: string | null | undefined;
  href?: string;
  prefixChars?: number;
}) {
  const [copied, setCopied] = useState(false);

  if (!value) {
    return <span className="text-xs text-[#242923]/50">—</span>;
  }

  const display =
    value.length > prefixChars + 4
      ? `${value.slice(0, prefixChars)}…${value.slice(-4)}`
      : value;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Ignore clipboard permission errors
    }
  };

  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs">
      {href ? (
        <Link
          href={href}
          title={value}
          className="font-semibold text-[#193C32] hover:text-[#D87854] underline underline-offset-2"
        >
          {display}
        </Link>
      ) : (
        <span title={value} className="text-[#242923]/90">
          {display}
        </span>
      )}
      <button
        type="button"
        onClick={handleCopy}
        title={`Copy full ID: ${value}`}
        aria-label={`Copy ID ${value}`}
        className="px-1.5 py-0.5 rounded text-[10px] font-sans font-medium bg-[#E8E4D9]/70 hover:bg-[#E8E4D9] text-[#193C32] cursor-pointer"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </span>
  );
}

export function AdminEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-[#E8E4D9] bg-white/70 p-8 text-center">
      <h3 className="font-heading text-base font-semibold text-[#193C32]">
        {title}
      </h3>
      <p className="mt-1 text-xs sm:text-sm text-[#242923]/70 max-w-md mx-auto">
        {description}
      </p>
    </div>
  );
}

export function AdminPagination({
  basePath,
  currentPage,
  totalPages,
  totalItems,
  searchParamsRecord = {},
}: {
  basePath: string;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  searchParamsRecord?: Record<string, string | undefined>;
}) {
  const buildPageHref = (targetPage: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParamsRecord)) {
      if (v && k !== "page") {
        sp.set(k, v);
      }
    }
    sp.set("page", String(targetPage));
    return `${basePath}?${sp.toString()}`;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#E8E4D9] text-xs text-[#242923]/80">
      <div>
        Showing page <strong className="text-[#193C32]">{currentPage}</strong>{" "}
        of <strong className="text-[#193C32]">{totalPages}</strong> (
        <strong>{totalItems}</strong> total record{totalItems === 1 ? "" : "s"})
      </div>
      <div className="flex items-center gap-2">
        {currentPage > 1 ? (
          <Link
            href={buildPageHref(currentPage - 1)}
            className="px-3 py-1.5 rounded-lg border border-[#E8E4D9] bg-white font-medium text-[#193C32] hover:bg-[#E8E4D9]/40"
          >
            ← Previous
          </Link>
        ) : (
          <span className="px-3 py-1.5 rounded-lg border border-[#E8E4D9]/60 bg-white/40 text-[#242923]/40 cursor-not-allowed">
            ← Previous
          </span>
        )}
        {currentPage < totalPages ? (
          <Link
            href={buildPageHref(currentPage + 1)}
            className="px-3 py-1.5 rounded-lg border border-[#E8E4D9] bg-white font-medium text-[#193C32] hover:bg-[#E8E4D9]/40"
          >
            Next →
          </Link>
        ) : (
          <span className="px-3 py-1.5 rounded-lg border border-[#E8E4D9]/60 bg-white/40 text-[#242923]/40 cursor-not-allowed">
            Next →
          </span>
        )}
      </div>
    </div>
  );
}

export interface AdminActionFormField {
  name: string;
  label: string;
  type: "text" | "number" | "select" | "textarea" | "checkbox";
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  rows?: number;
  options?: Array<{ label: string; value: string | number }>;
  helperText?: string;
  placeholder?: string;
}

export interface AdminActionModalProps {
  buttonLabel: string;
  buttonVariant?: "primary" | "danger" | "secondary";
  modalTitle: string;
  modalDescription: string;
  payload: Record<string, unknown>;
  fields?: AdminActionFormField[];
  initialExtraState?: Record<string, unknown>;
  disabled?: boolean;
}

/**
 * Reusable confirmation modal for all sensitive administrative operations.
 * Enforces:
 * - Explicit administrator confirmation checkbox (`confirmed: true`)
 * - Mandatory reason input (`minLength: 5`)
 * - Server-side CSRF + rate-limited + live-DB-authorized mutation execution
 */
export function AdminActionTrigger({
  buttonLabel,
  buttonVariant = "secondary",
  modalTitle,
  modalDescription,
  payload,
  fields,
  initialExtraState = {},
  disabled = false,
}: AdminActionModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [extraState, setExtraState] =
    useState<Record<string, unknown>>(initialExtraState);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const btnClasses =
    buttonVariant === "primary"
      ? "bg-[#193C32] text-white hover:bg-[#122B24]"
      : buttonVariant === "danger"
        ? "bg-[#D87854] text-white hover:bg-[#c26744]"
        : "bg-white text-[#193C32] border border-[#E8E4D9] hover:bg-[#E8E4D9]/50";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!confirmed) {
      setErrorMsg("Please check the confirmation box to proceed.");
      return;
    }
    if (reason.trim().length < 5) {
      setErrorMsg("Please enter a reason of at least 5 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/admin/actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...payload,
          ...extraState,
          reason: reason.trim(),
          confirmed: true,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setErrorMsg(data.error || "Operation failed.");
        setSubmitting(false);
        return;
      }

      setSuccessMsg(
        `Operation succeeded (Audit ID: ${data.auditId || "recorded"}).`
      );
      setSubmitting(false);
      router.refresh();
      setTimeout(() => {
        setOpen(false);
        setReason("");
        setConfirmed(false);
        setSuccessMsg(null);
      }, 900);
    } catch {
      setErrorMsg("Network error while communicating with server.");
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setErrorMsg(null);
          setSuccessMsg(null);
          setOpen(true);
        }}
        className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${btnClasses}`}
      >
        {buttonLabel}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#F8F5EE] border border-[#E8E4D9] shadow-xl p-6 text-left">
            <div className="flex items-start justify-between gap-3">
              <h3
                id="admin-modal-title"
                className="font-heading text-lg font-bold text-[#193C32]"
              >
                {modalTitle}
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm text-[#242923]/60 hover:text-[#242923]"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <p className="mt-2 text-xs sm:text-sm text-[#242923]/80 leading-relaxed">
              {modalDescription}
            </p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {fields && fields.length > 0 && (
                <div className="space-y-3 text-xs">
                  {fields.map((field) => (
                    <div key={field.name}>
                      {field.type === "checkbox" ? (
                        <label className="flex items-center gap-2 cursor-pointer font-medium text-[#242923]">
                          <input
                            type="checkbox"
                            checked={Boolean(extraState[field.name])}
                            onChange={(e) =>
                              setExtraState((prev) => ({
                                ...prev,
                                [field.name]: e.target.checked,
                              }))
                            }
                            className="rounded border-[#E8E4D9] text-[#193C32] focus:ring-[#193C32]"
                          />
                          <span>{field.label}</span>
                        </label>
                      ) : (
                        <>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-[#193C32] mb-1">
                            {field.label}
                          </label>
                          {field.type === "select" ? (
                            <select
                              required={field.required}
                              value={
                                (extraState[field.name] as string | number) ??
                                ""
                              }
                              onChange={(e) =>
                                setExtraState((prev) => ({
                                  ...prev,
                                  [field.name]:
                                    typeof field.options?.[0]?.value === "number"
                                      ? Number(e.target.value)
                                      : e.target.value,
                                }))
                              }
                              className="w-full rounded-lg border border-[#E8E4D9] bg-white px-2.5 py-1.5 text-xs text-[#242923]"
                            >
                              {field.options?.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          ) : field.type === "textarea" ? (
                            <textarea
                              required={field.required}
                              minLength={field.minLength}
                              maxLength={field.maxLength}
                              rows={field.rows || 3}
                              placeholder={field.placeholder}
                              value={String(extraState[field.name] ?? "")}
                              onChange={(e) =>
                                setExtraState((prev) => ({
                                  ...prev,
                                  [field.name]: e.target.value,
                                }))
                              }
                              className="w-full rounded-lg border border-[#E8E4D9] bg-white px-3 py-1.5 text-xs text-[#242923]"
                            />
                          ) : (
                            <input
                              type={field.type}
                              required={field.required}
                              min={field.min}
                              max={field.max}
                              minLength={field.minLength}
                              maxLength={field.maxLength}
                              placeholder={field.placeholder}
                              value={
                                field.type === "number"
                                  ? (extraState[field.name] as number) ?? ""
                                  : String(extraState[field.name] ?? "")
                              }
                              onChange={(e) =>
                                setExtraState((prev) => ({
                                  ...prev,
                                  [field.name]:
                                    field.type === "number"
                                      ? Number(e.target.value)
                                      : e.target.value,
                                }))
                              }
                              className="w-full rounded-lg border border-[#E8E4D9] bg-white px-3 py-1.5 text-xs text-[#242923]"
                            />
                          )}
                        </>
                      )}
                      {field.helperText && (
                        <p className="mt-1 text-[11px] text-[#242923]/60">
                          {field.helperText}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#193C32] mb-1">
                  Administrator Reason (Required)
                </label>
                <textarea
                  required
                  minLength={5}
                  maxLength={1000}
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Provide a clear operational reason for the immutable audit log…"
                  className="w-full rounded-lg border border-[#E8E4D9] bg-white px-3 py-2 text-xs sm:text-sm text-[#242923] focus:outline-none focus:ring-2 focus:ring-[#193C32]"
                />
              </div>

              <label className="flex items-start gap-2.5 text-xs text-[#242923]/90 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-0.5 rounded border-[#E8E4D9] text-[#193C32] focus:ring-[#193C32]"
                />
                <span>
                  I confirm this administrative action and understand it will be
                  verified server-side and recorded in the append-only audit log.
                </span>
              </label>

              {errorMsg && (
                <div
                  role="alert"
                  className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-900"
                >
                  {errorMsg}
                </div>
              )}

              {successMsg && (
                <div
                  role="status"
                  className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-900"
                >
                  {successMsg}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E8E4D9]">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={submitting}
                  className="px-3.5 py-1.5 rounded-lg border border-[#E8E4D9] bg-white text-xs font-semibold text-[#242923] hover:bg-[#E8E4D9]/40 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 ${
                    buttonVariant === "danger"
                      ? "bg-[#D87854] text-white hover:bg-[#c26744]"
                      : "bg-[#193C32] text-white hover:bg-[#122B24]"
                  }`}
                >
                  {submitting ? "Executing…" : "Confirm & Execute"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
