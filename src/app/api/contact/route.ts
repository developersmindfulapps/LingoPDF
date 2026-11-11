import { NextRequest, NextResponse } from "next/server";
import { contactFormSchema } from "@/lib/contact/validation";
import {
  enforceIpRateLimit,
  enforceEmailRateLimit,
} from "@/lib/auth/rateLimit";
import { enforceCsrfProtection } from "@/lib/security/csrf";
import { sendSupportContactEmail } from "@/lib/email/resend";
import { logger } from "@/lib/observability/logger";

const MAX_PAYLOAD_BYTES = 64 * 1024; // 64 KB limit

export async function POST(request: NextRequest) {
  try {
    // 1. Request size limit check
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_BYTES) {
      return NextResponse.json(
        { error: "Payload exceeds allowable limit", code: "PAYLOAD_TOO_LARGE" },
        { status: 413 }
      );
    }

    // 2. CSRF / Origin validation
    const csrfBlocked = enforceCsrfProtection(request, "contact.submit");
    if (csrfBlocked) {
      return csrfBlocked;
    }

    // 3. Persistent IP rate limiting (max 5 submissions per hour per IP)
    const { blockedResponse: ipBlocked } = await enforceIpRateLimit({
      request,
      policy: "contact",
      rateLimitExceededMessage:
        "Too many contact requests from this network. Please try again in an hour.",
    });
    if (ipBlocked) {
      return ipBlocked;
    }

    // 4. Parse request JSON body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload", code: "INVALID_JSON" },
        { status: 400 }
      );
    }

    // 5. Spam / Honeypot rejection
    if (
      body &&
      typeof body === "object" &&
      "hp_website" in body &&
      typeof (body as Record<string, unknown>).hp_website === "string" &&
      ((body as Record<string, unknown>).hp_website as string).trim() !== ""
    ) {
      logger.security("contact_honeypot_triggered", {
        origin: request.headers.get("origin") || null,
      });
      return NextResponse.json(
        { error: "Invalid submission", code: "SPAM_REJECTED" },
        { status: 400 }
      );
    }

    // 6. Schema validation
    const parsed = contactFormSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        {
          error: firstIssue?.message || "Please fill in all required fields correctly.",
          code: "VALIDATION_ERROR",
          issues: parsed.error.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const { name, email, subject, message, browser } = parsed.data;

    // 7. Persistent Email rate limiting (max 3 submissions per hour per email)
    const emailBlocked = await enforceEmailRateLimit({
      policy: "contact",
      email,
      rateLimitExceededMessage:
        "Too many contact requests for this email address. Please try again in an hour.",
    });
    if (emailBlocked) {
      return emailBlocked;
    }

    // 8. Deliver email to support inbox via Resend
    const sendResult = await sendSupportContactEmail({
      name,
      email,
      subject,
      message,
      browser,
      timestamp: new Date(),
    });

    if (!sendResult.success) {
      logger.error("support_contact_delivery_failed", {
        code: sendResult.code,
        error: sendResult.error,
        emailDomain: email.split("@")[1] || "unknown",
      });
      return NextResponse.json(
        {
          error:
            "Unable to send your message right now. Please try again later or email support@lingopdf.in directly.",
          code: "DELIVERY_FAILED",
        },
        { status: 500 }
      );
    }

    logger.info("support_contact_delivered_successfully", {
      messageId: sendResult.messageId,
      emailDomain: email.split("@")[1] || "unknown",
    });

    return NextResponse.json(
      {
        message:
          "Thank you for contacting LingoPDF. Your message has been sent successfully. Our support team will get back to you.",
        code: "MESSAGE_SENT",
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error("support_contact_unexpected_error", { error });
    return NextResponse.json(
      {
        error:
          "An unexpected server error occurred. Please try again later or email support@lingopdf.in.",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}
