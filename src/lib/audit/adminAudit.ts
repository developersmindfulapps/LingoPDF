import crypto from "node:crypto";
import { Db, ObjectId } from "mongodb";
import {
  AdminAuditLogDocument,
  AdminAuditOutcome,
  AppendOnlyAdminAuditCollection,
  getAdminAuditLogsCollection,
} from "@/lib/db/models";
import { DataValidationError } from "@/lib/db/repositories";
import { AuthenticatedAdminContext } from "@/lib/auth/admin";

export type { AppendOnlyAdminAuditCollection };

const SENSITIVE_AUDIT_KEY_PATTERN =
  /password|token|secret|cookie|authorization|session|apikey|api_key|signature|cvv|cvc|pan|cardnumber|card_number|bankaccount|bank_account|privatekey|private_key/i;

const RAW_PAN_VALUE_PATTERN = /^[\s-]*(?:\d[\s-]*){13,19}$/;

/**
 * Recursively redacts secrets, tokens, passwords, cookies, and raw card numbers
 * from admin audit metadata before persistence.
 */
export function sanitizeAuditMetadata(
  input: Record<string, unknown> | undefined | null,
  depth = 0
): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  if (depth > 6) {
    return { _truncated: "[MAX_DEPTH]" };
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_AUDIT_KEY_PATTERN.test(key)) {
      sanitized[key] = "[REDACTED]";
      continue;
    }

    if (value === null || value === undefined) {
      sanitized[key] = value ?? null;
    } else if (value instanceof ObjectId) {
      sanitized[key] = value.toString();
    } else if (value instanceof Date) {
      sanitized[key] = value.toISOString();
    } else if (typeof value === "string") {
      if (RAW_PAN_VALUE_PATTERN.test(value)) {
        sanitized[key] = "[REDACTED_PAN]";
      } else {
        sanitized[key] = value.length > 1000 ? `${value.slice(0, 1000)}…` : value;
      }
    } else if (typeof value === "number" || typeof value === "boolean") {
      sanitized[key] = value;
    } else if (Array.isArray(value)) {
      sanitized[key] = value.slice(0, 50).map((item) => {
        if (typeof item === "string" && RAW_PAN_VALUE_PATTERN.test(item)) {
          return "[REDACTED_PAN]";
        }
        if (item && typeof item === "object" && !Array.isArray(item)) {
          return sanitizeAuditMetadata(
            item as Record<string, unknown>,
            depth + 1
          );
        }
        return item;
      });
    } else if (typeof value === "object") {
      sanitized[key] = sanitizeAuditMetadata(
        value as Record<string, unknown>,
        depth + 1
      );
    } else {
      sanitized[key] = String(value);
    }
  }

  return sanitized;
}

/**
 * Generates a unique correlation identifier for linking audit entries and logs.
 */
export function generateCorrelationId(): string {
  return `corr_${crypto.randomBytes(12).toString("hex")}`;
}

export interface RecordAdminAuditInput {
  actor: Pick<AuthenticatedAdminContext, "userId" | "email" | "role">;
  action: string;
  targetCollection: string;
  targetId: string | ObjectId;
  outcome: AdminAuditOutcome;
  reason?: string | null;
  correlationId?: string;
  ipAddressHash?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Returns the application-level append-only `admin_audit_logs` collection accessor.
 * Both `getAdminAuditLogsCollection(db)` and `getProtectedAdminAuditLogsCollection(db)`
 * return this frozen append-only wrapper so normal application code cannot bypass
 * mutation restrictions.
 */
export async function getProtectedAdminAuditLogsCollection(
  db: Db
): Promise<AppendOnlyAdminAuditCollection> {
  return getAdminAuditLogsCollection(db);
}

/**
 * Persists a single append-only admin audit log entry after validating actor role
 * and redacting sensitive metadata.
 */
export async function recordAdminAuditLog(
  db: Db,
  input: RecordAdminAuditInput,
  now = new Date()
): Promise<AdminAuditLogDocument> {
  if (!input.actor || input.actor.role !== "admin") {
    throw new DataValidationError(
      'Admin audit log requires an authenticated actor with role === "admin"'
    );
  }
  if (!input.actor.userId || !(input.actor.userId instanceof ObjectId)) {
    throw new DataValidationError(
      "Admin audit log requires a valid actor.userId ObjectId"
    );
  }

  const action = input.action?.trim();
  const targetCollection = input.targetCollection?.trim();
  const targetId =
    input.targetId instanceof ObjectId
      ? input.targetId.toString()
      : String(input.targetId ?? "").trim();

  if (!action || !targetCollection || !targetId) {
    throw new DataValidationError(
      "Admin audit log requires non-empty action, targetCollection, and targetId"
    );
  }

  if (input.outcome !== "success" && input.outcome !== "failure") {
    throw new DataValidationError(
      'Admin audit log outcome must be "success" or "failure"'
    );
  }

  const auditCollection = await getProtectedAdminAuditLogsCollection(db);
  const correlationId =
    input.correlationId?.trim() || generateCorrelationId();

  const doc: AdminAuditLogDocument = {
    _id: new ObjectId(),
    actorUserId: input.actor.userId,
    actorEmail: input.actor.email.trim().toLowerCase(),
    actorRole: "admin",
    action,
    targetCollection,
    targetId,
    outcome: input.outcome,
    reason: input.reason?.trim() || null,
    correlationId,
    ipAddressHash: input.ipAddressHash?.trim() || null,
    userAgent: input.userAgent?.trim()?.slice(0, 512) || null,
    metadata: sanitizeAuditMetadata(input.metadata),
    createdAt: now,
  };

  await auditCollection.insertOne(doc);
  return doc;
}

/**
 * Executes a privileged admin operation and guarantees accurate outcome auditing:
 * - If `operation()` resolves, records `outcome: "success"` and returns `{ result, auditLog }`.
 * - If `operation()` throws, records `outcome: "failure"` (never `"success"`) with the
 *   sanitized failure reason and rethrows the original error.
 */
export async function executeAuditedAdminAction<T>(params: {
  db: Db;
  actor: Pick<AuthenticatedAdminContext, "userId" | "email" | "role">;
  action: string;
  targetCollection: string;
  targetId: string | ObjectId;
  reason?: string | null;
  correlationId?: string;
  ipAddressHash?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
  operation: () => Promise<T>;
}): Promise<{ result: T; auditLog: AdminAuditLogDocument }> {
  const correlationId =
    params.correlationId?.trim() || generateCorrelationId();

  try {
    const result = await params.operation();
    const auditLog = await recordAdminAuditLog(params.db, {
      actor: params.actor,
      action: params.action,
      targetCollection: params.targetCollection,
      targetId: params.targetId,
      outcome: "success",
      reason: params.reason,
      correlationId,
      ipAddressHash: params.ipAddressHash,
      userAgent: params.userAgent,
      metadata: params.metadata,
    });

    return { result, auditLog };
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : String(err ?? "Unknown error");

    await recordAdminAuditLog(params.db, {
      actor: params.actor,
      action: params.action,
      targetCollection: params.targetCollection,
      targetId: params.targetId,
      outcome: "failure",
      reason: params.reason,
      correlationId,
      ipAddressHash: params.ipAddressHash,
      userAgent: params.userAgent,
      metadata: {
        ...(params.metadata || {}),
        failureError: errorMessage,
      },
    });

    throw err;
  }
}

/**
 * Generates a unique bootstrap operation identifier for initial administrator provisioning.
 */
export function generateBootstrapOperationId(): string {
  return `bootstrap_${crypto.randomBytes(12).toString("hex")}`;
}

export interface RecordBootstrapAdminAuditInput {
  targetEmail: string;
  targetUserId: ObjectId | string | null;
  previousRole: string | null;
  newRole: string | null;
  previousStatus?: string | null;
  newStatus?: string | null;
  isEmailVerified?: boolean | null;
  bootstrapOperationId?: string;
  outcome: AdminAuditOutcome;
  reason: string;
  metadata?: Record<string, unknown>;
}

/**
 * Dedicated bootstrap audit mechanism for initial administrator account provisioning
 * (Stage 3B.4.1).
 *
 * Because the initial administrator bootstrap occurs before a normal administrator exists,
 * this records `actorUserId: null` and `actorRole: "system_bootstrap"` rather than falsely
 * attributing the action to an administrator who does not yet exist, while preserving
 * the append-only `admin_audit_logs` architecture.
 */
export async function recordBootstrapAdminAuditLog(
  db: Db,
  input: RecordBootstrapAdminAuditInput,
  now = new Date()
): Promise<AdminAuditLogDocument> {
  const normalizedTargetEmail = String(input.targetEmail ?? "")
    .trim()
    .toLowerCase();
  if (!normalizedTargetEmail) {
    throw new DataValidationError(
      "Bootstrap admin audit log requires a non-empty targetEmail"
    );
  }

  if (input.outcome !== "success" && input.outcome !== "failure") {
    throw new DataValidationError(
      'Bootstrap admin audit log outcome must be "success" or "failure"'
    );
  }

  const bootstrapOperationId =
    input.bootstrapOperationId?.trim() || generateBootstrapOperationId();
  const targetUserIdStr =
    input.targetUserId instanceof ObjectId
      ? input.targetUserId.toString()
      : input.targetUserId
        ? String(input.targetUserId).trim()
        : null;

  const auditCollection = await getProtectedAdminAuditLogsCollection(db);

  const doc: AdminAuditLogDocument = {
    _id: new ObjectId(),
    actorUserId: null,
    actorEmail: "system:initial-admin-bootstrap",
    actorRole: "system_bootstrap",
    action: "admin.bootstrap_provision",
    targetCollection: "users",
    targetId: targetUserIdStr || normalizedTargetEmail,
    outcome: input.outcome,
    reason: input.reason?.trim() || "Initial administrator bootstrap provisioning",
    correlationId: bootstrapOperationId,
    ipAddressHash: null,
    userAgent: "cli:provision-initial-admin",
    metadata: sanitizeAuditMetadata({
      bootstrapOperationId,
      targetEmail: normalizedTargetEmail,
      targetUserId: targetUserIdStr,
      previousRole: input.previousRole,
      newRole: input.newRole,
      previousStatus: input.previousStatus ?? null,
      newStatus: input.newStatus ?? null,
      isEmailVerified: input.isEmailVerified ?? null,
      outcome: input.outcome,
      timestamp: now.toISOString(),
      ...(input.metadata || {}),
    }),
    createdAt: now,
  };

  await auditCollection.insertOne(doc);
  return doc;
}

