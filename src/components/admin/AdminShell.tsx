"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LingoPDFLogo } from "@/components/LingoPDFLogo";

export interface AdminNavItem {
  label: string;
  href: string;
  group: "Operations" | "Commerce & Finance" | "Growth & Partners" | "Governance";
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: "Overview", href: "/admin", group: "Operations" },
  { label: "Users", href: "/admin/users", group: "Operations" },
  { label: "Entitlements", href: "/admin/entitlements", group: "Operations" },
  { label: "Purchases", href: "/admin/purchases", group: "Commerce & Finance" },
  { label: "Refunds", href: "/admin/refunds", group: "Commerce & Finance" },
  { label: "Disputes", href: "/admin/disputes", group: "Commerce & Finance" },
  { label: "Promotions", href: "/admin/promotions", group: "Growth & Partners" },
  { label: "Referrals", href: "/admin/referrals", group: "Growth & Partners" },
  { label: "Commissions", href: "/admin/commissions", group: "Growth & Partners" },
  { label: "Payouts", href: "/admin/payouts", group: "Growth & Partners" },
  { label: "Audit Logs", href: "/admin/audit-logs", group: "Governance" },
  { label: "Settings", href: "/admin/settings", group: "Governance" },
  { label: "System Health", href: "/admin/system", group: "Governance" },
];

const NAV_GROUPS: AdminNavItem["group"][] = [
  "Operations",
  "Commerce & Finance",
  "Growth & Partners",
  "Governance",
];

const BREADCRUMB_LABELS: Record<string, string> = {
  admin: "Admin Console",
  users: "Users",
  purchases: "Purchases",
  entitlements: "Entitlements",
  refunds: "Refunds",
  disputes: "Disputes & Chargebacks",
  promotions: "Promotions",
  referrals: "Referrals",
  commissions: "Commissions",
  payouts: "Payouts",
  "audit-logs": "Audit Logs",
  settings: "Settings",
  system: "System Health",
};

export interface AdminShellProps {
  adminEmail: string;
  adminName?: string | null;
  children: React.ReactNode;
}

export function AdminShell({
  adminEmail,
  adminName,
  children,
}: AdminShellProps) {
  const pathname = usePathname() || "/admin";
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const isNavItemActive = (href: string) => {
    if (href === "/admin") {
      return pathname === "/admin";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs = segments.map((seg, idx) => {
    const href = "/" + segments.slice(0, idx + 1).join("/");
    const label =
      BREADCRUMB_LABELS[seg] ||
      (seg.length === 24 ? `#${seg.slice(0, 8)}…` : seg);
    return { label, href, isLast: idx === segments.length - 1 };
  });

  const handleLogout = async () => {
    try {
      setSigningOut(true);
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      setSigningOut(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#F8F5EE] text-[#242923] font-sans">
      {/* Desktop Persistent Sidebar */}
      <aside
        aria-label="Admin Navigation Sidebar"
        className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-[#193C32] text-white border-r border-[#122B24]"
      >
        <div className="h-16 flex items-center justify-between px-5 border-b border-white/10">
          <Link
            href="/admin"
            className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D87854] rounded"
          >
            <LingoPDFLogo reversed priority className="h-7" />
            <span className="text-[11px] font-heading font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#D87854] text-white">
              Ops
            </span>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {NAV_GROUPS.map((group) => {
            const items = ADMIN_NAV_ITEMS.filter((i) => i.group === group);
            return (
              <div key={group}>
                <div className="px-2.5 mb-1.5 text-[11px] font-heading font-semibold uppercase tracking-wider text-[#E8E4D9]/60">
                  {group}
                </div>
                <ul className="space-y-0.5">
                  {items.map((item) => {
                    const active = isNavItemActive(item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            active
                              ? "bg-[#D87854] text-white font-semibold shadow-xs"
                              : "text-[#F8F5EE]/85 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          <span>{item.label}</span>
                          {active && (
                            <span
                              className="h-1.5 w-1.5 rounded-full bg-white"
                              aria-hidden="true"
                            />
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 bg-[#143028] space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[#E8E4D9]/70">
              Administrator
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Verified
            </span>
          </div>
          <div
            className="text-xs font-medium text-white truncate"
            title={adminEmail}
          >
            {adminName ? `${adminName} (${adminEmail})` : adminEmail}
          </div>
          <div className="flex items-center justify-between pt-1">
            <Link
              href="/"
              className="text-xs text-[#E8E4D9]/80 hover:text-white underline"
            >
              Public Site
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              disabled={signingOut}
              className="text-xs font-semibold text-[#D87854] hover:text-[#f0926e] cursor-pointer disabled:opacity-50"
            >
              {signingOut ? "Signing out…" : "Sign Out"}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Admin Navigation"
        >
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-[#193C32] text-white flex flex-col z-10">
            <div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
              <span className="font-heading font-bold text-base tracking-tight">
                LingoPDF Admin
              </span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-lg text-white/80 hover:bg-white/10"
                aria-label="Close navigation menu"
              >
                ✕
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
              {NAV_GROUPS.map((group) => (
                <div key={group}>
                  <div className="px-2.5 mb-1 text-[11px] font-heading font-semibold uppercase tracking-wider text-[#E8E4D9]/60">
                    {group}
                  </div>
                  <ul className="space-y-1">
                    {ADMIN_NAV_ITEMS.filter((i) => i.group === group).map(
                      (item) => {
                        const active = isNavItemActive(item.href);
                        return (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              onClick={() => setMobileOpen(false)}
                              className={`block px-3 py-2 rounded-lg text-sm font-medium ${
                                active
                                  ? "bg-[#D87854] text-white font-semibold"
                                  : "text-[#F8F5EE]/85 hover:bg-white/10"
                              }`}
                            >
                              {item.label}
                            </Link>
                          </li>
                        );
                      }
                    )}
                  </ul>
                </div>
              ))}
            </nav>
            <div className="p-4 border-t border-white/10 bg-[#143028] flex items-center justify-between text-xs">
              <span className="truncate max-w-[160px]">{adminEmail}</span>
              <button
                type="button"
                onClick={handleLogout}
                className="font-semibold text-[#D87854]"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:pl-64 min-w-0">
        {/* Top Admin Header & Breadcrumbs */}
        <header className="sticky top-0 z-30 h-16 bg-[#F8F5EE]/95 backdrop-blur-xs border-b border-[#E8E4D9] px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden inline-flex items-center justify-center p-2 rounded-lg border border-[#E8E4D9] bg-white text-[#193C32] hover:bg-[#E8E4D9]/40"
              aria-label="Open navigation menu"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                />
              </svg>
            </button>

            <nav aria-label="Breadcrumb" className="flex items-center min-w-0">
              <ol className="flex items-center gap-1.5 text-xs sm:text-sm truncate">
                {breadcrumbs.map((crumb, idx) => (
                  <li
                    key={crumb.href}
                    className="flex items-center gap-1.5 truncate"
                  >
                    {idx > 0 && (
                      <span className="text-[#242923]/40" aria-hidden="true">
                        /
                      </span>
                    )}
                    {crumb.isLast ? (
                      <span
                        className="font-heading font-semibold text-[#193C32] truncate"
                        aria-current="page"
                      >
                        {crumb.label}
                      </span>
                    ) : (
                      <Link
                        href={crumb.href}
                        className="text-[#242923]/70 hover:text-[#193C32] transition-colors"
                      >
                        {crumb.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#E8E4D9] text-[#193C32]">
              <span className="h-2 w-2 rounded-full bg-[#193C32]" />
              {adminEmail}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              disabled={signingOut}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#E8E4D9] bg-white text-[#242923] hover:border-[#D87854] hover:text-[#D87854] transition-colors cursor-pointer"
            >
              {signingOut ? "Signing out…" : "Sign Out"}
            </button>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
