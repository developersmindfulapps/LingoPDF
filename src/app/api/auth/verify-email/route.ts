import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/mongodb";
import { getUsersCollection } from "@/lib/db/models";
import { hashToken, sanitizeUser } from "@/lib/auth/session";
import { checkRateLimit, getClientIp } from "@/lib/auth/rateLimit";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  return handleVerification(request, token);
}

export async function POST(request: NextRequest) {
  let token: string | null = null;
  try {
    const body = await request.json();
    if (body && typeof body.token === "string") {
      token = body.token;
    }
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload", code: "INVALID_JSON" },
      { status: 400 }
    );
  }

  return handleVerification(request, token);
}

async function handleVerification(request: NextRequest, rawToken: string | null) {
  try {
    // 1. Rate limiting (max 10 verification requests per 15 minutes per IP)
    const ip = getClientIp(request);
    const rateCheck = checkRateLimit(`verify-email:${ip}`, 10, 15 * 60);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: "Too many verification attempts. Please try again later.",
          code: "RATE_LIMITED",
        },
        {
          status: 429,
          headers: { "Retry-After": rateCheck.retryAfterSeconds.toString() },
        }
      );
    }

    // 2. Validate token structure
    const trimmed = rawToken?.trim();
    if (!trimmed || trimmed.length < 32 || trimmed.length > 128) {
      return NextResponse.json(
        {
          status: "invalid",
          error: "Invalid or missing verification token.",
          code: "INVALID_TOKEN",
        },
        { status: 400 }
      );
    }

    // 3. Connect to database
    let db;
    try {
      db = await getDb();
    } catch {
      return NextResponse.json(
        {
          error: "Database service unavailable. Please check system configuration.",
          code: "DB_UNAVAILABLE",
        },
        { status: 503 }
      );
    }

    const users = await getUsersCollection(db);
    const tokenHash = hashToken(trimmed);
    const now = new Date();

    // 4. Look up user by verification token hash
    const user = await users.findOne({ emailVerificationTokenHash: tokenHash });

    if (!user) {
      return NextResponse.json(
        {
          status: "invalid",
          error: "This verification link is invalid or has already been used.",
          code: "INVALID_OR_USED_TOKEN",
        },
        { status: 400 }
      );
    }

    // 5. Check if already verified
    if (user.isEmailVerified) {
      return NextResponse.json(
        {
          status: "already_verified",
          message: "Your email address has already been verified.",
          code: "ALREADY_VERIFIED",
          user: sanitizeUser(user),
        },
        { status: 200 }
      );
    }

    // 6. Check token expiration (24 hours)
    if (user.emailVerificationExpires && user.emailVerificationExpires < now) {
      return NextResponse.json(
        {
          status: "expired",
          error:
            "This verification link has expired. Verification links are valid for 24 hours.",
          code: "TOKEN_EXPIRED",
          email: user.email,
        },
        { status: 400 }
      );
    }

    // 7. Atomically mark verified and clear token to prevent reuse
    const updated = await users.findOneAndUpdate(
      {
        _id: user._id,
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpires: { $gte: now },
      },
      {
        $set: {
          isEmailVerified: true,
          updatedAt: now,
        },
        $unset: {
          emailVerificationTokenHash: "",
          emailVerificationExpires: "",
          emailVerificationToken: "",
        },
      },
      { returnDocument: "after" }
    );

    if (!updated) {
      return NextResponse.json(
        {
          status: "invalid",
          error:
            "This verification link has already been used or expired concurrently.",
          code: "CONCURRENT_USE",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        status: "success",
        message: "Your email has been verified successfully.",
        user: sanitizeUser(updated),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[verify-email] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
