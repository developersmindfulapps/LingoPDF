import { cookies } from "next/headers";
import { connection } from "next/server";
import { Db } from "mongodb";
import { getDb } from "@/lib/db/mongodb";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import {
  AuthenticatedAdminContext,
  authorizeAdminSessionToken,
  AdminAuthorizationFailureReason,
} from "@/lib/auth/admin";

export type ServerAdminPageAuthResult =
  | {
      authorized: true;
      status: 200;
      context: AuthenticatedAdminContext;
      db: Db;
    }
  | {
      authorized: false;
      status: 401 | 403 | 503;
      code: "UNAUTHENTICATED" | "ADMIN_ACCESS_DENIED" | "DB_UNAVAILABLE";
      reason: AdminAuthorizationFailureReason | "db_unavailable";
      error: string;
    };

/**
 * Server-side authorization guard for App Router admin pages and layouts.
 * Always verifies the `lingopdf_session` cookie against the live MongoDB
 * `sessions` and `users` collections on every request.
 *
 * Invokes Next.js `await connection()` to guarantee that session expiry,
 * cookie extraction, and database authorization strictly evaluate at request
 * time rather than during static prerendering or build-time optimization passes.
 */
export async function verifyServerAdminPageAccess(
  dbOverride?: Db
): Promise<ServerAdminPageAuthResult> {
  await connection();
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;

  let db: Db;
  try {
    db = dbOverride ?? (await getDb());
  } catch {
    return {
      authorized: false,
      status: 503,
      code: "DB_UNAVAILABLE",
      reason: "db_unavailable",
      error: "Database connection is currently unavailable.",
    };
  }

  const decision = await authorizeAdminSessionToken(db, sessionToken);
  if (!decision.authorized) {
    return {
      authorized: false,
      status: decision.status,
      code: decision.code,
      reason: decision.reason,
      error: decision.error,
    };
  }

  return {
    authorized: true,
    status: 200,
    context: decision.context,
    db,
  };
}
