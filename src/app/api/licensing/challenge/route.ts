import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/mongodb";
import { enforceIpRateLimit } from "@/lib/auth/rateLimit";
import { createLicenceChallenge } from "@/lib/licensing/service";
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
  // 1. IP rate limiting (60 attempts per 15 minutes)
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
  if (!deviceBindingId) {
    return NextResponse.json(
      { error: "deviceBindingId is required.", code: "MISSING_DEVICE_ID" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  let db;
  try {
    db = await getDb();
  } catch (err) {
    logger.error("licensing_challenge_db_unavailable", { error: err });
    return NextResponse.json(
      { error: "Database service unavailable.", code: "DB_UNAVAILABLE" },
      { status: 503, headers: CORS_HEADERS }
    );
  }

  try {
    const result = await createLicenceChallenge(db, deviceBindingId);
    if (!result.success) {
      const status =
        result.code === "DEVICE_REVOKED" ? 403 : result.code === "DEVICE_SUSPENDED" ? 403 : 400;
      return NextResponse.json(
        { error: result.message || "Failed to create renewal challenge.", code: result.code },
        { status, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      {
        success: true,
        challenge: result.challenge,
        expiresAt: result.expiresAt ? result.expiresAt.toISOString() : null,
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    logger.error("licensing_create_challenge_error", { error: err });
    return NextResponse.json(
      { error: "An unexpected error occurred generating the challenge.", code: "INTERNAL_ERROR" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
