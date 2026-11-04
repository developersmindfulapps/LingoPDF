import React, { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/mongodb";
import { validateSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { getCustomerReferralDashboardData } from "@/lib/referrals/service";
import { ReferralDashboardClient } from "./ReferralDashboardClient";
import ReferralLoading from "./loading";

export const metadata: Metadata = {
  title: "Your Referral Rewards — LingoPDF",
  description: "View and share your personal LingoPDF referral code and track your referral commissions.",
  robots: {
    index: false,
    follow: false,
  },
};

async function ReferralDashboardContent() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/account/referrals")}`);
  }

  let db;
  try {
    db = await getDb();
  } catch {
    return (
      <div className="bg-white rounded-2xl border border-red-200 p-8 text-center space-y-3">
        <h2 className="font-heading text-lg font-bold text-red-900">
          Database Service Unavailable
        </h2>
        <p className="text-xs text-[var(--color-charcoal)]/70">
          We could not load your referral dashboard right now. Please try again shortly.
        </p>
      </div>
    );
  }

  const sessionResult = await validateSession(db, sessionToken);
  if (!sessionResult) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/account/referrals")}`);
  }

  const stats = await getCustomerReferralDashboardData(db, sessionResult.user);

  return (
    <ReferralDashboardClient
      initialStats={stats}
      userName={sessionResult.user.name || null}
      userEmail={sessionResult.user.email}
    />
  );
}

export default function CustomerReferralsPage() {
  return (
    <Suspense fallback={<ReferralLoading />}>
      <ReferralDashboardContent />
    </Suspense>
  );
}
