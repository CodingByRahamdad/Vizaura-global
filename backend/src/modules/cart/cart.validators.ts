import { z } from "zod";

// Transport-layer validation only. Business rules (market activeness,
// variant/product availability, price/stock checks) live in
// cart.service.ts. See docs/modules/CART.md.

const marketCode = z.string().trim().toUpperCase().min(2).max(8);
// Mirrors the quantity ceiling Inventory already established
// (docs/DATABASE.md's money-representation ceiling reused for any bounded
// integer count) — no cart-specific "excessive quantity" limit is
// documented anywhere, so none is invented here.
const quantity = z.coerce.number().int().min(1).max(2_100_000_000);

export const cartQuerySchema = z.object({
  market: marketCode,
});

export const cartItemParamsSchema = z.object({
  itemId: z.uuid(),
});

export const addCartItemSchema = z.object({
  variantId: z.uuid(),
  quantity,
});

export const updateCartItemSchema = z.object({
  quantity,
});

export type CartQuery = z.infer<typeof cartQuerySchema>;
export type CartItemParams = z.infer<typeof cartItemParamsSchema>;
export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
