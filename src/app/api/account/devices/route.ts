import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db/mongodb";
import { validateSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { getCustomerDeviceStatus } from "@/lib/licensing/service";
import { logger } from "@/lib/observability/logger";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
};

export async function GET(request: NextRequest) {
  let db;
  try {
    db = await getDb();
  } catch (err) {
    logger.error("account_devices_db_unavailable", { error: err });
    return NextResponse.json(
      { error: "Database service unavailable.", code: "DB_UNAVAILABLE" },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }

  // Authenticate customer from session cookie
  let sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    try {
      const cookieStore = await cookies();
      sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    } catch {
      // In test context
    }
  }

  if (!sessionToken) {
    return NextResponse.json(
      { error: "Please sign in to view device status.", code: "UNAUTHORIZED" },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  const sessionResult = await validateSession(db, sessionToken);
  if (!sessionResult || !sessionResult.user) {
    return NextResponse.json(
      { error: "Session expired. Please sign in again.", code: "SESSION_EXPIRED" },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const status = await getCustomerDeviceStatus(db, sessionResult.user._id);
    return NextResponse.json(status, { status: 200, headers: NO_STORE_HEADERS });
  } catch (err) {
    logger.error("account_devices_fetch_error", { error: err });
    return NextResponse.json(
      { error: "Failed to load device status.", code: "INTERNAL_ERROR" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
