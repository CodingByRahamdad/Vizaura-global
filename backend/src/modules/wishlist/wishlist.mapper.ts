export interface WishlistItemView {
  productId: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  /// False if the product is no longer ACTIVE or has been soft-deleted since
  /// it was saved — re-derived on every read, never cached on the row. The
  /// item is kept either way (see docs/modules/WISHLIST.md's "keep it, flag
  /// it" rule, mirrored from Cart's own isAvailable precedent).
  isAvailable: boolean;
  /// Null if the product currently has no variants at all (shouldn't happen
  /// for a real catalog product, but defensive since Wishlist doesn't
  /// enforce variant existence the way Cart's assertPurchasable does).
  defaultVariantId: string | null;
  /// Lets the frontend decide whether "Move to Cart" can add directly
  /// (single variant) or must send the customer to the product page to
  /// choose one (multiple variants) — Wishlist itself never guesses.
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
