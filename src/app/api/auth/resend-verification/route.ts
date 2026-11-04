import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/mongodb";
import { getUsersCollection } from "@/lib/db/models";
import { resendVerificationSchema } from "@/lib/auth/validation";
import {
  generateOpaqueToken,
  hashToken,
  VERIFICATION_EXPIRATION_HOURS,
} from "@/lib/auth/session";
import {
  enforceIpRateLimit,
  enforceEmailRateLimit,
} from "@/lib/auth/rateLimit";
import { sendVerificationEmail } from "@/lib/email/resend";
import { enforceCsrfProtection } from "@/lib/security/csrf";
import { logger } from "@/lib/observability/logger";

export async function POST(request: NextRequest) {
  try {
    // 1. CSRF / Origin validation
    const csrfBlocked = enforceCsrfProtection(
      request,
      "auth.resend_verification"
    );
    if (csrfBlocked) {
      return csrfBlocked;
    }

    // 2. Persistent IP rate limiting (max 3 resend attempts per 15 minutes per IP)
    const { blockedResponse: ipBlocked } = await enforceIpRateLimit({
      request,
      policy: "resendVerification",
      rateLimitExceededMessage:
        "Too many resend attempts. Please wait before trying again.",
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

    const parsed = resendVerificationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid email format", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { email } = parsed.data;

    // 4. Persistent Email/Account rate limiting (max 3 resend attempts per 15 minutes per email)
    // Checked before user lookup so enumeration is impossible
    const emailBlocked = await enforceEmailRateLimit({
      policy: "resendVerification",
      email,
      rateLimitExceededMessage:
        "Too many resend attempts. Please wait before trying again.",
    });
    if (emailBlocked) {
      return emailBlocked;
    }

    // 5. Connect to database
    let db;
    try {
      db = await getDb();
    } catch (dbErr) {
      logger.error("auth_resend_verification_db_unavailable", { error: dbErr });
      return NextResponse.json(
        {
          error: "Database service unavailable. Please check system configuration.",
          code: "DB_UNAVAILABLE",
        },
        { status: 503 }
      );
    }

    const users = await getUsersCollection(db);

    // 6. Find user by normalized email
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

    // 7. Generate fresh single-use verification token
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

    // 8. Send email
    await sendVerificationEmail({
      to: user.email,
      name: user.name,
      token: rawToken,
    });

    return NextResponse.json(genericResponse, { status: 200 });
  } catch (error) {
    logger.error("auth_resend_verification_unexpected_error", { error });
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
