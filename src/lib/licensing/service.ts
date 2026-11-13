/**
 * LingoPDF — Production Licensing & Device Activation Service (Stage 4)
 *
 * Implements:
 * 1. Cryptographically secure 10-minute single-use activation codes (SHA-256 hashed).
 * 2. Asymmetric Ed25519 signed licence leases with canonical JSON and rotation key IDs.
 * 3. Atomic device binding with database-level 1-device enforcement.
 * 4. Challenge-response device proof-of-possession renewal.
 * 5. 72-hour offline grace policy tracking.
 * 6. Controlled admin device replacement, suspension, and revocation with audit logging.
 */

import crypto from "crypto";
import { Db, MongoClient, ObjectId, ClientSession } from "mongodb";
import {
  COLLECTION_NAMES,
  ActivationCodeDocument,
  DeviceBindingDocument,
  LicenceChallengeDocument,
  UserDocument,
  getActivationCodesCollection,
  getDeviceBindingsCollection,
  getLicenceChallengesCollection,
  getEntitlementsCollection,
} from "@/lib/db/models";
import { recordAdminAuditLog } from "@/lib/audit/adminAudit";
import { logger } from "@/lib/observability/logger";

// ---------------------------------------------------------------------------
// Constants & Types
// ---------------------------------------------------------------------------

export const ACTIVATION_CODE_PREFIX = "ACT";
export const ACTIVATION_CODE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes (Security validity duration)
export const ACTIVATION_CODE_CLEANUP_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (Unconsumed abandoned code TTL cleanup)
export const CHALLENGE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
export const LEASE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours (Online active lease)
export const OFFLINE_GRACE_DURATION_MS = 72 * 60 * 60 * 1000; // 72 hours (Absolute offline grace limit)
export const LICENCE_PROTOCOL_VERSION = 1 as const;
export const DEFAULT_KEY_ID = "lingopdf-ed25519-v1";

// 32-character unambiguous alphabet (excludes 0, 1, I, O)
const UNAMBIGUOUS_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export interface SignedLicencePayload {
  licenceId: string;
  entitlementId: string;
  productEdition: "german";
  deviceBindingId: string;
  licenceStatus: "active";
  issuedAt: number; // Unix epoch ms
  leaseExpiresAt: number; // Unix epoch ms
  offlineGraceExpiresAt: number; // Unix epoch ms
  leaseId: string;
  protocolVersion: 1;
}

export interface SignedLicenceLease {
  keyId: string;
  signature: string; // Base64 signature
  payload: SignedLicencePayload;
}

export interface GenerateActivationCodeResult {
  success: boolean;
  activationCode?: string; // Plaintext returned only once to client
  codeMasked?: string;
  expiresAt?: Date;
  code?: string;
  message?: string;
}

export interface ActivateDeviceResult {
  success: boolean;
  deviceBindingId?: string;
  lease?: SignedLicenceLease;
  code?: string;
  message?: string;
}

export interface CreateChallengeResult {
  success: boolean;
  challenge?: string;
  expiresAt?: Date;
  code?: string;
  message?: string;
}

export interface RenewLicenceResult {
  success: boolean;
  lease?: SignedLicenceLease;
  code?: string;
  message?: string;
}

export interface AdminActorContext {
  userId?: ObjectId | string | null;
  email: string;
  role: "admin";
}

// ---------------------------------------------------------------------------
// Helpers: Cryptographic Code Generation & Hashing
// ---------------------------------------------------------------------------

export function normalizeActivationCode(code: string): string {
  return code.trim().toUpperCase().replace(/[\s-]+/g, "-");
}

export function hashActivationCode(code: string): string {
  const normalized = normalizeActivationCode(code);
  return crypto.createHash("sha256").update(normalized, "utf8").digest("hex");
}

export function maskActivationCode(code: string): string {
  const norm = normalizeActivationCode(code);
  const parts = norm.split("-");
  if (parts.length >= 4) {
    return `${parts[0]}-••••-••••-${parts[parts.length - 1]}`;
  }
  return norm.length > 8 ? `${norm.slice(0, 4)}••••${norm.slice(-4)}` : norm;
}

/**
 * Generates an activation code with 60 bits of cryptographic entropy:
 * Format: `ACT-XXXX-XXXX-XXXX` (12 Base32 characters, 5 bits each = 60 independent random bits)
 */
export function generateCryptographicActivationCode(): string {
  // 8 random bytes = 64 bits of cryptographic entropy from CSPRNG
  const bytes = crypto.randomBytes(8);
  const totalChars = 12; // 3 blocks of 4 characters = 60 bits
  let chars = "";
  let num = BigInt("0x" + bytes.toString("hex"));
  const mask = BigInt(0x1f);
  const shift = BigInt(5);
  for (let i = 0; i < totalChars; i++) {
    const val = Number(num & mask);
    chars += UNAMBIGUOUS_CHARS[val];
    num = num >> shift;
  }

  const p1 = chars.slice(0, 4);
  const p2 = chars.slice(4, 8);
  const p3 = chars.slice(8, 12);
  return `${ACTIVATION_CODE_PREFIX}-${p1}-${p2}-${p3}`;
}

// ---------------------------------------------------------------------------
// Helpers: Ed25519 Signing Key & Canonical Serialization
// ---------------------------------------------------------------------------

let cachedSigningKey: { keyId: string; privateKey: crypto.KeyObject } | null = null;

export function loadServerSigningKey(): { keyId: string; privateKey: crypto.KeyObject } {
  if (cachedSigningKey) {
    return cachedSigningKey;
  }

  const keyId = process.env.LICENCE_SIGNING_KEY_ID || DEFAULT_KEY_ID;
  const rawPem = process.env.LICENCE_SIGNING_PRIVATE_KEY_PEM;

  if (rawPem && rawPem.trim()) {
    try {
      const normalizedPem = rawPem.includes("\\n") ? rawPem.replace(/\\n/g, "\n") : rawPem;
      const privateKey = crypto.createPrivateKey(normalizedPem);
      if (privateKey.asymmetricKeyType !== "ed25519") {
        throw new Error(`Expected Ed25519 private key, got ${privateKey.asymmetricKeyType}`);
      }
      cachedSigningKey = { keyId, privateKey };
      return cachedSigningKey;
    } catch (err) {
      logger.error("licence_signing_key_load_failed", { error: err instanceof Error ? err.message : String(err) });
      if (process.env.NODE_ENV === "production") {
        throw new Error(
          "LICENCE_SIGNING_PRIVATE_KEY_PEM is invalid or corrupted. Production requires a valid Ed25519 private key."
        );
      }
    }
  }

  if (process.env.NODE_ENV === "production") {
    logger.error("licence_signing_key_missing_in_production", { keyId });
    throw new Error(
      "LICENCE_SIGNING_PRIVATE_KEY_PEM environment variable is required in production. Refusing to sign with ephemeral key."
    );
  }

  // Fallback for tests or ephemeral development environments ONLY
  logger.warn("licence_signing_using_ephemeral_dev_key", {
    warning: "LICENCE_SIGNING_PRIVATE_KEY_PEM not set; generating ephemeral key for non-production session.",
  });
  const generated = crypto.generateKeyPairSync("ed25519");
  cachedSigningKey = { keyId, privateKey: generated.privateKey };
  return cachedSigningKey;
}

export function resetSigningKeyCache(): void {
  cachedSigningKey = null;
}

/**
 * Deterministic JSON stringifier with alphabetically sorted keys.
 */
export function canonicalizeLicencePayload(payload: Record<string, unknown>): string {
  const sortedKeys = Object.keys(payload).sort();
  const canonicalObj: Record<string, unknown> = {};
  for (const k of sortedKeys) {
    canonicalObj[k] = payload[k];
  }
  return JSON.stringify(canonicalObj);
}

/**
 * Signs a licence payload with server's Ed25519 private key.
 */
export function signLicencePayload(payload: SignedLicencePayload): SignedLicenceLease {
  const { keyId, privateKey } = loadServerSigningKey();
  const canonicalStr = canonicalizeLicencePayload(payload as unknown as Record<string, unknown>);
  const signature = crypto.sign(null, Buffer.from(canonicalStr, "utf8"), privateKey).toString("base64");
  return {
    keyId,
    signature,
    payload,
  };
}

// ---------------------------------------------------------------------------
// Transaction Execution Helper (Replica Set with CAS Fallback)
// ---------------------------------------------------------------------------

async function executeInTransaction<T>(
  client: MongoClient,
  fn: (session: ClientSession) => Promise<T>
): Promise<T> {
  const session = client.startSession();
  try {
    let result: T;
    try {
      result = await session.withTransaction(async () => fn(session));
    } catch (txErr: unknown) {
      const msg = txErr instanceof Error ? txErr.message : String(txErr);
      if (
        msg.includes("replica set") ||
        msg.includes("standalone") ||
        msg.includes("Transaction numbers are only allowed")
      ) {
        logger.warn("transactions_unsupported_falling_back_to_cas", { error: msg });
        return await fn(session);
      }
      throw txErr;
    }
    return result;
  } finally {
    await session.endSession();
  }
}

// ---------------------------------------------------------------------------
// 1. Generate Activation Code (Customer Authenticated)
// ---------------------------------------------------------------------------

export async function generateActivationCodeForUser(
  db: Db,
  client: MongoClient,
  user: UserDocument
): Promise<GenerateActivationCodeResult> {
  const entitlementsCol = await getEntitlementsCollection(db);
  const deviceBindingsCol = await getDeviceBindingsCollection(db);
  const activationCodesCol = await getActivationCodesCollection(db);

  // 1. Verify user holds an active German-English entitlement
  const activeEntitlement = await entitlementsCol.findOne({
    userId: user._id,
    productSlug: "german",
    status: "active",
  });

  if (!activeEntitlement) {
    return {
      success: false,
      code: "NO_ACTIVE_ENTITLEMENT",
      message: "An active German → English edition licence is required to generate an activation code.",
    };
  }

  // 2. Verify no active device is already bound to this entitlement (1-device policy)
  const existingActiveDevice = await deviceBindingsCol.findOne({
    entitlementId: activeEntitlement._id,
    status: "active",
  });

  if (existingActiveDevice || activeEntitlement.activeInstallationIdHash) {
    return {
      success: false,
      code: "DEVICE_ALREADY_BOUND",
      message:
        "A device is already active on this licence. LingoPDF permits one active device per purchase. To transfer to a new device, please request a device replacement via Support.",
    };
  }

  // 3. Generate cryptographic activation code
  const code = generateCryptographicActivationCode();
  const codeHash = hashActivationCode(code);
  const codeMasked = maskActivationCode(code);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ACTIVATION_CODE_EXPIRY_MS);
  const cleanupAt = new Date(now.getTime() + ACTIVATION_CODE_CLEANUP_TTL_MS);

  // 4. Invalidate any previously unconsumed activation code for this entitlement
  return executeInTransaction(client, async (session) => {
    await activationCodesCol.updateMany(
      {
        entitlementId: activeEntitlement._id,
        status: "active",
      },
      {
        $set: {
          status: "superseded",
          updatedAt: now,
        },
      },
      { session }
    );

    const doc: ActivationCodeDocument = {
      _id: new ObjectId(),
      codeHash,
      codeMasked,
      codePrefix: ACTIVATION_CODE_PREFIX,
      userId: user._id,
      userEmail: user.email,
      entitlementId: activeEntitlement._id,
      productEdition: "german",
      status: "active",
      createdAt: now,
      expiresAt,
      cleanupAt,
      consumedAt: null,
      consumedByDeviceId: null,
      updatedAt: now,
    };

    await activationCodesCol.insertOne(doc, { session });

    logger.info("activation_code_generated", {
      userId: user._id.toString(),
      entitlementId: activeEntitlement._id.toString(),
      codeMasked,
      expiresAt: expiresAt.toISOString(),
    });

    return {
      success: true,
      activationCode: code,
      codeMasked,
      expiresAt,
    };
  });
}

// ---------------------------------------------------------------------------
// 2. Activate Device (Extension Public API Endpoint)
// ---------------------------------------------------------------------------

export interface ActivateDeviceInput {
  code: string;
  devicePublicKeySpki: string; // Base64 SPKI
  deviceLabel?: string;
  clientVersion?: string;
  ipAddress?: string;
  userAgent?: string;
}

export async function activateDeviceBinding(
  db: Db,
  client: MongoClient,
  input: ActivateDeviceInput
): Promise<ActivateDeviceResult> {
  const normCode = normalizeActivationCode(input.code);
  if (!normCode || !normCode.startsWith(`${ACTIVATION_CODE_PREFIX}-`)) {
    return {
      success: false,
      code: "INVALID_CODE",
      message: "The provided activation code is not valid.",
    };
  }

  // Validate device public key format
  if (!input.devicePublicKeySpki || typeof input.devicePublicKeySpki !== "string") {
    return {
      success: false,
      code: "INVALID_DEVICE_KEY",
      message: "A valid device public key (SPKI base64) is required.",
    };
  }

  try {
    const pubBuf = Buffer.from(input.devicePublicKeySpki, "base64");
    const pubKey = crypto.createPublicKey({ key: pubBuf, format: "der", type: "spki" });
    if (pubKey.asymmetricKeyType !== "ed25519") {
      return {
        success: false,
        code: "UNSUPPORTED_KEY_ALGORITHM",
        message: "Only Ed25519 device keys are supported.",
      };
    }
  } catch {
    return {
      success: false,
      code: "MALFORMED_DEVICE_KEY",
      message: "The device public key could not be parsed.",
    };
  }

  const codeHash = hashActivationCode(normCode);
  const devicePublicKeyHash = crypto.createHash("sha256").update(input.devicePublicKeySpki, "utf8").digest("hex");
  const now = new Date();

  const activationCodesCol = await getActivationCodesCollection(db);
  const entitlementsCol = await getEntitlementsCollection(db);
  const deviceBindingsCol = await getDeviceBindingsCollection(db);

  return executeInTransaction(client, async (session) => {
    // 1. Atomically claim the activation code
    const claimedCode = await activationCodesCol.findOneAndUpdate(
      {
        codeHash,
        status: "active",
        expiresAt: { $gt: now },
      },
      {
        $set: {
          status: "consumed",
          consumedAt: now,
          updatedAt: now,
        },
        $unset: {
          cleanupAt: "", // Unset cleanupAt so MongoDB TTL never purges consumed codes; expiresAt is preserved for audit
        },
      },
      { returnDocument: "after", session }
    );

    if (!claimedCode) {
      // Diagnostic check for precise generic-safe error
      const existing = await activationCodesCol.findOne({ codeHash }, { session });
      if (!existing) {
        return { success: false, code: "INVALID_CODE", message: "Activation code not found or invalid." };
      }
      if (existing.status === "consumed") {
        return { success: false, code: "ALREADY_CONSUMED", message: "This activation code has already been used." };
      }
      if (existing.status === "superseded") {
        return {
          success: false,
          code: "SUPERSEDED_CODE",
          message: "A newer activation code was generated. Please use the most recent code from your account.",
        };
      }
      if (existing.expiresAt && existing.expiresAt <= now) {
        return { success: false, code: "EXPIRED_CODE", message: "This activation code has expired. Please generate a new code." };
      }
      return { success: false, code: "INVALID_CODE", message: "The activation code cannot be consumed." };
    }

    // 2. Verify associated entitlement
    const entitlement = await entitlementsCol.findOne(
      {
        _id: claimedCode.entitlementId,
        status: "active",
        productSlug: "german",
      },
      { session }
    );

    if (!entitlement) {
      return {
        success: false,
        code: "ENTITLEMENT_INELIGIBLE",
        message: "The licence associated with this code is not active or eligible.",
      };
    }

    // 3. Verify no existing device binding on this entitlement
    const existingActiveBinding = await deviceBindingsCol.findOne(
      {
        entitlementId: entitlement._id,
        status: "active",
      },
      { session }
    );

    if (existingActiveBinding || entitlement.activeInstallationIdHash) {
      return {
        success: false,
        code: "DEVICE_ALREADY_BOUND",
        message: "A device is already bound to this licence. Only one active device is allowed.",
      };
    }

    // 4. Create Device Binding
    const bindingId = new ObjectId();
    const leaseId = new ObjectId().toString();
    const leaseExpiryMs = now.getTime() + LEASE_DURATION_MS;
    const offlineGraceExpiryMs = now.getTime() + OFFLINE_GRACE_DURATION_MS;

    const deviceDoc: DeviceBindingDocument = {
      _id: bindingId,
      entitlementId: entitlement._id,
      userId: claimedCode.userId,
      userEmail: claimedCode.userEmail,
      productEdition: "german",
      devicePublicKeySpki: input.devicePublicKeySpki,
      devicePublicKeyHash,
      deviceLabel: input.deviceLabel || "Chrome Extension",
      clientVersion: input.clientVersion || "0.1.0",
      status: "active",
      boundAt: now,
      lastValidatedAt: now,
      lastLeaseIssuedAt: now,
      currentLeaseId: leaseId,
      leaseExpiresAt: new Date(leaseExpiryMs),
      offlineGraceExpiresAt: new Date(offlineGraceExpiryMs),
      revokedAt: null,
      revokedBy: null,
      revocationReason: null,
      suspendedAt: null,
      suspensionReason: null,
      updatedAt: now,
    };

    await deviceBindingsCol.insertOne(deviceDoc, { session });

    // 5. Update entitlement installation binding
    await entitlementsCol.updateOne(
      { _id: entitlement._id },
      {
        $set: {
          activeInstallationIdHash: devicePublicKeyHash,
          deviceBoundAt: now,
          lastValidatedAt: now,
          offlineLeaseExpiresAt: new Date(offlineGraceExpiryMs),
          updatedAt: now,
        },
      },
      { session }
    );

    // 6. Associate consumed code with device
    await activationCodesCol.updateOne(
      { _id: claimedCode._id },
      {
        $set: {
          consumedByDeviceId: bindingId,
          updatedAt: now,
        },
      },
      { session }
    );

    // 7. Issue Signed Licence Lease
    const leasePayload: SignedLicencePayload = {
      licenceId: entitlement._id.toString(),
      entitlementId: entitlement._id.toString(),
      productEdition: "german",
      deviceBindingId: bindingId.toString(),
      licenceStatus: "active",
      issuedAt: now.getTime(),
      leaseExpiresAt: leaseExpiryMs,
      offlineGraceExpiresAt: offlineGraceExpiryMs,
      leaseId,
      protocolVersion: LICENCE_PROTOCOL_VERSION,
    };

    const lease = signLicencePayload(leasePayload);

    logger.info("device_activated_successfully", {
      bindingId: bindingId.toString(),
      entitlementId: entitlement._id.toString(),
      userId: claimedCode.userId.toString(),
      devicePublicKeyHash,
    });

    return {
      success: true,
      deviceBindingId: bindingId.toString(),
      lease,
    };
  });
}

// ---------------------------------------------------------------------------
// 3. Online Renewal Challenge Step 1
// ---------------------------------------------------------------------------

export async function createLicenceChallenge(
  db: Db,
  deviceBindingIdStr: string
): Promise<CreateChallengeResult> {
  if (!ObjectId.isValid(deviceBindingIdStr)) {
    return { success: false, code: "INVALID_DEVICE_ID", message: "Invalid device binding identifier." };
  }

  const deviceBindingsCol = await getDeviceBindingsCollection(db);
  const binding = await deviceBindingsCol.findOne({
    _id: new ObjectId(deviceBindingIdStr),
  });

  if (!binding) {
    return { success: false, code: "DEVICE_NOT_FOUND", message: "Device binding not found." };
  }

  if (binding.status !== "active") {
    return {
      success: false,
      code: binding.status === "revoked" ? "DEVICE_REVOKED" : "DEVICE_SUSPENDED",
      message: `Device binding is ${binding.status}.`,
    };
  }

  const challenge = crypto.randomBytes(32).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CHALLENGE_EXPIRY_MS);

  const challengesCol = await getLicenceChallengesCollection(db);
  const doc: LicenceChallengeDocument = {
    _id: new ObjectId(),
    challenge,
    deviceBindingId: binding._id,
    createdAt: now,
    expiresAt,
    consumedAt: null,
  };

  await challengesCol.insertOne(doc);

  return {
    success: true,
    challenge,
    expiresAt,
  };
}

// ---------------------------------------------------------------------------
// 4. Online Renewal Validation Step 2 (Device Proof-of-Possession)
// ---------------------------------------------------------------------------

export interface RenewLicenceInput {
  deviceBindingId: string;
  challenge: string;
  signature: string; // Base64 Ed25519 signature of challenge
}

export async function renewLicenceLease(
  db: Db,
  client: MongoClient,
  input: RenewLicenceInput
): Promise<RenewLicenceResult> {
  if (!ObjectId.isValid(input.deviceBindingId)) {
    return { success: false, code: "INVALID_DEVICE_ID", message: "Invalid device binding identifier." };
  }

  const challengesCol = await getLicenceChallengesCollection(db);
  const deviceBindingsCol = await getDeviceBindingsCollection(db);
  const entitlementsCol = await getEntitlementsCollection(db);

  const bindingId = new ObjectId(input.deviceBindingId);
  const now = new Date();

  return executeInTransaction(client, async (session) => {
    // 1. Atomically consume the challenge
    const consumedChallenge = await challengesCol.findOneAndUpdate(
      {
        challenge: input.challenge,
        deviceBindingId: bindingId,
        consumedAt: null,
        expiresAt: { $gt: now },
      },
      {
        $set: {
          consumedAt: now,
        },
      },
      { returnDocument: "after", session }
    );

    if (!consumedChallenge) {
      return {
        success: false,
        code: "INVALID_OR_EXPIRED_CHALLENGE",
        message: "Challenge is invalid, already consumed, or expired.",
      };
    }

    // 2. Fetch device binding
    const binding = await deviceBindingsCol.findOne({ _id: bindingId }, { session });
    if (!binding) {
      return { success: false, code: "DEVICE_NOT_FOUND", message: "Device binding not found." };
    }

    if (binding.status === "revoked") {
      return { success: false, code: "DEVICE_REVOKED", message: "This device binding has been revoked." };
    }

    if (binding.status === "suspended") {
      return { success: false, code: "DEVICE_SUSPENDED", message: "This device binding is suspended." };
    }

    // 3. Fetch associated entitlement
    const entitlement = await entitlementsCol.findOne({ _id: binding.entitlementId }, { session });
    if (!entitlement || entitlement.status !== "active") {
      return {
        success: false,
        code: "ENTITLEMENT_INACTIVE",
        message: "The licence entitlement is no longer active.",
      };
    }

    // 4. Verify Device Proof-of-Possession Signature
    try {
      const pubBuf = Buffer.from(binding.devicePublicKeySpki, "base64");
      const pubKey = crypto.createPublicKey({ key: pubBuf, format: "der", type: "spki" });
      const challengeBytes = Buffer.from(input.challenge, "utf8");
      const sigBuf = Buffer.from(input.signature, "base64");

      const isSignatureValid = crypto.verify(null, challengeBytes, pubKey, sigBuf);
      if (!isSignatureValid) {
        return {
          success: false,
          code: "INVALID_DEVICE_SIGNATURE",
          message: "Device proof-of-possession signature verification failed.",
        };
      }
    } catch {
      return {
        success: false,
        code: "VERIFICATION_ERROR",
        message: "Failed to verify device signature.",
      };
    }

    // 5. Issue fresh lease & update records
    const leaseId = new ObjectId().toString();
    const leaseExpiryMs = now.getTime() + LEASE_DURATION_MS;
    const offlineGraceExpiryMs = now.getTime() + OFFLINE_GRACE_DURATION_MS;

    await deviceBindingsCol.updateOne(
      { _id: binding._id },
      {
        $set: {
          lastValidatedAt: now,
          lastLeaseIssuedAt: now,
          currentLeaseId: leaseId,
          leaseExpiresAt: new Date(leaseExpiryMs),
          offlineGraceExpiresAt: new Date(offlineGraceExpiryMs),
          updatedAt: now,
        },
      },
      { session }
    );

    await entitlementsCol.updateOne(
      { _id: entitlement._id },
      {
        $set: {
          lastValidatedAt: now,
          offlineLeaseExpiresAt: new Date(offlineGraceExpiryMs),
          updatedAt: now,
        },
      },
      { session }
    );

    const leasePayload: SignedLicencePayload = {
      licenceId: entitlement._id.toString(),
      entitlementId: entitlement._id.toString(),
      productEdition: "german",
      deviceBindingId: binding._id.toString(),
      licenceStatus: "active",
      issuedAt: now.getTime(),
      leaseExpiresAt: leaseExpiryMs,
      offlineGraceExpiresAt: offlineGraceExpiryMs,
      leaseId,
      protocolVersion: LICENCE_PROTOCOL_VERSION,
    };

    const lease = signLicencePayload(leasePayload);

    logger.info("device_licence_renewed_successfully", {
      bindingId: binding._id.toString(),
      entitlementId: entitlement._id.toString(),
      leaseId,
    });

    return {
      success: true,
      lease,
    };
  });
}

// ---------------------------------------------------------------------------
// 5. Controlled Admin Actions: Device Replacement, Suspension & Revocation
// ---------------------------------------------------------------------------

export async function replaceDeviceControlledWorkflow(
  db: Db,
  client: MongoClient,
  entitlementIdStr: string,
  reason: string,
  actor: AdminActorContext
): Promise<{ success: boolean; entitlementId: string; revokedDeviceCount: number }> {
  if (!ObjectId.isValid(entitlementIdStr)) {
    throw new Error("Invalid entitlement ID.");
  }

  const entitlementId = new ObjectId(entitlementIdStr);
  const entitlementsCol = await getEntitlementsCollection(db);
  const deviceBindingsCol = await getDeviceBindingsCollection(db);

  const entitlement = await entitlementsCol.findOne({ _id: entitlementId });
  if (!entitlement) {
    throw new Error("Entitlement not found.");
  }
  if (entitlement.status === "revoked") {
    throw new Error("Cannot process device replacement on a permanently revoked entitlement.");
  }

  const now = new Date();
  const nextReplacementCount = (entitlement.deviceReplacementCount ?? 0) + 1;

  return executeInTransaction(client, async (session) => {
    // Revoke any active device bindings
    const updateResult = await deviceBindingsCol.updateMany(
      {
        entitlementId,
        status: "active",
      },
      {
        $set: {
          status: "revoked",
          revokedAt: now,
          revokedBy: actor.email,
          revocationReason: reason,
          updatedAt: now,
        },
      },
      { session }
    );

    // Reset entitlement device binding
    await entitlementsCol.updateOne(
      { _id: entitlementId },
      {
        $set: {
          activeInstallationIdHash: null,
          deviceBoundAt: null,
          offlineLeaseExpiresAt: null,
          deviceReplacementCount: nextReplacementCount,
          lastDeviceResetAt: now,
          lastDeviceResetReason: reason,
          updatedAt: now,
        },
      },
      { session }
    );

    await recordAdminAuditLog(db, {
      actor: {
        userId: actor.userId ? new ObjectId(actor.userId) : new ObjectId(),
        email: actor.email,
        role: actor.role,
      },
      action: "entitlement.replace_device",
      targetCollection: COLLECTION_NAMES.entitlements,
      targetId: entitlementId.toString(),
      outcome: "success",
      reason,
      metadata: {
        revokedDeviceCount: updateResult.modifiedCount,
        deviceReplacementCount: nextReplacementCount,
      },
    });

    return {
      success: true,
      entitlementId: entitlementId.toString(),
      revokedDeviceCount: updateResult.modifiedCount,
    };
  });
}

export async function suspendDeviceBindingAdminWorkflow(
  db: Db,
  client: MongoClient,
  deviceBindingIdStr: string,
  reason: string,
  actor: AdminActorContext
): Promise<{ success: boolean; deviceBindingId: string }> {
  if (!ObjectId.isValid(deviceBindingIdStr)) {
    throw new Error("Invalid device binding ID.");
  }

  const deviceBindingId = new ObjectId(deviceBindingIdStr);
  const deviceBindingsCol = await getDeviceBindingsCollection(db);
  const now = new Date();

  return executeInTransaction(client, async (session) => {
    const binding = await deviceBindingsCol.findOne({ _id: deviceBindingId }, { session });
    if (!binding) {
      throw new Error("Device binding not found.");
    }

    await deviceBindingsCol.updateOne(
      { _id: deviceBindingId },
      {
        $set: {
          status: "suspended",
          suspendedAt: now,
          suspensionReason: reason,
          updatedAt: now,
        },
      },
      { session }
    );

    await recordAdminAuditLog(db, {
      actor: {
        userId: actor.userId ? new ObjectId(actor.userId) : new ObjectId(),
        email: actor.email,
        role: actor.role,
      },
      action: "device.suspend",
      targetCollection: COLLECTION_NAMES.deviceBindings,
      targetId: deviceBindingId.toString(),
      outcome: "success",
      reason,
      metadata: {
        entitlementId: binding.entitlementId.toString(),
        userId: binding.userId.toString(),
      },
    });

    return {
      success: true,
      deviceBindingId: deviceBindingId.toString(),
    };
  });
}

export async function revokeDeviceBindingAdminWorkflow(
  db: Db,
  client: MongoClient,
  deviceBindingIdStr: string,
  reason: string,
  actor: AdminActorContext
): Promise<{ success: boolean; deviceBindingId: string }> {
  if (!ObjectId.isValid(deviceBindingIdStr)) {
    throw new Error("Invalid device binding ID.");
  }

  const deviceBindingId = new ObjectId(deviceBindingIdStr);
  const deviceBindingsCol = await getDeviceBindingsCollection(db);
  const entitlementsCol = await getEntitlementsCollection(db);
  const now = new Date();

  return executeInTransaction(client, async (session) => {
    const binding = await deviceBindingsCol.findOne({ _id: deviceBindingId }, { session });
    if (!binding) {
      throw new Error("Device binding not found.");
    }

    await deviceBindingsCol.updateOne(
      { _id: deviceBindingId },
      {
        $set: {
          status: "revoked",
          revokedAt: now,
          revokedBy: actor.email,
          revocationReason: reason,
          updatedAt: now,
        },
      },
      { session }
    );

    // If this was the active binding on the entitlement, clear it
    await entitlementsCol.updateOne(
      {
        _id: binding.entitlementId,
        activeInstallationIdHash: binding.devicePublicKeyHash,
      },
      {
        $set: {
          activeInstallationIdHash: null,
          deviceBoundAt: null,
          offlineLeaseExpiresAt: null,
          updatedAt: now,
        },
      },
      { session }
    );

    await recordAdminAuditLog(db, {
      actor: {
        userId: actor.userId ? new ObjectId(actor.userId) : new ObjectId(),
        email: actor.email,
        role: actor.role,
      },
      action: "device.revoke",
      targetCollection: COLLECTION_NAMES.deviceBindings,
      targetId: deviceBindingId.toString(),
      outcome: "success",
      reason,
      metadata: {
        entitlementId: binding.entitlementId.toString(),
        userId: binding.userId.toString(),
      },
    });

    return {
      success: true,
      deviceBindingId: deviceBindingId.toString(),
    };
  });
}

// ---------------------------------------------------------------------------
// 6. Query Helpers: Customer Device Status & Admin Listing
// ---------------------------------------------------------------------------

export interface CustomerDeviceOverview {
  hasEntitlement: boolean;
  entitlementStatus: string | null;
  productEdition: string;
  source: string;
  isDeviceBound: boolean;
  deviceBinding: {
    id: string;
    deviceLabel: string;
    clientVersion: string;
    boundAt: string;
    lastValidatedAt: string;
    leaseExpiresAt: string;
    status: string;
  } | null;
  replacementCount: number;
}

export async function getCustomerDeviceStatus(
  db: Db,
  userId: ObjectId
): Promise<CustomerDeviceOverview> {
  const entitlementsCol = await getEntitlementsCollection(db);
  const deviceBindingsCol = await getDeviceBindingsCollection(db);

  const entitlement = await entitlementsCol.findOne({
    userId,
    productSlug: "german",
  });

  if (!entitlement) {
    return {
      hasEntitlement: false,
      entitlementStatus: null,
      productEdition: "german",
      source: "none",
      isDeviceBound: false,
      deviceBinding: null,
      replacementCount: 0,
    };
  }

  const activeBinding = await deviceBindingsCol.findOne({
    entitlementId: entitlement._id,
    status: "active",
  });

  return {
    hasEntitlement: true,
    entitlementStatus: entitlement.status,
    productEdition: "german",
    source: entitlement.source || "purchase",
    isDeviceBound: Boolean(activeBinding),
    deviceBinding: activeBinding
      ? {
          id: activeBinding._id.toString(),
          deviceLabel: activeBinding.deviceLabel,
          clientVersion: activeBinding.clientVersion,
          boundAt: activeBinding.boundAt.toISOString(),
          lastValidatedAt: activeBinding.lastValidatedAt.toISOString(),
          leaseExpiresAt: activeBinding.leaseExpiresAt.toISOString(),
          status: activeBinding.status,
        }
      : null,
    replacementCount: entitlement.deviceReplacementCount ?? 0,
  };
}

export interface ListAdminDeviceBindingsParams {
  status?: string;
  search?: string;
  limit?: number;
  skip?: number;
}

export async function listAdminDeviceBindings(
  db: Db,
  params: ListAdminDeviceBindingsParams
) {
  const deviceBindingsCol = await getDeviceBindingsCollection(db);
  const filter: Record<string, unknown> = {};

  if (params.status && params.status !== "all") {
    filter.status = params.status;
  }

  if (params.search && params.search.trim()) {
    const q = params.search.trim();
    filter.$or = [
      { userEmail: { $regex: q, $options: "i" } },
      { deviceLabel: { $regex: q, $options: "i" } },
      { devicePublicKeyHash: { $regex: q, $options: "i" } },
    ];
  }

  const limit = Math.min(Math.max(params.limit ?? 25, 1), 100);
  const skip = Math.max(params.skip ?? 0, 0);

  const [items, total] = await Promise.all([
    deviceBindingsCol.find(filter).sort({ boundAt: -1 }).skip(skip).limit(limit).toArray(),
    deviceBindingsCol.countDocuments(filter),
  ]);

  return {
    items,
    total,
    limit,
    skip,
  };
}

export async function getAdminDeviceStats(db: Db) {
  const deviceBindingsCol = await getDeviceBindingsCollection(db);
  const [total, active, suspended, revoked] = await Promise.all([
    deviceBindingsCol.countDocuments({}),
    deviceBindingsCol.countDocuments({ status: "active" }),
    deviceBindingsCol.countDocuments({ status: "suspended" }),
    deviceBindingsCol.countDocuments({ status: "revoked" }),
  ]);

  return {
    total,
    active,
    suspended,
    revoked,
  };
}
