import { shippingErrors } from "../../../errors/AppError.js";
import { manualProvider } from "./manual.provider.js";
import type { ShippingProvider } from "./provider.interface.js";

const providers: Record<string, ShippingProvider> = {
  MANUAL: manualProvider,
};

/// The single choke point every caller resolves a provider through — same
/// shape as payments/providers/index.ts's resolveProvider, kept as the
/// established extension point even though only one provider exists today.
export function resolveProvider(key: string): ShippingProvider {
  const provider = providers[key];
  if (!provider) throw shippingErrors.validation({ reason: `unknown shipping provider: ${key}` });
  return provider;
}

export type { ShippingProvider } from "./provider.interface.js";
