import { NextResponse } from "next/server";
import { getTrustedAppUrl } from "@/lib/email/resend";
import { logger } from "@/lib/observability/logger";

export type CsrfValidationFailureCode =
  | "CSRF_CROSS_SITE_FETCH"
  | "CSRF_MISSING_ORIGIN"
  | "CSRF_MALFORMED_ORIGIN"
  | "CSRF_ORIGIN_MISMATCH"
  | "CSRF_MALFORMED_REFERER"
  | "CSRF_REFERER_MISMATCH"
  | "CSRF_INVALID_CONTENT_TYPE";

export interface CsrfValidationResult {
  allowed: boolean;
  code?: CsrfValidationFailureCode;
  error?: string;
  status?: number;
}

export interface CsrfValidationOptions {
  /**
   * Whether the endpoint requires `Content-Type: application/json`.
   * Defaults to true for JSON mutation endpoints.
   * Set to false for body-less mutation endpoints such as POST /api/auth/logout.
   */
  requireJsonContentType?: boolean;
  /**
   * Optional explicit canonical app URL override (used in unit tests).
   */
  trustedAppUrl?: string;
}

/**
 * Explicit authorized production origins.
 * Vercel serves the canonical site on https://www.lingopdf.in and redirects https://lingopdf.in -> https://www.lingopdf.in.
 * Both origins are part of the authorized production domain infrastructure.
 */
export const TRUSTED_PRODUCTION_ORIGINS = [
  "https://www.lingopdf.in",
  "https://lingopdf.in",
] as const;

/**
 * Safely parses an HTTP(S) URL and extracts its exact normalized origin (`scheme://host[:port]`).
 * Returns null for malformed URLs, opaque `"null"` origins, or non-HTTP(S) schemes.
 */
export function parseStrictOrigin(rawUrlOrOrigin: string | null | undefined): string | null {
  if (!rawUrlOrOrigin || typeof rawUrlOrOrigin !== "string") {
    return null;
  }

  const trimmed = rawUrlOrOrigin.trim();
  if (!trimmed || trimmed.toLowerCase() === "null") {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    if (!parsed.origin || parsed.origin === "null") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * Resolves all authorized application origins.
 * When `overrideAppUrl` is provided (e.g. in targeted tests), restricts strictly to that origin.
 */
export function getAllowedOrigins(overrideAppUrl?: string): string[] {
  const allowed = new Set<string>();

  if (overrideAppUrl) {
    const parsedOverride = parseStrictOrigin(overrideAppUrl);
    if (parsedOverride) {
      allowed.add(parsedOverride);
      return Array.from(allowed);
    }
  }

  // Include explicit production origins
  for (const origin of TRUSTED_PRODUCTION_ORIGINS) {
    allowed.add(origin);
  }

  // Include configured app URL if set
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (appUrl) {
    const parsedEnv = parseStrictOrigin(appUrl);
    if (parsedEnv) {
      allowed.add(parsedEnv);
    }
  }

  // In non-production environments, allow local development origins
  if (process.env.NODE_ENV !== "production") {
    allowed.add("http://localhost:3000");
    allowed.add("http://127.0.0.1:3000");
  }

  return Array.from(allowed);
}

/**
 * Checks whether an origin is authorized under the security allowlist.
 */
export function isAllowedOrigin(
  rawOrigin: string | null | undefined,
  options: CsrfValidationOptions = {}
): boolean {
  const parsed = parseStrictOrigin(rawOrigin);
  if (!parsed) return false;
  const allowed = getAllowedOrigins(options.trustedAppUrl);
  return allowed.includes(parsed);
}

/**
 * Resolves the canonical application origin from trusted server configuration.
 */
export function getCanonicalOrigin(overrideAppUrl?: string): string {
  const baseUrl = overrideAppUrl || getTrustedAppUrl();
  const origin = parseStrictOrigin(baseUrl);
  if (!origin) {
    throw new Error("INVALID_TRUSTED_APP_URL_CONFIGURATION");
  }
  return origin;
}

/**
 * Resolves safe CORS response headers for authorized origins.
 * Never uses wildcard "*" with credentials.
 */
export function getCorsHeaders(
  request: Request,
  options: CsrfValidationOptions = {}
): Record<string, string> | null {
  const rawOrigin = request.headers.get("origin");
  if (!rawOrigin) return null;

  const parsedOrigin = parseStrictOrigin(rawOrigin);
  if (!parsedOrigin || !isAllowedOrigin(parsedOrigin, options)) {
    return null;
  }

  return {
    "Access-Control-Allow-Origin": parsedOrigin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Requested-With, sec-fetch-site",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

/**
 * Handles CORS preflight OPTIONS requests securely.
 * Rejects untrusted origins with 403 Forbidden.
 */
export function handleCorsPreflight(
  request: Request,
  options: CsrfValidationOptions = {}
): NextResponse {
  const corsHeaders = getCorsHeaders(request, options);
  if (!corsHeaders) {
    return NextResponse.json(
      { error: "Origin not permitted.", code: "CORS_ORIGIN_DENIED" },
      { status: 403 }
    );
  }

  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * Validates browser state-changing requests against Cross-Site Request Forgery (CSRF).
 *
 * Security rules enforced:
 * 1. Fetch Metadata (`Sec-Fetch-Site`) is checked as a defense-in-depth signal:
 *    - `cross-site` and `same-site` (sibling subdomains) are rejected immediately.
 *    - `same-origin` still requires exact `Origin` / `Referer` origin verification.
 * 2. If `Origin` header is present, it is parsed strictly and validated against the explicit
 *    trusted origin allowlist. Malformed or mismatched `Origin` values never fall back to `Referer`.
 * 3. If `Origin` is absent, `Referer` is parsed strictly and its origin is compared against
 *    the explicit trusted origin allowlist.
 * 4. If both `Origin` and `Referer` are absent, the request is rejected.
 * 5. For JSON endpoints (`requireJsonContentType !== false`), `Content-Type` must be `application/json`.
 */
export function validateCsrfRequest(
  request: Request,
  options: CsrfValidationOptions = {}
): CsrfValidationResult {
  const { requireJsonContentType = true, trustedAppUrl } = options;

  try {
    getCanonicalOrigin(trustedAppUrl);
  } catch {
    return {
      allowed: false,
      code: "CSRF_ORIGIN_MISMATCH",
      error: "Request origin validation failed.",
      status: 403,
    };
  }

  // 1. Fetch Metadata defense-in-depth signal
  const secFetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
  if (secFetchSite) {
    // Reject cross-site AND same-site (do not treat same-site as equivalent to same-origin)
    if (secFetchSite === "cross-site" || secFetchSite === "same-site") {
      return {
        allowed: false,
        code: "CSRF_CROSS_SITE_FETCH",
        error: "Cross-origin requests are not permitted.",
        status: 403,
      };
    }
    if (secFetchSite !== "same-origin" && secFetchSite !== "none") {
      return {
        allowed: false,
        code: "CSRF_CROSS_SITE_FETCH",
        error: "Cross-origin requests are not permitted.",
        status: 403,
      };
    }
  }

  // 2. Origin header check (primary)
  const rawOrigin = request.headers.get("origin");
  if (rawOrigin !== null) {
    const parsedOrigin = parseStrictOrigin(rawOrigin);
    if (!parsedOrigin) {
      return {
        allowed: false,
        code: "CSRF_MALFORMED_ORIGIN",
        error: "Malformed request origin.",
        status: 403,
      };
    }

    if (!isAllowedOrigin(parsedOrigin, options)) {
      return {
        allowed: false,
        code: "CSRF_ORIGIN_MISMATCH",
        error: "Cross-origin requests are not permitted.",
        status: 403,
      };
    }
  } else {
    // 3. Referer fallback (only when Origin is absent)
    const rawReferer = request.headers.get("referer");
    if (rawReferer === null || rawReferer.trim() === "") {
      return {
        allowed: false,
        code: "CSRF_MISSING_ORIGIN",
        error: "Missing request origin header.",
        status: 403,
      };
    }

    const parsedRefererOrigin = parseStrictOrigin(rawReferer);
    if (!parsedRefererOrigin) {
      return {
        allowed: false,
        code: "CSRF_MALFORMED_REFERER",
        error: "Malformed request referer.",
        status: 403,
      };
    }

    if (!isAllowedOrigin(parsedRefererOrigin, options)) {
      return {
        allowed: false,
        code: "CSRF_REFERER_MISMATCH",
        error: "Cross-origin requests are not permitted.",
        status: 403,
      };
    }
  }

  // 4. Content-Type check for JSON endpoints
  if (requireJsonContentType) {
    const contentType = request.headers.get("content-type")?.toLowerCase() || "";
    const mediaType = contentType.split(";")[0].trim();
    if (mediaType !== "application/json") {
      return {
        allowed: false,
        code: "CSRF_INVALID_CONTENT_TYPE",
        error: "Expected application/json content type.",
        status: 415,
      };
    }
  }

  return { allowed: true };
}

/**
 * Helper for Next.js API route handlers that returns a ready-to-send NextResponse
 * when CSRF validation fails, or `null` when the request is valid.
 */
export function enforceCsrfProtection(
  request: Request,
  routeName: string,
  options: CsrfValidationOptions = {}
): NextResponse | null {
  const result = validateCsrfRequest(request, options);
  if (result.allowed) {
    return null;
  }

  logger.security("csrf_validation_rejected", {
    route: routeName,
    code: result.code,
    method: request.method,
    origin: request.headers.get("origin") || null,
    secFetchSite: request.headers.get("sec-fetch-site") || null,
  });

  return NextResponse.json(
    {
      error: result.error || "Cross-origin request forbidden.",
      code: result.code || "CSRF_REJECTED",
    },
    { status: result.status || 403 }
  );
}
