import type { Shipment, ShipmentStatus } from "../../generated/prisma/client.js";
import { ShipmentsRepository } from "./shipments.repository.js";
import { OrdersRepository } from "../orders/orders.repository.js";
import { OrdersService } from "../orders/orders.service.js";
import { RbacService } from "../rbac/rbac.service.js";
import type { AuthorizationState } from "../rbac/rbac.repository.js";
import { resolveProvider } from "./providers/index.js";
import { shippingErrors } from "../../errors/AppError.js";
import type { ListAdminShipmentsQuery, UpdateShipmentInput } from "./shipments.validators.js";

const TERMINAL_ORDER_STATUSES = new Set(["CANCELLED", "COMPLETED", "FAILED", "REFUNDED", "RETURNED"]);

/// Post-cancellation outcomes: only reachable once the parent Order is
/// CANCELLED (see assertOrderShippable), recording what happened to a
/// shipment that had already left the warehouse before the order was
/// cancelled. See docs/modules/SHIPPING.md.
const CANCELLATION_OUTCOME_STATUSES = new Set<ShipmentStatus>(["ITEM_RETURNED", "ITEM_LOST"]);

/// The only shipment lifecycle this phase builds (docs/modules/SHIPPING.md).
/// CANCELLED is reachable only before dispatch (PENDING/PROCESSING);
/// RETURNED only after the shipment has actually left (IN_TRANSIT/
/// DELIVERED) — a delivery failure/return-to-sender. ITEM_RETURNED/
/// ITEM_LOST are reachable only from post-dispatch statuses (nothing to
/// lose/return before SHIPPED — CANCELLED already covers that case) and
/// only when the order has been cancelled. Any (from, to) pair not listed
/// here is invalid.
const SHIPMENT_TRANSITIONS: Partial<Record<ShipmentStatus, ShipmentStatus[]>> = {
  PENDING: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["IN_TRANSIT", "ITEM_RETURNED", "ITEM_LOST"],
  IN_TRANSIT: ["DELIVERED", "RETURNED", "ITEM_RETURNED", "ITEM_LOST"],
  DELIVERED: ["RETURNED", "ITEM_RETURNED"],
  RETURNED: ["ITEM_RETURNED"],
};

export interface ListResult<T> {
  shipments: T[];
  total: number;
}

export class ShipmentsService {
  constructor(
    private readonly shipmentsRepository: ShipmentsRepository = new ShipmentsRepository(),
    private readonly ordersRepository: OrdersRepository = new OrdersRepository(),
    private readonly ordersService: OrdersService = new OrdersService(),
    private readonly rbacService: RbacService = new RbacService(),
  ) {}

  /// GET /orders/:orderId/shipment — ownership resolved through the parent
  /// Order (same posture Payments already established for GET
  /// /payments/:id: a failed check is 404, never 403, "never distinguish
  /// not-yours from doesn't-exist").
  async getByOrderId(orderId: string, requesterId: string, authState: AuthorizationState): Promise<Shipment> {
    const order = await this.ordersRepository.findById(orderId);
    if (!order) throw shippingErrors.shipmentNotFound();

    const allowed = this.rbacService.authorizeOwnerOrPermission({
      resourceOwnerId: order.userId,
      requesterId,
      state: authState,
      overridePermission: "shipping:read",
    });
    if (!allowed) throw shippingErrors.shipmentNotFound();

    const shipment = await this.shipmentsRepository.findByOrderId(orderId);
    if (!shipment) throw shippingErrors.shipmentNotFound();
    return shipment;
  }

  async listAdmin(query: ListAdminShipmentsQuery, skip: number, take: number): Promise<ListResult<Shipment>> {
    return this.shipmentsRepository.listAdmin({ status: query.status, orderId: query.orderId }, skip, take);
  }

  /// PATCH /admin/shipments/:id — staff-only (shipping:update). Does NOT
  /// require Order.paymentStatus === PAID: COD orders are never pre-paid at
  /// shipment time by design (the PRD gives no "paid before ship" rule, and
  /// COD's own "collect on delivery" semantics already imply shipment
  /// happens before payment). Only requires the parent Order be non-terminal
  /// — same guard family as Payments' Phase 4L PAYMENTS_ORDER_NOT_PAYABLE
  /// fix, so a cancelled/completed order's shipment can't still be walked
  /// forward merely because a caller holds shipping:update.
  async updateStatus(shipmentId: string, input: UpdateShipmentInput): Promise<Shipment> {
    const shipment = await this.shipmentsRepository.findById(shipmentId);
    if (!shipment) throw shippingErrors.shipmentNotFound();

    const allowedTargets = SHIPMENT_TRANSITIONS[shipment.status];
    if (!allowedTargets || !allowedTargets.includes(input.status)) {
      throw shippingErrors.invalidStatusTransition(shipment.status, input.status);
    }

    await this.assertOrderShippable(shipment.orderId, input.status);

    const updated = await this.shipmentsRepository.transitionStatus({
      shipmentId,
      expectedCurrentStatus: shipment.status,
      newStatus: input.status,
      trackingNumber: input.trackingNumber,
      carrier: input.carrier,
    });
    if (!updated) throw shippingErrors.statusConflict();

    if (input.status === "SHIPPED") {
      const provider = resolveProvider("MANUAL");
      await provider.dispatch({
        shipmentId: updated.id,
        trackingNumber: updated.trackingNumber,
        carrier: updated.carrier,
      });
    }

    await this.ordersService.updateShipmentStatus(shipment.orderId, input.status);

    return updated;
  }

  private async assertOrderShippable(orderId: string, targetStatus: ShipmentStatus): Promise<void> {
    const order = await this.ordersRepository.findById(orderId);
    const orderStatus = order?.status ?? "UNKNOWN";
    const isCancellationOutcome = CANCELLATION_OUTCOME_STATUSES.has(targetStatus);

    if (!order || TERMINAL_ORDER_STATUSES.has(orderStatus)) {
      // Narrow carve-out: a CANCELLED order may still record what happened
      // to a shipment that had already left the warehouse. Every other
      // terminal order status, and every other target status on a
      // CANCELLED order, stays blocked exactly as before.
      if (orderStatus === "CANCELLED" && isCancellationOutcome) return;
      throw shippingErrors.orderNotShippable(orderStatus);
    }

    if (isCancellationOutcome) {
      throw shippingErrors.itemOutcomeRequiresCancelledOrder(orderStatus);
    }
  }
}
