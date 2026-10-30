import { Resend } from "resend";
import { renderVerificationEmail, renderPasswordResetEmail } from "./templates";

export interface SendEmailResult {
  success: boolean;
  accepted: boolean; // Indicates the email provider accepted the message for sending; does not claim confirmed inbox delivery
  messageId?: string;
  error?: string;
  code?: string;
  isDomainUnverified?: boolean;
  isMocked?: boolean;
}

/**
 * Returns the trusted application URL.
 * Never uses arbitrary Host headers to prevent password reset poisoning attacks.
 */
export function getTrustedAppUrl(): string {
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NODE_ENV === "production"
      ? "https://lingopdf.in"
      : "http://localhost:3000");
  return envUrl.replace(/\/+$/, "");
}

/**
 * Helper to get the Resend client instance.
 */
function getResendClient(): { resend: Resend | null; error?: string } {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    return { resend: null, error: "RESEND_API_KEY is not configured" };
  }
  return { resend: new Resend(apiKey) };
}

function getEmailConfig() {
  return {
    from: process.env.EMAIL_FROM || "LingoPDF <noreply@lingopdf.in>",
    replyTo: process.env.EMAIL_REPLY_TO || "support@lingopdf.in",
  };
}

/**
 * Checks whether email sending should run in mock mode.
 * Mock mode is active when EMAIL_MOCK is "true" or during designated test executions.
 */
export function isMockEmailActive(): boolean {
  return process.env.EMAIL_MOCK === "true";
}

/**
 * Sends an email verification link.
 * Single-use token is passed in plaintext only here to build the URL; never logged.
 */
export async function sendVerificationEmail(params: {
  to: string;
  name?: string;
  token: string;
}): Promise<SendEmailResult> {
  const { to, name, token } = params;
  const baseUrl = getTrustedAppUrl();
  const verifyUrl = `${baseUrl}/verify-email?token=${token}`;
  const template = renderVerificationEmail({ name, verifyUrl });
  const { from, replyTo } = getEmailConfig();

  if (isMockEmailActive()) {
    return {
      success: true,
      accepted: true,
      messageId: `mock-verif-${Date.now()}`,
      isMocked: true,
    };
  }

  const { resend, error: clientError } = getResendClient();
  if (!resend) {
    return {
      success: false,
      accepted: false,
      error: clientError || "Email client unavailable",
      code: "EMAIL_NOT_CONFIGURED",
    };
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      replyTo,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    if (error) {
      const errMsg = error.message || "Failed to send verification email";
      const isUnverified =
        errMsg.toLowerCase().includes("not verified") ||
        errMsg.toLowerCase().includes("unverified");

      return {
        success: false,
        accepted: false,
        error: errMsg,
        code: isUnverified ? "DOMAIN_NOT_VERIFIED" : "RESEND_ERROR",
        isDomainUnverified: isUnverified,
      };
    }

    if (!data?.id) {
      return {
        success: false,
        accepted: false,
        error: "Resend did not return a message identifier",
        code: "NO_MESSAGE_ID",
      };
    }

    return {
      success: true,
      accepted: true,
      messageId: data.id,
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : "Unknown email error";
    const isUnverified =
      errMsg.toLowerCase().includes("not verified") ||
      errMsg.toLowerCase().includes("unverified");
    return {
      success: false,
      accepted: false,
      error: errMsg,
      code: isUnverified ? "DOMAIN_NOT_VERIFIED" : "NETWORK_ERROR",
      isDomainUnverified: isUnverified,
    };
  }
}

/**
 * Sends a password reset email.
 * Single-use token is passed in plaintext only to build the reset URL; never logged.
 */
export async function sendPasswordResetEmail(params: {
  to: string;
  name?: string;
  token: string;
}): Promise<SendEmailResult> {
  const { to, name, token } = params;
  const baseUrl = getTrustedAppUrl();
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;
  const template = renderPasswordResetEmail({ name, resetUrl });
  const { from, replyTo } = getEmailConfig();

  if (isMockEmailActive()) {
    return {
      success: true,
      accepted: true,
      messageId: `mock-reset-${Date.now()}`,
      isMocked: true,
    };
  }

  const { resend, error: clientError } = getResendClient();
  if (!resend) {
    return {
      success: false,
      accepted: false,
      error: clientError || "Email client unavailable",
      code: "EMAIL_NOT_CONFIGURED",
    };
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      replyTo,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    if (error) {
      const errMsg = error.message || "Failed to send password reset email";
      const isUnverified =
        errMsg.toLowerCase().includes("not verified") ||
        errMsg.toLowerCase().includes("unverified");

      return {
        success: false,
        accepted: false,
        error: errMsg,
        code: isUnverified ? "DOMAIN_NOT_VERIFIED" : "RESEND_ERROR",
        isDomainUnverified: isUnverified,
      };
    }

    if (!data?.id) {
      return {
        success: false,
        accepted: false,
        error: "Resend did not return a message identifier",
        code: "NO_MESSAGE_ID",
      };
    }

    return {
      success: true,
      accepted: true,
      messageId: data.id,
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : "Unknown email error";
    const isUnverified =
      errMsg.toLowerCase().includes("not verified") ||
      errMsg.toLowerCase().includes("unverified");
    return {
      success: false,
      accepted: false,
      error: errMsg,
      code: isUnverified ? "DOMAIN_NOT_VERIFIED" : "NETWORK_ERROR",
      isDomainUnverified: isUnverified,
    };
  }
}
