import { z } from "zod";

// Transport-layer validation only. Business rules (market activeness,
// currency match, sale-amount-below-amount) live in pricing.service.ts.
// See docs/modules/PRICING.md.

const marketCode = z.string().trim().toUpperCase().min(2).max(8);
const currencyCode = z.string().trim().toUpperCase().length(3);
// Postgres int4 ceiling (~2.1B minor units) — matches docs/DATABASE.md's
// documented money-representation ceiling for this catalog's scale.
const amount = z.coerce.number().int().min(0).max(2_100_000_000);

export const priceParamsSchema = z.object({
  productId: z.uuid(),
  variantId: z.uuid(),
  marketCode,
});

export const priceListParamsSchema = z.object({
  productId: z.uuid(),
  variantId: z.uuid(),
});

export const upsertPriceSchema = z.object({
  currencyCode: currencyCode.optional(),
  amount,
  saleAmount: amount.optional(),
  saleStartsAt: z.coerce.date().optional(),
  saleEndsAt: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
});

export type PriceParams = z.infer<typeof priceParamsSchema>;
export type PriceListParams = z.infer<typeof priceListParamsSchema>;
export type UpsertPriceInput = z.infer<typeof upsertPriceSchema>;
