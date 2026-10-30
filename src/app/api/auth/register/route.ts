import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db/mongodb";
import { getUsersCollection } from "@/lib/db/models";
import { registerSchema } from "@/lib/auth/validation";
import {
  hashPassword,
  createSession,
  sanitizeUser,
  generateOpaqueToken,
  hashToken,
  VERIFICATION_EXPIRATION_HOURS,
} from "@/lib/auth/session";
import { setSessionCookie } from "@/lib/auth/cookies";
import { checkRateLimit, getClientIp } from "@/lib/auth/rateLimit";
import { sendVerificationEmail } from "@/lib/email/resend";

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limiting (max 5 registration attempts per 15 minutes per IP)
    const ip = getClientIp(request);
    const rateCheck = checkRateLimit(`register:${ip}`, 5, 15 * 60);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: "Too many registration attempts. Please try again later.",
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

    const { email, password, name } = parsed.data;

    // 3. Connect to MongoDB
    let db;
    try {
      db = await getDb();
    } catch (dbErr) {
      console.error("[register] Database connection error:", dbErr);
      return NextResponse.json(
        {
          error: "Database service unavailable. Please check system configuration.",
          code: "DB_UNAVAILABLE",
        },
        { status: 503 }
      );
    }

    const users = await getUsersCollection(db);

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
      status: "active" as const,
      isEmailVerified: false,
      emailVerificationTokenHash: verificationTokenHash,
      emailVerificationExpires: verificationExpires,
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
      ipAddress: ip,
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
    console.error("[register] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
