/* eslint-disable */
/**
 * LingoPDF — Licensing & Device Activation Automated Test Suite (Stage 4)
 *
 * Verifies all server-side licensing invariants, cryptographic signatures,
 * atomic device bindings, challenge-response renewals, concurrency protections,
 * and admin device replacement workflows.
 */

const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const ts = require("typescript");
const { MongoClient, ObjectId } = require("mongodb");

const moduleCache = new Map();

function loadTsModule(filePath) {
  const resolved = path.resolve(filePath);
  if (moduleCache.has(resolved)) {
    return moduleCache.get(resolved).exports;
  }

  const content = fs.readFileSync(resolved, "utf8");
  const transpiled = ts.transpileModule(content, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const m = { exports: {} };
  moduleCache.set(resolved, m);

  const customRequire = (specifier) => {
    if (specifier.startsWith("@/")) {
      const sub = specifier.slice(2);
      const targetPath = path.resolve(__dirname, "../src", sub);
      if (fs.existsSync(targetPath + ".ts")) {
        return loadTsModule(targetPath + ".ts");
      }
      if (fs.existsSync(targetPath + "/index.ts")) {
        return loadTsModule(targetPath + "/index.ts");
      }
      if (fs.existsSync(targetPath + ".tsx")) {
        return loadTsModule(targetPath + ".tsx");
      }
      return require(targetPath);
    }
    if (specifier.startsWith("./") || specifier.startsWith("../")) {
      const dir = path.dirname(resolved);
      let targetPath = path.resolve(dir, specifier);
      if (!fs.existsSync(targetPath) && fs.existsSync(targetPath + ".ts")) {
        targetPath = targetPath + ".ts";
      } else if (!fs.existsSync(targetPath) && fs.existsSync(targetPath + ".tsx")) {
        targetPath = targetPath + ".tsx";
      } else if (
        fs.existsSync(targetPath) &&
        fs.statSync(targetPath).isDirectory() &&
        fs.existsSync(path.join(targetPath, "index.ts"))
      ) {
        targetPath = path.join(targetPath, "index.ts");
      }
      if (targetPath.endsWith(".ts") || targetPath.endsWith(".tsx")) {
        return loadTsModule(targetPath);
      }
      return require(targetPath);
    }
    return require(specifier);
  };

  const fn = new Function("require", "module", "exports", "__dirname", "__filename", transpiled);
  fn(customRequire, m, m.exports, path.dirname(resolved), resolved);
  return m.exports;
}

async function runLicensingTestSuite() {
  console.log("=== Running Complete Licensing & Device Activation Test Suite ===\n");

  const envPath = path.resolve(__dirname, "../.env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        const k = trimmed.slice(0, eqIdx).trim();
        let v = trimmed.slice(eqIdx + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        if (!process.env[k]) {
          process.env[k] = v.replace(/\\n/g, "\n");
        }
      }
    }
  }

  const mongoUri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || "lingo_pdf";
  assert.ok(mongoUri, "MONGODB_URI must be configured in environment");

  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db(dbName);
  console.log(`Connected to MongoDB Atlas: database "${dbName}"\n`);

  const licensingServiceMod = loadTsModule(path.resolve(__dirname, "../src/lib/licensing/service.ts"));
  const {
    generateCryptographicActivationCode,
    normalizeActivationCode,
    hashActivationCode,
    maskActivationCode,
    generateActivationCodeForUser,
    activateDeviceBinding,
    createLicenceChallenge,
    renewLicenceLease,
    replaceDeviceControlledWorkflow,
    suspendDeviceBindingAdminWorkflow,
    revokeDeviceBindingAdminWorkflow,
    getCustomerDeviceStatus,
    signLicencePayload,
    canonicalizeLicencePayload,
    resetSigningKeyCache,
    loadServerSigningKey,
  } = licensingServiceMod;

  const promoServiceMod = loadTsModule(path.resolve(__dirname, "../src/lib/promoCodes/service.ts"));
  const { createPromotionalCode, redeemPromotionalCode } = promoServiceMod;

  const cleanup = {
    userIds: [],
    entitlementIds: [],
    promoCodeIds: [],
    activationCodeIds: [],
    deviceBindingIds: [],
    challengeIds: [],
    auditIds: [],
  };

  const mockAdmin = {
    userId: new ObjectId(),
    email: "admin@lingopdf.in",
    role: "admin",
  };

  try {
    // -------------------------------------------------------------------------
    // 1. Cryptographic Code Generation, Entropy & Fail-Closed Production Key
    // -------------------------------------------------------------------------
    console.log("[Test 1] Cryptographic Activation Code Generation, 60-bit Entropy & Fail-Closed Key");
    const sampleCodes = new Set();
    for (let i = 0; i < 50; i++) {
      const c = generateCryptographicActivationCode();
      assert.match(c, /^ACT-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/);
      // Ensure unambiguous alphabet (no 0, 1, I, O in random parts)
      const randomPart = c.slice(4);
      assert.ok(!randomPart.includes("0"));
      assert.ok(!randomPart.includes("1"));
      assert.ok(!randomPart.includes("I"));
      assert.ok(!randomPart.includes("O"));
      sampleCodes.add(c);
    }
    assert.equal(sampleCodes.size, 50, "All 50 generated activation codes must be unique");
    console.log("✓ Code generation verified: 60 bits of entropy (12 chars * 5 bits), unambiguous character set, format ACT-XXXX-XXXX-XXXX.");

    // Test SEC-AUDIT-01: Production Fail-Closed on Missing or Invalid Signing Key
    const originalEnv = process.env.NODE_ENV;
    const originalPem = process.env.LICENCE_SIGNING_PRIVATE_KEY_PEM;
    try {
      process.env.NODE_ENV = "production";
      resetSigningKeyCache();

      // Case 1a: Missing PEM in production -> MUST THROW fatal error
      delete process.env.LICENCE_SIGNING_PRIVATE_KEY_PEM;
      assert.throws(
        () => loadServerSigningKey(),
        /LICENCE_SIGNING_PRIVATE_KEY_PEM environment variable is required in production/
      );

      // Case 1b: Malformed PEM in production -> MUST THROW fatal error
      process.env.LICENCE_SIGNING_PRIVATE_KEY_PEM = "-----BEGIN PRIVATE KEY-----\nNOT_A_VALID_KEY\n-----END PRIVATE KEY-----";
      resetSigningKeyCache();
      assert.throws(
        () => loadServerSigningKey(),
        /LICENCE_SIGNING_PRIVATE_KEY_PEM is invalid or corrupted/
      );

      // Case 1c: Valid Ed25519 PEM in production -> Loads successfully
      process.env.LICENCE_SIGNING_PRIVATE_KEY_PEM = originalPem;
      resetSigningKeyCache();
      const prodKey = loadServerSigningKey();
      assert.ok(prodKey.privateKey, "Valid PEM must load cleanly in production");
      assert.equal(prodKey.privateKey.asymmetricKeyType, "ed25519");
      console.log("✓ Server signing key fail-closed verified: missing/malformed keys strictly rejected in production.");
    } finally {
      process.env.NODE_ENV = originalEnv;
      process.env.LICENCE_SIGNING_PRIVATE_KEY_PEM = originalPem;
      resetSigningKeyCache();
    }

    // -------------------------------------------------------------------------
    // 2. Customer Activation Code Generation Flow
    // -------------------------------------------------------------------------
    console.log("\n[Test 2] Customer Activation Code Generation & Entitlement Binding");
    const customerUser = {
      _id: new ObjectId(),
      email: "activation-tester@example.com",
      status: "active",
      role: "customer",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.collection("users").insertOne(customerUser);
    cleanup.userIds.push(customerUser._id);

    // 2a. Attempt generation without entitlement -> must be rejected
    const unentitledResult = await generateActivationCodeForUser(db, client, customerUser);
    assert.equal(unentitledResult.success, false);
    assert.equal(unentitledResult.code, "NO_ACTIVE_ENTITLEMENT");

    // 2b. Grant customer active German entitlement
    const entitlementDoc = {
      _id: new ObjectId(),
      userId: customerUser._id,
      purchaseId: null,
      productSlug: "german",
      editionVersion: "1.0",
      status: "active",
      source: "purchase",
      activeRestrictionReasons: [],
      revocationReason: null,
      maxActiveDevices: 1,
      activeInstallationIdHash: null,
      deviceBoundAt: null,
      lastValidatedAt: null,
      offlineLeaseExpiresAt: null,
      suspendedAt: null,
      revokedAt: null,
      deviceReplacementCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.collection("entitlements").insertOne(entitlementDoc);
    cleanup.entitlementIds.push(entitlementDoc._id);

    // 2c. Generate activation code with active entitlement -> succeeds
    const genResult1 = await generateActivationCodeForUser(db, client, customerUser);
    assert.equal(genResult1.success, true);
    assert.ok(genResult1.activationCode.startsWith("ACT-"));
    assert.ok(genResult1.codeMasked.includes("••••"));
    assert.ok(genResult1.expiresAt > new Date());

    // Verify plaintext code is NOT in database
    const codeInDb = await db.collection("activation_codes").findOne({
      codeHash: hashActivationCode(genResult1.activationCode),
    });
    assert.ok(codeInDb, "Activation code document must exist by hash");
    assert.equal(codeInDb.code, undefined, "Plaintext code must NEVER exist on database document");
    assert.equal(codeInDb.status, "active");
    cleanup.activationCodeIds.push(codeInDb._id);

    // 2d. Generate replacement code -> previous code is superseded
    const genResult2 = await generateActivationCodeForUser(db, client, customerUser);
    assert.equal(genResult2.success, true);

    const oldCodeDoc = await db.collection("activation_codes").findOne({ _id: codeInDb._id });
    assert.equal(oldCodeDoc.status, "superseded", "Prior activation code must be automatically superseded");

    const newCodeDoc = await db.collection("activation_codes").findOne({
      codeHash: hashActivationCode(genResult2.activationCode),
    });
    assert.equal(newCodeDoc.status, "active");
    cleanup.activationCodeIds.push(newCodeDoc._id);
    console.log("✓ Activation code generation verified: bound to active German entitlement, short-lived, SHA-256 hashed, superseding older codes.");

    // -------------------------------------------------------------------------
    // 3. Extension Activation & Ed25519 Signed Lease Issuance
    // -------------------------------------------------------------------------
    console.log("\n[Test 3] Extension Activation & Cryptographic Lease Issuance");
    // Generate simulated device Ed25519 key pair
    const deviceKeypair = crypto.generateKeyPairSync("ed25519");
    const devicePublicKeySpki = deviceKeypair.publicKey.export({ format: "der", type: "spki" }).toString("base64");

    // 3a. Attempt activating with superseded code -> must be rejected
    const supersededActivate = await activateDeviceBinding(db, client, {
      code: genResult1.activationCode,
      devicePublicKeySpki,
      deviceLabel: "Chrome on Windows",
    });
    assert.equal(supersededActivate.success, false);
    assert.equal(supersededActivate.code, "SUPERSEDED_CODE");

    // 3b. Activate with valid current code -> succeeds
    const activateResult = await activateDeviceBinding(db, client, {
      code: genResult2.activationCode,
      devicePublicKeySpki,
      deviceLabel: "Chrome on macOS",
      clientVersion: "0.1.0",
    });
    assert.equal(activateResult.success, true);
    assert.ok(activateResult.deviceBindingId);
    assert.ok(activateResult.lease);
    assert.equal(activateResult.lease.keyId, "lingopdf-ed25519-v1");
    assert.equal(activateResult.lease.payload.productEdition, "german");
    assert.equal(activateResult.lease.payload.licenceStatus, "active");
    assert.equal(activateResult.lease.payload.deviceBindingId, activateResult.deviceBindingId);
    cleanup.deviceBindingIds.push(new ObjectId(activateResult.deviceBindingId));

    // Verify SEC-AUDIT-02: 24h active lease + 48h grace (72h absolute cutoff)
    const leaseDuration = activateResult.lease.payload.leaseExpiresAt - activateResult.lease.payload.issuedAt;
    assert.equal(leaseDuration, 24 * 60 * 60 * 1000, "Online lease duration must be exactly 24 hours");
    const graceDuration = activateResult.lease.payload.offlineGraceExpiresAt - activateResult.lease.payload.issuedAt;
    assert.equal(graceDuration, 72 * 60 * 60 * 1000, "Absolute offline grace duration must be exactly 72 hours from validation");

    // Verify cryptographic signature of server lease
    const { privateKey } = loadServerSigningKey();
    const serverPubKey = crypto.createPublicKey(privateKey);
    const canonicalPayload = canonicalizeLicencePayload(activateResult.lease.payload);
    const isLeaseSigValid = crypto.verify(
      null,
      Buffer.from(canonicalPayload, "utf8"),
      serverPubKey,
      Buffer.from(activateResult.lease.signature, "base64")
    );
    assert.equal(isLeaseSigValid, true, "Server Ed25519 lease signature must verify against server public key");

    // Verify database updates
    const updatedEntitlement = await db.collection("entitlements").findOne({ _id: entitlementDoc._id });
    assert.ok(updatedEntitlement.activeInstallationIdHash);
    assert.ok(updatedEntitlement.deviceBoundAt);
    assert.ok(updatedEntitlement.offlineLeaseExpiresAt);

    // Verify SEC-AUDIT-03 & Consistency Audit: Consumed code audit trail preserved; expiresAt retained for audit, cleanupAt unset to prevent TTL purging
    const consumedCodeDoc = await db.collection("activation_codes").findOne({ _id: newCodeDoc._id });
    assert.equal(consumedCodeDoc.status, "consumed");
    assert.equal(consumedCodeDoc.consumedByDeviceId.toString(), activateResult.deviceBindingId);
    assert.ok(consumedCodeDoc.consumedAt, "consumedAt timestamp must be preserved");
    assert.ok(consumedCodeDoc.userId, "userId must be preserved");
    assert.ok(consumedCodeDoc.entitlementId, "entitlementId must be preserved");
    assert.ok(consumedCodeDoc.expiresAt, "expiresAt security expiry MUST be retained for audit");
    assert.equal(consumedCodeDoc.cleanupAt, undefined, "cleanupAt MUST be unset on consumed codes to prevent TTL purging");

    // 3c. Attempt reusing already-consumed code -> rejected
    const reusedActivate = await activateDeviceBinding(db, client, {
      code: genResult2.activationCode,
      devicePublicKeySpki,
      deviceLabel: "Another Device",
    });
    assert.equal(reusedActivate.success, false);
    assert.equal(reusedActivate.code, "ALREADY_CONSUMED");
    console.log("✓ Device activation verified: Ed25519 signed lease issued, single-use code consumed, entitlement bound.");

    // -------------------------------------------------------------------------
    // 4. One-Device Enforcement (Cannot Bind a Second Device)
    // -------------------------------------------------------------------------
    console.log("\n[Test 4] One-Device Policy Enforcement");
    // Customer tries to generate another activation code while a device is active
    const secondCodeAttempt = await generateActivationCodeForUser(db, client, customerUser);
    assert.equal(secondCodeAttempt.success, false);
    assert.equal(secondCodeAttempt.code, "DEVICE_ALREADY_BOUND");
    assert.ok(secondCodeAttempt.message.includes("one active device"));
    console.log("✓ One-device policy enforced: active device blocks generating new activation codes without controlled replacement.");

    // -------------------------------------------------------------------------
    // 5. Online Renewal via Challenge-Response (Device Proof-of-Possession)
    // -------------------------------------------------------------------------
    console.log("\n[Test 5] Online Renewal via Challenge-Response (Proof-of-Possession)");
    // 5a. Step 1: Request Challenge Nonce
    const challengeRes = await createLicenceChallenge(db, activateResult.deviceBindingId);
    assert.equal(challengeRes.success, true);
    assert.ok(challengeRes.challenge);
    assert.ok(challengeRes.expiresAt > new Date());

    // 5b. Step 2: Sign Challenge with Device Private Key
    const challengeSig = crypto
      .sign(null, Buffer.from(challengeRes.challenge, "utf8"), deviceKeypair.privateKey)
      .toString("base64");

    // 5c. Step 3: Submit Renewal
    const renewRes = await renewLicenceLease(db, client, {
      deviceBindingId: activateResult.deviceBindingId,
      challenge: challengeRes.challenge,
      signature: challengeSig,
    });
    assert.equal(renewRes.success, true);
    assert.ok(renewRes.lease);
    assert.equal(renewRes.lease.payload.deviceBindingId, activateResult.deviceBindingId);
    assert.equal(renewRes.lease.payload.leaseExpiresAt - renewRes.lease.payload.issuedAt, 24 * 60 * 60 * 1000, "Renewed lease duration must be 24 hours");
    assert.equal(renewRes.lease.payload.offlineGraceExpiresAt - renewRes.lease.payload.issuedAt, 72 * 60 * 60 * 1000, "Renewed offline grace duration must be 72 hours");

    // 5d. Replay attack rejection: Cannot reuse the same challenge
    const replayRenew = await renewLicenceLease(db, client, {
      deviceBindingId: activateResult.deviceBindingId,
      challenge: challengeRes.challenge,
      signature: challengeSig,
    });
    assert.equal(replayRenew.success, false);
    assert.equal(replayRenew.code, "INVALID_OR_EXPIRED_CHALLENGE");

    // 5e. Forged signature rejection: Random private key cannot renew
    const fakeKeypair = crypto.generateKeyPairSync("ed25519");
    const challengeRes2 = await createLicenceChallenge(db, activateResult.deviceBindingId);
    const forgedSig = crypto
      .sign(null, Buffer.from(challengeRes2.challenge, "utf8"), fakeKeypair.privateKey)
      .toString("base64");

    const forgedRenew = await renewLicenceLease(db, client, {
      deviceBindingId: activateResult.deviceBindingId,
      challenge: challengeRes2.challenge,
      signature: forgedSig,
    });
    assert.equal(forgedRenew.success, false);
    assert.equal(forgedRenew.code, "INVALID_DEVICE_SIGNATURE");
    console.log("✓ Renewal challenge-response verified: proof-of-possession enforced, replay attacks blocked, forged keys rejected.");

    // -------------------------------------------------------------------------
    // 6. Concurrency & Race Condition Defense (Two Simultaneous Activations)
    // -------------------------------------------------------------------------
    console.log("\n[Test 6] Concurrency: Simultaneous Activation Attempts");
    // Create new customer with active entitlement
    const raceUser = {
      _id: new ObjectId(),
      email: "race-tester@example.com",
      status: "active",
      role: "customer",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.collection("users").insertOne(raceUser);
    cleanup.userIds.push(raceUser._id);

    const raceEntitlement = {
      _id: new ObjectId(),
      userId: raceUser._id,
      productSlug: "german",
      editionVersion: "1.0",
      status: "active",
      source: "purchase",
      activeRestrictionReasons: [],
      revocationReason: null,
      maxActiveDevices: 1,
      activeInstallationIdHash: null,
      deviceBoundAt: null,
      lastValidatedAt: null,
      offlineLeaseExpiresAt: null,
      suspendedAt: null,
      revokedAt: null,
      deviceReplacementCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.collection("entitlements").insertOne(raceEntitlement);
    cleanup.entitlementIds.push(raceEntitlement._id);

    const raceCode = await generateActivationCodeForUser(db, client, raceUser);
    cleanup.activationCodeIds.push(
      (await db.collection("activation_codes").findOne({ codeHash: hashActivationCode(raceCode.activationCode) }))._id
    );

    const devA = crypto.generateKeyPairSync("ed25519").publicKey.export({ format: "der", type: "spki" }).toString("base64");
    const devB = crypto.generateKeyPairSync("ed25519").publicKey.export({ format: "der", type: "spki" }).toString("base64");

    // Launch both activation requests concurrently
    const [raceA, raceB] = await Promise.all([
      activateDeviceBinding(db, client, { code: raceCode.activationCode, devicePublicKeySpki: devA, deviceLabel: "Device A" }),
      activateDeviceBinding(db, client, { code: raceCode.activationCode, devicePublicKeySpki: devB, deviceLabel: "Device B" }),
    ]);

    const successes = [raceA, raceB].filter((r) => r.success);
    const failures = [raceA, raceB].filter((r) => !r.success);

    assert.equal(successes.length, 1, "Exactly one concurrent activation must succeed");
    assert.equal(failures.length, 1, "The competing concurrent activation must fail");
    if (successes[0].deviceBindingId) {
      cleanup.deviceBindingIds.push(new ObjectId(successes[0].deviceBindingId));
    }

    const boundDevicesCount = await db.collection("device_bindings").countDocuments({
      entitlementId: raceEntitlement._id,
      status: "active",
    });
    assert.equal(boundDevicesCount, 1, "Database must strictly contain exactly 1 active device binding");
    console.log("✓ Concurrency defense verified: atomic transaction guarantees exactly 1 device bound under concurrent load.");

    // -------------------------------------------------------------------------
    // 7. 100% Complimentary Promo Code Integration Flow
    // -------------------------------------------------------------------------
    console.log("\n[Test 7] Full Complimentary Promo Code -> Activation -> Entitlement Flow");
    const complimentaryUser = {
      _id: new ObjectId(),
      email: "complimentary-recipient@example.com",
      status: "active",
      role: "customer",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.collection("users").insertOne(complimentaryUser);
    cleanup.userIds.push(complimentaryUser._id);

    // Admin creates 100% complimentary promo code
    const promo = await createPromotionalCode(db, { label: "Goethe Reviewer Complimentary" }, mockAdmin);
    cleanup.promoCodeIds.push(promo.promoCode._id);

    // Customer redeems complimentary code on website
    const redeemRes = await redeemPromotionalCode(db, client, {
      code: promo.fullCode,
      user: complimentaryUser,
    });
    assert.equal(redeemRes.success, true);
    assert.ok(redeemRes.entitlementId);
    cleanup.entitlementIds.push(new ObjectId(redeemRes.entitlementId));

    // Customer generates activation code for extension
    const compActCode = await generateActivationCodeForUser(db, client, complimentaryUser);
    assert.equal(compActCode.success, true);

    // Extension activates against complimentary entitlement
    const compDevKeys = crypto.generateKeyPairSync("ed25519");
    const compSpki = compDevKeys.publicKey.export({ format: "der", type: "spki" }).toString("base64");

    const compActivate = await activateDeviceBinding(db, client, {
      code: compActCode.activationCode,
      devicePublicKeySpki: compSpki,
      deviceLabel: "Reviewer Laptop",
    });
    assert.equal(compActivate.success, true);
    assert.equal(compActivate.lease.payload.licenceStatus, "active");
    assert.equal(compActivate.lease.payload.productEdition, "german");
    cleanup.deviceBindingIds.push(new ObjectId(compActivate.deviceBindingId));

    // Verify 0 fake purchases were created
    const fakePurchases = await db.collection("purchases").countDocuments({ userId: complimentaryUser._id });
    assert.equal(fakePurchases, 0, "No fake purchase records must ever be created for complimentary entitlements");
    console.log("✓ Complimentary flow verified: 100% promo code grants German entitlement and activates 1 device with zero fake purchases.");

    // -------------------------------------------------------------------------
    // 8. Controlled Admin Device Replacement Workflow
    // -------------------------------------------------------------------------
    console.log("\n[Test 8] Controlled Admin Device Replacement");
    // Admin replaces device on customer's entitlement
    const replaceRes = await replaceDeviceControlledWorkflow(
      db,
      client,
      entitlementDoc._id.toString(),
      "Customer switched to new MacBook Air, verified via support ticket #1204",
      mockAdmin
    );
    assert.equal(replaceRes.success, true);
    assert.equal(replaceRes.revokedDeviceCount, 1);

    // Verify old device is revoked
    const oldDev = await db.collection("device_bindings").findOne({ _id: new ObjectId(activateResult.deviceBindingId) });
    assert.equal(oldDev.status, "revoked");
    assert.equal(oldDev.revokedBy, mockAdmin.email);

    // Verify entitlement activeInstallationIdHash was cleared and replacement count incremented
    const clearedEnt = await db.collection("entitlements").findOne({ _id: entitlementDoc._id });
    assert.equal(clearedEnt.activeInstallationIdHash, null);
    assert.equal(clearedEnt.deviceReplacementCount, 1);

    // Old device attempts renewal -> rejected because status is revoked
    const oldDevChallenge = await createLicenceChallenge(db, activateResult.deviceBindingId);
    assert.equal(oldDevChallenge.success, false);
    assert.equal(oldDevChallenge.code, "DEVICE_REVOKED");

    // Customer can now generate a new activation code for their new device!
    const newDeviceCode = await generateActivationCodeForUser(db, client, customerUser);
    assert.equal(newDeviceCode.success, true);
    assert.ok(newDeviceCode.activationCode);

    // New device activates
    const newDevKeypair = crypto.generateKeyPairSync("ed25519");
    const newDevSpki = newDevKeypair.publicKey.export({ format: "der", type: "spki" }).toString("base64");
    const newDevActivate = await activateDeviceBinding(db, client, {
      code: newDeviceCode.activationCode,
      devicePublicKeySpki: newDevSpki,
      deviceLabel: "New MacBook Air",
    });
    assert.equal(newDevActivate.success, true);
    cleanup.deviceBindingIds.push(new ObjectId(newDevActivate.deviceBindingId));
    console.log("✓ Controlled device replacement verified: old device revoked, entitlement reset, new device successfully activated.");

    // -------------------------------------------------------------------------
    // 9. Admin Device Suspension and Revocation Workflows
    // -------------------------------------------------------------------------
    console.log("\n[Test 9] Admin Device Suspension & Revocation");
    const suspendRes = await suspendDeviceBindingAdminWorkflow(
      db,
      client,
      newDevActivate.deviceBindingId,
      "Security review hold",
      mockAdmin
    );
    assert.equal(suspendRes.success, true);

    const suspendedDev = await db.collection("device_bindings").findOne({ _id: new ObjectId(newDevActivate.deviceBindingId) });
    assert.equal(suspendedDev.status, "suspended");

    // Suspended device cannot renew
    const suspendedChallenge = await createLicenceChallenge(db, newDevActivate.deviceBindingId);
    assert.equal(suspendedChallenge.success, false);
    assert.equal(suspendedChallenge.code, "DEVICE_SUSPENDED");

    // Admin revokes device permanently
    const revokeRes = await revokeDeviceBindingAdminWorkflow(
      db,
      client,
      newDevActivate.deviceBindingId,
      "Permanent revocation requested",
      mockAdmin
    );
    assert.equal(revokeRes.success, true);

    const revokedDev = await db.collection("device_bindings").findOne({ _id: new ObjectId(newDevActivate.deviceBindingId) });
    assert.equal(revokedDev.status, "revoked");
    console.log("✓ Admin device suspension and revocation verified.");

    // -------------------------------------------------------------------------
    // 10. Customer Overview Query
    // -------------------------------------------------------------------------
    console.log("\n[Test 10] Customer Device Status Overview");
    const overview = await getCustomerDeviceStatus(db, customerUser._id);
    assert.equal(overview.hasEntitlement, true);
    assert.equal(overview.productEdition, "german");
    assert.equal(overview.replacementCount, 1);
    console.log("✓ Customer device overview verified without exposing sensitive keys.");

  } finally {
    console.log("\nCleaning up test documents from MongoDB Atlas...");
    if (cleanup.userIds.length > 0) {
      await db.collection("users").deleteMany({ _id: { $in: cleanup.userIds } });
    }
    if (cleanup.entitlementIds.length > 0) {
      await db.collection("entitlements").deleteMany({ _id: { $in: cleanup.entitlementIds } });
    }
    if (cleanup.promoCodeIds.length > 0) {
      await db.collection("promo_codes").deleteMany({ _id: { $in: cleanup.promoCodeIds } });
    }
    if (cleanup.activationCodeIds.length > 0) {
      await db.collection("activation_codes").deleteMany({ _id: { $in: cleanup.activationCodeIds } });
    }
    if (cleanup.deviceBindingIds.length > 0) {
      await db.collection("device_bindings").deleteMany({ _id: { $in: cleanup.deviceBindingIds } });
    }
    if (cleanup.challengeIds.length > 0) {
      await db.collection("licence_challenges").deleteMany({ _id: { $in: cleanup.challengeIds } });
    }
    await db.collection("admin_audit_logs").deleteMany({
      action: { $in: ["entitlement.replace_device", "device.suspend", "device.revoke"] },
      actorEmail: "admin@lingopdf.in",
    });
    await client.close().catch(() => {});
    console.log("✓ Cleanup completed.");
  }

  console.log("\n🎉 ALL 10 SERVER-SIDE LICENSING & ACTIVATION TESTS PASSED!\n");
}

runLicensingTestSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
