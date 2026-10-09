const STORE_NAME = "VIZAURA GLOBAL";
const COLOR_PRIMARY = "#0F766E";
const COLOR_PRIMARY_DARK = "#115E59";
const COLOR_BACKGROUND = "#FAFAF7";
const COLOR_SURFACE = "#FFFFFF";
const COLOR_TEXT = "#17201D";
const COLOR_TEXT_MUTED = "#66736E";
const COLOR_BORDER = "#E2E8E5";

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/// Shared transactional-email layout: a plain, inlined-CSS HTML shell (safe
/// across email clients) in the storefront's teal/natural palette, with a
/// title, body content, and an optional prominent call-to-action button.
function layout(params: { title: string; bodyHtml: string; cta?: { label: string; url: string } }): string {
  const ctaHtml = params.cta
    ? `
      <tr>
        <td align="center" style="padding: 24px 0 8px;">
          <a href="${escapeHtml(params.cta.url)}"
             style="display:inline-block;background:${COLOR_PRIMARY};color:#ffffff;text-decoration:none;
                    font-weight:600;font-size:15px;padding:14px 32px;border-radius:8px;">
            ${escapeHtml(params.cta.label)}
          </a>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding: 0 24px 8px;">
          <p style="margin:0;font-size:12px;color:${COLOR_TEXT_MUTED};word-break:break-all;">
            Or copy and paste this link into your browser:<br />
            <a href="${escapeHtml(params.cta.url)}" style="color:${COLOR_PRIMARY_DARK};">${escapeHtml(params.cta.url)}</a>
          </p>
        </td>
      </tr>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(params.title)}</title>
  </head>
  <body style="margin:0;padding:0;background:${COLOR_BACKGROUND};font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLOR_BACKGROUND};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:${COLOR_SURFACE};border:1px solid ${COLOR_BORDER};border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 4px;">
                <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:0.08em;color:${COLOR_PRIMARY};text-transform:uppercase;">
                  ${escapeHtml(STORE_NAME)}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 32px 0;">
                <h1 style="margin:0 0 12px;font-size:20px;color:${COLOR_TEXT};">${escapeHtml(params.title)}</h1>
                <div style="font-size:15px;line-height:1.6;color:${COLOR_TEXT};">${params.bodyHtml}</div>
              </td>
            </tr>
            ${ctaHtml}
            <tr>
              <td style="padding:24px 32px 28px;">
                <hr style="border:none;border-top:1px solid ${COLOR_BORDER};margin:0 0 16px;" />
                <p style="margin:0;font-size:12px;color:${COLOR_TEXT_MUTED};">
                  This is an automated message from ${escapeHtml(STORE_NAME)}. If you weren't expecting it, you can
                  safely ignore it.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function verifyEmailTemplate(params: { firstName: string; verifyUrl: string }): EmailContent {
  const name = escapeHtml(params.firstName);
  return {
    subject: `Verify your email for ${STORE_NAME}`,
    html: layout({
      title: `Welcome, ${name}!`,
      bodyHtml: `
        <p>Thanks for creating a ${escapeHtml(STORE_NAME)} account. Please verify your email address to unlock
        checkout and reviews.</p>
        <p>This link expires in <strong>24 hours</strong>.</p>
        <p>If you didn't create this account, you can safely ignore this email — no action is needed.</p>
      `,
      cta: { label: "Verify Email", url: params.verifyUrl },
    }),
    text:
      `Welcome to ${STORE_NAME}!\n\n` +
      `Please verify your email address by visiting the link below. This link expires in 24 hours.\n\n` +
      `${params.verifyUrl}\n\n` +
      `If you didn't create this account, you can safely ignore this email.`,
  };
}

export function passwordResetTemplate(params: { firstName: string; resetUrl: string }): EmailContent {
  const name = escapeHtml(params.firstName);
  return {
    subject: `Reset your ${STORE_NAME} password`,
    html: layout({
      title: `Password reset requested`,
      bodyHtml: `
        <p>Hi ${name}, we received a request to reset your ${escapeHtml(STORE_NAME)} account password.</p>
        <p>This link expires in <strong>30 minutes</strong> and can only be used once.</p>
        <p>If you didn't request this, you can safely ignore this email — your password won't be changed.</p>
      `,
      cta: { label: "Reset Password", url: params.resetUrl },
    }),
    text:
      `Hi ${params.firstName},\n\n` +
      `We received a request to reset your ${STORE_NAME} account password. Visit the link below to choose a ` +
      `new one. This link expires in 30 minutes and can only be used once.\n\n` +
      `${params.resetUrl}\n\n` +
      `If you didn't request this, you can safely ignore this email.`,
  };
}

export function existingAccountTemplate(params: { firstName: string }): EmailContent {
  const name = escapeHtml(params.firstName);
  return {
    subject: `Someone tried to sign up with your email at ${STORE_NAME}`,
    html: layout({
      title: `Sign-up attempt noticed`,
      bodyHtml: `
        <p>Hi ${name}, someone just tried to create a new ${escapeHtml(STORE_NAME)} account using your email
        address, but you already have one.</p>
        <p>If this was you, simply log in with your existing account instead. If it wasn't, no action is
        needed — your account is safe.</p>
      `,
    }),
    text:
      `Hi ${params.firstName},\n\n` +
      `Someone just tried to create a new ${STORE_NAME} account using your email address, but you already have ` +
      `one. If this was you, just log in with your existing account instead. If it wasn't, no action is needed.`,
  };
}

export function orderConfirmationTemplate(params: {
  firstName: string;
  orderNumber: string;
  totalAmount: number;
  currencyCode: string;
}): EmailContent {
  const name = escapeHtml(params.firstName);
  const total = `${params.currencyCode} ${(params.totalAmount / 100).toFixed(2)}`;
  return {
    subject: `Your ${STORE_NAME} order ${params.orderNumber} is confirmed`,
    html: layout({
      title: `Thanks for your order, ${name}!`,
      bodyHtml: `
        <p>We've received your order <strong>${escapeHtml(params.orderNumber)}</strong>.</p>
        <p>Order total: <strong>${escapeHtml(total)}</strong></p>
        <p>We'll send another update as soon as your order ships.</p>
      `,
    }),
    text:
      `Thanks for your order, ${params.firstName}!\n\n` +
      `We've received your order ${params.orderNumber}. Order total: ${total}.\n\n` +
      `We'll send another update as soon as your order ships.`,
  };
}
