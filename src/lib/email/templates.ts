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
