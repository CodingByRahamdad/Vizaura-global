import type { EmailProvider } from "./email.types.js";

/// Development provider: logs a human-readable summary instead of sending
/// real email. It is safe to log the verify/reset URL here — the token
/// inside it is a development-only, single-use value tied to a local
/// database that will never reach anyone but the developer running this
/// process. A real provider must never log tokens or links this way.
export class ConsoleEmailProvider implements EmailProvider {
  async sendEmailVerification(params: { to: string; firstName: string; verifyUrl: string }): Promise<void> {
    console.log(
      `[email:dev] Verification email for ${params.to} (${params.firstName}): ${params.verifyUrl}`,
    );
  }

  async sendPasswordReset(params: { to: string; firstName: string; resetUrl: string }): Promise<void> {
    console.log(`[email:dev] Password reset email for ${params.to} (${params.firstName}): ${params.resetUrl}`);
  }

  async sendExistingAccountNotice(params: { to: string; firstName: string }): Promise<void> {
    console.log(
      `[email:dev] Existing-account notice for ${params.to} (${params.firstName}): a registration attempt was made with this address.`,
    );
  }

  async sendContactMessage(params: {
    to: string;
    replyTo: string;
    fullName: string;
    phone?: string;
    subject: string;
    message: string;
  }): Promise<void> {
    console.log(
      `[email:dev] Contact form submission to ${params.to} (reply-to ${params.replyTo}) — ` +
        `subject: New Contact Form Submission — ${params.subject}\n` +
        `  From: ${params.fullName}${params.phone ? ` (${params.phone})` : ""}\n` +
        `  Message: ${params.message}`,
    );
  }

  async sendOrderConfirmationEmail(params: {
    to: string;
    firstName: string;
    orderNumber: string;
    totalAmount: number;
    currencyCode: string;
  }): Promise<void> {
    console.log(
      `[email:dev] Order confirmation for ${params.to} (${params.firstName}): order ${params.orderNumber}, ` +
        `total ${params.currencyCode} ${(params.totalAmount / 100).toFixed(2)}`,
    );
  }
}
