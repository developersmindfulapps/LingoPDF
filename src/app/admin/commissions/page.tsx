import React from "react";
import Link from "next/link";
import { verifyServerAdminPageAccess } from "@/lib/auth/adminServer";
import {
  listAdminCommissions,
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

export default async function AdminCommissionsPage({
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

  const result = await listAdminCommissions(db, {
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
            Commission Ledger &amp; Post-Payout Adjustments
          </h1>
          <p className="text-xs sm:text-sm text-[#242923]/70 mt-1">
            Manage 20% net referral commissions, enforce the 72-hour eligibility
            hold window, and track immutable post-payout{" "}
            <code>commission_adjustments</code>.
          </p>
        </div>
        <div className="rounded-lg bg-[#E8E4D9]/70 border border-[#d6d0c0] px-3.5 py-2 text-xs text-[#193C32] max-w-md">
          <strong>Commission Invariants:</strong> Commissions are 20% of net
          collected amount (excluding taxes). A commission cannot become{" "}
          <code>eligible</code> before 72 hours after capture or while a refund
          or dispute is open. Paid commissions are never silently mutated.
        </div>
      </div>

      {/* Filter Bar */}
      <form
        method="GET"
        action="/admin/commissions"
        className="rounded-xl border border-[#E8E4D9] bg-white p-4 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
      >
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#242923]/70 mb-1">
            Search Commission / Referrer / Purchase ID
          </label>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Commission ID, referrer email, purchase ID…"
            className="w-full rounded-lg border border-[#E8E4D9] bg-[#F8F5EE]/50 px-3 py-1.5 text-xs text-[#242923]"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#242923]/70 mb-1">
            Ledger Status
          </label>
          <select
            name="status"
            defaultValue={status}
            className="w-full rounded-lg border border-[#E8E4D9] bg-white px-2.5 py-1.5 text-xs text-[#242923]"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending (72h Window)</option>
            <option value="held">On Dispute / Refund Hold</option>
            <option value="eligible">Eligible</option>
            <option value="approved">Approved for Payout</option>
            <option value="included_in_payout">Included in Payout Batch</option>
            <option value="paid">Paid</option>
            <option value="cancelled">Cancelled</option>
            <option value="adjusted">Has Post-Payout Adjustment</option>
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
            href="/admin/commissions"
            className="px-3 py-1.5 rounded-lg border border-[#E8E4D9] bg-[#F8F5EE] text-xs font-medium text-[#242923] hover:bg-[#E8E4D9]/50"
          >
            Reset
          </Link>
        </div>
      </form>

      {/* Commissions Table */}
      <div className="rounded-xl border border-[#E8E4D9] bg-white p-5 shadow-xs">
        {result.items.length === 0 ? (
          <AdminEmptyState
            title="No commission records match your filters"
            description="No referral commission ledger records were found."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E8E4D9] text-[#242923]/60 uppercase">
                  <th className="py-2.5 pr-3">Commission ID</th>
                  <th className="py-2.5 px-3">Referrer &amp; Buyer</th>
                  <th className="py-2.5 px-3">Net Basis</th>
                  <th className="py-2.5 px-3">Commission (20%)</th>
                  <th className="py-2.5 px-3">Status &amp; Hold Info</th>
                  <th className="py-2.5 px-3">72h Hold Until</th>
                  <th className="py-2.5 pl-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E4D9]/60">
                {result.items.map((c) => (
                  <tr key={c.id} className="hover:bg-[#F8F5EE]/50">
                    <td className="py-3 pr-3">
                      <AdminCopyId value={c.id} />
                      <div className="text-[11px] text-[#242923]/60 mt-0.5">
                        Purchase:{" "}
                        <AdminCopyId
                          value={c.purchaseId}
                          href={`/admin/purchases/${c.purchaseId}`}
                          prefixChars={6}
                        />
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div>
                        Ref:{" "}
                        <Link
                          href={`/admin/users/${c.referrerUserId}`}
                          className="font-semibold text-[#193C32] hover:underline"
                        >
                          {c.referrerEmail}
                        </Link>
                      </div>
                      <div className="text-[11px] text-[#242923]/70">
                        Buyer: {c.referredEmail}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      {formatMinorUnits(c.netCollectedSubunits, c.currency)}{" "}
                      <span className="text-[10px] text-[#242923]/60">
                        {c.currency}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold text-[#193C32]">
                      {formatMinorUnits(c.commissionAmountSubunits, c.currency)}
                      <div className="text-[10px] font-normal text-[#242923]/60">
                        {c.commissionRatePercent}% · {c.currency}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        <AdminStatusBadge status={c.status} />
                        {c.isDisputedHold && (
                          <AdminStatusBadge status="held" label="Held" />
                        )}
                        {c.payoutId && (
                          <span className="px-1.5 py-0.5 rounded bg-[#E8E4D9] font-mono text-[10px] text-[#193C32]">
                            Batch: {c.payoutId.slice(0, 6)}…
                          </span>
                        )}
                      </div>
                      {c.holdReason && (
                        <div className="text-[11px] text-amber-800 mt-0.5">
                          {c.holdReason}
                        </div>
                      )}
                      {c.cancellationReason && (
                        <div className="text-[11px] text-red-700 mt-0.5">
                          Cancelled: {c.cancellationReason}
                        </div>
                      )}
                      {c.adjustment && (
                        <div className="text-[11px] text-red-800 font-medium mt-0.5">
                          Adjusted:{" "}
                          {formatMinorUnits(
                            c.adjustment.adjustmentAmountSubunits,
                            c.currency
                          )}{" "}
                          ({c.adjustment.resolutionStatus})
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-[11px] text-[#242923]/75">
                      <div>{formatAdminTimestamp(c.holdUntil)}</div>
                      <div className="text-[10px] text-[#242923]/60">
                        {c.isHoldWindowElapsed
                          ? "72h window elapsed"
                          : "Within 72h window"}
                      </div>
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5 flex-wrap">
                        {c.status === "pending" && (
                          <AdminActionTrigger
                            buttonLabel="Verify 72h Eligibility"
                            buttonVariant="secondary"
                            modalTitle="Evaluate 72-Hour Commission Eligibility"
                            modalDescription={`Verify server-side that the 72-hour refund window has elapsed (${formatAdminTimestamp(c.holdUntil)}), no refund or dispute is open, and transition commission ${c.id} to 'eligible'.`}
                            payload={{
                              actionType: "commission.evaluate_eligibility",
                              commissionId: c.id,
                            }}
                          />
                        )}
                        {c.status === "eligible" &&
                          !c.isDisputedHold &&
                          !c.payoutId && (
                            <AdminActionTrigger
                              buttonLabel="Approve for Payout"
                              buttonVariant="primary"
                              modalTitle="Approve Eligible Commission for Payout"
                              modalDescription={`Approve commission ${c.id} (${formatMinorUnits(c.commissionAmountSubunits, c.currency)}) so it can be included in a single-currency payout batch once the referrer meets the 5-commission threshold.`}
                              payload={{
                                actionType: "commission.approve",
                                commissionId: c.id,
                              }}
                            />
                          )}
                        {c.status === "paid" && !c.adjustment && (
                          <AdminActionTrigger
                            buttonLabel="Record Adjustment"
                            buttonVariant="danger"
                            modalTitle="Record Post-Payout Commission Adjustment"
                            modalDescription={`Create an immutable record in 'commission_adjustments' for already-paid commission ${c.id} (${formatMinorUnits(c.commissionAmountSubunits, c.currency)}) without mutating historical paid ledger entries.`}
                            payload={{
                              actionType: "commission.create_adjustment",
                              commissionId: c.id,
                            }}
                            initialExtraState={{
                              adjustmentReason: "post_payout_refund",
                            }}
                            fields={[
                              {
                                name: "adjustmentReason",
                                label: "Adjustment Classification",
                                type: "select",
                                required: true,
                                options: [
                                  {
                                    label: "Post-Payout Refund",
                                    value: "post_payout_refund",
                                  },
                                  {
                                    label: "Post-Payout Chargeback Lost",
                                    value: "post_payout_chargeback",
                                  },
                                  {
                                    label: "Post-Payout Fraud",
                                    value: "post_payout_fraud",
                                  },
                                  {
                                    label: "Manual Accounting Reconciliation",
                                    value: "manual_reconciliation",
                                  },
                                ],
                              },
                            ]}
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
          basePath="/admin/commissions"
          currentPage={result.page}
          totalPages={result.totalPages}
          totalItems={result.total}
          searchParamsRecord={searchParamsRecord}
        />
      </div>

      {/* Post-Payout Commission Adjustments Section */}
      <div className="rounded-xl border border-[#E8E4D9] bg-white p-5 shadow-xs">
        <h2 className="font-heading text-base font-bold text-[#193C32] mb-3">
          Post-Payout Commission Adjustments Ledger ({result.adjustments.length}
          )
        </h2>
        {result.adjustments.length === 0 ? (
          <AdminEmptyState
            title="No post-payout commission adjustments"
            description="When an already-paid referral commission is affected by a later refund or lost chargeback, an immutable accounting entry is created in commission_adjustments."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E8E4D9] text-[#242923]/60 uppercase">
                  <th className="py-2 pr-3">Adjustment ID</th>
                  <th className="py-2 px-3">Commission / Purchase</th>
                  <th className="py-2 px-3">Amount</th>
                  <th className="py-2 px-3">Classification</th>
                  <th className="py-2 px-3">Resolution Status</th>
                  <th className="py-2 px-3">Notes</th>
                  <th className="py-2 pl-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E4D9]/60">
                {result.adjustments.map((adj) => (
                  <tr key={adj.id}>
                    <td className="py-2.5 pr-3">
                      <AdminCopyId value={adj.id} />
                    </td>
                    <td className="py-2.5 px-3">
                      <div>
                        Comm: <AdminCopyId value={adj.commissionId} />
                      </div>
                      <div className="text-[11px] text-[#242923]/60">
                        Purchase:{" "}
                        <AdminCopyId
                          value={adj.purchaseId}
                          href={`/admin/purchases/${adj.purchaseId}`}
                          prefixChars={6}
                        />
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-bold text-red-800">
                      {formatMinorUnits(
                        adj.adjustmentAmountSubunits,
                        adj.currency
                      )}{" "}
                      ({adj.currency})
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">
                      {adj.reason}
                    </td>
                    <td className="py-2.5 px-3">
                      <AdminStatusBadge status={adj.resolutionStatus} />
                    </td>
                    <td className="py-2.5 px-3 text-[11px] text-[#242923]/80">
                      {adj.notes || "—"}
                    </td>
                    <td className="py-2.5 pl-3 text-right">
                      {adj.resolutionStatus === "open" && (
                        <div className="inline-flex items-center gap-1.5">
                          <AdminActionTrigger
                            buttonLabel="Mark Applied"
                            buttonVariant="primary"
                            modalTitle="Mark Commission Adjustment Applied"
                            modalDescription={`Record that adjustment ${adj.id} has been applied/offset against future payout reconciliation.`}
                            payload={{
                              actionType: "commission.resolve_adjustment",
                              adjustmentId: adj.id,
                              resolutionStatus: "offset_applied",
                            }}
                          />
                          <AdminActionTrigger
                            buttonLabel="Waive"
                            buttonVariant="secondary"
                            modalTitle="Waive Commission Adjustment"
                            modalDescription={`Waive post-payout adjustment ${adj.id} with an audited reason.`}
                            payload={{
                              actionType: "commission.resolve_adjustment",
                              adjustmentId: adj.id,
                              resolutionStatus: "waived",
                            }}
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
