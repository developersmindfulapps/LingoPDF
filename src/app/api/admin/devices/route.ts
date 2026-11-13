import { NextRequest, NextResponse } from "next/server";
import { getDb, getMongoClient } from "@/lib/db/mongodb";
import { requireAdminRequest } from "@/lib/auth/admin";
import { enforceIpRateLimit } from "@/lib/auth/rateLimit";
import { enforceCsrfProtection } from "@/lib/security/csrf";
import {
  listAdminDeviceBindings,
  getAdminDeviceStats,
  replaceDeviceControlledWorkflow,
  suspendDeviceBindingAdminWorkflow,
  revokeDeviceBindingAdminWorkflow,
} from "@/lib/licensing/service";
import { logger } from "@/lib/observability/logger";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
};

export async function GET(request: NextRequest) {
  let db;
  try {
    db = await getDb();
  } catch (err) {
    logger.error("admin_devices_db_unavailable", { error: err });
    return NextResponse.json(
      { error: "Database unavailable", code: "DB_UNAVAILABLE" },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }

  const auth = await requireAdminRequest(request, db);
  if (!auth.authorized) {
    return auth.deniedResponse;
  }

  const url = new URL(request.url);
  const page = Math.max(parseInt(url.searchParams.get("page") || "1", 10), 1);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "25", 10), 1), 100);
  const status = url.searchParams.get("status") || "all";
  const search = url.searchParams.get("q") || "";
  const skip = (page - 1) * limit;

  try {
    const [listResult, stats] = await Promise.all([
      listAdminDeviceBindings(db, { status, search, limit, skip }),
      getAdminDeviceStats(db),
    ]);

    return NextResponse.json(
      {
        ...listResult,
        page,
        stats,
      },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  } catch (err) {
    logger.error("admin_devices_list_error", { error: err });
    return NextResponse.json(
      { error: "Failed to list device bindings", code: "INTERNAL_ERROR" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

export async function POST(request: NextRequest) {
  // 1. CSRF validation
  const csrfBlocked = enforceCsrfProtection(request, "admin.devices");
  if (csrfBlocked) return csrfBlocked;

  // 2. IP rate limit
  const { blockedResponse: ipBlocked } = await enforceIpRateLimit({
    request,
    policy: "adminMutation",
    rateLimitExceededMessage: "Too many admin requests. Please wait a moment.",
  });
  if (ipBlocked) return ipBlocked;

  let db;
  let client;
  try {
    db = await getDb();
    client = await getMongoClient();
  } catch (err) {
    logger.error("admin_devices_post_db_unavailable", { error: err });
    return NextResponse.json(
      { error: "Database unavailable", code: "DB_UNAVAILABLE" },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }

  // 3. Admin Authentication
  const auth = await requireAdminRequest(request, db);
  if (!auth.authorized) {
    return auth.deniedResponse;
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload", code: "INVALID_JSON" },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const action = typeof body.action === "string" ? body.action : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  if (!reason || reason.length < 5) {
    return NextResponse.json(
      { error: "A detailed reason (at least 5 characters) is required.", code: "MISSING_REASON" },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const actorContext = {
    userId: auth.context.userId,
    email: auth.context.email,
    role: "admin" as const,
  };

  try {
    if (action === "replace_device") {
      const entitlementId = typeof body.entitlementId === "string" ? body.entitlementId : "";
      if (!entitlementId) {
        return NextResponse.json(
          { error: "entitlementId is required.", code: "MISSING_ENTITLEMENT_ID" },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      const res = await replaceDeviceControlledWorkflow(db, client, entitlementId, reason, actorContext);
      return NextResponse.json(res, { status: 200, headers: NO_STORE_HEADERS });
    }

    if (action === "suspend_device") {
      const deviceBindingId = typeof body.deviceBindingId === "string" ? body.deviceBindingId : "";
      if (!deviceBindingId) {
        return NextResponse.json(
          { error: "deviceBindingId is required.", code: "MISSING_DEVICE_ID" },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      const res = await suspendDeviceBindingAdminWorkflow(db, client, deviceBindingId, reason, actorContext);
      return NextResponse.json(res, { status: 200, headers: NO_STORE_HEADERS });
    }

    if (action === "revoke_device") {
      const deviceBindingId = typeof body.deviceBindingId === "string" ? body.deviceBindingId : "";
      if (!deviceBindingId) {
        return NextResponse.json(
          { error: "deviceBindingId is required.", code: "MISSING_DEVICE_ID" },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      const res = await revokeDeviceBindingAdminWorkflow(db, client, deviceBindingId, reason, actorContext);
      return NextResponse.json(res, { status: 200, headers: NO_STORE_HEADERS });
    }

    return NextResponse.json(
      { error: "Unsupported device management action.", code: "UNKNOWN_ACTION" },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to execute device action";
    logger.error("admin_device_action_error", { error: err, action });
    return NextResponse.json(
      { error: message, code: "ACTION_FAILED" },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }
}
