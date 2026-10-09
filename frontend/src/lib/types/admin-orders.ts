/**
 * Types mirror the backend's staff-only order shapes verbatim
 * (backend/src/modules/orders/orders.mapper.ts — AdminOrderSummaryView /
 * AdminOrderDetailView). Money is Int minor units in the ORDER'S OWN stored
 * currency; never convert or re-derive it from current catalog data.
 */
import type { OrderDetailView, OrderSummaryView } from "@/lib/types/orders";
import type { OrderStatus, PaymentStatus } from "@/lib/types/checkout";

export type ShipmentStatus =
  | "PENDING"
  | "PROCESSING"
  | "SHIPPED"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "RETURNED"
  | "CANCELLED"
  | "ITEM_RETURNED"
  | "ITEM_LOST";

export type ReturnStatus = "REQUESTED" | "APPROVED" | "REJECTED" | "RECEIVED" | "REFUNDED";

export interface AdminOrderCustomer {
  id: string | null;
  name: string;
  email: string;
  /// true for a guest/no-account order — id is then always null.
  isGuest: boolean;
}

export interface AdminOrderSummary extends OrderSummaryView {
  shipmentStatus: ShipmentStatus;
  customer: AdminOrderCustomer;
  /// Null when the order somehow has no Payment/Shipment row yet. Lets the
  /// list page's inline status dropdowns act on a row without a second
  /// fetch (see OrderInlineStatusSelect/PaymentInlineStatusSelect/
  /// ShipmentInlineStatusSelect in components/admin/orders).
  paymentId: string | null;
  paymentProvider: string | null;
  shipmentId: string | null;
}

export interface AdminOrderPayment {
  id: string;
  provider: string;
  method: string;
  status: PaymentStatus;
  amount: number;
  currencyCode: string;
  providerPaymentId: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface AdminOrderShipment {
  id: string;
  status: ShipmentStatus;
  shippingMethodName: string;
  carrier: string | null;
  trackingNumber: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
}

export interface AdminOrderReturn {
  id: string;
  status: ReturnStatus;
  reason: string | null;
  rejectionReason: string | null;
  refundAmount: number | null;
  createdAt: string;
  reviewedAt: string | null;
  receivedAt: string | null;
  refundedAt: string | null;
}

export interface AdminOrderDetail extends OrderDetailView {
  shipmentStatus: ShipmentStatus;
  customer: AdminOrderCustomer;
  payments: AdminOrderPayment[];
  shipment: AdminOrderShipment | null;
  returns: AdminOrderReturn[];
}

export const SHIPMENT_STATUS_VALUES: ShipmentStatus[] = [
  "PENDING",
  "PROCESSING",
  "SHIPPED",
  "IN_TRANSIT",
  "DELIVERED",
  "RETURNED",
  "CANCELLED",
  "ITEM_RETURNED",
  "ITEM_LOST",
];

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  IN_TRANSIT: "In transit",
  DELIVERED: "Delivered",
  // Carrier return-to-sender, NOT a customer return (see ReturnStatus).
  RETURNED: "Returned to sender",
  CANCELLED: "Cancelled",
  // Post-cancellation outcomes, only reachable once the order is CANCELLED.
  ITEM_RETURNED: "Item returned",
  ITEM_LOST: "Item lost",
};

export const SHIPMENT_STATUS_BADGE_VARIANT: Record<ShipmentStatus, "success" | "warning" | "error" | "neutral"> = {
  PENDING: "warning",
  PROCESSING: "warning",
  SHIPPED: "neutral",
  IN_TRANSIT: "neutral",
  DELIVERED: "success",
  RETURNED: "error",
  CANCELLED: "error",
  ITEM_RETURNED: "error",
  ITEM_LOST: "error",
};

/// Post-cancellation outcomes: only reachable once the parent Order is
/// CANCELLED. Mirrors the backend's CANCELLATION_OUTCOME_STATUSES
/// (backend/src/modules/shipping/shipments.service.ts).
export const SHIPMENT_CANCELLATION_OUTCOME_STATUSES = new Set<ShipmentStatus>(["ITEM_RETURNED", "ITEM_LOST"]);

/// Mirrors the backend's TERMINAL_ORDER_STATUSES (shipments.service.ts) —
/// orders in any of these statuses cannot have their shipment moved forward
/// (CANCELLED is the one exception, via SHIPMENT_CANCELLATION_OUTCOME_STATUSES).
export const ORDER_TERMINAL_STATUSES = new Set<OrderStatus>(["CANCELLED", "COMPLETED", "FAILED", "REFUNDED", "RETURNED"]);

export const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  REQUESTED: "Requested",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  RECEIVED: "Received",
  REFUNDED: "Refunded",
};

export const ORDER_STATUS_VALUES: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
  "FAILED",
  "REFUNDED",
  "RETURNED",
];

export const PAYMENT_STATUS_VALUES: PaymentStatus[] = [
  "PENDING",
  "AUTHORIZED",
  "PAID",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
];

/**
 * DISPLAY-ONLY mirror of the backend's ORDER_TRANSITIONS table
 * (backend/src/modules/orders/orders.service.ts), used to decide which
 * next-status buttons to render. The backend is the sole authority: an
 * out-of-date entry here can at worst show a button the API then rejects
 * (422 ORDERS_INVALID_STATUS_TRANSITION); it can never authorise anything.
 */
export type TransitionPermissionKind = "update" | "cancel";

export const ORDER_NEXT_TRANSITIONS: Partial<
  Record<OrderStatus, { status: OrderStatus; permission: TransitionPermissionKind }[]>
> = {
  PENDING: [
    { status: "CONFIRMED", permission: "update" },
    { status: "CANCELLED", permission: "cancel" },
  ],
  CONFIRMED: [
    { status: "PROCESSING", permission: "update" },
    { status: "CANCELLED", permission: "cancel" },
  ],
  PROCESSING: [
    { status: "SHIPPED", permission: "update" },
    { status: "CANCELLED", permission: "cancel" },
  ],
  SHIPPED: [{ status: "DELIVERED", permission: "update" }],
  DELIVERED: [{ status: "COMPLETED", permission: "update" }],
};

export const ADMIN_ORDERS_ERROR_MESSAGES: Partial<Record<string, string>> = {
  ORDERS_NOT_FOUND: "That order could not be found.",
  ORDERS_INVALID_STATUS_TRANSITION: "That status change isn't allowed from the order's current status.",
  ORDERS_TERMINAL_STATE: "This order is in a final state and can't be changed.",
  ORDERS_STATUS_CONFLICT: "This order was changed by someone else. The page has been refreshed — please review and retry.",
};

/**
 * DISPLAY-ONLY mirror of the backend's SHIPMENT_TRANSITIONS table
 * (backend/src/modules/shipping/shipments.service.ts), used to decide which
 * next-status buttons to render. The backend re-validates every transition.
 */
export const SHIPMENT_NEXT_TRANSITIONS: Partial<Record<ShipmentStatus, ShipmentStatus[]>> = {
  PENDING: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["IN_TRANSIT", "ITEM_RETURNED", "ITEM_LOST"],
  IN_TRANSIT: ["DELIVERED", "RETURNED", "ITEM_RETURNED", "ITEM_LOST"],
  DELIVERED: ["RETURNED", "ITEM_RETURNED"],
  RETURNED: ["ITEM_RETURNED"],
};

export const PAYMENTS_ERROR_MESSAGES: Partial<Record<string, string>> = {
  PAYMENTS_NOT_FOUND: "That payment could not be found.",
  PAYMENTS_INVALID_STATUS_TRANSITION: "That action isn't allowed from the payment's current status.",
  PAYMENTS_STATUS_CONFLICT: "This payment was changed by someone else. The page has been refreshed — please review and retry.",
  PAYMENTS_ORDER_NOT_PAYABLE: "This order is in a final state and its payment can't be changed.",
  PAYMENTS_REFUND_EXCEEDS_CAPTURED: "That refund amount exceeds what's still available to refund.",
  PAYMENTS_STAFF_ACTION_UNSUPPORTED: "This action isn't supported for this payment method.",
  PAYMENTS_VALIDATION_ERROR: "Please check the values entered and try again.",
};

export const SHIPMENT_ERROR_MESSAGES: Partial<Record<string, string>> = {
  SHIPMENT_NOT_FOUND: "That shipment could not be found.",
  SHIPMENT_INVALID_STATUS_TRANSITION: "That status change isn't allowed from the shipment's current status.",
  SHIPMENT_STATUS_CONFLICT: "This shipment was changed by someone else. The page has been refreshed — please review and retry.",
  SHIPMENT_ORDER_NOT_SHIPPABLE: "This order is in a final state and its shipment can't be changed.",
  SHIPMENT_ITEM_OUTCOME_REQUIRES_CANCELLED_ORDER: "Item returned/lost can only be recorded once the order is cancelled.",
};

export const RETURNS_ERROR_MESSAGES: Partial<Record<string, string>> = {
  RETURNS_NOT_FOUND: "That return could not be found.",
  RETURNS_ORDER_NOT_RETURNABLE: "This order is no longer eligible for a return.",
  RETURNS_INVALID_STATUS_TRANSITION: "That action isn't allowed from the return's current status.",
  RETURNS_STATUS_CONFLICT: "This return was changed by someone else. The page has been refreshed — please review and retry.",
  RETURNS_PAYMENT_NOT_FOUND: "No refundable payment was found for this order.",
  RETURNS_VALIDATION_ERROR: "Please check the values entered and try again.",
};
