/**
 * Types mirror the backend's actual response shapes verbatim
 * (backend/src/modules/cart/cart.mapper.ts). Do not add fields the backend
 * doesn't return — prices are never snapshotted, so unitAmount/lineTotal are
 * always the backend's own live-computed values, not something derived here.
 */

export interface CartItemView {
  id: string;
  variantId: string;
  sku: string;
  title: string;
  productId: string;
  productSlug: string;
  productName: string;
  variantTitle: string;
  imageUrl: string | null;
  quantity: number;
  unitAmount: number | null;
  originalAmount: number | null;
  discountPercent: number | null;
  lineTotal: number | null;
  isAvailable: boolean;
  isInStock: boolean;
}

export type CartStatus = "ACTIVE" | "CONVERTED" | "ABANDONED";

export interface CartView {
  id: string;
  marketCode: string;
  currencyCode: string;
  status: CartStatus;
  items: CartItemView[];
  itemCount: number;
  subtotalAmount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Friendly fallback text for the cart error codes actually returned by the
 * backend (backend/src/modules/cart/*, cross-checked against source, not
 * docs — see docs/CURRENT_TASK.md for the AUTH_VALIDATION_ERROR discrepancy).
 * Any code not listed here falls back to the backend's own error message.
 */
export const CART_ERROR_MESSAGES: Partial<Record<string, string>> = {
  CART_VARIANT_UNAVAILABLE: "This item is no longer available.",
  CART_PRICE_UNAVAILABLE: "Pricing for this item is currently unavailable.",
  CART_INSUFFICIENT_STOCK: "There isn't enough stock available for that quantity.",
  CART_ITEM_NOT_FOUND: "That item is no longer in your cart.",
  CATALOG_NOT_FOUND: "This item could not be found.",
};
