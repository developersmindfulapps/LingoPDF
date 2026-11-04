import React from "react";
import Link from "next/link";
import { verifyServerAdminPageAccess } from "@/lib/auth/adminServer";
import {
  listAdminRefunds,
  formatMinorUnits,
  formatAdminTimestamp,
  formatGuaranteeCountdown,
} from "@/lib/admin/services";
import {
  AdminStatusBadge,
  AdminCopyId,
  AdminEmptyState,
  AdminPagination,
  AdminActionTrigger,
} from "@/components/admin/AdminUi";

export const instant = false;

export default async function AdminRefundsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await verifyServerAdminPageAccess();
  if (!auth.authorized) return null;
  const { db } = auth;
  const resolvedParams = await searchParams;

  const page = Number(
    typeof resolvedParams.page === "string" ? resolvedParams.page : "1"
  );
  const q = typeof resolvedParams.q === "string" ? resolvedParams.q : "";
  const status =
    typeof resolvedParams.status === "string" ? resolvedParams.status : "all";
  const currency =
    typeof resolvedParams.currency === "string"
      ? resolvedParams.currency
      : "all";
  const windowFilter =
    typeof resolvedParams.windowFilter === "string"
      ? resolvedParams.windowFilter
      : "all";

  const result = await listAdminRefunds(db, {
    page,
    limit: 20,
    q,
    status,
    currency,
    windowFilter,
  });

  const searchParamsRecord: Record<string, string | undefined> = {
    q: q || undefined,
    status: status !== "all" ? status : undefined,
    currency: currency !== "all" ? currency : undefined,
    windowFilter: windowFilter !== "all" ? windowFilter : undefined,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#193C32]">
            Refund Management &amp; 72-Hour Guarantee Queue
          </h1>
          <p className="text-xs sm:text-sm text-[#242923]/70 mt-1">
            Review customer refund requests, verify 72-hour money-back guarantee
            deadlines, and manage entitlement and referral commission holds.
          </p>
        </div>
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3.5 py-2 text-xs text-amber-900 max-w-md">
          <strong>Gateway Boundary:</strong> Approving a refund marks it{" "}
          <code>approved_pending_gateway</code>. Live Razorpay refund settlement
          is deferred to Stage 3C; gateway completion is never fabricated.
        </div>
      </div>

      {/* Filter Bar */}
      <form
        method="GET"
        action="/admin/refunds"
        className="rounded-xl border border-[#E8E4D9] bg-white p-4 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3"
      >
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#242923]/70 mb-1">
            Search Request / Purchase / Email
          </label>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Request ID, purchase ID, customer email…"
            className="w-full rounded-lg border border-[#E8E4D9] bg-[#F8F5EE]/50 px-3 py-1.5 text-xs text-[#242923]"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#242923]/70 mb-1">
            Refund Status
          </label>
          <select
            name="status"
            defaultValue={status}
            className="w-full rounded-lg border border-[#E8E4D9] bg-white px-2.5 py-1.5 text-xs text-[#242923]"
          >
            <option value="all">All Statuses</option>
            <option value="pending_review">Pending Review</option>
            <option value="approved_pending_gateway">
              Approved (Pending Gateway)
            </option>
            <option value="rejected">Rejected</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#242923]/70 mb-1">
            72-Hour Guarantee Window
          </label>
          <select
            name="windowFilter"
            defaultValue={windowFilter}
            className="w-full rounded-lg border border-[#E8E4D9] bg-white px-2.5 py-1.5 text-xs text-[#242923]"
          >
            <option value="all">All Requests</option>
            <option value="within_72h">Within 72h Guarantee</option>
            <option value="outside_72h">Outside 72h (Exceptional)</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#242923]/70 mb-1">
            Currency
          </label>
          <select
            name="currency"
            defaultValue={currency}
            className="w-full rounded-lg border border-[#E8E4D9] bg-white px-2.5 py-1.5 text-xs text-[#242923]"
          >
            <option value="all">All Currencies</option>
            <option value="INR">INR (₹)</option>
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
          </select>
        </div>

        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="px-4 py-1.5 rounded-lg bg-[#193C32] text-white text-xs font-semibold hover:bg-[#122B24] cursor-pointer"
          >
            Apply
          </button>
          <Link
            href="/admin/refunds"
            className="px-3 py-1.5 rounded-lg border border-[#E8E4D9] bg-[#F8F5EE] text-xs font-medium text-[#242923] hover:bg-[#E8E4D9]/50"
          >
            Reset
          </Link>
        </div>
      </form>

      {/* Refund Queue Table */}
      <div className="rounded-xl border border-[#E8E4D9] bg-white p-5 shadow-xs">
        {result.items.length === 0 ? (
          <AdminEmptyState
            title="No refund requests in queue"
            description="No refund requests match the selected filter criteria. You can also record a customer refund request from any captured purchase detail page."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E8E4D9] text-[#242923]/60 uppercase">
                  <th className="py-2.5 pr-3">Refund Request</th>
                  <th className="py-2.5 px-3">Customer &amp; Purchase</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">72h Window Evaluation</th>
                  <th className="py-2.5 px-3">Entitlement &amp; Reason</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 pl-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E4D9]/60">
                {result.items.map((r) => {
                  const countdown = formatGuaranteeCountdown(
                    r.purchaseCapturedAt
                  );
                  return (
                    <tr key={r.requestId} className="hover:bg-[#F8F5EE]/50">
                      <td className="py-3 pr-3">
                        <div className="font-mono font-semibold text-[#193C32]">
                          {r.requestId}
                        </div>
                        <div className="text-[11px] text-[#242923]/60">
                          Requested: {formatAdminTimestamp(r.requestedAt)}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <Link
                          href={`/admin/users/${r.userId}`}
                          className="font-medium text-[#193C32] hover:underline"
                        >
                          {r.userEmail}
                        </Link>
                        <div className="text-[11px] text-[#242923]/60">
                          Purchase:{" "}
                          <AdminCopyId
                            value={r.purchaseId}
                            href={`/admin/purchases/${r.purchaseId}`}
                            prefixChars={6}
                          />{" "}
                          ({r.productSlug})
                        </div>
                      </td>
                      <td className="py-3 px-3 font-bold text-[#193C32]">
                        {formatMinorUnits(r.amountSubunits, r.currency)}
                        <div className="text-[10px] font-normal text-[#242923]/60">
                          {r.currency}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                            r.isWithin72hGuarantee
                              ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                              : "bg-amber-50 text-amber-900 border border-amber-200"
                          }`}
                        >
                          {r.isWithin72hGuarantee
                            ? "Within 72h Guarantee"
                            : "Outside 72h (Exceptional)"}
                        </span>
                        <div className="text-[11px] text-[#242923]/60 mt-0.5">
                          {countdown.label}
                        </div>
                      </td>
                      <td className="py-3 px-3 max-w-xs">
                        <div className="text-[#242923]">{r.reason}</div>
                        {r.entitlementStatus && (
                          <div className="text-[11px] text-[#242923]/60 mt-0.5">
                            Entitlement: <strong>{r.entitlementStatus}</strong>{" "}
                            ({r.entitlementRestrictions.join(", ") || "none"})
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <AdminStatusBadge status={r.status} />
                        {r.reviewedByAdminEmail && (
                          <div className="text-[10px] text-[#242923]/60 mt-1">
                            By {r.reviewedByAdminEmail}
                          </div>
                        )}
                      </td>
                      <td className="py-3 pl-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5 flex-wrap">
                          {r.status === "pending_review" && (
                            <>
                              <AdminActionTrigger
                                buttonLabel="Approve (Pending Gateway)"
                                buttonVariant="primary"
                                modalTitle="Approve Refund Request (Pending Gateway)"
                                modalDescription={`Approve refund request ${r.requestId} (${formatMinorUnits(r.amountSubunits, r.currency)}). This keeps the entitlement restricted and records internal approval without fabricating live Razorpay completion.`}
                                payload={{
                                  actionType: "refund.approve",
                                  purchaseId: r.purchaseId,
                                }}
                              />
                              <AdminActionTrigger
                                buttonLabel="Reject Request"
                                buttonVariant="danger"
                                modalTitle="Reject Refund Request"
                                modalDescription={`Reject refund request ${r.requestId}. This removes the 'refund_pending' restriction from the entitlement (restoring active status if no other restriction remains) and releases the refund hold on any unpaid referral commission.`}
                                payload={{
                                  actionType: "refund.reject",
                                  purchaseId: r.purchaseId,
                                }}
                              />
                            </>
                          )}
                          {r.status === "approved_pending_gateway" && (
                            <span className="text-[11px] text-amber-900 font-medium">
                              Awaiting Stage 3C Gateway Settlement
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <AdminPagination
          basePath="/admin/refunds"
          currentPage={result.page}
          totalPages={result.totalPages}
          totalItems={result.total}
          searchParamsRecord={searchParamsRecord}
        />
      </div>
    </div>
  );
}
