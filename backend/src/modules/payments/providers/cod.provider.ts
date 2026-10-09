import { paymentsErrors } from "../../../errors/AppError.js";
import type { PaymentProvider, WebhookEvent } from "./provider.interface.js";

/// COD has no external gateway — payment is collected on delivery, not
/// verified through any provider call. Its only terminal-state changes are
/// the staff mark-paid/mark-failed actions (payments.service.ts), never a
/// provider round trip.
export const codProvider: PaymentProvider = {
  key: "COD",

  async createPayment() {
    return { status: "PENDING" };
  },

  async refundPayment() {
    throw paymentsErrors.providerOperationUnsupported("COD", "refundPayment");
  },

  handleWebhook(): WebhookEvent {
    throw paymentsErrors.providerOperationUnsupported("COD", "handleWebhook");
  },
};
