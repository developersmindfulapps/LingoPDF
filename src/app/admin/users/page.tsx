import React from "react";
import Link from "next/link";
import { verifyServerAdminPageAccess } from "@/lib/auth/adminServer";
import {
  adminUsersFilterSchema,
  formatAdminTimestamp,
  listAdminUsers,
} from "@/lib/admin/services";
import {
  AdminActionTrigger,
  AdminCopyId,
  AdminEmptyState,
  AdminPagination,
  AdminStatusBadge,
} from "@/components/admin/AdminUi";

export const instant = false;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await verifyServerAdminPageAccess();
  if (!auth.authorized) return null;

  const sp = await searchParams;
  const flatParams: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(sp)) {
    flatParams[k] = Array.isArray(v) ? v[0] : v;
  }

  const parsed = adminUsersFilterSchema.safeParse(flatParams);
  const filters = parsed.success
    ? parsed.data
    : {
        page: 1,
        limit: 20,
        q: "",
        status: "all" as const,
        verified: "all" as const,
        role: "all" as const,
        sort: "newest" as const,
      };

  const data = await listAdminUsers(auth.db, filters);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-[#193C32]">
          User Management
        </h1>
        <p className="text-xs sm:text-sm text-[#242923]/75">
          Inspect customer and administrator accounts, email verification status,
          purchase history, and license entitlements. Password hashes and auth
          tokens are never exposed.
        </p>
      </div>

      {/* Search & Filter Bar */}
      <form
        method="GET"
        action="/admin/users"
        className="rounded-xl bg-white border border-[#E8E4D9] p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end"
      >
        <div className="lg:col-span-2">
          <label
            htmlFor="users-q"
            className="block text-[11px] font-semibold uppercase tracking-wider text-[#242923]/70 mb-1"
          >
            Search Name, Email, or User ID
          </label>
          <input
            id="users-q"
            name="q"
            type="text"
            defaultValue={filters.q}
            placeholder="customer@example.com or 24-hex ID"
            className="w-full rounded-lg border border-[#E8E4D9] bg-[#F8F5EE]/60 px-3 py-1.5 text-xs sm:text-sm text-[#242923] focus:outline-none focus:ring-2 focus:ring-[#193C32]"
          />
        </div>

        <div>
          <label
            htmlFor="users-status"
            className="block text-[11px] font-semibold uppercase tracking-wider text-[#242923]/70 mb-1"
          >
            Account Status
          </label>
          <select
            id="users-status"
            name="status"
            defaultValue={filters.status}
            className="w-full rounded-lg border border-[#E8E4D9] bg-[#F8F5EE]/60 px-3 py-1.5 text-xs sm:text-sm text-[#242923]"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="users-verified"
            className="block text-[11px] font-semibold uppercase tracking-wider text-[#242923]/70 mb-1"
          >
            Email Verification
          </label>
          <select
            id="users-verified"
            name="verified"
            defaultValue={filters.verified}
            className="w-full rounded-lg border border-[#E8E4D9] bg-[#F8F5EE]/60 px-3 py-1.5 text-xs sm:text-sm text-[#242923]"
          >
            <option value="all">All</option>
            <option value="verified">Verified Only</option>
            <option value="unverified">Unverified Only</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="users-sort"
            className="block text-[11px] font-semibold uppercase tracking-wider text-[#242923]/70 mb-1"
          >
            Sort By
          </label>
          <select
            id="users-sort"
            name="sort"
            defaultValue={filters.sort}
            className="w-full rounded-lg border border-[#E8E4D9] bg-[#F8F5EE]/60 px-3 py-1.5 text-xs sm:text-sm text-[#242923]"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="email_asc">Email (A → Z)</option>
            <option value="email_desc">Email (Z → A)</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="px-4 py-1.5 rounded-lg bg-[#193C32] text-white text-xs font-semibold hover:bg-[#122B24] cursor-pointer"
          >
            Apply Filters
          </button>
          <Link
            href="/admin/users"
            className="px-3 py-1.5 rounded-lg border border-[#E8E4D9] bg-white text-xs font-semibold text-[#242923] hover:bg-[#E8E4D9]/40"
          >
            Reset
          </Link>
        </div>
      </form>

      {/* Users Table */}
      <div className="rounded-xl bg-white border border-[#E8E4D9] p-5 space-y-4">
        {data.items.length === 0 ? (
          <AdminEmptyState
            title="No matching user accounts"
            description="No users matched your search or filter criteria."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E8E4D9] text-[#242923]/70">
                  <th className="py-2.5 pr-3">User ID</th>
                  <th className="py-2.5 px-3">Email &amp; Name</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Verified</th>
                  <th className="py-2.5 px-3">Account Status</th>
                  <th className="py-2.5 px-3 text-right">Purchases</th>
                  <th className="py-2.5 px-3">Entitlements</th>
                  <th className="py-2.5 px-3">Registered</th>
                  <th className="py-2.5 pl-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E4D9]/60">
                {data.items.map((u) => (
                  <tr key={u.id} className="hover:bg-[#F8F5EE]/50">
                    <td className="py-2.5 pr-3">
                      <AdminCopyId value={u.id} href={`/admin/users/${u.id}`} />
                    </td>
                    <td className="py-2.5 px-3">
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="font-semibold text-[#193C32] hover:underline block"
                      >
                        {u.email}
                      </Link>
                      {u.name && (
                        <span className="text-[11px] text-[#242923]/65">
                          {u.name}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <AdminStatusBadge status={u.role} />
                    </td>
                    <td className="py-2.5 px-3">
                      <AdminStatusBadge
                        status={u.isEmailVerified ? "verified" : "unverified"}
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <AdminStatusBadge status={u.status} />
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      {u.purchaseCounts.captured} / {u.purchaseCounts.total}
                    </td>
                    <td className="py-2.5 px-3 text-[11px]">
                      <span className="text-emerald-800 font-semibold">
                        {u.entitlementSummary.active} act
                      </span>{" "}
                      •{" "}
                      <span className="text-amber-800">
                        {u.entitlementSummary.suspended} susp
                      </span>{" "}
                      •{" "}
                      <span className="text-red-800">
                        {u.entitlementSummary.revoked} rev
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[#242923]/70">
                      {formatAdminTimestamp(u.createdAt)}
                    </td>
                    <td className="py-2.5 pl-3 text-right space-x-1.5">
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="inline-flex items-center px-2.5 py-1 rounded-lg border border-[#E8E4D9] bg-white text-xs font-semibold text-[#193C32] hover:bg-[#E8E4D9]/40"
                      >
                        Inspect
                      </Link>
                      {u.id !== auth.context.userId.toString() && (
                        <>
                          {u.status === "active" ? (
                            <AdminActionTrigger
                              buttonLabel="Suspend"
                              buttonVariant="danger"
                              modalTitle={`Suspend User Account (${u.email})`}
                              modalDescription="Suspending an account revokes active web login sessions and blocks account login. Account suspension is distinct from entitlement suspension and will not overwrite entitlement restriction flags."
                              payload={{
                                actionType: "user.suspend",
                                userId: u.id,
                              }}
                            />
                          ) : (
                            <AdminActionTrigger
                              buttonLabel="Restore"
                              buttonVariant="primary"
                              modalTitle={`Restore User Account (${u.email})`}
                              modalDescription="Restoring this user account re-enables web sign-in. Independent license entitlement restrictions remain untouched."
                              payload={{
                                actionType: "user.restore",
                                userId: u.id,
                              }}
                            />
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <AdminPagination
          basePath="/admin/users"
          currentPage={data.page}
          totalPages={data.totalPages}
          totalItems={data.total}
          searchParamsRecord={flatParams}
        />
      </div>
    </div>
  );
}
