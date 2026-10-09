import type { Market, Order, OrderStatusHistory } from "../../generated/prisma/client.js";
import type { OrderItemView, OrderAddressView } from "../checkout/checkout.mapper.js";
import { toOrderAddressView } from "../checkout/checkout.mapper.js";
import { pickAddress } from "./orderAddress.helper.js";
import type {
  AdminOrderDetailRow,
  AdminOrderSummaryRow,
  OrderItemWithThumbnail,
  OrderWithDetails,
} from "./orders.repository.js";

// Reuses OrderItemView/OrderAddressView from checkout.mapper.ts — identical
// shape, no reason to duplicate. Does NOT reuse checkout.mapper.ts's
// OrderView/toOrderView: that type's own doc comment states it is
// deliberately the customer-only shape Checkout returns; Orders needs one
// shape usable for both the customer and staff views, plus a status-history
// list neither Checkout nor that type carries.

export interface OrderSummaryView {
  id: string;
  orderNumber: string;
  marketCode: string;
  currencyCode: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  placedAt: string;
  createdAt: string;
  source: string;
  /// Null for every surface except the customer order list (GET /orders),
  /// the only caller that fetches item+media data — see toOrderSummary's
  /// optional second parameter below.
  thumbnailUrl: string | null;
}

export interface OrderStatusHistoryView {
  previousStatus: string;
  newStatus: string;
  changedByUserId: string | null;
  reason: string | null;
  createdAt: string;
}

export interface OrderDetailView extends OrderSummaryView {
  paymentMethod: string;
  items: OrderItemView[];
  billingAddress: OrderAddressView | null;
  shippingAddress: OrderAddressView | null;
  subtotalAmount: number;
  discountAmount: number;
  shippingAmount: number;
  taxAmount: number;
  statusHistory: OrderStatusHistoryView[];
}

/// `thumbnailUrl` is a separate, optional parameter rather than part of
/// `order`'s own type — keeps this function's required input shape
/// unchanged for every other caller (AdminOrderSummaryRow/OrderWithDetails
/// neither fetch item+media data), instead of threading an incompatible
/// `items` shape through all of them.
export function toOrderSummary(
  order: Order & { market: Market },
  thumbnailUrl: string | null = null,
): OrderSummaryView {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    marketCode: order.market.code,
    currencyCode: order.currencyCode,
    status: order.status,
    paymentStatus: order.paymentStatus,
    totalAmount: order.totalAmount,
    placedAt: order.placedAt.toISOString(),
    createdAt: order.createdAt.toISOString(),
    source: order.source,
    thumbnailUrl,
  };
}

/// "Primary, falling back to first" — same resolution WishlistService
/// already uses for its own per-item product thumbnail.
export function resolveOrderThumbnail(items: OrderItemWithThumbnail[]): string | null {
  const media = items[0]?.product?.media ?? [];
  const primary = media.find((m) => m.isPrimary) ?? media[0] ?? null;
  return primary?.url ?? null;
}

function toStatusHistoryView(row: OrderStatusHistory): OrderStatusHistoryView {
  return {
    previousStatus: row.previousStatus,
    newStatus: row.newStatus,
    changedByUserId: row.changedByUserId,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Staff-only shapes (GET /admin/orders[/:id]). The customer-facing views above
// are deliberately left untouched. Payment/shipment/return projections are
// allowlists: no idempotencyKey, no PaymentTransaction.metadata (raw provider
// payload), no user passwordHash/tokens.
// ---------------------------------------------------------------------------

export interface AdminOrderCustomerView {
  id: string | null;
  name: string;
  email: string;
  /// true for a guest/no-account order (Order.userId null) — id is then
  /// always null and name/email come from the order's own snapshot
  /// (OrderAddress.fullName / Order.guestEmail), never a User row.
  isGuest: boolean;
}

export interface AdminOrderSummaryView extends OrderSummaryView {
  shipmentStatus: string;
  customer: AdminOrderCustomerView;
  /// Null when the order has no Payment/Shipment row yet (should not
  /// happen for a committed order, but kept nullable defensively). The
  /// Admin Orders list page's inline status dropdowns need these ids to
  /// act directly on a row without a second fetch.
  paymentId: string | null;
  paymentProvider: string | null;
  shipmentId: string | null;
}

export interface AdminOrderPaymentView {
  id: string;
  provider: string;
  method: string;
  status: string;
  amount: number;
  currencyCode: string;
  providerPaymentId: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface AdminOrderShipmentView {
  id: string;
  status: string;
  shippingMethodName: string;
  carrier: string | null;
  trackingNumber: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
}

export interface AdminOrderReturnView {
  id: string;
  status: string;
  reason: string | null;
  rejectionReason: string | null;
  refundAmount: number | null;
  createdAt: string;
  reviewedAt: string | null;
  receivedAt: string | null;
  refundedAt: string | null;
}

export interface AdminOrderDetailView extends OrderDetailView {
  shipmentStatus: string;
  customer: AdminOrderCustomerView;
  payments: AdminOrderPaymentView[];
  shipment: AdminOrderShipmentView | null;
  returns: AdminOrderReturnView[];
}

function toCustomerView(order: AdminOrderSummaryRow | AdminOrderDetailRow): AdminOrderCustomerView {
  if (order.user) {
    return { id: order.user.id, name: `${order.user.firstName} ${order.user.lastName}`.trim(), email: order.user.email, isGuest: false };
  }
  const shipping = pickAddress(order.addresses, "SHIPPING");
  const billing = pickAddress(order.addresses, "BILLING");
  return { id: null, name: shipping?.fullName ?? billing?.fullName ?? "Guest", email: order.guestEmail ?? "", isGuest: true };
}

export function toAdminOrderSummary(order: AdminOrderSummaryRow): AdminOrderSummaryView {
  const payment = order.payments[0] ?? null;
  return {
    ...toOrderSummary(order),
    shipmentStatus: order.shipmentStatus,
    customer: toCustomerView(order),
    paymentId: payment?.id ?? null,
    paymentProvider: payment?.provider ?? null,
    shipmentId: order.shipment?.id ?? null,
  };
}

export function toAdminOrderDetail(order: AdminOrderDetailRow): AdminOrderDetailView {
  return {
    ...toOrderDetail(order),
    shipmentStatus: order.shipmentStatus,
    customer: toCustomerView(order),
    payments: order.payments.map((p) => ({
      id: p.id,
      provider: p.provider,
      method: p.method,
      status: p.status,
      amount: p.amount,
      currencyCode: p.currencyCode,
      providerPaymentId: p.providerPaymentId,
      paidAt: p.paidAt ? p.paidAt.toISOString() : null,
      createdAt: p.createdAt.toISOString(),
    })),
    shipment: order.shipment
      ? {
          id: order.shipment.id,
          status: order.shipment.status,
          shippingMethodName: order.shipment.shippingMethod.name,
          carrier: order.shipment.carrier,
          trackingNumber: order.shipment.trackingNumber,
          shippedAt: order.shipment.shippedAt ? order.shipment.shippedAt.toISOString() : null,
          deliveredAt: order.shipment.deliveredAt ? order.shipment.deliveredAt.toISOString() : null,
        }
      : null,
    returns: order.returns.map((r) => ({
      id: r.id,
      status: r.status,
      reason: r.reason,
      rejectionReason: r.rejectionReason,
      refundAmount: r.refundAmount,
      createdAt: r.createdAt.toISOString(),
      reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
      receivedAt: r.receivedAt ? r.receivedAt.toISOString() : null,
      refundedAt: r.refundedAt ? r.refundedAt.toISOString() : null,
    })),
  };
}

export function toOrderDetail(order: OrderWithDetails): OrderDetailView {
  return {
    ...toOrderSummary(order),
    paymentMethod: order.paymentMethod,
    items: order.items.map((item) => ({
      id: item.id,
      variantId: item.variantId,
      productId: item.productId,
      sku: item.sku,
      productName: item.productName,
      variantName: item.variantName,
      unitAmount: item.unitAmount,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
      currencyCode: item.currencyCode,
    })),
    billingAddress: toOrderAddressView(pickAddress(order.addresses, "BILLING")),
    shippingAddress: toOrderAddressView(pickAddress(order.addresses, "SHIPPING")),
    subtotalAmount: order.subtotalAmount,
    discountAmount: order.discountAmount,
    shippingAmount: order.shippingAmount,
    taxAmount: order.taxAmount,
    statusHistory: order.statusHistory.map(toStatusHistoryView),
  };
}
