import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db/mongodb";
import { validateSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { COLLECTION_NAMES, PurchaseDocument, EntitlementDocument } from "@/lib/db/models";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
};

export async function GET(request: NextRequest) {
  let db;
  try {
    db = await getDb();
  } catch {
    return NextResponse.json(
      { error: "Database unavailable", code: "DB_UNAVAILABLE" },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }

  // 1. Authenticate user
  let sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    try {
      const cookieStore = await cookies();
      sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    } catch {
      // Standalone test fallback
    }
  }

  if (!sessionToken) {
    return NextResponse.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  const sessionResult = await validateSession(db, sessionToken);
  if (!sessionResult || !sessionResult.user) {
    return NextResponse.json(
      { error: "Session expired", code: "SESSION_EXPIRED" },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  const user = sessionResult.user;

  // 2. Query purchase by purchaseId or transactionId
  const searchParams = request.nextUrl.searchParams;
  const purchaseIdStr = searchParams.get("purchaseId");
  const transactionId = searchParams.get("transactionId");

  if (!purchaseIdStr && !transactionId) {
    return NextResponse.json(
      { error: "Missing purchaseId or transactionId query parameter", code: "PARAM_REQUIRED" },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const query: Record<string, unknown> = {
    userId: user._id,
  };

  if (purchaseIdStr) {
    if (!ObjectId.isValid(purchaseIdStr)) {
      return NextResponse.json(
        { error: "Invalid purchaseId format", code: "INVALID_PURCHASE_ID" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }
    query._id = new ObjectId(purchaseIdStr);
  } else if (transactionId) {
    query.$or = [
      { providerOrderId: transactionId },
      { providerPaymentId: transactionId },
      { paddleTransactionId: transactionId },
    ];
  }

  const purchase = await db
    .collection<PurchaseDocument>(COLLECTION_NAMES.purchases)
    .findOne(query);

  if (!purchase) {
    return NextResponse.json(
      { error: "Purchase not found", code: "PURCHASE_NOT_FOUND" },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }

  // 3. Check for active entitlement
  const entitlement = await db
    .collection<EntitlementDocument>(COLLECTION_NAMES.entitlements)
    .findOne({
      userId: user._id,
      productSlug: purchase.productSlug || "german",
      status: "active",
    });

  return NextResponse.json(
    {
      purchaseId: purchase._id.toString(),
      status: purchase.status,
      isCaptured: purchase.status === "captured",
      hasEntitlement: Boolean(entitlement),
      entitlementId: entitlement ? entitlement._id.toString() : null,
      currency: purchase.currency,
      amountSubunits: purchase.pricingSnapshot.totalSubunits,
      capturedAt: purchase.capturedAt,
    },
    { status: 200, headers: NO_STORE_HEADERS }
  );
}
