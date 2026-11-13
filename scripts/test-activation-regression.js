/* eslint-disable */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const ts = require("typescript");
const { MongoClient, ObjectId } = require("mongodb");

function loadEnvFile(envFilePath) {
  if (!fs.existsSync(envFilePath)) return;
  const content = fs.readFileSync(envFilePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnvFile(path.resolve(process.cwd(), ".env.local"));

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
    return require(specifier);
  };

  const fn = new Function("require", "module", "exports", "__dirname", "__filename", transpiled);
  fn(customRequire, m, m.exports, path.dirname(resolved), resolved);
  return m.exports;
}

const servicePath = path.resolve(__dirname, "../src/lib/licensing/service.ts");
const {
  generateActivationCodeForUser,
  generateCryptographicActivationCode,
  activateDeviceBinding,
  createLicenceChallenge,
  renewLicenceLease,
  replaceDeviceControlledWorkflow,
  hashActivationCode,
  ACTIVATION_CODE_EXPIRY_MS,
  ACTIVATION_CODE_CLEANUP_TTL_MS,
} = loadTsModule(servicePath);

function generateTestDeviceKeypair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const devicePublicKeySpki = publicKey.export({ type: "spki", format: "der" }).toString("base64");
  return { publicKey, privateKey, devicePublicKeySpki };
}

async function runRegressionSuite() {
  console.log("=== LingoPDF Activation & One-Device Replacement Regression Suite ===");
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing MONGODB_URI in environment.");

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("lingo_pdf");

  const usersCol = db.collection("users");
  const entitlementsCol = db.collection("entitlements");
  const activationCodesCol = db.collection("activation_codes");
  const deviceBindingsCol = db.collection("device_bindings");
  const challengesCol = db.collection("licence_challenges");
  const adminAuditCol = db.collection("admin_audit_logs");

  // Track created test IDs for safe cleanup
  const cleanup = {
    userIds: [],
    entitlementIds: [],
    codeIds: [],
    bindingIds: [],
    auditIds: [],
  };

  try {
    // Setup test user and active German edition entitlement
    const testUserId = new ObjectId();
    cleanup.userIds.push(testUserId);
    const testUserEmail = `reg-test-${Date.now()}@example.com`;

    await usersCol.insertOne({
      _id: testUserId,
      email: testUserEmail,
      role: "customer",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const testEntitlementId = new ObjectId();
    cleanup.entitlementIds.push(testEntitlementId);

    await entitlementsCol.insertOne({
      _id: testEntitlementId,
      userId: testUserId,
      userEmail: testUserEmail,
      productSlug: "german",
      edition: "german",
      status: "active",
      maxActiveDevices: 1,
      activeInstallationIdHash: null,
      deviceBoundAt: null,
      offlineLeaseExpiresAt: null,
      deviceReplacementCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const testUserContext = {
      _id: testUserId,
      email: testUserEmail,
      role: "customer",
    };

    // -------------------------------------------------------------------------
    // Test 1: First-device activation
    // -------------------------------------------------------------------------
    console.log("\nTest 1: First-device activation...");
    const genResult1 = await generateActivationCodeForUser(db, client, testUserContext);
    assert.strictEqual(genResult1.success, true, "Failed to generate activation code for user");
    assert(genResult1.activationCode, "Missing activation code");
    
    // Check 10-minute expiry vs 7-day cleanup in DB
    const codeHash1 = hashActivationCode(genResult1.activationCode);
    const codeDoc1 = await activationCodesCol.findOne({ codeHash: codeHash1 });
    assert(codeDoc1, "Activation code document not found in database");
    cleanup.codeIds.push(codeDoc1._id);

    const expectedExpiryMs = codeDoc1.createdAt.getTime() + ACTIVATION_CODE_EXPIRY_MS;
    const expectedCleanupMs = codeDoc1.createdAt.getTime() + ACTIVATION_CODE_CLEANUP_TTL_MS;
    assert.strictEqual(codeDoc1.expiresAt.getTime(), expectedExpiryMs, "expiresAt must be exactly 10 minutes");
    assert.strictEqual(codeDoc1.cleanupAt.getTime(), expectedCleanupMs, "cleanupAt must be exactly 7 days");

    // Activate Device 1
    const device1 = generateTestDeviceKeypair();
    const actResult1 = await activateDeviceBinding(db, client, {
      code: genResult1.activationCode,
      devicePublicKeySpki: device1.devicePublicKeySpki,
      deviceLabel: "Device 1 (Windows Chrome)",
      clientVersion: "0.1.0",
    });

    assert.strictEqual(actResult1.success, true, "Device 1 activation failed");
    assert(actResult1.lease, "Missing signed lease for Device 1");
    assert.strictEqual(actResult1.lease.payload.productEdition, "german");
    cleanup.bindingIds.push(new ObjectId(actResult1.deviceBindingId));

    // Verify DB state after consumption: expiresAt preserved, cleanupAt unset
    const consumedCodeDoc = await activationCodesCol.findOne({ _id: codeDoc1._id });
    assert.strictEqual(consumedCodeDoc.status, "consumed");
    assert(consumedCodeDoc.consumedAt instanceof Date, "consumedAt must be recorded");
    assert(consumedCodeDoc.expiresAt instanceof Date, "expiresAt MUST remain permanently preserved for audit");
    assert.strictEqual(consumedCodeDoc.cleanupAt, undefined, "cleanupAt MUST be unset so TTL never purges consumed codes");

    // Verify active device binding count
    const activeBindings1 = await deviceBindingsCol.find({ entitlementId: testEntitlementId, status: "active" }).toArray();
    assert.strictEqual(activeBindings1.length, 1, "Must have exactly 1 active device binding");
    console.log("  PASS: Device 1 activated successfully. Consumed code permanently preserved for audit (cleanupAt unset, expiresAt retained).");

    // -------------------------------------------------------------------------
    // Test 2: Second-device activation while the first is active
    // -------------------------------------------------------------------------
    console.log("\nTest 2: Second-device activation while the first is active...");
    // 2a: Customer attempts to generate a second code from account
    const genResult2 = await generateActivationCodeForUser(db, client, testUserContext);
    assert.strictEqual(genResult2.success, false);
    assert.strictEqual(genResult2.code, "DEVICE_ALREADY_BOUND");

    // 2b: Device 2 attempts to activate directly with any forged or existing code
    const device2 = generateTestDeviceKeypair();
    const actResult2 = await activateDeviceBinding(db, client, {
      code: genResult1.activationCode,
      devicePublicKeySpki: device2.devicePublicKeySpki,
      deviceLabel: "Device 2 (Mac Chrome)",
      clientVersion: "0.1.0",
    });
    assert.strictEqual(actResult2.success, false);

    // 2c: Verify DB still enforces exactly 1 active device
    const activeBindings2 = await deviceBindingsCol.find({ entitlementId: testEntitlementId, status: "active" }).toArray();
    assert.strictEqual(activeBindings2.length, 1, "Database must strictly contain 1 active device");
    console.log("  PASS: Second device blocked with DEVICE_ALREADY_BOUND. 1-device policy preserved.");

    // -------------------------------------------------------------------------
    // Test 3: Repeated activation using the same code
    // -------------------------------------------------------------------------
    console.log("\nTest 3: Repeated activation using the same code...");
    const repeatAct = await activateDeviceBinding(db, client, {
      code: genResult1.activationCode,
      devicePublicKeySpki: device1.devicePublicKeySpki,
      deviceLabel: "Device 1 Repeat",
      clientVersion: "0.1.0",
    });
    assert.strictEqual(repeatAct.success, false);
    assert.strictEqual(repeatAct.code, "ALREADY_CONSUMED");
    console.log("  PASS: Re-using consumed activation code strictly rejected with ALREADY_CONSUMED.");

    // -------------------------------------------------------------------------
    // Test 4: Activation after 10-minute expiry
    // -------------------------------------------------------------------------
    console.log("\nTest 4: Activation after 10-minute expiry...");
    const expiredUserId = new ObjectId();
    cleanup.userIds.push(expiredUserId);
    const expiredUserEmail = `exp-test-${Date.now()}@example.com`;
    await usersCol.insertOne({
      _id: expiredUserId,
      email: expiredUserEmail,
      role: "customer",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const expiredEntId = new ObjectId();
    cleanup.entitlementIds.push(expiredEntId);
    await entitlementsCol.insertOne({
      _id: expiredEntId,
      userId: expiredUserId,
      userEmail: expiredUserEmail,
      productSlug: "german",
      edition: "german",
      status: "active",
      maxActiveDevices: 1,
      activeInstallationIdHash: null,
      deviceBoundAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const expiredCodeStr = generateCryptographicActivationCode();
    const expiredCodeHash = hashActivationCode(expiredCodeStr);
    const tenMinAgo = new Date(Date.now() - 11 * 60 * 1000);
    const expiredAt = new Date(Date.now() - 1 * 60 * 1000); // Expired 1 min ago
    const futureCleanup = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000); // 6 days in future

    const expiredDoc = {
      _id: new ObjectId(),
      codeHash: expiredCodeHash,
      codeMasked: "LPDF-••••-••••-10MN",
      codePrefix: "ACT",
      userId: expiredUserId,
      userEmail: expiredUserEmail,
      entitlementId: expiredEntId,
      productEdition: "german",
      status: "active",
      createdAt: tenMinAgo,
      expiresAt: expiredAt,
      cleanupAt: futureCleanup,
      consumedAt: null,
      consumedByDeviceId: null,
      updatedAt: tenMinAgo,
    };
    await activationCodesCol.insertOne(expiredDoc);
    cleanup.codeIds.push(expiredDoc._id);

    // Verify record exists in DB
    const foundExpiredDoc = await activationCodesCol.findOne({ _id: expiredDoc._id });
    assert(foundExpiredDoc, "Expired code doc must exist in DB before 7-day cleanup");

    // Attempt activation with expired code
    const expiredDevice = generateTestDeviceKeypair();
    const expiredActResult = await activateDeviceBinding(db, client, {
      code: expiredCodeStr,
      devicePublicKeySpki: expiredDevice.devicePublicKeySpki,
      deviceLabel: "Expired Test Device",
      clientVersion: "0.1.0",
    });

    assert.strictEqual(expiredActResult.success, false);
    assert.strictEqual(expiredActResult.code, "EXPIRED_CODE");
    console.log("  PASS: Code older than 10 minutes rejected with EXPIRED_CODE while still present in database.");

    // -------------------------------------------------------------------------
    // Test 5: Activation after clearing local extension storage
    // -------------------------------------------------------------------------
    console.log("\nTest 5: Activation after clearing local extension storage...");
    // Device 1 clears local storage => generates new keypair / UUID
    const clearedStorageDevice = generateTestDeviceKeypair();
    // User tries to generate code without admin reset
    const clearedGen = await generateActivationCodeForUser(db, client, testUserContext);
    assert.strictEqual(clearedGen.success, false);
    assert.strictEqual(clearedGen.code, "DEVICE_ALREADY_BOUND");
    console.log("  PASS: Clearing client storage cannot bypass 1-device limit. New code generation blocked.");

    // -------------------------------------------------------------------------
    // Test 6: Admin-authorized device replacement
    // -------------------------------------------------------------------------
    console.log("\nTest 6: Admin-authorized device replacement...");
    const adminActor = {
      userId: new ObjectId().toString(),
      email: "admin@lingopdf.in",
      role: "admin",
    };

    const replaceResult = await replaceDeviceControlledWorkflow(
      db,
      client,
      testEntitlementId.toString(),
      "Customer upgraded laptop; requested device transfer.",
      adminActor
    );

    assert.strictEqual(replaceResult.success, true);
    assert.strictEqual(replaceResult.revokedDeviceCount, 1);

    // Verify entitlement reset
    const entAfterReplace = await entitlementsCol.findOne({ _id: testEntitlementId });
    assert.strictEqual(entAfterReplace.activeInstallationIdHash, null);
    assert.strictEqual(entAfterReplace.deviceReplacementCount, 1);

    // Verify old device binding revoked
    const oldBinding = await deviceBindingsCol.findOne({ _id: new ObjectId(actResult1.deviceBindingId) });
    assert.strictEqual(oldBinding.status, "revoked");
    assert.strictEqual(oldBinding.revokedBy, "admin@lingopdf.in");
    console.log("  PASS: Admin device replacement revoked old binding, reset entitlement, and recorded audit log.");

    // -------------------------------------------------------------------------
    // Test 7: Old device renewal after replacement
    // -------------------------------------------------------------------------
    console.log("\nTest 7: Old device renewal after replacement...");
    // Old Device 1 requests renewal challenge
    const chalResult = await createLicenceChallenge(db, actResult1.deviceBindingId);
    assert.strictEqual(chalResult.success, false);
    assert.strictEqual(chalResult.code, "DEVICE_REVOKED");
    console.log("  PASS: Old device rejected on renewal attempt with DEVICE_REVOKED.");

    // -------------------------------------------------------------------------
    // Test 8: New device activation after replacement
    // -------------------------------------------------------------------------
    console.log("\nTest 8: New device activation after replacement...");
    const genResultNew = await generateActivationCodeForUser(db, client, testUserContext);
    assert.strictEqual(genResultNew.success, true, "Should allow code generation after admin replacement");
    const codeHashNew = hashActivationCode(genResultNew.activationCode);
    const codeDocNew = await activationCodesCol.findOne({ codeHash: codeHashNew });
    cleanup.codeIds.push(codeDocNew._id);

    const newDevice = generateTestDeviceKeypair();
    const actResultNew = await activateDeviceBinding(db, client, {
      code: genResultNew.activationCode,
      devicePublicKeySpki: newDevice.devicePublicKeySpki,
      deviceLabel: "New Replacement Laptop (Windows Chrome)",
      clientVersion: "0.1.0",
    });

    assert.strictEqual(actResultNew.success, true);
    cleanup.bindingIds.push(new ObjectId(actResultNew.deviceBindingId));

    // Verify exactly 1 active binding exists
    const currentActiveBindings = await deviceBindingsCol.find({ entitlementId: testEntitlementId, status: "active" }).toArray();
    assert.strictEqual(currentActiveBindings.length, 1, "Exactly one device binding can be active");
    assert.strictEqual(currentActiveBindings[0]._id.toString(), actResultNew.deviceBindingId);

    const revokedBindings = await deviceBindingsCol.find({ entitlementId: testEntitlementId, status: "revoked" }).toArray();
    assert.strictEqual(revokedBindings.length, 1, "Must contain exactly 1 revoked historical binding");
    console.log("  PASS: New device activated. Total active devices on entitlement = exactly 1.");

    // -------------------------------------------------------------------------
    // Test 9: Concurrent activation attempts
    // -------------------------------------------------------------------------
    console.log("\nTest 9: Concurrent activation attempts...");
    const concurrentUserId = new ObjectId();
    cleanup.userIds.push(concurrentUserId);
    const concurrentUserEmail = `conc-test-${Date.now()}@example.com`;
    await usersCol.insertOne({
      _id: concurrentUserId,
      email: concurrentUserEmail,
      role: "customer",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const concurrentEntId = new ObjectId();
    cleanup.entitlementIds.push(concurrentEntId);
    await entitlementsCol.insertOne({
      _id: concurrentEntId,
      userId: concurrentUserId,
      userEmail: concurrentUserEmail,
      productSlug: "german",
      edition: "german",
      status: "active",
      maxActiveDevices: 1,
      activeInstallationIdHash: null,
      deviceBoundAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create two separate valid activation codes for concurrentEntId
    const cCodeStr1 = generateCryptographicActivationCode();
    const cCodeHash1 = hashActivationCode(cCodeStr1);
    const cDoc1 = {
      _id: new ObjectId(),
      codeHash: cCodeHash1,
      codeMasked: "ACT-••••-••••-0001",
      codePrefix: "ACT",
      userId: concurrentUserId,
      userEmail: concurrentUserEmail,
      entitlementId: concurrentEntId,
      productEdition: "german",
      status: "active",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + ACTIVATION_CODE_EXPIRY_MS),
      cleanupAt: new Date(Date.now() + ACTIVATION_CODE_CLEANUP_TTL_MS),
      consumedAt: null,
      consumedByDeviceId: null,
      updatedAt: new Date(),
    };
    await activationCodesCol.insertOne(cDoc1);
    cleanup.codeIds.push(cDoc1._id);

    const cCodeStr2 = generateCryptographicActivationCode();
    const cCodeHash2 = hashActivationCode(cCodeStr2);
    const cDoc2 = {
      _id: new ObjectId(),
      codeHash: cCodeHash2,
      codeMasked: "ACT-••••-••••-0002",
      codePrefix: "ACT",
      userId: concurrentUserId,
      userEmail: concurrentUserEmail,
      entitlementId: concurrentEntId,
      productEdition: "german",
      status: "active",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + ACTIVATION_CODE_EXPIRY_MS),
      cleanupAt: new Date(Date.now() + ACTIVATION_CODE_CLEANUP_TTL_MS),
      consumedAt: null,
      consumedByDeviceId: null,
      updatedAt: new Date(),
    };
    await activationCodesCol.insertOne(cDoc2);
    cleanup.codeIds.push(cDoc2._id);

    const cDevice1 = generateTestDeviceKeypair();
    const cDevice2 = generateTestDeviceKeypair();

    // Fire both activation requests concurrently
    const [resA, resB] = await Promise.all([
      activateDeviceBinding(db, client, {
        code: cCodeStr1,
        devicePublicKeySpki: cDevice1.devicePublicKeySpki,
        deviceLabel: "Concurrent Device A",
        clientVersion: "0.1.0",
      }).catch((e) => ({ success: false, error: e.message })),
      activateDeviceBinding(db, client, {
        code: cCodeStr2,
        devicePublicKeySpki: cDevice2.devicePublicKeySpki,
        deviceLabel: "Concurrent Device B",
        clientVersion: "0.1.0",
      }).catch((e) => ({ success: false, error: e.message })),
    ]);

    const successes = [resA, resB].filter((r) => r.success);
    const failures = [resA, resB].filter((r) => !r.success);

    assert.strictEqual(successes.length, 1, `Exactly one concurrent activation must succeed (got ${successes.length})`);
    assert.strictEqual(failures.length, 1, `Exactly one concurrent activation must fail (got ${failures.length})`);

    if (successes[0].deviceBindingId) {
      cleanup.bindingIds.push(new ObjectId(successes[0].deviceBindingId));
    }

    const concurrentActiveInDb = await deviceBindingsCol.find({ entitlementId: concurrentEntId, status: "active" }).toArray();
    assert.strictEqual(concurrentActiveInDb.length, 1, "Database must strictly have 1 active device after concurrency race");
    console.log("  PASS: Concurrent activations safely resolved: exactly 1 succeeded, 1 rejected. Database 1-device integrity preserved.");

    console.log("\n========================================================");
    console.log("ALL 9 ACTIVATION & REPLACEMENT REGRESSION TESTS PASSED.");
    console.log("========================================================");
  } finally {
    // Clean up test fixtures safely
    if (cleanup.userIds.length > 0) {
      await usersCol.deleteMany({ _id: { $in: cleanup.userIds } });
    }
    if (cleanup.entitlementIds.length > 0) {
      await entitlementsCol.deleteMany({ _id: { $in: cleanup.entitlementIds } });
    }
    if (cleanup.codeIds.length > 0) {
      await activationCodesCol.deleteMany({ _id: { $in: cleanup.codeIds } });
    }
    if (cleanup.bindingIds.length > 0) {
      await deviceBindingsCol.deleteMany({ _id: { $in: cleanup.bindingIds } });
    }
    await client.close();
  }
}

runRegressionSuite().catch((err) => {
  console.error("FATAL: Regression suite failed:", err);
  process.exit(1);
});
