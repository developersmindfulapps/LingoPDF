import { Db, ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/mongodb";
import {
  getSessionsCollection,
  getUsersCollection,
  UserDocument,
  UserRole,
} from "@/lib/db/models";
import {
  hashToken,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";
import { logger } from "@/lib/observability/logger";

export const USER_ROLES = {
  customer: "customer",
  admin: "admin",
} as const;

export const FORBIDDEN_ROLE_ESCALATION_FIELDS = [
  "role",
  "roles",
  "isAdmin",
  "is_admin",
  "permissions",
  "adminPermissions",
  "privileges",
  "accessLevel",
] as const;

export interface AuthenticatedAdminContext {
  user: UserDocument;
  userId: ObjectId;
  email: string;
  role: "admin";
  sessionId: ObjectId;
}

export type AdminAuthorizationFailureReason =
  | "missing_session_token"
  | "invalid_or_expired_session"
  | "user_not_found"
  | "account_suspended"
  | "email_not_verified"
  | "insufficient_role"
  | "not_in_admin_allowlist";

export type AdminAuthorizationResult =
  | {
      authorized: true;
      status: 200;
      context: AuthenticatedAdminContext;
    }
  | {
      authorized: false;
      status: 401 | 403;
      code: "UNAUTHENTICATED" | "ADMIN_ACCESS_DENIED";
      reason: AdminAuthorizationFailureReason;
      error: string;
    };

/**
 * Resolves the authoritative role of a user document.
 * Defaults strictly to "customer" whenever `role` is missing, undefined, or unrecognized.
 * Never promotes an existing user implicitly.
 */
export function resolveUserRole(
  user: Partial<UserDocument> | { role?: UserRole | string } | null | undefined
): UserRole {
  if (user && user.role === "admin") {
    return "admin";
  }
  return "customer";
}

/**
 * Parses the optional comma-separated `ADMIN_EMAIL_ALLOWLIST` environment variable.
 * When configured with one or more emails, acts as an additional defense-in-depth
 * allowlist on top of `user.role === "admin"` in MongoDB.
 */
export function getConfiguredAdminEmailAllowlist(): Set<string> | null {
  const raw = process.env.ADMIN_EMAIL_ALLOWLIST?.trim();
  if (!raw) {
    return null;
  }

  const emails = raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);

  if (emails.length === 0) {
    return null;
  }

  return new Set(emails);
}

/**
 * Inspects a client-supplied JSON payload and rejects any attempt to supply
 * privilege or role fields (`role`, `isAdmin`, `permissions`, etc.).
 */
export function detectClientRoleEscalationAttempt(
  payload: unknown
): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  for (const field of FORBIDDEN_ROLE_ESCALATION_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(record, field)) {
      return field;
    }
  }

  return null;
}

/**
 * Authorizes an admin session token strictly against the live MongoDB `users` and `sessions`
 * collections. Deny by default:
 * 1. Requires a valid, non-expired session in `sessions`.
 * 2. Re-queries the live `users` document by `_id` (never trusts client claims or stale session state).
 * 3. Requires `user.status === "active"`.
 * 4. Requires `user.isEmailVerified === true`.
 * 5. Requires `resolveUserRole(user) === "admin"`.
 * 6. If `ADMIN_EMAIL_ALLOWLIST` is configured, requires `user.email` to be present in the allowlist.
 */
export async function authorizeAdminSessionToken(
  db: Db,
  sessionToken: string | null | undefined
): Promise<AdminAuthorizationResult> {
  if (
    !sessionToken ||
    typeof sessionToken !== "string" ||
    sessionToken.trim().length < 32
  ) {
    return {
      authorized: false,
      status: 401,
      code: "UNAUTHENTICATED",
      reason: "missing_session_token",
      error: "Authentication required.",
    };
  }

  const sessionsCollection = await getSessionsCollection(db);
  const tokenHash = hashToken(sessionToken);
  const session = await sessionsCollection.findOne({ tokenHash });

  if (!session) {
    return {
      authorized: false,
      status: 401,
      code: "UNAUTHENTICATED",
      reason: "invalid_or_expired_session",
      error: "Invalid or expired session.",
    };
  }

  const now = new Date();
  if (session.expiresAt <= now) {
    await sessionsCollection.deleteOne({ _id: session._id });
    return {
      authorized: false,
      status: 401,
      code: "UNAUTHENTICATED",
      reason: "invalid_or_expired_session",
      error: "Invalid or expired session.",
    };
  }

  // Verify against the authoritative user document in `users`
  const usersCollection = await getUsersCollection(db);
  const liveUser = await usersCollection.findOne({
    _id: session.userId,
  });

  if (!liveUser) {
    return {
      authorized: false,
      status: 401,
      code: "UNAUTHENTICATED",
      reason: "user_not_found",
      error: "Account not found.",
    };
  }

  if (liveUser.status !== "active") {
    logger.security("admin_auth_denied_suspended", {
      userId: liveUser._id.toString(),
    });
    return {
      authorized: false,
      status: 403,
      code: "ADMIN_ACCESS_DENIED",
      reason: "account_suspended",
      error: "Admin access denied.",
    };
  }

  // Touch session activity asynchronously
  sessionsCollection
    .updateOne({ _id: session._id }, { $set: { lastActiveAt: now } })
    .catch(() => {});

  if (liveUser.isEmailVerified !== true) {
    logger.security("admin_auth_denied_unverified_email", {
      userId: liveUser._id.toString(),
    });
    return {
      authorized: false,
      status: 403,
      code: "ADMIN_ACCESS_DENIED",
      reason: "email_not_verified",
      error: "Admin access requires a verified email address.",
    };
  }

  const role = resolveUserRole(liveUser);
  if (role !== "admin") {
    logger.security("admin_auth_denied_insufficient_role", {
      userId: liveUser._id.toString(),
      resolvedRole: role,
    });
    return {
      authorized: false,
      status: 403,
      code: "ADMIN_ACCESS_DENIED",
      reason: "insufficient_role",
      error: "Admin access denied.",
    };
  }

  const allowlist = getConfiguredAdminEmailAllowlist();
  if (allowlist && !allowlist.has(liveUser.email.trim().toLowerCase())) {
    logger.security("admin_auth_denied_allowlist_mismatch", {
      userId: liveUser._id.toString(),
    });
    return {
      authorized: false,
      status: 403,
      code: "ADMIN_ACCESS_DENIED",
      reason: "not_in_admin_allowlist",
      error: "Admin access denied.",
    };
  }

  return {
    authorized: true,
    status: 200,
    context: {
      user: liveUser,
      userId: liveUser._id,
      email: liveUser.email,
      role: "admin",
      sessionId: session._id,
    },
  };
}

/**
 * Route-level server-side admin guard for Next.js route handlers.
 * Extracts the `lingopdf_session` httpOnly cookie, verifies admin authorization
 * against MongoDB, and returns either the authenticated admin context or a
 * deny-by-default HTTP 401/403/503 `NextResponse`.
 */
export async function requireAdminRequest(
  request: NextRequest,
  dbOverride?: Db
): Promise<
  | {
      authorized: true;
      context: AuthenticatedAdminContext;
      deniedResponse: null;
    }
  | {
      authorized: false;
      context: null;
      deniedResponse: NextResponse;
    }
> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value || null;

  let db: Db;
  try {
    db = dbOverride ?? (await getDb());
  } catch (err) {
    logger.error("admin_auth_db_unavailable", { error: err });
    return {
      authorized: false,
      context: null,
      deniedResponse: NextResponse.json(
        {
          error: "Service temporarily unavailable.",
          code: "DB_UNAVAILABLE",
        },
        {
          status: 503,
          headers: {
            "Cache-Control": "private, no-store, no-cache, must-revalidate",
          },
        }
      ),
    };
  }

  const decision = await authorizeAdminSessionToken(db, token);
  if (!decision.authorized) {
    return {
      authorized: false,
      context: null,
      deniedResponse: NextResponse.json(
        {
          error: decision.error,
          code: decision.code,
        },
        {
          status: decision.status,
          headers: {
            "Cache-Control": "private, no-store, no-cache, must-revalidate",
          },
        }
      ),
    };
  }

  return {
    authorized: true,
    context: decision.context,
    deniedResponse: null,
  };
}
