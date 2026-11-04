import React from "react";
import Link from "next/link";
import { verifyServerAdminPageAccess } from "@/lib/auth/adminServer";
import {
  listAdminEntitlements,
  formatAdminTimestamp,
} from "@/lib/admin/services";
import {
  AdminStatusBadge,
  AdminCopyId,
  AdminEmptyState,
  AdminPagination,
  AdminActionTrigger,
} from "@/components/admin/AdminUi";
import { siteConfig } from "@/lib/siteConfig";

export const instant = false;

export default async function AdminEntitlementsPage({
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
  const productSlug =
    typeof resolvedParams.productSlug === "string"
      ? resolvedParams.productSlug
      : "all";

  const result = await listAdminEntitlements(db, {
    page,
    limit: 20,
    q,
    status,
    productSlug,
  });

  const searchParamsRecord: Record<string, string | undefined> = {
    q: q || undefined,
    status: status !== "all" ? status : undefined,
    productSlug: productSlug !== "all" ? productSlug : undefined,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#193C32]">
            Entitlement Management
          </h1>
          <p className="text-xs sm:text-sm text-[#242923]/70 mt-1">
            Inspect per-language license entitlements, 1-device installation
            bindings, active restriction reasons, and execute support workflows.
          </p>
        </div>
        <div className="rounded-lg bg-[#E8E4D9]/70 border border-[#d6d0c0] px-3.5 py-2 text-xs text-[#193C32]">
          <strong>1-Device Policy:</strong> Each entitlement binds to at most 1
          active browser installation (`maxActiveDevices = 1`).
        </div>
      </div>

      {/* Filter Bar */}
      <form
        method="GET"
        action="/admin/entitlements"
        className="rounded-xl border border-[#E8E4D9] bg-white p-4 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3"
      >
        <div className="sm:col-span-2">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#242923]/70 mb-1">
            Search Entitlement / User Email / Purchase ID
          </label>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Entitlement ID, user email, installation hash…"
            className="w-full rounded-lg border border-[#E8E4D9] bg-[#F8F5EE]/50 px-3 py-1.5 text-xs text-[#242923]"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#242923]/70 mb-1">
            Entitlement Status
          </label>
          <select
            name="status"
            defaultValue={status}
            className="w-full rounded-lg border border-[#E8E4D9] bg-white px-2.5 py-1.5 text-xs text-[#242923]"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="revoked">Revoked</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#242923]/70 mb-1">
            Product Edition
          </label>
          <select
            name="productSlug"
            defaultValue={productSlug}
            className="w-full rounded-lg border border-[#E8E4D9] bg-white px-2.5 py-1.5 text-xs text-[#242923]"
          >
            <option value="all">All Editions</option>
            {siteConfig.products.map((prod) => (
              <option key={prod.id} value={prod.id}>
                {prod.languagePair} ({prod.id})
              </option>
            ))}
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
            href="/admin/entitlements"
            className="px-3 py-1.5 rounded-lg border border-[#E8E4D9] bg-[#F8F5EE] text-xs font-medium text-[#242923] hover:bg-[#E8E4D9]/50"
          >
            Reset
          </Link>
        </div>
      </form>

      {/* Entitlements Table */}
      <div className="rounded-xl border border-[#E8E4D9] bg-white p-5 shadow-xs">
        {result.items.length === 0 ? (
          <AdminEmptyState
            title="No entitlements match your filters"
            description="No license entitlement records were found for the selected criteria."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E8E4D9] text-[#242923]/60 uppercase">
                  <th className="py-2.5 pr-3">Entitlement</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3">Status &amp; Restrictions</th>
                  <th className="py-2.5 px-3">Device Binding</th>
                  <th className="py-2.5 px-3">Activation / Last Check</th>
                  <th className="py-2.5 pl-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E4D9]/60">
                {result.items.map((e) => (
                  <tr key={e.id} className="hover:bg-[#F8F5EE]/50">
                    <td className="py-3 pr-3">
                      <AdminCopyId value={e.id} />
                      <div className="text-[11px] text-[#242923]/60 mt-0.5">
                        Purchase:{" "}
                        <AdminCopyId
                          value={e.purchaseId}
                          href={`/admin/purchases/${e.purchaseId}`}
                          prefixChars={6}
                        />
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <Link
                        href={`/admin/users/${e.userId}`}
                        className="font-medium text-[#193C32] hover:underline"
                      >
                        {e.userEmail}
                      </Link>
                    </td>
                    <td className="py-3 px-3 font-medium text-[#193C32]">
                      {e.productSlug}
                    </td>
                    <td className="py-3 px-3">
                      <AdminStatusBadge status={e.status} />
                      {e.activeRestrictionReasons.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {e.activeRestrictionReasons.map((r) => (
                            <span
                              key={r}
                              className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-[10px] font-mono text-amber-900"
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      )}
                      {e.revocationReason && (
                        <div className="mt-1 text-[11px] text-red-700">
                          Revoked: {e.revocationReason}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px]">
                      {e.activeInstallationIdHash ? (
                        <div>
                          <span className="text-emerald-800 font-semibold">
                            Bound (1/{e.maxActiveDevices})
                          </span>
                          <div className="text-[#242923]/60">
                            {e.activeInstallationIdHash.slice(0, 12)}…
                          </div>
                        </div>
                      ) : (
                        <span className="text-[#242923]/50">
                          Unbound (0/{e.maxActiveDevices})
                        </span>
                      )}
                      {e.deviceReplacementCount > 0 && (
                        <div className="text-[10px] font-sans text-[#242923]/60">
                          Resets: {e.deviceReplacementCount}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-[11px] text-[#242923]/70">
                      <div>Bound: {formatAdminTimestamp(e.deviceBoundAt)}</div>
                      <div>
                        Verified: {formatAdminTimestamp(e.lastValidatedAt)}
                      </div>
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5 flex-wrap">
                        {e.status === "active" && (
                          <AdminActionTrigger
                            buttonLabel="Suspend"
                            buttonVariant="danger"
                            modalTitle="Suspend Entitlement"
                            modalDescription={`Add 'admin_suspended' restriction to entitlement ${e.id} (${e.productSlug}).`}
                            payload={{
                              actionType: "entitlement.suspend",
                              entitlementId: e.id,
                            }}
                          />
                        )}
                        {e.status === "suspended" && (
                          <AdminActionTrigger
                            buttonLabel="Restore"
                            buttonVariant="primary"
                            modalTitle="Restore Suspended Entitlement"
                            modalDescription={`Remove 'admin_suspended' restriction from ${e.id}. If refund or dispute restrictions remain, the entitlement stays suspended until those resolve.`}
                            payload={{
                              actionType: "entitlement.restore",
                              entitlementId: e.id,
                            }}
                          />
                        )}
                        {e.status !== "revoked" && (
                          <>
                            <AdminActionTrigger
                              buttonLabel="Replace Device"
                              buttonVariant="secondary"
                              modalTitle="Device Replacement Support Workflow"
                              modalDescription={`Clear the current browser installation binding on ${e.id} so ${e.userEmail} can activate a replacement device.`}
                              payload={{
                                actionType: "entitlement.replace_device",
                                entitlementId: e.id,
                              }}
                            />
                            <AdminActionTrigger
                              buttonLabel="Revoke"
                              buttonVariant="danger"
                              modalTitle="Permanently Revoke Entitlement"
                              modalDescription={`Permanently revoke entitlement ${e.id} (${e.productSlug}). Revoked entitlements cannot be restored.`}
                              payload={{
                                actionType: "entitlement.revoke",
                                entitlementId: e.id,
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
          basePath="/admin/entitlements"
          currentPage={result.page}
          totalPages={result.totalPages}
          totalItems={result.total}
          searchParamsRecord={searchParamsRecord}
        />
      </div>
    </div>
  );
}
