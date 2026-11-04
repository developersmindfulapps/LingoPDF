import React from "react";
import Link from "next/link";
import { verifyServerAdminPageAccess } from "@/lib/auth/adminServer";
import {
  listAdminPayouts,
  formatMinorUnits,
  formatAdminTimestamp,
} from "@/lib/admin/services";
import {
  AdminStatusBadge,
  AdminCopyId,
  AdminEmptyState,
  AdminPagination,
  AdminActionTrigger,
} from "@/components/admin/AdminUi";

export const instant = false;

export default async function AdminPayoutsPage({
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

  const result = await listAdminPayouts(db, {
    page,
    limit: 20,
    q,
    status,
    currency,
  });

  const searchParamsRecord: Record<string, string | undefined> = {
    q: q || undefined,
    status: status !== "all" ? status : undefined,
    currency: currency !== "all" ? currency : undefined,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#193C32]">
            Payout Management &amp; Single-Currency Batching
          </h1>
          <p className="text-xs sm:text-sm text-[#242923]/70 mt-1">
            Verify 5-commission cross-currency referrer readiness, create
            single-currency payout batches, and manage payout lifecycle states.
          </p>
        </div>
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3.5 py-2 text-xs text-amber-900 max-w-md">
          <strong>Payout &amp; Gateway Boundary:</strong> A referrer unlocks
          payout eligibility after <strong>5 qualifying commissions</strong>{" "}
          across all currencies, while actual payout batches remain{" "}
          <strong>single-currency</strong> (<code>INR</code>, <code>USD</code>,
          or <code>EUR</code>). Live RazorpayX/bank transfers are deferred to
          Stage 3C; payout completion is never fabricated.
        </div>
      </div>

      {/* Referrer 5-Commission Eligibility Readiness & Batch Creation */}
      <div className="rounded-xl border border-[#E8E4D9] bg-white p-5 shadow-xs">
        <h2 className="font-heading text-base font-bold text-[#193C32] mb-1">
          Referrer Payout Eligibility &amp; Single-Currency Batch Builder
        </h2>
        <p className="text-xs text-[#242923]/70 mb-4">
          Each commission can only be reserved into one active payout batch at a
          time (<code>payoutId === null</code>). First payouts are admin
          approved; subsequent payouts support scheduled bi-weekly / monthly
          batching.
        </p>

        {result.referrerEligibilitySummary.length === 0 ? (
          <AdminEmptyState
            title="No referral profiles available"
            description="Referrer payout readiness will appear here once referral profiles exist."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E8E4D9] text-[#242923]/60 uppercase">
                  <th className="py-2 pr-3">Referrer</th>
                  <th className="py-2 px-3">Cross-Currency 5-Commission Gate</th>
                  <th className="py-2 px-3">Payout Destination</th>
                  <th className="py-2 pl-3">
                    Single-Currency Approved Batches Ready
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E4D9]/60">
                {result.referrerEligibilitySummary.map((ref) => (
                  <tr key={ref.referrerUserId} className="hover:bg-[#F8F5EE]/50">
                    <td className="py-3 pr-3">
                      <Link
                        href={`/admin/users/${ref.referrerUserId}`}
                        className="font-semibold text-[#193C32] hover:underline"
                      >
                        {ref.referrerEmail}
                      </Link>
                      <div className="font-mono text-[11px] text-[#242923]/60">
                        Code: {ref.referralCode}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded font-semibold text-[11px] ${
                          ref.meetsFiveCommissionThreshold
                            ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                            : "bg-amber-50 text-amber-900 border border-amber-200"
                        }`}
                      >
                        {ref.totalQualifyingAcrossCurrencies} / 5 Qualifying
                        Commissions
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[11px]">
                      {ref.payoutMethod && ref.payoutMethod !== "unset" ? (
                        <div>
                          <strong className="uppercase text-[#193C32]">
                            {ref.payoutMethod.replace(/_/g, " ")}
                          </strong>
                        </div>
                      ) : (
                        <span className="text-red-700 font-medium">
                          No payout destination configured
                        </span>
                      )}
                    </td>
                    <td className="py-3 pl-3">
                      <div className="flex flex-wrap gap-2">
                        {ref.batchesByCurrency.map((b) => (
                          <div
                            key={b.currency}
                            className="rounded-lg border border-[#E8E4D9] bg-[#F8F5EE]/70 px-3 py-1.5 flex items-center gap-2"
                          >
                            <div>
                              <div className="font-bold text-[#193C32]">
                                {b.currency}:{" "}
                                {formatMinorUnits(
                                  b.approvedTotalSubunits,
                                  b.currency
                                )}
                              </div>
                              <div className="text-[10px] text-[#242923]/65">
                                {b.approvedCount} approved ({b.qualifyingCount}{" "}
                                qualifying)
                              </div>
                            </div>
                            {ref.meetsFiveCommissionThreshold &&
                              b.approvedCount > 0 &&
                              Boolean(
                                ref.payoutMethod && ref.payoutMethod !== "unset"
                              ) && (
                                <AdminActionTrigger
                                  buttonLabel={`Batch ${b.currency}`}
                                  buttonVariant="primary"
                                  modalTitle={`Create ${b.currency} Payout Batch`}
                                  modalDescription={`Atomically reserve ${b.approvedCount} approved ${b.currency} commission(s) totaling ${formatMinorUnits(b.approvedTotalSubunits, b.currency)} for ${ref.referrerEmail}.`}
                                  payload={{
                                    actionType: "payout.create_batch",
                                    referrerUserId: ref.referrerUserId,
                                    currency: b.currency,
                                    initiationType: "admin_first_payout",
                                  }}
                                />
                              )}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <form
        method="GET"
        action="/admin/payouts"
        className="rounded-xl border border-[#E8E4D9] bg-white p-4 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
      >
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#242923]/70 mb-1">
            Search Payout ID / Referrer Email
          </label>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Payout ID, referrer email, transfer ref…"
            className="w-full rounded-lg border border-[#E8E4D9] bg-[#F8F5EE]/50 px-3 py-1.5 text-xs text-[#242923]"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#242923]/70 mb-1">
            Batch Status
          </label>
          <select
            name="status"
            defaultValue={status}
            className="w-full rounded-lg border border-[#E8E4D9] bg-white px-2.5 py-1.5 text-xs text-[#242923]"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="approved">Approved</option>
            <option value="processing">Processing</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#242923]/70 mb-1">
            Batch Currency
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
            href="/admin/payouts"
            className="px-3 py-1.5 rounded-lg border border-[#E8E4D9] bg-[#F8F5EE] text-xs font-medium text-[#242923] hover:bg-[#E8E4D9]/50"
          >
            Reset
          </Link>
        </div>
      </form>

      {/* Payout Batches Table */}
      <div className="rounded-xl border border-[#E8E4D9] bg-white p-5 shadow-xs">
        <h2 className="font-heading text-base font-bold text-[#193C32] mb-4">
          Payout Batches ({result.total})
        </h2>

        {result.items.length === 0 ? (
          <AdminEmptyState
            title="No payout batches found"
            description="No payout batches match the selected filters."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E8E4D9] text-[#242923]/60 uppercase">
                  <th className="py-2.5 pr-3">Batch ID</th>
                  <th className="py-2.5 px-3">Referrer</th>
                  <th className="py-2.5 px-3">Single-Currency Total</th>
                  <th className="py-2.5 px-3">Commissions</th>
                  <th className="py-2.5 px-3">Destination &amp; Cadence</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 pl-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E4D9]/60">
                {result.items.map((po) => (
                  <tr key={po.id} className="hover:bg-[#F8F5EE]/50">
                    <td className="py-3 pr-3">
                      <AdminCopyId value={po.id} />
                      <div className="text-[11px] text-[#242923]/60">
                        {formatAdminTimestamp(po.createdAt)}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <Link
                        href={`/admin/users/${po.referrerUserId}`}
                        className="font-semibold text-[#193C32] hover:underline"
                      >
                        {po.referrerEmail}
                      </Link>
                    </td>
                    <td className="py-3 px-3 font-bold text-[#193C32]">
                      {formatMinorUnits(po.totalAmountSubunits, po.currency)}
                      <div className="text-[10px] font-normal text-[#242923]/60">
                        {po.currency} only
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <strong>{po.commissionCount}</strong> commission(s)
                    </td>
                    <td className="py-3 px-3 text-[11px]">
                      <div>
                        <strong className="uppercase">
                          {po.payoutMethod.replace(/_/g, " ")}
                        </strong>
                      </div>
                      <div className="text-[#242923]/60">
                        Cadence: {po.initiationType}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <AdminStatusBadge status={po.status} />
                      {po.failureReason && (
                        <div className="text-[11px] text-red-700 mt-0.5">
                          Failed: {po.failureReason}
                        </div>
                      )}
                      {po.rejectionReason && (
                        <div className="text-[11px] text-red-700 mt-0.5">
                          Rejected: {po.rejectionReason}
                        </div>
                      )}
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5 flex-wrap">
                        {po.status === "draft" && (
                          <>
                            <AdminActionTrigger
                              buttonLabel="Approve Batch"
                              buttonVariant="primary"
                              modalTitle="Approve Payout Batch"
                              modalDescription={`Approve single-currency ${po.currency} payout batch ${po.id} (${formatMinorUnits(po.totalAmountSubunits, po.currency)}).`}
                              payload={{
                                actionType: "payout.approve",
                                payoutId: po.id,
                              }}
                            />
                            <AdminActionTrigger
                              buttonLabel="Reject Batch"
                              buttonVariant="danger"
                              modalTitle="Reject Payout Batch & Unreserve Commissions"
                              modalDescription={`Reject payout batch ${po.id} and release all ${po.commissionCount} reserved commission(s) so they can be re-evaluated.`}
                              payload={{
                                actionType: "payout.reject",
                                payoutId: po.id,
                              }}
                            />
                          </>
                        )}
                        {po.status === "approved" && (
                          <>
                            <AdminActionTrigger
                              buttonLabel="Mark Processing"
                              buttonVariant="secondary"
                              modalTitle="Mark Payout Batch Processing"
                              modalDescription={`Transition batch ${po.id} to 'processing' pending Stage 3C gateway transfer settlement.`}
                              payload={{
                                actionType: "payout.mark_processing",
                                payoutId: po.id,
                              }}
                            />
                            <AdminActionTrigger
                              buttonLabel="Reject Batch"
                              buttonVariant="danger"
                              modalTitle="Reject Payout Batch & Unreserve Commissions"
                              modalDescription={`Reject payout batch ${po.id} and release all ${po.commissionCount} reserved commission(s).`}
                              payload={{
                                actionType: "payout.reject",
                                payoutId: po.id,
                              }}
                            />
                          </>
                        )}
                        {po.status === "processing" && (
                          <AdminActionTrigger
                            buttonLabel="Mark Failed (Unreserve)"
                            buttonVariant="danger"
                            modalTitle="Mark Payout Batch Failed"
                            modalDescription={`Mark payout batch ${po.id} as failed and unreserve its ${po.commissionCount} commission(s) for future retry.`}
                            payload={{
                              actionType: "payout.mark_failed",
                              payoutId: po.id,
                            }}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <AdminPagination
          basePath="/admin/payouts"
          currentPage={result.page}
          totalPages={result.totalPages}
          totalItems={result.total}
          searchParamsRecord={searchParamsRecord}
        />
      </div>
    </div>
  );
}
