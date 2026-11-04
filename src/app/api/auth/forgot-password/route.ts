import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/mongodb";
import { getUsersCollection } from "@/lib/db/models";
import { forgotPasswordSchema } from "@/lib/auth/validation";
import {
  generateOpaqueToken,
  hashToken,
  PASSWORD_RESET_EXPIRATION_HOURS,
} from "@/lib/auth/session";
import {
  enforceIpRateLimit,
  enforceEmailRateLimit,
} from "@/lib/auth/rateLimit";
import { sendPasswordResetEmail } from "@/lib/email/resend";
import { enforceCsrfProtection } from "@/lib/security/csrf";
import { logger } from "@/lib/observability/logger";

export async function POST(request: NextRequest) {
  try {
    // 1. CSRF / Origin validation
    const csrfBlocked = enforceCsrfProtection(request, "auth.forgot_password");
    if (csrfBlocked) {
      return csrfBlocked;
    }

    // 2. Persistent IP rate limiting (max 5 requests per 15 minutes per IP)
    const { blockedResponse: ipBlocked } = await enforceIpRateLimit({
      request,
      policy: "forgotPassword",
      rateLimitExceededMessage:
        "Too many password reset requests. Please try again later.",
    });
    if (ipBlocked) {
      return ipBlocked;
    }

    // 3. Validate input
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

    // 4. Persistent Email/Account rate limiting (max 3 requests per 15 minutes per email)
    // Checked before user lookup so enumeration is impossible
    const emailBlocked = await enforceEmailRateLimit({
      policy: "forgotPassword",
      email,
      rateLimitExceededMessage:
        "Too many password reset requests. Please try again later.",
    });
    if (emailBlocked) {
      return emailBlocked;
    }

    // 5. Connect to database
    let db;
    try {
      db = await getDb();
    } catch (dbErr) {
      logger.error("auth_forgot_password_db_unavailable", { error: dbErr });
      return NextResponse.json(
        {
          error: "Database service unavailable. Please check system configuration.",
          code: "DB_UNAVAILABLE",
        },
        { status: 503 }
      );
    }

    const users = await getUsersCollection(db);

    // 6. Look up user by normalized lowercase email
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

    // 7. Generate single-use reset token and store only its SHA-256 hash
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

    // 8. Send password reset email
    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      token: rawResetToken,
    });

    return NextResponse.json(genericResponse, { status: 200 });
  } catch (error) {
    logger.error("auth_forgot_password_unexpected_error", { error });
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
