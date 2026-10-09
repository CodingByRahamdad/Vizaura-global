import { apiFetch } from "@/lib/api";
import { ENDPOINTS } from "@/lib/endpoints";
import { withAuthRetry } from "@/lib/api/withAuthRetry";
import type { AdminOrderShipment, ShipmentStatus } from "@/lib/types/admin-orders";

export interface UpdateShipmentInput {
  status: ShipmentStatus;
  trackingNumber?: string;
  carrier?: string;
}

/**
 * PATCH /admin/shipments/:id (shipping:update). The backend owns the
 * transition table (SHIPMENT_TRANSITIONS) and rejects invalid moves with 422
 * SHIPMENT_INVALID_STATUS_TRANSITION or a terminal parent order with 422
 * SHIPMENT_ORDER_NOT_SHIPPABLE; a race comes back as 409
 * SHIPMENT_STATUS_CONFLICT. Tracking/carrier are applied alongside the
 * status change in the same request — there is no separate tracking-only
 * endpoint.
 */
export async function updateShipment(id: string, input: UpdateShipmentInput): Promise<AdminOrderShipment> {
  return withAuthRetry(() =>
    apiFetch<AdminOrderShipment>(ENDPOINTS.admin.shipmentUpdate(id), {
      method: "PATCH",
      body: JSON.stringify(input),
      cache: "no-store",
    })
  );
}
