import type { Shipment } from "../../generated/prisma/client.js";

export interface ShipmentView {
  id: string;
  orderId: string;
  shippingMethodId: string;
  trackingNumber: string | null;
  carrier: string | null;
  status: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toShipmentView(shipment: Shipment): ShipmentView {
  return {
    id: shipment.id,
    orderId: shipment.orderId,
    shippingMethodId: shipment.shippingMethodId,
    trackingNumber: shipment.trackingNumber,
    carrier: shipment.carrier,
    status: shipment.status,
    shippedAt: shipment.shippedAt ? shipment.shippedAt.toISOString() : null,
    deliveredAt: shipment.deliveredAt ? shipment.deliveredAt.toISOString() : null,
    createdAt: shipment.createdAt.toISOString(),
    updatedAt: shipment.updatedAt.toISOString(),
  };
}
