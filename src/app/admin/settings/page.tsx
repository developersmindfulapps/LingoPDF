import React from "react";
import { verifyServerAdminPageAccess } from "@/lib/auth/adminServer";
import {
  getAdminSettingsData,
  formatAdminTimestamp,
} from "@/lib/admin/services";
import {
  AdminStatusBadge,
  AdminActionTrigger,
  AdminEmptyState,
} from "@/components/admin/AdminUi";
import { siteConfig } from "@/lib/siteConfig";

export const instant = false;

export default async function AdminSettingsPage() {
  const auth = await verifyServerAdminPageAccess();
  if (!auth.authorized) return null;
  const { db } = auth;
  const settings = await getAdminSettingsData(db);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#193C32]">
            Operational &amp; Commercial Policy Settings
          </h1>
          <p className="text-xs sm:text-sm text-[#242923]/70 mt-1">
            Inspect authoritative commercial invariants and update approved
            operational risk thresholds and edition availability flags.
          </p>
        </div>

        <AdminActionTrigger
          buttonLabel="Update Risk & Availability Settings"
          buttonVariant="primary"
          modalTitle="Update Operational Risk & Availability Settings"
          modalDescription="Update referral velocity monitoring thresholds and product edition availability flags. Fixed commercial invariants cannot be bypassed."
          payload={{
            actionType: "settings.update_operational",
            productAvailability: settings.productAvailability,
          }}
          initialExtraState={{
            maxPendingReservationsBeforeReview:
              settings.riskMonitoringConfig.maxPendingReservationsBeforeReview ??
              10,
            maxDailyRedemptionsBeforeReview:
              settings.riskMonitoringConfig.maxDailyRedemptionsBeforeReview ?? 5,
            requireManualReviewOnVelocityAlert:
              settings.riskMonitoringConfig.requireManualReviewOnVelocityAlert,
          }}
          fields={[
            {
              name: "maxPendingReservationsBeforeReview",
              label: "Max Pending Reservations Flag",
              type: "number",
              required: true,
              min: 1,
              max: 50,
              helperText: "Flag referral account for review when pending reservations exceed this limit (1-50).",
            },
            {
              name: "maxDailyRedemptionsBeforeReview",
              label: "Max Daily Redemptions Flag",
              type: "number",
              required: true,
              min: 1,
              max: 50,
              helperText: "Flag referral account for review when daily conversions exceed this limit (1-50).",
            },
            {
              name: "requireManualReviewOnVelocityAlert",
              label: "Require manual admin review on velocity alert",
              type: "checkbox",
            },
          ]}
        />
      </div>

      {/* Fixed Commercial Invariants (Read-Only) */}
      <div className="rounded-xl border border-[#E8E4D9] bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-heading text-base font-bold text-[#193C32]">
              Authoritative Commercial Invariants (Read-Only)
            </h2>
            <p className="text-xs text-[#242923]/70">
              Enforced across Stage 3A, 3B.1, 3B.2, 3B.3, and 3B.4 domain
              layers. Administrators cannot silently bypass these rules.
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-900">
            Locked Policy Invariants
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div className="rounded-lg border border-[#E8E4D9] bg-[#F8F5EE]/50 p-3.5">
            <div className="text-[#242923]/60 uppercase font-semibold text-[11px]">
              Money-Back Guarantee Window
            </div>
            <div className="mt-1 font-heading text-lg font-bold text-[#193C32]">
              {settings.fixedCommercialInvariants.refundGuaranteeWindowHours}{" "}
              Hours
            </div>
            <div className="text-[11px] text-[#242923]/70">
              Standard refund window from payment capture
            </div>
          </div>

          <div className="rounded-lg border border-[#E8E4D9] bg-[#F8F5EE]/50 p-3.5">
            <div className="text-[#242923]/60 uppercase font-semibold text-[11px]">
              Commission Hold Window
            </div>
            <div className="mt-1 font-heading text-lg font-bold text-[#193C32]">
              {
                settings.fixedCommercialInvariants
                  .commissionEligibilityHoldHours
              }{" "}
              Hours
            </div>
            <div className="text-[11px] text-[#242923]/70">
              Mandatory wait before commission becomes eligible
            </div>
          </div>

          <div className="rounded-lg border border-[#E8E4D9] bg-[#F8F5EE]/50 p-3.5">
            <div className="text-[#242923]/60 uppercase font-semibold text-[11px]">
              Referral Split &amp; Cap
            </div>
            <div className="mt-1 font-heading text-lg font-bold text-[#193C32]">
              {
                settings.fixedCommercialInvariants
                  .referralCustomerDiscountPercent
              }
              % Buyer Off /{" "}
              {settings.fixedCommercialInvariants.referrerCommissionPercent}%
              Referrer
            </div>
            <div className="text-[11px] text-[#242923]/70">
              Capped at{" "}
              {settings.fixedCommercialInvariants.maxSuccessfulReferralsPerUser}{" "}
              successful conversions per referrer
            </div>
          </div>

          <div className="rounded-lg border border-[#E8E4D9] bg-[#F8F5EE]/50 p-3.5">
            <div className="text-[#242923]/60 uppercase font-semibold text-[11px]">
              Minimum Payout Threshold
            </div>
            <div className="mt-1 font-heading text-lg font-bold text-[#193C32]">
              {
                settings.fixedCommercialInvariants
                  .minEligibleCommissionsForPayout
              }{" "}
              Qualifying Commissions
            </div>
            <div className="text-[11px] text-[#242923]/70">
              Counted across currencies; paid in single-currency batches
            </div>
          </div>

          <div className="rounded-lg border border-[#E8E4D9] bg-[#F8F5EE]/50 p-3.5">
            <div className="text-[#242923]/60 uppercase font-semibold text-[11px]">
              Allowed Promotional Discounts
            </div>
            <div className="mt-1 font-heading text-lg font-bold text-[#193C32]">
              {settings.fixedCommercialInvariants.allowedPromotionPercentages
                .map((p) => `${p}%`)
                .join(", ")}
            </div>
            <div className="text-[11px] text-[#242923]/70">
              Non-stacking with referral discounts
            </div>
          </div>

          <div className="rounded-lg border border-[#E8E4D9] bg-[#F8F5EE]/50 p-3.5">
            <div className="text-[#242923]/60 uppercase font-semibold text-[11px]">
              Device Licensing Policy
            </div>
            <div className="mt-1 font-heading text-lg font-bold text-[#193C32]">
              1 Active Device / Purchase
            </div>
            <div className="text-[11px] text-[#242923]/70">
              Per-language lifetime edition license
            </div>
          </div>
        </div>
      </div>

      {/* Regional & Affordability Pricing Policy (Workstream C) */}
      <div className="rounded-xl border border-[#E8E4D9] bg-white p-5 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-bold text-[#193C32]">
              Regional Pricing &amp; Affordability Policy
            </h2>
            <p className="text-xs text-[#242923]/70">
              Authoritative base prices, Eurozone coverage, and admin-curated affordability country rules. Supersedes legacy $59 USD / €59 EUR pricing.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <AdminActionTrigger
              buttonLabel="Add Affordability Rule"
              buttonVariant="primary"
              modalTitle="Add Curated Affordability Country Rule"
              modalDescription="Configure a tailored local currency price or USD fallback for an approved affordability country. Protected markets (India, United States, and 21 Eurozone countries) cannot be overridden."
              payload={{
                actionType: "settings.add_affordability_rule",
              }}
              initialExtraState={{
                countryCode: "",
                countryName: "",
                currency: "USD",
                currencySymbol: "$",
                basePriceSubunits: 2400,
                usdFallbackPriceSubunits: 2400,
                isGatewaySupportedCurrency: false,
                isActive: true,
                referenceExchangeRateToInr: 85,
                approximateInrEquivalent: 2000,
                notes: "",
              }}
              fields={[
                {
                  name: "countryCode",
                  label: "ISO Alpha-2 Country Code (e.g. KZ, MN, KE, NG, ZA)",
                  type: "text",
                  required: true,
                  minLength: 2,
                  maxLength: 2,
                  placeholder: "KZ",
                  helperText: "Strict 2-letter uppercase ISO country code. Protected markets (IN, US, Eurozone) are blocked.",
                },
                {
                  name: "countryName",
                  label: "Country Name",
                  type: "text",
                  required: true,
                  placeholder: "Kazakhstan",
                },
                {
                  name: "currency",
                  label: "Local Currency Code (3 uppercase letters)",
                  type: "text",
                  required: true,
                  minLength: 3,
                  maxLength: 3,
                  placeholder: "KZT",
                },
                {
                  name: "currencySymbol",
                  label: "Currency Symbol",
                  type: "text",
                  required: true,
                  placeholder: "₸",
                },
                {
                  name: "basePriceSubunits",
                  label: "Local Base Price in Subunits (e.g. 11,800 KZT = 1180000 subunits)",
                  type: "number",
                  required: true,
                  min: 1,
                  helperText: "Base price in minor subunits (cents/tiyn/kobo/cents).",
                },
                {
                  name: "usdFallbackPriceSubunits",
                  label: "USD Fallback Price in Cents (e.g. 2400 for $24.00)",
                  type: "number",
                  required: true,
                  min: 100,
                  max: 7500,
                  helperText: "Fallback price charged when payment gateway does not support local currency. $24 USD ≈ ₹2,000 INR.",
                },
                {
                  name: "isGatewaySupportedCurrency",
                  label: "Currency Supported by Payment Gateway for Direct Charge",
                  type: "checkbox",
                  helperText: "Check only if live gateway can accept and settle charges in this exact currency.",
                },
                {
                  name: "isActive",
                  label: "Rule Active and Enabled for Customer Checkout",
                  type: "checkbox",
                },
                {
                  name: "approximateInrEquivalent",
                  label: "Approximate INR Equivalent (Reference)",
                  type: "number",
                  helperText: "Calibrated against the ₹2,000 INR affordability benchmark.",
                },
                {
                  name: "notes",
                  label: "Operational Notes & Economic Justification",
                  type: "textarea",
                  rows: 2,
                  placeholder: "Calibrated to ~₹2,000 INR purchasing power parity.",
                },
              ]}
            />
          </div>
        </div>

        {/* Standard Regional Pricing Cards (Read-Only) */}
        <div>
          <h3 className="font-heading text-xs font-semibold text-[#193C32] uppercase tracking-wider mb-2">
            Authoritative Standard Base Prices (Strict Precedence)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="rounded-lg border border-[#E8E4D9] bg-[#F8F5EE]/40 p-3">
              <div className="flex items-center justify-between text-[#242923]/60 uppercase font-semibold text-[10px]">
                <span>India (Priority 1)</span>
                <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">IN</span>
              </div>
              <div className="mt-1 font-heading text-lg font-bold text-[#193C32]">
                ₹1,299 INR
              </div>
              <div className="text-[11px] text-[#242923]/70">
                129,900 paise • Canonical India base price
              </div>
            </div>

            <div className="rounded-lg border border-[#E8E4D9] bg-[#F8F5EE]/40 p-3">
              <div className="flex items-center justify-between text-[#242923]/60 uppercase font-semibold text-[10px]">
                <span>United States (Priority 2)</span>
                <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">US</span>
              </div>
              <div className="mt-1 font-heading text-lg font-bold text-[#193C32]">
                $75 USD
              </div>
              <div className="text-[11px] text-[#242923]/70">
                7,500 cents • Canonical US base price
              </div>
            </div>

            <div className="rounded-lg border border-[#E8E4D9] bg-[#F8F5EE]/40 p-3">
              <div className="flex items-center justify-between text-[#242923]/60 uppercase font-semibold text-[10px]">
                <span>Eurozone (Priority 3)</span>
                <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">21 Countries</span>
              </div>
              <div className="mt-1 font-heading text-lg font-bold text-[#193C32]">
                €75 EUR
              </div>
              <div className="text-[11px] text-[#242923]/70">
                7,500 cents • AT, BE, BG, CY, DE, ES, FR, IE, IT, NL...
              </div>
            </div>

            <div className="rounded-lg border border-[#E8E4D9] bg-[#F8F5EE]/40 p-3">
              <div className="flex items-center justify-between text-[#242923]/60 uppercase font-semibold text-[10px]">
                <span>Standard Int&apos;l (Fallback)</span>
                <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">Default</span>
              </div>
              <div className="mt-1 font-heading text-lg font-bold text-[#193C32]">
                $75 USD
              </div>
              <div className="text-[11px] text-[#242923]/70">
                7,500 cents • All unconfigured territories
              </div>
            </div>
          </div>
        </div>

        {/* Affordability Target Configuration Card */}
        <div className="rounded-lg border border-[#E8E4D9] bg-[#F8F5EE]/30 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="text-[#242923]/60 uppercase font-semibold text-[11px]">
                Affordability Tier Target Benchmark
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-heading text-2xl font-bold text-[#193C32]">
                  ₹{settings.affordabilityTargetInr.toLocaleString()} INR
                </span>
                <span className="text-xs text-[#242923]/70">
                  (~${Math.round(settings.affordabilityTargetInr / 85)} USD equivalent reference)
                </span>
              </div>
              <p className="mt-1 text-xs text-[#242923]/70 max-w-xl">
                Commercial benchmark reference used to calibrate country-specific pricing for purchasing power parity. Not a dynamic checkout calculation.
              </p>
            </div>
            <AdminActionTrigger
              buttonLabel="Update Target Benchmark"
              buttonVariant="secondary"
              modalTitle="Update Affordability Target Benchmark"
              modalDescription="Change the administrative reference target in INR used for calibrating affordability country pricing. This does not automatically re-rate existing country prices."
              payload={{
                actionType: "settings.update_affordability_target",
              }}
              initialExtraState={{
                affordabilityTargetInr: settings.affordabilityTargetInr,
              }}
              fields={[
                {
                  name: "affordabilityTargetInr",
                  label: "Target Benchmark (INR)",
                  type: "number",
                  required: true,
                  min: 500,
                  max: 20000,
                  helperText: "Recommended initial target: ₹2,000 INR (range: 500 to 20,000).",
                },
              ]}
            />
          </div>
        </div>

        {/* Curated Affordability Country Rules Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-xs font-semibold text-[#193C32] uppercase tracking-wider">
              Curated Affordability Country Rules ({settings.affordabilityRules.length})
            </h3>
            <span className="text-[11px] text-[#242923]/60">
              Evaluated at Priority 4 (after IN, US, Eurozone)
            </span>
          </div>

          {settings.affordabilityRules.length === 0 ? (
            <AdminEmptyState
              title="No Affordability Rules Configured"
              description="No country-specific affordability pricing rules have been configured yet. All non-India, non-US, non-Eurozone customers receive standard international pricing ($75 USD)."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[#E8E4D9]">
              <table className="w-full text-left text-xs text-[#242923]">
                <thead className="bg-[#F8F5EE] border-b border-[#E8E4D9] text-[11px] font-semibold text-[#193C32]">
                  <tr>
                    <th className="px-3.5 py-2.5">Country</th>
                    <th className="px-3.5 py-2.5">Configured Price</th>
                    <th className="px-3.5 py-2.5">USD Fallback</th>
                    <th className="px-3.5 py-2.5">Gateway Currency</th>
                    <th className="px-3.5 py-2.5">Approx. INR</th>
                    <th className="px-3.5 py-2.5">Status</th>
                    <th className="px-3.5 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E4D9]/60 bg-white">
                  {settings.affordabilityRules.map((rule) => {
                    const priceFormatted = `${rule.currencySymbol}${(rule.basePriceSubunits / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
                    const usdFallbackFormatted = `$${(rule.usdFallbackPriceSubunits / 100).toFixed(2)}`;
                    return (
                      <tr key={rule.countryCode} className="hover:bg-[#F8F5EE]/30">
                        <td className="px-3.5 py-3 font-medium text-[#193C32]">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-[#E8E4D9]/60">
                              {rule.countryCode}
                            </span>
                            <span>{rule.countryName}</span>
                          </div>
                          {rule.notes && (
                            <div className="text-[11px] text-[#242923]/60 mt-0.5 max-w-xs truncate">
                              {rule.notes}
                            </div>
                          )}
                        </td>
                        <td className="px-3.5 py-3 font-semibold text-[#193C32]">
                          <div>{priceFormatted}</div>
                          <span className="font-mono text-[10px] text-[#242923]/60">
                            {rule.currency}
                          </span>
                        </td>
                        <td className="px-3.5 py-3 font-mono">
                          {usdFallbackFormatted}
                        </td>
                        <td className="px-3.5 py-3">
                          {rule.isGatewaySupportedCurrency ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                              Direct Charge
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200" title="Charged in USD Fallback at checkout">
                              USD Fallback
                            </span>
                          )}
                        </td>
                        <td className="px-3.5 py-3 text-[11px] text-[#242923]/70">
                          {rule.approximateInrEquivalent
                            ? `≈ ₹${rule.approximateInrEquivalent.toLocaleString()}`
                            : "—"}
                        </td>
                        <td className="px-3.5 py-3">
                          <AdminStatusBadge
                            status={rule.isActive ? "active" : "inactive"}
                            label={rule.isActive ? "Active" : "Disabled"}
                          />
                        </td>
                        <td className="px-3.5 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <AdminActionTrigger
                              buttonLabel={rule.isActive ? "Disable" : "Enable"}
                              buttonVariant={rule.isActive ? "danger" : "secondary"}
                              modalTitle={`${rule.isActive ? "Disable" : "Enable"} Rule for ${rule.countryName}`}
                              modalDescription={`Change active status for ${rule.countryName} (${rule.countryCode}). When disabled, customers from this country will fall back to standard international pricing ($75 USD).`}
                              payload={{
                                actionType: "settings.toggle_affordability_rule",
                                countryCode: rule.countryCode,
                                isActive: !rule.isActive,
                              }}
                            />
                            <AdminActionTrigger
                              buttonLabel="Edit"
                              buttonVariant="secondary"
                              modalTitle={`Edit Affordability Rule: ${rule.countryName} (${rule.countryCode})`}
                              modalDescription="Update price points, currency support, or notes for this curated country."
                              payload={{
                                actionType: "settings.update_affordability_rule",
                                countryCode: rule.countryCode,
                              }}
                              initialExtraState={{
                                countryName: rule.countryName,
                                currency: rule.currency,
                                currencySymbol: rule.currencySymbol,
                                basePriceSubunits: rule.basePriceSubunits,
                                usdFallbackPriceSubunits: rule.usdFallbackPriceSubunits,
                                isGatewaySupportedCurrency: rule.isGatewaySupportedCurrency,
                                isActive: rule.isActive,
                                referenceExchangeRateToInr: rule.referenceExchangeRateToInr,
                                approximateInrEquivalent: rule.approximateInrEquivalent,
                                notes: rule.notes || "",
                              }}
                              fields={[
                                {
                                  name: "countryName",
                                  label: "Country Name",
                                  type: "text",
                                  required: true,
                                },
                                {
                                  name: "currency",
                                  label: "Currency Code",
                                  type: "text",
                                  required: true,
                                },
                                {
                                  name: "currencySymbol",
                                  label: "Currency Symbol",
                                  type: "text",
                                  required: true,
                                },
                                {
                                  name: "basePriceSubunits",
                                  label: "Base Price Subunits",
                                  type: "number",
                                  required: true,
                                  min: 1,
                                },
                                {
                                  name: "usdFallbackPriceSubunits",
                                  label: "USD Fallback Subunits (Cents)",
                                  type: "number",
                                  required: true,
                                  min: 100,
                                  max: 7500,
                                },
                                {
                                  name: "isGatewaySupportedCurrency",
                                  label: "Direct Gateway Currency Support",
                                  type: "checkbox",
                                },
                                {
                                  name: "isActive",
                                  label: "Active for Checkout",
                                  type: "checkbox",
                                },
                                {
                                  name: "approximateInrEquivalent",
                                  label: "Approximate INR Equivalent",
                                  type: "number",
                                },
                                {
                                  name: "notes",
                                  label: "Notes",
                                  type: "textarea",
                                  rows: 2,
                                },
                              ]}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Configurable Operational Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-[#E8E4D9] bg-white p-5 shadow-xs space-y-3 text-xs">
          <h2 className="font-heading text-base font-bold text-[#193C32]">
            Referral Velocity &amp; Risk Monitoring Thresholds
          </h2>
          <div className="flex justify-between">
            <span className="text-[#242923]/65">
              Max Pending Reservations Before Review:
            </span>
            <span className="font-semibold text-[#193C32]">
              {settings.riskMonitoringConfig
                .maxPendingReservationsBeforeReview ?? "Not set (Default)"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#242923]/65">
              Max Daily Redemptions Before Review:
            </span>
            <span className="font-semibold text-[#193C32]">
              {settings.riskMonitoringConfig.maxDailyRedemptionsBeforeReview ??
                "Not set (Default)"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#242923]/65">
              Manual Review Required on Velocity Alert:
            </span>
            <AdminStatusBadge
              status={
                settings.riskMonitoringConfig.requireManualReviewOnVelocityAlert
                  ? "active"
                  : "inactive"
              }
              label={
                settings.riskMonitoringConfig.requireManualReviewOnVelocityAlert
                  ? "Enabled"
                  : "Disabled"
              }
            />
          </div>
          <div className="pt-2 border-t border-[#E8E4D9] text-[11px] text-[#242923]/60">
            Last updated: {formatAdminTimestamp(settings.updatedAt)}
          </div>
        </div>

        <div className="rounded-xl border border-[#E8E4D9] bg-white p-5 shadow-xs space-y-3 text-xs">
          <h2 className="font-heading text-base font-bold text-[#193C32]">
            Language Edition Availability Matrix
          </h2>
          <div className="divide-y divide-[#E8E4D9]/60">
            {siteConfig.products.map((prod) => {
              const currentStatus =
                settings.productAvailability[prod.id] || prod.status;
              return (
                <div
                  key={prod.id}
                  className="py-2 flex items-center justify-between"
                >
                  <div>
                    <span className="font-semibold text-[#193C32]">
                      {prod.languagePair} Edition
                    </span>{" "}
                    <span className="font-mono text-[11px] text-[#242923]/60">
                      ({prod.id})
                    </span>
                  </div>
                  <AdminStatusBadge status={currentStatus} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
