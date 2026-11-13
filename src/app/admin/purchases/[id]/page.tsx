import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { verifyServerAdminPageAccess } from "@/lib/auth/adminServer";
import {
  getAdminPurchaseDetails,
  formatMinorUnits,
  formatAdminTimestamp,
  formatGuaranteeCountdown,
} from "@/lib/admin/services";
import {
  AdminStatusBadge,
  AdminCopyId,
  AdminEmptyState,
  AdminActionTrigger,
} from "@/components/admin/AdminUi";

export const instant = false;

export default async function AdminPurchaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const auth = await verifyServerAdminPageAccess();
  if (!auth.authorized) return null;
  const { db } = auth;
  const { id } = await params;

  const details = await getAdminPurchaseDetails(db, id);
  if (!details) {
    notFound();
  }

  const {
    purchase,
    entitlement,
    evidence,
    commission,
    adjustments,
    webhooks,
    auditLogs,
  } = details;

  const guarantee = formatGuaranteeCountdown(purchase.capturedAt);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-heading text-2xl font-bold text-[#193C32]">
              Purchase Lifecycle &amp; Evidence
            </h1>
            <AdminStatusBadge status={purchase.status} />
            <span className="px-2 py-0.5 rounded bg-[#E8E4D9] font-mono text-xs font-semibold text-[#193C32]">
              {purchase.currency}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-[#242923]/70 flex-wrap">
            <span>
              Purchase ID: <AdminCopyId value={purchase.id} prefixChars={12} />
            </span>
            <span>·</span>
            <span>
              Customer:{" "}
              <Link
                href={`/admin/users/${purchase.userId}`}
                className="font-semibold text-[#193C32] underline"
              >
                {purchase.userEmail}
              </Link>
            </span>
            <span>·</span>
            <span>Created: {formatAdminTimestamp(purchase.createdAt)}</span>
          </div>
        </div>

        {/* Support & Risk Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {purchase.status === "captured" && !purchase.refundRequest && (
            <AdminActionTrigger
              buttonLabel="Record Refund Request"
              buttonVariant="secondary"
              modalTitle="Record Customer Refund Request"
              modalDescription={`Open an internal refund review record for ${purchase.userEmail} (${formatMinorUnits(purchase.pricingSnapshot.totalSubunits, purchase.currency)}). This will place a 'refund_pending' restriction on the entitlement and hold any associated referral commission.`}
              payload={{
                actionType: "refund.create_request",
                purchaseId: purchase.id,
                isExceptionalOverride: !guarantee.isWithinWindow,
              }}
            />
          )}

          {purchase.status === "captured" &&
            (!purchase.disputeRecord ||
              ["won", "withdrawn"].includes(purchase.disputeRecord.status)) && (
              <AdminActionTrigger
                buttonLabel="Open Dispute / Chargeback"
                buttonVariant="danger"
                modalTitle="Open Dispute / Chargeback Record"
                modalDescription="Opening a dispute record immediately suspends the associated entitlement with 'dispute_open' and places any unpaid referral commission on dispute hold."
                payload={{
                  actionType: "dispute.open",
                  purchaseId: purchase.id,
                }}
                initialExtraState={{ reasonCode: "chargeback_inquiry" }}
                fields={[
                  {
                    name: "reasonCode",
                    label: "Dispute Reason Code",
                    type: "text",
                    required: true,
                    placeholder: "e.g., chargeback_inquiry",
                  },
                ]}
              />
            )}
        </div>
      </div>

      {/* Top Grid: Pricing Snapshot & Provider References */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-[#E8E4D9] bg-white p-5 shadow-xs space-y-2.5 text-xs">
          <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-[#193C32]">
            Pricing Snapshot ({purchase.currency})
          </h2>
          <div className="flex justify-between">
            <span className="text-[#242923]/60">Product Edition:</span>
            <span className="font-semibold text-[#193C32]">
              {purchase.productSlug} (v{purchase.editionVersion})
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#242923]/60">Region / Currency:</span>
            <span className="font-medium">
              {purchase.region} · {purchase.currency}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#242923]/60">Original List Price:</span>
            <span className="font-medium">
              {formatMinorUnits(
                purchase.pricingSnapshot.basePriceSubunits,
                purchase.currency
              )}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#242923]/60">
              Discount ({purchase.pricingSnapshot.discountPercentApplied}% ·{" "}
              {purchase.pricingSnapshot.promoApplied
                ? "promo"
                : purchase.pricingSnapshot.referralCodeApplied
                  ? "referral"
                  : "none"}
              ):
            </span>
            <span className="font-medium text-emerald-800">
              -
              {formatMinorUnits(
                purchase.pricingSnapshot.discountSubunits,
                purchase.currency
              )}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#242923]/60">Tax Subunits:</span>
            <span className="font-medium">
              {formatMinorUnits(
                purchase.pricingSnapshot.taxSubunits,
                purchase.currency
              )}
            </span>
          </div>
          <div className="flex justify-between pt-2 border-t border-[#E8E4D9] text-sm font-bold text-[#193C32]">
            <span>Actual Paid Total:</span>
            <span>
              {formatMinorUnits(
                purchase.pricingSnapshot.totalSubunits,
                purchase.currency
              )}
            </span>
          </div>
          {purchase.pricingSnapshot.referralCodeApplied && (
            <div className="pt-1 text-[11px] text-[#242923]/70">
              Referral Code Applied:{" "}
              <strong className="font-mono text-[#193C32]">
                {purchase.pricingSnapshot.referralCodeApplied}
              </strong>
              {purchase.referrerEmail && ` (${purchase.referrerEmail})`}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#E8E4D9] bg-white p-5 shadow-xs space-y-2.5 text-xs">
          <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-[#193C32]">
            Payment Provider &amp; Lifecycle
          </h2>
          <div className="flex justify-between">
            <span className="text-[#242923]/60">Payment Provider:</span>
            <span className="font-medium uppercase">
              {purchase.paymentProvider}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#242923]/60">Provider Order ID:</span>
            <AdminCopyId value={purchase.providerOrderId} />
          </div>
          <div className="flex justify-between">
            <span className="text-[#242923]/60">Provider Payment ID:</span>
            <AdminCopyId value={purchase.providerPaymentId} />
          </div>
          {purchase.paddleTransactionId && (
            <div className="flex justify-between">
              <span className="text-[#242923]/60">Paddle Transaction ID:</span>
              <AdminCopyId value={purchase.paddleTransactionId} />
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-[#242923]/60">Idempotency Key:</span>
            <AdminCopyId value={purchase.idempotencyKey} />
          </div>
          <div className="flex justify-between">
            <span className="text-[#242923]/60">Captured At:</span>
            <span className="font-medium">
              {formatAdminTimestamp(purchase.capturedAt)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#242923]/60">72h Refund Window:</span>
            <span
              className={
                guarantee.isWithinWindow
                  ? "font-semibold text-emerald-800"
                  : "text-[#242923]/70"
              }
            >
              {guarantee.label}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-[#E8E4D9] bg-white p-5 shadow-xs space-y-2.5 text-xs">
          <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-[#193C32]">
            Chargeback Defense Evidence
          </h2>
          {!evidence ? (
            <p className="text-[#242923]/60">
              No immutable purchase evidence snapshot recorded for this order.
            </p>
          ) : (
            <>
              <div className="flex justify-between">
                <span className="text-[#242923]/60">Email Snapshot:</span>
                <span className="font-medium">{evidence.emailSnapshot}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#242923]/60">Payment Summary:</span>
                <span className="font-medium">
                  {evidence.paymentMethodSummary || "Sanitized"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#242923]/60">Terms Accepted:</span>
                <span className="font-mono">
                  {evidence.termsVersionAccepted}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#242923]/60">Refund Policy:</span>
                <span className="font-mono">
                  {evidence.refundPolicyVersionAccepted}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#242923]/60">Accepted Timestamp:</span>
                <span>{formatAdminTimestamp(evidence.acceptedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#242923]/60">Extension Activated:</span>
                <span>
                  {formatAdminTimestamp(evidence.extensionActivatedAt)}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Associated Entitlement & Commission */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl border border-[#E8E4D9] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading text-base font-bold text-[#193C32]">
              Associated License Entitlement
            </h2>
            <Link
              href="/admin/entitlements"
              className="text-xs font-semibold text-[#193C32] underline"
            >
              View Entitlements →
            </Link>
          </div>
          {!entitlement ? (
            <AdminEmptyState
              title="No entitlement issued"
              description="Entitlements are only issued once a purchase transitions to captured."
            />
          ) : (
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-[#242923]/60">Entitlement ID:</span>
                <AdminCopyId value={entitlement.id} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#242923]/60">Status:</span>
                <AdminStatusBadge status={entitlement.status} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#242923]/60">Active Restrictions:</span>
                <span>
                  {entitlement.activeRestrictionReasons.length > 0
                    ? entitlement.activeRestrictionReasons.join(", ")
                    : "None"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#242923]/60">Device Binding Hash:</span>
                <span className="font-mono">
                  {entitlement.activeInstallationIdHash
                    ? `${entitlement.activeInstallationIdHash.slice(0, 14)}…`
                    : "Unbound"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#242923]/60">Device Replacements:</span>
                <span>{entitlement.deviceReplacementCount}</span>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-[#E8E4D9] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading text-base font-bold text-[#193C32]">
              Referral Attribution &amp; Commission
            </h2>
            <Link
              href="/admin/commissions"
              className="text-xs font-semibold text-[#193C32] underline"
            >
              Commission Ledger →
            </Link>
          </div>
          {!commission ? (
            <AdminEmptyState
              title="No referral commission"
              description="This purchase did not generate a referral commission."
            />
          ) : (
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-[#242923]/60">Commission ID:</span>
                <AdminCopyId value={commission.id} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#242923]/60">Status:</span>
                <div className="flex items-center gap-1.5">
                  <AdminStatusBadge status={commission.status} />
                  {commission.isDisputedHold && (
                    <AdminStatusBadge status="held" label="Dispute Hold" />
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#242923]/60">
                  Net Collected Basis ({commission.currency}):
                </span>
                <span>
                  {formatMinorUnits(
                    commission.netCollectedSubunits,
                    commission.currency
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#242923]/60">
                  20% Commission Amount:
                </span>
                <span className="font-bold text-[#193C32]">
                  {formatMinorUnits(
                    commission.commissionAmountSubunits,
                    commission.currency
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#242923]/60">72h Hold Until:</span>
                <span>{formatAdminTimestamp(commission.holdUntil)}</span>
              </div>
              {adjustments.length > 0 && (
                <div className="pt-2 border-t border-[#E8E4D9]">
                  <div className="font-semibold text-red-900">
                    Post-Payout Commission Adjustments ({adjustments.length}):
                  </div>
                  {adjustments.map((adj) => (
                    <div key={adj.id} className="text-[11px] text-red-800 mt-1">
                      {formatMinorUnits(
                        adj.adjustmentAmountSubunits,
                        adj.currency
                      )}{" "}
                      · {adj.reason} ({adj.resolutionStatus})
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Refund & Dispute Records */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl border border-[#E8E4D9] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading text-base font-bold text-[#193C32]">
              Refund Record
            </h2>
            <Link
              href="/admin/refunds"
              className="text-xs font-semibold text-[#193C32] underline"
            >
              Manage Refunds →
            </Link>
          </div>
          {!purchase.refundRequest ? (
            <AdminEmptyState
              title="No refund request"
              description="No refund request has been filed for this purchase."
            />
          ) : (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#242923]/60">Request ID:</span>
                <span className="font-mono">
                  {purchase.refundRequest.requestId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#242923]/60">Status:</span>
                <AdminStatusBadge status={purchase.refundRequest.status} />
              </div>
              <div className="flex justify-between">
                <span className="text-[#242923]/60">72h Window Status:</span>
                <span>
                  {purchase.refundRequest.isWithin72hGuarantee
                    ? "Within 72h Guarantee"
                    : "Outside 72h (Exceptional Override)"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#242923]/60">Reason:</span>
                <span>{purchase.refundRequest.reason}</span>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-[#E8E4D9] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading text-base font-bold text-[#193C32]">
              Dispute Record
            </h2>
            <Link
              href="/admin/disputes"
              className="text-xs font-semibold text-[#193C32] underline"
            >
              Manage Disputes →
            </Link>
          </div>
          {!purchase.disputeRecord ? (
            <AdminEmptyState
              title="No dispute record"
              description="No chargeback or payment dispute has been opened for this purchase."
            />
          ) : (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#242923]/60">Dispute ID:</span>
                <span className="font-mono">
                  {purchase.disputeRecord.disputeId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#242923]/60">Status:</span>
                <AdminStatusBadge status={purchase.disputeRecord.status} />
              </div>
              <div className="flex justify-between">
                <span className="text-[#242923]/60">Reason Code:</span>
                <span className="font-mono">
                  {purchase.disputeRecord.reasonCode}
                </span>
              </div>
              {purchase.disputeRecord.adminNotes && (
                <div className="pt-1 text-[#242923]/80">
                  <strong>Notes:</strong> {purchase.disputeRecord.adminNotes}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Audit History & Webhook Events */}
      <section className="rounded-xl border border-[#E8E4D9] bg-white p-5 shadow-xs">
        <h2 className="font-heading text-base font-bold text-[#193C32] mb-3">
          Purchase Audit History ({auditLogs.length}) &amp; Provider Webhooks (
          {webhooks.length})
        </h2>
        {auditLogs.length === 0 ? (
          <AdminEmptyState
            title="No administrative mutations recorded"
            description="Administrative actions affecting this purchase will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E8E4D9] text-[#242923]/60 uppercase">
                  <th className="py-2 pr-3">Action</th>
                  <th className="py-2 px-3">Actor</th>
                  <th className="py-2 px-3">Outcome</th>
                  <th className="py-2 px-3">Reason</th>
                  <th className="py-2 pl-3 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E4D9]/60">
                {auditLogs.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2.5 pr-3 font-mono font-semibold text-[#193C32]">
                      {a.action}
                    </td>
                    <td className="py-2.5 px-3">{a.actorEmail}</td>
                    <td className="py-2.5 px-3">
                      <AdminStatusBadge status={a.outcome} />
                    </td>
                    <td className="py-2.5 px-3">{a.reason}</td>
                    <td className="py-2.5 pl-3 text-right text-[#242923]/60">
                      {formatAdminTimestamp(a.createdAt)}
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
