/* eslint-disable */
const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const assert = require("assert/strict");

function loadTsModule(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const transpiled = ts.transpileModule(content, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const m = { exports: {} };
  const customRequire = (specifier) => {
    if (specifier.startsWith("./") || specifier.startsWith("../")) {
      const dir = path.dirname(filePath);
      let targetPath = path.resolve(dir, specifier);
      if (!fs.existsSync(targetPath) && fs.existsSync(targetPath + ".ts")) {
        targetPath += ".ts";
      } else if (!fs.existsSync(targetPath) && fs.existsSync(targetPath + ".js")) {
        targetPath += ".js";
      }
      return loadTsModule(targetPath);
    }
    if (specifier.startsWith("@/")) {
      let targetPath = path.resolve(__dirname, "..", "src", specifier.slice(2));
      if (!fs.existsSync(targetPath) && fs.existsSync(targetPath + ".ts")) {
        targetPath += ".ts";
      }
      return loadTsModule(targetPath);
    }
    return require(specifier);
  };

  const fn = new Function("require", "exports", "module", "__dirname", "__filename", transpiled);
  fn(customRequire, m.exports, m, path.dirname(filePath), filePath);
  return m.exports;
}

console.log("=== Running Pre-Phase 7 Verification Tests ===");

// 1. Regional pricing config
const configMod = loadTsModule(path.resolve(__dirname, "../src/lib/pricing/config.ts"));
const { REGIONAL_PRICING, EUROZONE_COUNTRY_CODES, DEFAULT_REGION_CODE } = configMod;

console.log("\n[Test 1] Regional Pricing Configuration Integrity");
assert.equal(REGIONAL_PRICING.IN.currency, "INR");
assert.equal(REGIONAL_PRICING.IN.currencySymbol, "₹");
assert.ok(REGIONAL_PRICING.IN.price === 899 || REGIONAL_PRICING.IN.price === 999, "IN price must be 899 or 999");
assert.equal(REGIONAL_PRICING.IN.isTentative, true, "IN price must be flagged tentative");
assert.equal(REGIONAL_PRICING.US.currency, "USD");
assert.equal(REGIONAL_PRICING.US.price, 49);
assert.equal(REGIONAL_PRICING.EU.currency, "EUR");
assert.equal(REGIONAL_PRICING.EU.isTentative, true, "EU price must be tentative");
assert.equal(REGIONAL_PRICING.DEFAULT.currency, "USD");
console.log("✓ Regional pricing configurations verified.");

// 2. Format separation
const formatMod = loadTsModule(path.resolve(__dirname, "../src/lib/pricing/format.ts"));
const { formatPrice } = formatMod;

console.log("\n[Test 2] Separation of Display Formatting from Numeric Values");
assert.equal(formatPrice(999, REGIONAL_PRICING.IN), "₹999");
assert.equal(formatPrice(49, REGIONAL_PRICING.US), "$49");
assert.equal(formatPrice(49, REGIONAL_PRICING.EU), "€49");
console.log("✓ Price formatting correctly isolates numeric configurations.");

// 3. Resolve & Detection
const resolveMod = loadTsModule(path.resolve(__dirname, "../src/lib/pricing/resolve.ts"));
const { mapCountryToRegionCode, detectCountryFromHeaders, resolveRegionCode, getAuthoritativePricing } = resolveMod;

console.log("\n[Test 3] Country to Region Mapping");
assert.equal(mapCountryToRegionCode("IN"), "IN");
assert.equal(mapCountryToRegionCode("in"), "IN");
assert.equal(mapCountryToRegionCode("US"), "US");
assert.equal(mapCountryToRegionCode("DE"), "EU");
assert.equal(mapCountryToRegionCode("FR"), "EU");
assert.equal(mapCountryToRegionCode("IT"), "EU");
assert.equal(mapCountryToRegionCode("JP"), "DEFAULT");
assert.equal(mapCountryToRegionCode(null), "DEFAULT");
console.log("✓ ISO country mapping correctly resolves EU, IN, US, and DEFAULT fallback.");

// 4. Header detection
console.log("\n[Test 4] Server-Side Edge Geo Header Detection");
const makeHeaders = (obj) => ({
  get: (key) => obj[key.toLowerCase()] || null,
});
assert.equal(detectCountryFromHeaders(makeHeaders({ "x-vercel-ip-country": "IN" })), "IN");
assert.equal(detectCountryFromHeaders(makeHeaders({ "cf-ipcountry": "DE" })), "DE");
assert.equal(detectCountryFromHeaders(makeHeaders({ "cloudfront-viewer-country": "US" })), "US");
assert.equal(detectCountryFromHeaders(makeHeaders({ "x-lingopdf-region": "EU" })), "EU");
assert.equal(detectCountryFromHeaders(makeHeaders({})), null);
console.log("✓ Server-side headers accurately parsed without relying on browser locale.");

// 5. Precedence
console.log("\n[Test 5] Selection Precedence (Cookie > Edge Header > Default)");
assert.equal(resolveRegionCode("IN", "US"), "US", "Cookie overrides detected country");
assert.equal(resolveRegionCode("IN", null), "IN", "Header used when no cookie");
assert.equal(resolveRegionCode(null, null), "DEFAULT", "Fallback to DEFAULT");
console.log("✓ Precedence correctly structured.");

// 6. Authoritative Pricing Lookup
console.log("\n[Test 6] Authoritative Server-Side Pricing Lookup");
const authIn = getAuthoritativePricing("IN");
assert.equal(authIn.currency, "INR");
assert.equal(authIn.price, 999);
const authEu = getAuthoritativePricing("DE");
assert.equal(authEu.currency, "EUR");
assert.equal(authEu.price, 49);
console.log("✓ Authoritative server lookup prevents client price tampering.");

// 7. Session token hashing & timing safe match
const sessionMod = loadTsModule(path.resolve(__dirname, "../src/lib/auth/session.ts"));
const { hashToken, timingSafeHashMatch } = sessionMod;

console.log("\n[Test 7] Security Tokens & Timing-Safe Comparison");
const sampleToken = "a".repeat(64);
const h1 = hashToken(sampleToken);
const h2 = hashToken(sampleToken);
assert.equal(h1, h2);
assert.equal(h1.length, 64);
assert.equal(timingSafeHashMatch(h1, h2), true);
assert.equal(timingSafeHashMatch(h1, "b".repeat(64)), false);
console.log("✓ Token SHA-256 and constant-time match verified.");

console.log("\n🎉 ALL PRE-PHASE 7 VERIFICATION TESTS PASSED SUCCESSFULLY!\n");
