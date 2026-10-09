import { z } from "zod";

// Transport-layer validation only. Business rules (product existence,
// ACTIVE status) live in wishlist.service.ts. See docs/modules/WISHLIST.md.
// No market query schema here — Wishlist is deliberately market-independent
// (see the PRD-grounded decision in docs/CURRENT_TASK.md), unlike Cart.

export const addWishlistItemSchema = z.object({
  productId: z.uuid(),
});

export const wishlistItemParamsSchema = z.object({
  productId: z.uuid(),
});

export type AddWishlistItemInput = z.infer<typeof addWishlistItemSchema>;
export type WishlistItemParams = z.infer<typeof wishlistItemParamsSchema>;
