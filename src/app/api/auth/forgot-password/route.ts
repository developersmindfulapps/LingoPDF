import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/mongodb";
import { getUsersCollection } from "@/lib/db/models";
import { forgotPasswordSchema } from "@/lib/auth/validation";
import {
  generateOpaqueToken,
  hashToken,
  PASSWORD_RESET_EXPIRATION_HOURS,
} from "@/lib/auth/session";
import { checkRateLimit, getClientIp } from "@/lib/auth/rateLimit";
import { sendPasswordResetEmail } from "@/lib/email/resend";

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limiting (max 5 requests per 15 minutes per IP)
    const ip = getClientIp(request);
    const rateCheck = checkRateLimit(`forgot-pw:${ip}`, 5, 15 * 60);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: "Too many password reset requests. Please try again later.",
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

    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please provide a valid email address.", code: "VALIDATION_ERROR" },
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

    // 4. Look up user by normalized lowercase email
    const user = await users.findOne({ email });

    // Always return generic response to prevent account enumeration
    const genericResponse = {
      message:
        "If an account with that email exists, we've sent instructions to reset your password.",
      code: "RESET_REQUESTED",
    };

    // If user doesn't exist or is suspended, return generic response without sending
    if (!user || user.status === "suspended") {
      return NextResponse.json(genericResponse, { status: 200 });
    }

    // 5. Generate single-use reset token and store only its SHA-256 hash
    const now = new Date();
    const rawResetToken = generateOpaqueToken();
    const resetTokenHash = hashToken(rawResetToken);
    const resetExpires = new Date(
      now.getTime() + PASSWORD_RESET_EXPIRATION_HOURS * 60 * 60 * 1000
    );

    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordResetTokenHash: resetTokenHash,
          passwordResetExpires: resetExpires,
          updatedAt: now,
        },
      }
    );

    // 6. Send password reset email
    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      token: rawResetToken,
    });

    return NextResponse.json(genericResponse, { status: 200 });
  } catch (error) {
    console.error("[forgot-password] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
