import { env } from "../../config/env.js";
import type { EmailProvider } from "./email.types.js";
import {
  existingAccountTemplate,
  orderConfirmationTemplate,
  passwordResetTemplate,
  verifyEmailTemplate,
} from "./templates.js";

const SEND_TIMEOUT_MS = 10_000;

interface BrevoSender {
  name: string;
  email: string;
}

interface BrevoErrorBody {
  code?: string;
  message?: string;
}

/// Real transactional email provider backed by the Brevo HTTP API
/// (https://api.brevo.com/v3/smtp/email). Never logs the API key, a raw
/// verification/reset token, or a full verify/reset URL — only recipient,
/// email type, and (on failure) Brevo's own generic status/error code.
export class BrevoEmailProvider implements EmailProvider {
  private readonly sender: BrevoSender;

  constructor() {
    // env.ts's superRefine guarantees both are set whenever provider=brevo.
    this.sender = { name: env.email.brevo.senderName!, email: env.email.brevo.senderEmail! };
  }

  private async send(params: {
    to: string;
    subject: string;
    text: string;
    html?: string;
    replyTo?: { email: string; name: string };
  }): Promise<void> {
    const apiKey = env.email.brevo.apiKey;
    if (!apiKey) {
      // env.ts's superRefine guarantees this is set whenever provider=brevo,
      // so this only trips if that invariant is ever broken.
      throw new Error("BREVO_API_KEY is not configured");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

    try {
      const response = await fetch(env.email.brevo.apiUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "api-key": apiKey,
        },
        body: JSON.stringify({
          sender: this.sender,
          to: [{ email: params.to }],
          ...(params.replyTo ? { replyTo: params.replyTo } : {}),
          subject: params.subject,
          ...(params.html ? { htmlContent: params.html } : {}),
          textContent: params.text,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as BrevoErrorBody;
        console.error(`[email:brevo] send failed (status ${response.status}): ${body.code ?? "unknown_error"}`);
        throw new Error(`Brevo send failed with status ${response.status}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  async sendEmailVerification(params: { to: string; firstName: string; verifyUrl: string }): Promise<void> {
    const { subject, html, text } = verifyEmailTemplate(params);
    await this.send({ to: params.to, subject, html, text });
  }

  async sendPasswordReset(params: { to: string; firstName: string; resetUrl: string }): Promise<void> {
    const { subject, html, text } = passwordResetTemplate(params);
    await this.send({ to: params.to, subject, html, text });
  }

  async sendExistingAccountNotice(params: { to: string; firstName: string }): Promise<void> {
    const { subject, html, text } = existingAccountTemplate(params);
    await this.send({ to: params.to, subject, html, text });
  }

  async sendContactMessage(params: {
    to: string;
    replyTo: string;
    fullName: string;
    phone?: string;
    subject: string;
    message: string;
  }): Promise<void> {
    await this.send({
      to: params.to,
      replyTo: { email: params.replyTo, name: params.fullName },
      subject: `New Contact Form Submission — ${params.subject}`,
      text:
        `From: ${params.fullName}${params.phone ? ` (${params.phone})` : ""}\n` +
        `Reply-To: ${params.replyTo}\n\n` +
        params.message,
    });
  }

  async sendOrderConfirmationEmail(params: {
    to: string;
    firstName: string;
    orderNumber: string;
    totalAmount: number;
    currencyCode: string;
  }): Promise<void> {
    const { subject, html, text } = orderConfirmationTemplate(params);
    await this.send({ to: params.to, subject, html, text });
  }
}
