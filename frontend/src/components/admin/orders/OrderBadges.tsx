import { Badge } from "@/components/ui/Badge";
import type { OrderStatus, PaymentStatus } from "@/lib/types/checkout";
import {
  ORDER_SOURCE_LABELS,
  ORDER_STATUS_BADGE_VARIANT,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_BADGE_VARIANT,
  PAYMENT_STATUS_LABELS,
  type OrderSource,
} from "@/lib/types/orders";
import {
  SHIPMENT_STATUS_BADGE_VARIANT,
  SHIPMENT_STATUS_LABELS,
  type ShipmentStatus,
} from "@/lib/types/admin-orders";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={ORDER_STATUS_BADGE_VARIANT[status] ?? "neutral"}>{ORDER_STATUS_LABELS[status] ?? status}</Badge>;
}

export function OrderPaymentBadge({ status }: { status: PaymentStatus }) {
  return (
    <Badge variant={PAYMENT_STATUS_BADGE_VARIANT[status] ?? "neutral"}>{PAYMENT_STATUS_LABELS[status] ?? status}</Badge>
  );
}

export function OrderShipmentBadge({ status }: { status: ShipmentStatus }) {
  return (
    <Badge variant={SHIPMENT_STATUS_BADGE_VARIANT[status] ?? "neutral"}>{SHIPMENT_STATUS_LABELS[status] ?? status}</Badge>
  );
}

export function OrderSourceBadge({ source }: { source: OrderSource }) {
  return <Badge variant={source === "OFFLINE" ? "neutral" : "success"}>{ORDER_SOURCE_LABELS[source] ?? source}</Badge>;
}
