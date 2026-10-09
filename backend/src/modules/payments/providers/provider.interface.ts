import type { OrderPaymentStatus } from "../../../generated/prisma/client.js";

export interface CreatePaymentParams {
  paymentId: string;
  orderId: string;
  amount: number;
  currencyCode: string;
}

export interface CreatePaymentResult {
  status: OrderPaymentStatus;
  providerPaymentId?: string;
}

export interface RefundPaymentParams {
  paymentId: string;
  providerPaymentId: string | null;
  amount: number;
}

export interface RefundPaymentResult {
  status: OrderPaymentStatus;
  providerReference?: string;
}

/// The event shape every provider's handleWebhook() normalizes its raw
/// payload into, before PaymentsService touches the database. `eventId` is
/// the provider's own delivery id — the sole idempotency key for webhook
/// processing (see payments_webhook_events' unique constraint).
export interface WebhookEvent {
  eventId: string;
  providerPaymentId: string;
  type: "AUTHORIZATION" | "CAPTURE" | "REFUND" | "VOID";
  status: OrderPaymentStatus;
  amount: number;
  currencyCode: string;
  raw: unknown;
}

/// PRD's own literal interface (§2C.12/§2O.1) minus capturePayment() and
/// verifyPayment() — neither COD nor MOCK has a genuine deferred-capture or
/// poll-based-verify gateway to justify them (see docs/modules/PAYMENTS.md).
/// handleWebhook is synchronous and does no DB access: verify + parse only,
/// so PaymentsService stays the only place that touches Prisma.
export interface PaymentProvider {
  readonly key: string;
  createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult>;
  refundPayment(params: RefundPaymentParams): Promise<RefundPaymentResult>;
  handleWebhook(rawBody: Buffer, signatureHeader: string | undefined): WebhookEvent;
}
