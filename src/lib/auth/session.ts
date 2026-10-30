import * as argon2 from "argon2";
import crypto from "crypto";
import { ObjectId, Db } from "mongodb";
import { getSessionsCollection, getUsersCollection, UserDocument } from "@/lib/db/models";

export const SESSION_COOKIE_NAME = "lingopdf_session";
export const SESSION_EXPIRATION_DAYS = 30;
export const VERIFICATION_EXPIRATION_HOURS = 24;
export const PASSWORD_RESET_EXPIRATION_HOURS = 1;

/**
 * Hashes a plaintext password using Argon2id with recommended security parameters.
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 1,
  });
}

/**
 * Verifies a plaintext password against an Argon2id hash.
 */
export async function verifyPassword(hash: string, plaintext: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plaintext);
  } catch {
    return false;
  }
}

/**
 * Computes a SHA-256 hash of a token for secure database storage.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Constant-time comparison of two hex hashes.
 */
export function timingSafeHashMatch(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Generates a high-entropy cryptographically random opaque token (32 bytes -> 64 hex chars).
 */
export function generateOpaqueToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Creates a new session in the database for the user.
 * Returns the plaintext opaque token to send to the client in an httpOnly cookie.
 */
export async function createSession(
  db: Db,
  userId: ObjectId,
  metadata?: { userAgent?: string; ipAddress?: string }
): Promise<{ token: string; expiresAt: Date }> {
  const sessions = await getSessionsCollection(db);
  const token = generateOpaqueToken();
  const tokenHash = hashToken(token);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_EXPIRATION_DAYS * 24 * 60 * 60 * 1000);

  await sessions.insertOne({
    _id: new ObjectId(),
    userId,
    tokenHash,
    createdAt: now,
    expiresAt,
    lastActiveAt: now,
    userAgent: metadata?.userAgent,
    ipAddress: metadata?.ipAddress,
  });

  return { token, expiresAt };
}

/**
 * Validates a plaintext session token against MongoDB.
 * If valid and not expired, returns the associated user.
 * Also touches lastActiveAt.
 */
export async function validateSession(
  db: Db,
  token: string
): Promise<{ user: UserDocument; sessionId: ObjectId } | null> {
  if (!token || typeof token !== "string" || token.length < 32) {
    return null;
  }

  const sessions = await getSessionsCollection(db);
  const users = await getUsersCollection(db);
  const tokenHash = hashToken(token);

  const session = await sessions.findOne({ tokenHash });
  if (!session) {
    return null;
  }

  const now = new Date();
  if (session.expiresAt <= now) {
    // Expired session: cleanup
    await sessions.deleteOne({ _id: session._id });
    return null;
  }

  const user = await users.findOne({ _id: session.userId });
  if (!user || user.status === "suspended") {
    return null;
  }

  // Update activity timestamp asynchronously (non-blocking)
  sessions
    .updateOne({ _id: session._id }, { $set: { lastActiveAt: now } })
    .catch(() => {});

  return { user, sessionId: session._id };
}

/**
 * Revokes an individual session by its token.
 */
export async function revokeSession(db: Db, token: string): Promise<boolean> {
  if (!token) return false;
  const sessions = await getSessionsCollection(db);
  const tokenHash = hashToken(token);
  const result = await sessions.deleteOne({ tokenHash });
  return result.deletedCount > 0;
}

/**
 * Revokes all sessions for a specific user (e.g. on password change or reset).
 */
export async function revokeAllUserSessions(db: Db, userId: ObjectId): Promise<number> {
  const sessions = await getSessionsCollection(db);
  const result = await sessions.deleteMany({ userId });
  return result.deletedCount;
}

/**
 * Safe client user representation (never exposes passwordHash or internal security tokens).
 */
export function sanitizeUser(user: UserDocument) {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name || null,
    isEmailVerified: user.isEmailVerified,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
  };
}
