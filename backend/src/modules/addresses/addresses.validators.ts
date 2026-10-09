import type { z } from "zod";
import { shippingAddressSchema } from "../checkout/checkout.validators.js";

// Transport-layer validation only. Field shape is intentionally identical to
// checkout's own shippingAddressSchema — this is what lets checkout prefill
// be a straight passthrough from GET /addresses into the checkout form.

export const upsertAddressBodySchema = shippingAddressSchema;

export type UpsertAddressInput = z.infer<typeof upsertAddressBodySchema>;
