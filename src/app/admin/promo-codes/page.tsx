import React from "react";
import type { Metadata } from "next";
import { verifyServerAdminPageAccess } from "@/lib/auth/adminServer";
import {
  getPromotionalCodeStats,
  listPromotionalCodes,
} from "@/lib/promoCodes/service";
import { PromoCodesClient } from "./PromoCodesClient";

export const metadata: Metadata = {
  title: "Promotional Licence Codes — LingoPDF Admin",
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

export default async function AdminPromoCodesPage({ searchParams }: PageProps) {
  const auth = await verifyServerAdminPageAccess();
  if (!auth.authorized) return null;
  const { db } = auth;

  const sp = await searchParams;
  const page = parseInt(sp.page || "1", 10);
  const limit = parseInt(sp.limit || "25", 10);
  const status = sp.status || "all";
  const q = sp.q || "";

  const [initialData, stats] = await Promise.all([
    listPromotionalCodes(db, { page, limit, status, q }),
    getPromotionalCodeStats(db),
  ]);

  return <PromoCodesClient initialData={initialData} stats={stats} />;
}
