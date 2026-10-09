/**
 * Types mirror the backend's actual response shapes verbatim
 * (backend/src/modules/checkout/checkout.mapper.ts, checkout.validators.ts).
 * The backend never trusts client-supplied totals — subtotalAmount through
 * totalAmount on OrderView are always server-computed, never echoed from a
 * request body.
 */

export interface ShippingAddressInput {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode?: string;
  countryCode: string;
}

export interface CheckoutRequest {
  billingAddress: ShippingAddressInput;
  shipToDifferentAddress: boolean;
  shippingAddress?: ShippingAddressInput;
  paymentMethod: "COD";
  shippingMethodId: string;
}

export interface OrderItemView {
  id: string;
  variantId: string | null;
  productId: string | null;
  sku: string;
  productName: string;
  variantName: string | null;
  unitAmount: number;
  quantity: number;
  lineTotal: number;
  currencyCode: string;
}

export interface OrderAddressView {
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string | null;
  countryCode: string;
}

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED"
  | "FAILED"
  | "REFUNDED"
  | "RETURNED";

/** Mirrors the backend's `OrderPaymentStatus` enum (schema.prisma) verbatim. */
export type PaymentStatus =
  | "PENDING"
  | "AUTHORIZED"
  | "PAID"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED";

/**
 * `MOCK` is backend test/webhook-testing infrastructure only (see
 * docs/modules/PAYMENTS.md — "never a real payment method"), never a
 * customer-selectable checkout option; it exists here only so an order's
 * returned `paymentMethod` can be typed accurately, not to expose a selector.
 */
export type PaymentMethod = "COD" | "MOCK";

export interface OrderView {
  id: string;
  orderNumber: string;
  marketCode: string;
  currencyCode: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  shipmentStatus: string;
  items: OrderItemView[];
  billingAddress: OrderAddressView | null;
  shippingAddress: OrderAddressView | null;
  subtotalAmount: number;
  discountAmount: number;
  shippingAmount: number;
  taxAmount: number;
  totalAmount: number;
  placedAt: string;
  createdAt: string;
}

/**
 * Friendly fallback text for checkout error codes actually returned by the
 * backend (backend/src/modules/checkout/*, cross-checked against source).
 * Same AUTH_VALIDATION_ERROR discrepancy documented for Cart/Wishlist
 * applies here too (the shared validate() middleware always throws that
 * code for transport-level failures, not CHECKOUT_VALIDATION_ERROR).
 */
export const CHECKOUT_ERROR_MESSAGES: Partial<Record<string, string>> = {
  CHECKOUT_CART_NOT_FOUND: "Your cart is empty.",
  CHECKOUT_CART_EMPTY: "Your cart is empty.",
  CHECKOUT_CART_ALREADY_CONVERTED: "This cart has already been checked out.",
  CHECKOUT_COUPON_UNSUPPORTED: "Coupon codes aren't supported yet.",
  CHECKOUT_PAYMENT_METHOD_UNSUPPORTED: "That payment method isn't available.",
  CHECKOUT_VALIDATION_ERROR: "Please check your order details and try again.",
  SHIPPING_METHOD_UNSUPPORTED: "Please choose a valid shipping method.",
  CART_VARIANT_UNAVAILABLE: "One of your items is no longer available.",
  CART_PRICE_UNAVAILABLE: "Pricing for one of your items is currently unavailable.",
  CART_INSUFFICIENT_STOCK: "There isn't enough stock for one of your items.",
  AUTH_EMAIL_NOT_VERIFIED: "Please verify your email address before checking out.",
};
