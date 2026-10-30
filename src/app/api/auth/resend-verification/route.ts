import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/mongodb";
import { getUsersCollection } from "@/lib/db/models";
import { resendVerificationSchema } from "@/lib/auth/validation";
import {
  generateOpaqueToken,
  hashToken,
  VERIFICATION_EXPIRATION_HOURS,
} from "@/lib/auth/session";
import { checkRateLimit, getClientIp } from "@/lib/auth/rateLimit";
import { sendVerificationEmail } from "@/lib/email/resend";

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limiting (max 3 resend attempts per 15 minutes per IP)
    const ip = getClientIp(request);
    const rateCheck = checkRateLimit(`resend-verif:${ip}`, 3, 15 * 60);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: "Too many resend attempts. Please wait before trying again.",
          code: "RATE_LIMITED",
        },
        {
          status: 429,
          headers: { "Retry-After": rateCheck.retryAfterSeconds.toString() },
        }
      );
    }

    // 2. Validate input
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload", code: "INVALID_JSON" },
        { status: 400 }
      );
    }

    const parsed = resendVerificationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid email format", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { email } = parsed.data;

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

    // 4. Find user by normalized email
    const user = await users.findOne({ email });

    // Always return a generic success message to prevent user enumeration
    const genericResponse = {
      message:
        "If an unverified account exists with this email address, a new verification link has been sent.",
      code: "VERIFICATION_SENT",
    };

    if (!user || user.status === "suspended" || user.isEmailVerified) {
      return NextResponse.json(genericResponse, { status: 200 });
    }

    // 5. Generate fresh single-use verification token
    const now = new Date();
    const rawToken = generateOpaqueToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(
      now.getTime() + VERIFICATION_EXPIRATION_HOURS * 60 * 60 * 1000
    );

    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          emailVerificationTokenHash: tokenHash,
          emailVerificationExpires: expiresAt,
          updatedAt: now,
        },
      }
    );

    // 6. Send email
    await sendVerificationEmail({
      to: user.email,
      name: user.name,
      token: rawToken,
    });

    return NextResponse.json(genericResponse, { status: 200 });
  } catch (error) {
    console.error("[resend-verification] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
