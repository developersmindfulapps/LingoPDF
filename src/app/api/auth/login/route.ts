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
import { checkRateLimit, getClientIp } from "@/lib/auth/rateLimit";

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limiting (max 10 login attempts per 15 minutes per IP)
    const ip = getClientIp(request);
    const rateCheck = checkRateLimit(`login:${ip}`, 10, 15 * 60);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: "Too many login attempts. Please try again later.",
          code: "RATE_LIMITED",
        },
        {
          status: 429,
          headers: { "Retry-After": rateCheck.retryAfterSeconds.toString() },
        }
      );
    }

    // 2. Body parsing and validation
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload", code: "INVALID_JSON" },
        { status: 400 }
      );
    }

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid email or password format",
          code: "VALIDATION_ERROR",
        },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    // 3. Connect to MongoDB
    let db;
    try {
      db = await getDb();
    } catch (dbErr) {
      console.error("[login] Database connection error:", dbErr);
      return NextResponse.json(
        {
          error: "Database service unavailable. Please check system configuration.",
          code: "DB_UNAVAILABLE",
        },
        { status: 503 }
      );
    }

    const users = await getUsersCollection(db);

    // 4. Find user by normalized email
    const user = await users.findOne({ email });
    if (!user) {
      // Timing-safe response: generic invalid credentials message
      return NextResponse.json(
        { error: "Invalid email or password", code: "INVALID_CREDENTIALS" },
        { status: 401 }
      );
    }

    // 5. Account status check
    if (user.status === "suspended") {
      return NextResponse.json(
        {
          error: "Your account has been suspended. Please contact support.",
          code: "ACCOUNT_SUSPENDED",
        },
        { status: 403 }
      );
    }

    // 6. Verify password with Argon2id
    const passwordMatch = await verifyPassword(user.passwordHash, password);
    if (!passwordMatch) {
      return NextResponse.json(
        { error: "Invalid email or password", code: "INVALID_CREDENTIALS" },
        { status: 401 }
      );
    }

    // 7. Create database-backed session
    const userAgent = request.headers.get("user-agent") || undefined;
    const { token, expiresAt } = await createSession(db, user._id, {
      userAgent,
      ipAddress: ip,
    });

    // 8. Prepare safe response
    const response = NextResponse.json(
      {
        user: sanitizeUser(user),
        message: "Login successful.",
      },
      { status: 200 }
    );

    // 9. Set secure httpOnly session cookie
    setSessionCookie(response, token, expiresAt);

    return response;
  } catch (error) {
    console.error("[login] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
