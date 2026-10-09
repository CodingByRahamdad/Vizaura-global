import { env } from "../../../config/env.js";
import { paymentsErrors } from "../../../errors/AppError.js";
import { codProvider } from "./cod.provider.js";
import { mockProvider } from "./mock.provider.js";
import type { PaymentProvider } from "./provider.interface.js";

const providers: Record<string, PaymentProvider> = {
  COD: codProvider,
  MOCK: mockProvider,
};

/// The actual production gate for MOCK — not just Checkout's request
/// validator. No code path (staff action, webhook, retry) can construct or
/// process a live MOCK payment once env.isProduction is true, because this
/// is the single place every caller resolves a provider through.
export function resolveProvider(key: string): PaymentProvider {
  if (key === "MOCK" && env.isProduction) {
    throw paymentsErrors.unsupportedProvider(key);
  }
  const provider = providers[key];
  if (!provider) throw paymentsErrors.unsupportedProvider(key);
  return provider;
}

export type { PaymentProvider, CreatePaymentParams, CreatePaymentResult, RefundPaymentParams, RefundPaymentResult, WebhookEvent } from "./provider.interface.js";
