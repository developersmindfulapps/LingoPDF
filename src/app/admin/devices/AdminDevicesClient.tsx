"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface SerializedDeviceBinding {
  _id: string;
  entitlementId: string;
  userId: string;
  userEmail: string;
  productEdition: string;
  devicePublicKeyHash: string;
  deviceLabel: string;
  clientVersion: string;
  status: "active" | "suspended" | "revoked";
  boundAt: string;
  lastValidatedAt: string;
  leaseExpiresAt: string;
  offlineGraceExpiresAt: string;
  revokedAt: string | null;
  revokedBy: string | null;
  revocationReason: string | null;
  suspendedAt: string | null;
  suspensionReason: string | null;
}

interface AdminDevicesClientProps {
  initialData: {
    items: SerializedDeviceBinding[];
    total: number;
    page: number;
    limit: number;
  };
  stats: {
    total: number;
    active: number;
    suspended: number;
    revoked: number;
  };
}

export function AdminDevicesClient({ initialData, stats }: AdminDevicesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentStatus = searchParams.get("status") || "all";
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");

  // Action Modals
  const [selectedDevice, setSelectedDevice] = useState<SerializedDeviceBinding | null>(null);
  const [modalType, setModalType] = useState<"replace" | "suspend" | "revoke" | null>(null);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleFilterStatus = (status: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (status === "all") {
      params.delete("status");
    } else {
      params.set("status", status);
    }
    params.set("page", "1");
    router.push(`/admin/devices?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (searchQuery.trim()) {
      params.set("q", searchQuery.trim());
    } else {
      params.delete("q");
    }
    params.set("page", "1");
    router.push(`/admin/devices?${params.toString()}`);
  };

  const handleExecuteAction = async () => {
    if (!selectedDevice || !modalType) return;
    if (!reason.trim() || reason.trim().length < 5) {
      setActionError("A detailed reason of at least 5 characters is required.");
      return;
    }

    setIsSubmitting(true);
    setActionError(null);

    try {
      const payload: Record<string, unknown> = {
        action:
          modalType === "replace"
            ? "replace_device"
            : modalType === "suspend"
            ? "suspend_device"
            : "revoke_device",
        reason: reason.trim(),
      };

      if (modalType === "replace") {
        payload.entitlementId = selectedDevice.entitlementId;
      } else {
        payload.deviceBindingId = selectedDevice._id;
      }

      const res = await fetch("/api/admin/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Action failed.");
      }

      // Close modal and refresh
      setModalType(null);
      setSelectedDevice(null);
      setReason("");
      router.refresh();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to execute action");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold text-[#193C32]">Devices & Activations</h1>
        <p className="text-sm text-[#242923]/70 mt-1">
          Monitor extension device bindings, verify public key hashes, and perform controlled device replacements.
        </p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-[#E8E4D9] shadow-sm">
          <div className="text-xs font-semibold text-[#242923]/60 uppercase tracking-wider">Total Bindings</div>
          <div className="text-2xl font-heading font-bold text-[#193C32] mt-1">{stats.total}</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-[#E8E4D9] shadow-sm">
          <div className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Active Devices</div>
          <div className="text-2xl font-heading font-bold text-emerald-700 mt-1">{stats.active}</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-[#E8E4D9] shadow-sm">
          <div className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Suspended</div>
          <div className="text-2xl font-heading font-bold text-amber-700 mt-1">{stats.suspended}</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-[#E8E4D9] shadow-sm">
          <div className="text-xs font-semibold text-rose-800 uppercase tracking-wider">Revoked</div>
          <div className="text-2xl font-heading font-bold text-rose-700 mt-1">{stats.revoked}</div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 bg-[#E8E4D9] p-1 rounded-xl w-full sm:w-auto">
          {["all", "active", "suspended", "revoked"].map((tab) => (
            <button
              key={tab}
              onClick={() => handleFilterStatus(tab)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition ${
                currentStatus === tab
                  ? "bg-white text-[#193C32] shadow-sm"
                  : "text-[#242923]/70 hover:text-[#193C32]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-72">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#242923]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search email, label, key hash..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-[#E8E4D9] bg-white focus:outline-none focus:ring-2 focus:ring-[#193C32]/20"
          />
        </form>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#E8E4D9] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8F5EE] border-b border-[#E8E4D9] text-[#242923]/70 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Customer Email</th>
                <th className="px-5 py-3">Device Label</th>
                <th className="px-5 py-3">Key Hash (Ed25519)</th>
                <th className="px-5 py-3">Bound At</th>
                <th className="px-5 py-3">Last Validated</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E4D9]">
              {initialData.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-[#242923]/60">
                    No device bindings found.
                  </td>
                </tr>
              ) : (
                initialData.items.map((item) => (
                  <tr key={item._id} className="hover:bg-[#F8F5EE]/50 transition">
                    <td className="px-5 py-3.5 font-medium text-[#193C32]">
                      <div>{item.userEmail}</div>
                      <div className="text-[10px] text-[#242923]/50 font-mono mt-0.5">
                        Entitlement: {item.entitlementId.slice(0, 8)}…
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-[#242923]">{item.deviceLabel}</div>
                      <div className="text-[10px] text-[#242923]/60">v{item.clientVersion}</div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[11px] text-[#242923]/70">
                      {item.devicePublicKeyHash.slice(0, 8)}…{item.devicePublicKeyHash.slice(-8)}
                    </td>
                    <td className="px-5 py-3.5 text-[#242923]/70">
                      {new Date(item.boundAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-3.5 text-[#242923]/70">
                      {new Date(item.lastValidatedAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          item.status === "active"
                            ? "bg-emerald-100 text-emerald-800"
                            : item.status === "suspended"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-2">
                      {item.status === "active" && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedDevice(item);
                              setModalType("replace");
                              setReason("");
                              setActionError(null);
                            }}
                            className="px-2.5 py-1 text-xs font-medium text-[#193C32] bg-[#E8E4D9]/60 hover:bg-[#E8E4D9] rounded-lg transition"
                          >
                            Replace
                          </button>
                          <button
                            onClick={() => {
                              setSelectedDevice(item);
                              setModalType("suspend");
                              setReason("");
                              setActionError(null);
                            }}
                            className="px-2.5 py-1 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg transition"
                          >
                            Suspend
                          </button>
                        </>
                      )}
                      {item.status !== "revoked" && (
                        <button
                          onClick={() => {
                            setSelectedDevice(item);
                            setModalType("revoke");
                            setReason("");
                            setActionError(null);
                          }}
                          className="px-2.5 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Modal */}
      {modalType && selectedDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-[#E8E4D9] shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 font-heading text-lg font-bold text-[#193C32]">
              {modalType === "replace" && "Replace Device (Admin-Assisted)"}
              {modalType === "suspend" && "Suspend Device Binding"}
              {modalType === "revoke" && "Revoke Device Binding"}
            </div>

            <p className="text-xs text-[#242923]/80 leading-relaxed">
              {modalType === "replace" && (
                <>
                  This will <strong>revoke</strong> the current active device binding for{" "}
                  <strong>{selectedDevice.userEmail}</strong> and clear the entitlement&apos;s active device
                  binding. The customer will immediately be able to generate a fresh activation code from their
                  account to bind their new device.
                </>
              )}
              {modalType === "suspend" && (
                <>
                  This will temporarily <strong>suspend</strong> device renewal for{" "}
                  <strong>{selectedDevice.userEmail}</strong>. The device will be blocked from online renewal.
                </>
              )}
              {modalType === "revoke" && (
                <>
                  This will permanently <strong>revoke</strong> this device binding for{" "}
                  <strong>{selectedDevice.userEmail}</strong>.
                </>
              )}
            </p>

            {actionError && (
              <div className="p-3 bg-red-50 text-red-800 text-xs rounded-xl border border-red-200">
                {actionError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#242923] mb-1">
                Reason for Audit Log (Required)
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Customer reported changing laptop; verified via ticket #1042"
                className="w-full p-2.5 text-xs rounded-xl border border-[#E8E4D9] focus:outline-none focus:ring-2 focus:ring-[#193C32]/20"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setModalType(null);
                  setSelectedDevice(null);
                }}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-medium text-[#242923]/70 hover:bg-[#F8F5EE] rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteAction}
                disabled={isSubmitting}
                className={`px-4 py-2 text-xs font-medium text-white rounded-xl transition disabled:opacity-50 ${
                  modalType === "revoke"
                    ? "bg-rose-700 hover:bg-rose-800"
                    : modalType === "suspend"
                    ? "bg-amber-700 hover:bg-amber-800"
                    : "bg-[#193C32] hover:bg-[#193C32]/90"
                }`}
              >
                {isSubmitting ? "Executing..." : "Confirm Action"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
