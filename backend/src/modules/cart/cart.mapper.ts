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
  /// Current effective price (sale already applied), or null if no active
  /// price is configured for this market — the item stays in the cart
  /// (never silently dropped) but is excluded from `subtotalAmount` and
  /// flagged `isAvailable: false` so the client can prompt the customer to
  /// remove it before checkout.
  unitAmount: number | null;
  /// Pre-discount unit amount, present only while a sale is actually active
  /// on this line (mirrors catalog's ProductCardResponse compareAt rule) —
  /// null when there's no sale, not when price data is simply missing.
  originalAmount: number | null;
  /// Rounded percentage savings, present under the same condition as
  /// originalAmount. Uses the same rounding formula as the storefront
  /// product-card's discount badge (frontend/src/lib/api/catalog.ts).
  discountPercent: number | null;
  lineTotal: number | null;
  /// False if the product/variant is no longer ACTIVE, or the product is no
  /// longer marked available in this cart's market, since the item was
  /// added — re-derived on every read, never cached on the row.
  isAvailable: boolean;
  /// False if current available stock (onHand - reserved) is below this
  /// line's quantity. Informational only — Cart never reserves or
  /// decrements stock; final validation is a future Checkout responsibility.
  isInStock: boolean;
}

export interface CartView {
  id: string;
  marketCode: string;
  currencyCode: string;
  status: string;
  items: CartItemView[];
  itemCount: number;
  subtotalAmount: number;
  createdAt: string;
  updatedAt: string;
}
