import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/mongodb";
import { getUsersCollection } from "@/lib/db/models";
import { resetPasswordSchema } from "@/lib/auth/validation";
import {
  hashPassword,
  hashToken,
  revokeAllUserSessions,
} from "@/lib/auth/session";
import { checkRateLimit, getClientIp } from "@/lib/auth/rateLimit";

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limiting (max 10 requests per 15 minutes per IP)
    const ip = getClientIp(request);
    const rateCheck = checkRateLimit(`reset-pw:${ip}`, 10, 15 * 60);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: "Too many reset attempts. Please try again later.",
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
    const tokenHash = hashToken(token);
    const now = new Date();

    // 4. Look up user by password reset token hash
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

    // 5. Verify token has not expired (1 hour)
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

    // 6. Hash new password with Argon2id
    const newPasswordHash = await hashPassword(password);

    // 7. Atomically consume token and update password to prevent reuse
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

    // 8. Revoke all active sessions for this account across all devices
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
    console.error("[reset-password] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
