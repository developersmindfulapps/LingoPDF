/* eslint-disable */
const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const assert = require("assert/strict");
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
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;

  const m = { exports: {} };
  moduleCache.set(resolved, m);

  const customRequire = (specifier) => {
    if (specifier.startsWith("./") || specifier.startsWith("../")) {
      const dir = path.dirname(resolved);
      let targetPath = path.resolve(dir, specifier);
      if (!fs.existsSync(targetPath) && fs.existsSync(targetPath + ".ts")) {
        targetPath += ".ts";
      } else if (!fs.existsSync(targetPath) && fs.existsSync(targetPath + ".tsx")) {
        targetPath += ".tsx";
      } else if (!fs.existsSync(targetPath) && fs.existsSync(targetPath + ".js")) {
        targetPath += ".js";
      }
      return loadTsModule(targetPath);
    }
    if (specifier.startsWith("@/")) {
      let targetPath = path.resolve(__dirname, "..", "src", specifier.slice(2));
      if (!fs.existsSync(targetPath) && fs.existsSync(targetPath + ".ts")) {
        targetPath += ".ts";
      } else if (!fs.existsSync(targetPath) && fs.existsSync(targetPath + ".tsx")) {
        targetPath += ".tsx";
      } else if (!fs.existsSync(targetPath) && fs.existsSync(targetPath + ".js")) {
        targetPath += ".js";
      }
      return loadTsModule(targetPath);
    }
    return require(specifier);
  };

  const fn = new Function("require", "exports", "module", "__dirname", "__filename", transpiled);
  fn(customRequire, m.exports, m, path.dirname(resolved), resolved);
  return m.exports;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

async function runAllPromoTests() {
  console.log("=== Running 100% Single-Use Complimentary Licence Code Test Suite ===");

  loadEnvFile(path.resolve(__dirname, "../.env.local"));
  process.env.RATE_LIMIT_HMAC_SECRET =
    process.env.RATE_LIMIT_HMAC_SECRET ||
    "test-hmac-secret-with-sufficient-entropy-32chars";
  process.env.NEXT_PUBLIC_APP_URL = "https://www.lingopdf.in";

  const { getDb, getMongoClient } = loadTsModule(path.resolve(__dirname, "../src/lib/db/mongodb.ts"));
  const promoService = loadTsModule(path.resolve(__dirname, "../src/lib/promoCodes/service.ts"));
  const {
    generateCryptographicPromoCode,
    normalizePromoCode,
    hashPromoCode,
    maskPromoCode,
    createPromotionalCode,
    disablePromotionalCode,
    listPromotionalCodes,
    getPromotionalCodeStats,
    redeemPromotionalCode,
  } = promoService;

  const db = await getDb();
  const client = await getMongoClient();

  const cleanup = {
    promoCodeIds: [],
    entitlementIds: [],
    userIds: [],
    auditIds: [],
  };

  try {
    // -------------------------------------------------------------------------
    // 1. Code Generation & Cryptographic Entropy
    // -------------------------------------------------------------------------
    console.log("\n[Test 1] Cryptographic Code Generation & Entropy");
    const sampleCodes = new Set();
    const CODE_REGEX = /^LINGO-GIFT-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/;

    for (let i = 0; i < 100; i++) {
      const code = generateCryptographicPromoCode();
      assert.ok(CODE_REGEX.test(code), `Code "${code}" must match LINGO-GIFT-XXXX-XXXX charset format`);
      const randomPart = code.slice("LINGO-GIFT-".length);
      assert.ok(!randomPart.includes("0"), "Random part must not contain ambiguous character '0'");
      assert.ok(!randomPart.includes("O"), "Random part must not contain ambiguous character 'O'");
      assert.ok(!randomPart.includes("1"), "Random part must not contain ambiguous character '1'");
      assert.ok(!randomPart.includes("I"), "Random part must not contain ambiguous character 'I'");
      sampleCodes.add(code);
    }
    assert.equal(sampleCodes.size, 100, "100 generated codes must all be distinct");

    // Normalization & Hashing
    assert.equal(normalizePromoCode("  lingo-gift-abcd-efgh  "), "LINGO-GIFT-ABCD-EFGH");
    assert.equal(normalizePromoCode("lingo gift abcd efgh"), "LINGO-GIFT-ABCD-EFGH");
    const hash1 = hashPromoCode("LINGO-GIFT-ABCD-EFGH");
    const hash2 = hashPromoCode("  lingo gift abcd efgh ");
    assert.equal(hash1, hash2, "Normalized code hashes must be identical");
    assert.equal(hash1.length, 64, "Code hash must be 64-char SHA-256");

    // Masking
    assert.equal(maskPromoCode("LINGO-GIFT-ABCD-EFGH"), "LINGO-GIFT-••••-EFGH");
    console.log("✓ Cryptographic generator produces unique LINGO-GIFT-XXXX-XXXX codes with 40-bit entropy and unambiguous characters.");

    // -------------------------------------------------------------------------
    // 2. Invariant Enforcement: Exactly 100% Discount and German Edition
    // -------------------------------------------------------------------------
    console.log("\n[Test 2] Business Invariant Enforcement (Strictly 100% Discount)");
    const mockAdmin = {
      userId: new ObjectId(),
      email: "admin@lingopdf.in",
      role: "admin",
      sessionId: new ObjectId(),
    };

    // Attempting to create code with discount != 100 must throw
    await assert.rejects(
      async () => {
        await createPromotionalCode(db, { discountPercent: 50 }, mockAdmin);
      },
      /exactly 100% discount/,
      "Creating code with 50% discount must be rejected"
    );

    await assert.rejects(
      async () => {
        await createPromotionalCode(db, { discountPercent: 99 }, mockAdmin);
      },
      /exactly 100% discount/,
      "Creating code with 99% discount must be rejected"
    );

    await assert.rejects(
      async () => {
        await createPromotionalCode(db, { productEdition: "french" }, mockAdmin);
      },
      /restricted to the German edition/,
      "Creating code for non-German edition must be rejected"
    );
    console.log("✓ Invariant enforcement verified: discount locked strictly to 100%, edition locked to German.");

    // -------------------------------------------------------------------------
    // 3. Admin Code Creation & One-Time Secret Reveal
    // -------------------------------------------------------------------------
    console.log("\n[Test 3] Admin Creation, Masking & Audit Logging");
    const created1 = await createPromotionalCode(
      db,
      {
        label: "Goethe-Institut Reviewer Promo",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      },
      mockAdmin
    );
    cleanup.promoCodeIds.push(created1.promoCode._id);

    assert.ok(created1.fullCode, "fullCode must be returned upon creation");
    assert.ok(created1.fullCode.startsWith("LINGO-GIFT-"));
    assert.equal(created1.promoCode.discountPercent, 100);
    assert.equal(created1.promoCode.productEdition, "german");
    assert.equal(created1.promoCode.maxRedemptions, 1);
    assert.equal(created1.promoCode.status, "active");
    assert.equal(created1.promoCode.label, "Goethe-Institut Reviewer Promo");
    assert.ok(created1.promoCode.codeMasked.includes("••••"));

    // Verify plaintext code is NOT stored in the database
    const dbDoc1 = await db.collection("promo_codes").findOne({ _id: created1.promoCode._id });
    assert.equal(dbDoc1.fullCode, undefined, "Plaintext fullCode must never exist on database document");
    assert.equal(dbDoc1.code, undefined, "Plaintext code must never exist on database document");
    assert.ok(dbDoc1.codeHash, "Document must store codeHash");

    // Verify Audit Log
    const auditLog = await db.collection("admin_audit_logs").findOne({
      targetId: created1.promoCode._id.toString(),
      action: "promo_code.create",
    });
    assert.ok(auditLog, "Admin audit log must be recorded for promo_code.create");
    assert.equal(auditLog.outcome, "success");
    assert.equal(auditLog.metadata.discountPercent, 100);
    cleanup.auditIds.push(auditLog._id);
    console.log("✓ Promotional code created: stored as secure hash, masked display safe, audit log verified.");

    // -------------------------------------------------------------------------
    // 4. Valid Customer 100% Redemption & Entitlement Grant
    // -------------------------------------------------------------------------
    console.log("\n[Test 4] Customer Redemption & Full Edition Entitlement Grant");
    const customerUser = {
      _id: new ObjectId(),
      email: "promotional-recipient@example.com",
      status: "active",
      role: "customer",
    };
    await db.collection("users").insertOne(customerUser);
    cleanup.userIds.push(customerUser._id);

    // Initial check: customer has no entitlement
    const initialEnt = await db.collection("entitlements").findOne({ userId: customerUser._id });
    assert.equal(initialEnt, null);

    // Redeem valid code
    const redeemRes = await redeemPromotionalCode(db, client, {
      code: created1.fullCode,
      user: customerUser,
    });

    assert.equal(redeemRes.success, true);
    assert.ok(redeemRes.entitlementId);
    assert.ok(redeemRes.message.includes("German → English LingoPDF licence has been successfully granted"));
    cleanup.entitlementIds.push(new ObjectId(redeemRes.entitlementId));

    // Verify database state: promo code is marked redeemed
    const redeemedCodeDoc = await db.collection("promo_codes").findOne({ _id: created1.promoCode._id });
    assert.equal(redeemedCodeDoc.status, "redeemed");
    assert.equal(redeemedCodeDoc.redeemedBy.toString(), customerUser._id.toString());
    assert.equal(redeemedCodeDoc.redeemedByEmail, customerUser.email);
    assert.ok(redeemedCodeDoc.redeemedAt instanceof Date);
    assert.equal(redeemedCodeDoc.entitlementId.toString(), redeemRes.entitlementId);

    // Verify database state: entitlement document created correctly
    const grantedEnt = await db.collection("entitlements").findOne({ _id: new ObjectId(redeemRes.entitlementId) });
    assert.ok(grantedEnt);
    assert.equal(grantedEnt.userId.toString(), customerUser._id.toString());
    assert.equal(grantedEnt.productSlug, "german");
    assert.equal(grantedEnt.status, "active");
    assert.equal(grantedEnt.maxActiveDevices, 1);
    assert.equal(grantedEnt.purchaseId, null, "Complimentary entitlement must have null purchaseId");
    assert.equal(grantedEnt.source, "complimentary_promo_code");
    assert.equal(grantedEnt.promoCodeId.toString(), created1.promoCode._id.toString());

    // Verify financial boundaries: NO fake purchase record, NO referral commission
    const fakePurchase = await db.collection("purchases").findOne({ userId: customerUser._id });
    assert.equal(fakePurchase, null, "Complimentary redemption must never create a fake purchase record");
    const fakeCommission = await db.collection("commissions").findOne({ purchaserUserId: customerUser._id });
    assert.equal(fakeCommission, null, "Complimentary redemption must never create referral commissions");

    console.log("✓ Customer redemption succeeded: full German entitlement issued, 1-device policy enforced, 0 fake purchases or commissions created.");

    // -------------------------------------------------------------------------
    // 5. Single-Use Rejection (Attempting to Reuse a Redeemed Code)
    // -------------------------------------------------------------------------
    console.log("\n[Test 5] Rejection of Already Redeemed Code");
    const anotherUser = {
      _id: new ObjectId(),
      email: "another-recipient@example.com",
      status: "active",
      role: "customer",
    };
    await db.collection("users").insertOne(anotherUser);
    cleanup.userIds.push(anotherUser._id);

    const reuseRes = await redeemPromotionalCode(db, client, {
      code: created1.fullCode, // Already redeemed!
      user: anotherUser,
    });
    assert.equal(reuseRes.success, false);
    assert.equal(reuseRes.code, "ALREADY_REDEEMED");
    assert.ok(reuseRes.message.includes("already been redeemed"));

    // Verify no new entitlement created for anotherUser
    const unearnedEnt = await db.collection("entitlements").findOne({ userId: anotherUser._id });
    assert.equal(unearnedEnt, null);
    console.log("✓ Re-redemption rejected: already redeemed codes cannot be reused.");

    // -------------------------------------------------------------------------
    // 6. Existing Active Entitlement Handling
    // -------------------------------------------------------------------------
    console.log("\n[Test 6] Existing Entitlement Guard (One Licence per Edition)");
    // CustomerUser already holds an active German licence
    const created2 = await createPromotionalCode(db, { label: "Second code" }, mockAdmin);
    cleanup.promoCodeIds.push(created2.promoCode._id);

    const duplicateRes = await redeemPromotionalCode(db, client, {
      code: created2.fullCode,
      user: customerUser, // Already has German licence
    });
    assert.equal(duplicateRes.success, false);
    assert.equal(duplicateRes.code, "ALREADY_ENTITLED");
    assert.ok(duplicateRes.message.includes("already has an active German → English edition licence"));

    // Verify the second code was NOT consumed!
    const unconsumedCode = await db.collection("promo_codes").findOne({ _id: created2.promoCode._id });
    assert.equal(unconsumedCode.status, "active", "Failed redemption must NOT consume the promotional code");
    console.log("✓ Existing licence guard verified: duplicate active licence prevented; code remains active and unconsumed.");

    // -------------------------------------------------------------------------
    // 7. Expired & Disabled Code Rejections
    // -------------------------------------------------------------------------
    console.log("\n[Test 7] Expired and Disabled Code Rejections");
    // 7a. Expired code
    const expiredCode = await createPromotionalCode(
      db,
      { label: "Expired promo", expiresAt: new Date(Date.now() + 1000) },
      mockAdmin
    );
    cleanup.promoCodeIds.push(expiredCode.promoCode._id);
    // Manually backdate expiration date
    await db.collection("promo_codes").updateOne(
      { _id: expiredCode.promoCode._id },
      { $set: { expiresAt: new Date(Date.now() - 3600000) } }
    );

    const expiredRes = await redeemPromotionalCode(db, client, {
      code: expiredCode.fullCode,
      user: anotherUser,
    });
    assert.equal(expiredRes.success, false);
    assert.equal(expiredRes.code, "EXPIRED_CODE");
    assert.ok(expiredRes.message.includes("expired"));

    // 7b. Disabled code
    const disabledCode = await createPromotionalCode(
      db,
      { label: "To be disabled" },
      mockAdmin
    );
    cleanup.promoCodeIds.push(disabledCode.promoCode._id);

    await disablePromotionalCode(db, disabledCode.promoCode._id, "Revoked by admin", mockAdmin);
    const disabledDoc = await db.collection("promo_codes").findOne({ _id: disabledCode.promoCode._id });
    assert.equal(disabledDoc.status, "disabled");
    assert.equal(disabledDoc.disableReason, "Revoked by admin");

    const disabledRes = await redeemPromotionalCode(db, client, {
      code: disabledCode.fullCode,
      user: anotherUser,
    });
    assert.equal(disabledRes.success, false);
    assert.equal(disabledRes.code, "DISABLED_CODE");
    assert.ok(disabledRes.message.includes("disabled by an administrator"));

    // 7c. Invalid code string
    const invalidRes = await redeemPromotionalCode(db, client, {
      code: "LINGO-GIFT-FAKE-CODE",
      user: anotherUser,
    });
    assert.equal(invalidRes.success, false);
    assert.equal(invalidRes.code, "INVALID_CODE");
    console.log("✓ Expired, disabled, and non-existent codes strictly rejected.");

    // -------------------------------------------------------------------------
    // 8. Concurrency & Race Condition Defense (Two Simultaneous Redemptions)
    // -------------------------------------------------------------------------
    console.log("\n[Test 8] Concurrency: Two Simultaneous Redemption Attempts");
    const concurrentCode = await createPromotionalCode(db, { label: "Race condition test" }, mockAdmin);
    cleanup.promoCodeIds.push(concurrentCode.promoCode._id);

    const userA = { _id: new ObjectId(), email: "user-a@example.com", status: "active", role: "customer" };
    const userB = { _id: new ObjectId(), email: "user-b@example.com", status: "active", role: "customer" };
    await db.collection("users").insertMany([userA, userB]);
    cleanup.userIds.push(userA._id, userB._id);

    // Launch both redemption requests simultaneously
    const [resA, resB] = await Promise.all([
      redeemPromotionalCode(db, client, { code: concurrentCode.fullCode, user: userA }),
      redeemPromotionalCode(db, client, { code: concurrentCode.fullCode, user: userB }),
    ]);

    const successes = [resA, resB].filter((r) => r.success);
    const failures = [resA, resB].filter((r) => !r.success);

    assert.equal(successes.length, 1, "Exactly one concurrent redemption attempt must succeed");
    assert.equal(failures.length, 1, "The second concurrent redemption attempt must be rejected");
    assert.equal(failures[0].code, "ALREADY_REDEEMED");
    if (successes[0].entitlementId) {
      cleanup.entitlementIds.push(new ObjectId(successes[0].entitlementId));
    }

    // Verify only 1 entitlement was granted in the collection
    const grantedCount = await db.collection("entitlements").countDocuments({ promoCodeId: concurrentCode.promoCode._id });
    assert.equal(grantedCount, 1, "Database must contain exactly 1 entitlement for the promo code");
    console.log("✓ Concurrency defense verified: atomic CAS guarantees exactly 1 redemption under concurrent load.");

    // -------------------------------------------------------------------------
    // 9. Admin List & Stats Aggregation
    // -------------------------------------------------------------------------
    console.log("\n[Test 9] Admin List & Statistics Aggregation");
    const listAll = await listPromotionalCodes(db, { limit: 50 });
    assert.ok(listAll.total >= 4);
    assert.ok(listAll.items.length >= 4);

    const listActive = await listPromotionalCodes(db, { status: "active" });
    assert.ok(listActive.items.every((i) => i.status === "active"));

    const stats = await getPromotionalCodeStats(db);
    assert.ok(stats.total >= 4);
    assert.ok(stats.redeemed >= 2);
    assert.ok(stats.disabled >= 1);
    console.log(`✓ Admin queries & stats verified (Total: ${stats.total}, Active: ${stats.active}, Redeemed: ${stats.redeemed}, Disabled: ${stats.disabled}).`);

    // -------------------------------------------------------------------------
    // 10. Route-Level Security: CSRF & Rate Limiting Verification
    // -------------------------------------------------------------------------
    console.log("\n[Test 10] Route-Level CSRF, Rate Limiting & Account Security");
    const rateLimitMod = loadTsModule(path.resolve(__dirname, "../src/lib/auth/rateLimit.ts"));
    const { RATE_LIMIT_POLICIES, setTestRateLimitStore, createInMemoryRateLimitStore } = rateLimitMod;
    assert.ok(RATE_LIMIT_POLICIES.promoCodeRedemption, "promoCodeRedemption rate limit policy must exist");
    assert.equal(RATE_LIMIT_POLICIES.promoCodeRedemption.ipLimit, 10);
    assert.equal(RATE_LIMIT_POLICIES.promoCodeRedemption.emailLimit, 5);
    assert.equal(RATE_LIMIT_POLICIES.promoCodeRedemption.windowSeconds, 900);

    const { NextRequest } = require("next/server");
    const redeemRoute = loadTsModule(path.resolve(__dirname, "../src/app/api/promo-codes/redeem/route.ts"));

    // 10a. CSRF rejection
    const crossOriginReq = new NextRequest("https://www.lingopdf.in/api/promo-codes/redeem", {
      method: "POST",
      headers: {
        origin: "https://evil.example.com",
        "content-type": "application/json",
      },
      body: JSON.stringify({ code: "LINGO-GIFT-TEST-1234" }),
    });
    const crossOriginRes = await redeemRoute.POST(crossOriginReq);
    assert.equal(crossOriginRes.status, 403, "Cross-origin request must be rejected with HTTP 403");

    // 10b. Unauthenticated customer rejection
    const unauthReq = new NextRequest("https://www.lingopdf.in/api/promo-codes/redeem", {
      method: "POST",
      headers: {
        origin: "https://www.lingopdf.in",
        "content-type": "application/json",
        "x-real-ip": "198.51.100.44",
      },
      body: JSON.stringify({ code: "LINGO-GIFT-TEST-1234" }),
    });
    const unauthRes = await redeemRoute.POST(unauthReq);
    assert.equal(unauthRes.status, 401, "Unauthenticated request must be rejected with HTTP 401");

    console.log("✓ Route security verified: CSRF origin checks and session authentication strictly enforced.");

  } finally {
    // Clean up test documents created during testing
    console.log("\nCleaning up test documents from database...");
    if (cleanup.promoCodeIds.length > 0) {
      await db.collection("promo_codes").deleteMany({ _id: { $in: cleanup.promoCodeIds } });
      await db.collection("admin_audit_logs").deleteMany({
        targetId: { $in: cleanup.promoCodeIds.map((id) => id.toString()) },
      });
    }
    if (cleanup.entitlementIds.length > 0) {
      await db.collection("entitlements").deleteMany({ _id: { $in: cleanup.entitlementIds } });
    }
    if (cleanup.userIds.length > 0) {
      await db.collection("users").deleteMany({ _id: { $in: cleanup.userIds } });
    }
    if (cleanup.auditIds.length > 0) {
      await db.collection("admin_audit_logs").deleteMany({ _id: { $in: cleanup.auditIds } });
    }
    await client.close().catch(() => {});
    console.log("✓ Cleanup completed.");
  }

  console.log("\n🎉 ALL 10 PROMOTIONAL CODE TESTS PASSED SUCCESSFULLY!\n");
}

runAllPromoTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
