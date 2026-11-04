import React from "react";
import { verifyServerAdminPageAccess } from "@/lib/auth/adminServer";
import {
  getPromotionsAdminData,
  formatAdminTimestamp,
} from "@/lib/admin/services";
import {
  AdminStatusBadge,
  AdminEmptyState,
  AdminActionTrigger,
} from "@/components/admin/AdminUi";

export const instant = false;

export default async function AdminPromotionsPage() {
  const auth = await verifyServerAdminPageAccess();
  if (!auth.authorized) return null;
  const { db } = auth;
  const promoData = await getPromotionsAdminData(db);

  const baseRefDate = new Date(promoData.updatedAt || "2026-03-01T00:00:00.000Z");
  const defaultStartsAt = baseRefDate.toISOString().slice(0, 16);
  const defaultEndsAt = new Date(
    baseRefDate.getTime() + 14 * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .slice(0, 16);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#193C32]">
            Promotions &amp; Discount Mode Management
          </h1>
          <p className="text-xs sm:text-sm text-[#242923]/70 mt-1">
            Configure global promotional mode and manage promotional discount
            campaigns under strict commercial invariants.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <AdminActionTrigger
            buttonLabel="+ Create Promotion Campaign"
            buttonVariant="primary"
            modalTitle="Create Promotional Campaign"
            modalDescription="Create a new promotion campaign. Allowed discount percentages are strictly limited to 5%, 10%, 15%, or 20%. Promotional discounts never stack with the 10% referral discount."
            payload={{
              actionType: "promotion.create",
            }}
            initialExtraState={{
              name: "Seasonal Launch Offer",
              code: "LINGO15",
              discountPercent: 15,
              startsAt: new Date(defaultStartsAt).toISOString(),
              endsAt: new Date(defaultEndsAt).toISOString(),
              activateImmediately: false,
            }}
            fields={[
              {
                name: "name",
                label: "Campaign Name",
                type: "text",
                required: true,
                placeholder: "e.g., Summer Special",
              },
              {
                name: "code",
                label: "Promo Code",
                type: "text",
                required: true,
                placeholder: "e.g., SUMMER15",
              },
              {
                name: "discountPercent",
                label: "Allowed Discount %",
                type: "select",
                required: true,
                options: [
                  { label: "5% Off", value: 5 },
                  { label: "10% Off", value: 10 },
                  { label: "15% Off", value: 15 },
                  { label: "20% Off", value: 20 },
                ],
              },
              {
                name: "startsAt",
                label: "Starts At (UTC ISO)",
                type: "text",
                required: true,
              },
              {
                name: "endsAt",
                label: "Ends At (UTC ISO)",
                type: "text",
                required: true,
              },
              {
                name: "activateImmediately",
                label: "Activate immediately and switch global mode to promo",
                type: "checkbox",
              },
            ]}
          />
        </div>
      </div>

      {/* Global Promotion Mode Status Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-[#E8E4D9] bg-white p-5 shadow-xs space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold uppercase tracking-wider text-[#242923]/60">
              Global Pricing Mode
            </span>
            <AdminStatusBadge status={promoData.mode} />
          </div>
          <div className="font-heading text-2xl font-bold text-[#193C32]">
            {promoData.mode === "promo"
              ? `Promo Mode (${promoData.promotionalDiscountPercent}% Off)`
              : "Normal Mode (10% Referral Discount)"}
          </div>
          <p className="text-[#242923]/70">
            Last updated: {formatAdminTimestamp(promoData.updatedAt)}
          </p>
          <div className="pt-2 flex items-center gap-2 flex-wrap">
            {promoData.mode === "promo" ? (
              <AdminActionTrigger
                buttonLabel="Switch to Normal Mode"
                buttonVariant="secondary"
                modalTitle="Switch Global Pricing to Normal Mode"
                modalDescription="Disable active promotional pricing and return to standard pricing (where referred buyers receive the standard 10% referral discount)."
                payload={{
                  actionType: "promotion.set_global_mode",
                  mode: "normal",
                  promotionalDiscountPercent: 0,
                }}
              />
            ) : (
              <AdminActionTrigger
                buttonLabel="Enable Global Promo Mode"
                buttonVariant="primary"
                modalTitle="Enable Global Promotional Pricing Mode"
                modalDescription="Switch global pricing to Promo Mode with an allowed promotional discount percentage (5%, 10%, 15%, or 20%)."
                payload={{
                  actionType: "promotion.set_global_mode",
                  mode: "promo",
                }}
                initialExtraState={{ promotionalDiscountPercent: 15 }}
                fields={[
                  {
                    name: "promotionalDiscountPercent",
                    label: "Global Promotional Discount Percentage",
                    type: "select",
                    required: true,
                    options: [
                      { label: "5% Off", value: 5 },
                      { label: "10% Off", value: 10 },
                      { label: "15% Off", value: 15 },
                      { label: "20% Off", value: 20 },
                    ],
                  },
                ]}
              />
            )}
          </div>
        </div>

        <div className="lg:col-span-2 rounded-xl border border-[#E8E4D9] bg-white p-5 shadow-xs space-y-2 text-xs">
          <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-[#193C32]">
            Enforced Promotional &amp; Referral Pricing Rules
          </h2>
          <ul className="space-y-1.5 text-[#242923]/80 list-disc list-inside">
            <li>
              <strong>Allowed Promotional Percentages Only:</strong>{" "}
              <code>5%</code>, <code>10%</code>, <code>15%</code>, or{" "}
              <code>20%</code>. Any other discount percentage is rejected by
              server-side Zod and domain validation.
            </li>
            <li>
              <strong>Non-Stacking Discount Policy:</strong> Promotional
              discounts and the{" "}
              <code>{promoData.referralCustomerDiscountPercent}%</code> referral
              buyer discount never stack.
            </li>
            <li>
              <strong>Referred Purchases During Promotions:</strong> When a
              referred buyer purchases during an active promotion, the buyer
              receives the promotional discount (not <code>promo + 10%</code>),
              and the referrer still earns{" "}
              <code>{promoData.referrerCommissionPercent}%</code> of the net
              collected amount (excluding taxes).
            </li>
          </ul>
        </div>
      </div>

      {/* Promotion Campaigns Table */}
      <div className="rounded-xl border border-[#E8E4D9] bg-white p-5 shadow-xs">
        <h2 className="font-heading text-base font-bold text-[#193C32] mb-4">
          Promotional Campaigns ({promoData.campaigns.length})
        </h2>

        {promoData.campaigns.length === 0 ? (
          <AdminEmptyState
            title="No promotional campaigns configured"
            description="Create a promotional campaign with 5%, 10%, 15%, or 20% discount to schedule or activate a promotion."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E8E4D9] text-[#242923]/60 uppercase">
                  <th className="py-2.5 pr-3">Campaign</th>
                  <th className="py-2.5 px-3">Code</th>
                  <th className="py-2.5 px-3">Discount %</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Valid Window (UTC)</th>
                  <th className="py-2.5 px-3">Created By</th>
                  <th className="py-2.5 pl-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E4D9]/60">
                {promoData.campaigns.map((c) => (
                  <tr key={c.campaignId} className="hover:bg-[#F8F5EE]/50">
                    <td className="py-3 pr-3">
                      <div className="font-semibold text-[#193C32]">
                        {c.name}
                      </div>
                      <div className="font-mono text-[11px] text-[#242923]/60">
                        {c.campaignId}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-[#193C32]">
                      {c.code}
                    </td>
                    <td className="py-3 px-3 font-bold text-emerald-800">
                      {c.discountPercent}% OFF
                    </td>
                    <td className="py-3 px-3">
                      <AdminStatusBadge status={c.status} />
                      {promoData.activeCampaignId === c.campaignId && (
                        <div className="text-[10px] font-semibold text-emerald-800 mt-0.5">
                          Currently Active Global Promo
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-[11px] text-[#242923]/75">
                      <div>Start: {formatAdminTimestamp(c.startsAt)}</div>
                      <div>End: {formatAdminTimestamp(c.endsAt)}</div>
                    </td>
                    <td className="py-3 px-3 text-[11px] text-[#242923]/70">
                      {c.createdByAdminEmail}
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        {c.status !== "active" && !c.isExpired && (
                          <AdminActionTrigger
                            buttonLabel="Activate"
                            buttonVariant="primary"
                            modalTitle="Activate Promotion Campaign"
                            modalDescription={`Activate campaign '${c.name}' (${c.code} — ${c.discountPercent}% off) and switch global pricing mode to Promo.`}
                            payload={{
                              actionType: "promotion.activate",
                              campaignId: c.campaignId,
                            }}
                          />
                        )}
                        {c.status === "active" && (
                          <AdminActionTrigger
                            buttonLabel="Deactivate"
                            buttonVariant="danger"
                            modalTitle="Deactivate Promotion Campaign"
                            modalDescription={`Deactivate campaign '${c.name}' (${c.code}) and return global pricing mode to Normal.`}
                            payload={{
                              actionType: "promotion.deactivate",
                              campaignId: c.campaignId,
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
      </div>
    </div>
  );
}
