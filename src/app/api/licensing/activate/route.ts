import { NextRequest, NextResponse } from "next/server";
import { getDb, getMongoClient } from "@/lib/db/mongodb";
import { enforceIpRateLimit } from "@/lib/auth/rateLimit";
import { activateDeviceBinding } from "@/lib/licensing/service";
import { logger } from "@/lib/observability/logger";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  // 1. IP rate limiting (15 attempts per 15 minutes)
  const { blockedResponse: ipBlocked, clientIp } = await enforceIpRateLimit({
    request,
    policy: "deviceActivation",
    rateLimitExceededMessage:
      "Too many activation attempts from this network. Please wait 15 minutes.",
  });
  if (ipBlocked) return ipBlocked;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request payload.", code: "INVALID_JSON" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const code = typeof body.code === "string" ? body.code.trim() : "";
  const devicePublicKeySpki =
    typeof body.devicePublicKeySpki === "string" ? body.devicePublicKeySpki.trim() : "";
  const deviceLabel =
    typeof body.deviceLabel === "string" ? body.deviceLabel.trim().slice(0, 100) : "Chrome Extension";
  const clientVersion =
    typeof body.clientVersion === "string" ? body.clientVersion.trim().slice(0, 20) : "0.1.0";

  if (!code) {
    return NextResponse.json(
      { error: "Activation code is required.", code: "MISSING_CODE" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  if (!devicePublicKeySpki) {
    return NextResponse.json(
      { error: "Device public key is required.", code: "MISSING_DEVICE_KEY" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  let db;
  let client;
  try {
    db = await getDb();
    client = await getMongoClient();
  } catch (err) {
    logger.error("licensing_activate_db_unavailable", { error: err });
    return NextResponse.json(
      { error: "Database service unavailable. Please try again shortly.", code: "DB_UNAVAILABLE" },
      { status: 503, headers: CORS_HEADERS }
    );
  }

  try {
    const result = await activateDeviceBinding(db, client, {
      code,
      devicePublicKeySpki,
      deviceLabel,
      clientVersion,
      ipAddress: clientIp || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    if (!result.success) {
      const statusCode =
        result.code === "DEVICE_ALREADY_BOUND"
          ? 409
          : result.code === "EXPIRED_CODE" || result.code === "ALREADY_CONSUMED" || result.code === "SUPERSEDED_CODE"
          ? 410
          : 400;

      return NextResponse.json(
        { error: result.message || "Failed to activate device.", code: result.code },
        { status: statusCode, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      {
        success: true,
        deviceBindingId: result.deviceBindingId,
        lease: result.lease,
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    logger.error("licensing_activate_device_error", { error: err });
    return NextResponse.json(
      { error: "An unexpected error occurred during device activation.", code: "INTERNAL_ERROR" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
