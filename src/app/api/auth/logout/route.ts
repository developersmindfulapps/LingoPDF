import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/mongodb";
import { revokeSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { clearSessionCookie } from "@/lib/auth/cookies";

export async function POST(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

    if (sessionCookie) {
      try {
        const db = await getDb();
        await revokeSession(db, sessionCookie);
      } catch (dbErr) {
        // Even if DB operation fails, proceed to clear client cookie
        console.warn("[logout] Could not delete session record from DB:", dbErr);
      }
    }

    const response = NextResponse.json(
      { message: "Logged out successfully." },
      { status: 200 }
    );

    // Clear session cookie on the client
    clearSessionCookie(response);

    return response;
  } catch (error) {
    console.error("[logout] Unexpected error:", error);
    const response = NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
    clearSessionCookie(response);
    return response;
  }
}
