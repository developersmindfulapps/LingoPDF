import React from "react";
import Link from "next/link";
import { verifyServerAdminPageAccess } from "@/lib/auth/adminServer";
import {
  formatAdminTimestamp,
  formatSubunitsWithCode,
  getAdminOverviewData,
  overviewPeriodSchema,
} from "@/lib/admin/services";
import {
  AdminCopyId,
  AdminEmptyState,
  AdminStatusBadge,
} from "@/components/admin/AdminUi";

export const instant = false;

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await verifyServerAdminPageAccess();
  if (!auth.authorized) {
    return null;
  }

  const sp = await searchParams;
  const rawPeriod = Array.isArray(sp.period) ? sp.period[0] : sp.period;
  const period = overviewPeriodSchema.safeParse(rawPeriod).data || "30d";
  const overview = await getAdminOverviewData(auth.db, period);
  const { metrics } = overview;

  const periodLabels: Record<string, string> = {
    "7d": "Last 7 Days",
    "30d": "Last 30 Days",
    "90d": "Last 90 Days",
    all: "All Time",
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Time Period Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#193C32]">
            Operations Overview
          </h1>
          <p className="text-xs sm:text-sm text-[#242923]/75">
            Live database-backed commercial, licensing, referral, and audit
            telemetry. Currencies (INR, USD, EUR) are strictly segregated.
          </p>
        </div>

        <div
          className="inline-flex items-center rounded-xl border border-[#E8E4D9] bg-white p-1"
          role="group"
          aria-label="Select overview time period"
        >
          {(["7d", "30d", "90d", "all"] as const).map((pKey) => {
            const active = period === pKey;
            return (
              <Link
                key={pKey}
                href={`/admin?period=${pKey}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  active
                    ? "bg-[#193C32] text-white"
                    : "text-[#242923]/75 hover:bg-[#E8E4D9]/50"
                }`}
              >
                {periodLabels[pKey]}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Operational Alerts */}
      {overview.alerts.length > 0 && (
        <section aria-label="Operational Alerts" className="space-y-2.5">
          {overview.alerts.map((alert) => {
            const borderColors =
              alert.severity === "critical"
                ? "border-red-300 bg-red-50/90 text-red-950"
                : alert.severity === "warning"
                  ? "border-amber-300 bg-amber-50/90 text-amber-950"
                  : "border-[#E8E4D9] bg-white text-[#242923]";
            return (
              <div
                key={alert.id}
                className={`rounded-xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${borderColors}`}
              >
                <div>
                  <div className="font-heading text-sm font-bold">
                    {alert.title}
                  </div>
                  <p className="text-xs opacity-85">{alert.message}</p>
                </div>
                <Link
                  href={alert.href}
                  className="shrink-0 inline-flex items-center px-3 py-1.5 rounded-lg bg-[#193C32] text-white text-xs font-semibold hover:bg-[#122B24]"
                >
                  Inspect Queue →
                </Link>
              </div>
            );
          })}
        </section>
      )}

      {/* Primary KPI Grid */}
      <section aria-label="Key Performance Indicators">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Users KPI */}
          <div className="rounded-xl bg-white border border-[#E8E4D9] p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#242923]/60">
                Registered Users
              </span>
              <Link
                href="/admin/users"
                className="text-xs font-semibold text-[#193C32] hover:underline"
              >
                Manage
              </Link>
            </div>
            <div className="font-heading text-2xl font-bold text-[#193C32]">
              {metrics.totalUsers}
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-[#242923]/75">
              <span>Verified: <strong>{metrics.verifiedUsers}</strong></span>
              <span>•</span>
              <span>New ({periodLabels[period]}): <strong>{metrics.newUsersInPeriod}</strong></span>
              <span>•</span>
              <span>Suspended: <strong>{metrics.suspendedUsers}</strong></span>
            </div>
          </div>

          {/* Purchases KPI */}
          <div className="rounded-xl bg-white border border-[#E8E4D9] p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#242923]/60">
                Purchases ({periodLabels[period]})
              </span>
              <Link
                href="/admin/purchases"
                className="text-xs font-semibold text-[#193C32] hover:underline"
              >
                View All
              </Link>
            </div>
            <div className="font-heading text-2xl font-bold text-[#193C32]">
              {metrics.totalPurchases}
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-[#242923]/75">
              <span>Captured: <strong>{metrics.capturedPurchasesCount}</strong></span>
              <span>•</span>
              <span>Failed: <strong>{metrics.failedPurchasesCount}</strong></span>
            </div>
          </div>

          {/* Entitlements KPI */}
          <div className="rounded-xl bg-white border border-[#E8E4D9] p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#242923]/60">
                Entitlements
              </span>
              <Link
                href="/admin/entitlements"
                className="text-xs font-semibold text-[#193C32] hover:underline"
              >
                Inspect
              </Link>
            </div>
            <div className="font-heading text-2xl font-bold text-[#193C32]">
              {metrics.activeEntitlements}{" "}
              <span className="text-xs font-normal text-[#242923]/70">
                active
              </span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-[#242923]/75">
              <span>Suspended: <strong>{metrics.suspendedEntitlements}</strong></span>
              <span>•</span>
              <span>Revoked: <strong>{metrics.revokedEntitlements}</strong></span>
            </div>
          </div>

          {/* Refunds & Disputes Queue KPI */}
          <div className="rounded-xl bg-white border border-[#E8E4D9] p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#242923]/60">
                Refunds &amp; Disputes
              </span>
              <Link
                href="/admin/refunds"
                className="text-xs font-semibold text-[#193C32] hover:underline"
              >
                Queues
              </Link>
            </div>
            <div className="font-heading text-2xl font-bold text-[#193C32]">
              {metrics.pendingRefundRequestsCount + metrics.openDisputesCount}{" "}
              <span className="text-xs font-normal text-[#242923]/70">
                open items
              </span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-[#242923]/75">
              <span>Pending refunds: <strong>{metrics.pendingRefundRequestsCount}</strong></span>
              <span>•</span>
              <span>Open disputes: <strong>{metrics.openDisputesCount}</strong></span>
            </div>
          </div>
        </div>
      </section>

      {/* Currency-Segregated Gross Captured Revenue & Referral/Commission Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gross Captured Revenue by Currency */}
        <section
          aria-label="Gross Captured Revenue by Currency"
          className="lg:col-span-2 rounded-xl bg-white border border-[#E8E4D9] p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading text-base font-bold text-[#193C32]">
                Gross Captured Revenue by Currency ({periodLabels[period]})
              </h2>
              <p className="text-xs text-[#242923]/70">
                INR, USD, and EUR are accounted strictly in their native minor
                units without cross-currency aggregation.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(["INR", "USD", "EUR"] as const).map((cur) => (
              <div
                key={cur}
                className="rounded-xl bg-[#F8F5EE] border border-[#E8E4D9] p-3.5 space-y-1"
              >
                <div className="text-xs font-semibold text-[#242923]/70">
                  {cur} Gross Captured
                </div>
                <div className="font-heading text-xl font-bold text-[#193C32]">
                  {formatSubunitsWithCode(
                    metrics.grossCapturedRevenueByCurrency[cur],
                    cur
                  )}
                </div>
                <div className="text-[11px] text-[#242923]/65">
                  Net Retained:{" "}
                  {formatSubunitsWithCode(
                    metrics.netRetainedRevenueByCurrency[cur],
                    cur
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Revenue Over Time Breakdown */}
          <div className="pt-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#242923]/70 mb-2">
              Captured Revenue Over Time (Daily Breakdown by Currency)
            </h3>
            {overview.revenueSeries.length === 0 ? (
              <AdminEmptyState
                title="No captured revenue recorded in this period"
                description="Captured purchase transactions will appear here grouped by date and currency."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E8E4D9] text-[#242923]/70">
                      <th className="py-2 pr-3 font-semibold">Date (UTC)</th>
                      <th className="py-2 px-3 font-semibold text-right">
                        Purchases
                      </th>
                      <th className="py-2 px-3 font-semibold text-right">
                        INR Revenue
                      </th>
                      <th className="py-2 px-3 font-semibold text-right">
                        USD Revenue
                      </th>
                      <th className="py-2 pl-3 font-semibold text-right">
                        EUR Revenue
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E4D9]/60">
                    {overview.revenueSeries.map((row) => (
                      <tr key={row.date}>
                        <td className="py-2 pr-3 font-mono">{row.date}</td>
                        <td className="py-2 px-3 text-right font-semibold">
                          {row.count}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {formatSubunitsWithCode(row.INR, "INR")}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {formatSubunitsWithCode(row.USD, "USD")}
                        </td>
                        <td className="py-2 pl-3 text-right">
                          {formatSubunitsWithCode(row.EUR, "EUR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Referral, Commission & Payout Summary */}
        <section
          aria-label="Referrals, Commissions and Payouts Summary"
          className="rounded-xl bg-white border border-[#E8E4D9] p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-base font-bold text-[#193C32]">
              Referrals, Commissions &amp; Payouts
            </h2>
            <Link
              href="/admin/commissions"
              className="text-xs font-semibold text-[#193C32] hover:underline"
            >
              Ledger
            </Link>
          </div>

          <dl className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="rounded-lg bg-[#F8F5EE] p-2.5 border border-[#E8E4D9]">
              <dt className="text-[#242923]/65">Referral Profiles</dt>
              <dd className="font-heading text-base font-bold text-[#193C32]">
                {metrics.totalReferralProfiles}{" "}
                <span className="text-[11px] font-normal text-[#242923]/70">
                  ({metrics.activeReferralProfiles} active)
                </span>
              </dd>
            </div>
            <div className="rounded-lg bg-[#F8F5EE] p-2.5 border border-[#E8E4D9]">
              <dt className="text-[#242923]/65">Paid Redemptions</dt>
              <dd className="font-heading text-base font-bold text-[#193C32]">
                {metrics.totalSuccessfulRedemptions}
              </dd>
            </div>
            <div className="rounded-lg bg-[#F8F5EE] p-2.5 border border-[#E8E4D9]">
              <dt className="text-[#242923]/65">Pending / Eligible Comms</dt>
              <dd className="font-heading text-base font-bold text-[#193C32]">
                {metrics.pendingCommissionsCount} /{" "}
                {metrics.eligibleCommissionsCount}
              </dd>
            </div>
            <div className="rounded-lg bg-[#F8F5EE] p-2.5 border border-[#E8E4D9]">
              <dt className="text-[#242923]/65">Held / Pending Payouts</dt>
              <dd className="font-heading text-base font-bold text-[#193C32]">
                {metrics.heldCommissionsCount} / {metrics.pendingPayoutsCount}
              </dd>
            </div>
          </dl>

          <div className="space-y-2 pt-1 border-t border-[#E8E4D9]">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#242923]/70">
              Unpaid Commission Balances by Currency
            </div>
            {(["INR", "USD", "EUR"] as const).map((cur) => (
              <div
                key={cur}
                className="flex items-center justify-between text-xs py-1 border-b border-[#E8E4D9]/50 last:border-0"
              >
                <span className="font-semibold text-[#193C32]">{cur}</span>
                <div className="text-right space-x-2">
                  <span title="Eligible/Approved">
                    Elig:{" "}
                    <strong>
                      {formatSubunitsWithCode(
                        metrics.eligibleCommissionTotalsByCurrency[cur],
                        cur
                      )}
                    </strong>
                  </span>
                  <span className="text-[#242923]/40">|</span>
                  <span title="Pending 72h window">
                    Pend:{" "}
                    {formatSubunitsWithCode(
                      metrics.pendingCommissionTotalsByCurrency[cur],
                      cur
                    )}
                  </span>
                  <span className="text-[#242923]/40">|</span>
                  <span title="Dispute/Refund Hold">
                    Hold:{" "}
                    {formatSubunitsWithCode(
                      metrics.heldCommissionTotalsByCurrency[cur],
                      cur
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Recent Purchases & Recent Registrations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Purchases */}
        <section className="rounded-xl bg-white border border-[#E8E4D9] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-base font-bold text-[#193C32]">
              Recent Purchases
            </h2>
            <Link
              href="/admin/purchases"
              className="text-xs font-semibold text-[#193C32] hover:underline"
            >
              View All →
            </Link>
          </div>
          {overview.recentPurchases.length === 0 ? (
            <AdminEmptyState
              title="No purchases recorded yet"
              description="Real customer purchases will appear here once transactions are created."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E8E4D9] text-[#242923]/70">
                    <th className="py-2 pr-2">Purchase</th>
                    <th className="py-2 px-2">Customer</th>
                    <th className="py-2 px-2">Amount</th>
                    <th className="py-2 px-2">Status</th>
                    <th className="py-2 pl-2 text-right">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E4D9]/60">
                  {overview.recentPurchases.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2 pr-2">
                        <AdminCopyId
                          value={p.id}
                          href={`/admin/purchases/${p.id}`}
                        />
                      </td>
                      <td className="py-2 px-2 truncate max-w-[140px]">
                        <Link
                          href={`/admin/users/${p.userId}`}
                          className="hover:underline text-[#193C32]"
                        >
                          {p.userEmail}
                        </Link>
                      </td>
                      <td className="py-2 px-2 font-semibold">
                        {formatSubunitsWithCode(p.totalSubunits, p.currency)}
                      </td>
                      <td className="py-2 px-2">
                        <AdminStatusBadge status={p.status} />
                      </td>
                      <td className="py-2 pl-2 text-right text-[#242923]/70">
                        {formatAdminTimestamp(p.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Recent Registrations */}
        <section className="rounded-xl bg-white border border-[#E8E4D9] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-base font-bold text-[#193C32]">
              Recent Registrations
            </h2>
            <Link
              href="/admin/users"
              className="text-xs font-semibold text-[#193C32] hover:underline"
            >
              View All →
            </Link>
          </div>
          {overview.recentUsers.length === 0 ? (
            <AdminEmptyState
              title="No registered users in this period"
              description="Customer registrations will be listed here."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E8E4D9] text-[#242923]/70">
                    <th className="py-2 pr-2">Email</th>
                    <th className="py-2 px-2">Verified</th>
                    <th className="py-2 px-2">Status</th>
                    <th className="py-2 pl-2 text-right">Registered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E4D9]/60">
                  {overview.recentUsers.map((u) => (
                    <tr key={u.id}>
                      <td className="py-2 pr-2 font-medium">
                        <Link
                          href={`/admin/users/${u.id}`}
                          className="text-[#193C32] hover:underline"
                        >
                          {u.email}
                        </Link>
                      </td>
                      <td className="py-2 px-2">
                        <AdminStatusBadge
                          status={u.isEmailVerified ? "verified" : "unverified"}
                        />
                      </td>
                      <td className="py-2 px-2">
                        <AdminStatusBadge status={u.status} />
                      </td>
                      <td className="py-2 pl-2 text-right text-[#242923]/70">
                        {formatAdminTimestamp(u.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Recent Administrative Activity */}
      <section className="rounded-xl bg-white border border-[#E8E4D9] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading text-base font-bold text-[#193C32]">
              Recent Administrative Activity
            </h2>
            <p className="text-xs text-[#242923]/70">
              Latest entries from the append-only{" "}
              <code className="font-mono">admin_audit_logs</code> collection.
            </p>
          </div>
          <Link
            href="/admin/audit-logs"
            className="text-xs font-semibold text-[#193C32] hover:underline"
          >
            Full Audit Log →
          </Link>
        </div>

        {overview.recentAuditLogs.length === 0 ? (
          <AdminEmptyState
            title="No administrative actions logged yet"
            description="Privileged administrative operations will be recorded here automatically."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E8E4D9] text-[#242923]/70">
                  <th className="py-2 pr-3">Timestamp</th>
                  <th className="py-2 px-3">Administrator</th>
                  <th className="py-2 px-3">Action</th>
                  <th className="py-2 px-3">Target</th>
                  <th className="py-2 px-3">Outcome</th>
                  <th className="py-2 pl-3">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E4D9]/60">
                {overview.recentAuditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-2 pr-3 font-mono text-[11px] text-[#242923]/80">
                      {formatAdminTimestamp(log.createdAt)}
                    </td>
                    <td className="py-2 px-3 font-medium">{log.actorEmail}</td>
                    <td className="py-2 px-3 font-mono text-[#193C32]">
                      {log.action}
                    </td>
                    <td className="py-2 px-3">
                      <span className="text-[#242923]/65">
                        {log.targetCollection}:
                      </span>{" "}
                      <AdminCopyId value={log.targetId} />
                    </td>
                    <td className="py-2 px-3">
                      <AdminStatusBadge status={log.outcome} />
                    </td>
                    <td className="py-2 pl-3 text-[#242923]/80 max-w-xs truncate">
                      {log.reason || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
