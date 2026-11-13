import React, { Suspense } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db/mongodb";
import { validateSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { getCustomerDeviceStatus } from "@/lib/licensing/service";
import { DevicesClient } from "./DevicesClient";

export const metadata = {
  title: "Device Activation & Management — LingoPDF",
  description: "Manage your active device and generate activation codes for the LingoPDF Chrome extension.",
  robots: {
    index: false,
    follow: false,
  },
};

export const instant = false;

async function AccountDevicesContent() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    redirect("/login?from=/account/devices");
  }

  const db = await getDb();
  const sessionResult = await validateSession(db, sessionToken);

  if (!sessionResult || !sessionResult.user) {
    redirect("/login?from=/account/devices");
  }

  const overview = await getCustomerDeviceStatus(db, sessionResult.user._id);

  return (
    <DevicesClient
      user={{
        id: sessionResult.user._id.toString(),
        email: sessionResult.user.email,
        name: sessionResult.user.name,
      }}
      initialOverview={overview}
    />
  );
}

export default function AccountDevicesPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-xs text-[var(--color-charcoal)]/60">
          Loading device management...
        </div>
      }
    >
      <AccountDevicesContent />
    </Suspense>
  );
}
