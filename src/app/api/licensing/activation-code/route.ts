import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb, getMongoClient } from "@/lib/db/mongodb";
import { validateSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { enforceIpRateLimit, enforceEmailRateLimit } from "@/lib/auth/rateLimit";
import { enforceCsrfProtection } from "@/lib/security/csrf";
import { generateActivationCodeForUser } from "@/lib/licensing/service";
import { logger } from "@/lib/observability/logger";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
};

export async function POST(request: NextRequest) {
  // 1. CSRF / Origin verification
  const csrfBlocked = enforceCsrfProtection(request, "licensing.generate_activation_code");
  if (csrfBlocked) return csrfBlocked;

  // 2. IP rate limiting
  const { blockedResponse: ipBlocked } = await enforceIpRateLimit({
    request,
    policy: "activationCodeGeneration",
    rateLimitExceededMessage:
      "Too many activation code generation requests from this IP. Please wait 15 minutes.",
  });
  if (ipBlocked) return ipBlocked;

  let db;
  let client;
  try {
    db = await getDb();
    client = await getMongoClient();
  } catch (err) {
    logger.error("licensing_activation_code_db_unavailable", { error: err });
    return NextResponse.json(
      { error: "Database service unavailable. Please try again shortly.", code: "DB_UNAVAILABLE" },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }

  // 3. Customer Session Authentication
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
      { error: "Please sign in to generate an activation code.", code: "UNAUTHORIZED" },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  const sessionResult = await validateSession(db, sessionToken);
  if (!sessionResult || !sessionResult.user) {
    return NextResponse.json(
      { error: "Your session has expired. Please sign in again.", code: "SESSION_EXPIRED" },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  const user = sessionResult.user;

  // 4. Email rate limiting
  const emailBlocked = await enforceEmailRateLimit({
    email: user.email,
    policy: "activationCodeGeneration",
    rateLimitExceededMessage:
      "Too many activation code requests for this account. Please wait 15 minutes.",
  });
  if (emailBlocked) return emailBlocked;

  // 5. Generate activation code
  try {
    const result = await generateActivationCodeForUser(db, client, user);
    if (!result.success) {
      return NextResponse.json(
        { error: result.message || "Failed to generate activation code.", code: result.code },
        { status: result.code === "DEVICE_ALREADY_BOUND" ? 409 : 400, headers: NO_STORE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        success: true,
        activationCode: result.activationCode,
        codeMasked: result.codeMasked,
        expiresAt: result.expiresAt ? result.expiresAt.toISOString() : null,
      },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  } catch (err) {
    logger.error("licensing_generate_activation_code_error", { error: err });
    return NextResponse.json(
      { error: "An unexpected error occurred while generating the activation code.", code: "INTERNAL_ERROR" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
