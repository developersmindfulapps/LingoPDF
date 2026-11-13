import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb, getMongoClient } from "@/lib/db/mongodb";
import { validateSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { enforceIpRateLimit, enforceEmailRateLimit } from "@/lib/auth/rateLimit";
import { enforceCsrfProtection } from "@/lib/security/csrf";
import { redeemPromotionalCode } from "@/lib/promoCodes/service";
import { logger } from "@/lib/observability/logger";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
};

export async function POST(request: NextRequest) {
  // 1. CSRF / Origin verification
  const csrfBlocked = enforceCsrfProtection(request, "promo_code.redeem");
  if (csrfBlocked) return csrfBlocked;

  // 2. IP rate limiting (10 attempts per 15 minutes)
  const { blockedResponse: ipBlocked } = await enforceIpRateLimit({
    request,
    policy: "promoCodeRedemption",
    rateLimitExceededMessage:
      "Too many code redemption attempts from this network. Please try again in 15 minutes.",
  });
  if (ipBlocked) return ipBlocked;

  let db;
  let client;
  try {
    db = await getDb();
    client = await getMongoClient();
  } catch (err) {
    logger.error("promo_code_redeem_db_unavailable", { error: err });
    return NextResponse.json(
      { error: "Database service unavailable. Please try again shortly.", code: "DB_UNAVAILABLE" },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }

  // 3. Authenticate customer from session cookie
  let sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    try {
      const cookieStore = await cookies();
      sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    } catch {
      // In standalone test or non-request-scoped context, fallback silently
    }
  }

  if (!sessionToken) {
    return NextResponse.json(
      { error: "Please sign in to your LingoPDF account to redeem a promotional code.", code: "UNAUTHORIZED" },
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

  // 4. Account rate limiting (5 attempts per 15 minutes per email)
  const emailBlocked = await enforceEmailRateLimit({
    policy: "promoCodeRedemption",
    email: user.email,
    rateLimitExceededMessage:
      "Too many redemption attempts on this account. Please wait 15 minutes before trying again.",
  });
  if (emailBlocked) return emailBlocked;

  // 5. Parse request body
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body.", code: "INVALID_JSON" },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const code = typeof body?.code === "string" ? body.code : "";
  if (!code || typeof code !== "string" || code.trim().length === 0) {
    return NextResponse.json(
      { error: "Please enter a promotional code.", code: "CODE_REQUIRED" },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  if (code.trim().length > 64) {
    return NextResponse.json(
      { error: "Promotional code is too long.", code: "CODE_TOO_LONG" },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  // 6. Redeem promotional code atomically
  const result = await redeemPromotionalCode(db, client, {
    code,
    user,
  });

  if (!result.success) {
    return NextResponse.json(
      {
        error: result.message,
        code: result.code || "REDEMPTION_FAILED",
      },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(
    {
      message: result.message,
      entitlementId: result.entitlementId,
      code: "SUCCESS",
    },
    { status: 200, headers: NO_STORE_HEADERS }
  );
}
