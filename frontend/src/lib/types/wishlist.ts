/**
 * Types mirror the backend's actual response shapes verbatim
 * (backend/src/modules/wishlist/wishlist.mapper.ts). No price/currency
 * field — Wishlist is product-level and market-independent by design (see
 * docs/CURRENT_TASK.md's PRD-grounded decision), unlike Cart.
 */

export interface WishlistItemView {
  productId: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  isAvailable: boolean;
  defaultVariantId: string | null;
  hasMultipleVariants: boolean;
  createdAt: string;
}

export interface WishlistView {
  id: string;
  items: WishlistItemView[];
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Friendly fallback text for the wishlist error codes actually returned by
 * the backend (backend/src/modules/wishlist/*, cross-checked against
 * source, not docs). Any code not listed here falls back to the backend's
 * own error message.
 */
export const WISHLIST_ERROR_MESSAGES: Partial<Record<string, string>> = {
  WISHLIST_PRODUCT_UNAVAILABLE: "This product can't be saved to your wishlist right now.",
  WISHLIST_ITEM_NOT_FOUND: "That item is no longer in your wishlist.",
  CATALOG_NOT_FOUND: "This product could not be found.",
};
