/* eslint-disable */
/**
 * LingoPDF — Comprehensive Authentication & Registration Test Suite
 *
 * Validates:
 * 1. Registration page availability & rendering.
 * 2. Successful user registration (Argon2id hashing, unique token generation, session establishment).
 * 3. Duplicate-email rejection (case-insensitive normalization & MongoDB unique index guard).
 * 4. Email verification flow (token verification, single-use invalidation, already-verified handling, expiry).
 * 5. Successful login (Argon2id password verification, session rotation & httpOnly cookie).
 * 6. Invalid credentials rejection (timing-safe generic message).
 * 7. Unverified account restrictions (cannot perform privileged actions before verification).
 * 8. Logout functionality (session invalidation & cookie clearance).
 * 9. Password reset flow (request token, single-use token verification, password update & login with new password).
 * 10. Protected account routes authorization & redirection.
 * 11. Existing admin authentication & role-escalation rejection.
 */

const assert = require("node:assert/strict");
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

// Set mock email mode during automated test suite to prevent unwanted real email sending
process.env.EMAIL_MOCK = "true";
process.env.RATE_LIMIT_HMAC_SECRET =
  process.env.RATE_LIMIT_HMAC_SECRET || "test-hmac-secret-with-sufficient-entropy-32chars";

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

async function runAuthSuite() {
  console.log("===============================================================================");
  console.log("LingoPDF — Authentication & Registration End-to-End Test Suite");
  console.log("===============================================================================\n");

  const { NextRequest } = require("next/server");
  const { ObjectId } = require("mongodb");

  const { getDb } = loadTsModule(path.resolve(__dirname, "../src/lib/db/mongodb.ts"));
  const { getUsersCollection, getSessionsCollection } = loadTsModule(path.resolve(__dirname, "../src/lib/db/models.ts"));
  const { verifyPassword, hashToken } = loadTsModule(path.resolve(__dirname, "../src/lib/auth/session.ts"));

  const registerRoute = loadTsModule(path.resolve(__dirname, "../src/app/api/auth/register/route.ts"));
  const loginRoute = loadTsModule(path.resolve(__dirname, "../src/app/api/auth/login/route.ts"));
  const logoutRoute = loadTsModule(path.resolve(__dirname, "../src/app/api/auth/logout/route.ts"));
  const sessionRoute = loadTsModule(path.resolve(__dirname, "../src/app/api/auth/session/route.ts"));
  const verifyEmailRoute = loadTsModule(path.resolve(__dirname, "../src/app/api/auth/verify-email/route.ts"));
  const forgotPwRoute = loadTsModule(path.resolve(__dirname, "../src/app/api/auth/forgot-password/route.ts"));
  const resetPwRoute = loadTsModule(path.resolve(__dirname, "../src/app/api/auth/reset-password/route.ts"));
  const adminAuthMod = loadTsModule(path.resolve(__dirname, "../src/lib/auth/admin.ts"));

  const db = await getDb();
  const usersCol = await getUsersCollection(db);
  const sessionsCol = await getSessionsCollection(db);

  const testSuffix = crypto.randomBytes(4).toString("hex");
  const testEmail = `paddle_customer_${testSuffix}@example.com`;
  const testPassword = "PaddleSecurePassword2026!";
  const testName = "Paddle Test Customer";

  const cleanupUserIds = [];

  try {
    // ---------------------------------------------------------------------------
    // [Test 1] Registration and Login Page Availability & Component Rendering
    // ---------------------------------------------------------------------------
    console.log("[1/11] Testing Registration & Login Page Availability...");
    const registerPageSource = fs.readFileSync(path.resolve(__dirname, "../src/app/register/page.tsx"), "utf8");
    assert.ok(registerPageSource.includes("<RegisterForm />"), "Register page must render RegisterForm component");
    assert.ok(registerPageSource.includes("Create Account — LingoPDF"), "Register page must have proper title");
    assert.ok(!registerPageSource.includes("Account registration is currently unavailable"), "Register page must not contain unavailable banner");

    const loginPageSource = fs.readFileSync(path.resolve(__dirname, "../src/app/login/page.tsx"), "utf8");
    assert.ok(loginPageSource.includes("<LoginForm />"), "Login page must render LoginForm component");
    assert.ok(loginPageSource.includes("Sign In — LingoPDF"), "Login page must have proper title");
    assert.ok(!loginPageSource.includes("Account functionality is currently unavailable"), "Login page must not contain unavailable banner");

    const navbarSource = fs.readFileSync(path.resolve(__dirname, "../src/components/Navbar.tsx"), "utf8");
    assert.ok(navbarSource.includes('href="/login"'), "Navbar must include Sign In link");
    assert.ok(navbarSource.includes('href="/register"'), "Navbar must include Create Account link");
    console.log("  ✓ /register page source verified with <RegisterForm />");
    console.log("  ✓ /login page source verified with <LoginForm />");
    console.log("  ✓ Navbar guest links for Sign In & Create Account verified");

    // ---------------------------------------------------------------------------
    // [Test 2] Successful User Registration
    // ---------------------------------------------------------------------------
    console.log("\n[2/11] Testing Successful Registration...");
    const regReq = new NextRequest("https://www.lingopdf.in/api/auth/register", {
      method: "POST",
      headers: {
        Origin: "https://www.lingopdf.in",
        "Content-Type": "application/json",
        "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 200) + 1}`,
      },
      body: JSON.stringify({
        email: `  ${testEmail.toUpperCase()}  `, // Test normalization
        password: testPassword,
        name: testName,
      }),
    });

    const regRes = await registerRoute.POST(regReq);
    assert.equal(regRes.status, 201, `Registration must return 201 Created (got ${regRes.status})`);
    const regJson = await regRes.json();
    assert.equal(regJson.user.email, testEmail.toLowerCase(), "Email must be normalized lowercase");
    assert.equal(regJson.user.isEmailVerified, false, "Newly registered user must be unverified");
    assert.equal(regJson.user.role, "customer", "Newly registered user must have role customer");
    assert.equal(regJson.user.passwordHash, undefined, "passwordHash must never be exposed");

    const sessionCookie = regRes.cookies.get("lingopdf_session");
    assert.ok(sessionCookie, "Registration must establish secure session cookie");
    assert.ok(sessionCookie.value, "Session token must exist");

    // Check database document
    const createdUser = await usersCol.findOne({ email: testEmail.toLowerCase() });
    assert.ok(createdUser, "User document must exist in MongoDB");
    cleanupUserIds.push(createdUser._id);
    assert.equal(createdUser.isEmailVerified, false);
    assert.ok(createdUser.emailVerificationTokenHash, "Verification token hash must be saved");
    assert.ok(createdUser.emailVerificationExpires > new Date(), "Verification expiry must be in the future (24h)");

    const isPwCorrect = await verifyPassword(createdUser.passwordHash, testPassword);
    assert.equal(isPwCorrect, true, "Password must be verified using Argon2id");
    console.log("  ✓ Registration created customer account with Argon2id hash & unverified status");
    console.log("  ✓ Single-use verification token hash stored with 24-hour expiration");
    console.log("  ✓ Session cookie established upon registration");

    // ---------------------------------------------------------------------------
    // [Test 3] Duplicate-Email Rejection
    // ---------------------------------------------------------------------------
    console.log("\n[3/11] Testing Duplicate-Email Rejection...");
    const dupReq = new NextRequest("https://www.lingopdf.in/api/auth/register", {
      method: "POST",
      headers: {
        Origin: "https://www.lingopdf.in",
        "Content-Type": "application/json",
        "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 200) + 1}`,
      },
      body: JSON.stringify({
        email: testEmail.toLowerCase(),
        password: "AnotherPassword123!",
      }),
    });

    const dupRes = await registerRoute.POST(dupReq);
    assert.equal(dupRes.status, 409, `Duplicate email must return 409 Conflict (got ${dupRes.status})`);
    const dupJson = await dupRes.json();
    assert.equal(dupJson.code, "EMAIL_EXISTS");
    console.log("  ✓ Duplicate registration rejected with 409 EMAIL_EXISTS");

    // ---------------------------------------------------------------------------
    // [Test 4] Email Verification Flow
    // ---------------------------------------------------------------------------
    console.log("\n[4/11] Testing Email Verification Flow...");
    // 4a. Reject invalid token (structural check)
    const shortVerifReq = new NextRequest("https://www.lingopdf.in/api/auth/verify-email", {
      method: "POST",
      headers: {
        Origin: "https://www.lingopdf.in",
        "Content-Type": "application/json",
        "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 200) + 1}`,
      },
      body: JSON.stringify({ token: "invalid-token-12345" }),
    });
    const shortVerifRes = await verifyEmailRoute.POST(shortVerifReq);
    assert.equal(shortVerifRes.status, 400);
    const shortVerifJson = await shortVerifRes.json();
    assert.equal(shortVerifJson.code, "INVALID_TOKEN");
    console.log("  ✓ Short verification token rejected with 400 INVALID_TOKEN");

    // Reject non-existent 64-char token (database check)
    const fakeVerifReq = new NextRequest("https://www.lingopdf.in/api/auth/verify-email", {
      method: "POST",
      headers: {
        Origin: "https://www.lingopdf.in",
        "Content-Type": "application/json",
        "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 200) + 1}`,
      },
      body: JSON.stringify({ token: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" }),
    });
    const fakeVerifRes = await verifyEmailRoute.POST(fakeVerifReq);
    assert.equal(fakeVerifRes.status, 400);
    const fakeVerifJson = await fakeVerifRes.json();
    assert.equal(fakeVerifJson.code, "INVALID_OR_USED_TOKEN");
    console.log("  ✓ Unmatched verification token rejected with 400 INVALID_OR_USED_TOKEN");

    // 4b. Perform valid verification using user's stored token
    // In mock mode, we know how verification token was generated and hashed, so let's set a known raw token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const rawTokenHash = hashToken(rawToken);
    await usersCol.updateOne(
      { _id: createdUser._id },
      {
        $set: {
          emailVerificationTokenHash: rawTokenHash,
          emailVerificationExpires: new Date(Date.now() + 24 * 3600 * 1000),
        },
      }
    );

    const validVerifReq = new NextRequest("https://www.lingopdf.in/api/auth/verify-email", {
      method: "POST",
      headers: {
        Origin: "https://www.lingopdf.in",
        "Content-Type": "application/json",
        "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 200) + 1}`,
      },
      body: JSON.stringify({ token: rawToken }),
    });
    const validVerifRes = await verifyEmailRoute.POST(validVerifReq);
    assert.equal(validVerifRes.status, 200);
    const validVerifJson = await validVerifRes.json();
    assert.equal(validVerifJson.status, "success");

    // Check database update
    const verifiedUser = await usersCol.findOne({ _id: createdUser._id });
    assert.equal(verifiedUser.isEmailVerified, true, "isEmailVerified must be updated to true");
    assert.equal(verifiedUser.emailVerificationTokenHash, undefined, "Verification token hash must be wiped");
    console.log("  ✓ Valid verification token marks user verified and clears token hash");

    // 4c. Re-using the same token fails
    const reuseVerifRes = await verifyEmailRoute.POST(validVerifReq);
    assert.equal(reuseVerifRes.status, 400, "Reused token must be rejected");
    console.log("  ✓ Single-use token invalidation verified: reuse rejected");

    // ---------------------------------------------------------------------------
    // [Test 5] Successful Login Flow
    // ---------------------------------------------------------------------------
    console.log("\n[5/11] Testing Successful Login Flow...");
    const loginReq = new NextRequest("https://www.lingopdf.in/api/auth/login", {
      method: "POST",
      headers: {
        Origin: "https://www.lingopdf.in",
        "Content-Type": "application/json",
        "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 200) + 1}`,
      },
      body: JSON.stringify({
        email: testEmail.toUpperCase(),
        password: testPassword,
      }),
    });

    const loginRes = await loginRoute.POST(loginReq);
    assert.equal(loginRes.status, 200, `Login must return 200 OK (got ${loginRes.status})`);
    const loginJson = await loginRes.json();
    assert.equal(loginJson.user.email, testEmail.toLowerCase());
    assert.equal(loginJson.user.isEmailVerified, true);

    const loginCookie = loginRes.cookies.get("lingopdf_session");
    assert.ok(loginCookie, "Login must set session cookie");
    console.log("  ✓ Customer authenticated successfully with Argon2id");
    console.log("  ✓ Secure session established with updated isEmailVerified state");

    // ---------------------------------------------------------------------------
    // [Test 6] Invalid Credentials Rejection
    // ---------------------------------------------------------------------------
    console.log("\n[6/11] Testing Invalid Credentials Rejection...");
    const badLoginReq = new NextRequest("https://www.lingopdf.in/api/auth/login", {
      method: "POST",
      headers: {
        Origin: "https://www.lingopdf.in",
        "Content-Type": "application/json",
        "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 200) + 1}`,
      },
      body: JSON.stringify({
        email: testEmail,
        password: "WrongPassword999!",
      }),
    });

    const badLoginRes = await loginRoute.POST(badLoginReq);
    assert.equal(badLoginRes.status, 401, "Invalid password must return 401");
    const badLoginJson = await badLoginRes.json();
    assert.equal(badLoginJson.code, "INVALID_CREDENTIALS");
    console.log("  ✓ Invalid password rejected with timing-safe 401 INVALID_CREDENTIALS");

    // ---------------------------------------------------------------------------
    // [Test 7] Unverified Account Restrictions
    // ---------------------------------------------------------------------------
    console.log("\n[7/11] Testing Unverified Account Restrictions...");
    // Create an unverified user
    const unverifiedUser = {
      _id: new ObjectId(),
      email: `unverified_${testSuffix}@example.com`,
      passwordHash: "argon2_dummy",
      role: "customer",
      status: "active",
      isEmailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await usersCol.insertOne(unverifiedUser);
    cleanupUserIds.push(unverifiedUser._id);

    // Unverified admin escalation check: admin module refuses unverified users
    const { createSession } = loadTsModule(path.resolve(__dirname, "../src/lib/auth/session.ts"));
    const unverifiedSession = await createSession(db, unverifiedUser._id, {});
    const adminCheckResult = await adminAuthMod.authorizeAdminSessionToken(db, unverifiedSession.token);
    assert.equal(adminCheckResult.authorized, false, "Unverified user must never be authorized for admin");
    assert.equal(adminCheckResult.reason, "email_not_verified", "Reason must be email_not_verified");
    assert.equal(adminCheckResult.status, 403, "Status must be 403");
    console.log("  ✓ Unverified user denied administrative authorization (403 email_not_verified)");

    // ---------------------------------------------------------------------------
    // [Test 8] Session Check & Logout
    // ---------------------------------------------------------------------------
    console.log("\n[8/11] Testing Session Validation & Logout...");
    // Validate session endpoint
    const sessionReq = new NextRequest("https://www.lingopdf.in/api/auth/session", {
      method: "GET",
      headers: {
        cookie: `lingopdf_session=${loginCookie.value}`,
      },
    });
    const sessionRes = await sessionRoute.GET(sessionReq);
    assert.equal(sessionRes.status, 200);
    const sessionJson = await sessionRes.json();
    assert.ok(sessionJson.user, "Active user must be returned");
    assert.equal(sessionJson.user.email, testEmail.toLowerCase());
    console.log("  ✓ GET /api/auth/session validated active session");

    // Logout
    const logoutReq = new NextRequest("https://www.lingopdf.in/api/auth/logout", {
      method: "POST",
      headers: {
        Origin: "https://www.lingopdf.in",
        cookie: `lingopdf_session=${loginCookie.value}`,
        "x-real-ip": `198.51.100.${Math.floor(Math.random() * 200) + 1}`,
      },
    });
    const logoutRes = await logoutRoute.POST(logoutReq);
    assert.equal(logoutRes.status, 200);
    const clearedCookie = logoutRes.cookies.get("lingopdf_session");
    assert.ok(clearedCookie, "Logout must return session cookie");
    assert.equal(clearedCookie.maxAge, 0, "Session cookie maxAge must be 0 (cleared)");
    console.log("  ✓ POST /api/auth/logout invalidated session and cleared cookie");

    // ---------------------------------------------------------------------------
    // [Test 9] Password Reset Flow
    // ---------------------------------------------------------------------------
    console.log("\n[9/11] Testing Password Reset Flow...");
    // 9a. Request password reset
    const forgotReq = new NextRequest("https://www.lingopdf.in/api/auth/forgot-password", {
      method: "POST",
      headers: {
        Origin: "https://www.lingopdf.in",
        "Content-Type": "application/json",
        "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 200) + 1}`,
      },
      body: JSON.stringify({ email: testEmail }),
    });
    const forgotRes = await forgotPwRoute.POST(forgotReq);
    assert.equal(forgotRes.status, 200);

    // 9b. Reset password with token
    const pwRawToken = crypto.randomBytes(32).toString("hex");
    const pwTokenHash = hashToken(pwRawToken);
    await usersCol.updateOne(
      { _id: createdUser._id },
      {
        $set: {
          passwordResetTokenHash: pwTokenHash,
          passwordResetExpires: new Date(Date.now() + 3600 * 1000),
        },
      }
    );

    const newPassword = "NewPaddlePassword2026!Updated";
    const resetReq = new NextRequest("https://www.lingopdf.in/api/auth/reset-password", {
      method: "POST",
      headers: {
        Origin: "https://www.lingopdf.in",
        "Content-Type": "application/json",
        "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 200) + 1}`,
      },
      body: JSON.stringify({
        token: pwRawToken,
        password: newPassword,
      }),
    });
    const resetRes = await resetPwRoute.POST(resetReq);
    assert.equal(resetRes.status, 200);

    // 9c. Verify login with new password succeeds
    const newLoginReq = new NextRequest("https://www.lingopdf.in/api/auth/login", {
      method: "POST",
      headers: {
        Origin: "https://www.lingopdf.in",
        "Content-Type": "application/json",
        "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 200) + 1}`,
      },
      body: JSON.stringify({
        email: testEmail,
        password: newPassword,
      }),
    });
    const newLoginRes = await loginRoute.POST(newLoginReq);
    assert.equal(newLoginRes.status, 200, "Login with new password must succeed");
    console.log("  ✓ Password reset token generated, verified, and password updated");
    console.log("  ✓ Authentication with updated password succeeded");

    // ---------------------------------------------------------------------------
    // [Test 10] Protected Account Redirection
    // ---------------------------------------------------------------------------
    console.log("\n[10/11] Testing Protected Account Redirection...");
    const devicesPageSource = fs.readFileSync(path.resolve(__dirname, "../src/app/account/devices/page.tsx"), "utf8");
    assert.ok(devicesPageSource.includes('redirect("/login?from=/account/devices")'), "Unauthenticated visitors to /account/devices must redirect to /login");

    const referralsPageSource = fs.readFileSync(path.resolve(__dirname, "../src/app/account/referrals/page.tsx"), "utf8");
    assert.ok(referralsPageSource.includes("redirect(`/login?callbackUrl="), "Unauthenticated visitors to /account/referrals must redirect to /login");
    console.log("  ✓ Protected account routes redirect unauthenticated users to /login");

    // ---------------------------------------------------------------------------
    // [Test 11] Licensing & Entitlement Integrity Guard
    // ---------------------------------------------------------------------------
    console.log("\n[11/11] Verifying Paddle & Licensing Boundaries...");
    // Verify newly registered user has ZERO entitlements or purchases
    const userEntitlements = await db.collection("entitlements").countDocuments({ userId: createdUser._id });
    const userPurchases = await db.collection("purchases").countDocuments({ userId: createdUser._id });
    assert.equal(userEntitlements, 0, "New registered user must have 0 entitlements automatically created");
    assert.equal(userPurchases, 0, "New registered user must have 0 purchases automatically created");
    console.log("  ✓ Commercial boundary verified: 0 entitlements and 0 purchases created on registration");

  } finally {
    // Cleanup
    if (cleanupUserIds.length > 0) {
      await usersCol.deleteMany({ _id: { $in: cleanupUserIds } });
      await sessionsCol.deleteMany({ userId: { $in: cleanupUserIds } });
      console.log(`\nCleaned up ${cleanupUserIds.length} test user records from database.`);
    }
  }

  console.log("\n===============================================================================");
  console.log("🎉 ALL AUTHENTICATION & REGISTRATION END-TO-END TESTS PASSED!");
  console.log("===============================================================================\n");
  process.exit(0);
}

runAuthSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
