import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db/mongodb";
import { requireAdminRequest } from "@/lib/auth/admin";
import { enforceIpRateLimit } from "@/lib/auth/rateLimit";
import { enforceCsrfProtection } from "@/lib/security/csrf";
import {
  createPromotionalCode,
  disablePromotionalCode,
  getPromotionalCodeStats,
  listPromotionalCodes,
} from "@/lib/promoCodes/service";
import { logger } from "@/lib/observability/logger";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
};

export async function GET(request: NextRequest) {
  let db;
  try {
    db = await getDb();
  } catch (err) {
    logger.error("admin_promo_codes_db_unavailable", { error: err });
    return NextResponse.json(
      { error: "Database unavailable", code: "DB_UNAVAILABLE" },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }

  const auth = await requireAdminRequest(request, db);
  if (!auth.authorized) {
    return auth.deniedResponse;
  }

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = parseInt(url.searchParams.get("limit") || "25", 10);
  const status = url.searchParams.get("status") || "all";
  const q = url.searchParams.get("q") || "";

  try {
    const [listResult, stats] = await Promise.all([
      listPromotionalCodes(db, { page, limit, status, q }),
      getPromotionalCodeStats(db),
    ]);

    return NextResponse.json(
      {
        ...listResult,
        stats,
      },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  } catch (err: unknown) {
    logger.error("admin_promo_codes_list_error", { error: err });
    return NextResponse.json(
      { error: "Failed to list promotional codes", code: "INTERNAL_ERROR" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

export async function POST(request: NextRequest) {
  const csrfBlocked = enforceCsrfProtection(request, "admin.promo_codes");
  if (csrfBlocked) return csrfBlocked;

  const { blockedResponse: ipBlocked } = await enforceIpRateLimit({
    request,
    policy: "adminMutation",
    rateLimitExceededMessage: "Too many administrative requests. Please wait.",
  });
  if (ipBlocked) return ipBlocked;

  let db;
  try {
    db = await getDb();
  } catch (err) {
    logger.error("admin_promo_codes_db_unavailable", { error: err });
    return NextResponse.json(
      { error: "Database unavailable", code: "DB_UNAVAILABLE" },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }

  const auth = await requireAdminRequest(request, db);
  if (!auth.authorized) {
    return auth.deniedResponse;
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload", code: "INVALID_JSON" },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const action = typeof body?.action === "string" ? body.action : "";

  if (action === "create") {
    try {
      const result = await createPromotionalCode(
        db,
        {
          label: typeof body.label === "string" ? body.label : null,
          expiresAt:
            typeof body.expiresAt === "string" ? body.expiresAt : null,
          discountPercent: 100, // Invariant: always 100%
          productEdition: "german", // Invariant: German -> English
        },
        auth.context
      );

      return NextResponse.json(
        {
          message: "Promotional licence code generated successfully.",
          promoCode: {
            id: result.promoCode._id.toString(),
            codeMasked: result.promoCode.codeMasked,
            label: result.promoCode.label,
            status: result.promoCode.status,
            createdAt: result.promoCode.createdAt.toISOString(),
            expiresAt: result.promoCode.expiresAt
              ? result.promoCode.expiresAt.toISOString()
              : null,
          },
          fullCode: result.fullCode, // Plaintext code delivered ONLY once to creator
        },
        { status: 200, headers: NO_STORE_HEADERS }
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Creation failed";
      return NextResponse.json(
        { error: msg, code: "CREATE_FAILED" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }
  }

  if (action === "disable") {
    const id = typeof body.id === "string" ? body.id : "";
    const reason = typeof body.reason === "string" ? body.reason : null;
    if (!id || !/^[a-fA-F0-9]{24}$/.test(id)) {
      return NextResponse.json(
        { error: "Valid promotional code ID is required", code: "INVALID_ID" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    try {
      const updated = await disablePromotionalCode(
        db,
        new ObjectId(id),
        reason,
        auth.context
      );

      return NextResponse.json(
        {
          message: "Promotional code disabled successfully.",
          promoCode: {
            id: updated._id.toString(),
            status: updated.status,
            disabledAt: updated.disabledAt?.toISOString(),
            disableReason: updated.disableReason,
          },
        },
        { status: 200, headers: NO_STORE_HEADERS }
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Disable failed";
      return NextResponse.json(
        { error: msg, code: "DISABLE_FAILED" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }
  }

  return NextResponse.json(
    { error: "Unknown action specified", code: "UNKNOWN_ACTION" },
    { status: 400, headers: NO_STORE_HEADERS }
  );
}
