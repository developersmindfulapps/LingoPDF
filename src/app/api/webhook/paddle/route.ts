import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { ObjectId } from "mongodb";
import { EventName, type EventEntity } from "@paddle/paddle-node-sdk";
import { getDb } from "@/lib/db/mongodb";
import {
  COLLECTION_NAMES,
  PurchaseDocument,
  EntitlementDocument,
  UserDocument,
  CommissionDocument,
} from "@/lib/db/models";
import { buildPaymentWebhookDocument } from "@/lib/db/repositories";
import { finalizeCapturedReferralRedemption } from "@/lib/referrals/service";
import {
  getPaddleInstance,
  getPaddleWebhookSecret,
  getPaddleProductId,
  getPaddlePriceId,
} from "@/lib/paddle/config";
import { sendPurchaseConfirmationEmail } from "@/lib/email/resend";
import { logger } from "@/lib/observability/logger";

const WEBHOOK_LEASE_DURATION_MS = 60 * 1000; // 60 seconds

export async function POST(request: NextRequest) {
  const signature = request.headers.get("paddle-signature") ?? "";
  const rawBody = await request.text();

  // 1. Pre-validation
  if (!signature || !rawBody) {
    return NextResponse.json(
      { error: "Missing paddle-signature header or empty request body" },
      { status: 400 }
    );
  }

  // 2. Signature verification & unmarshaling via Paddle SDK
  let eventData: EventEntity;
  try {
    const paddle = getPaddleInstance();
    const secret = getPaddleWebhookSecret();
    eventData = await paddle.webhooks.unmarshal(rawBody, secret, signature);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error("paddle_webhook_unmarshal_failed", { error: errorMsg });
    // Any non-2xx tells Paddle to retry on its exponential backoff schedule
    return NextResponse.json(
      { error: "Webhook signature verification or deserialization failed" },
      { status: 500 }
    );
  }

  // 3. Database connection
  let db;
  try {
    db = await getDb();
  } catch (dbErr) {
    logger.error("paddle_webhook_db_unavailable", { error: dbErr });
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 500 }
    );
  }

  const payloadHash = crypto.createHash("sha256").update(rawBody).digest("hex");
  const webhooksCollection = db.collection(COLLECTION_NAMES.paymentWebhooks);
  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + WEBHOOK_LEASE_DURATION_MS);

  // 4. Strict Idempotency & Atomic Concurrency Lease
  const existingWebhook = await webhooksCollection.findOne({
    provider: "paddle",
    eventId: eventData.eventId,
  });

  if (existingWebhook) {
    // Short-circuit ONLY if conclusively processed
    if (existingWebhook.processingStatus === "processed") {
      logger.info("paddle_webhook_deduplicated", {
        eventId: eventData.eventId,
        eventType: eventData.eventType,
        status: existingWebhook.processingStatus,
      });
      return NextResponse.json(
        { received: true, deduplicated: true },
        { status: 200 }
      );
    }

    // Atomic lease acquisition for unprocessed, interrupted, or failed events
    const claimed = await webhooksCollection.findOneAndUpdate(
      {
        _id: existingWebhook._id,
        processingStatus: { $ne: "processed" },
        $or: [
          { leaseExpiresAt: { $lt: now } },
          { leaseExpiresAt: null },
          { leaseExpiresAt: { $exists: false } },
          { processingStatus: { $in: ["received", "failed"] } },
        ],
      },
      {
        $set: {
          processingStatus: "processing",
          leaseExpiresAt,
        },
        $inc: { attempts: 1 },
      },
      { returnDocument: "after" }
    );

    if (!claimed) {
      // Another worker currently holds an active lease
      logger.info("paddle_webhook_lease_active", {
        eventId: eventData.eventId,
      });
      return NextResponse.json(
        { received: true, inProgress: true },
        { status: 200 }
      );
    }
  } else {
    // Insert initial webhook record with processing lease
    const webhookDoc = buildPaymentWebhookDocument({
      provider: "paddle",
      eventId: eventData.eventId,
      eventType: eventData.eventType,
      signatureVerified: true,
      payloadHash,
      payloadSummary: {
        eventId: eventData.eventId,
        eventType: eventData.eventType,
        occurredAt: eventData.occurredAt,
        resourceId: (eventData.data as { id?: string })?.id || null,
      },
      relatedOrderId: (eventData.data as { id?: string })?.id || null,
      relatedPaymentId: (eventData.data as { id?: string })?.id || null,
    });
    webhookDoc.processingStatus = "processing";
    webhookDoc.leaseExpiresAt = leaseExpiresAt;

    try {
      await webhooksCollection.insertOne(webhookDoc);
    } catch (insertErr: unknown) {
      const code = (insertErr as { code?: number })?.code;
      if (code === 11000) {
        // Concurrent insert occurred; check if already processed or claim lease
        const current = await webhooksCollection.findOne({
          provider: "paddle",
          eventId: eventData.eventId,
        });
        if (current?.processingStatus === "processed") {
          return NextResponse.json(
            { received: true, deduplicated: true },
            { status: 200 }
          );
        }
        const claimed = await webhooksCollection.findOneAndUpdate(
          {
            provider: "paddle",
            eventId: eventData.eventId,
            processingStatus: { $ne: "processed" },
            $or: [
              { leaseExpiresAt: { $lt: now } },
              { leaseExpiresAt: null },
              { leaseExpiresAt: { $exists: false } },
              { processingStatus: { $in: ["received", "failed"] } },
            ],
          },
          {
            $set: {
              processingStatus: "processing",
              leaseExpiresAt,
            },
            $inc: { attempts: 1 },
          },
          { returnDocument: "after" }
        );
        if (!claimed) {
          return NextResponse.json(
            { received: true, inProgress: true },
            { status: 200 }
          );
        }
      } else {
        throw insertErr;
      }
    }
  }

  // 5. Route by Event Type with Independent Idempotency
  const purchasesCollection = db.collection<PurchaseDocument>(
    COLLECTION_NAMES.purchases
  );
  const entitlementsCollection = db.collection<EntitlementDocument>(
    COLLECTION_NAMES.entitlements
  );
  const commissionsCollection = db.collection<CommissionDocument>(
    COLLECTION_NAMES.commissions
  );

  try {
    if (eventData.eventType === EventName.TransactionCompleted) {
      const txn = eventData.data;

      // Identify target purchase from customData or transactionId
      let purchase: PurchaseDocument | null = null;
      const customPurchaseId = txn.customData?.purchaseId;

      if (typeof customPurchaseId === "string" && ObjectId.isValid(customPurchaseId)) {
        purchase = await purchasesCollection.findOne({
          _id: new ObjectId(customPurchaseId),
        });
      }

      if (!purchase) {
        purchase = await purchasesCollection.findOne({
          $or: [
            { providerOrderId: txn.id },
            { paddleTransactionId: txn.id },
          ],
        });
      }

      if (!purchase) {
        logger.error("paddle_webhook_purchase_not_found", {
          transactionId: txn.id,
          customData: txn.customData,
        });
        await webhooksCollection.updateOne(
          { provider: "paddle", eventId: eventData.eventId },
          {
            $set: {
              processingStatus: "failed",
              lastError: `No matching purchase found for Paddle transaction ${txn.id}`,
              processedAt: new Date(),
              leaseExpiresAt: null,
            },
          }
        );
        return NextResponse.json(
          { received: true, error: "Purchase not found" },
          { status: 200 }
        );
      }

      // Catalog verification: verify product or price ID
      const expectedProductId = getPaddleProductId();
      const expectedPriceId = getPaddlePriceId();
      const items = txn.items || [];
      const hasMatchingItem = items.some(
        (item) =>
          item.price?.id === expectedPriceId ||
          item.price?.productId === expectedProductId
      );

      if (!hasMatchingItem && items.length > 0) {
        logger.warn("paddle_webhook_catalog_mismatch", {
          transactionId: txn.id,
          items: items.map((i) => ({ priceId: i.price?.id, prodId: i.price?.productId })),
        });
      }

      // 5A.1 Independent Purchase Capture (atomic transition pending -> captured)
      if (purchase.status === "pending") {
        const capturedPurchase = await purchasesCollection.findOneAndUpdate(
          {
            _id: purchase._id,
            status: "pending",
          },
          {
            $set: {
              status: "captured",
              capturedAt: now,
              providerPaymentId: txn.id,
              paddleTransactionId: txn.id,
              paddleCustomerId: txn.customerId || null,
              updatedAt: now,
            },
          },
          { returnDocument: "after" }
        );
        if (capturedPurchase) {
          purchase = capturedPurchase;
        }
      }

      // 5A.2 Independent Referral Finalization
      // Enforce authoritative Paddle subtotal and currency validation
      if (purchase.referrerUserId) {
        const existingCommission = await commissionsCollection.findOne({
          purchaseId: purchase._id,
        });

        if (!existingCommission) {
          const totals = txn.details?.totals;
          if (!totals || typeof totals.subtotal !== "string") {
            throw new Error(
              `Missing authoritative transaction totals for Paddle transaction ${txn.id}`
            );
          }
          const subtotalInt = parseInt(totals.subtotal, 10);
          if (isNaN(subtotalInt) || subtotalInt <= 0) {
            throw new Error(
              `Invalid authoritative transaction subtotal (${totals.subtotal}) for Paddle transaction ${txn.id}`
            );
          }
          if (totals.currencyCode !== purchase.currency) {
            throw new Error(
              `Paddle transaction currency (${totals.currencyCode}) does not match purchase currency (${purchase.currency})`
            );
          }

          try {
            await finalizeCapturedReferralRedemption(db, {
              referrerUserId: purchase.referrerUserId,
              purchaserUserId: purchase.userId,
              purchaseId: purchase._id,
              currency: purchase.currency,
              paidAmountMinor: subtotalInt,
              capturedAt: purchase.capturedAt || now,
            });
            logger.info("paddle_referral_finalized", {
              purchaseId: purchase._id,
              subtotal: subtotalInt,
              currency: purchase.currency,
            });
          } catch (refErr) {
            logger.error("paddle_referral_finalize_failed", {
              purchaseId: purchase._id,
              error: refErr,
            });
            throw refErr;
          }
        }
      }

      // 5A.3 Independent Entitlement Provisioning
      const existingEntitlement = await entitlementsCollection.findOne({
        userId: purchase.userId,
        productSlug: "german",
        status: { $in: ["active", "suspended"] },
      });

      if (!existingEntitlement) {
        const newEntitlement: EntitlementDocument = {
          _id: new ObjectId(),
          userId: purchase.userId,
          purchaseId: purchase._id,
          productSlug: "german",
          status: "active",
          activeRestrictionReasons: [],
          revocationReason: null,
          maxActiveDevices: 1,
          activeInstallationIdHash: null,
          deviceBoundAt: null,
          lastValidatedAt: null,
          offlineLeaseExpiresAt: null,
          suspendedAt: null,
          revokedAt: null,
          source: "purchase",
          createdAt: now,
          updatedAt: now,
        };

        await entitlementsCollection.insertOne(newEntitlement);
        logger.info("paddle_entitlement_provisioned", {
          userId: purchase.userId,
          purchaseId: purchase._id,
          entitlementId: newEntitlement._id,
        });
      }

      // 5A.4 Asynchronously dispatch confirmation email
      const userDoc = await db
        .collection<UserDocument>(COLLECTION_NAMES.users)
        .findOne({ _id: purchase.userId });

      if (userDoc?.email) {
        const formattedAmount =
          purchase.currency === "INR"
            ? `₹${(purchase.pricingSnapshot.totalSubunits / 100).toLocaleString("en-IN")}`
            : purchase.currency === "EUR"
            ? `€${(purchase.pricingSnapshot.totalSubunits / 100).toFixed(0)}`
            : `$${(purchase.pricingSnapshot.totalSubunits / 100).toFixed(0)}`;

        sendPurchaseConfirmationEmail({
          to: userDoc.email,
          name: userDoc.name,
          orderId: purchase._id.toString(),
          transactionId: txn.id,
          amountFormatted: formattedAmount,
        }).catch((err) => {
          logger.error("paddle_purchase_confirmation_email_error", {
            error: err,
          });
        });
      }

      // Mark webhook as processed
      await webhooksCollection.updateOne(
        { provider: "paddle", eventId: eventData.eventId },
        {
          $set: {
            processingStatus: "processed",
            processedAt: new Date(),
            leaseExpiresAt: null,
          },
        }
      );

      return NextResponse.json({ received: true }, { status: 200 });
    }

    if (eventData.eventType === EventName.TransactionCanceled) {
      const txn = eventData.data;
      await purchasesCollection.updateOne(
        {
          $or: [{ providerOrderId: txn.id }, { paddleTransactionId: txn.id }],
          status: "pending",
        },
        {
          $set: {
            status: "failed",
            updatedAt: new Date(),
          },
        }
      );

      await webhooksCollection.updateOne(
        { provider: "paddle", eventId: eventData.eventId },
        {
          $set: {
            processingStatus: "processed",
            processedAt: new Date(),
            leaseExpiresAt: null,
          },
        }
      );

      return NextResponse.json({ received: true }, { status: 200 });
    }

    if (
      eventData.eventType === EventName.AdjustmentUpdated ||
      eventData.eventType === EventName.AdjustmentCreated
    ) {
      const adj = eventData.data as {
        transactionId?: string;
        action?: string;
        status?: string;
        outcome?: string;
        disputeOutcome?: string;
        closed?: boolean;
      };
      const targetTxnId = adj.transactionId;

      if (targetTxnId) {
        const action = adj.action;
        const status = adj.status;

        const purchase = await purchasesCollection.findOne({
          $or: [
            { providerOrderId: targetTxnId },
            { providerPaymentId: targetTxnId },
            { paddleTransactionId: targetTxnId },
          ],
        });

        if (purchase) {
          const isDisputeLost =
            adj.outcome === "lost" ||
            adj.disputeOutcome === "lost" ||
            (action === "chargeback" && (status === "lost" || adj.closed === true));

          const isDisputeWonOrReversed =
            action === "chargeback_reverse" ||
            action === "chargeback_warning_reverse" ||
            status === "reversed" ||
            (action === "chargeback" && status === "rejected") ||
            adj.outcome === "won";

          const isRefund =
            action === "refund" &&
            (status === "approved" || !status || status === "pending_approval");

          const isOpenChargeback =
            (action === "chargeback" || action === "chargeback_warning") &&
            !isDisputeLost &&
            !isDisputeWonOrReversed;

          if (isRefund) {
            // 1. Confirmed Refund
            await purchasesCollection.updateOne(
              { _id: purchase._id },
              {
                $set: {
                  status: "refunded",
                  refundedAt: now,
                  updatedAt: now,
                },
              }
            );

            // Permanently revoke active/suspended entitlements
            await entitlementsCollection.updateMany(
              {
                userId: purchase.userId,
                status: { $in: ["active", "suspended"] },
              },
              {
                $set: {
                  status: "revoked",
                  revocationReason: "refunded",
                  revokedAt: now,
                  activeInstallationIdHash: null,
                  offlineLeaseExpiresAt: null,
                  updatedAt: now,
                },
              }
            );

            // Cancel unpaid/pending commissions (NEVER claw back paid commissions)
            await commissionsCollection.updateMany(
              {
                purchaseId: purchase._id,
                status: { $in: ["pending", "eligible", "approved"] },
              },
              {
                $set: {
                  status: "cancelled",
                  cancellationReason: "refund",
                  cancelledAt: now,
                  updatedAt: now,
                },
              }
            );

            logger.info("paddle_webhook_refund_processed", { purchaseId: purchase._id });
          } else if (isOpenChargeback) {
            // 2. Open Chargeback / Dispute
            await purchasesCollection.updateOne(
              { _id: purchase._id },
              {
                $set: {
                  status: "disputed",
                  disputedAt: now,
                  updatedAt: now,
                },
              }
            );

            // Restrict entitlement by adding chargeback_open
            await entitlementsCollection.updateMany(
              {
                userId: purchase.userId,
                status: { $in: ["active", "suspended"] },
              },
              {
                $set: {
                  status: "suspended",
                  suspendedAt: now,
                  updatedAt: now,
                },
                $addToSet: {
                  activeRestrictionReasons: "chargeback_open",
                },
              }
            );

            // Place pending/unpaid commissions on dispute hold
            await commissionsCollection.updateMany(
              {
                purchaseId: purchase._id,
                status: { $in: ["pending", "eligible", "approved"] },
              },
              {
                $set: {
                  isDisputedHold: true,
                  updatedAt: now,
                },
              }
            );

            logger.info("paddle_webhook_chargeback_opened", { purchaseId: purchase._id });
          } else if (isDisputeWonOrReversed) {
            // 3. Dispute Reversed / Won
            await purchasesCollection.updateOne(
              { _id: purchase._id, status: "disputed" },
              {
                $set: {
                  status: "captured",
                  updatedAt: now,
                },
              }
            );

            // Clear chargeback_open restriction
            await entitlementsCollection.updateMany(
              {
                userId: purchase.userId,
                status: "suspended",
              },
              {
                $pull: {
                  activeRestrictionReasons: "chargeback_open",
                },
                $set: {
                  updatedAt: now,
                },
              }
            );

            // Restore active status only if no other independent restrictions remain
            await entitlementsCollection.updateMany(
              {
                userId: purchase.userId,
                status: "suspended",
                activeRestrictionReasons: { $size: 0 },
              },
              {
                $set: {
                  status: "active",
                  suspendedAt: null,
                  updatedAt: now,
                },
              }
            );

            // Release dispute hold on commissions
            await commissionsCollection.updateMany(
              {
                purchaseId: purchase._id,
                status: { $in: ["pending", "eligible", "approved"] },
              },
              {
                $set: {
                  isDisputedHold: false,
                  updatedAt: now,
                },
              }
            );

            logger.info("paddle_webhook_dispute_reversed", { purchaseId: purchase._id });
          } else if (isDisputeLost) {
            // 4. Dispute Lost
            await purchasesCollection.updateOne(
              { _id: purchase._id },
              {
                $set: {
                  status: "chargeback_lost",
                  updatedAt: now,
                },
              }
            );

            // Revoke entitlement permanently
            await entitlementsCollection.updateMany(
              {
                userId: purchase.userId,
                status: { $in: ["active", "suspended"] },
              },
              {
                $set: {
                  status: "revoked",
                  revocationReason: "chargeback_lost",
                  revokedAt: now,
                  activeInstallationIdHash: null,
                  offlineLeaseExpiresAt: null,
                  updatedAt: now,
                },
              }
            );

            // Cancel unpaid/pending commissions (NEVER touch paid commissions)
            await commissionsCollection.updateMany(
              {
                purchaseId: purchase._id,
                status: { $in: ["pending", "eligible", "approved"] },
              },
              {
                $set: {
                  status: "cancelled",
                  cancellationReason: "chargeback",
                  cancelledAt: now,
                  updatedAt: now,
                },
              }
            );

            logger.info("paddle_webhook_dispute_lost", { purchaseId: purchase._id });
          }
        }
      }

      await webhooksCollection.updateOne(
        { provider: "paddle", eventId: eventData.eventId },
        {
          $set: {
            processingStatus: "processed",
            processedAt: new Date(),
            leaseExpiresAt: null,
          },
        }
      );

      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Default: for any other event (e.g. customer.created), acknowledge fast
    await webhooksCollection.updateOne(
      { provider: "paddle", eventId: eventData.eventId },
      {
        $set: {
          processingStatus: "processed",
          processedAt: new Date(),
          leaseExpiresAt: null,
        },
      }
    );

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (processErr: unknown) {
    const errorMsg =
      processErr instanceof Error ? processErr.message : String(processErr);
    logger.error("paddle_webhook_processing_exception", { error: errorMsg });

    await webhooksCollection.updateOne(
      { provider: "paddle", eventId: eventData.eventId },
      {
        $set: {
          processingStatus: "failed",
          lastError: errorMsg,
          processedAt: new Date(),
          leaseExpiresAt: null,
        },
      }
    );

    return NextResponse.json(
      { error: "Webhook processing failure" },
      { status: 500 }
    );
  }
}
