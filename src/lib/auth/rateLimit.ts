import crypto from "node:crypto";
import net from "node:net";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/mongodb";
import { getRateLimitsCollection } from "@/lib/db/models";
import { logger } from "@/lib/observability/logger";

export const RATE_LIMIT_WINDOW_SECONDS = 15 * 60; // 15 minutes (900 seconds)

/**
 * Approved Stage 3B.2 rate-limit policies (all over a 15-minute window).
 */
export const RATE_LIMIT_POLICIES = {
  register: {
    scope: "register",
    ipLimit: 5,
    emailLimit: null,
    windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
  },
  login: {
    scope: "login",
    ipLimit: 10,
    emailLimit: 5,
    windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
  },
  verifyEmail: {
    scope: "verify-email",
    ipLimit: 10,
    emailLimit: null,
    windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
  },
  resendVerification: {
    scope: "resend-verif",
    ipLimit: 3,
    emailLimit: 3,
    windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
  },
  forgotPassword: {
    scope: "forgot-pw",
    ipLimit: 5,
    emailLimit: 3,
    windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
  },
  resetPassword: {
    scope: "reset-pw",
    ipLimit: 10,
    emailLimit: null,
    windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
  },
  logout: {
    scope: "logout",
    ipLimit: 20,
    emailLimit: null,
    windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
  },
  pricingPreference: {
    scope: "pricing-pref",
    ipLimit: 30,
    emailLimit: null,
    windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
  },
  adminMutation: {
    scope: "admin-mutation",
    ipLimit: 60,
    emailLimit: null,
    windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
  },
  referralValidation: {
    scope: "referral-val",
    ipLimit: 60,
    emailLimit: null,
    windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
  },
} as const;

export type RateLimitPolicyKey = keyof typeof RATE_LIMIT_POLICIES;

export type RateLimitPolicyConfig =
  (typeof RATE_LIMIT_POLICIES)[RateLimitPolicyKey];

/**
 * Returns the centralized rate-limit policy definition for the requested operation.
 */
export function getRateLimitPolicy(
  policy: RateLimitPolicyKey
): RateLimitPolicyConfig {
  return RATE_LIMIT_POLICIES[policy];
}

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimitStore {
  consume(
    key: string,
    maxRequests: number,
    windowSeconds: number
  ): Promise<RateLimitDecision>;
}

/**
 * Explicit error thrown when the persistent MongoDB rate-limit store is unavailable.
 * Callers must fail closed with 503 Service Unavailable in production.
 */
export class RateLimitBackendError extends Error {
  public readonly code = "RATE_LIMIT_BACKEND_UNAVAILABLE";

  constructor(message = "Rate limit persistence backend is unavailable") {
    super(message);
    this.name = "RateLimitBackendError";
  }
}

export const MIN_HMAC_SECRET_LENGTH = 32;
const DEV_TEST_ONLY_HMAC_SECRET =
  "dev-test-only-hmac-secret-not-for-production-32b";

/**
 * Returns true if the current process is running in a production environment.
 * Checks both NODE_ENV and VERCEL_ENV so Vercel production deployments are always covered.
 */
export function isProductionEnvironment(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  );
}

// Explicit test-only store hook. Must never be used in production.
let injectedTestStore: RateLimitStore | null = null;

/**
 * Injects a controlled in-memory rate-limit store for isolated unit tests only.
 * Throws if called in production.
 */
export function setTestRateLimitStore(store: RateLimitStore | null): void {
  if (isProductionEnvironment() && store !== null) {
    throw new Error("Cannot inject a test rate-limit store in production.");
  }
  injectedTestStore = store;
}

/**
 * Creates a controlled in-memory RateLimitStore for isolated unit tests.
 * Never automatically used in production.
 */
export function createInMemoryRateLimitStore(): RateLimitStore {
  if (isProductionEnvironment()) {
    throw new Error("In-memory rate-limit store cannot be created in production.");
  }

  const map = new Map<string, { count: number; resetAt: number }>();

  return {
    async consume(
      key: string,
      maxRequests: number,
      windowSeconds: number
    ): Promise<RateLimitDecision> {
      const now = Date.now();
      const existing = map.get(key);

      if (!existing || existing.resetAt <= now) {
        map.set(key, {
          count: 1,
          resetAt: now + windowSeconds * 1000,
        });
        return {
          allowed: true,
          remaining: Math.max(0, maxRequests - 1),
          retryAfterSeconds: 0,
        };
      }

      existing.count += 1;
      if (existing.count > maxRequests) {
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((existing.resetAt - now) / 1000)
        );
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds,
        };
      }

      return {
        allowed: true,
        remaining: Math.max(0, maxRequests - existing.count),
        retryAfterSeconds: 0,
      };
    },
  };
}

/**
 * Persistent MongoDB-backed rate-limit store using atomic document-level pipeline updates
 * and MongoDB's authoritative server clock (`$$NOW`).
 * Fails closed by throwing RateLimitBackendError if MongoDB is unreachable or errors.
 */
export const mongoRateLimitStore: RateLimitStore = {
  async consume(
    key: string,
    maxRequests: number,
    windowSeconds: number
  ): Promise<RateLimitDecision> {
    let db;
    try {
      db = await getDb();
    } catch (err) {
      logger.error("rate_limit_db_connection_failed", {
        error: err,
      });
      throw new RateLimitBackendError();
    }

    const collection = await getRateLimitsCollection(db);
    const maxAttempts = 3;
    const windowMs = Math.max(1, Math.round(windowSeconds * 1000));
    const maxCounterCap = maxRequests + 10000;

    const isExpiredOrNewExpr = {
      $or: [
        { $lte: [{ $ifNull: ["$resetAt", new Date(0)] }, "$$NOW"] },
        { $not: ["$count"] },
        { $not: ["$resetAt"] },
      ],
    };

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const updated = await collection.findOneAndUpdate(
          { _id: key },
          [
            {
              $set: {
                count: {
                  $cond: [
                    isExpiredOrNewExpr,
                    1,
                    { $min: [{ $add: ["$count", 1] }, maxCounterCap] },
                  ],
                },
                resetAt: {
                  $cond: [
                    isExpiredOrNewExpr,
                    { $add: ["$$NOW", windowMs] },
                    "$resetAt",
                  ],
                },
                updatedAt: "$$NOW",
              },
            },
          ],
          {
            upsert: true,
            returnDocument: "after",
          }
        );

        if (!updated) {
          throw new RateLimitBackendError("Failed to retrieve updated rate-limit state");
        }

        const resetAtMs =
          updated.resetAt instanceof Date
            ? updated.resetAt.getTime()
            : new Date(updated.resetAt).getTime();
        const serverNowMs =
          updated.updatedAt instanceof Date
            ? updated.updatedAt.getTime()
            : new Date(updated.updatedAt).getTime();

        if (updated.count > maxRequests) {
          const retryAfterSeconds = Math.max(
            1,
            Math.ceil((resetAtMs - serverNowMs) / 1000)
          );
          return {
            allowed: false,
            remaining: 0,
            retryAfterSeconds,
          };
        }

        return {
          allowed: true,
          remaining: Math.max(0, maxRequests - updated.count),
          retryAfterSeconds: 0,
        };
      } catch (err: unknown) {
        // Handle simultaneous first-insert upsert race (MongoDB E11000 duplicate key)
        if (
          typeof err === "object" &&
          err !== null &&
          "code" in err &&
          (err as { code: number }).code === 11000 &&
          attempt < maxAttempts
        ) {
          continue;
        }

        if (err instanceof RateLimitBackendError) {
          throw err;
        }

        logger.error("rate_limit_db_operation_failed", {
          attempt,
          error: err,
        });
        throw new RateLimitBackendError();
      }
    }

    throw new RateLimitBackendError();
  },
};

/**
 * Consumes 1 request from a rate-limit bucket.
 * In production, always uses MongoDB and fails closed (throws RateLimitBackendError) if MongoDB is unavailable.
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<RateLimitDecision> {
  const activeStore =
    !isProductionEnvironment() && injectedTestStore
      ? injectedTestStore
      : mongoRateLimitStore;

  return activeStore.consume(key, maxRequests, windowSeconds);
}

/**
 * Resolves and validates the dedicated HMAC secret for rate-limit bucket hashing.
 * - Never falls back to MONGODB_URI or a public constant in production.
 * - Requires at least 32 characters and non-trivial character diversity (>= 8 distinct characters).
 * - Fails closed with RateLimitBackendError (producing HTTP 503) if missing or invalid in production.
 */
export function resolveRateLimitHmacSecret(): string {
  const rawSecret = process.env.RATE_LIMIT_HMAC_SECRET?.trim() || "";
  const isProd = isProductionEnvironment();

  if (!rawSecret) {
    if (isProd) {
      logger.error("rate_limit_hmac_secret_invalid", {
        reason: "missing_in_production",
        requiredMinLength: MIN_HMAC_SECRET_LENGTH,
      });
      throw new RateLimitBackendError(
        "Rate limit HMAC secret is not configured"
      );
    }
    return DEV_TEST_ONLY_HMAC_SECRET;
  }

  const distinctCharCount = new Set(rawSecret).size;
  if (rawSecret.length < MIN_HMAC_SECRET_LENGTH || distinctCharCount < 8) {
    logger.error("rate_limit_hmac_secret_invalid", {
      reason:
        rawSecret.length < MIN_HMAC_SECRET_LENGTH
          ? "below_minimum_length"
          : "insufficient_entropy",
      requiredMinLength: MIN_HMAC_SECRET_LENGTH,
    });
    throw new RateLimitBackendError(
      "Rate limit HMAC secret does not meet minimum length or entropy requirements"
    );
  }

  return rawSecret;
}

/**
 * Normalizes an email address and computes a keyed HMAC-SHA256 bucket identifier
 * so raw email addresses are never stored in the `rate_limits` collection.
 */
export function buildEmailRateLimitKey(scope: string, rawEmail: string): string {
  const normalizedEmail = rawEmail.trim().toLowerCase();
  const secret = resolveRateLimitHmacSecret();

  const digest = crypto
    .createHmac("sha256", secret)
    .update(`${scope}:email:${normalizedEmail}`)
    .digest("hex");

  return `${scope}:email:${digest}`;
}

/**
 * Builds a deterministic IP rate-limit bucket key using an HMAC-protected IP digest.
 */
export function buildIpRateLimitKey(scope: string, clientIp: string): string {
  const normalizedIp = clientIp.trim().toLowerCase();
  const secret = resolveRateLimitHmacSecret();

  const digest = crypto
    .createHmac("sha256", secret)
    .update(`${scope}:ip:${normalizedIp}`)
    .digest("hex");

  return `${scope}:ip:${digest}`;
}

/**
 * Validates and normalizes an IPv4 or IPv6 address literal.
 * Strips IPv4-mapped IPv6 prefixes (`::ffff:`) so the same host cannot split buckets.
 */
export function normalizeValidIp(rawCandidate: string | null | undefined): string | null {
  if (!rawCandidate || typeof rawCandidate !== "string") {
    return null;
  }

  let candidate = rawCandidate.trim();
  if (!candidate) {
    return null;
  }

  if (candidate.toLowerCase().startsWith("::ffff:")) {
    const mappedIpv4 = candidate.slice(7);
    if (net.isIPv4(mappedIpv4)) {
      candidate = mappedIpv4;
    }
  }

  const ipVersion = net.isIP(candidate);
  if (ipVersion === 4) {
    return candidate;
  }
  if (ipVersion === 6) {
    return candidate.toLowerCase();
  }
  return null;
}

/**
 * Extracts a trustworthy client IP from authoritative deployment proxy headers.
 *
 * Header Precedence & Trust Assumptions:
 * 1. `cf-connecting-ip`: Evaluated BEFORE Vercel headers ONLY when `TRUST_CLOUDFLARE_PROXY === "true"`
 *    is explicitly configured (because an upstream Cloudflare proxy causes Vercel edge headers to reflect
 *    Cloudflare's egress IP rather than the end user). Must only be enabled when origin access is locked
 *    exclusively to Cloudflare.
 * 2. `x-vercel-forwarded-for` and `x-real-ip`: Trusted ONLY when `process.env.VERCEL === "1"` confirms
 *    execution inside the Vercel runtime where the Vercel Edge network overwrites these headers.
 * 3. Generic `x-forwarded-for` is NEVER trusted in production because clients can spoof prepended entries
 *    when not stripped by an authoritative edge proxy.
 * 4. In development/test (`NODE_ENV !== "production"` AND `VERCEL_ENV !== "production"`), if edge headers
 *    are absent, falls back to a validated `x-forwarded-for` first hop or a per-agent development identifier.
 * 5. Returns `null` in production if no trustworthy client IP header is present (no shared fallback bucket).
 */
export function getClientIp(request: Request): string | null {
  // 1. Optional Cloudflare header evaluated first ONLY when explicitly enabled in deployment configuration
  if (process.env.TRUST_CLOUDFLARE_PROXY === "true") {
    const cfIp = request.headers.get("cf-connecting-ip");
    if (cfIp) {
      const valid = normalizeValidIp(cfIp);
      if (valid) return valid;
    }
  }

  // 2. Vercel authoritative edge headers trusted ONLY when running on Vercel (VERCEL === "1")
  if (process.env.VERCEL === "1") {
    const vercelForwarded = request.headers.get("x-vercel-forwarded-for");
    if (vercelForwarded) {
      const firstHop = vercelForwarded.split(",")[0];
      const valid = normalizeValidIp(firstHop);
      if (valid) return valid;
    }

    const realIp = request.headers.get("x-real-ip");
    if (realIp) {
      const valid = normalizeValidIp(realIp);
      if (valid) return valid;
    }
  }

  // 3. Non-production development/test fallback only (checks both NODE_ENV and VERCEL_ENV)
  if (!isProductionEnvironment()) {
    const devForwarded = request.headers.get("x-forwarded-for");
    if (devForwarded) {
      const firstHop = devForwarded.split(",")[0];
      const valid = normalizeValidIp(firstHop);
      if (valid) return valid;
    }

    // In local dev/test without proxy headers, derive a deterministic per-client dev token
    // rather than collapsing all callers onto a hardcoded "127.0.0.1" literal
    const userAgent = request.headers.get("user-agent") || "dev-agent";
    const devHash = crypto
      .createHash("sha256")
      .update(`local-dev:${userAgent}`)
      .digest("hex")
      .slice(0, 16);
    return `dev-client-${devHash}`;
  }

  // In production, if no authoritative proxy header provided a valid IP, return null
  return null;
}

/**
 * Enforces the IP rate-limit bucket for a route before body parsing.
 * Fails closed with 503 if MongoDB is unavailable, or 400 if client IP cannot be verified in production.
 */
export async function enforceIpRateLimit(params: {
  request: Request;
  policy: RateLimitPolicyKey;
  rateLimitExceededMessage: string;
}): Promise<{
  blockedResponse: NextResponse | null;
  clientIp: string | null;
}> {
  const { request, policy, rateLimitExceededMessage } = params;
  const config = RATE_LIMIT_POLICIES[policy];
  const clientIp = getClientIp(request);

  if (!clientIp) {
    logger.security("rate_limit_missing_trusted_client_ip", {
      scope: config.scope,
      method: request.method,
    });
    return {
      clientIp: null,
      blockedResponse: NextResponse.json(
        {
          error: "Unable to verify client network identity.",
          code: "CLIENT_IP_UNVERIFIED",
        },
        { status: 400 }
      ),
    };
  }

  try {
    const ipKey = buildIpRateLimitKey(config.scope, clientIp);
    const ipDecision = await checkRateLimit(
      ipKey,
      config.ipLimit,
      config.windowSeconds
    );

    if (!ipDecision.allowed) {
      logger.security("rate_limit_exceeded_ip", {
        scope: config.scope,
        retryAfterSeconds: ipDecision.retryAfterSeconds,
      });
      return {
        clientIp,
        blockedResponse: NextResponse.json(
          {
            error: rateLimitExceededMessage,
            code: "RATE_LIMITED",
          },
          {
            status: 429,
            headers: {
              "Retry-After": ipDecision.retryAfterSeconds.toString(),
            },
          }
        ),
      };
    }

    return { blockedResponse: null, clientIp };
  } catch (err) {
    if (err instanceof RateLimitBackendError) {
      return {
        clientIp,
        blockedResponse: NextResponse.json(
          {
            error: "Service temporarily unavailable. Please try again shortly.",
            code: "DB_UNAVAILABLE",
          },
          { status: 503 }
        ),
      };
    }
    throw err;
  }
}

/**
 * Enforces the normalized Email/Account HMAC rate-limit bucket for a route.
 * Operates identically whether or not the email exists in the `users` collection,
 * preventing account enumeration. Fails closed with 503 if MongoDB is unavailable.
 */
export async function enforceEmailRateLimit(params: {
  policy: RateLimitPolicyKey;
  email: string;
  rateLimitExceededMessage: string;
}): Promise<NextResponse | null> {
  const { policy, email, rateLimitExceededMessage } = params;
  const config = RATE_LIMIT_POLICIES[policy];

  if (config.emailLimit === null) {
    return null;
  }

  try {
    const emailKey = buildEmailRateLimitKey(config.scope, email);
    const emailDecision = await checkRateLimit(
      emailKey,
      config.emailLimit,
      config.windowSeconds
    );

    if (!emailDecision.allowed) {
      logger.security("rate_limit_exceeded_account", {
        scope: config.scope,
        retryAfterSeconds: emailDecision.retryAfterSeconds,
      });
      return NextResponse.json(
        {
          error: rateLimitExceededMessage,
          code: "RATE_LIMITED",
        },
        {
          status: 429,
          headers: {
            "Retry-After": emailDecision.retryAfterSeconds.toString(),
          },
        }
      );
    }

    return null;
  } catch (err) {
    if (err instanceof RateLimitBackendError) {
      return NextResponse.json(
        {
          error: "Service temporarily unavailable. Please try again shortly.",
          code: "DB_UNAVAILABLE",
        },
        { status: 503 }
      );
    }
    throw err;
  }
}
