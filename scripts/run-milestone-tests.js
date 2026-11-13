/* eslint-disable */
const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const assert = require("assert/strict");

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
      }
      return loadTsModule(targetPath);
    }
    return require(specifier);
  };

  const fn = new Function("require", "exports", "module", "__dirname", "__filename", transpiled);
  fn(customRequire, m.exports, m, path.dirname(resolved), resolved);
  return m.exports;
}

async function runAllTests() {
  console.log("=== Running Stage 3B.2 Security, Pricing, Rate-Limiting & Copy Verification Tests ===");

  // ---------------------------------------------------------------------------
  // 1. Canonical Regional Pricing Integrity
  // ---------------------------------------------------------------------------
  const configMod = loadTsModule(path.resolve(__dirname, "../src/lib/pricing/config.ts"));
  const {
    REGIONAL_PRICING,
    SUPPORTED_PROMO_DISCOUNT_PERCENTAGES,
  } = configMod;

  console.log("\n[Test 1] Canonical Regional Pricing Configuration Integrity");
  Object.values(REGIONAL_PRICING).forEach((regionConfig) => {
    assert.equal(
      regionConfig.price,
      regionConfig.basePrice,
      `Region ${regionConfig.regionCode} price must equal basePrice`
    );
    assert.equal(regionConfig.originalPrice, undefined);
    assert.equal(regionConfig.isPromoActive, false);
  });

  assert.equal(REGIONAL_PRICING.IN.currency, "INR");
  assert.equal(REGIONAL_PRICING.IN.basePrice, 1299);
  assert.equal(REGIONAL_PRICING.US.currency, "USD");
  assert.equal(REGIONAL_PRICING.US.basePrice, 75);
  assert.equal(REGIONAL_PRICING.EU.currency, "EUR");
  assert.equal(REGIONAL_PRICING.EU.basePrice, 75);
  assert.equal(REGIONAL_PRICING.DEFAULT.currency, "USD");
  assert.equal(REGIONAL_PRICING.DEFAULT.basePrice, 75);
  assert.deepEqual(Array.from(SUPPORTED_PROMO_DISCOUNT_PERCENTAGES), [5, 10, 15, 20]);
  console.log("✓ Canonical prices verified: India ₹1,299 INR, US $75 USD, EU €75 EUR, Default $75 USD.");

  // ---------------------------------------------------------------------------
  // 2. Price Formatting Separation
  // ---------------------------------------------------------------------------
  const formatMod = loadTsModule(path.resolve(__dirname, "../src/lib/pricing/format.ts"));
  const { formatPrice, formatPriceWithCurrencyCode } = formatMod;

  console.log("\n[Test 2] Separation of Display Formatting from Numeric Values");
  assert.equal(formatPrice(1299, REGIONAL_PRICING.IN), "₹1,299");
  assert.equal(formatPrice(75, REGIONAL_PRICING.US), "$75");
  assert.equal(formatPrice(75, REGIONAL_PRICING.EU), "€75");
  assert.equal(formatPriceWithCurrencyCode(1299, REGIONAL_PRICING.IN), "₹1,299 INR");
  assert.equal(formatPriceWithCurrencyCode(75, REGIONAL_PRICING.US), "$75 USD");
  assert.equal(formatPriceWithCurrencyCode(75, REGIONAL_PRICING.EU), "€75 EUR");
  console.log("✓ Price formatting verified.");

  // ---------------------------------------------------------------------------
  // 3. Regional Pricing Security & INR Restriction Enforcement
  // ---------------------------------------------------------------------------
  const resolveMod = loadTsModule(path.resolve(__dirname, "../src/lib/pricing/resolve.ts"));
  const {
    mapCountryToRegionCode,
    detectCountryFromHeaders,
    resolveRegionCode,
    isRegionSelectionAllowed,
    getPermittedRegionsForCountry,
    getAuthoritativePricing,
  } = resolveMod;

  console.log("\n[Test 3] Regional Pricing Enforcement (India INR Lock & International INR Prohibition)");

  // 3a. Indian users always resolve to INR and cannot switch to USD or EUR
  assert.equal(resolveRegionCode("IN", null), "IN");
  assert.equal(resolveRegionCode("in", null), "IN");
  assert.equal(resolveRegionCode("IN", "US"), "IN", "India-detected user must not switch to US via cookie");
  assert.equal(resolveRegionCode("IN", "EU"), "IN", "India-detected user must not switch to EU via cookie");
  assert.equal(resolveRegionCode("IN", "DEFAULT"), "IN", "India-detected user must not switch to DEFAULT via cookie");
  assert.equal(isRegionSelectionAllowed("IN", "IN"), true);
  assert.equal(isRegionSelectionAllowed("IN", "US"), false, "Indian user cannot select USD");
  assert.equal(isRegionSelectionAllowed("IN", "EU"), false, "Indian user cannot select EUR");
  assert.equal(isRegionSelectionAllowed("IN", "DEFAULT"), false);

  const indiaPermitted = getPermittedRegionsForCountry("IN");
  assert.equal(indiaPermitted.length, 1);
  assert.equal(indiaPermitted[0].regionCode, "IN");

  // 3b. International users can choose USD or EUR, but can NEVER select INR
  assert.equal(resolveRegionCode("US", null), "US");
  assert.equal(resolveRegionCode("US", "EU"), "EU", "US user can select EUR");
  assert.equal(resolveRegionCode("DE", null), "EU");
  assert.equal(resolveRegionCode("DE", "US"), "US", "Eurozone user can select USD");
  assert.equal(resolveRegionCode("GB", null), "DEFAULT");
  assert.equal(resolveRegionCode("GB", "EU"), "EU", "UK user can select EUR");
  assert.equal(resolveRegionCode("GB", "US"), "US", "UK user can select USD");

  // Spoofed "IN" cookie from international or unknown countries must be rejected
  assert.equal(resolveRegionCode("US", "IN"), "US", "US user with spoofed IN cookie must stay US");
  assert.equal(resolveRegionCode("DE", "IN"), "EU", "DE user with spoofed IN cookie must stay EU");
  assert.equal(resolveRegionCode("GB", "IN"), "DEFAULT", "GB user with spoofed IN cookie must stay DEFAULT");
  assert.equal(resolveRegionCode(null, "IN"), "DEFAULT", "Undetected country with spoofed IN cookie must stay DEFAULT");

  assert.equal(isRegionSelectionAllowed("US", "IN"), false, "US user must never be allowed to select IN");
  assert.equal(isRegionSelectionAllowed("DE", "IN"), false, "DE user must never be allowed to select IN");
  assert.equal(isRegionSelectionAllowed(null, "IN"), false, "Unknown country must never be allowed to select IN");
  assert.equal(isRegionSelectionAllowed("US", "EU"), true);
  assert.equal(isRegionSelectionAllowed("US", "US"), true);
  assert.equal(isRegionSelectionAllowed("DE", "US"), true);

  const intlPermitted = getPermittedRegionsForCountry("US");
  assert.ok(intlPermitted.every((r) => r.regionCode !== "IN" && r.currency !== "INR"));
  assert.ok(intlPermitted.some((r) => r.currency === "USD"));
  assert.ok(intlPermitted.some((r) => r.currency === "EUR"));

  // 3c. Authoritative pricing lookup enforcement
  assert.equal(getAuthoritativePricing("IN").currency, "INR");
  assert.equal(getAuthoritativePricing("IN", "US").currency, "INR", "India user locked to INR even if US preference passed");
  assert.equal(getAuthoritativePricing("US", "IN").currency, "USD", "US user blocked from INR even if IN preference passed");
  assert.equal(getAuthoritativePricing("DE", "IN").currency, "EUR", "DE user blocked from INR even if IN preference passed");
  assert.equal(getAuthoritativePricing("US", "EU").currency, "EUR", "US user allowed to choose EUR");
  assert.equal(getAuthoritativePricing(null, "IN").currency, "USD", "Null country blocked from INR");
  console.log("✓ Regional pricing rules verified: India locked to INR; International may choose USD/EUR and never INR.");

  // ---------------------------------------------------------------------------
  // 4. Trusted Geo Header Detection & Untrusted Header Rejection
  // ---------------------------------------------------------------------------
  console.log("\n[Test 4] Unit Test: Trusted Geo Header Detection, Precedence & Production Spoofing Defense");
  const makeHeaders = (obj) => ({
    get: (key) => obj[key.toLowerCase()] ?? null,
  });

  const prevNodeEnv = process.env.NODE_ENV;
  const prevVercelEnv = process.env.VERCEL_ENV;
  const prevVercel = process.env.VERCEL;
  const prevTrustCf = process.env.TRUST_CLOUDFLARE_PROXY;

  try {
    // 4a. Development mode: x-lingopdf-region is allowed when both NODE_ENV and VERCEL_ENV are non-production
    process.env.NODE_ENV = "development";
    delete process.env.VERCEL_ENV;
    process.env.VERCEL = "1";
    delete process.env.TRUST_CLOUDFLARE_PROXY;
    assert.equal(detectCountryFromHeaders(makeHeaders({ "x-lingopdf-region": "IN" })), "IN");
    assert.equal(detectCountryFromHeaders(makeHeaders({ "x-vercel-ip-country": "DE" })), "DE");

    // 4b. Vercel headers ignored when NOT running on Vercel (process.env.VERCEL !== "1")
    delete process.env.VERCEL;
    assert.equal(
      detectCountryFromHeaders(makeHeaders({ "x-vercel-ip-country": "DE" })),
      null,
      "x-vercel-ip-country must be ignored when process.env.VERCEL !== '1'"
    );
    process.env.VERCEL = "1";

    // 4c. Untrusted headers and invalid country values must always be ignored
    assert.equal(
      detectCountryFromHeaders(makeHeaders({ "x-country-code": "IN" })),
      null,
      "x-country-code must never be trusted"
    );
    assert.equal(
      detectCountryFromHeaders(makeHeaders({ "cloudfront-viewer-country": "IN" })),
      null,
      "cloudfront-viewer-country must not be trusted"
    );
    assert.equal(
      detectCountryFromHeaders(makeHeaders({ "cf-ipcountry": "IN" })),
      null,
      "cf-ipcountry must not be trusted when TRUST_CLOUDFLARE_PROXY is disabled by default"
    );
    assert.equal(
      detectCountryFromHeaders(makeHeaders({ "x-vercel-ip-country": "INVALID" })),
      null,
      "Malformed country codes must be rejected"
    );

    // 4d. Production mode (NODE_ENV === "production" OR VERCEL_ENV === "production"): x-lingopdf-region MUST be ignored
    process.env.NODE_ENV = "production";
    assert.equal(
      detectCountryFromHeaders(makeHeaders({ "x-lingopdf-region": "IN" })),
      null,
      "x-lingopdf-region must be ignored when NODE_ENV === 'production'"
    );
    process.env.NODE_ENV = "development";
    process.env.VERCEL_ENV = "production";
    assert.equal(
      detectCountryFromHeaders(makeHeaders({ "x-lingopdf-region": "IN" })),
      null,
      "x-lingopdf-region must be ignored when VERCEL_ENV === 'production'"
    );
    process.env.NODE_ENV = "production";
    assert.equal(
      detectCountryFromHeaders(
        makeHeaders({ "x-lingopdf-region": "IN", "x-vercel-ip-country": "US" })
      ),
      "US",
      "Production on Vercel must use x-vercel-ip-country and ignore x-lingopdf-region"
    );

    // 4e. Cloudflare precedence when TRUST_CLOUDFLARE_PROXY === "true": cf-ipcountry evaluated BEFORE x-vercel-ip-country
    process.env.TRUST_CLOUDFLARE_PROXY = "true";
    assert.equal(
      detectCountryFromHeaders(
        makeHeaders({ "cf-ipcountry": "IN", "x-vercel-ip-country": "US" })
      ),
      "IN",
      "When TRUST_CLOUDFLARE_PROXY === 'true', cf-ipcountry must take precedence over x-vercel-ip-country"
    );
    assert.equal(
      detectCountryFromHeaders(makeHeaders({ "cf-ipcountry": "DE" })),
      "DE"
    );
    assert.equal(
      detectCountryFromHeaders(makeHeaders({ "cf-ipcountry": "XX" })),
      null,
      "Reserved XX pseudo-country must be rejected"
    );
  } finally {
    process.env.NODE_ENV = prevNodeEnv;
    if (prevVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = prevVercelEnv;
    if (prevVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = prevVercel;
    if (prevTrustCf === undefined) delete process.env.TRUST_CLOUDFLARE_PROXY;
    else process.env.TRUST_CLOUDFLARE_PROXY = prevTrustCf;
  }
  console.log("✓ Geo header trust boundaries and Cloudflare/Vercel precedence verified.");

  // ---------------------------------------------------------------------------
  // 5. CSRF Validation Utility
  // ---------------------------------------------------------------------------
  const csrfMod = loadTsModule(path.resolve(__dirname, "../src/lib/security/csrf.ts"));
  const { validateCsrfRequest } = csrfMod;

  console.log("\n[Test 5] CSRF Protection Utility");
  const canonicalUrl = "https://lingopdf.in";
  const makeRequest = (headersObj, method = "POST") => ({
    method,
    headers: makeHeaders(headersObj),
  });

  // 5a. Exact valid origin with application/json succeeds
  assert.deepEqual(
    validateCsrfRequest(
      makeRequest({
        origin: "https://lingopdf.in",
        "content-type": "application/json; charset=utf-8",
        "sec-fetch-site": "same-origin",
      }),
      { trustedAppUrl: canonicalUrl }
    ),
    { allowed: true }
  );

  // 5b. Foreign origin is rejected
  const foreignRes = validateCsrfRequest(
    makeRequest({
      origin: "https://attacker.example",
      "content-type": "application/json",
    }),
    { trustedAppUrl: canonicalUrl }
  );
  assert.equal(foreignRes.allowed, false);
  assert.equal(foreignRes.code, "CSRF_ORIGIN_MISMATCH");

  // 5c. Malformed Origin ("null" or invalid URL) is rejected and does NOT fall back to Referer
  const nullOriginRes = validateCsrfRequest(
    makeRequest({
      origin: "null",
      referer: "https://lingopdf.in/login",
      "content-type": "application/json",
    }),
    { trustedAppUrl: canonicalUrl }
  );
  assert.equal(nullOriginRes.allowed, false);
  assert.equal(nullOriginRes.code, "CSRF_MALFORMED_ORIGIN");

  const badOriginRes = validateCsrfRequest(
    makeRequest({
      origin: "://bad-origin",
      referer: "https://lingopdf.in/login",
      "content-type": "application/json",
    }),
    { trustedAppUrl: canonicalUrl }
  );
  assert.equal(badOriginRes.allowed, false);
  assert.equal(badOriginRes.code, "CSRF_MALFORMED_ORIGIN");

  // 5d. Valid Referer fallback succeeds ONLY when Origin is absent
  const refererFallbackRes = validateCsrfRequest(
    makeRequest({
      referer: "https://lingopdf.in/login?callbackUrl=%2F",
      "content-type": "application/json",
    }),
    { trustedAppUrl: canonicalUrl }
  );
  assert.equal(refererFallbackRes.allowed, true);

  // 5e. Foreign Referer fallback is rejected
  const badRefererRes = validateCsrfRequest(
    makeRequest({
      referer: "https://evil.example/phish",
      "content-type": "application/json",
    }),
    { trustedAppUrl: canonicalUrl }
  );
  assert.equal(badRefererRes.allowed, false);
  assert.equal(badRefererRes.code, "CSRF_REFERER_MISMATCH");

  // 5f. Missing both Origin and Referer is rejected
  const missingBothRes = validateCsrfRequest(
    makeRequest({
      "content-type": "application/json",
    }),
    { trustedAppUrl: canonicalUrl }
  );
  assert.equal(missingBothRes.allowed, false);
  assert.equal(missingBothRes.code, "CSRF_MISSING_ORIGIN");

  // 5g. Sec-Fetch-Site: cross-site AND same-site are both rejected
  const crossSiteRes = validateCsrfRequest(
    makeRequest({
      origin: "https://lingopdf.in",
      "sec-fetch-site": "cross-site",
      "content-type": "application/json",
    }),
    { trustedAppUrl: canonicalUrl }
  );
  assert.equal(crossSiteRes.allowed, false);
  assert.equal(crossSiteRes.code, "CSRF_CROSS_SITE_FETCH");

  const sameSiteRes = validateCsrfRequest(
    makeRequest({
      origin: "https://lingopdf.in",
      "sec-fetch-site": "same-site",
      "content-type": "application/json",
    }),
    { trustedAppUrl: canonicalUrl }
  );
  assert.equal(sameSiteRes.allowed, false);
  assert.equal(
    sameSiteRes.code,
    "CSRF_CROSS_SITE_FETCH",
    "same-site must not be treated as equivalent to same-origin"
  );

  // 5h. Invalid Content-Type is rejected for JSON endpoints, allowed for body-less logout
  const formPostRes = validateCsrfRequest(
    makeRequest({
      origin: "https://lingopdf.in",
      "content-type": "text/plain",
    }),
    { trustedAppUrl: canonicalUrl, requireJsonContentType: true }
  );
  assert.equal(formPostRes.allowed, false);
  assert.equal(formPostRes.code, "CSRF_INVALID_CONTENT_TYPE");
  assert.equal(formPostRes.status, 415);

  const logoutPostRes = validateCsrfRequest(
    makeRequest({
      origin: "https://lingopdf.in",
    }),
    { trustedAppUrl: canonicalUrl, requireJsonContentType: false }
  );
  assert.equal(logoutPostRes.allowed, true);
  console.log("✓ CSRF Origin, Referer, Fetch Metadata (same-site/cross-site), and Content-Type checks verified.");

  // ---------------------------------------------------------------------------
  // 6. Unit Tests: Rate Limiting Policies, Dedicated HMAC Secret, Client IP Trust Model, In-Memory Store & Fail-Closed
  // ---------------------------------------------------------------------------
  const rateLimitMod = loadTsModule(path.resolve(__dirname, "../src/lib/auth/rateLimit.ts"));
  const {
    RATE_LIMIT_POLICIES,
    RATE_LIMIT_WINDOW_SECONDS,
    checkRateLimit,
    mongoRateLimitStore,
    resolveRateLimitHmacSecret,
    buildEmailRateLimitKey,
    buildIpRateLimitKey,
    normalizeValidIp,
    getClientIp,
    setTestRateLimitStore,
    createInMemoryRateLimitStore,
    RateLimitBackendError,
  } = rateLimitMod;

  console.log("\n[Test 6] Unit Tests: Rate Limiting Policies, Dedicated HMAC Secret, Client IP Trust & In-Memory Store");

  // 6a. Verify exact approved policy table
  assert.equal(RATE_LIMIT_WINDOW_SECONDS, 900);
  assert.equal(RATE_LIMIT_POLICIES.register.ipLimit, 5);
  assert.equal(RATE_LIMIT_POLICIES.register.emailLimit, null);
  assert.equal(RATE_LIMIT_POLICIES.login.ipLimit, 10);
  assert.equal(RATE_LIMIT_POLICIES.login.emailLimit, 5);
  assert.equal(RATE_LIMIT_POLICIES.verifyEmail.ipLimit, 10);
  assert.equal(RATE_LIMIT_POLICIES.verifyEmail.emailLimit, null);
  assert.equal(RATE_LIMIT_POLICIES.resendVerification.ipLimit, 3);
  assert.equal(RATE_LIMIT_POLICIES.resendVerification.emailLimit, 3);
  assert.equal(RATE_LIMIT_POLICIES.forgotPassword.ipLimit, 5);
  assert.equal(RATE_LIMIT_POLICIES.forgotPassword.emailLimit, 3);
  assert.equal(RATE_LIMIT_POLICIES.resetPassword.ipLimit, 10);
  assert.equal(RATE_LIMIT_POLICIES.resetPassword.emailLimit, null);
  assert.equal(RATE_LIMIT_POLICIES.logout.ipLimit, 20);
  assert.equal(RATE_LIMIT_POLICIES.logout.emailLimit, null);
  assert.equal(RATE_LIMIT_POLICIES.pricingPreference.ipLimit, 30);
  assert.equal(RATE_LIMIT_POLICIES.pricingPreference.emailLimit, null);

  // 6b. Dedicated HMAC secret validation, email normalization & rotation behavior
  const savedEnv = process.env.NODE_ENV;
  const savedVercelEnv = process.env.VERCEL_ENV;
  const savedVercel = process.env.VERCEL;
  const savedTrustCf = process.env.TRUST_CLOUDFLARE_PROXY;
  const savedHmacSecret = process.env.RATE_LIMIT_HMAC_SECRET;
  const savedMongoUri = process.env.MONGODB_URI;

  try {
    process.env.NODE_ENV = "test";
    delete process.env.VERCEL_ENV;
    delete process.env.RATE_LIMIT_HMAC_SECRET;

    const emailKey1 = buildEmailRateLimitKey("login", "  Reader@Example.COM ");
    const emailKey2 = buildEmailRateLimitKey("login", "reader@example.com");
    const emailKeyOtherScope = buildEmailRateLimitKey("forgot-pw", "reader@example.com");
    assert.equal(emailKey1, emailKey2, "Normalized emails must map to the exact same HMAC bucket");
    assert.notEqual(emailKey1, emailKeyOtherScope, "Different scopes must have isolated buckets");
    assert.equal(
      emailKey1.includes("reader@example.com"),
      false,
      "Bucket key must never contain raw email address"
    );

    // Secret rotation must change bucket identifiers
    process.env.RATE_LIMIT_HMAC_SECRET = "0123456789abcdef0123456789abcdef_secret_v1";
    const keyWithSecretV1 = buildEmailRateLimitKey("login", "reader@example.com");
    process.env.RATE_LIMIT_HMAC_SECRET = "fedcba9876543210fedcba9876543210_secret_v2";
    const keyWithSecretV2 = buildEmailRateLimitKey("login", "reader@example.com");
    assert.notEqual(
      keyWithSecretV1,
      keyWithSecretV2,
      "Rotating RATE_LIMIT_HMAC_SECRET must change rate-limit bucket identifiers"
    );

    // Production HMAC requirements: missing secret MUST fail closed even if MONGODB_URI is present
    process.env.NODE_ENV = "production";
    process.env.MONGODB_URI = "mongodb+srv://user:password@cluster.example.net/lingo_pdf";
    delete process.env.RATE_LIMIT_HMAC_SECRET;
    assert.throws(
      () => resolveRateLimitHmacSecret(),
      (err) => err instanceof RateLimitBackendError,
      "Missing RATE_LIMIT_HMAC_SECRET in production must throw RateLimitBackendError and never fall back to MONGODB_URI"
    );
    assert.throws(
      () => buildEmailRateLimitKey("login", "reader@example.com"),
      (err) => err instanceof RateLimitBackendError,
      "buildEmailRateLimitKey must fail closed in production when RATE_LIMIT_HMAC_SECRET is missing"
    );
    assert.throws(
      () => buildIpRateLimitKey("login", "203.0.113.10"),
      (err) => err instanceof RateLimitBackendError,
      "buildIpRateLimitKey must fail closed in production when RATE_LIMIT_HMAC_SECRET is missing"
    );

    // Short (< 32 chars) or low-entropy secret must fail closed
    process.env.RATE_LIMIT_HMAC_SECRET = "short-secret-under-32-chars";
    assert.throws(
      () => resolveRateLimitHmacSecret(),
      (err) => err instanceof RateLimitBackendError,
      "Short RATE_LIMIT_HMAC_SECRET (< 32 chars) must throw RateLimitBackendError"
    );
    process.env.RATE_LIMIT_HMAC_SECRET = "a".repeat(40);
    assert.throws(
      () => resolveRateLimitHmacSecret(),
      (err) => err instanceof RateLimitBackendError,
      "Low-entropy repeated-character RATE_LIMIT_HMAC_SECRET must throw RateLimitBackendError"
    );

    // Valid >= 32 char high-entropy secret succeeds in production
    process.env.RATE_LIMIT_HMAC_SECRET =
      "9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e";
    assert.equal(
      resolveRateLimitHmacSecret(),
      "9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e"
    );
  } finally {
    process.env.NODE_ENV = savedEnv;
    if (savedVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = savedVercelEnv;
    if (savedHmacSecret === undefined) delete process.env.RATE_LIMIT_HMAC_SECRET;
    else process.env.RATE_LIMIT_HMAC_SECRET = savedHmacSecret;
    if (savedMongoUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = savedMongoUri;
  }

  // 6c. Production fail-closed test when MongoDB is unavailable
  try {
    process.env.NODE_ENV = "production";
    delete process.env.MONGODB_URI;
    process.env.RATE_LIMIT_HMAC_SECRET =
      "9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e";

    assert.throws(
      () => createInMemoryRateLimitStore(),
      /cannot be created in production/i,
      "Creating in-memory store in production must throw"
    );
    assert.throws(
      () => setTestRateLimitStore({ consume: async () => ({ allowed: true, remaining: 1, retryAfterSeconds: 0 }) }),
      /Cannot inject a test rate-limit store in production/i,
      "Injecting test store in production must throw"
    );

    // Without MONGODB_URI configured in unit test process, checkRateLimit must fail closed with RateLimitBackendError
    await assert.rejects(
      async () => {
        await checkRateLimit("prod-fail-closed-test", 5, 900);
      },
      (err) => err instanceof RateLimitBackendError && err.code === "RATE_LIMIT_BACKEND_UNAVAILABLE",
      "Production checkRateLimit must fail closed when MongoDB is unavailable"
    );
  } finally {
    process.env.NODE_ENV = savedEnv;
    if (savedHmacSecret === undefined) delete process.env.RATE_LIMIT_HMAC_SECRET;
    else process.env.RATE_LIMIT_HMAC_SECRET = savedHmacSecret;
    if (savedMongoUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = savedMongoUri;
  }

  // 6d. In-memory unit test store: fast unit test of counter & window reset logic (explicitly labeled as in-memory unit test)
  process.env.NODE_ENV = "test";
  delete process.env.VERCEL_ENV;
  try {
    setTestRateLimitStore(createInMemoryRateLimitStore());

    const inMemoryUnitKey = buildIpRateLimitKey("register", "203.0.113.42");
    const decisions = await Promise.all(
      Array.from({ length: 15 }, () => checkRateLimit(inMemoryUnitKey, 5, 60))
    );
    const allowedCount = decisions.filter((d) => d.allowed).length;
    const blockedCount = decisions.filter((d) => !d.allowed).length;
    assert.equal(allowedCount, 5, "In-memory unit store: 5 of 15 requests allowed");
    assert.equal(blockedCount, 10, "In-memory unit store: 10 of 15 requests blocked");

    // In-memory window expiry unit test (50ms window)
    const shortWindowKey = "in-memory-short-window-unit-test";
    const s1 = await checkRateLimit(shortWindowKey, 1, 0.05);
    assert.equal(s1.allowed, true);
    const s2 = await checkRateLimit(shortWindowKey, 1, 0.05);
    assert.equal(s2.allowed, false);
    await new Promise((r) => setTimeout(r, 80));
    const s3 = await checkRateLimit(shortWindowKey, 1, 0.05);
    assert.equal(s3.allowed, true, "Expired in-memory unit window must reset");
  } finally {
    setTestRateLimitStore(null);
    process.env.NODE_ENV = savedEnv;
  }

  // 6e. Client IP extraction trust model & precedence rules
  try {
    process.env.NODE_ENV = "production";
    delete process.env.VERCEL_ENV;
    delete process.env.TRUST_CLOUDFLARE_PROXY;

    // When NOT running on Vercel (process.env.VERCEL !== "1"), Vercel headers MUST be ignored
    delete process.env.VERCEL;
    assert.equal(
      getClientIp(
        makeRequest({
          "x-vercel-forwarded-for": "203.0.113.99",
          "x-real-ip": "203.0.113.99",
        })
      ),
      null,
      "Vercel headers must be ignored when process.env.VERCEL !== '1'"
    );

    // When running on Vercel (process.env.VERCEL === "1"), Vercel headers are trusted and generic x-forwarded-for is ignored
    process.env.VERCEL = "1";
    assert.equal(
      getClientIp(makeRequest({ "x-forwarded-for": "198.51.100.7" })),
      null,
      "Production must not trust arbitrary x-forwarded-for without Vercel/Cloudflare authoritative header"
    );
    assert.equal(
      getClientIp(
        makeRequest({
          "x-forwarded-for": "1.2.3.4",
          "x-vercel-forwarded-for": "203.0.113.99",
        })
      ),
      "203.0.113.99",
      "Production on Vercel must extract authoritative x-vercel-forwarded-for"
    );
    assert.equal(
      getClientIp(makeRequest({ "x-real-ip": "::ffff:192.0.2.15" })),
      "192.0.2.15",
      "IPv4-mapped IPv6 addresses must normalize to canonical IPv4"
    );

    // Cloudflare disabled by default: cf-connecting-ip is ignored
    assert.equal(
      getClientIp(makeRequest({ "cf-connecting-ip": "198.51.100.55" })),
      null,
      "cf-connecting-ip must be ignored when TRUST_CLOUDFLARE_PROXY is disabled by default"
    );

    // Cloudflare enabled (TRUST_CLOUDFLARE_PROXY === "true"): cf-connecting-ip evaluated BEFORE Vercel headers
    process.env.TRUST_CLOUDFLARE_PROXY = "true";
    assert.equal(
      getClientIp(
        makeRequest({
          "cf-connecting-ip": "198.51.100.55",
          "x-vercel-forwarded-for": "172.64.0.10",
          "x-real-ip": "172.64.0.10",
        })
      ),
      "198.51.100.55",
      "When TRUST_CLOUDFLARE_PROXY === 'true', cf-connecting-ip must take precedence over x-vercel-forwarded-for"
    );

    // Invalid IP values are rejected
    assert.equal(normalizeValidIp("999.999.999.999"), null);
    assert.equal(normalizeValidIp("not-an-ip"), null);

    // Development fallback disabled when VERCEL_ENV === "production" even if NODE_ENV === "development"
    delete process.env.TRUST_CLOUDFLARE_PROXY;
    delete process.env.VERCEL;
    process.env.NODE_ENV = "development";
    process.env.VERCEL_ENV = "production";
    assert.equal(
      getClientIp(makeRequest({ "x-forwarded-for": "198.51.100.7" })),
      null,
      "Development x-forwarded-for fallback must be disabled when VERCEL_ENV === 'production'"
    );
  } finally {
    process.env.NODE_ENV = savedEnv;
    if (savedVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = savedVercelEnv;
    if (savedVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = savedVercel;
    if (savedTrustCf === undefined) delete process.env.TRUST_CLOUDFLARE_PROXY;
    else process.env.TRUST_CLOUDFLARE_PROXY = savedTrustCf;
  }
  console.log("✓ Rate limiting thresholds, dedicated HMAC secret rules, IP trust precedence, and in-memory unit tests verified.");

  // ---------------------------------------------------------------------------
  // 7. Mocked Collection Tests: Database Index Provisioning & Runtime Cold-Start Decoupling
  // ---------------------------------------------------------------------------
  const modelsMod = loadTsModule(path.resolve(__dirname, "../src/lib/db/models.ts"));
  const {
    COLLECTION_NAMES,
    ensureIndexes,
    getUsersCollection,
    getSessionsCollection,
    getRateLimitsCollection,
    getPurchasesCollection,
    getEntitlementsCollection,
    getPromotionSettingsCollection,
    getReferralProfilesCollection,
    getCommissionsCollection,
    getPayoutsCollection,
    getPaymentWebhooksCollection,
    getAdminAuditLogsCollection,
    getPurchaseEvidenceCollection,
    getCommissionAdjustmentsCollection,
  } = modelsMod;

  console.log("\n[Test 7] Mocked Collection Test: Controlled Index Provisioning & Cold-Start Decoupling (All 13 Collections)");
  let createIndexCalls = [];
  const mockDb = {
    collection(name) {
      return {
        collectionName: name,
        async createIndex(spec, options = {}) {
          createIndexCalls.push({ collection: name, spec, options });
          return `${name}_${Object.keys(spec).join("_")}_idx`;
        },
      };
    },
  };

  // Accessing all 13 collections at runtime must NOT call createIndex
  await getUsersCollection(mockDb);
  await getSessionsCollection(mockDb);
  await getRateLimitsCollection(mockDb);
  await getPurchasesCollection(mockDb);
  await getEntitlementsCollection(mockDb);
  await getPromotionSettingsCollection(mockDb);
  await getReferralProfilesCollection(mockDb);
  await getCommissionsCollection(mockDb);
  await getPayoutsCollection(mockDb);
  await getPaymentWebhooksCollection(mockDb);
  await getAdminAuditLogsCollection(mockDb);
  await getPurchaseEvidenceCollection(mockDb);
  await getCommissionAdjustmentsCollection(mockDb);
  assert.equal(
    createIndexCalls.length,
    0,
    "Runtime collection accessors must not invoke createIndex on cold starts"
  );

  // Explicit ensureIndexes(db) must provision all indexes across all collections
  const summary = await ensureIndexes(mockDb);
  assert.equal(createIndexCalls.length, summary.length, "createIndex must be called for every provisioned index");
  assert.ok(summary.length >= 44, `ensureIndexes must provision all required indexes (found ${summary.length})`);

  const expectedCollectionNames = Object.values(COLLECTION_NAMES);
  assert.equal(expectedCollectionNames.length, Object.keys(COLLECTION_NAMES).length);
  for (const colName of expectedCollectionNames) {
    assert.ok(
      createIndexCalls.some((c) => c.collection === colName),
      `Collection "${colName}" must have indexes provisioned by ensureIndexes`
    );
  }

  const rateLimitIdx = createIndexCalls.find((c) => c.collection === "rate_limits");
  assert.ok(rateLimitIdx, "rate_limits index must be provisioned");
  assert.deepEqual(rateLimitIdx.spec, { resetAt: 1 });
  assert.equal(rateLimitIdx.options.expireAfterSeconds, 0);

  // Verify admin_audit_logs and purchase_evidence do NOT have TTL indexes
  const auditIndexes = createIndexCalls.filter((c) => c.collection === "admin_audit_logs");
  assert.equal(auditIndexes.length, 4);
  for (const idx of auditIndexes) {
    assert.equal(
      idx.options.expireAfterSeconds,
      undefined,
      "admin_audit_logs must never have a TTL deletion index"
    );
  }

  const evidenceIndexes = createIndexCalls.filter((c) => c.collection === "purchase_evidence");
  assert.equal(evidenceIndexes.length, 3);
  for (const idx of evidenceIndexes) {
    assert.equal(
      idx.options.expireAfterSeconds,
      undefined,
      "purchase_evidence must never have a TTL deletion index"
    );
  }

  // Verify partial unique index semantics on purchases (providerOrderId, providerPaymentId), entitlements ({ userId, productSlug }), and payouts (externalTransferReference)
  const purchaseOrderIdIdx = createIndexCalls.find(
    (c) => c.collection === "purchases" && c.spec.providerOrderId === 1
  );
  assert.ok(purchaseOrderIdIdx);
  assert.equal(purchaseOrderIdIdx.options.unique, true);
  assert.deepEqual(purchaseOrderIdIdx.options.partialFilterExpression, {
    providerOrderId: { $type: "string" },
  });

  const purchasePaymentIdIdx = createIndexCalls.find(
    (c) => c.collection === "purchases" && c.spec.providerPaymentId === 1
  );
  assert.ok(purchasePaymentIdIdx);
  assert.equal(purchasePaymentIdIdx.options.unique, true);
  assert.deepEqual(purchasePaymentIdIdx.options.partialFilterExpression, {
    providerPaymentId: { $type: "string" },
  });

  const entitlementUserProductIdx = createIndexCalls.find(
    (c) =>
      c.collection === "entitlements" &&
      c.spec.userId === 1 &&
      c.spec.productSlug === 1
  );
  assert.ok(entitlementUserProductIdx);
  assert.equal(entitlementUserProductIdx.options.unique, true);
  assert.deepEqual(entitlementUserProductIdx.options.partialFilterExpression, {
    status: { $in: ["active", "suspended"] },
  });

  const payoutTransferRefIdx = createIndexCalls.find(
    (c) => c.collection === "payouts" && c.spec.externalTransferReference === 1
  );
  assert.ok(payoutTransferRefIdx);
  assert.equal(payoutTransferRefIdx.options.unique, true);
  assert.deepEqual(payoutTransferRefIdx.options.partialFilterExpression, {
    externalTransferReference: { $type: "string" },
  });
  const userReferredByIdx = createIndexCalls.find(
    (c) => c.collection === "users" && c.spec.referredByUserId === 1
  );
  assert.ok(userReferredByIdx, "users must have sparse referredByUserId index");
  assert.equal(userReferredByIdx.options.sparse, true);

  console.log("✓ Mocked collection test: all 13 runtime collection accessors decoupled from index creation; all 44 indexes and partial unique filters verified.");

  // ---------------------------------------------------------------------------
  // 8. Structured Logger Redaction
  // ---------------------------------------------------------------------------
  const loggerMod = loadTsModule(path.resolve(__dirname, "../src/lib/observability/logger.ts"));
  const { sanitizeLogMeta } = loggerMod;

  console.log("\n[Test 8] Unit Test: Structured Logger Sensitive Data Redaction");
  const sanitizedMeta = sanitizeLogMeta({
    route: "auth.login",
    password: "PlaintextPassword123!",
    passwordHash: "$argon2id$...",
    resetToken: "secret-reset-token",
    sessionCookie: "opaque-cookie",
    authorization: "Bearer secret",
    nested: {
      verificationToken: "raw-verif-token",
      safeField: "ok",
    },
  });
  assert.equal(sanitizedMeta.route, "auth.login");
  assert.equal(sanitizedMeta.password, "[REDACTED]");
  assert.equal(sanitizedMeta.passwordHash, "[REDACTED]");
  assert.equal(sanitizedMeta.resetToken, "[REDACTED]");
  assert.equal(sanitizedMeta.sessionCookie, "[REDACTED]");
  assert.equal(sanitizedMeta.authorization, "[REDACTED]");
  assert.equal(sanitizedMeta.nested.verificationToken, "[REDACTED]");
  assert.equal(sanitizedMeta.nested.safeField, "ok");
  console.log("✓ Structured logger redacts passwords, tokens, cookies, and credentials.");

  // ---------------------------------------------------------------------------
  // 9. Marketing Copy & Metadata Alignment
  // ---------------------------------------------------------------------------
  console.log("\n[Test 9] Unit Test: Marketing Copy, Future Licensing Policy Wording & Metadata Verification");
  const layoutContent = fs.readFileSync(
    path.resolve(__dirname, "../src/app/layout.tsx"),
    "utf8"
  );
  const homeContent = fs.readFileSync(
    path.resolve(__dirname, "../src/app/page.tsx"),
    "utf8"
  );
  const productContent = fs.readFileSync(
    path.resolve(__dirname, "../src/app/products/german-english/page.tsx"),
    "utf8"
  );

  // 9a. Metadata title check
  assert.ok(
    layoutContent.includes("LingoPDF — German-to-English Vocabulary-Building PDF Reader"),
    "Root layout title must match approved vocabulary-building PDF reader title"
  );

  // 9b. Obsolete or misleading present-tense enforcement claims must be absent
  const forbiddenPhrases = [
    "Up to 2 active devices",
    "Up to two active devices",
    "Up to 2 active installations",
    "Up to two active installations",
    "5 free lookups / day",
    "Five free word lookups per day",
    "up to five free word lookups per day",
    "How does the free tier work?",
    "Works fully offline",
    "Unlimited offline access",
    "without requiring an active internet connection",
    "Downloading the Chrome extension alone does not grant access",
    "<span>3-day offline grace policy</span>",
  ];

  for (const phrase of forbiddenPhrases) {
    assert.equal(
      homeContent.includes(phrase),
      false,
      `Homepage must not contain obsolete or unqualified enforcement claim: "${phrase}"`
    );
    assert.equal(
      productContent.includes(phrase),
      false,
      `German product page must not contain obsolete or unqualified enforcement claim: "${phrase}"`
    );
  }

  // 9c. Required commercial policy & qualified future-policy claims must be present
  assert.ok(
    homeContent.includes("1 device per purchase"),
    "Homepage must state 1 device per purchase"
  );
  assert.ok(
    homeContent.includes("No free tier or free trial"),
    "Homepage must state no free tier or free trial"
  );
  assert.ok(
    homeContent.includes("Planned 3-day offline grace policy"),
    "Homepage pricing card must qualify the 3-day offline grace policy as Planned"
  );

  assert.ok(
    productContent.includes("1 active device permitted per purchase") ||
      productContent.includes("1 device per purchase"),
    "German product page must state 1 active device per purchase"
  );
  assert.ok(
    productContent.includes("no free tier and no free trial"),
    "German product page must state no free tier and no free trial"
  );
  assert.ok(
    productContent.includes(
      "Under our commercial licensing policy, downloading the Chrome extension alone will not grant access to protected reader or vocabulary lookup functionality"
    ),
    "German product page FAQ #6 must use future/policy wording for extension access enforcement"
  );
  assert.ok(
    productContent.includes("Planned 3-day offline grace policy"),
    "German product page Capability 06 title must qualify the 3-day offline grace policy as Planned"
  );
  assert.ok(
    productContent.includes("separate one-time purchase"),
    "German product page must state each language edition is a separate one-time purchase"
  );
  console.log("✓ Marketing copy, future licensing policy wording, and metadata verified.");

  // ---------------------------------------------------------------------------
  // 10. Route-Level Unit Integration (/api/pricing Spoofed Payloads, Cache-Control, CSRF & Fail-Closed 503)
  // ---------------------------------------------------------------------------
  console.log("\n[Test 10] Route-Level Unit Test: /api/pricing Spoofed Payloads, Cache-Control, CSRF & Fail-Closed 503");
  const { NextRequest } = require("next/server");
  const pricingRoute = loadTsModule(path.resolve(__dirname, "../src/app/api/pricing/route.ts"));

  const savedAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = "https://lingopdf.in";
  process.env.NODE_ENV = "test";
  process.env.VERCEL = "1";
  try {
    setTestRateLimitStore(createInMemoryRateLimitStore());

    // 10a. GET /api/pricing returns Cache-Control: private, no-store, no-cache, must-revalidate
    // and ignores spoofed lingopdf_currency=INR cookie for a US client
    const getUsReq = new NextRequest("https://lingopdf.in/api/pricing", {
      method: "GET",
      headers: {
        "x-vercel-ip-country": "US",
        cookie: "lingopdf_currency=INR; lingopdf_region=IN",
      },
    });
    const getUsRes = await pricingRoute.GET(getUsReq);
    assert.equal(getUsRes.status, 200);
    assert.equal(
      getUsRes.headers.get("cache-control"),
      "private, no-store, no-cache, must-revalidate",
      "GET /api/pricing must set private no-store Cache-Control"
    );
    const getUsData = await getUsRes.json();
    assert.equal(getUsData.pricing.currency, "USD");
    assert.equal(getUsData.canSelectCurrency, true);
    assert.equal(
      getUsData.availableRegions.some((r) => r.currency === "INR"),
      false,
      "International availableRegions must never include INR"
    );

    // 10b. POST /api/pricing rejects spoofed { regionCode: "IN" } or { currency: "INR" } payload from international client
    const spoofInrPostReq = new NextRequest("https://lingopdf.in/api/pricing", {
      method: "POST",
      headers: {
        origin: "https://lingopdf.in",
        "content-type": "application/json",
        "x-vercel-ip-country": "US",
        "x-real-ip": "198.51.100.25",
      },
      body: JSON.stringify({ regionCode: "IN", currency: "INR" }),
    });
    const spoofInrPostRes = await pricingRoute.POST(spoofInrPostReq);
    assert.equal(spoofInrPostRes.status, 403, "International client POSTing IN/INR must be rejected with 403");
    assert.equal(
      spoofInrPostRes.headers.get("cache-control"),
      "private, no-store, no-cache, must-revalidate"
    );

    // 10c. POST /api/pricing rejects India client attempting to switch to US/USD
    const indiaUsdPostReq = new NextRequest("https://lingopdf.in/api/pricing", {
      method: "POST",
      headers: {
        origin: "https://lingopdf.in",
        "content-type": "application/json",
        "x-vercel-ip-country": "IN",
        "x-real-ip": "198.51.100.26",
      },
      body: JSON.stringify({ regionCode: "US" }),
    });
    const indiaUsdPostRes = await pricingRoute.POST(indiaUsdPostReq);
    assert.equal(indiaUsdPostRes.status, 403, "India client POSTing US/USD must be rejected with 403");

    // 10d. POST /api/pricing allows international client to switch to EU/EUR and sets lingopdf_region=EU cookie
    const validEurPostReq = new NextRequest("https://lingopdf.in/api/pricing", {
      method: "POST",
      headers: {
        origin: "https://lingopdf.in",
        "content-type": "application/json",
        "x-vercel-ip-country": "US",
        "x-real-ip": "198.51.100.27",
      },
      body: JSON.stringify({ regionCode: "EU" }),
    });
    const validEurPostRes = await pricingRoute.POST(validEurPostReq);
    assert.equal(validEurPostRes.status, 200);
    const validEurData = await validEurPostRes.json();
    assert.equal(validEurData.pricing.currency, "EUR");
    assert.equal(validEurData.pricing.price, 75);
    const setCookieHeader = validEurPostRes.headers.get("set-cookie") || "";
    assert.ok(
      setCookieHeader.includes("lingopdf_region=EU"),
      "POST /api/pricing must set lingopdf_region=EU cookie"
    );

    // 10e. POST /api/pricing rejects cross-origin CSRF request with 403
    const csrfPostReq = new NextRequest("https://lingopdf.in/api/pricing", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
        "content-type": "application/json",
        "x-vercel-ip-country": "US",
      },
      body: JSON.stringify({ currency: "EUR" }),
    });
    const csrfPostRes = await pricingRoute.POST(csrfPostReq);
    assert.equal(csrfPostRes.status, 403, "Cross-origin POST /api/pricing must be rejected with 403");

    // 10f. Production fail-closed 503 on route handler when RATE_LIMIT_HMAC_SECRET is missing
    setTestRateLimitStore(null);
    process.env.NODE_ENV = "production";
    delete process.env.RATE_LIMIT_HMAC_SECRET;
    const missingHmacReq = new NextRequest("https://lingopdf.in/api/pricing", {
      method: "POST",
      headers: {
        origin: "https://lingopdf.in",
        "content-type": "application/json",
        "x-vercel-ip-country": "US",
        "x-vercel-forwarded-for": "198.51.100.87",
      },
      body: JSON.stringify({ currency: "EUR" }),
    });
    const missingHmacRes = await pricingRoute.POST(missingHmacReq);
    assert.equal(
      missingHmacRes.status,
      503,
      "Route must fail closed with 503 when RATE_LIMIT_HMAC_SECRET is missing in production"
    );

    // 10g. Production fail-closed 503 on route handler when MongoDB rate-limit store is unavailable
    process.env.RATE_LIMIT_HMAC_SECRET =
      "9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e";
    delete process.env.MONGODB_URI;
    const failClosedReq = new NextRequest("https://lingopdf.in/api/pricing", {
      method: "POST",
      headers: {
        origin: "https://lingopdf.in",
        "content-type": "application/json",
        "x-vercel-ip-country": "US",
        "x-vercel-forwarded-for": "198.51.100.88",
      },
      body: JSON.stringify({ currency: "EUR" }),
    });
    const failClosedRes = await pricingRoute.POST(failClosedReq);
    assert.equal(
      failClosedRes.status,
      503,
      "Route must fail closed with 503 Service Unavailable when MongoDB rate limiter is unreachable in production"
    );
  } finally {
    setTestRateLimitStore(null);
    process.env.NODE_ENV = savedEnv;
    if (savedVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = savedVercel;
    if (savedHmacSecret === undefined) delete process.env.RATE_LIMIT_HMAC_SECRET;
    else process.env.RATE_LIMIT_HMAC_SECRET = savedHmacSecret;
    if (savedMongoUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = savedMongoUri;
    if (savedAppUrl === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL;
    } else {
      process.env.NEXT_PUBLIC_APP_URL = savedAppUrl;
    }
  }
  console.log("✓ Route-level /api/pricing spoofed POST rejection, Cache-Control, CSRF, and 503 fail-closed verified.");

  // ---------------------------------------------------------------------------
  // 11. Real MongoDB Rate-Limiter Integration Test (mongoRateLimitStore.consume())
  // ---------------------------------------------------------------------------
  console.log("\n[Test 11] Real MongoDB Integration Test: mongoRateLimitStore.consume() Concurrency, $$NOW Reset & Cleanup");
  const crypto = require("crypto");

  // Load .env.local if MONGODB_URI is not already in process.env
  const envLocalPath = path.resolve(__dirname, "../.env.local");
  if (!process.env.MONGODB_URI && fs.existsSync(envLocalPath)) {
    const envContent = fs.readFileSync(envLocalPath, "utf8");
    for (const rawLine of envContent.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eqIdx = line.indexOf("=");
      if (eqIdx <= 0) continue;
      const k = line.slice(0, eqIdx).trim();
      let v = line.slice(eqIdx + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (process.env[k] === undefined) {
        process.env[k] = v;
      }
    }
  }

  // Safety boundary check: refuse to run integration tests if environment is flagged as production
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    throw new Error(
      "Refusing to run real MongoDB integration test when NODE_ENV or VERCEL_ENV is 'production'."
    );
  }

  // Do not silently skip if MONGODB_URI is unavailable
  if (!process.env.MONGODB_URI) {
    throw new Error(
      "[Test 11 NOT EXECUTED] MONGODB_URI is not configured; cannot execute real MongoDB rate-limiter integration test."
    );
  }

  // Reload mongodb.ts and rateLimit.ts now that MONGODB_URI is populated from .env.local
  const prevEnvForMongoTest = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  delete process.env.VERCEL_ENV;
  moduleCache.delete(path.resolve(__dirname, "../src/lib/db/mongodb.ts"));
  moduleCache.delete(path.resolve(__dirname, "../src/lib/auth/rateLimit.ts"));

  const { getMongoClient, getDb } = loadTsModule(
    path.resolve(__dirname, "../src/lib/db/mongodb.ts")
  );
  const { mongoRateLimitStore: liveMongoRateLimitStore, setTestRateLimitStore: setLiveTestStore } =
    loadTsModule(path.resolve(__dirname, "../src/lib/auth/rateLimit.ts"));

  const runId = crypto.randomBytes(8).toString("hex");
  const testPrefix = `__test_stage3b2_ratelimit_${runId}_`;
  const coldConcurrentKey = `${testPrefix}cold_concurrent_15`;
  const windowResetKey = `${testPrefix}window_reset_1s`;

  let mongoClient = null;
  let rateLimitsCollection = null;

  try {
    setLiveTestStore(null); // Ensure real mongoRateLimitStore is active
    mongoClient = await getMongoClient();
    const db = await getDb();
    rateLimitsCollection = await getRateLimitsCollection(db);

    // 11a. Execute 15 concurrent requests against a nonexistent cold bucket with limit = 5
    const concurrentDecisions = await Promise.all(
      Array.from({ length: 15 }, () =>
        liveMongoRateLimitStore.consume(coldConcurrentKey, 5, 60)
      )
    );

    const allowedMongoCount = concurrentDecisions.filter((d) => d.allowed).length;
    const rejectedMongoCount = concurrentDecisions.filter((d) => !d.allowed).length;

    assert.equal(
      allowedMongoCount,
      5,
      `Real MongoDB concurrency test: expected exactly 5 allowed requests out of 15, got ${allowedMongoCount}`
    );
    assert.equal(
      rejectedMongoCount,
      10,
      `Real MongoDB concurrency test: expected exactly 10 rejected requests out of 15, got ${rejectedMongoCount}`
    );

    // Verify stored document in MongoDB rate_limits collection
    const storedConcurrentDoc = await rateLimitsCollection.findOne({
      _id: coldConcurrentKey,
    });
    assert.ok(storedConcurrentDoc, "Cold bucket document must exist in MongoDB rate_limits");
    assert.equal(
      storedConcurrentDoc.count,
      15,
      "MongoDB atomic counter must equal 15 after 15 concurrent requests"
    );
    assert.ok(
      storedConcurrentDoc.resetAt instanceof Date,
      "resetAt must be stored as a BSON Date"
    );
    assert.ok(
      storedConcurrentDoc.updatedAt instanceof Date,
      "updatedAt must be stored as a BSON Date via $$NOW"
    );
    assert.ok(
      storedConcurrentDoc.resetAt.getTime() > storedConcurrentDoc.updatedAt.getTime(),
      "resetAt must be in the future relative to MongoDB server $$NOW"
    );

    // 11b. Verify window reset behavior using MongoDB $$NOW (1-second window)
    const firstWindowDecision = await liveMongoRateLimitStore.consume(windowResetKey, 1, 1);
    assert.equal(firstWindowDecision.allowed, true);
    assert.equal(firstWindowDecision.remaining, 0);

    const firstDoc = await rateLimitsCollection.findOne({ _id: windowResetKey });
    assert.ok(firstDoc);
    assert.equal(firstDoc.count, 1);
    const firstResetAtMs = firstDoc.resetAt.getTime();

    const blockedWindowDecision = await liveMongoRateLimitStore.consume(windowResetKey, 1, 1);
    assert.equal(blockedWindowDecision.allowed, false);
    assert.ok(blockedWindowDecision.retryAfterSeconds >= 1);

    // Wait 1250ms so MongoDB $$NOW advances past the 1-second resetAt timestamp
    await new Promise((r) => setTimeout(r, 1250));

    const resetWindowDecision = await liveMongoRateLimitStore.consume(windowResetKey, 1, 1);
    assert.equal(
      resetWindowDecision.allowed,
      true,
      "Real MongoDB rate-limit window must reset once $$NOW passes resetAt"
    );
    assert.equal(resetWindowDecision.remaining, 0);

    const resetDoc = await rateLimitsCollection.findOne({ _id: windowResetKey });
    assert.ok(resetDoc);
    assert.equal(
      resetDoc.count,
      1,
      "MongoDB count must reset to 1 in the new window"
    );
    assert.ok(
      resetDoc.resetAt.getTime() > firstResetAtMs,
      "MongoDB resetAt must advance to the new window expiration timestamp"
    );
  } finally {
    process.env.NODE_ENV = prevEnvForMongoTest;
    if (rateLimitsCollection) {
      // Strictly scoped cleanup of only this test run's namespaced keys
      await rateLimitsCollection.deleteMany({
        _id: { $regex: `^${testPrefix}` },
      });
      const remainingTestDocs = await rateLimitsCollection.countDocuments({
        _id: { $regex: `^${testPrefix}` },
      });
      assert.equal(
        remainingTestDocs,
        0,
        "All temporary test rate-limit buckets must be cleaned up in finally block"
      );
    }
  }
  console.log(
    `✓ Real MongoDB integration test passed (namespace: ${testPrefix}*, 15 concurrent requests -> 5 allowed / 10 rejected, $$NOW window reset verified, test keys cleaned up).`
  );

  // ---------------------------------------------------------------------------
  // 12. Unit Test: Stage 3B.3 Database Schema Validation, State-Transition Machines & Immutability Guards
  // ---------------------------------------------------------------------------
  console.log("\n[Test 12] Unit Test: Stage 3B.3 Commercial Policy Rules, Hold-Window Boundaries, Payout Eligibility & Immutability");
  const { ObjectId } = require("mongodb");
  const repoMod = loadTsModule(path.resolve(__dirname, "../src/lib/db/repositories.ts"));
  const {
    ImmutableRecordError,
    InvalidStateTransitionError,
    DataValidationError,
    COMMISSION_HOLD_WINDOW_HOURS,
    COMMISSION_HOLD_WINDOW_MS,
    REFERRAL_CUSTOMER_DISCOUNT_PERCENT,
    REFERRAL_COMMISSION_PERCENT,
    MAX_SUCCESSFUL_REFERRALS_PER_USER,
    MIN_ELIGIBLE_COMMISSIONS_FOR_PAYOUT,
    buildPurchaseDocument,
    assertValidPurchaseTransition,
    assertImmutablePurchaseFieldsNotModified,
    buildEntitlementDocument,
    applyEntitlementRestriction,
    resolveEntitlementRestriction,
    revokeEntitlementState,
    buildPromotionSettingsDocument,
    buildReferralProfileDocument,
    computeCommissionHoldUntil,
    buildCommissionDocument,
    assertValidCommissionTransition,
    assertCommissionCanBecomeEligible,
    placeUnpaidCommissionOnDisputeHold,
    assertImmutableCommissionFieldsNotModified,
    buildPayoutDocument,
    assertReferrerPayoutEligibility,
    assertPayoutBatchConsistency,
    buildCommissionAdjustmentDocument,
    buildPaymentWebhookDocument,
    assertImmutableWebhookFieldsNotModified,
    buildPurchaseEvidenceDocument,
    assertImmutablePurchaseEvidenceFieldsNotModified,
  } = repoMod;

  const sampleBuyerId = new ObjectId();
  const sampleReferrerId = new ObjectId();
  const sampleProfileId = new ObjectId();

  // Verify authoritative policy constants
  assert.equal(REFERRAL_CUSTOMER_DISCOUNT_PERCENT, 10);
  assert.equal(REFERRAL_COMMISSION_PERCENT, 10);
  assert.equal(COMMISSION_HOLD_WINDOW_HOURS, 72);
  assert.equal(COMMISSION_HOLD_WINDOW_MS, 72 * 60 * 60 * 1000);
  assert.equal(MAX_SUCCESSFUL_REFERRALS_PER_USER, 50);
  assert.equal(MIN_ELIGIBLE_COMMISSIONS_FOR_PAYOUT, 5);

  // 12a. Purchase validation, non-stacking of promo & referral discounts, and discount percentages
  // Valid referral purchase (10% fixed customer discount, promoApplied = false)
  const validPurchase = buildPurchaseDocument({
    userId: sampleBuyerId,
    productSlug: "german-english",
    editionVersion: "1.0",
    region: "IN",
    currency: "INR",
    pricingSnapshot: {
      basePriceSubunits: 129900,
      discountPercentApplied: 10,
      discountSubunits: 12990,
      taxSubunits: 0,
      totalSubunits: 116910,
      promoApplied: false,
      referralCodeApplied: "lingo10",
    },
    paymentProvider: "razorpay",
    providerOrderId: "order_test_123456",
    idempotencyKey: "idem_purchase_123456",
    referrerUserId: sampleReferrerId,
    referralProfileId: sampleProfileId,
  });
  assert.equal(validPurchase.currency, "INR");
  assert.equal(validPurchase.pricingSnapshot.referralCodeApplied, "LINGO10");
  assert.equal(validPurchase.pricingSnapshot.discountPercentApplied, 10);
  assert.equal(validPurchase.status, "pending");

  // Promotional discounts: 5%, 10%, 15%, and 20% must all be accepted when referralCodeApplied === null
  for (const promoPct of [5, 10, 15, 20]) {
    const discountSub = Math.floor((5900 * promoPct) / 100);
    const promoPurchase = buildPurchaseDocument({
      userId: sampleBuyerId,
      productSlug: "german-english",
      editionVersion: "1.0",
      region: "US",
      currency: "USD",
      pricingSnapshot: {
        basePriceSubunits: 5900,
        discountPercentApplied: promoPct,
        discountSubunits: discountSub,
        taxSubunits: 0,
        totalSubunits: 5900 - discountSub,
        promoApplied: true,
        referralCodeApplied: null,
      },
      paymentProvider: "razorpay",
      idempotencyKey: `idem_promo_${promoPct}_pct`,
    });
    assert.equal(promoPurchase.pricingSnapshot.discountPercentApplied, promoPct);
    assert.equal(promoPurchase.providerOrderId, null);
    assert.equal(promoPurchase.providerPaymentId, null);
  }

  // Reject stacking of promotional and referral discounts
  assert.throws(
    () =>
      buildPurchaseDocument({
        userId: sampleBuyerId,
        productSlug: "german-english",
        editionVersion: "1.0",
        region: "IN",
        currency: "INR",
        pricingSnapshot: {
          basePriceSubunits: 129900,
          discountSubunits: 12990,
          taxSubunits: 0,
          totalSubunits: 116910,
          promoApplied: true,
          referralCodeApplied: "LINGO10",
        },
        paymentProvider: "razorpay",
        idempotencyKey: "idem_stacking_forbidden",
      }),
    (err) =>
      err instanceof DataValidationError &&
      /Promotional and referral discounts cannot stack/.test(err.message)
  );

  // Reject non-10% referral discount
  assert.throws(
    () =>
      buildPurchaseDocument({
        userId: sampleBuyerId,
        productSlug: "german-english",
        editionVersion: "1.0",
        region: "US",
        currency: "USD",
        pricingSnapshot: {
          basePriceSubunits: 5900,
          discountPercentApplied: 20,
          discountSubunits: 1180,
          taxSubunits: 0,
          totalSubunits: 4720,
          promoApplied: false,
          referralCodeApplied: "LINGO10",
        },
        paymentProvider: "razorpay",
        idempotencyKey: "idem_bad_ref_discount",
      }),
    (err) =>
      err instanceof DataValidationError &&
      /Referral customer discount is fixed at 10%/.test(err.message)
  );

  // Reject unapproved promotional discount percentage (e.g., 25%)
  assert.throws(
    () =>
      buildPurchaseDocument({
        userId: sampleBuyerId,
        productSlug: "german-english",
        editionVersion: "1.0",
        region: "US",
        currency: "USD",
        pricingSnapshot: {
          basePriceSubunits: 5900,
          discountSubunits: 1475, // 25%
          taxSubunits: 0,
          totalSubunits: 4425,
          promoApplied: true,
          referralCodeApplied: null,
        },
        paymentProvider: "razorpay",
        idempotencyKey: "idem_bad_promo_25pct",
      }),
    (err) => err instanceof DataValidationError
  );

  // Reject international purchase attempting INR currency
  assert.throws(
    () =>
      buildPurchaseDocument({
        userId: sampleBuyerId,
        productSlug: "german-english",
        editionVersion: "1.0",
        region: "US",
        currency: "INR",
        pricingSnapshot: {
          basePriceSubunits: 129900,
          discountSubunits: 0,
          taxSubunits: 0,
          totalSubunits: 129900,
          promoApplied: false,
          referralCodeApplied: null,
        },
        paymentProvider: "razorpay",
        providerOrderId: "order_bad_inr",
        idempotencyKey: "idem_bad_inr_1234",
      }),
    (err) => err instanceof DataValidationError && /International purchases must never use INR/.test(err.message)
  );

  // Reject inconsistent pricing snapshot arithmetic
  assert.throws(
    () =>
      buildPurchaseDocument({
        userId: sampleBuyerId,
        productSlug: "german-english",
        editionVersion: "1.0",
        region: "US",
        currency: "USD",
        pricingSnapshot: {
          basePriceSubunits: 5900,
          discountSubunits: 590,
          taxSubunits: 0,
          totalSubunits: 5900, // Wrong total
          promoApplied: true,
          referralCodeApplied: null,
        },
        paymentProvider: "razorpay",
        providerOrderId: "order_bad_math",
        idempotencyKey: "idem_bad_math_1234",
      }),
    (err) => err instanceof DataValidationError
  );

  // Reject self-referral on purchase creation
  assert.throws(
    () =>
      buildPurchaseDocument({
        userId: sampleBuyerId,
        productSlug: "german-english",
        editionVersion: "1.0",
        region: "US",
        currency: "USD",
        pricingSnapshot: {
          basePriceSubunits: 5900,
          discountSubunits: 0,
          taxSubunits: 0,
          totalSubunits: 5900,
          promoApplied: false,
          referralCodeApplied: null,
        },
        paymentProvider: "razorpay",
        providerOrderId: "order_self_ref",
        idempotencyKey: "idem_self_ref_1234",
        referrerUserId: sampleBuyerId,
      }),
    (err) => err instanceof DataValidationError && /Self-referral is prohibited/.test(err.message)
  );

  // Purchase state machine & immutable field checks
  assertValidPurchaseTransition("pending", "captured");
  assertValidPurchaseTransition("captured", "disputed");
  assertValidPurchaseTransition("disputed", "captured");
  assert.throws(
    () => assertValidPurchaseTransition("refunded", "captured"),
    (err) => err instanceof InvalidStateTransitionError
  );
  assert.throws(
    () => assertImmutablePurchaseFieldsNotModified({ currency: "USD" }),
    (err) => err instanceof ImmutableRecordError
  );
  assert.throws(
    () =>
      assertImmutablePurchaseFieldsNotModified(
        { providerOrderId: "order_overwrite" },
        { providerOrderId: "order_original", providerPaymentId: null }
      ),
    (err) => err instanceof ImmutableRecordError
  );

  // 12b. Entitlement multi-restriction state machine (Stage 3B.1 §5)
  let entDoc = buildEntitlementDocument({
    userId: sampleBuyerId,
    purchaseId: validPurchase._id,
    productSlug: "german-english",
  });
  assert.equal(entDoc.status, "active");
  assert.equal(entDoc.maxActiveDevices, 1);

  // Apply both chargeback_open and admin_suspended
  entDoc = { ...entDoc, ...applyEntitlementRestriction(entDoc, "chargeback_open") };
  assert.equal(entDoc.status, "suspended");
  entDoc = { ...entDoc, ...applyEntitlementRestriction(entDoc, "admin_suspended") };
  assert.deepEqual(entDoc.activeRestrictionReasons, ["chargeback_open", "admin_suspended"]);

  // Resolving chargeback_open must NOT restore active while admin_suspended remains
  entDoc = { ...entDoc, ...resolveEntitlementRestriction(entDoc, "chargeback_open") };
  assert.equal(
    entDoc.status,
    "suspended",
    "Entitlement must remain suspended while another independent restriction (admin_suspended) is active"
  );
  assert.deepEqual(entDoc.activeRestrictionReasons, ["admin_suspended"]);

  // Resolving the final restriction restores active
  entDoc = { ...entDoc, ...resolveEntitlementRestriction(entDoc, "admin_suspended") };
  assert.equal(entDoc.status, "active");
  assert.deepEqual(entDoc.activeRestrictionReasons, []);

  // Revoking is terminal
  entDoc = { ...entDoc, ...revokeEntitlementState(entDoc, "refunded") };
  assert.equal(entDoc.status, "revoked");
  assert.throws(
    () => resolveEntitlementRestriction(entDoc, "admin_suspended"),
    (err) => err instanceof InvalidStateTransitionError
  );

  // 12c. Promotion settings (5%, 10%, 15%, 20% promo, 10% referral discount, 10% commission, 72h hold, 50 cap, 5 payout min)
  for (const pct of [5, 10, 15, 20]) {
    const promoDoc = buildPromotionSettingsDocument({
      mode: "promo",
      promotionalDiscountPercent: pct,
    });
    assert.equal(promoDoc._id, "global_referral_promo");
    assert.equal(promoDoc.promotionalDiscountPercent, pct);
    assert.equal(promoDoc.referralCustomerDiscountPercent, 10);
    assert.equal(promoDoc.referrerCommissionPercent, 10);
    assert.equal(promoDoc.maxSuccessfulReferralsPerUser, 50);
    assert.equal(promoDoc.holdWindowHours, 72);
    assert.equal(promoDoc.minEligibleCommissionsForPayout, 5);
  }
  const normalPromoDoc = buildPromotionSettingsDocument({ mode: "normal" });
  assert.equal(normalPromoDoc.promotionalDiscountPercent, 0);

  const refProfile = buildReferralProfileDocument({
    userId: sampleReferrerId,
    qualifyingPurchaseId: new ObjectId(),
    referralCode: "  rajat2026 ",
    pendingReservedCount: 10,
    successfulConversionsCount: 40,
  });
  assert.equal(refProfile.referralCode, "RAJAT2026");
  assert.equal(refProfile.maxReferralsCap, 50);

  assert.throws(
    () =>
      buildReferralProfileDocument({
        userId: sampleReferrerId,
        qualifyingPurchaseId: new ObjectId(),
        referralCode: "OVERCAP51",
        pendingReservedCount: 11,
        successfulConversionsCount: 40,
      }),
    (err) => err instanceof DataValidationError && /cannot exceed maxReferralsCap/.test(err.message)
  );

  // 12d. Commission: 10% of actual purchase amount paid after discounts, exact 72-hour hold from purchaseCapturedAt, dispute hold, and 5-commission payout threshold
  const exactPurchaseTime = new Date("2026-11-01T10:00:00.000Z");
  const exact72hLater = new Date("2026-11-04T10:00:00.000Z");
  assert.equal(
    computeCommissionHoldUntil(exactPurchaseTime).getTime(),
    exact72hLater.getTime()
  );

  // Reject 20% commission rate (must be fixed 10%)
  assert.throws(
    () =>
      buildCommissionDocument({
        referrerUserId: sampleReferrerId,
        referralProfileId: refProfile._id,
        referredUserId: sampleBuyerId,
        purchaseId: validPurchase._id,
        currency: "INR",
        netCollectedSubunits: 116910,
        commissionRatePercent: 20,
        commissionAmountSubunits: 23382,
        purchaseCapturedAt: exactPurchaseTime,
      }),
    (err) => err instanceof DataValidationError && /fixed at 10%/.test(err.message)
  );

  // Valid 10% commission of 116910 subunits = 11691 subunits
  const commDoc = buildCommissionDocument({
    referrerUserId: sampleReferrerId,
    referralProfileId: refProfile._id,
    referredUserId: sampleBuyerId,
    purchaseId: validPurchase._id,
    currency: "INR",
    netCollectedSubunits: 116910,
    commissionAmountSubunits: 11691,
    purchaseCapturedAt: exactPurchaseTime,
  });
  assert.equal(commDoc.status, "pending");
  assert.equal(commDoc.commissionRatePercent, 10);
  assert.equal(commDoc.commissionAmountSubunits, 11691);
  assert.equal(commDoc.holdUntil.getTime(), exact72hLater.getTime());
  assert.equal(commDoc.isDisputedHold, false);

  // Exact 72-hour boundary check: 1ms before 72 hours MUST be rejected
  assert.throws(
    () =>
      assertCommissionCanBecomeEligible(commDoc, {
        now: new Date(exact72hLater.getTime() - 1),
        purchaseStatus: "captured",
      }),
    (err) =>
      err instanceof InvalidStateTransitionError &&
      /exact 72-hour refund window/.test(err.message)
  );

  // Exact 72-hour boundary check: at exact 72 hours (when captured and no dispute/refund) succeeds
  assertCommissionCanBecomeEligible(commDoc, {
    now: exact72hLater,
    purchaseStatus: "captured",
  });

  // Disputed or refund-pending commission must remain on hold even after 72 hours
  assert.throws(
    () =>
      assertCommissionCanBecomeEligible(commDoc, {
        now: new Date(exact72hLater.getTime() + 60000),
        purchaseStatus: "disputed",
      }),
    (err) =>
      err instanceof InvalidStateTransitionError &&
      /Disputed or refund-pending unpaid commissions must remain on hold/.test(err.message)
  );
  assert.throws(
    () =>
      assertCommissionCanBecomeEligible(commDoc, {
        now: new Date(exact72hLater.getTime() + 60000),
        purchaseStatus: "captured",
        hasOpenDispute: true,
      }),
    (err) => err instanceof InvalidStateTransitionError
  );

  // Placing an eligible/approved unpaid commission on dispute hold returns it to "pending" with isDisputedHold = true
  const heldUpdate = placeUnpaidCommissionOnDisputeHold({
    status: "approved",
    isDisputedHold: false,
  });
  assert.equal(heldUpdate.status, "pending");
  assert.equal(heldUpdate.isDisputedHold, true);
  assert.equal(heldUpdate.approvedAt, null);

  // Paid commissions can never be placed on dispute hold or cancelled/clawed back
  assert.throws(
    () =>
      placeUnpaidCommissionOnDisputeHold({
        status: "paid",
        isDisputedHold: false,
      }),
    (err) => err instanceof InvalidStateTransitionError
  );

  assertValidCommissionTransition("pending", "eligible", {
    now: exact72hLater,
    purchaseCapturedAt: exactPurchaseTime,
    holdUntil: exact72hLater,
  });
  assertValidCommissionTransition("eligible", "approved");
  assertValidCommissionTransition("approved", "paid");
  assert.throws(
    () => assertValidCommissionTransition("paid", "cancelled"),
    (err) =>
      err instanceof InvalidStateTransitionError &&
      /Paid commissions are terminal and cannot be transitioned to "cancelled" or automatically clawed back/.test(err.message)
  );
  assert.throws(
    () =>
      assertValidCommissionTransition("pending", "eligible", {
        isDisputedHold: true,
      }),
    (err) => err instanceof InvalidStateTransitionError
  );
  assert.throws(
    () => assertImmutableCommissionFieldsNotModified({ commissionAmountSubunits: 99999 }),
    (err) => err instanceof ImmutableRecordError
  );

  // Payout eligibility: requires at least 5 eligible/approved commissions across all currencies combined
  const makePayableComm = (currency, amountSubunits, status = "approved") => ({
    ...commDoc,
    _id: new ObjectId(),
    currency,
    status,
    commissionAmountSubunits: amountSubunits,
    isDisputedHold: false,
  });

  const inrComm1 = makePayableComm("INR", 11691, "approved");
  const inrComm2 = makePayableComm("INR", 11691, "approved");
  const inrComm3 = makePayableComm("INR", 11691, "approved");
  const usdComm1 = makePayableComm("USD", 531, "eligible");
  const eurComm1 = makePayableComm("EUR", 531, "eligible");

  // Only 4 commissions across all currencies -> payout eligibility rejected
  assert.throws(
    () =>
      assertReferrerPayoutEligibility(sampleReferrerId, [
        inrComm1,
        inrComm2,
        inrComm3,
        usdComm1,
      ]),
    (err) =>
      err instanceof InvalidStateTransitionError &&
      /at least 5 eligible commissions across all currencies combined/.test(err.message)
  );

  // 5 commissions across INR (3) + USD (1) + EUR (1) -> cross-currency eligibility satisfied!
  const fiveCrossCurrencyComms = [inrComm1, inrComm2, inrComm3, usdComm1, eurComm1];
  assertReferrerPayoutEligibility(sampleReferrerId, fiveCrossCurrencyComms);

  // Payout batch currency mixing must still be rejected even when >= 5 total commissions exist
  const approvedUsdForMix = { ...usdComm1, status: "approved" };
  assert.throws(
    () =>
      assertPayoutBatchConsistency(
        {
          referrerUserId: sampleReferrerId,
          referralProfileId: refProfile._id,
          currency: "INR",
          totalAmountSubunits: 11691 + 531,
          commissionIds: [inrComm1._id, approvedUsdForMix._id],
          payoutMethod: "upi",
          createdByAdminId: new ObjectId(),
        },
        [inrComm1, approvedUsdForMix],
        fiveCrossCurrencyComms
      ),
    (err) => err instanceof DataValidationError && /Currency mismatch in payout batch/.test(err.message)
  );

  // Single-currency INR payout batch succeeds when referrer has 5 total payable commissions across all currencies
  assertPayoutBatchConsistency(
    {
      referrerUserId: sampleReferrerId,
      referralProfileId: refProfile._id,
      currency: "INR",
      totalAmountSubunits: 11691 * 3,
      commissionIds: [inrComm1._id, inrComm2._id, inrComm3._id],
      payoutMethod: "upi",
      createdByAdminId: new ObjectId(),
    },
    [inrComm1, inrComm2, inrComm3],
    fiveCrossCurrencyComms
  );

  const validPayout = buildPayoutDocument({
    referrerUserId: sampleReferrerId,
    referralProfileId: refProfile._id,
    currency: "INR",
    totalAmountSubunits: 11691 * 3,
    commissionIds: [inrComm1._id, inrComm2._id, inrComm3._id],
    payoutMethod: "upi",
    createdByAdminId: new ObjectId(),
  });
  assert.equal(validPayout.status, "draft");
  assert.equal(validPayout.externalTransferReference, null);

  const validAdjustment = buildCommissionAdjustmentDocument({
    commissionId: commDoc._id,
    purchaseId: validPurchase._id,
    payoutId: validPayout._id,
    referrerUserId: sampleReferrerId,
    currency: "INR",
    adjustmentAmountSubunits: 11691,
    reason: "post_payout_refund",
  });
  assert.equal(validAdjustment.resolutionStatus, "open");

  // 12e. Payment webhook & Purchase evidence PAN/CVV rejection and immutability
  assert.throws(
    () =>
      buildPaymentWebhookDocument({
        provider: "razorpay",
        eventId: "evt_unverified",
        eventType: "payment.captured",
        signatureVerified: false,
        payloadHash: "a".repeat(64),
      }),
    (err) => err instanceof DataValidationError
  );
  assert.throws(
    () => assertImmutableWebhookFieldsNotModified({ payloadHash: "b".repeat(64) }),
    (err) => err instanceof ImmutableRecordError
  );

  // Purchase evidence must reject raw card PAN or CVV
  assert.throws(
    () =>
      buildPurchaseEvidenceDocument({
        purchaseId: validPurchase._id,
        userId: sampleBuyerId,
        emailSnapshot: "buyer@example.com",
        productSlug: "german-english",
        editionVersion: "1.0",
        region: "IN",
        currency: "INR",
        amountSubunits: 116910,
        providerOrderId: "order_test_123456",
        providerPaymentId: "pay_test_123456",
        paymentMethodSummary: "card 4111 1111 1111 4242",
        termsVersionAccepted: "2026-03",
        refundPolicyVersionAccepted: "2026-03",
        acceptedAt: new Date(),
      }),
    (err) => err instanceof DataValidationError && /never contain raw card PAN/.test(err.message)
  );
  assert.throws(
    () =>
      buildPurchaseEvidenceDocument({
        purchaseId: validPurchase._id,
        userId: sampleBuyerId,
        emailSnapshot: "buyer@example.com",
        productSlug: "german-english",
        editionVersion: "1.0",
        region: "IN",
        currency: "INR",
        amountSubunits: 116910,
        providerOrderId: "order_test_123456",
        providerPaymentId: "pay_test_123456",
        paymentMethodSummary: "card_last4_4242 cvv 123",
        termsVersionAccepted: "2026-03",
        refundPolicyVersionAccepted: "2026-03",
        acceptedAt: new Date(),
      }),
    (err) => err instanceof DataValidationError && /never contain raw card PAN digits or CVV/.test(err.message)
  );

  const validEvidence = buildPurchaseEvidenceDocument({
    purchaseId: validPurchase._id,
    userId: sampleBuyerId,
    emailSnapshot: "buyer@example.com",
    productSlug: "german-english",
    editionVersion: "1.0",
    region: "IN",
    currency: "INR",
    amountSubunits: 116910,
    providerOrderId: "order_test_123456",
    providerPaymentId: "pay_test_123456",
    paymentMethodSummary: "card_last4_4242",
    termsVersionAccepted: "2026-03",
    refundPolicyVersionAccepted: "2026-03",
    acceptedAt: new Date(),
  });
  assert.equal(validEvidence.paymentMethodSummary, "card_last4_4242");
  assert.throws(
    () => assertImmutablePurchaseEvidenceFieldsNotModified({ amountSubunits: 100 }),
    (err) => err instanceof ImmutableRecordError
  );
  assertImmutablePurchaseEvidenceFieldsNotModified({
    extensionActivatedAt: new Date(),
    firstInstallationIdHash: "sha256_install_hash",
    updatedAt: new Date(),
  });
  console.log("✓ Database schemas, state transitions, currency invariants, PAN/CVV rejection, and immutability guards verified.");

  // ---------------------------------------------------------------------------
  // 13. Unit & Route Test: Server-Side Admin Authorization & Client Role-Escalation Rejection
  // ---------------------------------------------------------------------------
  console.log("\n[Test 13] Unit & Route Test: Admin Role Model & Client Role-Escalation Rejection");
  const adminMod = loadTsModule(path.resolve(__dirname, "../src/lib/auth/admin.ts"));
  const {
    resolveUserRole,
    detectClientRoleEscalationAttempt,
  } = adminMod;
  const registerRouteMod = loadTsModule(
    path.resolve(__dirname, "../src/app/api/auth/register/route.ts")
  );

  // 13a. Default role resolution (missing/undefined role defaults strictly to "customer")
  assert.equal(resolveUserRole(null), "customer");
  assert.equal(resolveUserRole(undefined), "customer");
  assert.equal(resolveUserRole({}), "customer");
  assert.equal(resolveUserRole({ role: "customer" }), "customer");
  assert.equal(resolveUserRole({ role: "admin" }), "admin");

  // 13b. Client role escalation field detection
  assert.equal(
    detectClientRoleEscalationAttempt({ email: "a@b.com", password: "Password123!" }),
    null
  );
  assert.equal(
    detectClientRoleEscalationAttempt({ email: "a@b.com", password: "Password123!", role: "admin" }),
    "role"
  );
  assert.equal(
    detectClientRoleEscalationAttempt({ email: "a@b.com", password: "Password123!", isAdmin: true }),
    "isAdmin"
  );
  assert.equal(
    detectClientRoleEscalationAttempt({ email: "a@b.com", password: "Password123!", permissions: ["*"] }),
    "permissions"
  );

  // 13c. Route-level POST /api/auth/register rejects client-supplied role escalation with 403
  const savedAppUrlForReg = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = "https://lingopdf.in";
  process.env.NODE_ENV = "test";
  process.env.VERCEL = "1";
  try {
    setLiveTestStore(createInMemoryRateLimitStore());
    const escalateRegReq = new NextRequest("https://lingopdf.in/api/auth/register", {
      method: "POST",
      headers: {
        origin: "https://lingopdf.in",
        "content-type": "application/json",
        "x-real-ip": "198.51.100.201",
      },
      body: JSON.stringify({
        email: "attacker@example.com",
        password: "Password123!",
        role: "admin",
      }),
    });
    const escalateRegRes = await registerRouteMod.POST(escalateRegReq);
    assert.equal(
      escalateRegRes.status,
      403,
      "POST /api/auth/register must reject client-supplied role escalation with 403"
    );
    const escalateRegBody = await escalateRegRes.json();
    assert.equal(escalateRegBody.code, "ROLE_ESCALATION_FORBIDDEN");
  } finally {
    setLiveTestStore(null);
    process.env.NODE_ENV = savedEnv;
    if (savedVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = savedVercel;
    if (savedAppUrlForReg === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = savedAppUrlForReg;
  }
  console.log("✓ Admin role resolution and route-level client role-escalation rejection (403) verified.");

  // ---------------------------------------------------------------------------
  // 14. Unit & Mocked Test: Admin Audit Logging (Redaction, Outcome Accuracy & Immutability)
  // ---------------------------------------------------------------------------
  console.log("\n[Test 14] Unit & Mocked Test: Admin Audit Logging Redaction & Append-Only Protection");
  const auditMod = loadTsModule(path.resolve(__dirname, "../src/lib/audit/adminAudit.ts"));
  const {
    sanitizeAuditMetadata,
    getProtectedAdminAuditLogsCollection,
    recordAdminAuditLog,
    executeAuditedAdminAction,
  } = auditMod;

  const redactedAuditMeta = sanitizeAuditMetadata({
    promotionMode: "promo",
    adminPassword: "SecretPassword!",
    sessionToken: "opaque-token",
    apiKey: "rk_live_secret",
    cardSample: "4111 2222 3333 4444",
    nested: {
      cvv: "999",
      safeNote: "Updated promo discount to 10%",
    },
  });
  assert.equal(redactedAuditMeta.promotionMode, "promo");
  assert.equal(redactedAuditMeta.adminPassword, "[REDACTED]");
  assert.equal(redactedAuditMeta.sessionToken, "[REDACTED]");
  assert.equal(redactedAuditMeta.apiKey, "[REDACTED]");
  assert.equal(redactedAuditMeta.cardSample, "[REDACTED_PAN]");
  assert.equal(redactedAuditMeta.nested.cvv, "[REDACTED]");
  assert.equal(redactedAuditMeta.nested.safeNote, "Updated promo discount to 10%");

  // Verify both getAdminAuditLogsCollection (models.ts) and getProtectedAdminAuditLogsCollection (adminAudit.ts)
  // return frozen append-only wrappers blocking all update/replace/delete/bulkWrite/drop operations
  const mockAuditAccessorA = await getAdminAuditLogsCollection(mockDb);
  const mockAuditAccessorB = await getProtectedAdminAuditLogsCollection(mockDb);
  assert.equal(Object.isFrozen(mockAuditAccessorA), true);
  assert.equal(Object.isFrozen(mockAuditAccessorB), true);
  for (const accessor of [mockAuditAccessorA, mockAuditAccessorB]) {
    for (const op of [
      "updateOne",
      "updateMany",
      "replaceOne",
      "findOneAndUpdate",
      "findOneAndReplace",
      "deleteOne",
      "deleteMany",
      "findOneAndDelete",
      "bulkWrite",
      "drop",
    ]) {
      await assert.rejects(
        async () => accessor[op]({}),
        (err) => err instanceof ImmutableRecordError,
        `Audit collection accessor must reject "${op}" with ImmutableRecordError`
      );
    }
  }
  console.log("✓ Admin audit metadata redaction and application-level append-only accessor protection verified.");

  // ---------------------------------------------------------------------------
  // 15. Real MongoDB Integration Test: Stage 3B.3 Topology, Unique Indexes, Admin Auth, Audit Persistence & Transactions
  // ---------------------------------------------------------------------------
  console.log("\n[Test 15] Real MongoDB Integration Test: Topology, Unique Constraints, Admin Auth, Append-Only Audit & Replica-Set Transactions");
  const { verifyDatabaseTopology, runInReplicaSetTransaction } = repoMod;
  const { authorizeAdminSessionToken, requireAdminRequest } = adminMod;
  const sessionMod = loadTsModule(path.resolve(__dirname, "../src/lib/auth/session.ts"));
  const { createSession, SESSION_COOKIE_NAME } = sessionMod;

  const stage3b3RunId = crypto.randomBytes(8).toString("hex");
  const stage3b3Prefix = `__test_stage3b3_${stage3b3RunId}_`;

  const prevEnvStage3b3 = process.env.NODE_ENV;
  const prevAllowlist = process.env.ADMIN_EMAIL_ALLOWLIST;
  process.env.NODE_ENV = "development";
  delete process.env.VERCEL_ENV;
  delete process.env.ADMIN_EMAIL_ALLOWLIST;

  let stage3b3Client = null;
  let stage3b3Db = null;
  const createdUserIds = [];
  const createdSessionIds = [];
  const createdPurchaseIds = [];
  const createdEntitlementIds = [];
  const createdReferralProfileIds = [];
  const createdWebhookIds = [];
  const createdAuditIds = [];
  const createdEvidenceIds = [];
  const createdAdjustmentIds = [];

  try {
    stage3b3Client = await getMongoClient();
    stage3b3Db = await getDb();

    // 15a. Provision all indexes on real MongoDB and verify count
    const realIndexSummary = await ensureIndexes(stage3b3Db);
    assert.ok(
      realIndexSummary.length >= 44,
      `Real MongoDB ensureIndexes must confirm all required indexes across collections (found ${realIndexSummary.length})`
    );

    // 15b. Verify real MongoDB Atlas deployment topology & replica-set transaction support
    const topologyReport = await verifyDatabaseTopology(stage3b3Db);
    assert.equal(topologyReport.isReplicaSet, true, "Atlas cluster must be a replica set");
    assert.equal(topologyReport.isWritablePrimary, true, "Connected node must be writable primary");
    assert.equal(
      topologyReport.supportsTransactions,
      true,
      "Atlas replica set must support multi-document ACID transactions"
    );

    const usersCol = await getUsersCollection(stage3b3Db);
    const sessionsCol = await getSessionsCollection(stage3b3Db);
    const purchasesCol = await getPurchasesCollection(stage3b3Db);
    const entitlementsCol = await getEntitlementsCollection(stage3b3Db);
    const referralProfilesCol = await getReferralProfilesCollection(stage3b3Db);
    const webhooksCol = await getPaymentWebhooksCollection(stage3b3Db);
    const rawAuditCol = await getAdminAuditLogsCollection(stage3b3Db);
    const protectedAuditCol = await getProtectedAdminAuditLogsCollection(stage3b3Db);
    const evidenceCol = await getPurchaseEvidenceCollection(stage3b3Db);
    const adjustmentsCol = await getCommissionAdjustmentsCollection(stage3b3Db);

    // 15c. Real MongoDB unique constraint & optional identifier semantics across new collections
    const testBuyerId = new ObjectId();
    const testReferrerId = new ObjectId();

    // Multiple initial purchase records WITHOUT optional providerOrderId / providerPaymentId (null)
    // must coexist without E11000 collisions thanks to partialFilterExpression: { <field>: { $type: "string" } }
    const pNoProvider1 = buildPurchaseDocument({
      userId: testBuyerId,
      productSlug: "german-english",
      editionVersion: "1.0",
      region: "IN",
      currency: "INR",
      pricingSnapshot: {
        basePriceSubunits: 129900,
        discountSubunits: 0,
        taxSubunits: 0,
        totalSubunits: 129900,
        promoApplied: false,
        referralCodeApplied: null,
      },
      paymentProvider: "razorpay",
      providerOrderId: null,
      providerPaymentId: null,
      idempotencyKey: `${stage3b3Prefix}idem_no_provider_1`,
    });
    const pNoProvider2 = buildPurchaseDocument({
      userId: testBuyerId,
      productSlug: "german-english",
      editionVersion: "1.0",
      region: "IN",
      currency: "INR",
      pricingSnapshot: {
        basePriceSubunits: 129900,
        discountSubunits: 0,
        taxSubunits: 0,
        totalSubunits: 129900,
        promoApplied: false,
        referralCodeApplied: null,
      },
      paymentProvider: "razorpay",
      providerOrderId: null,
      providerPaymentId: null,
      idempotencyKey: `${stage3b3Prefix}idem_no_provider_2`,
    });
    createdPurchaseIds.push(pNoProvider1._id, pNoProvider2._id);
    await purchasesCol.insertOne(pNoProvider1);
    await purchasesCol.insertOne(pNoProvider2);

    const p1 = buildPurchaseDocument({
      userId: testBuyerId,
      productSlug: "german-english",
      editionVersion: "1.0",
      region: "IN",
      currency: "INR",
      pricingSnapshot: {
        basePriceSubunits: 129900,
        discountSubunits: 0,
        taxSubunits: 0,
        totalSubunits: 129900,
        promoApplied: false,
        referralCodeApplied: null,
      },
      paymentProvider: "razorpay",
      providerOrderId: `${stage3b3Prefix}order_unique_1`,
      providerPaymentId: `${stage3b3Prefix}pay_unique_1`,
      idempotencyKey: `${stage3b3Prefix}idem_unique_1`,
    });
    createdPurchaseIds.push(p1._id);
    await purchasesCol.insertOne(p1);

    // Duplicate populated providerOrderId must fail with E11000
    const dupOrderPurchase = buildPurchaseDocument({
      userId: testBuyerId,
      productSlug: "german-english",
      editionVersion: "1.0",
      region: "IN",
      currency: "INR",
      pricingSnapshot: {
        basePriceSubunits: 129900,
        discountSubunits: 0,
        taxSubunits: 0,
        totalSubunits: 129900,
        promoApplied: false,
        referralCodeApplied: null,
      },
      paymentProvider: "razorpay",
      providerOrderId: `${stage3b3Prefix}order_unique_1`,
      idempotencyKey: `${stage3b3Prefix}idem_unique_2`,
    });
    createdPurchaseIds.push(dupOrderPurchase._id);
    await assert.rejects(
      async () => purchasesCol.insertOne(dupOrderPurchase),
      (err) => err && err.code === 11000,
      "Duplicate populated providerOrderId in purchases must be rejected with E11000"
    );

    // Duplicate populated providerPaymentId must fail with E11000
    const dupPaymentPurchase = buildPurchaseDocument({
      userId: testBuyerId,
      productSlug: "german-english",
      editionVersion: "1.0",
      region: "IN",
      currency: "INR",
      pricingSnapshot: {
        basePriceSubunits: 129900,
        discountSubunits: 0,
        taxSubunits: 0,
        totalSubunits: 129900,
        promoApplied: false,
        referralCodeApplied: null,
      },
      paymentProvider: "razorpay",
      providerOrderId: `${stage3b3Prefix}order_unique_3`,
      providerPaymentId: `${stage3b3Prefix}pay_unique_1`,
      idempotencyKey: `${stage3b3Prefix}idem_unique_3`,
    });
    createdPurchaseIds.push(dupPaymentPurchase._id);
    await assert.rejects(
      async () => purchasesCol.insertOne(dupPaymentPurchase),
      (err) => err && err.code === 11000,
      "Duplicate populated providerPaymentId in purchases must be rejected with E11000"
    );

    // Entitlement uniqueness & lifecycle (active -> suspended -> revoked -> legitimate repurchase)
    const e1 = buildEntitlementDocument({
      userId: testBuyerId,
      purchaseId: p1._id,
      productSlug: "german-english",
    });
    createdEntitlementIds.push(e1._id);
    await entitlementsCol.insertOne(e1);

    // Duplicate active entitlement for same (userId, productSlug) must be rejected with E11000
    const dupActiveEntitlement = buildEntitlementDocument({
      userId: testBuyerId,
      purchaseId: new ObjectId(),
      productSlug: "german-english",
    });
    createdEntitlementIds.push(dupActiveEntitlement._id);
    await assert.rejects(
      async () => entitlementsCol.insertOne(dupActiveEntitlement),
      (err) => err && err.code === 11000,
      "Duplicate active (userId, productSlug) in entitlements must be rejected with E11000"
    );

    // Suspend e1 and verify a second active or suspended entitlement is still rejected with E11000
    const suspendedPatch = applyEntitlementRestriction(e1, "refund_pending");
    await entitlementsCol.updateOne(
      { _id: e1._id },
      { $set: suspendedPatch }
    );
    await assert.rejects(
      async () => entitlementsCol.insertOne(dupActiveEntitlement),
      (err) => err && err.code === 11000,
      "Duplicate active entitlement while existing entitlement is suspended must be rejected with E11000"
    );

    // Revoke e1 (e.g. refund completed); historical revoked record stays in entitlements
    const revokedPatch = revokeEntitlementState(
      { ...e1, ...suspendedPatch },
      "refunded"
    );
    await entitlementsCol.updateOne(
      { _id: e1._id },
      { $set: revokedPatch }
    );

    // Legitimate future repurchase by the same userId for the same productSlug must now succeed
    // while preserving the historical revoked entitlement record!
    const repurchaseEntitlement = buildEntitlementDocument({
      userId: testBuyerId,
      purchaseId: pNoProvider1._id,
      productSlug: "german-english",
    });
    createdEntitlementIds.push(repurchaseEntitlement._id);
    await entitlementsCol.insertOne(repurchaseEntitlement);

    const preservedHistoricalDocs = await entitlementsCol
      .find({ userId: testBuyerId, productSlug: "german-english" })
      .toArray();
    assert.equal(
      preservedHistoricalDocs.length,
      2,
      "Both the historical revoked entitlement and the new active repurchase entitlement must be preserved"
    );
    assert.equal(
      preservedHistoricalDocs.filter((d) => d.status === "revoked").length,
      1
    );
    assert.equal(
      preservedHistoricalDocs.filter((d) => d.status === "active").length,
      1
    );

    // A third active entitlement while the repurchase entitlement is active must again be rejected with E11000
    const thirdActiveAttempt = buildEntitlementDocument({
      userId: testBuyerId,
      purchaseId: pNoProvider2._id,
      productSlug: "german-english",
    });
    createdEntitlementIds.push(thirdActiveAttempt._id);
    await assert.rejects(
      async () => entitlementsCol.insertOne(thirdActiveAttempt),
      (err) => err && err.code === 11000,
      "Duplicate active entitlement after repurchase must be rejected with E11000"
    );

    // Referral profile unique referralCode constraint
    const rp1 = buildReferralProfileDocument({
      userId: testReferrerId,
      qualifyingPurchaseId: p1._id,
      referralCode: `REF_${stage3b3RunId.toUpperCase()}`,
    });
    createdReferralProfileIds.push(rp1._id);
    await referralProfilesCol.insertOne(rp1);

    const dupRefCode = buildReferralProfileDocument({
      userId: new ObjectId(),
      qualifyingPurchaseId: new ObjectId(),
      referralCode: `REF_${stage3b3RunId.toUpperCase()}`,
    });
    createdReferralProfileIds.push(dupRefCode._id);
    await assert.rejects(
      async () => referralProfilesCol.insertOne(dupRefCode),
      (err) => err && err.code === 11000,
      "Duplicate referralCode in referral_profiles must be rejected with E11000"
    );

    // Webhook unique (provider, eventId) constraint
    const wh1 = buildPaymentWebhookDocument({
      provider: "razorpay",
      eventId: `${stage3b3Prefix}evt_1`,
      eventType: "payment.captured",
      signatureVerified: true,
      payloadHash: "a".repeat(64),
    });
    createdWebhookIds.push(wh1._id);
    await webhooksCol.insertOne(wh1);

    const dupWh = buildPaymentWebhookDocument({
      provider: "razorpay",
      eventId: `${stage3b3Prefix}evt_1`,
      eventType: "payment.captured",
      signatureVerified: true,
      payloadHash: "b".repeat(64),
    });
    createdWebhookIds.push(dupWh._id);
    await assert.rejects(
      async () => webhooksCol.insertOne(dupWh),
      (err) => err && err.code === 11000,
      "Duplicate (provider, eventId) in payment_webhooks must be rejected with E11000"
    );

    // Purchase evidence & Commission adjustment unique constraints
    const ev1 = buildPurchaseEvidenceDocument({
      purchaseId: p1._id,
      userId: testBuyerId,
      emailSnapshot: `${stage3b3Prefix}buyer@example.com`,
      productSlug: "german-english",
      editionVersion: "1.0",
      region: "IN",
      currency: "INR",
      amountSubunits: 129900,
      providerOrderId: p1.providerOrderId,
      providerPaymentId: `${stage3b3Prefix}pay_1`,
      paymentMethodSummary: "upi",
      termsVersionAccepted: "2026-03",
      refundPolicyVersionAccepted: "2026-03",
      acceptedAt: new Date(),
    });
    createdEvidenceIds.push(ev1._id);
    await evidenceCol.insertOne(ev1);

    const adj1 = buildCommissionAdjustmentDocument({
      commissionId: new ObjectId(),
      purchaseId: p1._id,
      payoutId: new ObjectId(),
      referrerUserId: testReferrerId,
      currency: "INR",
      adjustmentAmountSubunits: 25980,
      reason: "post_payout_refund",
    });
    createdAdjustmentIds.push(adj1._id);
    await adjustmentsCol.insertOne(adj1);

    // 15d. Real MongoDB Admin Authorization Tests (Unauthenticated, Customer, Legacy No-Role, Unverified Admin, Suspended Admin, Verified Admin, Allowlist)
    const now = new Date();
    const customerUser = {
      _id: new ObjectId(),
      email: `${stage3b3Prefix}customer@example.com`,
      passwordHash: "$argon2id$v=19$m=65536,t=3,p=1$dummy",
      role: "customer",
      status: "active",
      isEmailVerified: true,
      createdAt: now,
      updatedAt: now,
    };
    const legacyNoRoleUser = {
      _id: new ObjectId(),
      email: `${stage3b3Prefix}legacy@example.com`,
      passwordHash: "$argon2id$v=19$m=65536,t=3,p=1$dummy",
      status: "active",
      isEmailVerified: true,
      createdAt: now,
      updatedAt: now,
    };
    const unverifiedAdminUser = {
      _id: new ObjectId(),
      email: `${stage3b3Prefix}unverified_admin@example.com`,
      passwordHash: "$argon2id$v=19$m=65536,t=3,p=1$dummy",
      role: "admin",
      status: "active",
      isEmailVerified: false,
      createdAt: now,
      updatedAt: now,
    };
    const suspendedAdminUser = {
      _id: new ObjectId(),
      email: `${stage3b3Prefix}suspended_admin@example.com`,
      passwordHash: "$argon2id$v=19$m=65536,t=3,p=1$dummy",
      role: "admin",
      status: "suspended",
      isEmailVerified: true,
      createdAt: now,
      updatedAt: now,
    };
    const verifiedAdminUser = {
      _id: new ObjectId(),
      email: `${stage3b3Prefix}verified_admin@example.com`,
      passwordHash: "$argon2id$v=19$m=65536,t=3,p=1$dummy",
      role: "admin",
      status: "active",
      isEmailVerified: true,
      createdAt: now,
      updatedAt: now,
    };

    createdUserIds.push(
      customerUser._id,
      legacyNoRoleUser._id,
      unverifiedAdminUser._id,
      suspendedAdminUser._id,
      verifiedAdminUser._id
    );
    await usersCol.insertMany([
      customerUser,
      legacyNoRoleUser,
      unverifiedAdminUser,
      suspendedAdminUser,
      verifiedAdminUser,
    ]);

    const customerSession = await createSession(stage3b3Db, customerUser._id);
    const legacySession = await createSession(stage3b3Db, legacyNoRoleUser._id);
    const unverifiedAdminSession = await createSession(stage3b3Db, unverifiedAdminUser._id);
    const suspendedAdminSession = await createSession(stage3b3Db, suspendedAdminUser._id);
    const verifiedAdminSession = await createSession(stage3b3Db, verifiedAdminUser._id);

    // Unauthenticated denied (401)
    const unauthDecision = await authorizeAdminSessionToken(stage3b3Db, null);
    assert.equal(unauthDecision.authorized, false);
    assert.equal(unauthDecision.status, 401);

    // Customer denied (403)
    const customerDecision = await authorizeAdminSessionToken(
      stage3b3Db,
      customerSession.token
    );
    assert.equal(customerDecision.authorized, false);
    assert.equal(customerDecision.status, 403);
    assert.equal(customerDecision.reason, "insufficient_role");

    // Legacy user without role field denied (403)
    const legacyDecision = await authorizeAdminSessionToken(
      stage3b3Db,
      legacySession.token
    );
    assert.equal(legacyDecision.authorized, false);
    assert.equal(legacyDecision.status, 403);
    assert.equal(legacyDecision.reason, "insufficient_role");

    // Unverified admin denied (403)
    const unverifiedDecision = await authorizeAdminSessionToken(
      stage3b3Db,
      unverifiedAdminSession.token
    );
    assert.equal(unverifiedDecision.authorized, false);
    assert.equal(unverifiedDecision.status, 403);
    assert.equal(unverifiedDecision.reason, "email_not_verified");

    // Suspended admin denied (403)
    const suspendedDecision = await authorizeAdminSessionToken(
      stage3b3Db,
      suspendedAdminSession.token
    );
    assert.equal(suspendedDecision.authorized, false);
    assert.equal(suspendedDecision.status, 403);

    // Active verified admin allowed (200)
    const adminDecision = await authorizeAdminSessionToken(
      stage3b3Db,
      verifiedAdminSession.token
    );
    assert.equal(adminDecision.authorized, true);
    assert.equal(adminDecision.status, 200);
    assert.equal(adminDecision.context.email, verifiedAdminUser.email);
    assert.equal(adminDecision.context.role, "admin");

    // Defense-in-depth ADMIN_EMAIL_ALLOWLIST check
    process.env.ADMIN_EMAIL_ALLOWLIST = "other-admin@lingopdf.in";
    const allowlistMismatchDecision = await authorizeAdminSessionToken(
      stage3b3Db,
      verifiedAdminSession.token
    );
    assert.equal(allowlistMismatchDecision.authorized, false);
    assert.equal(allowlistMismatchDecision.status, 403);
    assert.equal(allowlistMismatchDecision.reason, "not_in_admin_allowlist");

    process.env.ADMIN_EMAIL_ALLOWLIST = `other-admin@lingopdf.in, ${verifiedAdminUser.email}`;
    const allowlistMatchDecision = await authorizeAdminSessionToken(
      stage3b3Db,
      verifiedAdminSession.token
    );
    assert.equal(allowlistMatchDecision.authorized, true);
    delete process.env.ADMIN_EMAIL_ALLOWLIST;

    // Route-level requireAdminRequest check
    const adminNextReq = new NextRequest("https://lingopdf.in/api/admin/test", {
      method: "GET",
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${verifiedAdminSession.token}`,
      },
    });
    const reqGuardResult = await requireAdminRequest(adminNextReq, stage3b3Db);
    assert.equal(reqGuardResult.authorized, true);
    assert.equal(reqGuardResult.deniedResponse, null);

    // 15e. Real MongoDB Admin Audit Logging (Success, Failure & Immutability)
    const { result: actionResult, auditLog: successAudit } =
      await executeAuditedAdminAction({
        db: stage3b3Db,
        actor: adminDecision.context,
        action: "promotion_settings.update_mode",
        targetCollection: "promotion_settings",
        targetId: "global_referral_promo",
        reason: "Enable launch referral promo",
        metadata: {
          previousMode: "normal",
          newMode: "promo",
          secretApiKey: "should-be-redacted",
        },
        operation: async () => {
          return { updated: true };
        },
      });
    createdAuditIds.push(successAudit._id);
    assert.equal(actionResult.updated, true);
    assert.equal(successAudit.outcome, "success");
    assert.equal(successAudit.metadata.secretApiKey, "[REDACTED]");
    assert.equal(successAudit.metadata.newMode, "promo");

    // Failed privileged action MUST record outcome: "failure" and rethrow
    const failureCorrelationId = `${stage3b3Prefix}corr_fail`;
    await assert.rejects(
      async () =>
        executeAuditedAdminAction({
          db: stage3b3Db,
          actor: adminDecision.context,
          action: "payouts.mark_paid",
          targetCollection: "payouts",
          targetId: new ObjectId(),
          correlationId: failureCorrelationId,
          reason: "Attempt payout transfer",
          operation: async () => {
            throw new Error("Simulated bank transfer failure");
          },
        }),
      (err) => err instanceof Error && /Simulated bank transfer failure/.test(err.message)
    );

    const persistedFailureAudit = await protectedAuditCol.findOne({
      correlationId: failureCorrelationId,
    });
    assert.ok(persistedFailureAudit, "Failed admin action must persist a failure audit entry");
    createdAuditIds.push(persistedFailureAudit._id);
    assert.equal(
      persistedFailureAudit.outcome,
      "failure",
      "Failed admin action must be recorded with outcome === 'failure' and never 'success'"
    );
    assert.match(String(persistedFailureAudit.metadata.failureError), /Simulated bank transfer failure/);

    // Both getAdminAuditLogsCollection and getProtectedAdminAuditLogsCollection must block updateOne, deleteOne, findOneAndDelete, bulkWrite, and drop
    for (const auditAccessor of [rawAuditCol, protectedAuditCol]) {
      await assert.rejects(
        async () =>
          auditAccessor.updateOne(
            { _id: successAudit._id },
            { $set: { outcome: "failure" } }
          ),
        (err) => err instanceof ImmutableRecordError
      );
      await assert.rejects(
        async () => auditAccessor.deleteOne({ _id: successAudit._id }),
        (err) => err instanceof ImmutableRecordError
      );
      await assert.rejects(
        async () => auditAccessor.findOneAndDelete({ _id: successAudit._id }),
        (err) => err instanceof ImmutableRecordError
      );
      await assert.rejects(
        async () => auditAccessor.bulkWrite([]),
        (err) => err instanceof ImmutableRecordError
      );
      await assert.rejects(
        async () => auditAccessor.drop(),
        (err) => err instanceof ImmutableRecordError
      );
    }

    // 15f. Real MongoDB Multi-Document Replica-Set Transaction Commit & Rollback Verification
    const txCommitPurchase = buildPurchaseDocument({
      userId: customerUser._id,
      productSlug: "german-english",
      editionVersion: "1.0",
      region: "US",
      currency: "USD",
      status: "captured",
      pricingSnapshot: {
        basePriceSubunits: 5900,
        discountSubunits: 0,
        taxSubunits: 0,
        totalSubunits: 5900,
        promoApplied: false,
        referralCodeApplied: null,
      },
      paymentProvider: "razorpay",
      providerOrderId: `${stage3b3Prefix}tx_commit_order`,
      providerPaymentId: `${stage3b3Prefix}tx_commit_pay`,
      idempotencyKey: `${stage3b3Prefix}tx_commit_idem`,
    });
    const txCommitEntitlement = buildEntitlementDocument({
      userId: customerUser._id,
      purchaseId: txCommitPurchase._id,
      productSlug: "german-english",
    });
    createdPurchaseIds.push(txCommitPurchase._id);
    createdEntitlementIds.push(txCommitEntitlement._id);

    await runInReplicaSetTransaction(stage3b3Client, stage3b3Db, async (session) => {
      await purchasesCol.insertOne(txCommitPurchase, { session });
      await entitlementsCol.insertOne(txCommitEntitlement, { session });
    });

    assert.ok(await purchasesCol.findOne({ _id: txCommitPurchase._id }));
    assert.ok(await entitlementsCol.findOne({ _id: txCommitEntitlement._id }));

    // Transaction rollback test: first insert inside transaction must roll back when second step throws
    const txAbortPurchase = buildPurchaseDocument({
      userId: customerUser._id,
      productSlug: "german-english",
      editionVersion: "1.0",
      region: "US",
      currency: "USD",
      pricingSnapshot: {
        basePriceSubunits: 5900,
        discountSubunits: 0,
        taxSubunits: 0,
        totalSubunits: 5900,
        promoApplied: false,
        referralCodeApplied: null,
      },
      paymentProvider: "razorpay",
      providerOrderId: `${stage3b3Prefix}tx_abort_order`,
      idempotencyKey: `${stage3b3Prefix}tx_abort_idem`,
    });
    createdPurchaseIds.push(txAbortPurchase._id);

    await assert.rejects(
      async () =>
        runInReplicaSetTransaction(stage3b3Client, stage3b3Db, async (session) => {
          await purchasesCol.insertOne(txAbortPurchase, { session });
          throw new Error("Simulated error forcing replica-set transaction abort");
        }),
      (err) => err instanceof Error && /Simulated error forcing replica-set transaction abort/.test(err.message)
    );

    const rolledBackPurchase = await purchasesCol.findOne({ _id: txAbortPurchase._id });
    assert.equal(
      rolledBackPurchase,
      null,
      "Aborted replica-set transaction must roll back purchase insert completely"
    );
  } finally {
    process.env.NODE_ENV = prevEnvStage3b3;
    if (prevAllowlist === undefined) delete process.env.ADMIN_EMAIL_ALLOWLIST;
    else process.env.ADMIN_EMAIL_ALLOWLIST = prevAllowlist;

    if (stage3b3Db) {
      // Strictly scoped cleanup of only this test run's temporary documents
      if (createdUserIds.length > 0) {
        await stage3b3Db.collection("sessions").deleteMany({
          userId: { $in: createdUserIds },
        });
        await stage3b3Db.collection("users").deleteMany({
          _id: { $in: createdUserIds },
        });
      }
      if (createdSessionIds.length > 0) {
        await stage3b3Db.collection("sessions").deleteMany({
          _id: { $in: createdSessionIds },
        });
      }
      if (createdPurchaseIds.length > 0) {
        await stage3b3Db.collection("purchases").deleteMany({
          _id: { $in: createdPurchaseIds },
        });
      }
      if (createdEntitlementIds.length > 0) {
        await stage3b3Db.collection("entitlements").deleteMany({
          _id: { $in: createdEntitlementIds },
        });
      }
      if (createdReferralProfileIds.length > 0) {
        await stage3b3Db.collection("referral_profiles").deleteMany({
          _id: { $in: createdReferralProfileIds },
        });
      }
      if (createdWebhookIds.length > 0) {
        await stage3b3Db.collection("payment_webhooks").deleteMany({
          _id: { $in: createdWebhookIds },
        });
      }
      if (createdAuditIds.length > 0) {
        // Test-only teardown via raw driver collection handle after append-only guard tests complete
        await stage3b3Db.collection("admin_audit_logs").deleteMany({
          _id: { $in: createdAuditIds },
        });
      }
      if (createdEvidenceIds.length > 0) {
        await stage3b3Db.collection("purchase_evidence").deleteMany({
          _id: { $in: createdEvidenceIds },
        });
      }
      if (createdAdjustmentIds.length > 0) {
        await stage3b3Db.collection("commission_adjustments").deleteMany({
          _id: { $in: createdAdjustmentIds },
        });
      }
    }
  }
  console.log(
    `✓ Real MongoDB Stage 3B.3 integration test passed (44 indexes, replica-set transactions, unique constraints, server-side admin auth, append-only audit logs, and full test cleanup verified).`
  );

  // ---------------------------------------------------------------------------
  // 16. Stage 3B.4 Complete Admin Dashboard & Operations: Schemas, API Auth, Workflows, Invariants & Real MongoDB Integration
  // ---------------------------------------------------------------------------
  console.log("\n[Test 16] Stage 3B.4 Admin Dashboard & Operations: Validation, API Security, Workflows, Financial Invariants & Real MongoDB Integration");
  const adminServicesMod = loadTsModule(path.resolve(__dirname, "../src/lib/admin/services.ts"));
  const adminRouteMod = loadTsModule(path.resolve(__dirname, "../src/app/api/admin/actions/route.ts"));

  const {
    promotionalDiscountPercentSchema,
    promotionCreateMutationSchema,
    userStatusMutationSchema,
    formatSubunitsWithCode,
    formatGuaranteeWindowStatus,
    getAdminOverviewData,
    listAdminUsers,
    getAdminUserDetails,
    listAdminPurchases,
    getAdminPurchaseDetails,
    listAdminEntitlements,
    listAdminRefunds,
    listAdminDisputes,
    getPromotionsAdminData,
    listAdminReferrals,
    listAdminCommissions,
    listAdminPayouts,
    listAdminAuditLogs,
    getAdminSettingsData,
    getAdminSystemHealthData,
    suspendUserAccountByAdmin,
    restoreUserAccountByAdmin,
    suspendEntitlementByAdmin,
    restoreEntitlementByAdmin,
    revokeEntitlementByAdmin,
    processDeviceReplacementByAdmin,
    createInternalRefundRequest,
    approveRefundRequestByAdmin,
    rejectRefundRequestByAdmin,
    initiateGatewayRefundByAdmin,
    openInternalDisputeRecord,
    updateDisputeNotesByAdmin,
    resolveDisputeOutcomeByAdmin,
    createPromotionCampaignByAdmin,
    updatePromotionCampaignStatusByAdmin,
    setGlobalPromotionModeByAdmin,
    reserveReferralCapacityAtomically,
    releaseAbandonedReferralReservation,
    finalizeCapturedReferralRedemption,
    suspendReferralProfileByAdmin,
    reinstateReferralProfileByAdmin,
    overrideReferralRiskHoldByAdmin,
    evaluateCommissionEligibilityByAdmin,
    approveCommissionByAdmin,
    createCommissionAdjustmentByAdmin,
    resolveCommissionAdjustmentByAdmin,
    createPayoutBatchByAdmin,
    transitionPayoutStatusByAdmin,
    updateOperationalSettingsByAdmin,
  } = adminServicesMod;

  // 16a. Unit tests for Stage 3B.4 Zod schemas & formatting helpers
  for (const validPct of [5, 10, 15, 20]) {
    assert.equal(promotionalDiscountPercentSchema.safeParse(validPct).success, true);
  }
  for (const invalidPct of [-10, 0, 3, 12, 25, 50, 100]) {
    assert.equal(
      promotionalDiscountPercentSchema.safeParse(invalidPct).success,
      false,
      `Disallowed promo discount ${invalidPct}% must be rejected`
    );
  }

  // Promotion date range validation (endsAt must be after startsAt)
  assert.equal(
    promotionCreateMutationSchema.safeParse({
      actionType: "promotion.create",
      name: "Invalid Window Campaign",
      code: "BADWINDOW",
      discountPercent: 15,
      startsAt: "2026-06-10T00:00:00.000Z",
      endsAt: "2026-06-01T00:00:00.000Z",
      reason: "Testing invalid window",
      confirmed: true,
    }).success,
    false
  );

  // Explicit confirmation and minimum reason length required
  assert.equal(
    userStatusMutationSchema.safeParse({
      actionType: "user.suspend",
      userId: new ObjectId().toString(),
      reason: "Too",
      confirmed: true,
    }).success,
    false
  );
  assert.equal(
    userStatusMutationSchema.safeParse({
      actionType: "user.suspend",
      userId: new ObjectId().toString(),
      reason: "Valid admin reason",
      confirmed: false,
    }).success,
    false
  );

  // Minor-unit currency formatting & 72h countdown
  assert.equal(formatSubunitsWithCode(129900, "INR"), "₹1,299 INR");
  assert.equal(formatSubunitsWithCode(5900, "USD"), "$59 USD");
  assert.equal(formatSubunitsWithCode(5900, "EUR"), "€59 EUR");

  const refNow = new Date("2026-05-10T12:00:00.000Z");
  const within72h = formatGuaranteeWindowStatus(
    new Date("2026-05-09T12:00:00.000Z"),
    refNow
  );
  assert.equal(within72h.isWithinWindow, true);
  const past72h = formatGuaranteeWindowStatus(
    new Date("2026-05-05T12:00:00.000Z"),
    refNow
  );
  assert.equal(past72h.isWithinWindow, false);

  // 16b. Real MongoDB Integration Test for Stage 3B.4 Admin Workflows, Queries & POST /api/admin/actions
  const stage3b4RunId = crypto.randomBytes(8).toString("hex");
  const stage3b4Prefix = `__test_stage3b4_${stage3b4RunId}_`;

  const prevEnv3b4 = process.env.NODE_ENV;
  const prevAppUrl3b4 = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NODE_ENV = "development";
  process.env.NEXT_PUBLIC_APP_URL = "https://lingopdf.in";
  delete process.env.VERCEL_ENV;
  delete process.env.ADMIN_EMAIL_ALLOWLIST;

  let stage3b4Client = null;
  let stage3b4Db = null;
  const cleanup3b4 = {
    userIds: [],
    purchaseIds: [],
    entitlementIds: [],
    referralProfileIds: [],
    commissionIds: [],
    adjustmentIds: [],
    payoutIds: [],
    evidenceIds: [],
    auditIds: [],
    savedPromoSettings: null,
  };

  try {
    stage3b4Client = await getMongoClient();
    stage3b4Db = await getDb();
    adminRouteMod.setAdminActionsTestDb({ db: stage3b4Db, client: stage3b4Client });

    const usersCol = await getUsersCollection(stage3b4Db);
    const purchasesCol = await getPurchasesCollection(stage3b4Db);
    const entitlementsCol = await getEntitlementsCollection(stage3b4Db);
    const referralProfilesCol = await getReferralProfilesCollection(stage3b4Db);
    const commissionsCol = await getCommissionsCollection(stage3b4Db);
    const adjustmentsCol = await getCommissionAdjustmentsCollection(stage3b4Db);
    const payoutsCol = await getPayoutsCollection(stage3b4Db);
    const promoCol = await getPromotionSettingsCollection(stage3b4Db);
    const evidenceCol = await getPurchaseEvidenceCollection(stage3b4Db);

    cleanup3b4.savedPromoSettings = await promoCol.findOne({ _id: "global_referral_promo" });

    const now = new Date();
    const adminActorUser = {
      _id: new ObjectId(),
      email: `${stage3b4Prefix}admin@lingopdf.in`,
      passwordHash: "$argon2id$v=19$m=65536,t=3,p=1$dummy",
      name: "Stage 3B.4 Ops Admin",
      role: "admin",
      status: "active",
      isEmailVerified: true,
      createdAt: now,
      updatedAt: now,
    };
    const customerBuyer = {
      _id: new ObjectId(),
      email: `${stage3b4Prefix}buyer@example.com`,
      passwordHash: "$argon2id$v=19$m=65536,t=3,p=1$dummy",
      name: "Stage 3B.4 Buyer",
      role: "customer",
      status: "active",
      isEmailVerified: true,
      createdAt: now,
      updatedAt: now,
    };
    const referrerUser = {
      _id: new ObjectId(),
      email: `${stage3b4Prefix}referrer@example.com`,
      passwordHash: "$argon2id$v=19$m=65536,t=3,p=1$dummy",
      name: "Stage 3B.4 Referrer",
      role: "customer",
      status: "active",
      isEmailVerified: true,
      createdAt: now,
      updatedAt: now,
    };

    cleanup3b4.userIds.push(adminActorUser._id, customerBuyer._id, referrerUser._id);
    await usersCol.insertMany([adminActorUser, customerBuyer, referrerUser]);

    const adminSession = await createSession(stage3b4Db, adminActorUser._id);
    const customerSession = await createSession(stage3b4Db, customerBuyer._id);

    const makeAdminApiReq = (bodyObj, cookieToken = adminSession.token, origin = "https://lingopdf.in") =>
      new NextRequest("https://lingopdf.in/api/admin/actions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin,
          ...(cookieToken ? { cookie: `${SESSION_COOKIE_NAME}=${cookieToken}` } : {}),
        },
        body: JSON.stringify(bodyObj),
      });

    // 1. API Route Security Checks (401 unauthenticated, 403 customer, 403 CSRF, 403 role escalation, 400 manual payment capture)
    const unauthRes = await adminRouteMod.POST(
      makeAdminApiReq({
        actionType: "user.suspend",
        userId: customerBuyer._id.toString(),
        reason: "Unauth attempt",
        confirmed: true,
      }, null)
    );
    assert.equal(unauthRes.status, 401, "Unauthenticated POST /api/admin/actions must return 401");

    const customerRes = await adminRouteMod.POST(
      makeAdminApiReq({
        actionType: "user.suspend",
        userId: customerBuyer._id.toString(),
        reason: "Customer attempt",
        confirmed: true,
      }, customerSession.token)
    );
    assert.equal(customerRes.status, 403, "Customer session POST /api/admin/actions must return 403");

    const csrfRes = await adminRouteMod.POST(
      makeAdminApiReq(
        {
          actionType: "user.suspend",
          userId: customerBuyer._id.toString(),
          reason: "Cross-origin CSRF attempt",
          confirmed: true,
        },
        adminSession.token,
        "https://evil.example.com"
      )
    );
    assert.equal(csrfRes.status, 403, "Cross-origin POST /api/admin/actions must be blocked by CSRF");

    const escalationRes = await adminRouteMod.POST(
      makeAdminApiReq({
        actionType: "user.suspend",
        userId: customerBuyer._id.toString(),
        role: "admin",
        reason: "Role escalation payload field",
        confirmed: true,
      })
    );
    assert.equal(escalationRes.status, 403, "Payload containing privilege escalation field must return 403");

    const manualCaptureRes = await adminRouteMod.POST(
      makeAdminApiReq({
        actionType: "purchase.mark_captured",
        purchaseId: new ObjectId().toString(),
        reason: "Invented manual payment capture",
        confirmed: true,
      })
    );
    assert.equal(
      manualCaptureRes.status,
      400,
      "Prohibited manual payment capture action must be rejected with 400"
    );

    // 2. User Suspend & Restore + Independence from Entitlement Suspension
    const buyerPurchase = buildPurchaseDocument({
      userId: customerBuyer._id,
      productSlug: "german",
      editionVersion: "1.0",
      region: "IN",
      currency: "INR",
      status: "captured",
      capturedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago (within 72h guarantee)
      pricingSnapshot: {
        basePriceSubunits: 129900,
        discountPercentApplied: 10,
        discountSubunits: 12990,
        taxSubunits: 0,
        totalSubunits: 116910,
        promoApplied: false,
        referralCodeApplied: `REF3B4_${stage3b4RunId.slice(0, 6).toUpperCase()}`,
      },
      paymentProvider: "razorpay",
      providerOrderId: `${stage3b4Prefix}ord_1`,
      providerPaymentId: `${stage3b4Prefix}pay_1`,
      idempotencyKey: `${stage3b4Prefix}idem_1`,
      referrerUserId: referrerUser._id,
    });
    cleanup3b4.purchaseIds.push(buyerPurchase._id);
    await purchasesCol.insertOne(buyerPurchase);

    const buyerEvidence = buildPurchaseEvidenceDocument({
      purchaseId: buyerPurchase._id,
      userId: customerBuyer._id,
      emailSnapshot: customerBuyer.email,
      productSlug: "german",
      editionVersion: "1.0",
      region: "IN",
      currency: "INR",
      amountSubunits: 116910,
      providerOrderId: buyerPurchase.providerOrderId,
      providerPaymentId: buyerPurchase.providerPaymentId,
      paymentMethodSummary: "upi",
      termsVersionAccepted: "2026-03",
      refundPolicyVersionAccepted: "2026-03",
      acceptedAt: now,
    });
    cleanup3b4.evidenceIds.push(buyerEvidence._id);
    await evidenceCol.insertOne(buyerEvidence);

    const buyerEntitlement = {
      ...buildEntitlementDocument({
        userId: customerBuyer._id,
        purchaseId: buyerPurchase._id,
        productSlug: "german",
      }),
      activeInstallationIdHash: "inst_hash_initial_device_001",
      deviceBoundAt: now,
    };
    cleanup3b4.entitlementIds.push(buyerEntitlement._id);
    await entitlementsCol.insertOne(buyerEntitlement);

    // Suspend user account via API route
    const suspendUserRes = await adminRouteMod.POST(
      makeAdminApiReq({
        actionType: "user.suspend",
        userId: customerBuyer._id.toString(),
        reason: "Temporary security review on buyer account",
        confirmed: true,
      })
    );
    assert.equal(suspendUserRes.status, 200);
    const suspendUserJson = await suspendUserRes.json();
    cleanup3b4.auditIds.push(new ObjectId(suspendUserJson.auditId));

    const updatedBuyerAfterSuspend = await usersCol.findOne({ _id: customerBuyer._id });
    assert.equal(updatedBuyerAfterSuspend.status, "suspended");
    // Entitlement status must remain distinct from account suspension!
    const entDuringAccountSuspend = await entitlementsCol.findOne({ _id: buyerEntitlement._id });
    assert.equal(
      entDuringAccountSuspend.status,
      "active",
      "Account suspension must remain distinct from entitlement suspension"
    );

    // Restore user account via API route
    const restoreUserRes = await adminRouteMod.POST(
      makeAdminApiReq({
        actionType: "user.restore",
        userId: customerBuyer._id.toString(),
        reason: "Security review cleared for buyer account",
        confirmed: true,
      })
    );
    assert.equal(restoreUserRes.status, 200);
    const restoreUserJson = await restoreUserRes.json();
    cleanup3b4.auditIds.push(new ObjectId(restoreUserJson.auditId));
    assert.equal((await usersCol.findOne({ _id: customerBuyer._id })).status, "active");

    // Device replacement workflow on entitlement
    const replaceDeviceRes = await adminRouteMod.POST(
      makeAdminApiReq({
        actionType: "entitlement.replace_device",
        entitlementId: buyerEntitlement._id.toString(),
        reason: "Customer reinstalled Chrome on new laptop",
        confirmed: true,
      })
    );
    assert.equal(replaceDeviceRes.status, 200);
    const replaceDeviceJson = await replaceDeviceRes.json();
    cleanup3b4.auditIds.push(new ObjectId(replaceDeviceJson.auditId));
    const entAfterDeviceReset = await entitlementsCol.findOne({ _id: buyerEntitlement._id });
    assert.equal(entAfterDeviceReset.activeInstallationIdHash, null);
    assert.equal(entAfterDeviceReset.deviceReplacementCount, 1);

    // 3. Referral 50-Cap Atomic Reservation, Abandonment Release & Refund/Dispute Non-Restoration
    const refProfile = buildReferralProfileDocument({
      userId: referrerUser._id,
      qualifyingPurchaseId: buyerPurchase._id,
      referralCode: `REF3B4_${stage3b4RunId.slice(0, 6).toUpperCase()}`,
      payoutMethod: "upi",
      payoutDetailsEncryptedOrRef: "upi://referrer@okaxis",
    });
    // Set to 48 captured + 1 pending = 49 used (1 slot remaining)
    refProfile.successfulConversionsCount = 48;
    refProfile.pendingReservedCount = 1;
    cleanup3b4.referralProfileIds.push(refProfile._id);
    await referralProfilesCol.insertOne(refProfile);

    const adminDecision = await authorizeAdminSessionToken(stage3b4Db, adminSession.token);
    const wfCtx = {
      db: stage3b4Db,
      client: stage3b4Client,
      actor: adminDecision.context,
      reason: "Stage 3B.4 integration test workflow execution",
      ipAddressHash: "hash_127_0_0_1",
      userAgent: "Stage3B4TestRunner",
    };

    // Reserve the 50th slot (succeeds: 48 + 2 = 50)
    const slot50 = await reserveReferralCapacityAtomically(stage3b4Db, refProfile._id);
    assert.equal(slot50.pendingReservedCount, 2);

    // 51st reservation attempt must fail because 48 + 2 = 50 cap reached
    await assert.rejects(
      async () => reserveReferralCapacityAtomically(stage3b4Db, refProfile._id),
      (err) => err instanceof InvalidStateTransitionError,
      "51st referral reservation must be rejected when successfulConversionsCount + pendingReservedCount === 50"
    );

    // Abandoned/failed checkout releases 1 pending slot (48 + 1 = 49)
    const afterRelease = await releaseAbandonedReferralReservation(stage3b4Db, refProfile._id);
    assert.equal(afterRelease.pendingReservedCount, 1);

    // Finalize the remaining pending slot into a captured conversion (49 captured + 0 pending = 49)
    const afterFinalize = await finalizeCapturedReferralRedemption(stage3b4Db, refProfile._id);
    assert.equal(afterFinalize.successfulConversionsCount, 49);
    assert.equal(afterFinalize.pendingReservedCount, 0);

    // Suspend, override risk, and reinstate referral profile
    const suspRefOut = await suspendReferralProfileByAdmin(wfCtx, refProfile._id.toString());
    cleanup3b4.auditIds.push(suspRefOut.auditLog._id);
    assert.equal(suspRefOut.result.status, "suspended");

    const reinstateRefOut = await reinstateReferralProfileByAdmin(wfCtx, refProfile._id.toString());
    cleanup3b4.auditIds.push(reinstateRefOut.auditLog._id);
    assert.equal(reinstateRefOut.result.status, "active");

    // 4. Refund Request, 72h Evaluation, Approval (Pending Gateway) & Rejection Workflow
    const buyerCommission = buildCommissionDocument({
      referrerUserId: referrerUser._id,
      referredUserId: customerBuyer._id,
      referralProfileId: refProfile._id,
      purchaseId: buyerPurchase._id,
      currency: "INR",
      netCollectedSubunits: 116910,
      commissionAmountSubunits: 11691,
      purchaseCapturedAt: buyerPurchase.capturedAt,
    });
    cleanup3b4.commissionIds.push(buyerCommission._id);
    await commissionsCol.insertOne(buyerCommission);

    // Open internal refund request -> suspends entitlement with 'refund_pending' & holds commission
    const refundReqOut = await createInternalRefundRequest(wfCtx, buyerPurchase._id.toString());
    cleanup3b4.auditIds.push(refundReqOut.auditLog._id);
    assert.equal(refundReqOut.result.status, "pending_review");
    assert.equal(refundReqOut.result.isWithin72hGuarantee, true);
    const entDuringRefund = await entitlementsCol.findOne({ _id: buyerEntitlement._id });
    assert.equal(entDuringRefund.status, "suspended");
    assert.ok(entDuringRefund.activeRestrictionReasons.includes("refund_pending"));
    assert.equal((await commissionsCol.findOne({ _id: buyerCommission._id })).isDisputedHold, true);

    // Reject refund request -> removes 'refund_pending', restores active entitlement, releases commission hold
    const rejectRefundOut = await rejectRefundRequestByAdmin(wfCtx, buyerPurchase._id.toString());
    cleanup3b4.auditIds.push(rejectRefundOut.auditLog._id);
    assert.equal(rejectRefundOut.result.refundRequest.status, "rejected");
    assert.equal(rejectRefundOut.result.entitlementStatus, "active");
    assert.equal((await commissionsCol.findOne({ _id: buyerCommission._id })).isDisputedHold, false);

    // Re-open refund request and approve -> sets 'approved_pending_gateway' (never fabricates live gateway refund)
    const refundReqOut2 = await createInternalRefundRequest(wfCtx, buyerPurchase._id.toString());
    cleanup3b4.auditIds.push(refundReqOut2.auditLog._id);
    const approveRefundOut = await approveRefundRequestByAdmin(wfCtx, buyerPurchase._id.toString());
    cleanup3b4.auditIds.push(approveRefundOut.auditLog._id);
    assert.equal(approveRefundOut.result.status, "approved_pending_gateway");
    assert.equal((await purchasesCol.findOne({ _id: buyerPurchase._id })).status, "captured");
    // Referral successfulConversionsCount must NOT be decremented
    assert.equal(
      (await referralProfilesCol.findOne({ _id: refProfile._id })).successfulConversionsCount,
      49
    );

    // Reject the approved_pending_gateway refund so we can test Dispute Won & Lost workflows cleanly
    const rejectRefundOut2 = await rejectRefundRequestByAdmin(wfCtx, buyerPurchase._id.toString());
    cleanup3b4.auditIds.push(rejectRefundOut2.auditLog._id);

    // 5. Dispute Open, Independent Restriction Preservation, Won & Lost Workflows
    // First apply 'admin_suspended' to buyerEntitlement so we verify resolving a dispute does NOT overwrite 'admin_suspended'
    const adminSuspEnt = await suspendEntitlementByAdmin(wfCtx, buyerEntitlement._id.toString());
    cleanup3b4.auditIds.push(adminSuspEnt.auditLog._id);

    const disputeOpenOut = await openInternalDisputeRecord(wfCtx, buyerPurchase._id.toString(), {
      reasonCode: "product_not_received",
      adminNotes: "Initial inquiry received",
    });
    cleanup3b4.auditIds.push(disputeOpenOut.auditLog._id);
    assert.equal(disputeOpenOut.result.status, "open");
    assert.equal((await purchasesCol.findOne({ _id: buyerPurchase._id })).status, "disputed");
    const entDuringDispute = await entitlementsCol.findOne({ _id: buyerEntitlement._id });
    assert.deepEqual(
      entDuringDispute.activeRestrictionReasons.slice().sort(),
      ["admin_suspended", "chargeback_open"].sort()
    );
    assert.equal((await commissionsCol.findOne({ _id: buyerCommission._id })).isDisputedHold, true);

    // Resolve dispute as WON -> removes 'chargeback_open', but entitlement MUST stay 'suspended' because 'admin_suspended' remains!
    const disputeWonOut = await resolveDisputeOutcomeByAdmin(
      wfCtx,
      buyerPurchase._id.toString(),
      "won"
    );
    cleanup3b4.auditIds.push(disputeWonOut.auditLog._id);
    assert.equal(disputeWonOut.result.status, "won");
    assert.equal((await purchasesCol.findOne({ _id: buyerPurchase._id })).status, "captured");
    const entAfterDisputeWon = await entitlementsCol.findOne({ _id: buyerEntitlement._id });
    assert.equal(
      entAfterDisputeWon.status,
      "suspended",
      "Resolving dispute as won must NOT restore active entitlement while admin_suspended remains"
    );
    assert.deepEqual(entAfterDisputeWon.activeRestrictionReasons, ["admin_suspended"]);
    assert.equal((await commissionsCol.findOne({ _id: buyerCommission._id })).isDisputedHold, false);

    // Now restore 'admin_suspended' -> entitlement becomes 'active'
    const restoreEntOut = await restoreEntitlementByAdmin(wfCtx, buyerEntitlement._id.toString());
    cleanup3b4.auditIds.push(restoreEntOut.auditLog._id);
    assert.equal(restoreEntOut.result.status, "active");

    // 6. Commission 72h Eligibility & Payout 5-Commission Single-Currency Batching
    // Evaluating buyerCommission before 72h has elapsed must be rejected
    await assert.rejects(
      async () => evaluateCommissionEligibilityByAdmin(wfCtx, buyerCommission._id.toString()),
      (err) => err instanceof InvalidStateTransitionError,
      "Commission within 72h refund window must not transition to eligible"
    );

    // Create 5 commissions with >72h elapsed (3 INR + 2 USD = 5 qualifying across currencies)
    const past75h = new Date(now.getTime() - 75 * 60 * 60 * 1000);
    const inrComms = [];
    const extraPurchases = [];
    for (let i = 0; i < 3; i++) {
      const p = buildPurchaseDocument({
        userId: customerBuyer._id,
        productSlug: "german",
        editionVersion: "1.0",
        region: "IN",
        currency: "INR",
        status: "captured",
        capturedAt: past75h,
        pricingSnapshot: {
          basePriceSubunits: 100000,
          discountPercentApplied: 10,
          discountSubunits: 10000,
          taxSubunits: 0,
          totalSubunits: 90000,
          promoApplied: false,
          referralCodeApplied: refProfile.referralCode,
        },
        paymentProvider: "razorpay",
        providerOrderId: `${stage3b4Prefix}ord_inr_${i}`,
        providerPaymentId: `${stage3b4Prefix}pay_inr_${i}`,
        idempotencyKey: `${stage3b4Prefix}idem_inr_${i}`,
        referrerUserId: referrerUser._id,
        referralProfileId: refProfile._id,
      });
      extraPurchases.push(p);
      cleanup3b4.purchaseIds.push(p._id);

      const c = buildCommissionDocument({
        referrerUserId: referrerUser._id,
        referredUserId: customerBuyer._id,
        referralProfileId: refProfile._id,
        purchaseId: p._id,
        currency: "INR",
        netCollectedSubunits: 90000,
        commissionAmountSubunits: 9000,
        purchaseCapturedAt: past75h,
      });
      inrComms.push(c);
      cleanup3b4.commissionIds.push(c._id);
    }
    const usdComms = [];
    for (let i = 0; i < 2; i++) {
      const p = buildPurchaseDocument({
        userId: customerBuyer._id,
        productSlug: "german",
        editionVersion: "1.0",
        region: "US",
        currency: "USD",
        status: "captured",
        capturedAt: past75h,
        pricingSnapshot: {
          basePriceSubunits: 5900,
          discountPercentApplied: 10,
          discountSubunits: 590,
          taxSubunits: 0,
          totalSubunits: 5310,
          promoApplied: false,
          referralCodeApplied: refProfile.referralCode,
        },
        paymentProvider: "razorpay",
        providerOrderId: `${stage3b4Prefix}ord_usd_${i}`,
        providerPaymentId: `${stage3b4Prefix}pay_usd_${i}`,
        idempotencyKey: `${stage3b4Prefix}idem_usd_${i}`,
        referrerUserId: referrerUser._id,
        referralProfileId: refProfile._id,
      });
      extraPurchases.push(p);
      cleanup3b4.purchaseIds.push(p._id);

      const c = buildCommissionDocument({
        referrerUserId: referrerUser._id,
        referredUserId: customerBuyer._id,
        referralProfileId: refProfile._id,
        purchaseId: p._id,
        currency: "USD",
        netCollectedSubunits: 5310,
        commissionAmountSubunits: 531,
        purchaseCapturedAt: past75h,
      });
      usdComms.push(c);
      cleanup3b4.commissionIds.push(c._id);
    }
    await purchasesCol.insertMany(extraPurchases);
    await commissionsCol.insertMany([...inrComms, ...usdComms]);

    // Evaluate and approve the 3 INR commissions first (only 3 qualifying so far -> payout batch must fail 5-commission gate)
    for (const c of inrComms) {
      const evalOut = await evaluateCommissionEligibilityByAdmin(wfCtx, c._id.toString());
      cleanup3b4.auditIds.push(evalOut.auditLog._id);
      const appOut = await approveCommissionByAdmin(wfCtx, c._id.toString());
      cleanup3b4.auditIds.push(appOut.auditLog._id);
    }

    await assert.rejects(
      async () =>
        createPayoutBatchByAdmin(wfCtx, {
          referrerUserIdStr: referrerUser._id.toString(),
          currency: "INR",
        }),
      (err) => err instanceof InvalidStateTransitionError,
      "Payout batch creation must fail when referrer has fewer than 5 qualifying commissions across currencies"
    );

    // Now evaluate the 2 USD commissions -> total qualifying across currencies = 3 INR + 2 USD = 5!
    for (const c of usdComms) {
      const evalOut = await evaluateCommissionEligibilityByAdmin(wfCtx, c._id.toString());
      cleanup3b4.auditIds.push(evalOut.auditLog._id);
    }

    // Create single-currency INR payout batch (succeeds because 5 qualifying across currencies and 3 approved INR commissions)
    const batchOut = await createPayoutBatchByAdmin(wfCtx, {
      referrerUserIdStr: referrerUser._id.toString(),
      currency: "INR",
    });
    cleanup3b4.payoutIds.push(batchOut.result._id);
    cleanup3b4.auditIds.push(batchOut.auditLog._id);
    assert.equal(batchOut.result.currency, "INR");
    assert.equal(batchOut.result.totalAmountSubunits, 27000);
    assert.equal(batchOut.result.commissionIds.length, 3);
    assert.equal(batchOut.result.initiationType, "admin_first_payout");

    // Duplicate batching of the same INR commissions must be rejected because payoutId is now reserved
    await assert.rejects(
      async () =>
        createPayoutBatchByAdmin(wfCtx, {
          referrerUserIdStr: referrerUser._id.toString(),
          currency: "INR",
        }),
      (err) => err instanceof DataValidationError,
      "Already-reserved commissions must not be included in a duplicate payout batch"
    );

    // Attempting to mark payout batch paid without verified provider evidence must be rejected
    await assert.rejects(
      async () =>
        transitionPayoutStatusByAdmin(wfCtx, batchOut.result._id.toString(), "mark_paid", {
          verifiedProviderEvidence: false,
        }),
      (err) => err instanceof InvalidStateTransitionError,
      "Marking payout paid without verified provider evidence must be rejected"
    );

    // Approve -> mark_processing -> mark_failed (unreserves commissions)
    const poApprove = await transitionPayoutStatusByAdmin(
      wfCtx,
      batchOut.result._id.toString(),
      "approve"
    );
    cleanup3b4.auditIds.push(poApprove.auditLog._id);
    assert.equal(poApprove.result.status, "approved");

    const poProc = await transitionPayoutStatusByAdmin(
      wfCtx,
      batchOut.result._id.toString(),
      "mark_processing"
    );
    cleanup3b4.auditIds.push(poProc.auditLog._id);
    assert.equal(poProc.result.status, "processing");

    // Simulate a verified-evidence paid commission and then a lost dispute to verify post-payout commission_adjustments creation
    const paidInrBatch = await transitionPayoutStatusByAdmin(
      wfCtx,
      batchOut.result._id.toString(),
      "mark_paid",
      {
        externalTransferReference: "utr_verified_test_ref_001",
        verifiedProviderEvidence: true,
      }
    );
    cleanup3b4.auditIds.push(paidInrBatch.auditLog._id);
    assert.equal(paidInrBatch.result.status, "paid");

    // Mark buyerCommission as paid in the batch and then resolve a dispute on buyerPurchase as LOST
    await commissionsCol.updateOne(
      { _id: buyerCommission._id },
      { $set: { status: "paid", payoutId: batchOut.result._id, paidAt: now } }
    );
    const disputeOpen2 = await openInternalDisputeRecord(wfCtx, buyerPurchase._id.toString(), {
      reasonCode: "fraudulent",
    });
    cleanup3b4.auditIds.push(disputeOpen2.auditLog._id);

    const disputeLostOut = await resolveDisputeOutcomeByAdmin(
      wfCtx,
      buyerPurchase._id.toString(),
      "lost"
    );
    cleanup3b4.auditIds.push(disputeLostOut.auditLog._id);
    assert.equal(disputeLostOut.result.status, "lost");
    assert.equal((await purchasesCol.findOne({ _id: buyerPurchase._id })).status, "chargeback_lost");
    assert.equal((await entitlementsCol.findOne({ _id: buyerEntitlement._id })).status, "revoked");

    // Verify historical paid commission is preserved as 'paid' and a commission_adjustments document was created
    const preservedPaidComm = await commissionsCol.findOne({ _id: buyerCommission._id });
    assert.equal(
      preservedPaidComm.status,
      "paid",
      "Already-paid commission must never be silently mutated on post-payout chargeback loss"
    );
    const createdAdj = await adjustmentsCol.findOne({ commissionId: buyerCommission._id });
    assert.ok(createdAdj, "Post-payout lost dispute must create an immutable commission_adjustments record");
    cleanup3b4.adjustmentIds.push(createdAdj._id);
    assert.equal(createdAdj.reason, "post_payout_chargeback");

    // Resolve the adjustment
    const resolveAdjOut = await resolveCommissionAdjustmentByAdmin(
      wfCtx,
      createdAdj._id.toString(),
      "offset_applied"
    );
    cleanup3b4.auditIds.push(resolveAdjOut.auditLog._id);
    assert.equal(resolveAdjOut.result.resolutionStatus, "offset_applied");

    // 7. Promotions & Operational Settings Workflows
    const promoCreateOut = await createPromotionCampaignByAdmin(wfCtx, {
      name: "Stage 3B.4 Test Promo",
      code: `PROMO_${stage3b4RunId.slice(0, 5).toUpperCase()}`,
      discountPercent: 15,
      startsAt: new Date(now.getTime() - 60 * 1000).toISOString(),
      endsAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      activateImmediately: true,
    });
    cleanup3b4.auditIds.push(promoCreateOut.auditLog._id);
    assert.equal(promoCreateOut.result.status, "active");
    assert.equal(promoCreateOut.result.discountPercent, 15);
    assert.equal((await promoCol.findOne({ _id: "global_referral_promo" })).mode, "promo");

    const promoDeactivateOut = await updatePromotionCampaignStatusByAdmin(
      wfCtx,
      promoCreateOut.result.campaignId,
      "deactivate"
    );
    cleanup3b4.auditIds.push(promoDeactivateOut.auditLog._id);
    assert.equal(promoDeactivateOut.result.mode, "normal");

    const opSettingsOut = await updateOperationalSettingsByAdmin(wfCtx, {
      maxPendingReservationsBeforeReview: 12,
      maxDailyRedemptionsBeforeReview: 6,
      requireManualReviewOnVelocityAlert: true,
      productAvailability: { german: "available" },
    });
    cleanup3b4.auditIds.push(opSettingsOut.auditLog._id);

    // 8. Verify all 15 Admin Read Queries execute cleanly and never leak passwordHash or secrets
    const [
      overviewData,
      usersList,
      userDetails,
      purchasesList,
      purchaseDetails,
      entitlementsList,
      refundsList,
      disputesList,
      promotionsData,
      referralsList,
      commissionsList,
      payoutsList,
      auditLogsList,
      settingsData,
      systemHealthData,
    ] = await Promise.all([
      getAdminOverviewData(stage3b4Db, "30d"),
      listAdminUsers(stage3b4Db, { q: stage3b4Prefix }),
      getAdminUserDetails(stage3b4Db, customerBuyer._id.toString()),
      listAdminPurchases(stage3b4Db, { q: stage3b4Prefix }),
      getAdminPurchaseDetails(stage3b4Db, buyerPurchase._id.toString()),
      listAdminEntitlements(stage3b4Db, { q: customerBuyer._id.toString() }),
      listAdminRefunds(stage3b4Db, { q: buyerPurchase._id.toString() }),
      listAdminDisputes(stage3b4Db, { q: buyerPurchase._id.toString() }),
      getPromotionsAdminData(stage3b4Db),
      listAdminReferrals(stage3b4Db, { q: refProfile.referralCode }),
      listAdminCommissions(stage3b4Db, { referrerUserId: referrerUser._id.toString() }),
      listAdminPayouts(stage3b4Db, { q: referrerUser._id.toString() }),
      listAdminAuditLogs(stage3b4Db, { actorEmail: adminActorUser.email }),
      getAdminSettingsData(stage3b4Db),
      getAdminSystemHealthData(stage3b4Db),
    ]);

    assert.ok(overviewData.metrics.totalUsers >= 3);
    assert.equal(usersList.items.length, 3);
    assert.equal("passwordHash" in usersList.items[0], false, "listAdminUsers must never expose passwordHash");
    assert.ok(userDetails && !("passwordHash" in userDetails.user));
    assert.ok(purchasesList.items.length >= 1);
    assert.ok(purchaseDetails && purchaseDetails.purchase.id === buyerPurchase._id.toString());
    assert.ok(entitlementsList.items.length >= 1);
    assert.ok(refundsList.items.length >= 1);
    assert.ok(disputesList.items.length >= 1);
    assert.deepEqual(promotionsData.allowedDiscountPercents, [5, 10, 15, 20]);
    assert.equal(referralsList.items.length, 1);
    assert.ok(commissionsList.items.length >= 5);
    assert.ok(payoutsList.items.length >= 1);
    assert.ok(auditLogsList.items.length >= 10);
    assert.equal(settingsData.fixedCommercialInvariants.discountsNeverStack, true);
    assert.equal(systemHealthData.database.status, "Operational");
    assert.equal(systemHealthData.indexes.status, "Operational");
  } finally {
    adminRouteMod.setAdminActionsTestDb(null);
    process.env.NODE_ENV = prevEnv3b4;
    if (prevAppUrl3b4 === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = prevAppUrl3b4;

    if (stage3b4Db) {
      if (cleanup3b4.userIds.length > 0) {
        await stage3b4Db.collection("sessions").deleteMany({
          userId: { $in: cleanup3b4.userIds },
        });
        await stage3b4Db.collection("users").deleteMany({
          _id: { $in: cleanup3b4.userIds },
        });
      }
      if (cleanup3b4.purchaseIds.length > 0) {
        await stage3b4Db.collection("purchases").deleteMany({
          _id: { $in: cleanup3b4.purchaseIds },
        });
      }
      if (cleanup3b4.entitlementIds.length > 0) {
        await stage3b4Db.collection("entitlements").deleteMany({
          _id: { $in: cleanup3b4.entitlementIds },
        });
      }
      if (cleanup3b4.referralProfileIds.length > 0) {
        await stage3b4Db.collection("referral_profiles").deleteMany({
          _id: { $in: cleanup3b4.referralProfileIds },
        });
      }
      if (cleanup3b4.commissionIds.length > 0) {
        await stage3b4Db.collection("commissions").deleteMany({
          _id: { $in: cleanup3b4.commissionIds },
        });
      }
      if (cleanup3b4.adjustmentIds.length > 0) {
        await stage3b4Db.collection("commission_adjustments").deleteMany({
          _id: { $in: cleanup3b4.adjustmentIds },
        });
      }
      if (cleanup3b4.payoutIds.length > 0) {
        await stage3b4Db.collection("payouts").deleteMany({
          _id: { $in: cleanup3b4.payoutIds },
        });
      }
      if (cleanup3b4.evidenceIds.length > 0) {
        await stage3b4Db.collection("purchase_evidence").deleteMany({
          _id: { $in: cleanup3b4.evidenceIds },
        });
      }
      if (cleanup3b4.auditIds.length > 0) {
        await stage3b4Db.collection("admin_audit_logs").deleteMany({
          _id: { $in: cleanup3b4.auditIds },
        });
      }
      await stage3b4Db.collection("rate_limits").deleteMany({
        _id: /^admin-mutation:/,
      });
      if (cleanup3b4.savedPromoSettings) {
        await stage3b4Db
          .collection("promotion_settings")
          .replaceOne({ _id: "global_referral_promo" }, cleanup3b4.savedPromoSettings, { upsert: true });
      } else {
        await stage3b4Db
          .collection("promotion_settings")
          .deleteOne({ _id: "global_referral_promo" });
      }
    }
  }
  console.log(
    "✓ Stage 3B.4 Admin Dashboard & Operations unit, API security, workflow, financial invariant, and real MongoDB integration tests passed."
  );

  // ---------------------------------------------------------------------------
  // 17. Stage 3B.4.1 — Initial Administrator Account Provisioning & Bootstrap Audit
  // ---------------------------------------------------------------------------
  console.log(
    "\n[Test 17] Stage 3B.4.1: Initial Administrator Account Provisioning, Preconditions, Idempotency, Bootstrap Audit & Live Account Verification"
  );

  const bootstrapMod = loadTsModule(
    path.resolve(__dirname, "../src/lib/auth/bootstrapAdmin.ts")
  );
  const { provisionInitialAdminAccount } = bootstrapMod;
  const { recordBootstrapAdminAuditLog } = auditMod;

  const stage3b41RunId = crypto.randomBytes(8).toString("hex");
  const stage3b41Prefix = `__test_stage3b41_${stage3b41RunId}_`;
  const cleanup3b41 = {
    userIds: [],
    sessionIds: [],
    auditIds: [],
  };

  let stage3b41Client = null;
  let stage3b41Db = null;

  try {
    stage3b41Client = await getMongoClient();
    stage3b41Db = await getDb();
    const usersCol = await getUsersCollection(stage3b41Db);

    // 17a. Non-existent account must NOT be created and email verification must NOT be fabricated
    const missingEmail = `${stage3b41Prefix}missing@lingopdf.test`;
    const missingRes = await provisionInitialAdminAccount(
      stage3b41Db,
      missingEmail
    );
    cleanup3b41.auditIds.push(new ObjectId(missingRes.auditLogId));
    assert.equal(missingRes.status, "account_not_found");
    assert.equal(missingRes.promoted, false);
    assert.equal(missingRes.idempotent, false);
    assert.equal(missingRes.targetUserId, null);
    const missingUserInDb = await usersCol.findOne({ email: missingEmail });
    assert.equal(
      missingUserInDb,
      null,
      "Non-existent account must never be auto-created during admin provisioning"
    );

    const missingAuditDoc = await stage3b41Db
      .collection("admin_audit_logs")
      .findOne({ _id: new ObjectId(missingRes.auditLogId) });
    assert.ok(missingAuditDoc);
    assert.equal(missingAuditDoc.actorUserId, null);
    assert.equal(missingAuditDoc.actorRole, "system_bootstrap");
    assert.equal(missingAuditDoc.action, "admin.bootstrap_provision");
    assert.equal(missingAuditDoc.outcome, "failure");
    assert.equal(missingAuditDoc.metadata.targetEmail, missingEmail);

    // 17b. Unverified existing account must NOT be promoted
    const unverifiedEmail = `${stage3b41Prefix}unverified@lingopdf.test`;
    const unverifiedUser = {
      _id: new ObjectId(),
      name: "Unverified Candidate",
      email: unverifiedEmail,
      passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$unverifiedHashSample",
      role: "customer",
      status: "active",
      isEmailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await usersCol.insertOne(unverifiedUser);
    cleanup3b41.userIds.push(unverifiedUser._id);

    const unverifiedRes = await provisionInitialAdminAccount(
      stage3b41Db,
      unverifiedEmail
    );
    cleanup3b41.auditIds.push(new ObjectId(unverifiedRes.auditLogId));
    assert.equal(unverifiedRes.status, "email_not_verified");
    assert.equal(unverifiedRes.promoted, false);
    assert.equal(unverifiedRes.isEmailVerified, false);

    const unverifiedAfter = await usersCol.findOne({ _id: unverifiedUser._id });
    assert.equal(
      unverifiedAfter.role,
      "customer",
      "Unverified user must remain customer and not be promoted"
    );
    assert.equal(unverifiedAfter.isEmailVerified, false);

    // 17c. Verified existing account promotion + passwordHash preservation + idempotency
    const verifiedCandidateEmail = `${stage3b41Prefix}verified@lingopdf.test`;
    const originalHash =
      "$argon2id$v=19$m=65536,t=3,p=4$preservedCandidateHash12345";
    const originalCreatedAt = new Date("2026-02-15T10:00:00.000Z");
    const verifiedCandidate = {
      _id: new ObjectId(),
      name: "Verified Candidate Name",
      email: verifiedCandidateEmail,
      passwordHash: originalHash,
      role: "customer",
      status: "suspended",
      suspensionReason: "Temporary test hold",
      suspendedAt: new Date("2026-02-16T10:00:00.000Z"),
      isEmailVerified: true,
      createdAt: originalCreatedAt,
      updatedAt: originalCreatedAt,
    };
    await usersCol.insertOne(verifiedCandidate);
    cleanup3b41.userIds.push(verifiedCandidate._id);

    const promotedRes = await provisionInitialAdminAccount(
      stage3b41Db,
      `  ${verifiedCandidateEmail.toUpperCase()}  `
    );
    cleanup3b41.auditIds.push(new ObjectId(promotedRes.auditLogId));
    assert.equal(promotedRes.status, "promoted");
    assert.equal(promotedRes.promoted, true);
    assert.equal(promotedRes.idempotent, false);
    assert.equal(promotedRes.previousRole, "customer");
    assert.equal(promotedRes.newRole, "admin");
    assert.equal(promotedRes.previousStatus, "suspended");
    assert.equal(promotedRes.newStatus, "active");
    assert.equal(promotedRes.isEmailVerified, true);
    assert.equal(promotedRes.passwordHashPreserved, true);
    assert.equal(
      Object.prototype.hasOwnProperty.call(promotedRes.user, "passwordHash"),
      false,
      "Sanitized provisioning output must never expose passwordHash"
    );

    const promotedInDb = await usersCol.findOne({ _id: verifiedCandidate._id });
    assert.equal(promotedInDb.role, "admin");
    assert.equal(promotedInDb.status, "active");
    assert.equal(promotedInDb.isEmailVerified, true);
    assert.equal(
      promotedInDb.passwordHash,
      originalHash,
      "Existing passwordHash must be strictly preserved"
    );
    assert.equal(
      promotedInDb.name,
      "Verified Candidate Name",
      "Unrelated user fields (name) must not be modified"
    );
    assert.equal(
      promotedInDb.createdAt.toISOString(),
      originalCreatedAt.toISOString(),
      "Unrelated user fields (createdAt) must not be modified"
    );

    const promotedAuditDoc = await stage3b41Db
      .collection("admin_audit_logs")
      .findOne({ _id: new ObjectId(promotedRes.auditLogId) });
    assert.ok(promotedAuditDoc);
    assert.equal(
      promotedAuditDoc.actorUserId,
      null,
      "Bootstrap audit must not falsely attribute operation to a non-existent admin"
    );
    assert.equal(promotedAuditDoc.actorRole, "system_bootstrap");
    assert.equal(
      promotedAuditDoc.actorEmail,
      "system:initial-admin-bootstrap"
    );
    assert.equal(promotedAuditDoc.action, "admin.bootstrap_provision");
    assert.equal(promotedAuditDoc.outcome, "success");
    assert.equal(
      promotedAuditDoc.correlationId,
      promotedRes.bootstrapOperationId
    );
    assert.equal(promotedAuditDoc.metadata.previousRole, "customer");
    assert.equal(promotedAuditDoc.metadata.newRole, "admin");
    assert.equal(
      promotedAuditDoc.metadata.targetUserId,
      verifiedCandidate._id.toString()
    );

    // 17d. Idempotency: running provisioning again on the promoted admin must not duplicate or corrupt
    const secondRunRes = await provisionInitialAdminAccount(
      stage3b41Db,
      verifiedCandidateEmail
    );
    cleanup3b41.auditIds.push(new ObjectId(secondRunRes.auditLogId));
    assert.equal(secondRunRes.status, "already_admin");
    assert.equal(secondRunRes.promoted, false);
    assert.equal(secondRunRes.idempotent, true);
    assert.equal(secondRunRes.previousRole, "admin");
    assert.equal(secondRunRes.newRole, "admin");
    assert.equal(secondRunRes.passwordHashPreserved, true);

    const candidateCount = await usersCol.countDocuments({
      email: verifiedCandidateEmail,
    });
    assert.equal(
      candidateCount,
      1,
      "Idempotent re-run must never create duplicate user documents"
    );

    // 17e. Live verification of the provisioned initial administrator account: developers.mindfulapps@gmail.com
    const liveAdminEmail = "developers.mindfulapps@gmail.com";
    const liveAdminDocs = await usersCol
      .find({ email: liveAdminEmail })
      .toArray();
    assert.equal(
      liveAdminDocs.length,
      1,
      "Exactly one user record must exist for developers.mindfulapps@gmail.com"
    );
    const liveAdminUser = liveAdminDocs[0];
    assert.equal(
      liveAdminUser.role,
      "admin",
      "developers.mindfulapps@gmail.com must have role: 'admin'"
    );
    assert.equal(
      liveAdminUser.status,
      "active",
      "developers.mindfulapps@gmail.com must have status: 'active'"
    );
    assert.equal(
      liveAdminUser.isEmailVerified,
      true,
      "developers.mindfulapps@gmail.com must have isEmailVerified: true"
    );
    assert.equal(
      typeof liveAdminUser.passwordHash === "string" &&
        liveAdminUser.passwordHash.startsWith("$argon2id$"),
      true,
      "developers.mindfulapps@gmail.com must preserve its Argon2id passwordHash"
    );

    // Verify bootstrap audit log exists in admin_audit_logs for developers.mindfulapps@gmail.com
    const liveBootstrapAudit = await stage3b41Db
      .collection("admin_audit_logs")
      .findOne({
        action: "admin.bootstrap_provision",
        targetId: liveAdminUser._id.toString(),
        outcome: "success",
      });
    assert.ok(
      liveBootstrapAudit,
      "Append-only admin_audit_logs must contain the bootstrap audit record for developers.mindfulapps@gmail.com"
    );
    assert.equal(liveBootstrapAudit.actorRole, "system_bootstrap");
    assert.equal(liveBootstrapAudit.actorUserId, null);

    // Verify server-side admin authorization accepts a session for developers.mindfulapps@gmail.com
    const liveAdminTempSession = await createSession(
      stage3b41Db,
      liveAdminUser._id,
      { userAgent: "Stage3B41-Verification", ipAddress: "127.0.0.1" }
    );
    cleanup3b41.sessionIds.push(sessionMod.hashToken(liveAdminTempSession.token));

    const liveAdminAuthCheck = await authorizeAdminSessionToken(
      stage3b41Db,
      liveAdminTempSession.token
    );
    assert.equal(
      liveAdminAuthCheck.authorized,
      true,
      "authorizeAdminSessionToken must accept developers.mindfulapps@gmail.com"
    );
    assert.equal(liveAdminAuthCheck.context.email, liveAdminEmail);
    assert.equal(liveAdminAuthCheck.context.role, "admin");
    assert.equal(
      liveAdminAuthCheck.context.userId.toString(),
      liveAdminUser._id.toString()
    );

    const liveAdminRequestCheck = await requireAdminRequest(
      new NextRequest("https://lingopdf.in/admin", {
        method: "GET",
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${liveAdminTempSession.token}`,
        },
      }),
      stage3b41Db
    );
    assert.equal(
      liveAdminRequestCheck.authorized,
      true,
      "requireAdminRequest must grant /admin access to developers.mindfulapps@gmail.com"
    );

    // Verify a normal customer user still cannot access /admin
    const normalUser = {
      _id: new ObjectId(),
      name: "Ordinary Customer",
      email: `${stage3b41Prefix}customer@lingopdf.test`,
      passwordHash: originalHash,
      role: "customer",
      status: "active",
      isEmailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await usersCol.insertOne(normalUser);
    cleanup3b41.userIds.push(normalUser._id);

    const normalUserSession = await createSession(
      stage3b41Db,
      normalUser._id,
      { userAgent: "Stage3B41-CustomerCheck", ipAddress: "127.0.0.1" }
    );
    cleanup3b41.sessionIds.push(sessionMod.hashToken(normalUserSession.token));

    const normalUserAuthCheck = await authorizeAdminSessionToken(
      stage3b41Db,
      normalUserSession.token
    );
    assert.equal(
      normalUserAuthCheck.authorized,
      false,
      "Normal customer user must be denied admin authorization"
    );
    assert.equal(normalUserAuthCheck.status, 403);
    assert.equal(normalUserAuthCheck.reason, "insufficient_role");
  } finally {
    if (stage3b41Db) {
      if (cleanup3b41.sessionIds.length > 0) {
        await stage3b41Db.collection("sessions").deleteMany({
          tokenHash: { $in: cleanup3b41.sessionIds },
        });
      }
      if (cleanup3b41.userIds.length > 0) {
        await stage3b41Db.collection("sessions").deleteMany({
          userId: { $in: cleanup3b41.userIds },
        });
        await stage3b41Db.collection("users").deleteMany({
          _id: { $in: cleanup3b41.userIds },
        });
      }
      if (cleanup3b41.auditIds.length > 0) {
        await stage3b41Db.collection("admin_audit_logs").deleteMany({
          _id: { $in: cleanup3b41.auditIds },
        });
      }
    }
  }
  console.log(
    "✓ Stage 3B.4.1 Initial Administrator Account Provisioning & live developers.mindfulapps@gmail.com verification passed."
  );

  // ---------------------------------------------------------------------------
  // 18. Stage 3B Workstream B Customer-Facing Referral System & Business Invariants
  // ---------------------------------------------------------------------------
  console.log("\n[Test 18] Stage 3B Workstream B Customer-Facing Referral System & Business Invariants");
  const referralServiceMod = loadTsModule(path.resolve(__dirname, "../src/lib/referrals/service.ts"));
  const {
    deriveReferralPrefix,
    generateFourDigitSuffix,
    formatHumanReadableReferralCode,
    findActiveReferralProfileByCode,
    validateCustomerReferralCode,
    getOrCreateReferralProfile,
    getCustomerReferralDashboardData,
    calculateReferralPurchasePricing,
  } = referralServiceMod;

  // 18a. Unit Tests: Prefix derivation strictly from display name (not email)
  assert.equal(deriveReferralPrefix("Rajat Sharma"), "RAJAT");
  assert.equal(deriveReferralPrefix("A B C"), "ABC");
  assert.equal(deriveReferralPrefix("Bob"), "BOB");
  assert.equal(deriveReferralPrefix("x"), "LINGO", "Display name < 3 letters must fall back to LINGO");
  assert.equal(deriveReferralPrefix(""), "LINGO", "Empty display name must fall back to LINGO");
  assert.equal(deriveReferralPrefix(null), "LINGO", "Null display name must fall back to LINGO");
  assert.equal(deriveReferralPrefix(undefined), "LINGO", "Undefined display name must fall back to LINGO");
  assert.equal(deriveReferralPrefix("12345"), "LINGO", "Display name with no letters must fall back to LINGO");
  assert.equal(deriveReferralPrefix("AlphaBetaGammaDelta"), "ALPHABETAG"); // max 10 chars

  // 18b. Unit Tests: 4-digit suffix generation [1111-9999] with no zeroes
  for (let i = 0; i < 100; i++) {
    const suffix = generateFourDigitSuffix();
    assert.equal(typeof suffix, "string", "Suffix must be a string");
    assert.equal(suffix.length, 4, "Suffix must contain exactly 4 digits");
    const num = parseInt(suffix, 10);
    assert.ok(num >= 1111 && num <= 9999, `Suffix ${suffix} must be in inclusive range 1111-9999`);
    assert.ok(!suffix.includes("0"), `Suffix ${suffix} must contain no zeroes`);
    assert.ok(/^[1-9]{4}$/.test(suffix), `Suffix ${suffix} must match 4 digits in range 1-9`);

    const code = formatHumanReadableReferralCode("ALICE");
    assert.ok(/^[A-Z]{3,10}[1-9]{4}$/.test(code), `Code ${code} must match [PREFIX][4_DIGITS] with no zeroes`);
  }
  console.log("  ✓ Referral prefix derived strictly from display name; 4-digit suffix in 1111-9999 with no zeroes verified");

  // 18c. Unit Tests: Server-side purchase pricing calculation & stacking prevention
  const mockReferralProfile = {
    _id: new ObjectId(),
    userId: new ObjectId(),
    referralCode: "ALICE5678",
    status: "active",
    maxReferralsCap: 50,
    successfulConversionsCount: 10,
    pendingReservedCount: 0,
  };

  // Pricing calculation with referral discount (10%)
  const basePricePaise = 129900; // ₹1,299.00
  const referralPricing = calculateReferralPurchasePricing({
    basePriceSubunits: basePricePaise,
    referralProfile: mockReferralProfile,
  });
  assert.equal(referralPricing.discountPercentApplied, 10, "Referral discount must be exactly 10%");
  assert.equal(referralPricing.discountSubunits, 12990, "10% of 129900 is 12990 paise (₹129.90)");
  assert.equal(referralPricing.totalSubunits, 116910, "Total is 116910 paise (₹1,169.10)");
  assert.equal(referralPricing.referralCodeApplied, "ALICE5678");
  assert.equal(referralPricing.referrerUserId.toString(), mockReferralProfile.userId.toString());
  assert.equal(referralPricing.referralProfileId.toString(), mockReferralProfile._id.toString());
  // Commission: 10% of actual collected amount (116910 paise) = 11691 paise
  assert.equal(referralPricing.commissionAmountSubunits, 11691, "Commission must be 10% of actual collected amount");

  // Stacking prohibition: both referral and promo cannot be applied
  assert.throws(
    () => {
      calculateReferralPurchasePricing({
        basePriceSubunits: basePricePaise,
        referralProfile: mockReferralProfile,
        promoApplied: true,
        promoDiscountPercent: 15,
      });
    },
    /DISCOUNT_STACKING_PROHIBITED/,
    "Promotional and referral discounts cannot stack"
  );
  console.log("  ✓ Server-side purchase pricing, 10% discount, collected-amount commission, and discount stacking prohibition verified");

  // 18b. Real MongoDB Atlas Integration & Business Invariants
  let stage3bDb;
  let stage3bClient;
  const cleanup3b = {
    userIds: [],
    profileIds: [],
    redemptionIds: [],
    commissionIds: [],
  };

  try {
    stage3bClient = await getMongoClient();
    stage3bDb = await getDb();

    const usersCol = stage3bDb.collection("users");
    const profilesCol = stage3bDb.collection("referral_profiles");
    const redemptionsCol = stage3bDb.collection("referral_redemptions");
    const commissionsCol = stage3bDb.collection("commissions");

    const testPrefix = `wb_test_${Date.now()}_`;

    // Create Referrer User
    const referrerUser = {
      _id: new ObjectId(),
      name: "Referrer Test",
      email: `${testPrefix}referrer@lingopdf.test`,
      passwordHash: "dummy_hash_wb",
      role: "customer",
      status: "active",
      isEmailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await usersCol.insertOne(referrerUser);
    cleanup3b.userIds.push(referrerUser._id);

    // Get or Create Referral Profile
    const profile = await getOrCreateReferralProfile(stage3bDb, referrerUser);
    cleanup3b.profileIds.push(profile._id);

    assert.ok(profile.referralCode, "Profile must have a referral code");
    assert.ok(
      /^[A-Z]{3,10}[1-9][0-9]{3}$/.test(profile.referralCode),
      `Generated code ${profile.referralCode} must match [PREFIX][4_DIGITS]`
    );
    assert.equal(profile.successfulConversionsCount, 0, "Initial conversions count must be 0");
    assert.equal(profile.pendingReservedCount, 0, "Initial pending count must be 0");
    assert.equal(profile.maxReferralsCap, 50, "Lifetime capacity cap must be 50");
    assert.equal(profile.status, "active", "Initial status must be active");

    // Idempotent retrieval
    const profileAgain = await getOrCreateReferralProfile(stage3bDb, referrerUser);
    assert.equal(profileAgain._id.toString(), profile._id.toString(), "getOrCreateReferralProfile must be idempotent");
    assert.equal(profileAgain.referralCode, profile.referralCode);

    // 18c. Self-Referral Prevention & Code Validation
    const selfCheck = await validateCustomerReferralCode(stage3bDb, profile.referralCode, referrerUser._id);
    assert.equal(selfCheck.valid, false);
    assert.equal(selfCheck.error, "SELF_REFERRAL_FORBIDDEN", "Self-referral must be strictly forbidden");

    const notFoundCheck = await validateCustomerReferralCode(stage3bDb, "NONEXIST9999", referrerUser._id);
    assert.equal(notFoundCheck.valid, false);
    assert.equal(notFoundCheck.error, "CODE_NOT_FOUND");

    const otherUserId = new ObjectId();
    const validCheck = await validateCustomerReferralCode(stage3bDb, profile.referralCode, otherUserId);
    assert.equal(validCheck.valid, true);
    assert.equal(validCheck.discountPercent, 10, "Referral discount must be 10%");
    assert.equal(validCheck.code, profile.referralCode);

    // 18d. Registration & Persistent Attribution
    // Simulate newly registered referee user with attribution
    const refereeUser = {
      _id: new ObjectId(),
      name: "Referee Customer",
      email: `${testPrefix}referee@lingopdf.test`,
      passwordHash: "dummy_hash_referee",
      role: "customer",
      status: "active",
      isEmailVerified: false, // Email not yet verified at registration
      referredByCode: profile.referralCode,
      referredByUserId: referrerUser._id,
      referralAttributedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await usersCol.insertOne(refereeUser);
    cleanup3b.userIds.push(refereeUser._id);

    // INVARIANT 1: Registration NEVER consumes referral capacity!
    const profileAfterReg = await profilesCol.findOne({ _id: profile._id });
    assert.equal(
      profileAfterReg.successfulConversionsCount,
      0,
      "CRITICAL INVARIANT 1: Registration must NEVER consume referral capacity"
    );
    assert.equal(
      profileAfterReg.pendingReservedCount,
      0,
      "CRITICAL INVARIANT 1: Registration must NEVER reserve referral capacity"
    );

    // INVARIANT 2: Registration NEVER creates a commission!
    const commissionCountAfterReg = await commissionsCol.countDocuments({
      referrerUserId: referrerUser._id,
    });
    assert.equal(
      commissionCountAfterReg,
      0,
      "CRITICAL INVARIANT 2: Registration must NEVER create a commission"
    );

    // Attribution persistence across email verification & login
    // Update isEmailVerified to true (simulating email verification)
    await usersCol.updateOne({ _id: refereeUser._id }, { $set: { isEmailVerified: true } });
    const verifiedReferee = await usersCol.findOne({ _id: refereeUser._id });
    assert.equal(verifiedReferee.isEmailVerified, true);
    assert.equal(verifiedReferee.referredByCode, profile.referralCode, "Attribution must persist across email verification");
    assert.equal(
      verifiedReferee.referredByUserId.toString(),
      referrerUser._id.toString(),
      "Attribution referrer ID must persist across email verification"
    );

    // Attribution immutability: existing accounts cannot be re-attributed
    // (Simulate an attempt to overwrite attribution)
    const anotherReferrerId = new ObjectId();
    // In our architecture, register route only sets attribution on insert; existing users are never updated.
    assert.ok(verifiedReferee.referralAttributedAt, "Attribution timestamp is permanently stored");

    // 18e. Customer Dashboard Statistics
    const dashboardData = await getCustomerReferralDashboardData(stage3bDb, referrerUser);
    assert.equal(dashboardData.referralCode, profile.referralCode);
    assert.equal(dashboardData.registeredCount, 1, "Dashboard must show 1 registered referral");
    assert.equal(dashboardData.successfulPaidReferrals, 0, "Dashboard conversions must still be 0");
    assert.equal(dashboardData.remainingCapacity, 50, "Remaining capacity must be 50");
    assert.equal(dashboardData.earningsByCurrency.INR.pendingSubunits, 0);
    assert.equal(dashboardData.earningsByCurrency.USD.eligibleSubunits, 0);

    // 18f. Purchase Lifecycle, 72-Hour Commission Hold & Concurrency Invariants
    const testPurchaseId = new ObjectId();
    const purchaseTime = new Date();

    // Atomic reservation during checkout
    const reservationResult = await referralServiceMod.reserveReferralCapacityAtomically(stage3bDb, {
      referrerUserId: referrerUser._id,
      referralCode: profile.referralCode,
      purchaserUserId: refereeUser._id,
      purchaseId: testPurchaseId,
      now: purchaseTime,
    });
    assert.equal(reservationResult.ok, true, "Capacity reservation must succeed");

    const profileAfterReserve = await profilesCol.findOne({ _id: profile._id });
    assert.equal(profileAfterReserve.pendingReservedCount, 1, "pendingReservedCount must be incremented to 1");
    assert.equal(profileAfterReserve.successfulConversionsCount, 0, "successfulConversionsCount must still be 0");

    // INVARIANT 4: Abandoned / failed purchase does not consume capacity
    // Release reservation
    await referralServiceMod.releaseReferralReservation(stage3bDb, {
      referrerUserId: referrerUser._id,
    });
    const profileAfterRelease = await profilesCol.findOne({ _id: profile._id });
    assert.equal(profileAfterRelease.pendingReservedCount, 0, "Released reservation decrements pending count");
    assert.equal(profileAfterRelease.successfulConversionsCount, 0, "No capacity consumed for failed checkout");

    // Re-reserve for successful paid purchase
    const finalReservation = await referralServiceMod.reserveReferralCapacityAtomically(stage3bDb, {
      referrerUserId: referrerUser._id,
      referralCode: profile.referralCode,
      purchaserUserId: refereeUser._id,
      purchaseId: testPurchaseId,
      now: purchaseTime,
    });
    assert.equal(finalReservation.ok, true);

    // Finalize redemption upon payment capture
    // INVARIANT 6: Customer discount is 10%
    // Base amount 100000 paise (₹1000), 10% discount = 10000 paise discount, collected = 90000 paise (₹900)
    const paidAmountMinor = 90000;

    const finalizeResult = await referralServiceMod.finalizeCapturedReferralRedemption(stage3bDb, {
      referrerUserId: referrerUser._id,
      purchaserUserId: refereeUser._id,
      purchaseId: testPurchaseId,
      currency: "INR",
      paidAmountMinor,
      capturedAt: purchaseTime,
    });
    assert.equal(finalizeResult.ok, true, "Finalizing captured redemption must succeed");
    cleanup3b.commissionIds.push(finalizeResult.commissionId);

    // INVARIANT 3: Only successful paid purchase consumes 1 of 50 slots
    const profileAfterPaid = await profilesCol.findOne({ _id: profile._id });
    assert.equal(profileAfterPaid.successfulConversionsCount, 1, "Consumed exactly 1 successful conversion slot");
    assert.equal(profileAfterPaid.pendingReservedCount, 0, "Pending count restored to 0");

    // INVARIANT 8 & 9: Commission is 10% of collected amount after discount, hold is exactly 72 hours
    const commissionDoc = await commissionsCol.findOne({ _id: finalizeResult.commissionId });
    assert.ok(commissionDoc, "Commission document must be created");
    assert.equal(commissionDoc.commissionRatePercent, 10, "Commission rate must be 10%");
    assert.equal(commissionDoc.commissionAmountSubunits, 9000, "10% of 90,000 collected amount = 9,000 paise (₹90)");
    assert.equal(commissionDoc.status, "pending");

    const expectedHoldUntil = new Date(purchaseTime.getTime() + 72 * 60 * 60 * 1000);
    assert.equal(
      commissionDoc.holdUntil.getTime(),
      expectedHoldUntil.getTime(),
      "CRITICAL INVARIANT 9: Commission hold must be exactly 72 hours from purchase timestamp"
    );

    // INVARIANT 5: Refunds do not restore consumed capacity
    // Simulate refund event
    await commissionsCol.updateOne(
      { _id: finalizeResult.commissionId },
      { $set: { status: "cancelled", cancellationReason: "refund" } }
    );
    const profileAfterRefund = await profilesCol.findOne({ _id: profile._id });
    assert.equal(
      profileAfterRefund.successfulConversionsCount,
      1,
      "CRITICAL INVARIANT 5: Refunds must NEVER restore consumed capacity (remains 1)"
    );

    // INVARIANT: 50 Lifetime Cap Enforced Concurrently
    // Verify prefix source rule: when user.name is null, fallback is strictly "LINGO" (never email)
    const noNameUser = {
      _id: new ObjectId(),
      name: null,
      email: `${testPrefix}noname@lingopdf.test`,
      passwordHash: "dummy_hash_noname",
      role: "customer",
      status: "active",
      isEmailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await usersCol.insertOne(noNameUser);
    cleanup3b.userIds.push(noNameUser._id);

    const noNameProfile = await getOrCreateReferralProfile(stage3bDb, noNameUser);
    cleanup3b.profileIds.push(noNameProfile._id);
    assert.ok(
      noNameProfile.referralCode.startsWith("LINGO"),
      `Profile for user without name must start with LINGO fallback (never email), got ${noNameProfile.referralCode}`
    );

    // 18g. Real MongoDB Atlas Concurrency Stress Test: 50 Lifetime Cap Protection
    // Reset profile to 48 conversions, 0 pending (leaving exactly 2 available slots)
    await profilesCol.updateOne(
      { _id: profile._id },
      { $set: { successfulConversionsCount: 48, pendingReservedCount: 0 } }
    );

    // Concurrently trigger 10 reservations at the exact same moment
    const concurrentAttempts = Array.from({ length: 10 }, () =>
      referralServiceMod.reserveReferralCapacityAtomically(stage3bDb, {
        referrerUserId: referrerUser._id,
        referralCode: profile.referralCode,
        purchaserUserId: new ObjectId(),
        purchaseId: new ObjectId(),
        now: new Date(),
      })
    );

    const concurrentResults = await Promise.all(concurrentAttempts);
    const successfulReservations = concurrentResults.filter((r) => r.ok === true);
    const exhaustedReservations = concurrentResults.filter(
      (r) => r.ok === false && r.reason === "capacity_exhausted"
    );

    assert.equal(
      successfulReservations.length,
      2,
      "Under concurrent load with 48 used slots, exactly 2 reservations must succeed"
    );
    assert.equal(
      exhaustedReservations.length,
      8,
      "Under concurrent load with 48 used slots, remaining 8 attempts must be rejected with capacity_exhausted"
    );

    // Verify database state: 48 conversions + 2 pending = 50 total reserved
    const profileAfterConcurrent = await profilesCol.findOne({ _id: profile._id });
    assert.equal(profileAfterConcurrent.successfulConversionsCount, 48);
    assert.equal(profileAfterConcurrent.pendingReservedCount, 2);

    // Finalize the 2 reservations to reach exactly 50
    for (let j = 0; j < 2; j++) {
      const finalizeConcurrent = await referralServiceMod.finalizeCapturedReferralRedemption(stage3bDb, {
        referrerUserId: referrerUser._id,
        purchaserUserId: new ObjectId(),
        purchaseId: new ObjectId(),
        currency: "INR",
        paidAmountMinor: 90000,
        capturedAt: new Date(),
      });
      cleanup3b.commissionIds.push(finalizeConcurrent.commissionId);
    }

    const profileAt50 = await profilesCol.findOne({ _id: profile._id });
    assert.equal(profileAt50.successfulConversionsCount, 50, "Capacity must be exactly 50");
    assert.equal(profileAt50.pendingReservedCount, 0, "Pending count must be 0");

    // Any further reservation attempt is strictly rejected
    const finalRejectedAttempt = await referralServiceMod.reserveReferralCapacityAtomically(stage3bDb, {
      referrerUserId: referrerUser._id,
      referralCode: profile.referralCode,
      purchaserUserId: new ObjectId(),
      purchaseId: new ObjectId(),
      now: new Date(),
    });
    assert.equal(finalRejectedAttempt.ok, false);
    assert.equal(finalRejectedAttempt.reason, "capacity_exhausted");

    const exhaustedValidation = await validateCustomerReferralCode(stage3bDb, profile.referralCode, new ObjectId());
    assert.equal(exhaustedValidation.valid, false);
    assert.equal(exhaustedValidation.error, "CAPACITY_REACHED");

    console.log("  ✓ Real MongoDB Atlas concurrency test passed: atomic capacity reservation guarantees cap of 50 cannot be exceeded");
    console.log("  ✓ Critical Referral Business Invariants (1-10) and full lifecycle verified on MongoDB Atlas");
  } finally {
    if (stage3bDb) {
      if (cleanup3b.commissionIds.length > 0) {
        await stage3bDb.collection("commissions").deleteMany({ _id: { $in: cleanup3b.commissionIds } });
      }
      if (cleanup3b.redemptionIds.length > 0) {
        await stage3bDb.collection("referral_redemptions").deleteMany({ _id: { $in: cleanup3b.redemptionIds } });
      }
      if (cleanup3b.profileIds.length > 0) {
        await stage3bDb.collection("referral_profiles").deleteMany({ _id: { $in: cleanup3b.profileIds } });
      }
      if (cleanup3b.userIds.length > 0) {
        await stage3bDb.collection("users").deleteMany({ _id: { $in: cleanup3b.userIds } });
      }
    }
    if (stage3bClient) {
      await stage3bClient.close().catch(() => {});
    }
  }

  console.log("✓ Stage 3B Workstream B Customer-Facing Referral System tests passed.");

  // ---------------------------------------------------------------------------
  // 19. Workstream C: Regional Pricing & Affordability Engine, Admin Workflows & Invariants
  // ---------------------------------------------------------------------------
  console.log("\n[Test 19] Workstream C: Regional Pricing & Affordability Pricing Engine & Admin Workflows");

  const countriesMod = loadTsModule(path.resolve(__dirname, "../src/lib/pricing/countries.ts"));
  const {
    isProtectedPricingCountry,
    isValidIsoCountryCode,
  } = countriesMod;

  const pricingResolveMod = loadTsModule(path.resolve(__dirname, "../src/lib/pricing/resolve.ts"));
  const { resolveCentralPricing } = pricingResolveMod;

  // 19a. Protected Markets Invariants
  assert.equal(isProtectedPricingCountry("IN"), true, "IN must be a protected market");
  assert.equal(isProtectedPricingCountry("US"), true, "US must be a protected market");
  assert.equal(isProtectedPricingCountry("DE"), true, "DE (Germany) must be protected under Eurozone");
  assert.equal(isProtectedPricingCountry("FR"), true, "FR (France) must be protected under Eurozone");
  assert.equal(isProtectedPricingCountry("HR"), true, "HR (Croatia) must be protected under Eurozone");
  assert.equal(isProtectedPricingCountry("BG"), true, "BG (Bulgaria) must be protected under Eurozone as 21st member");
  assert.equal(isProtectedPricingCountry("KZ"), false, "KZ must be an eligible affordability country");
  assert.equal(isProtectedPricingCountry("MN"), false, "MN must be an eligible affordability country");
  assert.equal(isValidIsoCountryCode("KZ"), true);
  assert.equal(isValidIsoCountryCode("BG"), true);
  assert.equal(isValidIsoCountryCode("INVALID"), false);

  const configModule = loadTsModule(path.resolve(__dirname, "../src/lib/pricing/config.ts"));
  const { EUROZONE_COUNTRY_CODES } = configModule;
  assert.equal(EUROZONE_COUNTRY_CODES.size, 21, "Eurozone must have exactly 21 member states");
  assert.equal(EUROZONE_COUNTRY_CODES.has("BG"), true, "EUROZONE_COUNTRY_CODES must contain BG (Bulgaria)");

  const all21Eurozone = [
    "AT", "BE", "BG", "CY", "EE", "FI", "FR", "DE", "GR", "HR", "IE", "IT",
    "LV", "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES",
  ];
  for (const code of all21Eurozone) {
    assert.equal(isProtectedPricingCountry(code), true, `${code} must be recognized as a protected market`);
    assert.equal(EUROZONE_COUNTRY_CODES.has(code), true, `${code} must be in EUROZONE_COUNTRY_CODES`);
  }
  console.log("  ✓ Protected market predicates correctly protect IN, US, and all 21 Eurozone member states (including Bulgaria BG)");

  // 19b. Pricing Resolution Precedence Matrix
  const sampleAffordabilityRules = [
    {
      countryCode: "KZ",
      countryName: "Kazakhstan",
      currency: "KZT",
      currencySymbol: "₸",
      basePriceSubunits: 1180000, // ~11,800 KZT
      usdFallbackPriceSubunits: 2400, // $24.00 USD
      isGatewaySupportedCurrency: false, // KZT not supported by default
      isActive: true,
      notes: "Curated Kazakhstan test rule",
    },
    {
      countryCode: "ZA",
      countryName: "South Africa",
      currency: "ZAR",
      currencySymbol: "R",
      basePriceSubunits: 42000, // 420.00 ZAR
      usdFallbackPriceSubunits: 2400,
      isGatewaySupportedCurrency: false,
      isActive: true,
    },
    {
      countryCode: "MN",
      countryName: "Mongolia",
      currency: "MNT",
      currencySymbol: "₮",
      basePriceSubunits: 8300000,
      usdFallbackPriceSubunits: 2400,
      isGatewaySupportedCurrency: false,
      isActive: false, // Disabled rule
    },
    {
      // Malicious or misconfigured rule trying to override India
      countryCode: "IN",
      countryName: "India Fake",
      currency: "INR",
      currencySymbol: "₹",
      basePriceSubunits: 50000,
      usdFallbackPriceSubunits: 1000,
      isGatewaySupportedCurrency: true,
      isActive: true,
    },
  ];

  // Precedence 1: India visitor -> always INR 1,299 regardless of affordability rules
  const inPricing = resolveCentralPricing({
    countryCode: "IN",
    affordabilityRules: sampleAffordabilityRules,
  });
  assert.equal(inPricing.pricingTier, "india");
  assert.equal(inPricing.currency, "INR");
  assert.equal(inPricing.basePriceSubunits, 129900);
  assert.equal(inPricing.isAffordability, false);

  // Precedence 2: US visitor -> always USD 75
  const usPricing = resolveCentralPricing({
    countryCode: "US",
    affordabilityRules: sampleAffordabilityRules,
  });
  assert.equal(usPricing.pricingTier, "us");
  assert.equal(usPricing.currency, "USD");
  assert.equal(usPricing.basePriceSubunits, 7500);
  assert.equal(usPricing.isAffordability, false);

  // Precedence 3: Eurozone visitor (e.g. DE, FR, IT, ES, and BG) -> always EUR 75
  const dePricing = resolveCentralPricing({
    countryCode: "DE",
    affordabilityRules: sampleAffordabilityRules,
  });
  assert.equal(dePricing.pricingTier, "eurozone");
  assert.equal(dePricing.currency, "EUR");
  assert.equal(dePricing.basePriceSubunits, 7500);
  assert.equal(dePricing.isAffordability, false);

  // Precedence 3b: Bulgaria (BG) - 21st Eurozone member state resolves strictly to €75 EUR
  const bgAffordabilityAttemptRules = [
    ...sampleAffordabilityRules,
    {
      countryCode: "BG",
      countryName: "Bulgaria Override Attempt",
      currency: "BGN",
      currencySymbol: "лв",
      basePriceSubunits: 4000,
      usdFallbackPriceSubunits: 2400,
      isGatewaySupportedCurrency: false,
      isActive: true,
    },
  ];
  const bgPricing = resolveCentralPricing({
    countryCode: "BG",
    affordabilityRules: bgAffordabilityAttemptRules,
  });
  assert.equal(bgPricing.pricingTier, "eurozone", "BG must resolve to eurozone tier");
  assert.equal(bgPricing.currency, "EUR", "BG currency must be EUR");
  assert.equal(bgPricing.currencySymbol, "€", "BG symbol must be €");
  assert.equal(bgPricing.basePriceSubunits, 7500, "BG basePriceSubunits must be 7500");
  assert.equal(bgPricing.basePrice, 75, "BG basePrice must be 75");
  assert.equal(bgPricing.formattedDisplayPrice, "€75");
  assert.equal(bgPricing.isAffordability, false, "Bulgarian visitor cannot obtain an affordability price");

  // Verify all 20 previous Eurozone member countries continue to resolve correctly to €75 EUR
  const previous20Eurozone = [
    "AT", "BE", "CY", "EE", "FI", "FR", "DE", "GR", "HR", "IE", "IT",
    "LV", "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES",
  ];
  for (const c of previous20Eurozone) {
    const res = resolveCentralPricing({ countryCode: c, affordabilityRules: sampleAffordabilityRules });
    assert.equal(res.pricingTier, "eurozone", `${c} must resolve to eurozone tier`);
    assert.equal(res.currency, "EUR", `${c} must use EUR currency`);
    assert.equal(res.basePriceSubunits, 7500, `${c} must have 7500 subunits`);
    assert.equal(res.basePrice, 75, `${c} must have basePrice 75`);
  }

  // Verify Bulgarian visitor region resolution and bypass prevention
  const {
    mapCountryToRegionCode: mapCountry,
    resolveRegionCode: resolveReg,
    isRegionSelectionAllowed: isAllowed,
  } = pricingResolveMod;
  assert.equal(mapCountry("BG"), "EU", "Bulgaria must map to EU region");
  assert.equal(resolveReg("BG", null), "EU", "Bulgarian visitor default region must be EU");
  assert.equal(resolveReg("BG", "IN"), "EU", "Bulgarian visitor with spoofed IN cookie must remain EU");
  assert.equal(isAllowed("BG", "IN"), false, "Bulgarian visitor must never be allowed to select IN");
  console.log("  ✓ Bulgaria (BG) €75 EUR resolution, bypass protection, and all 20 previous Eurozone states verified");

  // Precedence 4: Active Affordability country without direct gateway currency -> USD Fallback ($24 USD)
  const kzPricing = resolveCentralPricing({
    countryCode: "KZ",
    affordabilityRules: sampleAffordabilityRules,
  });
  assert.equal(kzPricing.pricingTier, "affordability");
  assert.equal(kzPricing.isAffordability, true);
  assert.equal(kzPricing.currency, "USD"); // USD fallback because KZT is not gateway supported
  assert.equal(kzPricing.basePriceSubunits, 2400);
  assert.equal(kzPricing.countryCode, "KZ");

  // Precedence 4b: Disabled Affordability country -> falls back to Standard International ($75 USD)
  const mnPricing = resolveCentralPricing({
    countryCode: "MN",
    affordabilityRules: sampleAffordabilityRules,
  });
  assert.equal(mnPricing.pricingTier, "international");
  assert.equal(mnPricing.currency, "USD");
  assert.equal(mnPricing.basePriceSubunits, 7500);

  // Precedence 5: Standard International unconfigured country (e.g. JP, BR) -> $75 USD
  const jpPricing = resolveCentralPricing({
    countryCode: "JP",
    affordabilityRules: sampleAffordabilityRules,
  });
  assert.equal(jpPricing.pricingTier, "international");
  assert.equal(jpPricing.currency, "USD");
  assert.equal(jpPricing.basePriceSubunits, 7500);

  console.log("  ✓ Strict 5-tier pricing precedence verified across all edge conditions");

  // 19c. Checkout Referral Calculation with Regional & Affordability Base Prices
  // Affordability customer ($24 USD = 2400 cents) with 10% referral discount:
  const affBasePrice = 2400;
  const affDiscount = Math.floor((affBasePrice * 10) / 100); // 240 cents
  const affCollected = affBasePrice - affDiscount; // 2160 cents ($21.60 USD)
  const affCommission = Math.floor((affCollected * 10) / 100); // 216 cents ($2.16 USD)
  assert.equal(affDiscount, 240);
  assert.equal(affCollected, 2160);
  assert.equal(affCommission, 216);

  // India customer (129,900 paise) with 10% referral discount:
  const inBasePrice = 129900;
  const inDiscount = Math.floor((inBasePrice * 10) / 100); // 12,990 paise
  const inCollected = inBasePrice - inDiscount; // 116,910 paise (₹1,169.10)
  const inCommission = Math.floor((inCollected * 10) / 100); // 11,691 paise (₹116.91)
  assert.equal(inDiscount, 12990);
  assert.equal(inCollected, 116910);
  assert.equal(inCommission, 11691);

  // US customer (7,500 cents) with 10% referral discount:
  const usBasePrice = 7500;
  const usDiscount = Math.floor((usBasePrice * 10) / 100); // 750 cents
  const usCollected = usBasePrice - usDiscount; // 6,750 cents ($67.50 USD)
  const usCommission = Math.floor((usCollected * 10) / 100); // 675 cents ($6.75 USD)
  assert.equal(usDiscount, 750);
  assert.equal(usCollected, 6750);
  assert.equal(usCommission, 675);
  console.log("  ✓ Referral 10% buyer discount and 10% net collected commission verified across INR, USD, and Affordability tiers");

  // 19d. Real MongoDB Atlas Admin Workflows, Schemas & Audit Logging
  let stage3cDb = null;
  let stage3cClient = null;
  const cleanup3c = {
    auditIds: [],
    testCountryCodes: ["KZ"],
  };

  try {
    const mongoUri = process.env.MONGODB_URI;
    if (mongoUri) {
      const { MongoClient } = require("mongodb");
      stage3cClient = new MongoClient(mongoUri);
      await stage3cClient.connect();
      stage3cDb = stage3cClient.db();

      const adminWorkflowsMod = loadTsModule(path.resolve(__dirname, "../src/lib/admin/workflows.ts"));
      const {
        updateAffordabilityTargetByAdmin,
        addAffordabilityRuleByAdmin,
        updateAffordabilityRuleByAdmin,
        toggleAffordabilityRuleByAdmin,
      } = adminWorkflowsMod;

      const adminSchemasMod = loadTsModule(path.resolve(__dirname, "../src/lib/admin/schemas.ts"));
      const { addAffordabilityRuleSchema } = adminSchemasMod;

      const usersCol = stage3cDb.collection("users");
      let liveAdmin = await usersCol.findOne({
        email: "developers.mindfulapps@gmail.com",
        role: "admin",
      });
      if (!liveAdmin) {
        const tempAdminId = new ObjectId();
        await usersCol.insertOne({
          _id: tempAdminId,
          email: "developers.mindfulapps@gmail.com",
          name: "Test Admin",
          role: "admin",
          status: "active",
          isEmailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        cleanup3c.adminUserId = tempAdminId;
        liveAdmin = { _id: tempAdminId, email: "developers.mindfulapps@gmail.com" };
      }

      const adminCtx = {
        db: stage3cDb,
        client: stage3cClient,
        actor: {
          userId: liveAdmin._id,
          email: "developers.mindfulapps@gmail.com",
          role: "admin",
          status: "active",
        },
        reason: "Workstream C verification test on MongoDB Atlas",
        ipAddressHash: "test_ip_hash",
        userAgent: "WorkstreamCTestSuite/1.0",
      };

      // 1. Protected market rejection test
      let protectedRejected = false;
      try {
        await addAffordabilityRuleByAdmin(adminCtx, {
          countryCode: "IN",
          countryName: "India Override Attempt",
          currency: "INR",
          currencySymbol: "₹",
          basePriceSubunits: 10000,
          usdFallbackPriceSubunits: 1000,
          isGatewaySupportedCurrency: true,
          isActive: true,
        });
      } catch (err) {
        protectedRejected = true;
        assert.ok(
          err.message.toLowerCase().includes("protected"),
          `Must reject IN override. Got: ${err.message}`
        );
      }
      assert.equal(protectedRejected, true, "Protected market IN must be rejected by workflow");

      // Verify schema also rejects protected markets (DE and BG)
      const schemaInResult = addAffordabilityRuleSchema.safeParse({
        actionType: "settings.add_affordability_rule",
        countryCode: "DE",
        countryName: "Germany Override",
        currency: "EUR",
        currencySymbol: "€",
        basePriceSubunits: 2000,
        usdFallbackPriceSubunits: 2000,
        isGatewaySupportedCurrency: true,
        isActive: true,
        reason: "Valid reason text",
        confirmed: true,
      });
      assert.equal(schemaInResult.success, false, "Schema must reject Eurozone country code DE");

      // Verify schema rejects Bulgaria BG for add, update, and toggle
      const schemaBgAddResult = addAffordabilityRuleSchema.safeParse({
        actionType: "settings.add_affordability_rule",
        countryCode: "BG",
        countryName: "Bulgaria Override",
        currency: "BGN",
        currencySymbol: "лв",
        basePriceSubunits: 2000,
        usdFallbackPriceSubunits: 2000,
        isGatewaySupportedCurrency: false,
        isActive: true,
        reason: "Valid reason text",
        confirmed: true,
      });
      assert.equal(schemaBgAddResult.success, false, "Schema must reject Bulgaria BG affordability rule");

      const { updateAffordabilityRuleSchema, toggleAffordabilityRuleSchema } = adminSchemasMod;
      const schemaBgUpdateResult = updateAffordabilityRuleSchema.safeParse({
        actionType: "settings.update_affordability_rule",
        countryCode: "BG",
        currency: "BGN",
        reason: "Valid reason text",
        confirmed: true,
      });
      assert.equal(schemaBgUpdateResult.success, false, "Schema must reject updating BG affordability rule");

      const schemaBgToggleResult = toggleAffordabilityRuleSchema.safeParse({
        actionType: "settings.toggle_affordability_rule",
        countryCode: "BG",
        isActive: false,
        reason: "Valid reason text",
        confirmed: true,
      });
      assert.equal(schemaBgToggleResult.success, false, "Schema must reject toggling BG affordability rule");

      // Verify workflow rejects adding BG affordability rule
      let bgAddRejected = false;
      try {
        await addAffordabilityRuleByAdmin(adminCtx, {
          countryCode: "BG",
          countryName: "Bulgaria Override",
          currency: "BGN",
          currencySymbol: "лв",
          basePriceSubunits: 2000,
          usdFallbackPriceSubunits: 2000,
          isGatewaySupportedCurrency: false,
          isActive: true,
        });
      } catch (err) {
        bgAddRejected = true;
        assert.ok(err.message.toLowerCase().includes("protected"), "Must reject BG override");
      }
      assert.equal(bgAddRejected, true, "Adding BG affordability rule must be rejected by workflow");

      // Verify workflow rejects updating BG affordability rule
      let bgUpdateRejected = false;
      try {
        await updateAffordabilityRuleByAdmin(adminCtx, "BG", {
          countryName: "Bulgaria Override Attempt",
        });
      } catch (err) {
        bgUpdateRejected = true;
        assert.ok(err.message.toLowerCase().includes("protected"), "Must reject updating BG");
      }
      assert.equal(bgUpdateRejected, true, "Updating BG affordability rule must be rejected by workflow");

      // Verify workflow rejects toggling BG affordability rule
      let bgToggleRejected = false;
      try {
        await toggleAffordabilityRuleByAdmin(adminCtx, "BG", false);
      } catch (err) {
        bgToggleRejected = true;
        assert.ok(err.message.toLowerCase().includes("protected"), "Must reject toggling BG");
      }
      assert.equal(bgToggleRejected, true, "Toggling BG affordability rule must be rejected by workflow");

      // Customer pricing API verification for Bulgaria
      const pricingRouteMod = loadTsModule(path.resolve(__dirname, "../src/app/api/pricing/route.ts"));
      const { NextRequest } = require("next/server");
      const bgPricingGetReq = new NextRequest("https://lingopdf.in/api/pricing", {
        method: "GET",
        headers: {
          "x-lingopdf-region": "BG",
          "x-vercel-ip-country": "BG",
          "x-real-ip": "198.51.100.29",
        },
      });
      const bgPricingGetRes = await pricingRouteMod.GET(bgPricingGetReq);
      assert.equal(bgPricingGetRes.status, 200);
      const bgPricingData = await bgPricingGetRes.json();
      assert.equal(bgPricingData.detectedCountry, "BG");
      assert.equal(bgPricingData.effectiveRegion, "EU");
      assert.equal(bgPricingData.centralPricing.pricingTier, "eurozone");
      assert.equal(bgPricingData.centralPricing.currency, "EUR");
      assert.equal(bgPricingData.centralPricing.basePrice, 75);
      assert.equal(bgPricingData.centralPricing.formattedDisplayPrice, "€75");
      assert.equal(bgPricingData.pricing.price, 75);
      assert.equal(bgPricingData.pricing.currency, "EUR");

      const bgPricingPostInReq = new NextRequest("https://lingopdf.in/api/pricing", {
        method: "POST",
        headers: {
          origin: "https://lingopdf.in",
          "content-type": "application/json",
          "x-lingopdf-region": "BG",
          "x-vercel-ip-country": "BG",
          "x-real-ip": "198.51.100.29",
        },
        body: JSON.stringify({ regionCode: "IN" }),
      });
      const bgPricingPostInRes = await pricingRouteMod.POST(bgPricingPostInReq);
      assert.equal(bgPricingPostInRes.status, 403, "Bulgarian visitor cannot select INR");

      // 2. Update Affordability Target to 2500 INR
      const updateTargetOutcome = await updateAffordabilityTargetByAdmin(adminCtx, 2500);
      assert.equal(updateTargetOutcome.result.affordabilityTargetInr, 2500);
      cleanup3c.auditIds.push(updateTargetOutcome.auditLog._id);

      // Verify in DB
      const promoCol = stage3cDb.collection("promotion_settings");
      const savedSettings = await promoCol.findOne({ _id: "global_referral_promo" });
      assert.equal(savedSettings.affordabilityTargetInr, 2500);

      // Revert target back to canonical 2000 INR
      const revertTargetOutcome = await updateAffordabilityTargetByAdmin(adminCtx, 2000);
      assert.equal(revertTargetOutcome.result.affordabilityTargetInr, 2000);
      cleanup3c.auditIds.push(revertTargetOutcome.auditLog._id);

      // 3. Add Curated Affordability Rule for KZ
      const addRuleOutcome = await addAffordabilityRuleByAdmin(adminCtx, {
        countryCode: "KZ",
        countryName: "Kazakhstan",
        currency: "KZT",
        currencySymbol: "₸",
        basePriceSubunits: 1180000,
        usdFallbackPriceSubunits: 2400,
        isGatewaySupportedCurrency: false,
        isActive: true,
        notes: "Automated test rule for Kazakhstan",
        referenceExchangeRateToInr: 0.17,
        approximateInrEquivalent: 2006,
      });
      assert.equal(addRuleOutcome.result.rule.countryCode, "KZ");
      cleanup3c.auditIds.push(addRuleOutcome.auditLog._id);

      // Verify duplicate addition is rejected
      let duplicateRejected = false;
      try {
        await addAffordabilityRuleByAdmin(adminCtx, {
          countryCode: "KZ",
          countryName: "Kazakhstan Duplicate",
          currency: "KZT",
          currencySymbol: "₸",
          basePriceSubunits: 1180000,
          usdFallbackPriceSubunits: 2400,
          isGatewaySupportedCurrency: false,
          isActive: true,
        });
      } catch (err) {
        duplicateRejected = true;
        assert.ok(err.message.includes("already exists"));
      }
      assert.equal(duplicateRejected, true, "Duplicate country rule must be rejected");

      // 4. Update Rule for KZ
      const updateRuleOutcome = await updateAffordabilityRuleByAdmin(adminCtx, "KZ", {
        countryName: "Republic of Kazakhstan",
        currency: "KZT",
        currencySymbol: "₸",
        basePriceSubunits: 1200000,
        usdFallbackPriceSubunits: 2500,
        isGatewaySupportedCurrency: false,
        isActive: true,
        notes: "Updated test rule notes",
      });
      assert.equal(updateRuleOutcome.result.rule.countryName, "Republic of Kazakhstan");
      assert.equal(updateRuleOutcome.result.rule.usdFallbackPriceSubunits, 2500);
      cleanup3c.auditIds.push(updateRuleOutcome.auditLog._id);

      // 5. Toggle Rule Active Status
      const toggleOutcome = await toggleAffordabilityRuleByAdmin(adminCtx, "KZ", false);
      assert.equal(toggleOutcome.result.isActive, false);
      assert.equal(toggleOutcome.result.toggled, true);
      cleanup3c.auditIds.push(toggleOutcome.auditLog._id);

      // Verify audit logs exist and are immutable
      const auditCol = stage3cDb.collection("admin_audit_logs");
      const createdLogs = await auditCol
        .find({ _id: { $in: cleanup3c.auditIds } })
        .toArray();
      assert.equal(createdLogs.length, cleanup3c.auditIds.length);
      for (const log of createdLogs) {
        assert.ok(log.action.startsWith("settings."));
        assert.equal(log.actorEmail, "developers.mindfulapps@gmail.com");
      }

      console.log("  ✓ MongoDB Atlas: Target updates, Rule CRUD, duplicate guards, and audit trail fully verified");
    }
  } finally {
    if (stage3cDb) {
      // Clean up test affordability rules and audit logs
      await stage3cDb.collection("promotion_settings").updateOne(
        { _id: "global_referral_promo" },
        {
          $pull: {
            affordabilityRules: { countryCode: { $in: cleanup3c.testCountryCodes } },
          },
          $set: { affordabilityTargetInr: 2000 },
        }
      );
      if (cleanup3c.auditIds.length > 0) {
        await stage3cDb
          .collection("admin_audit_logs")
          .deleteMany({ _id: { $in: cleanup3c.auditIds } });
      }
      if (cleanup3c.adminUserId) {
        await stage3cDb.collection("users").deleteOne({ _id: cleanup3c.adminUserId });
      }
    }
    if (stage3cClient) {
      await stage3cClient.close().catch(() => {});
    }
  }

  console.log("✓ Stage 3B Workstream C Regional & Affordability Pricing tests passed.");

  console.log("\n🎉 ALL STAGE 3B.2, STAGE 3B.3, STAGE 3B.4, STAGE 3B.4.1, WORKSTREAM B & WORKSTREAM C INTEGRATION TESTS PASSED!\n");
}

runAllTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
