import { NextRequest, NextResponse } from "next/server";
import { getDb, getMongoClient } from "@/lib/db/mongodb";
import { enforceIpRateLimit } from "@/lib/auth/rateLimit";
import { renewLicenceLease } from "@/lib/licensing/service";
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
  // 1. IP rate limiting
  const { blockedResponse: ipBlocked } = await enforceIpRateLimit({
    request,
    policy: "licenceRenewal",
    rateLimitExceededMessage: "Too many renewal requests. Please wait a few moments.",
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

  const deviceBindingId = typeof body.deviceBindingId === "string" ? body.deviceBindingId.trim() : "";
  const challenge = typeof body.challenge === "string" ? body.challenge.trim() : "";
  const signature = typeof body.signature === "string" ? body.signature.trim() : "";

  if (!deviceBindingId || !challenge || !signature) {
    return NextResponse.json(
      { error: "deviceBindingId, challenge, and signature are required.", code: "MISSING_FIELDS" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  let db;
  let client;
  try {
    db = await getDb();
    client = await getMongoClient();
  } catch (err) {
    logger.error("licensing_renew_db_unavailable", { error: err });
    return NextResponse.json(
      { error: "Database service unavailable.", code: "DB_UNAVAILABLE" },
      { status: 503, headers: CORS_HEADERS }
    );
  }

  try {
    const result = await renewLicenceLease(db, client, {
      deviceBindingId,
      challenge,
      signature,
    });

    if (!result.success) {
      const status =
        result.code === "DEVICE_REVOKED" || result.code === "DEVICE_SUSPENDED" || result.code === "ENTITLEMENT_INACTIVE"
          ? 403
          : result.code === "INVALID_DEVICE_SIGNATURE"
          ? 401
          : 400;

      return NextResponse.json(
        { error: result.message || "Failed to renew licence lease.", code: result.code },
        { status, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      {
        success: true,
        lease: result.lease,
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    logger.error("licensing_renew_error", { error: err });
    return NextResponse.json(
      { error: "An unexpected error occurred during licence renewal.", code: "INTERNAL_ERROR" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
