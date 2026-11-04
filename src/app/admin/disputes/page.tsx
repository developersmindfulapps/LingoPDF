import React from "react";
import Link from "next/link";
import { verifyServerAdminPageAccess } from "@/lib/auth/adminServer";
import {
  listAdminDisputes,
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

export default async function AdminDisputesPage({
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

  const result = await listAdminDisputes(db, {
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
            Dispute &amp; Chargeback Management
          </h1>
          <p className="text-xs sm:text-sm text-[#242923]/70 mt-1">
            Inspect payment disputes, review immutable chargeback-defense
            evidence snapshots, and enforce entitlement and commission outcome
            invariants.
          </p>
        </div>
        <div className="rounded-lg bg-[#E8E4D9]/70 border border-[#d6d0c0] px-3.5 py-2 text-xs text-[#193C32] max-w-md">
          <strong>Dispute Invariants:</strong> Won/Withdrawn removes{" "}
          <code>dispute_open</code> and restores access only if no other
          restriction exists. Lost permanently revokes entitlement and cancels
          unpaid commission (or records a post-payout{" "}
          <code>commission_adjustments</code> entry if already paid).
        </div>
      </div>

      {/* Filter Bar */}
      <form
        method="GET"
        action="/admin/disputes"
        className="rounded-xl border border-[#E8E4D9] bg-white p-4 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
      >
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#242923]/70 mb-1">
            Search Dispute ID / Purchase / Email
          </label>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Dispute ID, purchase ID, customer email…"
            className="w-full rounded-lg border border-[#E8E4D9] bg-[#F8F5EE]/50 px-3 py-1.5 text-xs text-[#242923]"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#242923]/70 mb-1">
            Dispute Status
          </label>
          <select
            name="status"
            defaultValue={status}
            className="w-full rounded-lg border border-[#E8E4D9] bg-white px-2.5 py-1.5 text-xs text-[#242923]"
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="under_review">Under Review</option>
            <option value="won">Won</option>
            <option value="withdrawn">Withdrawn</option>
            <option value="lost">Lost (Chargeback Lost)</option>
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
            href="/admin/disputes"
            className="px-3 py-1.5 rounded-lg border border-[#E8E4D9] bg-[#F8F5EE] text-xs font-medium text-[#242923] hover:bg-[#E8E4D9]/50"
          >
            Reset
          </Link>
        </div>
      </form>

      {/* Disputes Table */}
      <div className="rounded-xl border border-[#E8E4D9] bg-white p-5 shadow-xs">
        {result.items.length === 0 ? (
          <AdminEmptyState
            title="No dispute records found"
            description="No payment disputes or chargeback inquiries match your current filters."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E8E4D9] text-[#242923]/60 uppercase">
                  <th className="py-2.5 pr-3">Dispute ID</th>
                  <th className="py-2.5 px-3">Customer &amp; Purchase</th>
                  <th className="py-2.5 px-3">Disputed Amount</th>
                  <th className="py-2.5 px-3">Status &amp; Reason Code</th>
                  <th className="py-2.5 px-3">Defense Evidence Snapshot</th>
                  <th className="py-2.5 px-3">Entitlement &amp; Commission</th>
                  <th className="py-2.5 pl-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E4D9]/60">
                {result.items.map((d) => (
                  <tr key={d.disputeId} className="hover:bg-[#F8F5EE]/50">
                    <td className="py-3 pr-3">
                      <div className="font-mono font-semibold text-[#193C32]">
                        {d.disputeId}
                      </div>
                      <div className="text-[11px] text-[#242923]/60">
                        Opened: {formatAdminTimestamp(d.openedAt)}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <Link
                        href={`/admin/users/${d.userId}`}
                        className="font-medium text-[#193C32] hover:underline"
                      >
                        {d.userEmail}
                      </Link>
                      <div className="text-[11px] text-[#242923]/60">
                        Purchase:{" "}
                        <AdminCopyId
                          value={d.purchaseId}
                          href={`/admin/purchases/${d.purchaseId}`}
                          prefixChars={6}
                        />
                      </div>
                    </td>
                    <td className="py-3 px-3 font-bold text-[#193C32]">
                      {formatMinorUnits(d.disputedAmountSubunits, d.currency)}
                      <div className="text-[10px] font-normal text-[#242923]/60">
                        {d.currency}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <AdminStatusBadge status={d.status} />
                      <div className="text-[11px] font-mono text-[#242923]/70 mt-1">
                        {d.reasonCode}
                      </div>
                      {d.adminNotes && (
                        <div className="text-[11px] text-[#242923]/80 mt-0.5 max-w-xs">
                          Note: {d.adminNotes}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-[11px] text-[#242923]/80">
                      {!d.evidence ? (
                        <span className="text-[#242923]/40">
                          No evidence snapshot
                        </span>
                      ) : (
                        <div className="space-y-0.5">
                          <div>
                            Terms: <code>{d.evidence.termsVersionAccepted}</code>{" "}
                            / Refund:{" "}
                            <code>{d.evidence.refundPolicyVersionAccepted}</code>
                          </div>
                          <div>
                            Activated:{" "}
                            {d.evidence.extensionActivatedAt
                              ? formatAdminTimestamp(
                                  d.evidence.extensionActivatedAt
                                )
                              : "Not activated"}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-[11px]">
                      <div>
                        Entitlement:{" "}
                        <strong>{d.entitlementStatus || "none"}</strong> (
                        {d.entitlementRestrictions.join(", ") || "none"})
                      </div>
                      {d.commissionImpact ? (
                        <div className="mt-0.5 text-[#242923]/80">
                          Commission: <strong>{d.commissionImpact.status}</strong>{" "}
                          (
                          {formatMinorUnits(
                            d.commissionImpact.amountSubunits,
                            d.commissionImpact.currency
                          )}
                          {d.commissionImpact.isDisputedHold ? " · Held" : ""})
                        </div>
                      ) : (
                        <div className="text-[#242923]/50">
                          No referral commission
                        </div>
                      )}
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5 flex-wrap">
                        {["open", "under_review"].includes(d.status) && (
                          <>
                            <AdminActionTrigger
                              buttonLabel="Update Notes / Status"
                              buttonVariant="secondary"
                              modalTitle="Update Dispute Case Notes"
                              modalDescription={`Update internal investigation notes or mark dispute ${d.disputeId} under review.`}
                              payload={{
                                actionType: "dispute.update_notes",
                                purchaseId: d.purchaseId,
                              }}
                              initialExtraState={{
                                adminNotes: d.adminNotes || "",
                                markUnderReview: true,
                              }}
                              fields={[
                                {
                                  name: "adminNotes",
                                  label: "Case Notes / Evidence Summary",
                                  type: "textarea",
                                  required: true,
                                  minLength: 3,
                                  rows: 2,
                                  placeholder:
                                    "Enter internal investigation notes...",
                                },
                              ]}
                            />
                            <AdminActionTrigger
                              buttonLabel="Resolve Won"
                              buttonVariant="primary"
                              modalTitle="Resolve Dispute as Won"
                              modalDescription={`Mark dispute ${d.disputeId} as WON. Removes 'dispute_open' restriction from the entitlement (restoring active access if no other restriction exists) and releases any referral commission dispute hold.`}
                              payload={{
                                actionType: "dispute.resolve_won",
                                purchaseId: d.purchaseId,
                              }}
                            />
                            <AdminActionTrigger
                              buttonLabel="Resolve Withdrawn"
                              buttonVariant="secondary"
                              modalTitle="Resolve Dispute as Withdrawn"
                              modalDescription={`Mark dispute ${d.disputeId} as WITHDRAWN by customer. Restores entitlement if no other restriction exists and releases commission hold.`}
                              payload={{
                                actionType: "dispute.resolve_withdrawn",
                                purchaseId: d.purchaseId,
                              }}
                            />
                            <AdminActionTrigger
                              buttonLabel="Resolve Lost"
                              buttonVariant="danger"
                              modalTitle="Resolve Dispute as Chargeback Lost"
                              modalDescription={`Mark dispute ${d.disputeId} as LOST. Permanently revokes the entitlement, cancels unpaid commission, or records a post-payout commission adjustment if the commission was already paid.`}
                              payload={{
                                actionType: "dispute.resolve_lost",
                                purchaseId: d.purchaseId,
                              }}
                            />
                          </>
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
          basePath="/admin/disputes"
          currentPage={result.page}
          totalPages={result.totalPages}
          totalItems={result.total}
          searchParamsRecord={searchParamsRecord}
        />
      </div>
    </div>
  );
}
