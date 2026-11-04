import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { verifyServerAdminPageAccess } from "@/lib/auth/adminServer";
import {
  formatAdminTimestamp,
  formatSubunitsWithCode,
  getAdminUserDetails,
} from "@/lib/admin/services";
import {
  AdminActionTrigger,
  AdminCopyId,
  AdminEmptyState,
  AdminStatusBadge,
} from "@/components/admin/AdminUi";

export const instant = false;

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const auth = await verifyServerAdminPageAccess();
  if (!auth.authorized) return null;

  const { id } = await params;
  const details = await getAdminUserDetails(auth.db, id);
  if (!details) {
    notFound();
  }

  const { user } = details;
  const isSelf = user.id === auth.context.userId.toString();

  return (
    <div className="space-y-6">
      {/* Header & Account Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-bold text-[#193C32]">
              {user.email}
            </h1>
            <AdminStatusBadge status={user.status} />
            <AdminStatusBadge status={user.role} />
          </div>
          <p className="text-xs sm:text-sm text-[#242923]/75 mt-1">
            User ID: <AdminCopyId value={user.id} prefixChars={24} /> •
            Registered: {formatAdminTimestamp(user.createdAt)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/users"
            className="px-3 py-1.5 rounded-lg border border-[#E8E4D9] bg-white text-xs font-semibold text-[#242923] hover:bg-[#E8E4D9]/40"
          >
            ← Back to Users
          </Link>
          {!isSelf && (
            <>
              {user.status === "active" ? (
                <AdminActionTrigger
                  buttonLabel="Suspend User Account"
                  buttonVariant="danger"
                  modalTitle={`Suspend Account: ${user.email}`}
                  modalDescription="Suspends web login access and revokes active sessions. License entitlements and financial records remain distinct and untouched."
                  payload={{
                    actionType: "user.suspend",
                    userId: user.id,
                  }}
                />
              ) : (
                <AdminActionTrigger
                  buttonLabel="Restore User Account"
                  buttonVariant="primary"
                  modalTitle={`Restore Account: ${user.email}`}
                  modalDescription="Restores account sign-in access. Does not automatically lift independent entitlement restrictions."
                  payload={{
                    actionType: "user.restore",
                    userId: user.id,
                  }}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Profile & Account Restrictions Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="rounded-xl bg-white border border-[#E8E4D9] p-5 space-y-3">
          <h2 className="font-heading text-base font-bold text-[#193C32]">
            Account Profile &amp; Security
          </h2>
          <dl className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-[#E8E4D9]/60">
              <dt className="text-[#242923]/65">Display Name</dt>
              <dd className="font-medium">{user.name || "—"}</dd>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E8E4D9]/60">
              <dt className="text-[#242923]/65">Email Verification</dt>
              <dd>
                <AdminStatusBadge
                  status={user.isEmailVerified ? "verified" : "unverified"}
                />
              </dd>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E8E4D9]/60">
              <dt className="text-[#242923]/65">Account Status</dt>
              <dd>
                <AdminStatusBadge status={user.status} />
              </dd>
            </div>
            {user.suspensionReason && (
              <div className="pt-1">
                <dt className="text-[#242923]/65">Account Suspension Reason</dt>
                <dd className="mt-1 rounded-lg bg-red-50 border border-red-200 p-2 text-red-900">
                  {user.suspensionReason} (at{" "}
                  {formatAdminTimestamp(user.suspendedAt)})
                </dd>
              </div>
            )}
          </dl>
        </section>

        {/* Referral Profile Summary */}
        <section className="lg:col-span-2 rounded-xl bg-white border border-[#E8E4D9] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-base font-bold text-[#193C32]">
              Referral Profile &amp; Activity
            </h2>
            {details.referralProfile && (
              <Link
                href={`/admin/referrals?q=${encodeURIComponent(details.referralProfile.referralCode)}`}
                className="text-xs font-semibold text-[#193C32] hover:underline"
              >
                Open in Referrals →
              </Link>
            )}
          </div>
          {!details.referralProfile ? (
            <AdminEmptyState
              title="No referral profile for this user"
              description="Referral profiles are provisioned only after a user completes a qualifying captured purchase."
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="rounded-lg bg-[#F8F5EE] p-3 border border-[#E8E4D9]">
                <div className="text-[#242923]/65">Referral Code</div>
                <div className="font-mono font-bold text-sm text-[#193C32] mt-0.5">
                  {details.referralProfile.referralCode}
                </div>
              </div>
              <div className="rounded-lg bg-[#F8F5EE] p-3 border border-[#E8E4D9]">
                <div className="text-[#242923]/65">Profile Status</div>
                <div className="mt-1">
                  <AdminStatusBadge status={details.referralProfile.status} />
                </div>
              </div>
              <div className="rounded-lg bg-[#F8F5EE] p-3 border border-[#E8E4D9]">
                <div className="text-[#242923]/65">Paid Redemptions</div>
                <div className="font-heading font-bold text-sm text-[#193C32] mt-0.5">
                  {details.referralProfile.successfulConversionsCount} /{" "}
                  {details.referralProfile.maxReferralsCap}
                </div>
              </div>
              <div className="rounded-lg bg-[#F8F5EE] p-3 border border-[#E8E4D9]">
                <div className="text-[#242923]/65">Remaining Capacity</div>
                <div className="font-heading font-bold text-sm text-[#193C32] mt-0.5">
                  {details.referralProfile.remainingCapacity}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Entitlements & Device Binding Section */}
      <section className="rounded-xl bg-white border border-[#E8E4D9] p-5 space-y-4">
        <div>
          <h2 className="font-heading text-base font-bold text-[#193C32]">
            License Entitlements &amp; 1-Device Activation Binding
          </h2>
          <p className="text-xs text-[#242923]/70">
            Independent restrictions (refund_pending, chargeback_open,
            admin_suspended) never overwrite one another. Device replacement
            clears the active installation hash so the user can bind a replacement
            device.
          </p>
        </div>

        {details.entitlements.length === 0 ? (
          <AdminEmptyState
            title="No entitlements found"
            description="Entitlements are created when a purchase is captured."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E8E4D9] text-[#242923]/70">
                  <th className="py-2 pr-2">Entitlement ID</th>
                  <th className="py-2 px-2">Edition</th>
                  <th className="py-2 px-2">Status</th>
                  <th className="py-2 px-2">Active Restrictions</th>
                  <th className="py-2 px-2">Device Binding</th>
                  <th className="py-2 px-2">Replacements</th>
                  <th className="py-2 pl-2 text-right">Support Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E4D9]/60">
                {details.entitlements.map((e) => (
                  <tr key={e.id}>
                    <td className="py-2.5 pr-2">
                      <AdminCopyId value={e.id} />
                    </td>
                    <td className="py-2.5 px-2 font-medium">{e.productSlug}</td>
                    <td className="py-2.5 px-2">
                      <AdminStatusBadge status={e.status} />
                    </td>
                    <td className="py-2.5 px-2">
                      {e.activeRestrictionReasons.length === 0 ? (
                        <span className="text-[#242923]/50">None</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {e.activeRestrictionReasons.map((r) => (
                            <AdminStatusBadge key={r} status={r} />
                          ))}
                        </div>
                      )}
                      {e.revocationReason && (
                        <div className="text-[11px] text-red-800 mt-0.5">
                          Revoked: {e.revocationReason}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-2">
                      {e.activeInstallationIdHash ? (
                        <div>
                          <AdminCopyId value={e.activeInstallationIdHash} />
                          <div className="text-[10px] text-[#242923]/60">
                            Bound: {formatAdminTimestamp(e.deviceBoundAt)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[#242923]/60">
                          Unbound (0 / {e.maxActiveDevices})
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-2 font-mono">
                      {e.deviceReplacementCount}
                    </td>
                    <td className="py-2.5 pl-2 text-right space-x-1.5">
                      {e.status !== "revoked" && (
                        <>
                          {!e.activeRestrictionReasons.includes(
                            "admin_suspended"
                          ) ? (
                            <AdminActionTrigger
                              buttonLabel="Suspend Entitlement"
                              buttonVariant="danger"
                              modalTitle="Suspend License Entitlement"
                              modalDescription="Applies the 'admin_suspended' restriction flag to this entitlement without overwriting existing refund or dispute restrictions."
                              payload={{
                                actionType: "entitlement.suspend",
                                entitlementId: e.id,
                              }}
                            />
                          ) : (
                            <AdminActionTrigger
                              buttonLabel="Clear Admin Suspension"
                              buttonVariant="primary"
                              modalTitle="Clear Admin Entitlement Suspension"
                              modalDescription="Removes 'admin_suspended'. The entitlement will only return to 'active' if no other restriction (refund_pending or chargeback_open) remains."
                              payload={{
                                actionType: "entitlement.restore",
                                entitlementId: e.id,
                              }}
                            />
                          )}
                          <AdminActionTrigger
                            buttonLabel="Replace Device"
                            buttonVariant="secondary"
                            modalTitle="Initiate Approved Device Replacement"
                            modalDescription="Clears the currently bound installation hash (1-device limit) so the customer can activate LingoPDF on their replacement device."
                            payload={{
                              actionType: "entitlement.replace_device",
                              entitlementId: e.id,
                            }}
                          />
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Purchase History */}
      <section className="rounded-xl bg-white border border-[#E8E4D9] p-5 space-y-4">
        <h2 className="font-heading text-base font-bold text-[#193C32]">
          Purchase History
        </h2>
        {details.purchases.length === 0 ? (
          <AdminEmptyState
            title="No purchases for this user"
            description="Customer purchase records will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E8E4D9] text-[#242923]/70">
                  <th className="py-2 pr-2">Purchase ID</th>
                  <th className="py-2 px-2">Product</th>
                  <th className="py-2 px-2">Total Paid</th>
                  <th className="py-2 px-2">Status</th>
                  <th className="py-2 px-2">Refund / Dispute</th>
                  <th className="py-2 pl-2 text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E4D9]/60">
                {details.purchases.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 pr-2">
                      <AdminCopyId
                        value={p.id}
                        href={`/admin/purchases/${p.id}`}
                      />
                    </td>
                    <td className="py-2 px-2">{p.productSlug}</td>
                    <td className="py-2 px-2 font-semibold">
                      {formatSubunitsWithCode(
                        p.pricingSnapshot.totalSubunits,
                        p.currency
                      )}
                    </td>
                    <td className="py-2 px-2">
                      <AdminStatusBadge status={p.status} />
                    </td>
                    <td className="py-2 px-2 space-x-1">
                      {p.refundRequest && (
                        <AdminStatusBadge
                          status={p.refundRequest.status}
                          label={`Refund: ${p.refundRequest.status}`}
                        />
                      )}
                      {p.disputeRecord && (
                        <AdminStatusBadge
                          status={p.disputeRecord.status}
                          label={`Dispute: ${p.disputeRecord.status}`}
                        />
                      )}
                      {!p.refundRequest && !p.disputeRecord && (
                        <span className="text-[#242923]/50">—</span>
                      )}
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

      {/* Relevant Administrative Audit History */}
      <section className="rounded-xl bg-white border border-[#E8E4D9] p-5 space-y-4">
        <h2 className="font-heading text-base font-bold text-[#193C32]">
          Administrative Audit History
        </h2>
        {details.auditLogs.length === 0 ? (
          <AdminEmptyState
            title="No administrative actions recorded for this user"
            description="Audit entries targeting or performed by this account will be shown here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E8E4D9] text-[#242923]/70">
                  <th className="py-2 pr-2">Timestamp</th>
                  <th className="py-2 px-2">Actor</th>
                  <th className="py-2 px-2">Action</th>
                  <th className="py-2 px-2">Outcome</th>
                  <th className="py-2 pl-2">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E4D9]/60">
                {details.auditLogs.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2 pr-2 font-mono text-[11px]">
                      {formatAdminTimestamp(a.createdAt)}
                    </td>
                    <td className="py-2 px-2">{a.actorEmail}</td>
                    <td className="py-2 px-2 font-mono text-[#193C32]">
                      {a.action}
                    </td>
                    <td className="py-2 px-2">
                      <AdminStatusBadge status={a.outcome} />
                    </td>
                    <td className="py-2 pl-2 text-[#242923]/80">
                      {a.reason || "—"}
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
