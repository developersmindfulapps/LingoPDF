import assert from "node:assert/strict";
import { registerSchema, loginSchema } from "../src/lib/auth/validation";
import {
  hashPassword,
  verifyPassword,
  hashToken,
  generateOpaqueToken,
  sanitizeUser,
} from "../src/lib/auth/session";
import { checkRateLimit } from "../src/lib/auth/rateLimit";
import { ObjectId } from "mongodb";

async function runTests() {
  console.log("=== Running Core Auth Unit Tests ===");

  // 1. Validation tests
  console.log("Test: Registration validation");
  const validReg = registerSchema.safeParse({
    email: "  TestUser@Example.COM  ",
    password: "Password123!",
    name: "Test User",
  });
  assert.equal(validReg.success, true);
  if (validReg.success) {
    assert.equal(validReg.data.email, "testuser@example.com");
  }

  // Short password (< 8 chars)
  const shortPass = registerSchema.safeParse({
    email: "user@example.com",
    password: "short",
  });
  assert.equal(shortPass.success, false);

  // Invalid email format
  const badEmail = registerSchema.safeParse({
    email: "not-an-email",
    password: "Password123!",
  });
  assert.equal(badEmail.success, false);

  // Login validation
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
  assert.equal(token.length, 64); // 32 bytes hex
  const tokenHash = hashToken(token);
  assert.equal(tokenHash.length, 64); // SHA-256 hex
  assert.notEqual(token, tokenHash);

  // 4. Rate limiter
  console.log("Test: Rate limiting window and thresholds");
  const testKey = `test-ip-${Date.now()}`;
  const r1 = checkRateLimit(testKey, 2, 60);
  assert.equal(r1.allowed, true);
  assert.equal(r1.remaining, 1);
  const r2 = checkRateLimit(testKey, 2, 60);
  assert.equal(r2.allowed, true);
  assert.equal(r2.remaining, 0);
  const r3 = checkRateLimit(testKey, 2, 60);
  assert.equal(r3.allowed, false);
  assert.ok(r3.retryAfterSeconds > 0);

  // 5. User sanitization
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
  assert.equal(sanitized.isEmailVerified, false);

  console.log("=== All Auth Unit Tests Passed! ===");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
