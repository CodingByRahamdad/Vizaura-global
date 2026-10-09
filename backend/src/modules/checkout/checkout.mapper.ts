import type { OrderAddress } from "../../generated/prisma/client.js";
import type { OrderWithDetails } from "./checkout.repository.js";
import { pickAddress } from "../orders/orderAddress.helper.js";

export interface OrderItemView {
  id: string;
  variantId: string | null;
  productId: string | null;
  sku: string;
  productName: string;
  variantName: string;
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

export interface OrderView {
  id: string;
  orderNumber: string;
  marketCode: string;
  currencyCode: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
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

export function toOrderAddressView(address: OrderAddress | undefined): OrderAddressView | null {
  if (!address) return null;
  return {
    fullName: address.fullName,
    phone: address.phone,
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    region: address.region,
    postalCode: address.postalCode,
    countryCode: address.countryCode,
  };
}

/// The only response shape Checkout ever returns — a customer's own order,
/// never an admin/staff view (no separate shape split like Pricing/
/// Inventory's public-vs-admin, since Checkout has no anonymous caller).
export function toOrderView(order: OrderWithDetails): OrderView {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    marketCode: order.market.code,
    currencyCode: order.currencyCode,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    shipmentStatus: order.shipmentStatus,
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
    totalAmount: order.totalAmount,
    placedAt: order.placedAt.toISOString(),
    createdAt: order.createdAt.toISOString(),
  };
}
