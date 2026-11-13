import React, { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/mongodb";
import { getEntitlementsCollection } from "@/lib/db/models";
import { validateSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { RedeemClient } from "./RedeemClient";

export const metadata: Metadata = {
  title: "Redeem Promotional Licence — LingoPDF",
  description: "Redeem your 100% complimentary single-use promotional licence code for LingoPDF.",
  robots: {
    index: false,
    follow: false,
  },
};

export const instant = false;

async function RedeemPageContent() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/account/redeem")}`);
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
          We could not load your redemption portal right now. Please try again shortly.
        </p>
      </div>
    );
  }

  const sessionResult = await validateSession(db, sessionToken);
  if (!sessionResult || !sessionResult.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/account/redeem")}`);
  }

  const user = sessionResult.user;

  // Check if user already holds an active or suspended entitlement for "german"
  const entitlementsCol = await getEntitlementsCollection(db);
  const existingEntitlement = await entitlementsCol.findOne({
    userId: user._id,
    productSlug: "german",
    status: { $in: ["active", "suspended"] },
  });

  return (
    <RedeemClient
      userEmail={user.email}
      hasExistingEntitlement={Boolean(existingEntitlement)}
    />
  );
}

export default function AccountRedeemPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-xs text-[var(--color-charcoal)]/60">
          Loading redemption portal...
        </div>
      }
    >
      <RedeemPageContent />
    </Suspense>
  );
}
