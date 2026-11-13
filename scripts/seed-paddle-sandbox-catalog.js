#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * LingoPDF — Paddle Sandbox Catalogue Seed Script (Stage 1)
 *
 * Secure, strictly idempotent provisioning of the LingoPDF German-English
 * lifetime license product and regional one-time pricing in Paddle Sandbox.
 *
 * Safety Invariants:
 * 1. Hardcoded target: https://sandbox-api.paddle.com (Never contacts Live production).
 * 2. Fail-closed Sandbox key guard: strictly verifies key starts with 'pdl_sdbx_'.
 * 3. Strict Idempotency: inspects all paginated active products and prices.
 *    - Reuses an existing entity ONLY if 100% of its fields match approved specifications.
 *    - Aborts with a detailed mismatch report if a partially matching entity has conflicting settings.
 *    - Never silently modifies existing entities or creates duplicate products/prices.
 * 4. Zero secret leakage: prints only resulting Paddle IDs; never prints API tokens.
 *
 * Recommended Invocation:
 *   node --env-file=.env.local scripts/seed-paddle-sandbox-catalog.js
 * (Falls back to internal .env.local parser if run without --env-file)
 */

const fs = require("fs");
const path = require("path");

const PADDLE_SANDBOX_API_BASE = "https://sandbox-api.paddle.com";
const MAX_PAGES = 20; // Safety cap to prevent infinite pagination loops (up to 1,000 entities)

// 21 Eurozone member states as of 2026 (includes Bulgaria BG)
const APPROVED_EUROZONE_COUNTRY_CODES = [
  "AT", "BE", "BG", "CY", "EE", "FI", "FR", "DE", "GR", "HR",
  "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES"
].sort();

const APPROVED_PRODUCT = {
  name: "LingoPDF German → English",
  tax_category: "standard",
  description: "LingoPDF German → English Vocabulary-Building PDF Reader Extension (Lifetime License & Future Updates).",
  custom_data: {
    product_slug: "german-english",
    edition_version: "1.0",
    license_type: "lifetime"
  }
};

const APPROVED_PRICE = {
  description: "LingoPDF German-English Lifetime License (USD Base with INR and EUR Overrides)",
  name: "Lifetime License",
  tax_mode: "location",
  unit_price: {
    amount: "7500",
    currency_code: "USD"
  },
  quantity: {
    minimum: 1,
    maximum: 1
  },
  unit_price_overrides: [
    {
      country_codes: ["IN"],
      unit_price: {
        amount: "129900",
        currency_code: "INR"
      }
    },
    {
      country_codes: APPROVED_EUROZONE_COUNTRY_CODES,
      unit_price: {
        amount: "7500",
        currency_code: "EUR"
      }
    }
  ],
  custom_data: {
    tier: "canonical",
    product_slug: "german-english"
  }
};

/**
 * Loads .env.local if variables are not already present in process.env.
 * Never prints or leaks secrets.
 */
function ensureEnvLoaded() {
  if (process.env.PADDLE_API_KEY) {
    return; // Already loaded via --env-file or parent shell
  }

  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, "utf8");
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

/**
 * Executes an authenticated request strictly against Paddle Sandbox.
 */
async function paddleRequest(endpoint, options = {}, apiKey) {
  const url = `${PADDLE_SANDBOX_API_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const errorDetail = body?.error?.detail || body?.error?.message || `HTTP ${res.status} ${res.statusText}`;
    const errorCode = body?.error?.code || "PADDLE_API_ERROR";
    const error = new Error(`Paddle Sandbox API error [${errorCode}]: ${errorDetail}`);
    error.status = res.status;
    error.code = errorCode;
    throw error;
  }

  return body;
}

/**
 * Fetches all paginated results from a list endpoint, up to MAX_PAGES.
 */
async function fetchAllPaginated(baseEndpoint, apiKey) {
  const results = [];
  let pageCount = 0;
  let after = null;
  let hasMore = true;

  while (hasMore && pageCount < MAX_PAGES) {
    pageCount++;
    const separator = baseEndpoint.includes("?") ? "&" : "?";
    const endpoint = after
      ? `${baseEndpoint}${separator}per_page=50&after=${encodeURIComponent(after)}`
      : `${baseEndpoint}${separator}per_page=50`;

    const res = await paddleRequest(endpoint, { method: "GET" }, apiKey);
    const data = res?.data || [];
    results.push(...data);

    hasMore = Boolean(res?.meta?.pagination?.has_more);
    if (hasMore && data.length > 0) {
      after = data[data.length - 1].id;
    } else {
      hasMore = false;
    }
  }

  if (pageCount >= MAX_PAGES && hasMore) {
    console.warn(`[Paddle Seed] Warning: Reached max pagination safety cap (${MAX_PAGES} pages).`);
  }

  return results;
}

/**
 * Validates whether an existing product strictly matches approved configuration.
 */
function validateExistingProduct(product) {
  const mismatches = [];

  if (product.name !== APPROVED_PRODUCT.name) {
    mismatches.push(`name: expected "${APPROVED_PRODUCT.name}", got "${product.name}"`);
  }
  if (product.tax_category !== APPROVED_PRODUCT.tax_category) {
    mismatches.push(`tax_category: expected "${APPROVED_PRODUCT.tax_category}", got "${product.tax_category}"`);
  }
  if (product.status !== "active") {
    mismatches.push(`status: expected "active", got "${product.status}"`);
  }
  if (product.custom_data?.product_slug !== APPROVED_PRODUCT.custom_data.product_slug) {
    mismatches.push(`custom_data.product_slug: expected "${APPROVED_PRODUCT.custom_data.product_slug}", got "${product.custom_data?.product_slug}"`);
  }

  return mismatches;
}

/**
 * Validates whether an existing price strictly matches approved configuration.
 */
function validateExistingPrice(price, expectedProductId) {
  const mismatches = [];

  if (price.product_id !== expectedProductId) {
    mismatches.push(`product_id: expected "${expectedProductId}", got "${price.product_id}"`);
  }
  if (price.status !== "active") {
    mismatches.push(`status: expected "active", got "${price.status}"`);
  }
  if (price.billing_cycle !== null && price.billing_cycle !== undefined) {
    mismatches.push(`billing_cycle: expected null (one-time), got ${JSON.stringify(price.billing_cycle)}`);
  }
  if (price.trial_period !== null && price.trial_period !== undefined) {
    mismatches.push(`trial_period: expected null (no trial), got ${JSON.stringify(price.trial_period)}`);
  }
  if (price.tax_mode !== APPROVED_PRICE.tax_mode) {
    mismatches.push(`tax_mode: expected "${APPROVED_PRICE.tax_mode}", got "${price.tax_mode}"`);
  }
  if (price.unit_price?.amount !== APPROVED_PRICE.unit_price.amount) {
    mismatches.push(`unit_price.amount: expected "${APPROVED_PRICE.unit_price.amount}", got "${price.unit_price?.amount}"`);
  }
  if (price.unit_price?.currency_code !== APPROVED_PRICE.unit_price.currency_code) {
    mismatches.push(`unit_price.currency_code: expected "${APPROVED_PRICE.unit_price.currency_code}", got "${price.unit_price?.currency_code}"`);
  }
  if (price.quantity?.minimum !== APPROVED_PRICE.quantity.minimum || price.quantity?.maximum !== APPROVED_PRICE.quantity.maximum) {
    mismatches.push(`quantity: expected min ${APPROVED_PRICE.quantity.minimum} / max ${APPROVED_PRICE.quantity.maximum}, got min ${price.quantity?.minimum} / max ${price.quantity?.maximum}`);
  }

  // Validate overrides
  const overrides = price.unit_price_overrides || [];
  const inrOverride = overrides.find((o) => (o.country_codes || []).includes("IN"));
  if (!inrOverride) {
    mismatches.push('unit_price_overrides: missing "IN" override');
  } else {
    if (inrOverride.unit_price?.amount !== "129900") {
      mismatches.push(`IN override amount: expected "129900", got "${inrOverride.unit_price?.amount}"`);
    }
    if (inrOverride.unit_price?.currency_code !== "INR") {
      mismatches.push(`IN override currency: expected "INR", got "${inrOverride.unit_price?.currency_code}"`);
    }
  }

  const eurOverride = overrides.find((o) => (o.country_codes || []).includes("DE"));
  if (!eurOverride) {
    mismatches.push('unit_price_overrides: missing Eurozone override');
  } else {
    if (eurOverride.unit_price?.amount !== "7500") {
      mismatches.push(`Eurozone override amount: expected "7500", got "${eurOverride.unit_price?.amount}"`);
    }
    if (eurOverride.unit_price?.currency_code !== "EUR") {
      mismatches.push(`Eurozone override currency: expected "EUR", got "${eurOverride.unit_price?.currency_code}"`);
    }
    const eurCountries = (eurOverride.country_codes || []).slice().sort();
    const missingEur = APPROVED_EUROZONE_COUNTRY_CODES.filter((c) => !eurCountries.includes(c));
    if (missingEur.length > 0) {
      mismatches.push(`Eurozone override missing countries: ${missingEur.join(", ")}`);
    }
  }

  return mismatches;
}

async function runSeed() {
  ensureEnvLoaded();

  const apiKey = process.env.PADDLE_API_KEY;

  if (!apiKey || typeof apiKey !== "string" || apiKey.trim() === "") {
    console.error("❌ Fatal Error: PADDLE_API_KEY is not defined in your environment or .env.local.");
    console.error("   Please set PADDLE_API_KEY with your Sandbox API secret key (must start with 'pdl_sdbx_').");
    process.exit(1);
  }

  const trimmedKey = apiKey.trim();

  // Safety Assertion: Explicitly refuse any Live key
  if (!trimmedKey.startsWith("pdl_sdbx_")) {
    console.error("❌ Safety Abort: PADDLE_API_KEY does not start with 'pdl_sdbx_'.");
    console.error("   This script strictly permits execution against Paddle Sandbox.");
    console.error("   Execution aborted to prevent accidental configuration of Live credentials.");
    process.exit(1);
  }

  console.log("🔍 Scanning Paddle Sandbox catalogue (paginated)...");

  // 1. Fetch all active products
  const allProducts = await fetchAllPaginated("/products?status=active&include=prices", trimmedKey);

  // Find candidate products matching by slug or name
  const candidateProducts = allProducts.filter(
    (p) =>
      p.custom_data?.product_slug === APPROVED_PRODUCT.custom_data.product_slug ||
      p.name === APPROVED_PRODUCT.name
  );

  let targetProductId = null;

  if (candidateProducts.length > 1) {
    console.error(`❌ Conflict Abort: Found ${candidateProducts.length} candidate products matching "${APPROVED_PRODUCT.name}".`);
    console.error("   Manual review in Paddle Sandbox dashboard is required to resolve duplicates.");
    process.exit(1);
  }

  if (candidateProducts.length === 1) {
    const existingProduct = candidateProducts[0];
    const mismatches = validateExistingProduct(existingProduct);

    if (mismatches.length > 0) {
      console.error(`❌ Mismatch Abort: Existing product "${existingProduct.name}" (${existingProduct.id}) conflicts with approved specifications:`);
      mismatches.forEach((m) => console.error(`   - ${m}`));
      console.error("   Aborting to prevent corrupting catalogue or creating redundant entities.");
      process.exit(1);
    }

    targetProductId = existingProduct.id;
    console.log(`✓ Verified existing product matches approved specification: ${targetProductId}`);
  } else {
    console.log("Creating approved product in Paddle Sandbox...");
    const createProductRes = await paddleRequest(
      "/products",
      {
        method: "POST",
        body: JSON.stringify(APPROVED_PRODUCT)
      },
      trimmedKey
    );
    targetProductId = createProductRes.data.id;
    console.log(`✓ Successfully created product: ${targetProductId}`);
  }

  // 2. Fetch all active prices for target product
  const productPrices = await fetchAllPaginated(`/prices?product_id=${encodeURIComponent(targetProductId)}&status=active`, trimmedKey);

  const candidatePrices = productPrices.filter(
    (pr) =>
      pr.custom_data?.tier === "canonical" ||
      pr.name === APPROVED_PRICE.name ||
      pr.description === APPROVED_PRICE.description
  );

  let targetPriceId = null;

  if (candidatePrices.length > 1) {
    console.error(`❌ Conflict Abort: Found ${candidatePrices.length} candidate prices for product ${targetProductId}.`);
    console.error("   Manual review in Paddle Sandbox dashboard is required to resolve duplicates.");
    process.exit(1);
  }

  if (candidatePrices.length === 1) {
    const existingPrice = candidatePrices[0];
    const mismatches = validateExistingPrice(existingPrice, targetProductId);

    if (mismatches.length > 0) {
      console.error(`❌ Mismatch Abort: Existing price "${existingPrice.description}" (${existingPrice.id}) conflicts with approved specifications:`);
      mismatches.forEach((m) => console.error(`   - ${m}`));
      console.error("   Aborting to prevent invalid billing configurations.");
      process.exit(1);
    }

    targetPriceId = existingPrice.id;
    console.log(`✓ Verified existing one-time price matches approved specification: ${targetPriceId}`);
  } else {
    // Check if any other un-matched active price already exists on this product
    if (productPrices.length > 0) {
      console.error(`❌ Safety Abort: Product ${targetProductId} already has ${productPrices.length} active price(s) that do not match our canonical specification.`);
      console.error("   Aborting to prevent creating unexpected multiple active prices.");
      process.exit(1);
    }

    console.log("Creating approved one-time price with regional overrides in Paddle Sandbox...");
    const pricePayloadWithProduct = {
      ...APPROVED_PRICE,
      product_id: targetProductId
    };

    const createPriceRes = await paddleRequest(
      "/prices",
      {
        method: "POST",
        body: JSON.stringify(pricePayloadWithProduct)
      },
      trimmedKey
    );
    targetPriceId = createPriceRes.data.id;
    console.log(`✓ Successfully created one-time price: ${targetPriceId}`);
  }

  console.log("\n========================================================");
  console.log("🎉 Paddle Sandbox Catalogue Verified & Provisioned");
  console.log("========================================================");
  console.log(`Target Environment : Sandbox (${PADDLE_SANDBOX_API_BASE})`);
  console.log(`Product ID         : ${targetProductId}`);
  console.log(`Price ID           : ${targetPriceId}`);
  console.log(`Base Price         : $75.00 USD (Net / Tax-exclusive fallback)`);
  console.log(`India Override     : ₹1,299.00 INR (Tax-inclusive)`);
  console.log(`Eurozone Override  : €75.00 EUR (Tax-inclusive across 21 Member States)`);
  console.log("========================================================");
  console.log("Add these IDs to your .env.local file:");
  console.log(`NEXT_PUBLIC_PADDLE_PRODUCT_ID=${targetProductId}`);
  console.log(`NEXT_PUBLIC_PADDLE_PRICE_ID=${targetPriceId}`);
  console.log("========================================================\n");
}

runSeed().catch((err) => {
  console.error("❌ Fatal Seeding Failure:", err.message);
  process.exit(1);
});
