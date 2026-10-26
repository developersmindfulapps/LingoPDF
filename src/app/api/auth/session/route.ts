import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/mongodb";
import {
  validateSession,
  sanitizeUser,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionCookie) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    let db;
    try {
      db = await getDb();
    } catch (dbErr) {
      console.error("[session] Database connection error:", dbErr);
      return NextResponse.json(
        {
          error: "Database service unavailable",
          code: "DB_UNAVAILABLE",
          user: null,
        },
        { status: 503 }
      );
    }

    const sessionResult = await validateSession(db, sessionCookie);
    if (!sessionResult) {
      // Session expired or invalid
      return NextResponse.json({ user: null }, { status: 200 });
    }

    return NextResponse.json(
      { user: sanitizeUser(sessionResult.user) },
      { status: 200 }
    );
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "digest" in error &&
      (error as { digest: string }).digest === "NEXT_PRERENDER_INTERRUPTED"
    ) {
      throw error;
    }
    console.error("[session] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR", user: null },
      { status: 500 }
    );
  }
}
