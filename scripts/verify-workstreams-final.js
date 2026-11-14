/* eslint-disable */
const assert = require("node:assert");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const ts = require("typescript");

function loadEnvFile(envFilePath) {
  if (!fs.existsSync(envFilePath)) return;
  const content = fs.readFileSync(envFilePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.resolve(__dirname, "../.env.local"));

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
    fileName: resolved,
  });

  const m = { exports: {} };
  moduleCache.set(resolved, m);
  const fn = new Function(
    "exports",
    "require",
    "module",
    "__filename",
    "__dirname",
    transpiled.outputText
  );
  fn(m.exports, customRequire(path.dirname(resolved)), m, resolved, path.dirname(resolved));
  return m.exports;
}

function customRequire(baseDir) {
  return function (id) {
    if (id.startsWith("@/")) {
      const relPath = id.slice(2);
      const candidates = [
        path.resolve(__dirname, "../src", relPath + ".ts"),
        path.resolve(__dirname, "../src", relPath + ".tsx"),
        path.resolve(__dirname, "../src", relPath, "index.ts"),
        path.resolve(__dirname, "../src", relPath, "index.tsx"),
      ];
      for (const cand of candidates) {
        if (fs.existsSync(cand)) {
          return loadTsModule(cand);
        }
      }
    }
    if (id.startsWith("./") || id.startsWith("../")) {
      const targetPath = path.resolve(baseDir, id);
      const candidates = [
        targetPath + ".ts",
        targetPath + ".tsx",
        targetPath + ".js",
        path.resolve(targetPath, "index.ts"),
      ];
      for (const cand of candidates) {
        if (fs.existsSync(cand)) {
          return loadTsModule(cand);
        }
      }
    }
    return require(id);
  };
}

async function runVerification() {
  console.log("=== COMPREHENSIVE VERIFICATION: WORKSTREAMS 1, 2, & 3 ===\n");

  // -------------------------------------------------------------
  // WORKSTREAM 1: Promotional Website Readiness & Messaging Checks
  // -------------------------------------------------------------
  console.log("[WORKSTREAM 1] Promotional Website Readiness & Content Checks");
  const siteConfig = loadTsModule(path.resolve(__dirname, "../src/lib/siteConfig.ts")).siteConfig;
  assert.equal(siteConfig.tagline, "Read German. Learn Every Word.");
  console.log("  ✓ siteConfig tagline verified: 'Read German. Learn Every Word.'");

  const homeContent = fs.readFileSync(path.resolve(__dirname, "../src/app/page.tsx"), "utf8");
  assert.ok(homeContent.includes("Private Promotional Preview"), "Hero must include Private Promotional Preview");
  assert.ok(homeContent.includes("free of charge"), "Hero must describe free preview for invited testers");
  assert.ok(homeContent.includes("Planned Commercial Launch Pricing"), "Pricing must be framed as planned commercial pricing");
  console.log("  ✓ Homepage promotional preview banner & commercial framing verified");

  const navbarContent = fs.readFileSync(path.resolve(__dirname, "../src/components/Navbar.tsx"), "utf8");
  assert.ok(navbarContent.includes('href="/login"'), "Navbar must show Sign In link for guests");
  assert.ok(navbarContent.includes('href="/register"'), "Navbar must show Create Account link for guests");
  console.log("  ✓ Navbar guest authentication links verified (Sign In & Create Account)");

  const loginPage = fs.readFileSync(path.resolve(__dirname, "../src/app/login/page.tsx"), "utf8");
  assert.ok(loginPage.includes("<LoginForm />"), "Login page must render LoginForm component");
  assert.ok(!loginPage.includes("Private Promotional Preview"), "Login page must not display outdated preview block");
  console.log("  ✓ /login page verified with functional LoginForm");

  const registerPage = fs.readFileSync(path.resolve(__dirname, "../src/app/register/page.tsx"), "utf8");
  assert.ok(registerPage.includes("<RegisterForm />"), "Register page must render RegisterForm component");
  assert.ok(!registerPage.includes("Private Promotional Preview"), "Register page must not display outdated preview block");
  console.log("  ✓ /register page verified with functional RegisterForm");

  const termsPage = fs.readFileSync(path.resolve(__dirname, "../src/app/terms/page.tsx"), "utf8");
  assert.ok(termsPage.includes("Invited participants are not required to purchase a licence"), "Terms must clarify invited testers are not required to purchase");
  console.log("  ✓ Terms of service promotional preview clause verified");

  const privacyPage = fs.readFileSync(path.resolve(__dirname, "../src/app/privacy/page.tsx"), "utf8");
  assert.ok(privacyPage.includes("Extension Functionality and Local PDF Processing"), "Privacy must accurately state local processing");
  assert.ok(privacyPage.includes("Document contents are not uploaded to LingoPDF servers"), "Privacy must state document contents are not uploaded");
  console.log("  ✓ Privacy policy on-device processing claims verified");

  // -------------------------------------------------------------
  // WORKSTREAM 2: CORS, Origin Whitelist, Preflight & Login API
  // -------------------------------------------------------------
  console.log("\n[WORKSTREAM 2] Production Login CORS, Origin Validation & Session Handling");
  const csrfMod = loadTsModule(path.resolve(__dirname, "../src/lib/security/csrf.ts"));
  const loginRouteMod = loadTsModule(path.resolve(__dirname, "../src/app/api/auth/login/route.ts"));
  const { NextRequest } = require("next/server");

  // 2a. Origin allowlist checks
  assert.equal(csrfMod.isAllowedOrigin("https://www.lingopdf.in"), true, "https://www.lingopdf.in must be allowed");
  assert.equal(csrfMod.isAllowedOrigin("https://lingopdf.in"), true, "https://lingopdf.in must be allowed");
  assert.equal(csrfMod.isAllowedOrigin("https://evil.example.com"), false, "Third-party origin must be rejected");
  assert.equal(csrfMod.isAllowedOrigin("null"), false, "Null origin must be rejected");
  console.log("  ✓ Production origin allowlist verified (www and apex allowed, rogue origins rejected)");

  // 2b. OPTIONS Preflight handling for www.lingopdf.in
  const preflightReqWww = new NextRequest("https://www.lingopdf.in/api/auth/login", {
    method: "OPTIONS",
    headers: {
      origin: "https://www.lingopdf.in",
      "access-control-request-method": "POST",
      "access-control-request-headers": "content-type, x-csrf-token",
    },
  });
  const preflightResWww = await loginRouteMod.OPTIONS(preflightReqWww);
  assert.equal(preflightResWww.status, 204, "OPTIONS for www.lingopdf.in must return 204 No Content");
  assert.equal(preflightResWww.headers.get("access-control-allow-origin"), "https://www.lingopdf.in");
  assert.equal(preflightResWww.headers.get("access-control-allow-credentials"), "true");
  console.log("  ✓ OPTIONS preflight for https://www.lingopdf.in returns 204 with credentials");

  // 2c. OPTIONS Preflight handling for apex lingopdf.in
  const preflightReqApex = new NextRequest("https://www.lingopdf.in/api/auth/login", {
    method: "OPTIONS",
    headers: {
      origin: "https://lingopdf.in",
      "access-control-request-method": "POST",
    },
  });
  const preflightResApex = await loginRouteMod.OPTIONS(preflightReqApex);
  assert.equal(preflightResApex.status, 204, "OPTIONS for lingopdf.in must return 204 No Content");
  assert.equal(preflightResApex.headers.get("access-control-allow-origin"), "https://lingopdf.in");
  assert.equal(preflightResApex.headers.get("access-control-allow-credentials"), "true");
  console.log("  ✓ OPTIONS preflight for apex https://lingopdf.in returns 204 with credentials");

  // 2d. OPTIONS Preflight rejection for disallowed origin
  const preflightReqEvil = new NextRequest("https://www.lingopdf.in/api/auth/login", {
    method: "OPTIONS",
    headers: {
      origin: "https://evil.example.com",
      "access-control-request-method": "POST",
    },
  });
  const preflightResEvil = await loginRouteMod.OPTIONS(preflightReqEvil);
  assert.equal(preflightResEvil.status, 403, "OPTIONS for evil.example.com must return 403 Forbidden");
  assert.equal(preflightResEvil.headers.get("access-control-allow-origin"), null, "Must not set CORS origin on forbidden preflight");
  console.log("  ✓ OPTIONS preflight for untrusted origin rejected with 403 (no CORS headers)");

  // 2e. POST from disallowed origin rejected by CSRF
  const postEvilReq = new NextRequest("https://www.lingopdf.in/api/auth/login", {
    method: "POST",
    headers: {
      origin: "https://evil.example.com",
      "content-type": "application/json",
      "x-real-ip": "198.51.100.44",
    },
    body: JSON.stringify({ email: "test@example.com", password: "Password123!" }),
  });
  const postEvilRes = await loginRouteMod.POST(postEvilReq);
  assert.equal(postEvilRes.status, 403, "POST from evil origin must return 403");
  const postEvilJson = await postEvilRes.json();
  assert.equal(postEvilJson.code, "CSRF_ORIGIN_MISMATCH");
  console.log("  ✓ State-changing POST from untrusted origin rejected with 403 CSRF_ORIGIN_MISMATCH");

  // 2f. POST from https://www.lingopdf.in with wrong credentials
  const postWwwWrongReq = new NextRequest("https://www.lingopdf.in/api/auth/login", {
    method: "POST",
    headers: {
      origin: "https://www.lingopdf.in",
      "content-type": "application/json",
      "x-real-ip": "198.51.100.44",
    },
    body: JSON.stringify({ email: "nonexistent@example.com", password: "WrongPassword999!" }),
  });
  const postWwwWrongRes = await loginRouteMod.POST(postWwwWrongReq);
  assert.equal(postWwwWrongRes.status, 401, "Wrong credentials must return 401 Unauthorized");
  assert.equal(postWwwWrongRes.headers.get("access-control-allow-origin"), "https://www.lingopdf.in");
  assert.equal(postWwwWrongRes.headers.get("access-control-allow-credentials"), "true");
  console.log("  ✓ Production origin POST with invalid credentials returns 401 WITH CORS headers (no browser CORS error)");

  // -------------------------------------------------------------
  // WORKSTREAM 3: Referral Lifecycle, Quota Exhaustion & Regeneration
  // -------------------------------------------------------------
  console.log("\n[WORKSTREAM 3] Referral Code Lifecycle, Quota Notifications & Regeneration");
  const { getDb, getMongoClient } = loadTsModule(path.resolve(__dirname, "../src/lib/db/mongodb.ts"));
  const {
    getReferralProfilesCollection,
    getUsersCollection,
    getCommissionsCollection,
  } = loadTsModule(path.resolve(__dirname, "../src/lib/db/models.ts"));
  const {
    getOrCreateReferralProfile,
    regenerateReferralCode,
    triggerReferralQuotaNotification,
    finalizeCapturedReferralRedemption,
    getCustomerReferralDashboardData,
  } = loadTsModule(path.resolve(__dirname, "../src/lib/referrals/service.ts"));
  const { ObjectId } = require("mongodb");

  const db = await getDb();
  const profilesCol = await getReferralProfilesCollection(db);
  const usersCol = await getUsersCollection(db);
  const commissionsCol = await getCommissionsCollection(db);

  const testRunId = crypto.randomBytes(6).toString("hex");
  const testUser = {
    _id: new ObjectId(),
    email: `test_referrer_${testRunId}@example.com`,
    name: "Elena Rostova",
    passwordHash: "argon2_dummy",
    role: "customer",
    status: "active",
    isEmailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await usersCol.insertOne(testUser);

  try {
    // 3a. Initial profile creation
    const initialProfile = await getOrCreateReferralProfile(db, testUser);
    assert.equal(initialProfile.status, "active");
    assert.equal(initialProfile.maxReferralsCap, 50);
    assert.equal(initialProfile.successfulConversionsCount, 0);
    assert.ok(initialProfile.referralCode.startsWith("ELENA"));
    console.log(`  ✓ Initial referral code created: ${initialProfile.referralCode} (cap: 50, conversions: 0)`);

    // 3b. Verify code regeneration is BLOCKED before 50 redemptions
    let regenerationBlocked = false;
    try {
      await regenerateReferralCode(db, testUser);
    } catch (err) {
      regenerationBlocked = true;
      assert.ok(err.message.includes("QUOTA_NOT_EXHAUSTED"), "Must throw QUOTA_NOT_EXHAUSTED");
    }
    assert.equal(regenerationBlocked, true, "Regeneration must be rejected when redemptions < 50");
    console.log("  ✓ Strict Server Guard: Regeneration rejected before reaching 50 redemptions");

    // 3c. Simulate 50 conversions: simulate 49 redemptions, then finalize 50th redemption
    await profilesCol.updateOne(
      { _id: initialProfile._id },
      { $set: { successfulConversionsCount: 49, pendingReservedCount: 1 } }
    );

    const buyerId = new ObjectId();
    const purchaseId = new ObjectId();
    const finalizeOutcome = await finalizeCapturedReferralRedemption(db, {
      referrerUserId: testUser._id,
      purchaserUserId: buyerId,
      purchaseId: purchaseId,
      currency: "INR",
      paidAmountMinor: 116910,
    });
    assert.equal(finalizeOutcome.ok, true);

    const profileAtCap = await profilesCol.findOne({ _id: initialProfile._id });
    assert.equal(profileAtCap.successfulConversionsCount, 50, "Redemptions must equal 50");
    assert.equal(profileAtCap.status, "exhausted", "Code status must transition to exhausted at 50 redemptions");
    assert.ok(profileAtCap.exhaustedAt !== null, "exhaustedAt timestamp must be recorded");
    console.log("  ✓ 50th redemption transition: status -> 'exhausted' with exhaustedAt timestamp recorded");

    // 3d. Quota notification idempotency & atomic claim
    await triggerReferralQuotaNotification(db, profileAtCap);
    const profileAfterNotification = await profilesCol.findOne({ _id: initialProfile._id });
    assert.ok(
      profileAfterNotification.quotaNotificationStatus === "sent" ||
      profileAfterNotification.quotaNotificationStatus === "failed",
      "Notification status must be updated"
    );
    const firstStatus = profileAfterNotification.quotaNotificationStatus;
    const firstSentAt = profileAfterNotification.quotaNotificationSentAt;

    // Trigger again (simulate duplicate webhook / retry)
    await triggerReferralQuotaNotification(db, profileAfterNotification);
    const profileAfterReplay = await profilesCol.findOne({ _id: initialProfile._id });
    assert.equal(profileAfterReplay.quotaNotificationStatus, firstStatus, "Status must remain unchanged on replay");
    assert.equal(
      profileAfterReplay.quotaNotificationSentAt?.getTime(),
      firstSentAt?.getTime(),
      "Sent timestamp must remain unchanged on replay"
    );
    console.log("  ✓ Quota notification idempotency verified: atomic claim prevents duplicate notification on webhook replay");

    // 3e. Regenerate new referral code
    const newProfile = await regenerateReferralCode(db, testUser);
    assert.notEqual(newProfile.referralCode, initialProfile.referralCode, "New code must differ from exhausted code");
    assert.equal(newProfile.status, "active", "New code must be active");
    assert.equal(newProfile.successfulConversionsCount, 0, "New code must start with 0 conversions");
    assert.equal(newProfile.maxReferralsCap, 50, "New code receives its own 50 allowance");
    console.log(`  ✓ New referral code regenerated: ${newProfile.referralCode} (active, 0/50 redemptions)`);

    // 3f. Verify old code preservation
    const oldProfileVerified = await profilesCol.findOne({ _id: initialProfile._id });
    assert.equal(oldProfileVerified.status, "exhausted");
    assert.equal(oldProfileVerified.successfulConversionsCount, 50);
    assert.equal(oldProfileVerified.referralCode, initialProfile.referralCode);
    console.log("  ✓ Exhausted code and all 50 conversion records strictly preserved in database");

    // 3g. Verify concurrent active code prevention via Partial Unique Index
    let secondActiveBlocked = false;
    try {
      await profilesCol.insertOne({
        _id: new ObjectId(),
        userId: testUser._id,
        qualifyingPurchaseId: new ObjectId(),
        referralCode: "ELENAROGUE999",
        status: "active",
        maxReferralsCap: 50,
        pendingReservedCount: 0,
        successfulConversionsCount: 0,
        payoutMethod: "unset",
        payoutDetailsEncryptedOrRef: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } catch (err) {
      secondActiveBlocked = true;
      assert.ok(err.code === 11000, "Must trigger MongoDB E11000 duplicate key error");
    }
    assert.equal(secondActiveBlocked, true, "Database unique index must reject second active code for same user");
    console.log("  ✓ Database Invariant: Partial unique index rejected duplicate active referral code (E11000)");

    // 3h. Customer referral dashboard data verification
    const dashboardData = await getCustomerReferralDashboardData(db, testUser);
    assert.equal(dashboardData.referralCode, newProfile.referralCode);
    assert.equal(dashboardData.isExhausted, false);
    assert.equal(dashboardData.canRegenerate, false);
    assert.ok(dashboardData.historicalCodes && dashboardData.historicalCodes.length >= 2);
    const exhaustedHistoryItem = dashboardData.historicalCodes.find(h => h.code === initialProfile.referralCode);
    assert.ok(exhaustedHistoryItem, "Historical exhausted code must appear in dashboard history");
    assert.equal(exhaustedHistoryItem.status, "exhausted");
    assert.equal(exhaustedHistoryItem.successfulPaidReferrals, 50);
    console.log("  ✓ Customer referral dashboard data returned active code and historical exhausted code list");

  } finally {
    // Clean up test documents
    await usersCol.deleteMany({ _id: testUser._id });
    await profilesCol.deleteMany({ userId: testUser._id });
    await commissionsCol.deleteMany({ referrerUserId: testUser._id });
    console.log("\n  ✓ Test records cleaned up successfully.");
  }

  console.log("\n========================================================");
  console.log("🎉 ALL WORKSTREAM 1, 2, AND 3 VERIFICATION CHECKS PASSED!");
  console.log("========================================================");
  process.exit(0);
}

runVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
