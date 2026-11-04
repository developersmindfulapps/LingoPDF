import { Db } from "mongodb";
import { z } from "zod";
import { getUsersCollection } from "@/lib/db/models";
import {
  getConfiguredAdminEmailAllowlist,
  resolveUserRole,
} from "@/lib/auth/admin";
import { sanitizeUser } from "@/lib/auth/session";
import {
  generateBootstrapOperationId,
  recordBootstrapAdminAuditLog,
} from "@/lib/audit/adminAudit";

export type SanitizedUser = ReturnType<typeof sanitizeUser>;

const bootstrapEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("A valid administrator email address is required");

export type InitialAdminProvisionStatus =
  | "promoted"
  | "already_admin"
  | "account_not_found"
  | "email_not_verified";

export interface AdminAllowlistEvaluation {
  allowlistConfigured: boolean;
  emailAllowedByAllowlist: boolean;
}

export interface InitialAdminProvisionResult {
  status: InitialAdminProvisionStatus;
  promoted: boolean;
  idempotent: boolean;
  bootstrapOperationId: string;
  targetEmail: string;
  targetUserId: string | null;
  previousRole: "customer" | "admin" | null;
  newRole: "customer" | "admin" | null;
  previousStatus: "active" | "suspended" | null;
  newStatus: "active" | "suspended" | null;
  isEmailVerified: boolean | null;
  passwordHashPreserved: boolean | null;
  allowlistEvaluation: AdminAllowlistEvaluation;
  auditLogId: string;
  timestamp: string;
  user: SanitizedUser | null;
  message: string;
}

/**
 * Evaluates whether the optional `ADMIN_EMAIL_ALLOWLIST` environment variable
 * is configured and whether the target email satisfies it.
 */
export function evaluateAdminEmailAllowlist(
  email: string
): AdminAllowlistEvaluation {
  const allowlist = getConfiguredAdminEmailAllowlist();
  const normalizedEmail = email.trim().toLowerCase();
  return {
    allowlistConfigured: allowlist !== null,
    emailAllowedByAllowlist:
      allowlist === null ? true : allowlist.has(normalizedEmail),
  };
}

/**
 * Stage 3B.4.1 — Secure, idempotent initial administrator bootstrap procedure.
 *
 * Rules enforced:
 * 1. If the account does not exist in `users`:
 *    - Never fabricates an email verification state.
 *    - Never creates an account with a hardcoded or temporary password.
 *    - Records a dedicated bootstrap audit log with `outcome: "failure"` and reports
 *      that the user must register through `/register` and verify their email first.
 * 2. If the account exists but `isEmailVerified !== true`:
 *    - Does not promote the account.
 *    - Records a dedicated bootstrap audit log with `outcome: "failure"` and reports
 *      that email verification is required first.
 * 3. If the account exists and `isEmailVerified === true`:
 *    - Sets `role: "admin"` and `status: "active"`.
 *    - Preserves the existing `passwordHash` and all unrelated user fields.
 *    - Is idempotent: if already `role: "admin"` and `status: "active"`, performs a safe
 *      no-op without duplicating records or corrupting the account.
 *    - Records a dedicated bootstrap audit log (`actorRole: "system_bootstrap"`,
 *      `actorUserId: null`) without falsely attributing the operation to a non-existent admin.
 */
export async function provisionInitialAdminAccount(
  db: Db,
  rawEmail: string,
  options?: {
    bootstrapOperationId?: string;
    now?: Date;
  }
): Promise<InitialAdminProvisionResult> {
  const parsedEmail = bootstrapEmailSchema.safeParse(rawEmail);
  if (!parsedEmail.success) {
    throw new Error(
      parsedEmail.error.issues[0]?.message ||
        "Invalid administrator email address"
    );
  }

  const targetEmail = parsedEmail.data;
  const now = options?.now ?? new Date();
  const bootstrapOperationId =
    options?.bootstrapOperationId?.trim() || generateBootstrapOperationId();
  const allowlistEvaluation = evaluateAdminEmailAllowlist(targetEmail);

  const usersCollection = await getUsersCollection(db);
  const existingUser = await usersCollection.findOne({ email: targetEmail });

  // Case 1: Account does not exist
  if (!existingUser) {
    const auditLog = await recordBootstrapAdminAuditLog(
      db,
      {
        targetEmail,
        targetUserId: null,
        previousRole: null,
        newRole: null,
        previousStatus: null,
        newStatus: null,
        isEmailVerified: null,
        bootstrapOperationId,
        outcome: "failure",
        reason:
          "Initial admin provisioning aborted: account does not exist in users collection. Registration and email verification required.",
        metadata: {
          resultStatus: "account_not_found",
          allowlistConfigured: allowlistEvaluation.allowlistConfigured,
          emailAllowedByAllowlist: allowlistEvaluation.emailAllowedByAllowlist,
        },
      },
      now
    );

    return {
      status: "account_not_found",
      promoted: false,
      idempotent: false,
      bootstrapOperationId,
      targetEmail,
      targetUserId: null,
      previousRole: null,
      newRole: null,
      previousStatus: null,
      newStatus: null,
      isEmailVerified: null,
      passwordHashPreserved: null,
      allowlistEvaluation,
      auditLogId: auditLog._id.toString(),
      timestamp: now.toISOString(),
      user: null,
      message: `Account "${targetEmail}" does not exist in the MongoDB users collection. The user must register through the normal registration flow and verify their email address before running this provisioning procedure.`,
    };
  }

  const previousRole = resolveUserRole(existingUser);
  const previousStatus = existingUser.status;
  const targetUserId = existingUser._id.toString();

  // Case 2: Account exists but email is not verified
  if (existingUser.isEmailVerified !== true) {
    const auditLog = await recordBootstrapAdminAuditLog(
      db,
      {
        targetEmail,
        targetUserId: existingUser._id,
        previousRole,
        newRole: previousRole,
        previousStatus,
        newStatus: previousStatus,
        isEmailVerified: false,
        bootstrapOperationId,
        outcome: "failure",
        reason:
          "Initial admin provisioning aborted: account exists but email address is not verified.",
        metadata: {
          resultStatus: "email_not_verified",
          allowlistConfigured: allowlistEvaluation.allowlistConfigured,
          emailAllowedByAllowlist: allowlistEvaluation.emailAllowedByAllowlist,
        },
      },
      now
    );

    return {
      status: "email_not_verified",
      promoted: false,
      idempotent: false,
      bootstrapOperationId,
      targetEmail,
      targetUserId,
      previousRole,
      newRole: previousRole,
      previousStatus,
      newStatus: previousStatus,
      isEmailVerified: false,
      passwordHashPreserved: true,
      allowlistEvaluation,
      auditLogId: auditLog._id.toString(),
      timestamp: now.toISOString(),
      user: sanitizeUser(existingUser),
      message: `Account "${targetEmail}" exists (userId: ${targetUserId}) but its email address is not verified (isEmailVerified: false). Email verification is required before this account can be promoted to administrator.`,
    };
  }

  // Case 3A: Account exists, email is verified, and account is already an active admin (Idempotent no-op)
  if (existingUser.role === "admin" && existingUser.status === "active") {
    const auditLog = await recordBootstrapAdminAuditLog(
      db,
      {
        targetEmail,
        targetUserId: existingUser._id,
        previousRole: "admin",
        newRole: "admin",
        previousStatus: "active",
        newStatus: "active",
        isEmailVerified: true,
        bootstrapOperationId,
        outcome: "success",
        reason:
          "Initial admin bootstrap verified (idempotent no-op: account is already an active verified administrator).",
        metadata: {
          resultStatus: "already_admin",
          idempotentNoOp: true,
          passwordHashPreserved: true,
          allowlistConfigured: allowlistEvaluation.allowlistConfigured,
          emailAllowedByAllowlist: allowlistEvaluation.emailAllowedByAllowlist,
        },
      },
      now
    );

    return {
      status: "already_admin",
      promoted: false,
      idempotent: true,
      bootstrapOperationId,
      targetEmail,
      targetUserId,
      previousRole: "admin",
      newRole: "admin",
      previousStatus: "active",
      newStatus: "active",
      isEmailVerified: true,
      passwordHashPreserved: true,
      allowlistEvaluation,
      auditLogId: auditLog._id.toString(),
      timestamp: now.toISOString(),
      user: sanitizeUser(existingUser),
      message: `Account "${targetEmail}" (userId: ${targetUserId}) is already provisioned with role="admin", status="active", and isEmailVerified=true. No duplicate records or changes were made.`,
    };
  }

  // Case 3B: Account exists and email is verified -> promote to role: "admin" and ensure status: "active"
  const originalPasswordHash = existingUser.passwordHash;

  await usersCollection.updateOne(
    { _id: existingUser._id, isEmailVerified: true },
    {
      $set: {
        role: "admin",
        status: "active",
        updatedAt: now,
      },
      ...(existingUser.status === "suspended"
        ? {
            $unset: {
              suspensionReason: "",
              suspendedAt: "",
            },
          }
        : {}),
    }
  );

  const updatedUser = await usersCollection.findOne({ _id: existingUser._id });
  if (
    !updatedUser ||
    updatedUser.role !== "admin" ||
    updatedUser.status !== "active" ||
    updatedUser.isEmailVerified !== true
  ) {
    throw new Error(
      "Post-update verification failed while promoting administrator account."
    );
  }

  const passwordHashPreserved =
    typeof updatedUser.passwordHash === "string" &&
    updatedUser.passwordHash.length > 0 &&
    updatedUser.passwordHash === originalPasswordHash;

  if (!passwordHashPreserved) {
    throw new Error(
      "Critical invariant violation: passwordHash was not preserved during admin promotion."
    );
  }

  const auditLog = await recordBootstrapAdminAuditLog(
    db,
    {
      targetEmail,
      targetUserId: updatedUser._id,
      previousRole,
      newRole: "admin",
      previousStatus,
      newStatus: "active",
      isEmailVerified: true,
      bootstrapOperationId,
      outcome: "success",
      reason:
        "Initial administrator account provisioned via explicit bootstrap procedure.",
      metadata: {
        resultStatus: "promoted",
        idempotentNoOp: false,
        passwordHashPreserved: true,
        allowlistConfigured: allowlistEvaluation.allowlistConfigured,
        emailAllowedByAllowlist: allowlistEvaluation.emailAllowedByAllowlist,
      },
    },
    now
  );

  return {
    status: "promoted",
    promoted: true,
    idempotent: false,
    bootstrapOperationId,
    targetEmail,
    targetUserId: updatedUser._id.toString(),
    previousRole,
    newRole: "admin",
    previousStatus,
    newStatus: "active",
    isEmailVerified: true,
    passwordHashPreserved: true,
    allowlistEvaluation,
    auditLogId: auditLog._id.toString(),
    timestamp: now.toISOString(),
    user: sanitizeUser(updatedUser),
    message: `Successfully provisioned "${targetEmail}" (userId: ${updatedUser._id.toString()}) as an active administrator (role="admin", status="active", isEmailVerified=true).`,
  };
}
