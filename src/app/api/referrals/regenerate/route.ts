import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/mongodb";
import { SESSION_COOKIE_NAME, validateSession } from "@/lib/auth/session";
import { enforceIpRateLimit } from "@/lib/auth/rateLimit";
import {
  enforceCsrfProtection,
  handleCorsPreflight,
  getCorsHeaders,
} from "@/lib/security/csrf";
import { regenerateReferralCode } from "@/lib/referrals/service";
import { logger } from "@/lib/observability/logger";

function withCors(response: NextResponse, request: NextRequest): NextResponse {
  const corsHeaders = getCorsHeaders(request);
  if (corsHeaders) {
    for (const [key, value] of Object.entries(corsHeaders)) {
      response.headers.set(key, value);
    }
  }
  return response;
}

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}

export async function POST(request: NextRequest) {
  try {
    // 1. CSRF validation
    const csrfBlocked = enforceCsrfProtection(request, "referrals.regenerate", {
      requireJsonContentType: false,
    });
    if (csrfBlocked) {
      return csrfBlocked;
    }

    // 2. IP rate limiting (max 10 requests per 15 minutes)
    const { blockedResponse: ipBlocked } = await enforceIpRateLimit({
      request,
      policy: "register", // Uses 10-attempt bucket
      rateLimitExceededMessage: "Too many requests. Please try again later.",
    });
    if (ipBlocked) {
      return withCors(ipBlocked, request);
    }

    // 3. Connect to database
    let db;
    try {
      db = await getDb();
    } catch {
      return withCors(
        NextResponse.json(
          { error: "Database unavailable", code: "DB_UNAVAILABLE" },
          { status: 503 }
        ),
        request
      );
    }

    // 4. Authenticate session
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionToken) {
      return withCors(
        NextResponse.json(
          { error: "Authentication required", code: "UNAUTHORIZED" },
          { status: 401 }
        ),
        request
      );
    }

    const sessionResult = await validateSession(db, sessionToken);
    if (!sessionResult) {
      return withCors(
        NextResponse.json(
          { error: "Session expired or invalid", code: "UNAUTHORIZED" },
          { status: 401 }
        ),
        request
      );
    }

    const user = sessionResult.user;
    if (user.status === "suspended") {
      return withCors(
        NextResponse.json(
          { error: "Account suspended", code: "ACCOUNT_SUSPENDED" },
          { status: 403 }
        ),
        request
      );
    }

    // 5. Attempt code regeneration
    try {
      const newProfile = await regenerateReferralCode(db, user);
      return withCors(
        NextResponse.json(
          {
            ok: true,
            referralCode: newProfile.referralCode,
            message: "New referral code generated successfully.",
          },
          { status: 200 }
        ),
        request
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("QUOTA_NOT_EXHAUSTED")) {
        return withCors(
          NextResponse.json(
            {
              error:
                "Your current referral code has not reached its limit of 50 successful redemptions.",
              code: "QUOTA_NOT_EXHAUSTED",
            },
            { status: 400 }
          ),
          request
        );
      }
      if (msg.includes("ACTIVE_CODE_ALREADY_EXISTS")) {
        return withCors(
          NextResponse.json(
            {
              error: "An active referral code already exists.",
              code: "ACTIVE_CODE_EXISTS",
            },
            { status: 409 }
          ),
          request
        );
      }
      throw err;
    }
  } catch (error) {
    logger.error("referral_regenerate_error", { error });
    return withCors(
      NextResponse.json(
        { error: "Internal server error", code: "INTERNAL_ERROR" },
        { status: 500 }
      ),
      request
    );
  }
}
