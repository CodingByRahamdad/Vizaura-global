import { apiFetch } from "@/lib/api";
import { ENDPOINTS } from "@/lib/endpoints";
import { withAuthRetry } from "@/lib/api/withAuthRetry";
import type { OrderDetailView } from "@/lib/types/orders";
import type { OrderStatus } from "@/lib/types/checkout";
import type { AdminOrderDetail } from "@/lib/types/admin-orders";

/**
 * Client-safe mutation only — the Server Component-only reads live in
 * orders-server.ts (next/headers can't be pulled into a Client Component).
 */

export interface UpdateOrderStatusInput {
  status: Exclude<OrderStatus, "PENDING" | "FAILED" | "REFUNDED" | "RETURNED">;
  reason?: string;
}

/**
 * PATCH /admin/orders/:id/status. The backend owns the state machine, the
 * per-transition permission check (orders:update vs orders:cancel), the
 * OrderStatusHistory row and the audit entry; invalid transitions come back
 * as 422 ORDERS_INVALID_STATUS_TRANSITION / ORDERS_TERMINAL_STATE and races as
 * 409 ORDERS_STATUS_CONFLICT.
 */
export async function updateOrderStatus(id: string, input: UpdateOrderStatusInput): Promise<OrderDetailView> {
  return withAuthRetry(() =>
    apiFetch<OrderDetailView>(ENDPOINTS.admin.orderStatus(id), {
      method: "PATCH",
      body: JSON.stringify(input),
      cache: "no-store",
    })
  );
}

export interface CreateAdminOrderLineInput {
  productId: string;
  variantId: string;
  quantity: number;
  unitAmountOverride?: number;
}

export interface AdminAddressInput {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode?: string;
  countryCode: string;
}

export interface CreateAdminOrderInput {
  // Exactly one of userId/guestEmail — see AddOrderForm's customerMode toggle.
  userId?: string;
  guestEmail?: string;
  market: string;
  paymentMethod: string;
  paymentStatus: "PENDING" | "PAID";
  // Always collected; shippingAddress only sent (and only required by the
  // backend) when shipToDifferentAddress is true — otherwise the backend
  // uses billingAddress as the shipping address too.
  billingAddress: AdminAddressInput;
  shipToDifferentAddress: boolean;
  shippingAddress?: AdminAddressInput;
  lines: CreateAdminOrderLineInput[];
}

/**
 * POST /admin/orders (orders:create) — offline/custom orders entered by
 * staff (phone/WhatsApp/walk-in). The backend re-validates every line
 * against the live catalog/price/inventory state exactly like checkout
 * does; this is not a second order-creation implementation, just a second
 * caller of the same validated path.
 */
export async function createAdminOrder(input: CreateAdminOrderInput): Promise<AdminOrderDetail> {
  return withAuthRetry(() =>
    apiFetch<AdminOrderDetail>(ENDPOINTS.admin.orders, {
      method: "POST",
      body: JSON.stringify(input),
      cache: "no-store",
    })
  );
}

export interface EditAdminOrderLineInput {
  id?: string;
  remove?: boolean;
  productId?: string;
  variantId?: string;
  quantity?: number;
  unitAmountOverride?: number;
}

export interface EditAdminOrderInput {
  billingAddress?: AdminAddressInput;
  shippingAddress?: AdminAddressInput;
  items?: EditAdminOrderLineInput[];
}

/**
 * PATCH /admin/orders/:id (orders:update) — edit an existing order's
 * address(es) and/or line items. Only succeeds while the order is still
 * fully mutable (every Payment PENDING, Shipment PENDING, no returns);
 * otherwise the backend rejects with 409 ORDERS_NOT_EDITABLE.
 */
export async function editAdminOrder(id: string, input: EditAdminOrderInput): Promise<AdminOrderDetail> {
  return withAuthRetry(() =>
    apiFetch<AdminOrderDetail>(ENDPOINTS.admin.order(id), {
      method: "PATCH",
      body: JSON.stringify(input),
      cache: "no-store",
    })
  );
}

/**
 * DELETE /admin/orders/:id (orders:delete) — a real hard delete, only
 * reachable while the order is still fully mutable; otherwise the backend
 * rejects with 409 ORDERS_NOT_DELETABLE.
 */
export async function deleteAdminOrder(id: string): Promise<void> {
  await withAuthRetry(() =>
    apiFetch<void>(ENDPOINTS.admin.order(id), {
      method: "DELETE",
      cache: "no-store",
    })
  );
}
