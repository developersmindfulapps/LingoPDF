interface EmailTemplateResult {
  subject: string;
  html: string;
  text: string;
}

export function renderVerificationEmail(params: {
  name?: string;
  verifyUrl: string;
  expiresHours?: number;
}): EmailTemplateResult {
  const { name, verifyUrl, expiresHours = 24 } = params;
  const greeting = name ? `Hello ${name},` : "Hello,";
  const subject = "Verify your email for LingoPDF";

  const text = `${greeting}

Welcome to LingoPDF! Please verify your email address to complete your registration.

Verify your email:
${verifyUrl}

This verification link will expire in ${expiresHours} hours.

If you did not create a LingoPDF account, you can safely ignore this email.

Best regards,
The LingoPDF Team
support@lingopdf.in
`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8F5EE; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #242923; line-height: 1.6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8F5EE; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #FFFFFF; border: 1px solid #E8E4D9; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(25, 60, 50, 0.04);">
          <!-- Brand Header -->
          <tr>
            <td style="background-color: #193C32; padding: 28px 36px; text-align: left;">
              <span style="font-size: 22px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.5px;">Lingo<span style="color: #D87854;">PDF</span></span>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 36px 36px 24px 36px;">
              <h1 style="font-size: 20px; font-weight: 700; color: #193C32; margin: 0 0 16px 0; line-height: 1.3;">Verify your email address</h1>
              <p style="font-size: 15px; color: #242923; margin: 0 0 20px 0;">${greeting}</p>
              <p style="font-size: 15px; color: #242923; margin: 0 0 24px 0;">
                Thank you for creating an account with LingoPDF. Please verify your email address by clicking the button below to complete your registration.
              </p>

              <!-- Action Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
                <tr>
                  <td align="center" style="border-radius: 10px; background-color: #193C32;">
                    <a href="${verifyUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 14px 28px; font-size: 15px; font-weight: 600; color: #FFFFFF; text-decoration: none; border-radius: 10px;">
                      Verify Email Address
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Notice Box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8F5EE; border-left: 3px solid #D87854; border-radius: 0 8px 8px 0; padding: 12px 16px; margin: 24px 0;">
                <tr>
                  <td>
                    <p style="margin: 0; font-size: 13px; color: #242923;">
                      <strong>Security Note:</strong> This verification link will expire in <strong>${expiresHours} hours</strong>. If you did not sign up for LingoPDF, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="font-size: 13px; color: #666666; margin: 24px 0 0 0; word-break: break-all;">
                If the button above does not work, copy and paste this link into your browser:<br>
                <a href="${verifyUrl}" style="color: #193C32; text-decoration: underline;">${verifyUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F8F5EE; padding: 20px 36px; border-top: 1px solid #E8E4D9; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #777777;">
                LingoPDF • Effortless PDF inline translations
              </p>
              <p style="margin: 0; font-size: 12px; color: #777777;">
                Questions? Contact us at <a href="mailto:support@lingopdf.in" style="color: #193C32; text-decoration: underline;">support@lingopdf.in</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

export function renderPasswordResetEmail(params: {
  name?: string;
  resetUrl: string;
  expiresHours?: number;
}): EmailTemplateResult {
  const { name, resetUrl, expiresHours = 1 } = params;
  const greeting = name ? `Hello ${name},` : "Hello,";
  const subject = "Reset your LingoPDF password";

  const text = `${greeting}

We received a request to reset the password for your LingoPDF account.

Reset your password:
${resetUrl}

This link is valid for ${expiresHours} hour(s).

If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.

Best regards,
The LingoPDF Team
support@lingopdf.in
`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8F5EE; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #242923; line-height: 1.6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8F5EE; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #FFFFFF; border: 1px solid #E8E4D9; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(25, 60, 50, 0.04);">
          <!-- Brand Header -->
          <tr>
            <td style="background-color: #193C32; padding: 28px 36px; text-align: left;">
              <span style="font-size: 22px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.5px;">Lingo<span style="color: #D87854;">PDF</span></span>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 36px 36px 24px 36px;">
              <h1 style="font-size: 20px; font-weight: 700; color: #193C32; margin: 0 0 16px 0; line-height: 1.3;">Reset your password</h1>
              <p style="font-size: 15px; color: #242923; margin: 0 0 20px 0;">${greeting}</p>
              <p style="font-size: 15px; color: #242923; margin: 0 0 24px 0;">
                We received a request to reset the password for your LingoPDF account. Click the button below to choose a new password.
              </p>

              <!-- Action Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
                <tr>
                  <td align="center" style="border-radius: 10px; background-color: #193C32;">
                    <a href="${resetUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 14px 28px; font-size: 15px; font-weight: 600; color: #FFFFFF; text-decoration: none; border-radius: 10px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Notice Box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8F5EE; border-left: 3px solid #D87854; border-radius: 0 8px 8px 0; padding: 12px 16px; margin: 24px 0;">
                <tr>
                  <td>
                    <p style="margin: 0; font-size: 13px; color: #242923;">
                      <strong>Security Note:</strong> This reset link will expire in <strong>${expiresHours} hour</strong> and can only be used once. If you did not request this, your password is safe and no further action is needed.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="font-size: 13px; color: #666666; margin: 24px 0 0 0; word-break: break-all;">
                If the button above does not work, copy and paste this link into your browser:<br>
                <a href="${resetUrl}" style="color: #193C32; text-decoration: underline;">${resetUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F8F5EE; padding: 20px 36px; border-top: 1px solid #E8E4D9; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #777777;">
                LingoPDF • Effortless PDF inline translations
              </p>
              <p style="margin: 0; font-size: 12px; color: #777777;">
                Questions? Contact us at <a href="mailto:support@lingopdf.in" style="color: #193C32; text-decoration: underline;">support@lingopdf.in</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}


export function renderReferralQuotaReachedEmail(params: {
  name?: string;
  referralCode: string;
  dashboardUrl: string;
}): EmailTemplateResult {
  const { name, referralCode, dashboardUrl } = params;
  const greeting = name ? `Hello ${name},` : "Hello,";
  const subject = "Your LingoPDF referral code has reached its limit";

  const text = `${greeting}

Congratulations! Your LingoPDF referral code (${referralCode}) has reached its limit of 50 successful redemptions.

Because this code has reached its capacity, it can no longer be used for new discounts or purchases. All of your existing commissions and earned payouts remain completely secure and intact.

You are now eligible to generate a brand new referral code with a fresh 50-redemption allowance.

Visit your referral dashboard to generate your new referral code:
${dashboardUrl}

Thank you for being a valued part of the LingoPDF community!

Best regards,
The LingoPDF Team
support@lingopdf.in
`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8F5EE; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #242923; line-height: 1.6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8F5EE; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #FFFFFF; border: 1px solid #E8E4D9; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(25, 60, 50, 0.04);">
          <!-- Brand Header -->
          <tr>
            <td style="background-color: #193C32; padding: 28px 36px; text-align: left;">
              <span style="font-size: 22px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.5px;">Lingo<span style="color: #D87854;">PDF</span></span>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 36px 36px 24px 36px;">
              <h1 style="font-size: 20px; font-weight: 700; color: #193C32; margin: 0 0 16px 0; line-height: 1.3;">Referral code limit reached</h1>
              <p style="font-size: 15px; color: #242923; margin: 0 0 20px 0;">${greeting}</p>
              <p style="font-size: 15px; color: #242923; margin: 0 0 20px 0;">
                Congratulations! Your LingoPDF referral code <strong style="color: #193C32; font-family: monospace; font-size: 16px;">${referralCode}</strong> has reached its maximum limit of <strong>50 successful paid redemptions</strong>.
              </p>
              <p style="font-size: 14px; color: #555555; margin: 0 0 24px 0;">
                Because this code has reached its capacity, it is now exhausted and cannot be used for additional redemptions. All your previously earned commissions, attribution history, and pending payouts remain fully preserved and unchanged.
              </p>

              <!-- Notice Box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8F5EE; border-left: 3px solid #D87854; border-radius: 0 8px 8px 0; padding: 14px 16px; margin: 20px 0;">
                <tr>
                  <td>
                    <p style="margin: 0; font-size: 13px; color: #242923; line-height: 1.5;">
                      <strong>Ready for your next code?</strong> You are now eligible to create a new referral code on your dashboard. Each newly generated code receives its own 50-redemption allowance!
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Action Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
                <tr>
                  <td align="center" style="border-radius: 10px; background-color: #193C32;">
                    <a href="${dashboardUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 14px 28px; font-size: 15px; font-weight: 600; color: #FFFFFF; text-decoration: none; border-radius: 10px;">
                      Create New Referral Code
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-size: 13px; color: #666666; margin: 24px 0 0 0; word-break: break-all;">
                If the button above does not work, visit your referral dashboard directly:<br>
                <a href="${dashboardUrl}" style="color: #193C32; text-decoration: underline;">${dashboardUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F8F5EE; padding: 20px 36px; border-top: 1px solid #E8E4D9; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #777777;">
                LingoPDF • German-to-English Vocabulary Reader
              </p>
              <p style="margin: 0; font-size: 12px; color: #777777;">
                Questions? Contact us at <a href="mailto:support@lingopdf.in" style="color: #193C32; text-decoration: underline;">support@lingopdf.in</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderSupportContactEmail(params: {
  name: string;
  email: string;
  subject: string;
  message: string;
  browser?: string;
  timestamp?: Date;
}): EmailTemplateResult {
  const { name, email, subject, message, browser, timestamp = new Date() } = params;
  const emailSubject = `[LingoPDF Support] ${subject}`;
  const formattedDate = timestamp.toUTCString();
  const browserDisplay = browser?.trim() || "Not specified";

  const text = `New Support Request from LingoPDF Website

From: ${name} <${email}>
Subject: ${subject}
Browser: ${browserDisplay}
Timestamp: ${formattedDate}

--------------------------------------------------
Message:
--------------------------------------------------
${message}
--------------------------------------------------

To reply directly to the customer, reply to this email (Reply-To: ${email}).
`;

  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeSubject = escapeHtml(subject);
  const safeBrowser = escapeHtml(browserDisplay);
  const safeMessage = escapeHtml(message).replace(/\r?\n/g, "<br>");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(emailSubject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8F5EE; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #242923; line-height: 1.6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8F5EE; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #FFFFFF; border: 1px solid #E8E4D9; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(25, 60, 50, 0.04);">
          <!-- Header -->
          <tr>
            <td style="background-color: #193C32; padding: 24px 32px; text-align: left;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size: 20px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.5px;">Lingo<span style="color: #D87854;">PDF</span></span>
                    <span style="font-size: 13px; color: #E8E4D9; margin-left: 12px; font-weight: 500;">Support Desk</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Meta Box -->
          <tr>
            <td style="padding: 32px 32px 20px 32px;">
              <h1 style="font-size: 20px; font-weight: 700; color: #193C32; margin: 0 0 20px 0; line-height: 1.3;">
                New Contact Form Submission
              </h1>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8F5EE; border: 1px solid #E8E4D9; border-radius: 10px; padding: 16px 20px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 4px 0; font-size: 14px; color: #666666; width: 100px;"><strong>From:</strong></td>
                  <td style="padding: 4px 0; font-size: 14px; color: #242923;">${safeName} &lt;<a href="mailto:${safeEmail}" style="color: #193C32; text-decoration: underline;">${safeEmail}</a>&gt;</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 14px; color: #666666;"><strong>Subject:</strong></td>
                  <td style="padding: 4px 0; font-size: 14px; color: #242923; font-weight: 600;">${safeSubject}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 14px; color: #666666;"><strong>Browser:</strong></td>
                  <td style="padding: 4px 0; font-size: 14px; color: #242923;">${safeBrowser}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 14px; color: #666666;"><strong>Received:</strong></td>
                  <td style="padding: 4px 0; font-size: 14px; color: #242923;">${escapeHtml(formattedDate)}</td>
                </tr>
              </table>

              <!-- Message Body -->
              <h2 style="font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #193C32; margin: 0 0 10px 0;">
                Message Content
              </h2>
              <div style="background-color: #FFFFFF; border-left: 3px solid #D87854; border-top: 1px solid #E8E4D9; border-right: 1px solid #E8E4D9; border-bottom: 1px solid #E8E4D9; border-radius: 0 8px 8px 0; padding: 18px 20px; font-size: 15px; color: #242923; line-height: 1.6; word-break: break-word;">
                ${safeMessage}
              </div>

              <p style="font-size: 13px; color: #666666; margin: 24px 0 0 0;">
                Reply directly to this email to respond to <strong>${safeEmail}</strong>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F8F5EE; padding: 18px 32px; border-top: 1px solid #E8E4D9; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #777777;">
                LingoPDF Support Dispatch • <a href="https://www.lingopdf.in" style="color: #193C32; text-decoration: underline;">www.lingopdf.in</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject: emailSubject, html, text };
}

export function renderPurchaseConfirmationEmail(params: {
  name?: string;
  orderId: string;
  transactionId?: string;
  amountFormatted: string;
  productName?: string;
  devicesUrl: string;
}): EmailTemplateResult {
  const {
    name,
    orderId,
    transactionId,
    amountFormatted,
    productName = "LingoPDF German → English Edition",
    devicesUrl,
  } = params;

  const greeting = name ? `Hello ${escapeHtml(name)},` : "Hello,";
  const subject = "Your LingoPDF Purchase Confirmation & Activation";

  const text = `${name ? `Hello ${name},` : "Hello,"}

Thank you for your purchase of ${productName}!

Your order has been confirmed and your lifetime licence is now active.

Order Details:
- Product: ${productName}
- Total Paid: ${amountFormatted}
- Order Reference: ${orderId}
${transactionId ? `- Payment Reference: ${transactionId}\n` : ""}- Licence: 1 Active Device (One-time lifetime purchase)

Next Steps — Activate your Chrome Extension:
1. Open the LingoPDF extension in Google Chrome.
2. Go to your devices dashboard: ${devicesUrl}
3. Click "Generate Activation Code" (valid for 10 minutes).
4. Paste the activation code into your extension to bind your device.

Need help? Contact support@lingopdf.in anytime.

Best regards,
The LingoPDF Team
https://www.lingopdf.in
`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8F5EE; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #242923; line-height: 1.6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8F5EE; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #FFFFFF; border: 1px solid #E8E4D9; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="background-color: #193C32; padding: 32px; text-align: center;">
              <h1 style="color: #FFFFFF; font-size: 24px; font-weight: 700; margin: 0; letter-spacing: -0.5px;">
                LingoPDF
              </h1>
              <p style="color: #E8E4D9; font-size: 14px; margin: 6px 0 0 0;">
                Purchase Confirmation & Licence Activation
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="font-size: 16px; margin: 0 0 16px 0;">
                ${greeting}
              </p>
              <p style="font-size: 15px; margin: 0 0 24px 0; color: #4A5568;">
                Thank you for purchasing <strong>${escapeHtml(productName)}</strong>! Your payment has been confirmed and your lifetime licence is now active on your account.
              </p>

              <!-- Order Summary Card -->
              <div style="background-color: #F8F5EE; border: 1px solid #E8E4D9; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <h3 style="font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #193C32; margin: 0 0 12px 0;">
                  Order Summary
                </h3>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding: 4px 0; font-size: 14px; color: #666666;">Product:</td>
                    <td style="padding: 4px 0; font-size: 14px; font-weight: 600; text-align: right;">${escapeHtml(productName)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0; font-size: 14px; color: #666666;">Total Paid:</td>
                    <td style="padding: 4px 0; font-size: 14px; font-weight: 700; color: #193C32; text-align: right;">${escapeHtml(amountFormatted)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0; font-size: 14px; color: #666666;">Order ID:</td>
                    <td style="padding: 4px 0; font-size: 13px; font-family: monospace; text-align: right;">${escapeHtml(orderId)}</td>
                  </tr>
                  ${transactionId ? `<tr>
                    <td style="padding: 4px 0; font-size: 14px; color: #666666;">Payment ID:</td>
                    <td style="padding: 4px 0; font-size: 13px; font-family: monospace; text-align: right;">${escapeHtml(transactionId)}</td>
                  </tr>` : ""}
                  <tr>
                    <td style="padding: 4px 0; font-size: 14px; color: #666666;">Licence Type:</td>
                    <td style="padding: 4px 0; font-size: 14px; text-align: right;">Lifetime (1 Active Device)</td>
                  </tr>
                </table>
              </div>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <a href="${escapeHtml(devicesUrl)}" style="display: inline-block; background-color: #D87854; color: #FFFFFF; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px; box-shadow: 0 2px 4px rgba(216, 120, 84, 0.3);">
                      Activate Your Device
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-size: 13px; color: #777777; margin: 24px 0 0 0; text-align: center;">
                Need help activating? Reply to this email or contact <a href="mailto:support@lingopdf.in" style="color: #193C32;">support@lingopdf.in</a>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F8F5EE; padding: 20px 32px; border-top: 1px solid #E8E4D9; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #777777;">
                LingoPDF • German → English Vocabulary-Building PDF Reader<br>
                <a href="https://www.lingopdf.in" style="color: #193C32; text-decoration: underline;">www.lingopdf.in</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

