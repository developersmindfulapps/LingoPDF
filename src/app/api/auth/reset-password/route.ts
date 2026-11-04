import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/mongodb";
import { getUsersCollection } from "@/lib/db/models";
import { resetPasswordSchema } from "@/lib/auth/validation";
import {
  hashPassword,
  hashToken,
  revokeAllUserSessions,
} from "@/lib/auth/session";
import { enforceIpRateLimit } from "@/lib/auth/rateLimit";
import { enforceCsrfProtection } from "@/lib/security/csrf";
import { logger } from "@/lib/observability/logger";

export async function POST(request: NextRequest) {
  try {
    // 1. CSRF / Origin validation
    const csrfBlocked = enforceCsrfProtection(request, "auth.reset_password");
    if (csrfBlocked) {
      return csrfBlocked;
    }

    // 2. Persistent IP rate limiting (max 10 requests per 15 minutes per IP)
    const { blockedResponse } = await enforceIpRateLimit({
      request,
      policy: "resetPassword",
      rateLimitExceededMessage:
        "Too many reset attempts. Please try again later.",
    });
    if (blockedResponse) {
      return blockedResponse;
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

    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        {
          error: firstIssue?.message || "Invalid password or token format",
          code: "VALIDATION_ERROR",
        },
        { status: 400 }
      );
    }

    const { token, password } = parsed.data;

    // 4. Connect to database
    let db;
    try {
      db = await getDb();
    } catch (dbErr) {
      logger.error("auth_reset_password_db_unavailable", { error: dbErr });
      return NextResponse.json(
        {
          error: "Database service unavailable. Please check system configuration.",
          code: "DB_UNAVAILABLE",
        },
        { status: 503 }
      );
    }

    const users = await getUsersCollection(db);
    const tokenHash = hashToken(token);
    const now = new Date();

    // 5. Look up user by password reset token hash
    const user = await users.findOne({ passwordResetTokenHash: tokenHash });

    if (!user) {
      return NextResponse.json(
        {
          error:
            "This password reset link is invalid or has already been used.",
          code: "INVALID_OR_USED_TOKEN",
        },
        { status: 400 }
      );
    }

    if (user.status === "suspended") {
      return NextResponse.json(
        {
          error: "This account has been suspended. Please contact support.",
          code: "ACCOUNT_SUSPENDED",
        },
        { status: 403 }
      );
    }

    // 6. Verify token has not expired (1 hour)
    if (user.passwordResetExpires && user.passwordResetExpires < now) {
      return NextResponse.json(
        {
          error:
            "This password reset link has expired. Please request a new one.",
          code: "TOKEN_EXPIRED",
        },
        { status: 400 }
      );
    }

    // 7. Hash new password with Argon2id
    const newPasswordHash = await hashPassword(password);

    // 8. Atomically consume token and update password to prevent reuse
    const updated = await users.findOneAndUpdate(
      {
        _id: user._id,
        passwordResetTokenHash: tokenHash,
        passwordResetExpires: { $gte: now },
      },
      {
        $set: {
          passwordHash: newPasswordHash,
          updatedAt: now,
        },
        $unset: {
          passwordResetTokenHash: "",
          passwordResetExpires: "",
          passwordResetToken: "",
        },
      },
      { returnDocument: "after" }
    );

    if (!updated) {
      return NextResponse.json(
        {
          error:
            "This password reset link has already been used or expired concurrently.",
          code: "CONCURRENT_USE",
        },
        { status: 400 }
      );
    }

    // 9. Revoke all active sessions for this account across all devices
    await revokeAllUserSessions(db, user._id);

    return NextResponse.json(
      {
        message:
          "Your password has been reset successfully. You can now sign in with your new password.",
        code: "PASSWORD_RESET_SUCCESS",
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error("auth_reset_password_unexpected_error", { error });
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
