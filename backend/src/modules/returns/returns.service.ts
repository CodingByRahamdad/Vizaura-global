import { ReturnsRepository, type ReturnWithItems } from "./returns.repository.js";
import { OrdersService } from "../orders/orders.service.js";
import { PaymentsService } from "../payments/payments.service.js";
import { PaymentsRepository } from "../payments/payments.repository.js";
import { InventoryRepository } from "../inventory/inventory.repository.js";
import { RbacService } from "../rbac/rbac.service.js";
import type { AuthorizationState } from "../rbac/rbac.repository.js";
import { returnsErrors } from "../../errors/AppError.js";
import { isUniqueConstraintViolation } from "./prismaErrors.js";
import type { CreateReturnInput, ListAdminReturnsQuery } from "./returns.validators.js";

/// Confirmed with the requester (docs/modules/RETURNS.md): eligible once an
/// order has reached COMPLETED — not the PRD's literal DELIVERED example.
/// By COMPLETED, Orders' own DELIVERED->COMPLETED step has already fully
/// released the reservation and decremented onHand, so this domain's
/// restock action at RECEIVED is always a simple, always-correct
/// adjust(+quantity) — no partial-reservation-release capability needed in
/// Inventory. RETURNED/REFUNDED are included too: Order.status advances to
/// one of those the moment *any* return against the order is received/
/// refunded (see receive()/refund() below), so a second, later PARTIAL
/// return against a different (or the same, remaining-quantity) line must
/// stay eligible — per-item remaining quantity is what actually gates a
/// specific request (sumReturnedQuantities below), not a single coarse
/// Order-level flag.
const ELIGIBLE_ORDER_STATUSES = new Set(["COMPLETED", "RETURNED", "REFUNDED"]);

export interface ListResult<T> {
  returns: T[];
  total: number;
}

export class ReturnsService {
  constructor(
    private readonly returnsRepository: ReturnsRepository = new ReturnsRepository(),
    private readonly ordersService: OrdersService = new OrdersService(),
    private readonly paymentsService: PaymentsService = new PaymentsService(),
    private readonly paymentsRepository: PaymentsRepository = new PaymentsRepository(),
    private readonly inventoryRepository: InventoryRepository = new InventoryRepository(),
    private readonly rbacService: RbacService = new RbacService(),
  ) {}

  /// Customer-only (ownership) creation. Validates the order is COMPLETED,
  /// every orderItemId belongs to it, and each requested quantity doesn't
  /// exceed what remains returnable (ordered - previously returned across
  /// any non-REJECTED prior Return for that same line). The open-return
  /// partial unique index is the sole guard against a second, concurrent
  /// open return for the same order — no row locking needed here.
  async create(orderId: string, requesterId: string, input: CreateReturnInput): Promise<ReturnWithItems> {
    const order = await this.returnsRepository.findOrderWithItems(orderId);
    if (!order || order.userId !== requesterId) throw returnsErrors.notFound();
    if (!ELIGIBLE_ORDER_STATUSES.has(order.status)) throw returnsErrors.orderNotReturnable(order.status);

    const orderItemsById = new Map(order.items.map((item) => [item.id, item]));
    for (const line of input.items) {
      if (!orderItemsById.has(line.orderItemId)) {
        throw returnsErrors.validation({ reason: `orderItemId ${line.orderItemId} does not belong to this order` });
      }
    }

    const alreadyReturned = await this.returnsRepository.sumReturnedQuantities(input.items.map((i) => i.orderItemId));
    for (const line of input.items) {
      const orderItem = orderItemsById.get(line.orderItemId)!;
      const remaining = orderItem.quantity - (alreadyReturned.get(line.orderItemId) ?? 0);
      if (line.quantity > remaining) throw returnsErrors.quantityExceedsAvailable(line.orderItemId);
    }

    try {
      return await this.returnsRepository.create({
        orderId,
        requestedByUserId: requesterId,
        reason: input.reason,
        items: input.items,
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error, "orderId")) throw returnsErrors.alreadyOpen();
      throw error;
    }
  }

  /// Ownership resolved through the parent Order (a Return has no userId
  /// of its own) — same "never distinguish not-yours from doesn't-exist"
  /// posture Payments/Shipping already established.
  async getById(returnId: string, requesterId: string, authState: AuthorizationState): Promise<ReturnWithItems> {
    const ret = await this.returnsRepository.findById(returnId);
    if (!ret) throw returnsErrors.notFound();
    await this.assertOwnerOrPermission(ret.orderId, requesterId, authState);
    return ret;
  }

  async listByOrder(orderId: string, requesterId: string, authState: AuthorizationState): Promise<ReturnWithItems[]> {
    await this.assertOwnerOrPermission(orderId, requesterId, authState);
    return this.returnsRepository.findByOrderId(orderId);
  }

  async listAdmin(query: ListAdminReturnsQuery, skip: number, take: number): Promise<ListResult<ReturnWithItems>> {
    return this.returnsRepository.listAdmin({ status: query.status, orderId: query.orderId }, skip, take);
  }

  async approve(returnId: string, actorUserId: string): Promise<ReturnWithItems> {
    const ret = await this.getExistingOrThrow(returnId);
    if (ret.status !== "REQUESTED") throw returnsErrors.invalidStatusTransition(ret.status, "APPROVED");

    const updated = await this.returnsRepository.transitionStatus({
      returnId,
      expectedCurrentStatus: "REQUESTED",
      newStatus: "APPROVED",
      reviewedByUserId: actorUserId,
    });
    if (!updated) throw returnsErrors.statusConflict();
    return updated;
  }

  async reject(returnId: string, actorUserId: string, rejectionReason: string): Promise<ReturnWithItems> {
    const ret = await this.getExistingOrThrow(returnId);
    if (ret.status !== "REQUESTED") throw returnsErrors.invalidStatusTransition(ret.status, "REJECTED");

    const updated = await this.returnsRepository.transitionStatus({
      returnId,
      expectedCurrentStatus: "REQUESTED",
      newStatus: "REJECTED",
      reviewedByUserId: actorUserId,
      rejectionReason,
    });
    if (!updated) throw returnsErrors.statusConflict();
    return updated;
  }

  /// The guarded status transition settles who "wins" a concurrent
  /// receive() race BEFORE any inventory call is made — the same pattern
  /// Orders uses for its own non-idempotent adjust() call on ->COMPLETED —
  /// so restocking can only ever happen once per return, per item.
  /// Advances Order.status -> RETURNED afterward, but only the FIRST time
  /// (best-effort — a null result from a mismatched expectedCurrentStatus
  /// is not an error): a second, later partial return against the same
  /// order finds Order.status already RETURNED and leaves it exactly
  /// there — Order.status only ever signals "this order has had at least
  /// one return received," not a precise per-item accounting (that lives
  /// on ReturnItem/OrderItem, via sumReturnedQuantities). A crash between
  /// the guarded transition and the inventory loop is an accepted
  /// trade-off, the same class Orders'/Checkout's own sagas already
  /// accept elsewhere.
  async receive(returnId: string, actorUserId: string): Promise<ReturnWithItems> {
    const ret = await this.getExistingOrThrow(returnId);
    if (ret.status !== "APPROVED") throw returnsErrors.invalidStatusTransition(ret.status, "RECEIVED");

    const updated = await this.returnsRepository.transitionStatus({
      returnId,
      expectedCurrentStatus: "APPROVED",
      newStatus: "RECEIVED",
    });
    if (!updated) throw returnsErrors.statusConflict();

    const order = await this.returnsRepository.findOrderWithItems(updated.orderId);
    if (order) {
      const orderItemsById = new Map(order.items.map((item) => [item.id, item]));
      for (const line of updated.items) {
        const orderItem = orderItemsById.get(line.orderItemId);
        if (!orderItem?.variantId) continue; // source catalog row deleted since checkout — same known limitation Orders already accepts
        const stock = await this.inventoryRepository.findByVariantAndMarket(orderItem.variantId, order.marketId);
        if (!stock) continue;
        await this.inventoryRepository.adjust(stock.id, line.quantity, `return:${returnId}`, actorUserId);
      }
      if (order.status === "COMPLETED") {
        await this.ordersService.transitionForReturns(order.id, actorUserId, "COMPLETED", "RETURNED");
      }
    }

    return updated;
  }

  /// Delegates the actual refund to PaymentsService.refund() (or, for a COD
  /// payment, markRefunded() — Phase 4O — COD has no provider to call, so
  /// the provider-calling refund() always throws providerOperationUnsupported
  /// for it; no second refund implementation, just COD's staff-attested
  /// complement, precedent-matched to markPaid/markFailed) — its row-locked
  /// mechanism is reused as-is either way. The guarded RECEIVED->REFUNDED
  /// transition settles who "wins" a concurrent refund() race BEFORE the
  /// refund call itself, so the Payments call is only ever invoked once per
  /// Return — this matters because Payments' own idempotency only protects
  /// a *repeated* call with the same amount from over-refunding the
  /// *payment*, not from two concurrent callers both legitimately having
  /// enough headroom to each succeed once.
  ///
  /// Phase 4O fix: if the Payments call throws (COD misconfiguration, a
  /// transient provider error, etc.) after the Return has already claimed
  /// REFUNDED, the claim is reverted (a second guarded transition back to
  /// RECEIVED) before the error is rethrown — otherwise the Return would be
  /// left permanently reporting REFUNDED while the Payment was never
  /// actually refunded, with no retry path (the RECEIVED->REFUNDED guard
  /// would reject any further attempt). A failure to revert (e.g. the DB
  /// itself is unreachable) is a residual, infrastructure-level risk that
  /// surfaces as the original error — never silently swallowed.
  ///
  /// Refund amount is always computed from the immutable OrderItem.
  /// unitAmount snapshot, never current Catalog/Pricing (item cost only —
  /// no shipping/tax/discount proration; PRD gives no rule for it, see
  /// docs/modules/RETURNS.md).
  ///
  /// Phase 4P: `returnId` is now passed through to both Payments calls so
  /// the resulting PaymentTransaction.metadata carries a structured
  /// { source, returnId } tag — a Return-driven refund is now distinguishable
  /// from a standalone gateway/COD refund without parsing providerReference.
  async refund(returnId: string, actorUserId: string): Promise<ReturnWithItems> {
    const ret = await this.getExistingOrThrow(returnId);
    if (ret.status !== "RECEIVED") throw returnsErrors.invalidStatusTransition(ret.status, "REFUNDED");

    const order = await this.returnsRepository.findOrderWithItems(ret.orderId);
    if (!order) throw returnsErrors.notFound();
    const orderItemsById = new Map(order.items.map((item) => [item.id, item]));
    const refundAmount = ret.items.reduce((sum, line) => {
      const orderItem = orderItemsById.get(line.orderItemId);
      return sum + (orderItem ? orderItem.unitAmount * line.quantity : 0);
    }, 0);

    const payments = await this.paymentsRepository.findByOrderId(ret.orderId);
    const payment = payments.find((p) => p.status === "PAID" || p.status === "PARTIALLY_REFUNDED");
    if (!payment) throw returnsErrors.paymentNotFound();

    const updated = await this.returnsRepository.transitionStatus({
      returnId,
      expectedCurrentStatus: "RECEIVED",
      newStatus: "REFUNDED",
      refundAmount,
    });
    if (!updated) throw returnsErrors.statusConflict();

    try {
      if (payment.provider === "COD") {
        await this.paymentsService.markRefunded(payment.id, actorUserId, refundAmount, undefined, returnId);
      } else {
        await this.paymentsService.refund(payment.id, refundAmount, returnId);
      }
    } catch (error) {
      await this.returnsRepository.transitionStatus({
        returnId,
        expectedCurrentStatus: "REFUNDED",
        newStatus: "RECEIVED",
      });
      throw error;
    }

    if (order.status === "RETURNED") {
      await this.ordersService.transitionForReturns(order.id, actorUserId, "RETURNED", "REFUNDED");
    }

    return updated;
  }

  private async getExistingOrThrow(returnId: string): Promise<ReturnWithItems> {
    const ret = await this.returnsRepository.findById(returnId);
    if (!ret) throw returnsErrors.notFound();
    return ret;
  }

  private async assertOwnerOrPermission(orderId: string, requesterId: string, authState: AuthorizationState): Promise<void> {
    const order = await this.returnsRepository.findOrderWithItems(orderId);
    if (!order) throw returnsErrors.notFound();
    const allowed = this.rbacService.authorizeOwnerOrPermission({
      resourceOwnerId: order.userId,
      requesterId,
      state: authState,
      overridePermission: "returns:read",
    });
    if (!allowed) throw returnsErrors.notFound();
  }
}
