import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/mongodb";
import { revokeSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { clearSessionCookie } from "@/lib/auth/cookies";
import { enforceIpRateLimit } from "@/lib/auth/rateLimit";
import { enforceCsrfProtection } from "@/lib/security/csrf";
import { logger } from "@/lib/observability/logger";

export async function POST(request: NextRequest) {
  try {
    // 1. CSRF / Origin validation (logout is a body-less POST request)
    const csrfBlocked = enforceCsrfProtection(request, "auth.logout", {
      requireJsonContentType: false,
    });
    if (csrfBlocked) {
      return csrfBlocked;
    }

    // 2. Persistent IP rate limiting (max 20 logout requests per 15 minutes per IP)
    const { blockedResponse } = await enforceIpRateLimit({
      request,
      policy: "logout",
      rateLimitExceededMessage:
        "Too many logout requests. Please try again later.",
    });
    if (blockedResponse) {
      return blockedResponse;
    }

    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

    if (sessionCookie) {
      try {
        const db = await getDb();
        await revokeSession(db, sessionCookie);
      } catch (dbErr) {
        // Even if DB operation fails, proceed to clear client cookie
        logger.warn("auth_logout_db_session_delete_failed", { error: dbErr });
      }
    }

    const response = NextResponse.json(
      { message: "Logged out successfully." },
      { status: 200 }
    );

    // Clear session cookie on the client
    clearSessionCookie(response);

    return response;
  } catch (error) {
    logger.error("auth_logout_unexpected_error", { error });
    const response = NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
    clearSessionCookie(response);
    return response;
  }
}
