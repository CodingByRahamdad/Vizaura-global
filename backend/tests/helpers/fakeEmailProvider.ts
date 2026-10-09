import type { EmailProvider } from "../../src/integrations/email/email.types.js";

export interface CapturedEmail {
  type: "verify" | "reset" | "notice" | "orderConfirmation";
  to: string;
  url?: string;
  orderNumber?: string;
}

export const capturedEmails: CapturedEmail[] = [];

export function resetCapturedEmails(): void {
  capturedEmails.length = 0;
}

export function extractToken(url: string): string {
  return new URL(url).searchParams.get("token") ?? "";
}

/// Test double for EmailProvider: captures outbound "emails" in memory
/// instead of logging/sending, so integration tests can extract the raw
/// verification/reset token embedded in the link — something the real API
/// never returns.
export class CapturingEmailProvider implements EmailProvider {
  async sendEmailVerification(params: { to: string; verifyUrl: string }): Promise<void> {
    capturedEmails.push({ type: "verify", to: params.to, url: params.verifyUrl });
  }

  async sendPasswordReset(params: { to: string; resetUrl: string }): Promise<void> {
    capturedEmails.push({ type: "reset", to: params.to, url: params.resetUrl });
  }

  async sendExistingAccountNotice(params: { to: string }): Promise<void> {
    capturedEmails.push({ type: "notice", to: params.to });
  }

  async sendContactMessage(params: { to: string }): Promise<void> {
    capturedEmails.push({ type: "notice", to: params.to });
  }

  async sendOrderConfirmationEmail(params: { to: string; orderNumber: string }): Promise<void> {
    capturedEmails.push({ type: "orderConfirmation", to: params.to, orderNumber: params.orderNumber });
  }
}
