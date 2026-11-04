import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/mongodb";
import { validateCustomerReferralCode } from "@/lib/referrals/service";
import { enforceIpRateLimit } from "@/lib/auth/rateLimit";
import { validateSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
};

export async function GET(request: NextRequest) {
  // 1. Rate limiting on public code validation
  const { blockedResponse } = await enforceIpRateLimit({
    request,
    policy: "referralValidation",
    rateLimitExceededMessage:
      "Too many code verification attempts. Please wait a moment.",
  });
  if (blockedResponse) {
    return blockedResponse;
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code") || "";

  if (!code.trim()) {
    return NextResponse.json(
      {
        valid: false,
        code: "",
        discountPercent: 0,
        message: "No referral code provided.",
        error: "MISSING_CODE",
      },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const db = await getDb();

    // Check optional current session to detect self-referral attempts
    let currentUserId: string | null = null;
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (sessionCookie) {
      const sessionResult = await validateSession(db, sessionCookie);
      if (sessionResult) {
        currentUserId = sessionResult.user._id.toString();
      }
    }

    const validation = await validateCustomerReferralCode(
      db,
      code,
      currentUserId
    );

    return NextResponse.json(validation, {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
  } catch {
    return NextResponse.json(
      {
        valid: false,
        code,
        discountPercent: 0,
        message: "Referral validation service unavailable.",
        error: "SERVICE_UNAVAILABLE",
      },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }
}
