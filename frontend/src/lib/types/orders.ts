/**
 * Types mirror the backend's actual response shapes verbatim
 * (backend/src/modules/orders/orders.mapper.ts).
 */
import type {
  OrderAddressView,
  OrderItemView,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "@/lib/types/checkout";

export type OrderSource = "ONLINE" | "OFFLINE";

export interface OrderSummaryView {
  id: string;
  orderNumber: string;
  marketCode: string;
  currencyCode: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  placedAt: string;
  createdAt: string;
  source: OrderSource;
  /// Null for an order with no resolvable product image (deleted product,
  /// guest/offline order with a custom line item, etc.) — render a fallback.
  thumbnailUrl: string | null;
}

export interface OrderStatusHistoryEntry {
  previousStatus: OrderStatus | null;
  newStatus: OrderStatus;
  changedByUserId: string | null;
  reason: string | null;
  createdAt: string;
}

export interface OrderDetailView extends OrderSummaryView {
  paymentMethod: PaymentMethod;
  items: OrderItemView[];
  billingAddress: OrderAddressView | null;
  shippingAddress: OrderAddressView | null;
  subtotalAmount: number;
  discountAmount: number;
  shippingAmount: number;
  taxAmount: number;
  statusHistory: OrderStatusHistoryEntry[];
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  FAILED: "Failed",
  REFUNDED: "Refunded",
  RETURNED: "Returned",
};

export const ORDERS_ERROR_MESSAGES: Partial<Record<string, string>> = {
  ORDERS_NOT_FOUND: "That order could not be found.",
};

export const ORDER_SOURCE_LABELS: Record<OrderSource, string> = {
  ONLINE: "Online",
  OFFLINE: "Offline (Manual)",
};

/** Maps an order status to the existing Badge component's color variants. */
export const ORDER_STATUS_BADGE_VARIANT: Record<
  OrderStatus,
  "success" | "warning" | "error" | "neutral"
> = {
  PENDING: "warning",
  CONFIRMED: "warning",
  PROCESSING: "warning",
  SHIPPED: "neutral",
  DELIVERED: "success",
  COMPLETED: "success",
  CANCELLED: "error",
  FAILED: "error",
  REFUNDED: "error",
  RETURNED: "error",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Payment Pending",
  AUTHORIZED: "Authorized",
  PAID: "Paid",
  FAILED: "Payment Failed",
  CANCELLED: "Payment Cancelled",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Partially Refunded",
};

/**
 * Maps a payment status to the existing Badge component's color variants.
 * Deliberately not a copy of ORDER_STATUS_BADGE_VARIANT: the same word can
 * mean different things on the two axes. An order-status REFUNDED reads as a
 * bad outcome for the order, but a *payment* that was refunded is a closed,
 * working-as-intended state, not a problem — hence `neutral` here. PENDING is
 * COD's normal resting state until delivery (most orders sit here for their
 * entire lifecycle), so it must read as "expected," not alarming — `warning`,
 * not `error`.
 */
export const PAYMENT_STATUS_BADGE_VARIANT: Record<
  PaymentStatus,
  "success" | "warning" | "error" | "neutral"
> = {
  PENDING: "warning",
  AUTHORIZED: "warning",
  PAID: "success",
  FAILED: "error",
  CANCELLED: "neutral",
  REFUNDED: "neutral",
  PARTIALLY_REFUNDED: "neutral",
};

/**
 * Customer-facing explanatory copy, shown only on Order Detail (list rows
 * stay compact — badge only). PAID/AUTHORIZED are omitted deliberately: the
 * badge label alone is sufficient, no redundant "Paid — this has been paid"
 * copy needed.
 */
export const PAYMENT_STATUS_DESCRIPTIONS: Partial<Record<PaymentStatus, string>> = {
  PENDING: "Payment will be collected in cash when your order is delivered.",
  FAILED: "There was a problem processing this payment. Please contact support for help.",
  CANCELLED: "This payment was cancelled. Contact support if you have questions.",
  REFUNDED: "This payment has been fully refunded.",
  PARTIALLY_REFUNDED: "Part of this payment has been refunded.",
};
