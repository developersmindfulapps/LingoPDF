import React from "react";
import type { Metadata } from "next";
import { verifyServerAdminPageAccess } from "@/lib/auth/adminServer";
import {
  listAdminDeviceBindings,
  getAdminDeviceStats,
} from "@/lib/licensing/service";
import { AdminDevicesClient } from "./AdminDevicesClient";

export const metadata: Metadata = {
  title: "Devices & Activations — LingoPDF Admin",
  robots: {
    index: false,
    follow: false,
  },
};

export const instant = false;

interface PageProps {
  searchParams: Promise<{
    status?: string;
    q?: string;
    page?: string;
    limit?: string;
  }>;
}

export default async function AdminDevicesPage({ searchParams }: PageProps) {
  const auth = await verifyServerAdminPageAccess();
  if (!auth.authorized) return null;
  const { db } = auth;

  const sp = await searchParams;
  const page = Math.max(parseInt(sp.page || "1", 10), 1);
  const limit = Math.min(Math.max(parseInt(sp.limit || "25", 10), 1), 100);
  const status = sp.status || "all";
  const search = sp.q || "";
  const skip = (page - 1) * limit;

  const [initialData, stats] = await Promise.all([
    listAdminDeviceBindings(db, { status, search, limit, skip }),
    getAdminDeviceStats(db),
  ]);

  // Serialize ObjectIds and Dates for client
  const serializedItems = initialData.items.map((item) => ({
    _id: item._id.toString(),
    entitlementId: item.entitlementId.toString(),
    userId: item.userId.toString(),
    userEmail: item.userEmail,
    productEdition: item.productEdition,
    devicePublicKeyHash: item.devicePublicKeyHash,
    deviceLabel: item.deviceLabel,
    clientVersion: item.clientVersion,
    status: item.status,
    boundAt: item.boundAt.toISOString(),
    lastValidatedAt: item.lastValidatedAt.toISOString(),
    leaseExpiresAt: item.leaseExpiresAt.toISOString(),
    offlineGraceExpiresAt: item.offlineGraceExpiresAt.toISOString(),
    revokedAt: item.revokedAt ? item.revokedAt.toISOString() : null,
    revokedBy: item.revokedBy,
    revocationReason: item.revocationReason,
    suspendedAt: item.suspendedAt ? item.suspendedAt.toISOString() : null,
    suspensionReason: item.suspensionReason,
  }));

  return (
    <AdminDevicesClient
      initialData={{
        items: serializedItems,
        total: initialData.total,
        page,
        limit,
      }}
      stats={stats}
    />
  );
}
