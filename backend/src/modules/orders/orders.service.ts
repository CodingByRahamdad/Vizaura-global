import { randomUUID } from "node:crypto";
import type { Market, OrderPaymentStatus, OrderStatus, ShipmentStatus } from "../../generated/prisma/client.js";
import {
  OrdersRepository,
  type AdminOrderDetailRow,
  type AdminOrderLineInput,
  type AdminOrderSummaryRow,
  type OrderWithDetails,
  type OwnOrderListRow,
} from "./orders.repository.js";
import { RbacService } from "../rbac/rbac.service.js";
import type { AuthorizationState } from "../rbac/rbac.repository.js";
import { InventoryRepository, InsufficientStockError } from "../inventory/inventory.repository.js";
import { PricingRepository } from "../pricing/pricing.repository.js";
import { resolveEffectivePrice } from "../pricing/pricing.service.js";
import { CartRepository } from "../cart/cart.repository.js";
import { ShippingMethodsRepository } from "../shipping/shipping-methods.repository.js";
import { authErrors, cartErrors, catalogErrors, ordersErrors, usersErrors } from "../../errors/AppError.js";
import { sendOrderConfirmation } from "./orderConfirmation.helper.js";
import { computeSubtotal } from "./orderTotals.helper.js";
import { assertOrderIsMutable, assertOrderIsDeletable } from "./orderMutability.helper.js";
import type {
  CreateAdminOrderInput,
  EditAdminOrderInput,
  EditOrderLineInput,
  ListAdminOrdersQuery,
  ListOwnOrdersQuery,
} from "./orders.validators.js";

type TransitionPermission = "orders:update" | "orders:cancel";

/// The only status-transition table this phase builds (see
/// docs/modules/ORDERS.md for the full rationale). Any (from, to) pair not
/// listed here is invalid — including every transition into/out of
/// FAILED/REFUNDED/RETURNED (payment/returns-domain-driven, not built here)
/// and DELIVERED→CANCELLED (PRD requires a return/refund flow instead).
const ORDER_TRANSITIONS: Partial<Record<OrderStatus, Partial<Record<OrderStatus, TransitionPermission>>>> = {
  PENDING: { CONFIRMED: "orders:update", CANCELLED: "orders:cancel" },
  CONFIRMED: { PROCESSING: "orders:update", CANCELLED: "orders:cancel" },
  PROCESSING: { SHIPPED: "orders:update", CANCELLED: "orders:cancel" },
  SHIPPED: { DELIVERED: "orders:update" },
  DELIVERED: { COMPLETED: "orders:update" },
};

const TERMINAL_STATUSES: OrderStatus[] = ["COMPLETED", "CANCELLED", "FAILED", "REFUNDED", "RETURNED"];

export interface ListResult<T> {
  orders: T[];
  total: number;
}

export class OrdersService {
  constructor(
    private readonly ordersRepository: OrdersRepository = new OrdersRepository(),
    private readonly rbacService: RbacService = new RbacService(),
    private readonly inventoryRepository: InventoryRepository = new InventoryRepository(),
    private readonly pricingRepository: PricingRepository = new PricingRepository(),
    private readonly cartRepository: CartRepository = new CartRepository(),
    private readonly shippingMethodsRepository: ShippingMethodsRepository = new ShippingMethodsRepository(),
  ) {}

  /// Cross-domain entry point for the Customers module (Phase 6M) — Users
  /// never imports OrdersRepository directly (see docs/ARCHITECTURE.md:
  /// cross-domain access goes through service calls, not another domain's
  /// repository).
  async getCustomerStatsByUserIds(
    userIds: string[],
  ): Promise<Map<string, { orderCount: number; totalSpent: { currencyCode: string; amount: number }[] }>> {
    return this.ordersRepository.getStatsByUserIds(userIds);
  }

  async listOwn(
    userId: string,
    query: ListOwnOrdersQuery,
    skip: number,
    take: number,
  ): Promise<ListResult<OwnOrderListRow>> {
    return this.ordersRepository.listOwn(
      { userId, status: query.status, dateFrom: query.dateFrom, dateTo: query.dateTo },
      skip,
      take,
    );
  }

  async listAdmin(query: ListAdminOrdersQuery, skip: number, take: number): Promise<ListResult<AdminOrderSummaryRow>> {
    let marketId: string | undefined;
    if (query.market) {
      const market = await this.ordersRepository.findMarketByCode(query.market);
      if (!market) return { orders: [], total: 0 };
      marketId = market.id;
    }

    return this.ordersRepository.listAdmin(
      {
        status: query.status,
        paymentStatus: query.paymentStatus,
        shipmentStatus: query.shipmentStatus,
        marketId,
        userId: query.customer,
        orderNumber: query.orderNumber,
        search: query.search,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      },
      skip,
      take,
    );
  }

  /// Shared by both GET /orders/:id and GET /admin/orders/:id — a customer
  /// reaches their own order via ownership, staff reach any order via the
  /// orders:read override. A failed check returns "not found", never
  /// "forbidden" (same posture as products.controller.ts for a hidden
  /// product): a customer must never be able to distinguish "not yours"
  /// from "doesn't exist". A guest order (userId null) never matches any
  /// requesterId, so it's reachable only by staff with orders:read.
  async getOrderById(orderId: string, requesterId: string, authState: AuthorizationState): Promise<OrderWithDetails> {
    const order = await this.ordersRepository.findById(orderId);
    if (!order) throw ordersErrors.notFound();

    const allowed = this.rbacService.authorizeOwnerOrPermission({
      resourceOwnerId: order.userId,
      requesterId,
      state: authState,
      overridePermission: "orders:read",
    });
    if (!allowed) throw ordersErrors.notFound();

    return order;
  }

  /// Staff-only detail read (customer + payments + shipment + returns). The
  /// route gate is orders:read; the permission is re-checked here so the
  /// service never returns another user's order on the strength of the route
  /// alone. Same "not found, never forbidden" posture as getOrderById.
  async getAdminOrderById(orderId: string, authState: AuthorizationState): Promise<AdminOrderDetailRow> {
    if (!this.rbacService.hasPermission(authState, "orders:read")) throw ordersErrors.notFound();
    const order = await this.ordersRepository.findAdminDetailById(orderId);
    if (!order) throw ordersErrors.notFound();
    return order;
  }

  /// See docs/modules/ORDERS.md for the full concurrency-safety rationale.
  /// The DB-guarded transition settles who "wins" a race BEFORE any
  /// inventory call is made, because InventoryRepository.adjust() (used on
  /// →COMPLETED) is not idempotent, unlike reserve()/release() — only the
  /// guarded-UPDATE winner ever calls it, exactly once.
  async updateStatus(
    orderId: string,
    actorUserId: string,
    authState: AuthorizationState,
    targetStatus: OrderStatus,
    reason: string | undefined,
  ): Promise<{ order: OrderWithDetails; previousStatus: OrderStatus }> {
    const order = await this.ordersRepository.findById(orderId);
    if (!order) throw ordersErrors.notFound();

    const requiredPermission = ORDER_TRANSITIONS[order.status]?.[targetStatus];
    if (!requiredPermission) {
      if (TERMINAL_STATUSES.includes(order.status)) throw ordersErrors.terminalState(order.status);
      throw ordersErrors.invalidStatusTransition(order.status, targetStatus);
    }

    if (!this.rbacService.hasPermission(authState, requiredPermission)) {
      throw authErrors.forbidden({ requiredPermission, transition: `${order.status}->${targetStatus}` });
    }

    const updated = await this.ordersRepository.transitionStatus({
      orderId,
      expectedCurrentStatus: order.status,
      newStatus: targetStatus,
      changedByUserId: actorUserId,
      reason,
    });
    if (!updated) throw ordersErrors.statusConflict();

    await this.applyInventorySideEffects(updated, targetStatus, actorUserId);

    return { order: updated, previousStatus: order.status };
  }

  /// The sole entry point Payments uses to update Order.paymentStatus — an
  /// internal cross-module call, never HTTP-facing, so it takes no authState/
  /// permission check of its own: the caller (PaymentsService) has already
  /// gated the action (payments:update/payments:refund, or a verified
  /// webhook signature) before reaching here. Order.status is never touched.
  async updatePaymentStatus(orderId: string, newPaymentStatus: OrderPaymentStatus): Promise<OrderWithDetails | null> {
    return this.ordersRepository.updatePaymentStatus(orderId, newPaymentStatus);
  }

  /// The sole entry point Shipping uses to update Order.shipmentStatus —
  /// same shape and same rationale as updatePaymentStatus above: an
  /// internal cross-module call, never HTTP-facing, no authState/permission
  /// check of its own (ShipmentsService has already gated the action via
  /// shipping:update). Order.status is never touched.
  async updateShipmentStatus(orderId: string, newShipmentStatus: ShipmentStatus): Promise<OrderWithDetails | null> {
    return this.ordersRepository.updateShipmentStatus(orderId, newShipmentStatus);
  }

  /// The sole entry point Returns uses to advance Order.status into
  /// RETURNED/REFUNDED (Phase 4N) — an internal cross-module call, never
  /// HTTP-facing. Unlike updatePaymentStatus/updateShipmentStatus (which
  /// write a separate, unguarded column), this reuses the actual guarded
  /// transitionStatus primitive, not a raw column write, since Order.status
  /// itself is the field being advanced here — the OrderStatusHistory audit
  /// trail and the optimistic-concurrency guard both still apply.
  /// Deliberately bypasses ORDER_TRANSITIONS/TERMINAL_STATUSES (the staff-
  /// facing PATCH .../status endpoint's own gate, which intentionally
  /// excludes every transition into RETURNED/REFUNDED — "payment/returns-
  /// domain-driven, not built here" — see the comment above) since the
  /// caller (ReturnsService) has already gated the action via its own
  /// returns:update permission before reaching here.
  async transitionForReturns(
    orderId: string,
    actorUserId: string,
    expectedCurrentStatus: OrderStatus,
    newStatus: "RETURNED" | "REFUNDED",
    reason?: string,
  ): Promise<OrderWithDetails | null> {
    return this.ordersRepository.transitionStatus({
      orderId,
      expectedCurrentStatus,
      newStatus,
      changedByUserId: actorUserId,
      reason,
    });
  }

  /// Admin create-order (POST /admin/orders) — phone/WhatsApp/walk-in
  /// orders entered by staff on an existing customer's behalf. Structurally
  /// mirrors checkout.service.ts#checkout (resolve market -> validate lines
  /// against live catalog/price -> reserve inventory -> commit -> email)
  /// but with no cart to convert and no shipping-cost computation (an
  /// offline order has no storefront shipping-method choice). See the
  /// comment on buildAdminOrderLines/reserveAll/releaseAll below for why
  /// this duplicates rather than imports Checkout's own private helpers.
  async createAdminOrder(input: CreateAdminOrderInput): Promise<AdminOrderDetailRow> {
    const market = await this.ordersRepository.findActiveMarketByCode(input.market);
    if (!market) throw catalogErrors.notFound("Market");

    // Exactly one of userId/guestEmail is present (createAdminOrderBodySchema's
    // .refine guarantees it). A guest order has no User row at all — its
    // "customer" for confirmation-email purposes is the shipping address's
    // own fullName/the submitted guestEmail, never a fabricated account.
    let customerEmail: string;
    let customerFirstName: string;
    if (input.userId) {
      const customer = await this.ordersRepository.findCustomerById(input.userId);
      if (!customer) throw usersErrors.notFound();
      customerEmail = customer.email;
      customerFirstName = customer.firstName;
    } else {
      customerEmail = input.guestEmail!;
      customerFirstName = input.billingAddress.fullName;
    }

    const manualShippingMethod = await this.shippingMethodsRepository.findManualMethodByMarket(market.id);
    if (!manualShippingMethod) throw catalogErrors.notFound("Manual shipping method");

    const lines = await this.buildAdminOrderLines(input.lines, market);
    const subtotalAmount = computeSubtotal(lines);
    const totalAmount = subtotalAmount; // no shipping-cost concept for a manually-entered offline order

    // shipToDifferentAddress=false means the admin didn't enter a distinct
    // shipping address — the billing address is used for both.
    const shippingAddress = input.shipToDifferentAddress ? input.shippingAddress! : input.billingAddress;

    // Synthesized, not client-supplied — there is no retried-request header
    // on this path the way checkout.service.ts has Idempotency-Key, so a
    // fresh key is generated per call (one admin submission -> one order).
    const idempotencyKey = `admin:${randomUUID()}`;
    const reference = `checkout:${idempotencyKey}`; // same reference PREFIX applyInventorySideEffects expects below, regardless of source
    const reservedStockIds = await this.reserveAll(lines, market.id, reference);

    let created: AdminOrderDetailRow;
    try {
      created = await this.ordersRepository.createAdminOrder({
        userId: input.userId ?? null,
        guestEmail: input.userId ? null : input.guestEmail!,
        marketId: market.id,
        currencyCode: market.currencyCode,
        idempotencyKey,
        paymentMethod: input.paymentMethod,
        paymentStatus: input.paymentStatus,
        subtotalAmount,
        totalAmount,
        lines,
        billingAddress: input.billingAddress,
        shippingAddress,
        shippingMethodId: manualShippingMethod.id,
      });
    } catch (error) {
      await this.releaseAll(reservedStockIds, reference);
      throw error;
    }

    await sendOrderConfirmation({
      to: customerEmail,
      firstName: customerFirstName,
      orderNumber: created.orderNumber,
      totalAmount: created.totalAmount,
      currencyCode: created.currencyCode,
    });

    return created;
  }

  /// Re-validates every submitted line against CURRENT catalog/price state
  /// — the same rule checkout.service.ts#buildAndValidateLines applies to
  /// cart lines, here applied to the admin's typed-in product/variant/
  /// quantity rows instead. Reuses Cart's own variant-lookup repository
  /// method (CartRepository.findVariantForCart) and Pricing's own
  /// findPrice/resolveEffectivePrice — the same "services call peer-domain
  /// repositories directly" precedent Checkout itself already establishes,
  /// not a new cross-module repository access.
  private async buildAdminOrderLines(lines: CreateAdminOrderInput["lines"], market: Market): Promise<AdminOrderLineInput[]> {
    const resolved: AdminOrderLineInput[] = [];
    for (const line of lines) {
      const variant = await this.cartRepository.findVariantForCart(line.variantId, market.id);
      if (!variant || variant.productId !== line.productId) throw cartErrors.variantUnavailable();
      if (variant.status !== "ACTIVE" || variant.product.status !== "ACTIVE") throw cartErrors.variantUnavailable();
      if (!variant.marketAvailability?.isAvailable) throw cartErrors.variantUnavailable();

      let unitAmount = line.unitAmountOverride;
      if (unitAmount === undefined) {
        const price = await this.pricingRepository.findPrice(line.variantId, market.id);
        if (!price || !price.isActive) throw cartErrors.priceUnavailable();
        unitAmount = resolveEffectivePrice(price).effectiveAmount;
      }

      resolved.push({
        variantId: variant.id,
        productId: variant.productId,
        sku: variant.sku,
        productName: variant.product.name,
        variantName: variant.title,
        unitAmount,
        quantity: line.quantity,
        lineTotal: unitAmount * line.quantity,
        currencyCode: market.currencyCode,
      });
    }
    return resolved;
  }

  /// Structurally identical to checkout.service.ts#reserveAll — duplicated
  /// rather than imported because CheckoutService's own reserveAll/
  /// releaseAll are private implementation details of a different domain's
  /// service (not a shared, extractable public operation the way
  /// updatePaymentStatus/updateShipmentStatus are). If a third caller ever
  /// needs this exact reservation loop, extract it into a shared helper
  /// then (rule of three) — duplicating it a second time here is not a
  /// third violation of "no duplicate logic", it's the second copy.
  private async reserveAll(lines: AdminOrderLineInput[], marketId: string, reference: string): Promise<string[]> {
    const reservedStockIds: string[] = [];
    try {
      for (const line of lines) {
        const stock = await this.inventoryRepository.findByVariantAndMarket(line.variantId, marketId);
        if (!stock) throw new InsufficientStockError();
        await this.inventoryRepository.reserve(stock.id, line.quantity, reference);
        reservedStockIds.push(stock.id);
      }
      return reservedStockIds;
    } catch (error) {
      await this.releaseAll(reservedStockIds, reference);
      if (error instanceof InsufficientStockError) throw cartErrors.insufficientStock();
      throw error;
    }
  }

  private async releaseAll(stockIds: string[], reference: string): Promise<void> {
    for (const stockId of stockIds) {
      await this.inventoryRepository.release(stockId, reference);
    }
  }

  /// Items whose variantId is null (the source catalog row was deleted
  /// since checkout) are skipped — there is no stock row left to resolve,
  /// the same known limitation OrderItem's own snapshot design already
  /// accepts elsewhere.
  private async applyInventorySideEffects(
    order: OrderWithDetails,
    targetStatus: OrderStatus,
    actorUserId: string,
  ): Promise<void> {
    if (targetStatus !== "CANCELLED" && targetStatus !== "COMPLETED") return;

    const reference = `checkout:${order.idempotencyKey}`;
    for (const item of order.items) {
      if (!item.variantId) continue;
      const stock = await this.inventoryRepository.findByVariantAndMarket(item.variantId, order.marketId);
      if (!stock) continue;

      await this.inventoryRepository.release(stock.id, reference);
      if (targetStatus === "COMPLETED") {
        await this.inventoryRepository.adjust(stock.id, -item.quantity, `order:${order.orderNumber} completed`, actorUserId);
      }
    }
  }

  /// PATCH /admin/orders/:id — address and/or line-item edits. Only
  /// reachable while nothing real has happened to the order yet (see
  /// orderMutability.helper.ts) — becomes fully locked the instant a
  /// payment moves past PENDING, the shipment moves past PENDING, or a
  /// return is opened.
  async editAdmin(orderId: string, authState: AuthorizationState, input: EditAdminOrderInput): Promise<AdminOrderDetailRow> {
    if (!this.rbacService.hasPermission(authState, "orders:update")) {
      throw authErrors.forbidden({ requiredPermission: "orders:update" });
    }
    const order = await assertOrderIsMutable(orderId, this.ordersRepository);

    const reference = `checkout:${order.idempotencyKey}`;
    const market = order.market;

    let remainingLines = order.items.map((item) => ({
      id: item.id as string | null,
      variantId: item.variantId,
      productId: item.productId,
      sku: item.sku,
      productName: item.productName,
      variantName: item.variantName,
      unitAmount: item.unitAmount,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
      currencyCode: item.currencyCode,
    }));
    const itemUpdates: { id: string; quantity?: number; unitAmount?: number }[] = [];
    const itemRemovals: string[] = [];
    const itemAdditions: AdminOrderLineInput[] = [];

    if (input.items) {
      for (const edit of input.items) {
        if (edit.id && edit.remove) {
          const existing = remainingLines.find((line) => line.id === edit.id);
          if (!existing) throw ordersErrors.lineNotFound(edit.id);
          if (existing.variantId) {
            const stock = await this.inventoryRepository.findByVariantAndMarket(existing.variantId, market.id);
            if (stock) await this.inventoryRepository.release(stock.id, reference);
          }
          itemRemovals.push(edit.id);
          remainingLines = remainingLines.filter((line) => line.id !== edit.id);
        } else if (edit.id) {
          const existing = remainingLines.find((line) => line.id === edit.id);
          if (!existing) throw ordersErrors.lineNotFound(edit.id);
          const newQuantity = edit.quantity ?? existing.quantity;
          const newUnitAmount = edit.unitAmountOverride ?? existing.unitAmount;

          if (newQuantity !== existing.quantity && existing.variantId) {
            await this.applyQuantityDelta(existing.variantId, market.id, reference, existing.quantity, newQuantity);
          }

          itemUpdates.push({ id: edit.id, quantity: newQuantity, unitAmount: newUnitAmount });
          remainingLines = remainingLines.map((line) =>
            line.id === edit.id
              ? { ...line, quantity: newQuantity, unitAmount: newUnitAmount, lineTotal: newUnitAmount * newQuantity }
              : line,
          );
        } else {
          // New line: productId/variantId/quantity are guaranteed present by
          // editOrderLineSchema's own refine.
          if (remainingLines.some((line) => line.variantId === edit.variantId)) {
            throw ordersErrors.duplicateLineVariant(edit.variantId!);
          }
          const resolved = await this.resolveNewOrderLine(edit, market);
          await this.reserveNewLine(resolved, market.id, reference);
          itemAdditions.push(resolved);
          remainingLines.push({ id: null, ...resolved });
        }
      }
    }

    const subtotalAmount = computeSubtotal(remainingLines);
    const totalAmount = subtotalAmount + order.shippingAmount;

    return this.ordersRepository.applyAdminEdit({
      orderId,
      billingAddress: input.billingAddress,
      shippingAddress: input.shippingAddress,
      itemUpdates,
      itemRemovals,
      itemAdditions,
      subtotalAmount,
      totalAmount,
    });
  }

  /// DELETE /admin/orders/:id — a real hard delete, gated by the same
  /// "nothing has happened yet" rule as editAdmin. Releases every line's
  /// inventory reservation before the row itself is removed.
  async deleteAdmin(orderId: string, authState: AuthorizationState): Promise<void> {
    if (!this.rbacService.hasPermission(authState, "orders:delete")) {
      throw authErrors.forbidden({ requiredPermission: "orders:delete" });
    }
    const order = await assertOrderIsDeletable(orderId, this.ordersRepository);

    const reference = `checkout:${order.idempotencyKey}`;
    for (const item of order.items) {
      if (!item.variantId) continue;
      const stock = await this.inventoryRepository.findByVariantAndMarket(item.variantId, order.marketId);
      if (stock) await this.inventoryRepository.release(stock.id, reference);
    }

    await this.ordersRepository.hardDelete(orderId);
  }

  /// Release the old reservation then re-reserve the new quantity under the
  /// same (stockId, reference) — not atomic with the DB write that follows
  /// (Inventory's reserve/release each open their own internal transaction,
  /// confirmed in inventory.repository.ts; they cannot be nested inside the
  /// repository's own OrderItem/Order update transaction). This matches the
  /// same two-phase, non-atomic-but-compensated design checkout.service.ts
  /// already uses for its own reservation phase — not a new gap introduced
  /// by this feature.
  private async applyQuantityDelta(
    variantId: string,
    marketId: string,
    reference: string,
    oldQuantity: number,
    newQuantity: number,
  ): Promise<void> {
    const stock = await this.inventoryRepository.findByVariantAndMarket(variantId, marketId);
    if (!stock) return;
    await this.inventoryRepository.release(stock.id, reference);
    try {
      await this.inventoryRepository.reserve(stock.id, newQuantity, reference);
    } catch (error) {
      await this.inventoryRepository.reserve(stock.id, oldQuantity, reference); // best-effort restore
      if (error instanceof InsufficientStockError) throw cartErrors.insufficientStock();
      throw error;
    }
  }

  /// Re-validates a new line against the live catalog exactly like
  /// buildAdminOrderLines does for order creation — ACTIVE product+variant,
  /// market-available, live price unless unitAmountOverride is given.
  private async resolveNewOrderLine(edit: EditOrderLineInput, market: Market): Promise<AdminOrderLineInput> {
    const variant = await this.cartRepository.findVariantForCart(edit.variantId!, market.id);
    if (!variant || variant.productId !== edit.productId) throw cartErrors.variantUnavailable();
    if (variant.status !== "ACTIVE" || variant.product.status !== "ACTIVE") throw cartErrors.variantUnavailable();
    if (!variant.marketAvailability?.isAvailable) throw cartErrors.variantUnavailable();

    let unitAmount = edit.unitAmountOverride;
    if (unitAmount === undefined) {
      const price = await this.pricingRepository.findPrice(edit.variantId!, market.id);
      if (!price || !price.isActive) throw cartErrors.priceUnavailable();
      unitAmount = resolveEffectivePrice(price).effectiveAmount;
    }

    return {
      variantId: variant.id,
      productId: variant.productId,
      sku: variant.sku,
      productName: variant.product.name,
      variantName: variant.title,
      unitAmount,
      quantity: edit.quantity!,
      lineTotal: unitAmount * edit.quantity!,
      currencyCode: market.currencyCode,
    };
  }

  private async reserveNewLine(line: AdminOrderLineInput, marketId: string, reference: string): Promise<void> {
    const stock = await this.inventoryRepository.findByVariantAndMarket(line.variantId, marketId);
    if (!stock) throw new InsufficientStockError();
    try {
      await this.inventoryRepository.reserve(stock.id, line.quantity, reference);
    } catch (error) {
      if (error instanceof InsufficientStockError) throw cartErrors.insufficientStock();
      throw error;
    }
  }
}
