import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../../config/env.js";
import { paymentsErrors } from "../../../errors/AppError.js";
import type { OrderPaymentStatus } from "../../../generated/prisma/client.js";
import type { PaymentProvider, RefundPaymentParams, WebhookEvent } from "./provider.interface.js";

interface MockWebhookPayload {
  eventId: string;
  providerPaymentId: string;
  type: "AUTHORIZATION" | "CAPTURE" | "REFUND" | "VOID";
  status: OrderPaymentStatus;
  amount: number;
  currencyCode: string;
}

/// Test/dev-only provider (never resolvable in production — see
/// providers/index.ts). Exists solely so the PRD's webhook-security
/// requirements (signature verification, idempotency, duplicate/out-of-order
/// delivery) can be genuinely built and tested against a real signed HTTP
/// callback, rather than stubbed. Not a real gateway: createPayment never
/// calls out anywhere; confirmation only ever arrives via
/// POST /api/v1/webhooks/payments/mock, exactly as a real provider would.
export const mockProvider: PaymentProvider = {
  key: "MOCK",

  async createPayment() {
    return { status: "PENDING" };
  },

  async refundPayment(params: RefundPaymentParams) {
    return { status: "REFUNDED" as const, providerReference: `mock-refund-${params.paymentId}` };
  },

  handleWebhook(rawBody: Buffer, signatureHeader: string | undefined): WebhookEvent {
    if (!signatureHeader) throw paymentsErrors.webhookSignatureInvalid();

    const expected = createHmac("sha256", env.payments.mockWebhookSecret).update(rawBody).digest("hex");
    const expectedBuffer = Buffer.from(expected, "hex");
    const providedBuffer = Buffer.from(signatureHeader, "hex");
    if (
      expectedBuffer.length !== providedBuffer.length ||
      !timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      throw paymentsErrors.webhookSignatureInvalid();
    }

    let payload: MockWebhookPayload;
    try {
      payload = JSON.parse(rawBody.toString("utf8")) as MockWebhookPayload;
    } catch {
      throw paymentsErrors.validation({ reason: "malformed webhook body" });
    }

    return {
      eventId: payload.eventId,
      providerPaymentId: payload.providerPaymentId,
      type: payload.type,
      status: payload.status,
      amount: payload.amount,
      currencyCode: payload.currencyCode,
      raw: payload,
    };
  },
};
