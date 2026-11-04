import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/mongodb";
import { getUsersCollection } from "@/lib/db/models";
import { loginSchema } from "@/lib/auth/validation";
import {
  verifyPassword,
  createSession,
  sanitizeUser,
} from "@/lib/auth/session";
import { setSessionCookie } from "@/lib/auth/cookies";
import {
  enforceIpRateLimit,
  enforceEmailRateLimit,
} from "@/lib/auth/rateLimit";
import {
  enforceCsrfProtection,
  handleCorsPreflight,
  getCorsHeaders,
} from "@/lib/security/csrf";
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

/**
 * Handles CORS preflight OPTIONS requests for /api/auth/login.
 * Validates origin against explicit production allowlist.
 */
export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}

export async function POST(request: NextRequest) {
  try {
    // 1. CSRF / Origin validation
    const csrfBlocked = enforceCsrfProtection(request, "auth.login");
    if (csrfBlocked) {
      return csrfBlocked;
    }

    // 2. Persistent IP rate limiting (max 10 login attempts per 15 minutes per IP)
    const { blockedResponse: ipBlocked, clientIp } = await enforceIpRateLimit({
      request,
      policy: "login",
      rateLimitExceededMessage:
        "Too many login attempts. Please try again later.",
    });
    if (ipBlocked) {
      return withCors(ipBlocked, request);
    }

    // 3. Body parsing and validation
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return withCors(
        NextResponse.json(
          { error: "Invalid JSON payload", code: "INVALID_JSON" },
          { status: 400 }
        ),
        request
      );
    }

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return withCors(
        NextResponse.json(
          {
            error: "Invalid email or password format",
            code: "VALIDATION_ERROR",
          },
          { status: 400 }
        ),
        request
      );
    }

    const { email, password } = parsed.data;

    // 4. Persistent Email/Account rate limiting (max 5 login attempts per 15 minutes per account)
    const emailBlocked = await enforceEmailRateLimit({
      policy: "login",
      email,
      rateLimitExceededMessage:
        "Too many login attempts. Please try again later.",
    });
    if (emailBlocked) {
      return withCors(emailBlocked, request);
    }

    // 5. Connect to MongoDB
    let db;
    try {
      db = await getDb();
    } catch (dbErr) {
      logger.error("auth_login_db_unavailable", { error: dbErr });
      return withCors(
        NextResponse.json(
          {
            error: "Database service unavailable. Please check system configuration.",
            code: "DB_UNAVAILABLE",
          },
          { status: 503 }
        ),
        request
      );
    }

    const users = await getUsersCollection(db);

    // 6. Find user by normalized email
    const user = await users.findOne({ email });
    if (!user) {
      // Timing-safe response: generic invalid credentials message
      return withCors(
        NextResponse.json(
          { error: "Invalid email or password", code: "INVALID_CREDENTIALS" },
          { status: 401 }
        ),
        request
      );
    }

    // 7. Account status check
    if (user.status === "suspended") {
      return withCors(
        NextResponse.json(
          {
            error: "Your account has been suspended. Please contact support.",
            code: "ACCOUNT_SUSPENDED",
          },
          { status: 403 }
        ),
        request
      );
    }

    // 8. Verify password with Argon2id
    const passwordMatch = await verifyPassword(user.passwordHash, password);
    if (!passwordMatch) {
      return withCors(
        NextResponse.json(
          { error: "Invalid email or password", code: "INVALID_CREDENTIALS" },
          { status: 401 }
        ),
        request
      );
    }

    // 9. Create database-backed session
    const userAgent = request.headers.get("user-agent") || undefined;
    const { token, expiresAt } = await createSession(db, user._id, {
      userAgent,
      ipAddress: clientIp || undefined,
    });

    // 10. Prepare safe response
    const response = NextResponse.json(
      {
        user: sanitizeUser(user),
        message: "Login successful.",
      },
      { status: 200 }
    );

    // 11. Set secure httpOnly session cookie
    setSessionCookie(response, token, expiresAt);

    // 12. Attach CORS headers for authorized origin
    return withCors(response, request);
  } catch (error) {
    logger.error("auth_login_unexpected_error", { error });
    return withCors(
      NextResponse.json(
        { error: "Internal server error", code: "INTERNAL_ERROR" },
        { status: 500 }
      ),
      request
    );
  }
}
