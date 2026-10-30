import { ObjectId, Collection, Db } from "mongodb";

export type AccountStatus = "active" | "suspended";

export interface UserDocument {
  _id: ObjectId;
  email: string; // Stored in normalized lowercase
  passwordHash: string;
  name?: string;
  status: AccountStatus;
  isEmailVerified: boolean;
  emailVerificationTokenHash?: string; // SHA-256 hash of single-use verification token
  emailVerificationExpires?: Date; // 24-hour expiry
  passwordResetTokenHash?: string; // SHA-256 hash of single-use password reset token
  passwordResetExpires?: Date; // 1-hour expiry
  // Legacy fields retained for backwards compatibility
  emailVerificationToken?: string;
  passwordResetToken?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionDocument {
  _id: ObjectId;
  userId: ObjectId;
  tokenHash: string; // SHA-256 hash of the opaque session token
  createdAt: Date;
  expiresAt: Date;
  lastActiveAt: Date;
  userAgent?: string;
  ipAddress?: string;
}

// Global flag to track index creation per server process
let indexesCreated = false;

/**
 * Ensures required collections and indexes exist.
 * Safe to call idempotently.
 */
export async function ensureIndexes(db: Db): Promise<void> {
  if (indexesCreated) return;

  const usersCollection = db.collection<UserDocument>("users");
  const sessionsCollection = db.collection<SessionDocument>("sessions");

  await Promise.all([
    // Unique lowercase email index
    usersCollection.createIndex({ email: 1 }, { unique: true }),
    // Sparse index on email verification token hash
    usersCollection.createIndex(
      { emailVerificationTokenHash: 1 },
      { unique: true, sparse: true }
    ),
    // Sparse index on password reset token hash
    usersCollection.createIndex(
      { passwordResetTokenHash: 1 },
      { unique: true, sparse: true }
    ),
    // Lookup by user in sessions
    sessionsCollection.createIndex({ userId: 1 }),
    // Unique index on tokenHash
    sessionsCollection.createIndex({ tokenHash: 1 }, { unique: true }),
    // TTL index to automatically purge expired sessions from MongoDB
    sessionsCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]);

  indexesCreated = true;
}

export async function getUsersCollection(db: Db): Promise<Collection<UserDocument>> {
  await ensureIndexes(db);
  return db.collection<UserDocument>("users");
}

export async function getSessionsCollection(db: Db): Promise<Collection<SessionDocument>> {
  await ensureIndexes(db);
  return db.collection<SessionDocument>("sessions");
}
