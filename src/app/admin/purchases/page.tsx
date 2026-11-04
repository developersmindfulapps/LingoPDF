import React from "react";
import Link from "next/link";
import { verifyServerAdminPageAccess } from "@/lib/auth/adminServer";
import {
  listAdminPurchases,
  formatMinorUnits,
  formatAdminTimestamp,
} from "@/lib/admin/services";
import {
  AdminStatusBadge,
  AdminCopyId,
  AdminEmptyState,
  AdminPagination,
} from "@/components/admin/AdminUi";
import { siteConfig } from "@/lib/siteConfig";

export const instant = false;

export default async function AdminPurchasesPage({
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
  const productSlug =
    typeof resolvedParams.productSlug === "string"
      ? resolvedParams.productSlug
      : "all";
  const dateFrom =
    typeof resolvedParams.dateFrom === "string" ? resolvedParams.dateFrom : "";
  const dateTo =
    typeof resolvedParams.dateTo === "string" ? resolvedParams.dateTo : "";

  const result = await listAdminPurchases(db, {
    page,
    limit: 20,
    q,
    status,
    currency,
    productSlug,
    dateFrom,
    dateTo,
  });

  const searchParamsRecord: Record<string, string | undefined> = {
    q: q || undefined,
    status: status !== "all" ? status : undefined,
    currency: currency !== "all" ? currency : undefined,
    productSlug: productSlug !== "all" ? productSlug : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#193C32]">
            Purchase Management
          </h1>
          <p className="text-xs sm:text-sm text-[#242923]/70 mt-1">
            Inspect purchase orders, pricing snapshots, non-stacking discount
            application, provider references, and post-purchase lifecycle.
          </p>
        </div>
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3.5 py-2 text-xs text-amber-900 max-w-md">
          <strong>Financial Invariant:</strong> Purchases cannot be manually
          marked captured by admin click. Only verified provider webhooks or
          evidence-backed reconciliation establish captured status.
        </div>
      </div>

      {/* Filter Bar */}
      <form
        method="GET"
        action="/admin/purchases"
        className="rounded-xl border border-[#E8E4D9] bg-white p-4 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3"
      >
        <div className="sm:col-span-2">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#242923]/70 mb-1">
            Search Purchase ID / Email / Order Ref
          </label>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Purchase ID, user email, provider order ID…"
            className="w-full rounded-lg border border-[#E8E4D9] bg-[#F8F5EE]/50 px-3 py-1.5 text-xs text-[#242923]"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#242923]/70 mb-1">
            Payment Status
          </label>
          <select
            name="status"
            defaultValue={status}
            className="w-full rounded-lg border border-[#E8E4D9] bg-white px-2.5 py-1.5 text-xs text-[#242923]"
          >
            <option value="all">All Statuses</option>
            <option value="captured">Captured</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
            <option value="partially_refunded">Partially Refunded</option>
            <option value="disputed">Disputed</option>
            <option value="chargeback_lost">Chargeback Lost</option>
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
            Filter
          </button>
          <Link
            href="/admin/purchases"
            className="px-3 py-1.5 rounded-lg border border-[#E8E4D9] bg-[#F8F5EE] text-xs font-medium text-[#242923] hover:bg-[#E8E4D9]/50"
          >
            Reset
          </Link>
        </div>
      </form>

      {/* Purchases Table */}
      <div className="rounded-xl border border-[#E8E4D9] bg-white p-5 shadow-xs">
        {result.items.length === 0 ? (
          <AdminEmptyState
            title="No purchases match your filters"
            description="No purchase records were found for the current query parameters."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E8E4D9] text-[#242923]/60 uppercase">
                  <th className="py-2.5 pr-3">Purchase ID</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3">Original</th>
                  <th className="py-2.5 px-3">Discount</th>
                  <th className="py-2.5 px-3">Actual Paid</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Provider Reference</th>
                  <th className="py-2.5 pl-3 text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E4D9]/60">
                {result.items.map((p) => (
                  <tr key={p.id} className="hover:bg-[#F8F5EE]/50">
                    <td className="py-3 pr-3">
                      <AdminCopyId
                        value={p.id}
                        href={`/admin/purchases/${p.id}`}
                      />
                    </td>
                    <td className="py-3 px-3">
                      <Link
                        href={`/admin/users/${p.userId}`}
                        className="font-medium text-[#193C32] hover:underline"
                      >
                        {p.userEmail}
                      </Link>
                      {p.userName && (
                        <div className="text-[11px] text-[#242923]/60">
                          {p.userName}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-[#242923]">
                        {p.productSlug}
                      </div>
                      <div className="text-[11px] text-[#242923]/60">
                        v{p.editionVersion} · {p.region}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-[#242923]/80">
                      {formatMinorUnits(
                        p.pricingSnapshot.basePriceSubunits,
                        p.currency
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {p.pricingSnapshot.discountSubunits > 0 ? (
                        <div>
                          <span className="font-medium text-emerald-800">
                            -
                            {formatMinorUnits(
                              p.pricingSnapshot.discountSubunits,
                              p.currency
                            )}{" "}
                            ({p.pricingSnapshot.discountPercentApplied}%)
                          </span>
                          <div className="text-[10px] text-[#242923]/60 uppercase">
                            {p.pricingSnapshot.promoApplied
                              ? "promo"
                              : p.pricingSnapshot.referralCodeApplied
                                ? "referral"
                                : "none"}
                            {p.pricingSnapshot.referralCodeApplied
                              ? ` · ${p.pricingSnapshot.referralCodeApplied}`
                              : ""}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[#242923]/40">None</span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-semibold text-[#193C32]">
                      {formatMinorUnits(
                        p.pricingSnapshot.totalSubunits,
                        p.currency
                      )}
                      <div className="text-[10px] font-normal text-[#242923]/60">
                        {p.currency}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-col items-start gap-1">
                        <AdminStatusBadge status={p.status} />
                        {p.refundRequestStatus && (
                          <span className="text-[10px] text-amber-800">
                            Refund: {p.refundRequestStatus}
                          </span>
                        )}
                        {p.disputeStatus && (
                          <span className="text-[10px] text-red-800">
                            Dispute: {p.disputeStatus}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px]">
                      {p.providerPaymentId ? (
                        <div>Pay: {p.providerPaymentId}</div>
                      ) : p.providerOrderId ? (
                        <div>Ord: {p.providerOrderId}</div>
                      ) : (
                        <span className="text-[#242923]/40">—</span>
                      )}
                    </td>
                    <td className="py-3 pl-3 text-right text-[#242923]/70">
                      <div>{formatAdminTimestamp(p.createdAt)}</div>
                      <Link
                        href={`/admin/purchases/${p.id}`}
                        className="text-[11px] font-semibold text-[#193C32] hover:text-[#D87854] underline"
                      >
                        Inspect →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <AdminPagination
          basePath="/admin/purchases"
          currentPage={result.page}
          totalPages={result.totalPages}
          totalItems={result.total}
          searchParamsRecord={searchParamsRecord}
        />
      </div>
    </div>
  );
}
