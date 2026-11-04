import React from "react";
import { verifyServerAdminPageAccess } from "@/lib/auth/adminServer";
import {
  getAdminSystemHealthData,
  formatAdminTimestamp,
} from "@/lib/admin/services";
import { AdminStatusBadge } from "@/components/admin/AdminUi";

export const instant = false;

export default async function AdminSystemHealthPage() {
  const auth = await verifyServerAdminPageAccess();
  if (!auth.authorized) return null;
  const { db } = auth;
  const health = await getAdminSystemHealthData(db);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#193C32]">
            System &amp; Operational Health
          </h1>
          <p className="text-xs sm:text-sm text-[#242923]/70 mt-1">
            Safe diagnostic view of MongoDB replica-set connectivity, 43-index
            verification, rate-limit subsystem, email provider, and deferred
            payment gateway status. No secret values or connection strings are
            ever exposed.
          </p>
        </div>
        <div className="text-xs text-[#242923]/70">
          Checked at:{" "}
          <strong className="text-[#193C32]">
            {formatAdminTimestamp(health.checkedAt)}
          </strong>
        </div>
      </div>

      {/* Subsystem Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Database Connectivity & Replica Set */}
        <div className="rounded-xl border border-[#E8E4D9] bg-white p-5 shadow-xs space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-[#193C32]">
              MongoDB Database
            </h2>
            <AdminStatusBadge status={health.database.status} />
          </div>
          <div className="flex justify-between">
            <span className="text-[#242923]/60">Database Name:</span>
            <span className="font-mono font-semibold text-[#193C32]">
              {health.database.databaseName}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#242923]/60">Replica Set Topology:</span>
            <span>
              {health.database.topology?.isReplicaSet
                ? `Replica Set (${health.database.topology.setName || "active"})`
                : "Standalone"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#242923]/60">ACID Transactions:</span>
            <span className="font-semibold text-emerald-800">
              {health.database.topology?.supportsTransactions
                ? "Supported"
                : "Unavailable"}
            </span>
          </div>
          <p className="pt-2 border-t border-[#E8E4D9] text-[11px] text-[#242923]/70">
            {health.database.atlasTierNote}
          </p>
        </div>

        {/* Index Verification */}
        <div className="rounded-xl border border-[#E8E4D9] bg-white p-5 shadow-xs space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-[#193C32]">
              Database Index Verification
            </h2>
            <AdminStatusBadge status={health.indexes.status} />
          </div>
          <div className="flex justify-between">
            <span className="text-[#242923]/60">Collections Checked:</span>
            <span className="font-semibold">
              {health.indexes.collectionsChecked} / 13
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#242923]/60">Expected Explicit Indexes:</span>
            <span className="font-semibold">{health.indexes.expectedCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#242923]/60">Observed Explicit Indexes:</span>
            <span className="font-bold text-[#193C32]">
              {health.indexes.observedNonDefaultCount}
            </span>
          </div>
          <p className="pt-2 border-t border-[#E8E4D9] text-[11px] text-[#242923]/70">
            Managed idempotently via <code>npm run db:ensure-indexes</code> (
            <code>scripts/ensure-indexes.js</code>).
          </p>
        </div>

        {/* Rate Limiting */}
        <div className="rounded-xl border border-[#E8E4D9] bg-white p-5 shadow-xs space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-[#193C32]">
              Persistent Rate Limiting
            </h2>
            <AdminStatusBadge status={health.rateLimiting.status} />
          </div>
          <div className="flex justify-between">
            <span className="text-[#242923]/60">HMAC Secret Status:</span>
            <span className="font-medium">
              {health.rateLimiting.hmacSecretConfigured}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#242923]/60">Enforced Policies:</span>
            <span className="font-semibold">
              {health.rateLimiting.policiesCount} scopes (incl.{" "}
              <code>admin-mutation</code>)
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#242923]/60">Active Window Buckets:</span>
            <span className="font-mono">
              {health.rateLimiting.activeBucketsCount}
            </span>
          </div>
        </div>

        {/* Email Provider */}
        <div className="rounded-xl border border-[#E8E4D9] bg-white p-5 shadow-xs space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-[#193C32]">
              Transactional Email
            </h2>
            <AdminStatusBadge status={health.emailProvider.status} />
          </div>
          <div className="flex justify-between">
            <span className="text-[#242923]/60">Provider:</span>
            <span className="font-semibold">
              {health.emailProvider.provider}
            </span>
          </div>
          <p className="pt-2 border-t border-[#E8E4D9] text-[11px] text-[#242923]/70">
            {health.emailProvider.healthNote}
          </p>
        </div>

        {/* Payment Gateway Boundary */}
        <div className="rounded-xl border border-[#E8E4D9] bg-white p-5 shadow-xs space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-[#193C32]">
              Payment &amp; Payout Gateway
            </h2>
            <AdminStatusBadge status={health.paymentGateway.status} />
          </div>
          <div className="flex justify-between">
            <span className="text-[#242923]/60">Gateway Integration:</span>
            <span className="font-semibold">
              {health.paymentGateway.provider}
            </span>
          </div>
          <p className="pt-2 border-t border-[#E8E4D9] text-[11px] text-[#242923]/70">
            {health.paymentGateway.detail}
          </p>
        </div>

        {/* Security & Background Maintenance */}
        <div className="rounded-xl border border-[#E8E4D9] bg-white p-5 shadow-xs space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-[#193C32]">
              Security &amp; Maintenance
            </h2>
            <AdminStatusBadge status={health.backgroundJobs.status} />
          </div>
          <div className="flex justify-between">
            <span className="text-[#242923]/60">Canonical App URL:</span>
            <span>{health.securityConfig.appUrlConfigured}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#242923]/60">Admin Email Allowlist:</span>
            <span>{health.securityConfig.adminAllowlistStatus}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#242923]/60">Cloudflare Proxy Trust:</span>
            <span>{health.securityConfig.cloudflareProxyTrust}</span>
          </div>
          <p className="pt-2 border-t border-[#E8E4D9] text-[11px] text-[#242923]/70">
            {health.backgroundJobs.detail}
          </p>
        </div>
      </div>
    </div>
  );
}
