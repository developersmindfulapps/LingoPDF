import assert from "node:assert/strict";
import { ObjectId } from "mongodb";
import { registerSchema, loginSchema } from "../src/lib/auth/validation";
import {
  hashPassword,
  verifyPassword,
  hashToken,
  generateOpaqueToken,
  sanitizeUser,
} from "../src/lib/auth/session";
import {
  checkRateLimit,
  setTestRateLimitStore,
  createInMemoryRateLimitStore,
  buildEmailRateLimitKey,
  RateLimitBackendError,
} from "../src/lib/auth/rateLimit";
import { validateCsrfRequest } from "../src/lib/security/csrf";
import {
  resolveUserRole,
  detectClientRoleEscalationAttempt,
} from "../src/lib/auth/admin";

async function runTests() {
  console.log("=== Running Core Auth & Security Unit Tests ===");

  // 1. Validation tests
  console.log("Test: Registration & login validation");
  const validReg = registerSchema.safeParse({
    email: "  TestUser@Example.COM  ",
    password: "Password123!",
    name: "Test User",
  });
  assert.equal(validReg.success, true);
  if (validReg.success) {
    assert.equal(validReg.data.email, "testuser@example.com");
  }

  const shortPass = registerSchema.safeParse({
    email: "user@example.com",
    password: "short",
  });
  assert.equal(shortPass.success, false);

  const badEmail = registerSchema.safeParse({
    email: "not-an-email",
    password: "Password123!",
  });
  assert.equal(badEmail.success, false);

  const validLogin = loginSchema.safeParse({
    email: "  USER@domain.com ",
    password: "secretpassword",
  });
  assert.equal(validLogin.success, true);
  if (validLogin.success) {
    assert.equal(validLogin.data.email, "user@domain.com");
  }

  // 2. Argon2id hashing & verification
  console.log("Test: Argon2id password hashing and verification");
  const plain = "SuperSecretPassword2026!";
  const hash = await hashPassword(plain);
  assert.ok(hash.startsWith("$argon2id$"));
  const match = await verifyPassword(hash, plain);
  assert.equal(match, true);
  const mismatch = await verifyPassword(hash, "WrongPassword!");
  assert.equal(mismatch, false);

  // 3. Token generation and hashing
  console.log("Test: Opaque session token generation & hashing");
  const token = generateOpaqueToken();
  assert.equal(typeof token, "string");
  assert.equal(token.length, 64);
  const tokenHash = hashToken(token);
  assert.equal(tokenHash.length, 64);
  assert.notEqual(token, tokenHash);

  // 4. Rate limiter (with explicit test store injection & fail-closed check)
  console.log("Test: Async rate limiting window, thresholds, and fail-closed behavior");
  await assert.rejects(
    async () => {
      await checkRateLimit("unconfigured-mongo-key", 2, 60);
    },
    (err: unknown) => err instanceof RateLimitBackendError
  );

  setTestRateLimitStore(createInMemoryRateLimitStore());
  try {
    const testKey = buildEmailRateLimitKey("login", "Person@Test.com");
    const r1 = await checkRateLimit(testKey, 2, 60);
    assert.equal(r1.allowed, true);
    assert.equal(r1.remaining, 1);
    const r2 = await checkRateLimit(testKey, 2, 60);
    assert.equal(r2.allowed, true);
    assert.equal(r2.remaining, 0);
    const r3 = await checkRateLimit(testKey, 2, 60);
    assert.equal(r3.allowed, false);
    assert.ok(r3.retryAfterSeconds > 0);
  } finally {
    setTestRateLimitStore(null);
  }

  // 5. CSRF validation
  console.log("Test: CSRF validation");
  const validReq = new Request("https://lingopdf.in/api/auth/login", {
    method: "POST",
    headers: {
      Origin: "https://lingopdf.in",
      "Content-Type": "application/json",
    },
  });
  assert.equal(
    validateCsrfRequest(validReq, { trustedAppUrl: "https://lingopdf.in" }).allowed,
    true
  );

  const crossOriginReq = new Request("https://lingopdf.in/api/auth/login", {
    method: "POST",
    headers: {
      Origin: "https://evil.example",
      "Content-Type": "application/json",
    },
  });
  assert.equal(
    validateCsrfRequest(crossOriginReq, { trustedAppUrl: "https://lingopdf.in" }).allowed,
    false
  );

  // 6. User sanitization
  console.log("Test: User sanitization");
  const dummyUser = {
    _id: new ObjectId(),
    email: "person@test.com",
    passwordHash: hash,
    name: "Person",
    status: "active" as const,
    isEmailVerified: false,
    emailVerificationToken: "secret-token",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const sanitized = sanitizeUser(dummyUser);
  assert.equal("passwordHash" in sanitized, false);
  assert.equal("emailVerificationToken" in sanitized, false);
  assert.equal(sanitized.email, "person@test.com");
  assert.equal(sanitized.role, "customer");
  assert.equal(sanitized.isEmailVerified, false);

  assert.equal(resolveUserRole(dummyUser), "customer");
  assert.equal(
    resolveUserRole({ ...dummyUser, role: "admin" }),
    "admin"
  );
  assert.equal(
    detectClientRoleEscalationAttempt({ email: "a@b.com", role: "admin" }),
    "role"
  );

  console.log("=== All Auth & Security Unit Tests Passed! ===");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
