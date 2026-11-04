import React from "react";
import Link from "next/link";
import { verifyServerAdminPageAccess } from "@/lib/auth/adminServer";
import {
  listAdminReferrals,
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

export default async function AdminReferralsPage({
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
  const riskFilter =
    typeof resolvedParams.riskFilter === "string"
      ? resolvedParams.riskFilter
      : "all";

  const result = await listAdminReferrals(db, {
    page,
    limit: 20,
    q,
    status,
    riskFilter,
  });

  const searchParamsRecord: Record<string, string | undefined> = {
    q: q || undefined,
    status: status !== "all" ? status : undefined,
    riskFilter: riskFilter !== "all" ? riskFilter : undefined,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#193C32]">
            Referral Profiles &amp; 50-Conversion Cap Management
          </h1>
          <p className="text-xs sm:text-sm text-[#242923]/70 mt-1">
            Monitor referrer profiles, atomic 50-redemption capacity counters,
            currency-segregated commission balances, and risk review flags.
          </p>
        </div>
        <div className="rounded-lg bg-[#E8E4D9]/70 border border-[#d6d0c0] px-3.5 py-2 text-xs text-[#193C32] max-w-md">
          <strong>50-Referral Cap Invariant:</strong>{" "}
          <code>successfulConversionsCount + pendingReservedCount &lt;= 50</code>
          . Failed/abandoned checkouts release their pending slot; refunded or
          disputed captured purchases never restore referral capacity.
        </div>
      </div>

      {/* Filter Bar */}
      <form
        method="GET"
        action="/admin/referrals"
        className="rounded-xl border border-[#E8E4D9] bg-white p-4 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
      >
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#242923]/70 mb-1">
            Search Referral Code / User Email
          </label>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Referral code, referrer email, user ID…"
            className="w-full rounded-lg border border-[#E8E4D9] bg-[#F8F5EE]/50 px-3 py-1.5 text-xs text-[#242923]"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#242923]/70 mb-1">
            Profile Status
          </label>
          <select
            name="status"
            defaultValue={status}
            className="w-full rounded-lg border border-[#E8E4D9] bg-white px-2.5 py-1.5 text-xs text-[#242923]"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#242923]/70 mb-1">
            Risk Monitoring Flag
          </label>
          <select
            name="riskFilter"
            defaultValue={riskFilter}
            className="w-full rounded-lg border border-[#E8E4D9] bg-white px-2.5 py-1.5 text-xs text-[#242923]"
          >
            <option value="all">All Profiles</option>
            <option value="flagged">Flagged for Risk Review</option>
            <option value="normal">No Risk Flag</option>
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
            href="/admin/referrals"
            className="px-3 py-1.5 rounded-lg border border-[#E8E4D9] bg-[#F8F5EE] text-xs font-medium text-[#242923] hover:bg-[#E8E4D9]/50"
          >
            Reset
          </Link>
        </div>
      </form>

      {/* Referrals Table */}
      <div className="rounded-xl border border-[#E8E4D9] bg-white p-5 shadow-xs">
        {result.items.length === 0 ? (
          <AdminEmptyState
            title="No referral profiles found"
            description="No referral profiles match your current filter selection."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E8E4D9] text-[#242923]/60 uppercase">
                  <th className="py-2.5 pr-3">Referrer &amp; Code</th>
                  <th className="py-2.5 px-3">Status &amp; Risk</th>
                  <th className="py-2.5 px-3">50-Cap Utilization</th>
                  <th className="py-2.5 px-3">Eligible Commissions</th>
                  <th className="py-2.5 px-3">Pending / Held</th>
                  <th className="py-2.5 px-3">Payout Method</th>
                  <th className="py-2.5 pl-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E4D9]/60">
                {result.items.map((rp) => (
                  <tr key={rp.id} className="hover:bg-[#F8F5EE]/50">
                    <td className="py-3 pr-3">
                      <Link
                        href={`/admin/users/${rp.userId}`}
                        className="font-semibold text-[#193C32] hover:underline"
                      >
                        {rp.referrerEmail}
                      </Link>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-[#E8E4D9] font-mono text-[11px] font-bold text-[#193C32]">
                          {rp.referralCode}
                        </span>
                        <AdminCopyId value={rp.referralLink} prefixChars={16} />
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-col items-start gap-1">
                        <AdminStatusBadge status={rp.status} />
                        {rp.riskReviewRequired && (
                          <span className="px-2 py-0.5 rounded bg-red-50 border border-red-200 text-[10px] font-semibold text-red-900">
                            Risk Review: {rp.riskHoldReason || "Flagged"}
                          </span>
                        )}
                        {rp.suspensionReason && (
                          <div className="text-[11px] text-red-700">
                            Reason: {rp.suspensionReason}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-[#193C32]">
                        {rp.successfulConversionsCount} / {rp.maxReferralsCap}{" "}
                        captured
                      </div>
                      <div className="text-[11px] text-[#242923]/70">
                        Reserved: {rp.pendingReservedCount} · Remaining:{" "}
                        <strong>{rp.remainingCapacity}</strong>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      {(["INR", "USD", "EUR"] as const).map((cur) => (
                        <div key={cur} className="text-[11px]">
                          <span className="text-[#242923]/60">{cur}:</span>{" "}
                          <strong className="text-emerald-800">
                            {formatMinorUnits(rp.eligibleByCurrency[cur], cur)}
                          </strong>
                        </div>
                      ))}
                    </td>
                    <td className="py-3 px-3">
                      {(["INR", "USD", "EUR"] as const).map((cur) => (
                        <div key={cur} className="text-[11px]">
                          <span className="text-[#242923]/60">{cur}:</span>{" "}
                          <span>
                            {formatMinorUnits(rp.pendingByCurrency[cur], cur)}{" "}
                            pend
                          </span>
                          {rp.heldByCurrency[cur] > 0 && (
                            <span className="text-red-700 ml-1">
                              ({formatMinorUnits(rp.heldByCurrency[cur], cur)}{" "}
                              held)
                            </span>
                          )}
                        </div>
                      ))}
                    </td>
                    <td className="py-3 px-3 text-[11px]">
                      {rp.payoutMethod && rp.payoutMethod !== "unset" ? (
                        <div className="font-semibold uppercase text-[#193C32]">
                          {rp.payoutMethod.replace(/_/g, " ")}
                        </div>
                      ) : (
                        <span className="text-[#242923]/40">
                          Not configured
                        </span>
                      )}
                      <div className="text-[10px] text-[#242923]/50 mt-0.5">
                        Created: {formatAdminTimestamp(rp.createdAt)}
                      </div>
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5 flex-wrap">
                        {rp.status === "active" ? (
                          <AdminActionTrigger
                            buttonLabel="Suspend Referrer"
                            buttonVariant="danger"
                            modalTitle="Suspend Referral Profile"
                            modalDescription={`Suspend referral code ${rp.referralCode} (${rp.referrerEmail}). New referral reservations with this code will be blocked while suspended.`}
                            payload={{
                              actionType: "referral.suspend",
                              referralProfileId: rp.id,
                            }}
                          />
                        ) : (
                          <AdminActionTrigger
                            buttonLabel="Reinstate Referrer"
                            buttonVariant="primary"
                            modalTitle="Reinstate Referral Profile"
                            modalDescription={`Reinstate referral code ${rp.referralCode} (${rp.referrerEmail}) to active status.`}
                            payload={{
                              actionType: "referral.reinstate",
                              referralProfileId: rp.id,
                            }}
                          />
                        )}

                        {rp.riskReviewRequired ? (
                          <AdminActionTrigger
                            buttonLabel="Clear Risk Hold"
                            buttonVariant="secondary"
                            modalTitle="Clear Automated Risk Hold"
                            modalDescription={`Clear the risk review hold on ${rp.referralCode} after manual inspection.`}
                            payload={{
                              actionType: "referral.override_risk",
                              referralProfileId: rp.id,
                              clearRiskHold: true,
                            }}
                          />
                        ) : (
                          <AdminActionTrigger
                            buttonLabel="Flag Risk Review"
                            buttonVariant="secondary"
                            modalTitle="Flag Referral Profile for Risk Review"
                            modalDescription={`Place a manual risk review flag on ${rp.referralCode} (${rp.referrerEmail}).`}
                            payload={{
                              actionType: "referral.override_risk",
                              referralProfileId: rp.id,
                              clearRiskHold: false,
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
          basePath="/admin/referrals"
          currentPage={result.page}
          totalPages={result.totalPages}
          totalItems={result.total}
          searchParamsRecord={searchParamsRecord}
        />
      </div>
    </div>
  );
}
