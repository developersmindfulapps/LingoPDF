import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db/mongodb";
import { getUsersCollection } from "@/lib/db/models";
import { registerSchema } from "@/lib/auth/validation";
import { findActiveReferralProfileByCode } from "@/lib/referrals/service";
import { detectClientRoleEscalationAttempt } from "@/lib/auth/admin";
import {
  hashPassword,
  createSession,
  sanitizeUser,
  generateOpaqueToken,
  hashToken,
  VERIFICATION_EXPIRATION_HOURS,
} from "@/lib/auth/session";
import { setSessionCookie } from "@/lib/auth/cookies";
import { enforceIpRateLimit } from "@/lib/auth/rateLimit";
import { sendVerificationEmail } from "@/lib/email/resend";
import { enforceCsrfProtection } from "@/lib/security/csrf";
import { logger } from "@/lib/observability/logger";

export async function POST(request: NextRequest) {
  try {
    // 1. CSRF / Origin validation
    const csrfBlocked = enforceCsrfProtection(request, "auth.register");
    if (csrfBlocked) {
      return csrfBlocked;
    }

    // 2. Persistent IP rate limiting (max 5 registration attempts per 15 minutes per IP)
    const { blockedResponse, clientIp } = await enforceIpRateLimit({
      request,
      policy: "register",
      rateLimitExceededMessage:
        "Too many registration attempts. Please try again later.",
    });
    if (blockedResponse) {
      return blockedResponse;
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

    const forbiddenRoleField = detectClientRoleEscalationAttempt(body);
    if (forbiddenRoleField) {
      logger.security("auth_register_role_escalation_rejected", {
        forbiddenField: forbiddenRoleField,
      });
      return NextResponse.json(
        {
          error: "Client-supplied privilege or role assignment is forbidden.",
          code: "ROLE_ESCALATION_FORBIDDEN",
        },
        { status: 403 }
      );
    }

    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        {
          error: firstIssue?.message || "Invalid registration data",
          code: "VALIDATION_ERROR",
        },
        { status: 400 }
      );
    }

    const { email, password, name, referralCode } = parsed.data;

    // 3. Connect to MongoDB
    let db;
    try {
      db = await getDb();
    } catch (dbErr) {
      logger.error("auth_register_db_unavailable", { error: dbErr });
      return NextResponse.json(
        {
          error: "Database service unavailable. Please check system configuration.",
          code: "DB_UNAVAILABLE",
        },
        { status: 503 }
      );
    }

    const users = await getUsersCollection(db);

    // 4. Validate referral code if provided (without consuming slot or creating commission)
    let referredByCode: string | null = null;
    let referredByUserId: ObjectId | null = null;
    let referralAttributedAt: Date | null = null;

    if (referralCode && referralCode.trim()) {
      const activeReferrerProfile = await findActiveReferralProfileByCode(
        db,
        referralCode
      );
      if (activeReferrerProfile) {
        referredByCode = activeReferrerProfile.referralCode;
        referredByUserId = activeReferrerProfile.userId;
        referralAttributedAt = new Date();
      }
    }

    // 4. Check for duplicate email (case-insensitive normalized)
    const existing = await users.findOne({ email });
    if (existing) {
      return NextResponse.json(
        {
          error: "An account with this email already exists.",
          code: "EMAIL_EXISTS",
        },
        { status: 409 }
      );
    }

    // 5. Hash password using Argon2id
    const passwordHash = await hashPassword(password);

    // 6. Generate unverified account with hashed single-use verification token
    const now = new Date();
    const rawVerificationToken = generateOpaqueToken();
    const verificationTokenHash = hashToken(rawVerificationToken);
    const verificationExpires = new Date(
      now.getTime() + VERIFICATION_EXPIRATION_HOURS * 60 * 60 * 1000
    );

    const newUser = {
      _id: new ObjectId(),
      email,
      passwordHash,
      name: name || undefined,
      role: "customer" as const,
      status: "active" as const,
      isEmailVerified: false,
      emailVerificationTokenHash: verificationTokenHash,
      emailVerificationExpires: verificationExpires,
      referredByCode,
      referredByUserId,
      referralAttributedAt,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await users.insertOne(newUser);
    } catch (insertErr: unknown) {
      // MongoDB duplicate key error code 11000
      if (
        typeof insertErr === "object" &&
        insertErr !== null &&
        "code" in insertErr &&
        (insertErr as { code: number }).code === 11000
      ) {
        return NextResponse.json(
          {
            error: "An account with this email already exists.",
            code: "EMAIL_EXISTS",
          },
          { status: 409 }
        );
      }
      throw insertErr;
    }

    // 7. Send verification email through Resend
    // Success is reported ONLY when the email provider accepts the send request.
    const emailResult = await sendVerificationEmail({
      to: email,
      name: name || undefined,
      token: rawVerificationToken,
    });

    if (!emailResult.success || !emailResult.accepted) {
      // Rollback user creation to maintain consistency
      await users.deleteOne({ _id: newUser._id });

      if (emailResult.isDomainUnverified) {
        return NextResponse.json(
          {
            error:
              "Registration is temporarily paused while sender domain verification is completing. Please try again shortly.",
            code: "DOMAIN_NOT_VERIFIED",
          },
          { status: 503 }
        );
      }

      return NextResponse.json(
        {
          error:
            "Unable to send verification email. Please try again later.",
          code: "EMAIL_DELIVERY_FAILED",
        },
        { status: 502 }
      );
    }

    // 8. Create user session upon registration
    const userAgent = request.headers.get("user-agent") || undefined;
    const { token, expiresAt } = await createSession(db, newUser._id, {
      userAgent,
      ipAddress: clientIp || undefined,
    });

    // 9. Prepare safe response
    const response = NextResponse.json(
      {
        user: sanitizeUser(newUser),
        emailAccepted: true,
        message:
          "Registration successful. A verification link has been sent to your email.",
      },
      { status: 201 }
    );

    // 10. Set secure httpOnly session cookie
    setSessionCookie(response, token, expiresAt);

    return response;
  } catch (error) {
    logger.error("auth_register_unexpected_error", { error });
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
