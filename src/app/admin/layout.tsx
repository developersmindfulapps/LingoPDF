import React, { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { verifyServerAdminPageAccess } from "@/lib/auth/adminServer";
import { AdminShell } from "@/components/admin/AdminShell";
import AdminLoading from "./loading";

export const metadata: Metadata = {
  title: "Admin Operations Console — LingoPDF",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * The administrative console performs live database queries, session
 * token validation, and financial authorization checks at request time.
 * Under Next.js 16 `cacheComponents`, `instant = false` opts this segment
 * out of instant static shell prerendering, while `await connection()` inside
 * `verifyServerAdminPageAccess()` guarantees request-time evaluation.
 */
export const instant = false;

async function AdminAuthenticatedGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await verifyServerAdminPageAccess();

  if (!auth.authorized) {
    if (auth.status === 401) {
      redirect("/login");
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F5EE] px-4 py-16 text-[#242923]">
        <div className="max-w-md w-full rounded-2xl bg-white border border-[#E8E4D9] p-8 shadow-xs text-center space-y-4">
          <div className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-red-100 text-red-900">
            HTTP {auth.status} • {auth.code}
          </div>
          <h1 className="font-heading text-2xl font-bold text-[#193C32]">
            Administrative Access Denied
          </h1>
          <p className="text-sm text-[#242923]/80 leading-relaxed">
            {auth.error} Only active, email-verified accounts with explicit
            server-side administrator privileges may access the LingoPDF
            Operations Console.
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <Link
              href="/"
              className="px-4 py-2 rounded-lg bg-[#193C32] text-white text-xs font-semibold hover:bg-[#122B24]"
            >
              Return to LingoPDF Home
            </Link>
            <Link
              href="/login"
              className="px-4 py-2 rounded-lg border border-[#E8E4D9] bg-white text-xs font-semibold text-[#242923] hover:bg-[#E8E4D9]/40"
            >
              Switch Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AdminShell
      adminEmail={auth.context.email}
      adminName={auth.context.user.name || null}
    >
      <Suspense fallback={<AdminLoading />}>{children}</Suspense>
    </AdminShell>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <AdminAuthenticatedGuard>{children}</AdminAuthenticatedGuard>
    </Suspense>
  );
}
