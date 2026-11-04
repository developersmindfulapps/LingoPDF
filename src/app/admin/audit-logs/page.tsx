import React from "react";
import Link from "next/link";
import { verifyServerAdminPageAccess } from "@/lib/auth/adminServer";
import {
  listAdminAuditLogs,
  formatAdminTimestamp,
} from "@/lib/admin/services";
import {
  AdminStatusBadge,
  AdminCopyId,
  AdminEmptyState,
  AdminPagination,
} from "@/components/admin/AdminUi";
import { COLLECTION_NAMES } from "@/lib/db/models";

export const instant = false;

export default async function AdminAuditLogsPage({
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
  const actorEmail =
    typeof resolvedParams.actorEmail === "string"
      ? resolvedParams.actorEmail
      : "";
  const actionFilter =
    typeof resolvedParams.actionFilter === "string"
      ? resolvedParams.actionFilter
      : "";
  const targetCollection =
    typeof resolvedParams.targetCollection === "string"
      ? resolvedParams.targetCollection
      : "all";
  const outcome =
    typeof resolvedParams.outcome === "string"
      ? resolvedParams.outcome
      : "all";

  const result = await listAdminAuditLogs(db, {
    page,
    limit: 25,
    q,
    actorEmail,
    actionFilter,
    targetCollection,
    outcome,
  });

  const searchParamsRecord: Record<string, string | undefined> = {
    q: q || undefined,
    actorEmail: actorEmail || undefined,
    actionFilter: actionFilter || undefined,
    targetCollection: targetCollection !== "all" ? targetCollection : undefined,
    outcome: outcome !== "all" ? outcome : undefined,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#193C32]">
            Append-Only Administrative Audit Log
          </h1>
          <p className="text-xs sm:text-sm text-[#242923]/70 mt-1">
            Immutable operational ledger of all administrative actions, actors,
            target records, outcomes, and sanitized before/after metadata.
          </p>
        </div>
        <div className="rounded-lg bg-[#E8E4D9]/70 border border-[#d6d0c0] px-3.5 py-2 text-xs text-[#193C32] max-w-md">
          <strong>Immutability Guarantee:</strong> The{" "}
          <code>admin_audit_logs</code> collection is wrapped by{" "}
          <code>createAppendOnlyAuditCollection</code>, which blocks{" "}
          <code>update*</code>, <code>delete*</code>,{" "}
          <code>findOneAndUpdate</code>, <code>findOneAndDelete</code>,{" "}
          <code>bulkWrite</code>, and <code>drop</code>. No edit or delete UI
          exists.
        </div>
      </div>

      {/* Filter Bar */}
      <form
        method="GET"
        action="/admin/audit-logs"
        className="rounded-xl border border-[#E8E4D9] bg-white p-4 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3"
      >
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#242923]/70 mb-1">
            Keyword / Correlation ID
          </label>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Target ID, reason, correlation ID…"
            className="w-full rounded-lg border border-[#E8E4D9] bg-[#F8F5EE]/50 px-3 py-1.5 text-xs text-[#242923]"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#242923]/70 mb-1">
            Actor Email
          </label>
          <input
            type="text"
            name="actorEmail"
            defaultValue={actorEmail}
            placeholder="admin@lingopdf.in"
            className="w-full rounded-lg border border-[#E8E4D9] bg-[#F8F5EE]/50 px-3 py-1.5 text-xs text-[#242923]"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#242923]/70 mb-1">
            Action Prefix
          </label>
          <input
            type="text"
            name="actionFilter"
            defaultValue={actionFilter}
            placeholder="user., entitlement., refund.…"
            className="w-full rounded-lg border border-[#E8E4D9] bg-[#F8F5EE]/50 px-3 py-1.5 text-xs text-[#242923]"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#242923]/70 mb-1">
            Target Collection
          </label>
          <select
            name="targetCollection"
            defaultValue={targetCollection}
            className="w-full rounded-lg border border-[#E8E4D9] bg-white px-2.5 py-1.5 text-xs text-[#242923]"
          >
            <option value="all">All Collections</option>
            {Object.values(COLLECTION_NAMES).map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#242923]/70 mb-1">
            Outcome
          </label>
          <select
            name="outcome"
            defaultValue={outcome}
            className="w-full rounded-lg border border-[#E8E4D9] bg-white px-2.5 py-1.5 text-xs text-[#242923]"
          >
            <option value="all">All Outcomes</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
          </select>
        </div>

        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="px-4 py-1.5 rounded-lg bg-[#193C32] text-white text-xs font-semibold hover:bg-[#122B24] cursor-pointer"
          >
            Filter
          </button>
          <Link
            href="/admin/audit-logs"
            className="px-3 py-1.5 rounded-lg border border-[#E8E4D9] bg-[#F8F5EE] text-xs font-medium text-[#242923] hover:bg-[#E8E4D9]/50"
          >
            Reset
          </Link>
        </div>
      </form>

      {/* Audit Log Entries */}
      <div className="rounded-xl border border-[#E8E4D9] bg-white p-5 shadow-xs">
        {result.items.length === 0 ? (
          <AdminEmptyState
            title="No audit log entries match your filters"
            description="Every sensitive administrative action is recorded here automatically."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E8E4D9] text-[#242923]/60 uppercase">
                  <th className="py-2.5 pr-3">Audit ID &amp; Timestamp</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Actor</th>
                  <th className="py-2.5 px-3">Target</th>
                  <th className="py-2.5 px-3">Outcome</th>
                  <th className="py-2.5 pl-3">Reason &amp; Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E4D9]/60">
                {result.items.map((a) => (
                  <tr key={a.id} className="hover:bg-[#F8F5EE]/50 align-top">
                    <td className="py-3 pr-3">
                      <AdminCopyId value={a.id} />
                      <div className="text-[11px] text-[#242923]/60 mt-0.5">
                        {formatAdminTimestamp(a.createdAt)}
                      </div>
                      <div className="text-[10px] font-mono text-[#242923]/50">
                        Corr: {a.correlationId.slice(0, 12)}…
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono font-semibold text-[#193C32]">
                      {a.action}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-[#193C32]">
                        {a.actorEmail}
                      </div>
                      <div className="text-[10px] text-[#242923]/60">
                        Role: {a.actorRole} · IP Hash:{" "}
                        {a.ipAddressHash ? `${a.ipAddressHash.slice(0, 8)}…` : "—"}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px]">
                      <div>{a.targetCollection}</div>
                      <AdminCopyId value={a.targetId} />
                    </td>
                    <td className="py-3 px-3">
                      <AdminStatusBadge status={a.outcome} />
                    </td>
                    <td className="py-3 pl-3 max-w-md">
                      <div className="text-[#242923] font-medium">
                        {a.reason}
                      </div>
                      {Object.keys(a.metadata || {}).length > 0 && (
                        <details className="mt-1">
                          <summary className="text-[11px] font-semibold text-[#193C32] cursor-pointer">
                            Inspect Sanitized Metadata
                          </summary>
                          <pre className="mt-1 rounded bg-[#F8F5EE] border border-[#E8E4D9] p-2 text-[10px] font-mono overflow-x-auto text-[#242923]">
                            {JSON.stringify(a.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <AdminPagination
          basePath="/admin/audit-logs"
          currentPage={result.page}
          totalPages={result.totalPages}
          totalItems={result.total}
          searchParamsRecord={searchParamsRecord}
        />
      </div>
    </div>
  );
}
