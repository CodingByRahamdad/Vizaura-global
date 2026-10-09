import { z } from "zod";
import { paginationQuerySchema } from "../catalog/pagination.js";

// Transport-layer validation only. Business rules (market activeness,
// insufficient-stock guards, reason requirements) live in
// inventory.service.ts. See docs/modules/INVENTORY.md.

const marketCode = z.string().trim().toUpperCase().min(2).max(8);
// Mirrors the money ceiling used elsewhere (docs/DATABASE.md) — plenty for
// any realistic stock count, keeps a single well-understood bound.
const positiveQuantity = z.coerce.number().int().min(1).max(2_100_000_000);
const nonZeroDelta = z.coerce
  .number()
  .int()
  .min(-2_100_000_000)
  .max(2_100_000_000)
  .refine((value) => value !== 0, { message: "delta must not be zero." });
const reason = z.string().trim().min(1).max(255);
const reference = z.string().trim().min(1).max(255);

export const stockListParamsSchema = z.object({
  productId: z.uuid(),
  variantId: z.uuid(),
});

export const stockParamsSchema = z.object({
  productId: z.uuid(),
  variantId: z.uuid(),
  marketCode,
});

export const createStockSchema = z.object({
  marketCode,
  onHand: z.coerce.number().int().min(0).max(2_100_000_000).optional(),
});

export const receiveStockSchema = z.object({
  quantity: positiveQuantity,
  reason: reason.optional(),
});

export const adjustStockSchema = z.object({
  delta: nonZeroDelta,
  reason,
});

export const reserveStockSchema = z.object({
  quantity: positiveQuantity,
  reference,
});

export const releaseStockSchema = z.object({
  reference,
});

/// GET /admin/inventory (Phase 6E) — a cross-catalog list, unlike every
/// other Inventory query here which is scoped to one product+variant.
export const listAdminInventoryQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).max(255).optional(),
  market: marketCode.optional(),
});

export type StockListParams = z.infer<typeof stockListParamsSchema>;
export type StockParams = z.infer<typeof stockParamsSchema>;
export type CreateStockInput = z.infer<typeof createStockSchema>;
export type ReceiveStockInput = z.infer<typeof receiveStockSchema>;
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
export type ReserveStockInput = z.infer<typeof reserveStockSchema>;
export type ReleaseStockInput = z.infer<typeof releaseStockSchema>;
export type ListAdminInventoryQuery = z.infer<typeof listAdminInventoryQuerySchema>;
