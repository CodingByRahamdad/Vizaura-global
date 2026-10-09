import type {
  Market,
  Order,
  OrderAddress,
  OrderAddressType,
  OrderItem,
  OrderPaymentStatus,
  OrderStatus,
  OrderStatusHistory,
  Payment,
  Prisma,
  PrismaClient,
  Product,
  ProductMedia,
  Return,
  Shipment,
  ShipmentStatus,
  User,
} from "../../generated/prisma/client.js";
import { getPrismaClient } from "../../db/prismaClient.js";
import { generateOrderNumber } from "./orderNumber.js";
import type { ShippingAddressInput } from "../checkout/checkout.validators.js";

export type OrderWithDetails = Order & {
  items: OrderItem[];
  addresses: OrderAddress[];
  market: Market;
  statusHistory: OrderStatusHistory[];
};

export type OrderWithMarket = Order & { market: Market };

/// Product-level media only (variantId: null), same shape/ordering as
/// WishlistRepository's own product.media join — picking "the" thumbnail
/// (primary, falling back to first) is the mapper's job, not this query's.
export type OrderItemWithThumbnail = OrderItem & {
  product: (Product & { media: ProductMedia[] }) | null;
};
export type OwnOrderListRow = OrderWithMarket & { items: OrderItemWithThumbnail[] };

/// Admin views join the current User row (id/name/email only — never
/// passwordHash or any token/session data). Order has no customer-identity
/// snapshot columns, so this is the customer's live record, not a
/// point-in-time copy.
const adminUserSelect = { id: true, email: true, firstName: true, lastName: true } as const;

export type AdminOrderCustomer = Pick<User, "id" | "email" | "firstName" | "lastName">;

/// The list row's own minimal Payment/Shipment projection — just enough for
/// the Admin Orders list page's inline Payment/Shipment status dropdowns to
/// act on a row without a second fetch (id + whatever each dropdown's
/// action-mapping needs: Payment's provider, Shipment's current status).
/// Order is one-to-many with Payment but at most one is ever
/// AUTHORIZED/PAID at a time (see Payment's own doc comment) — `orderBy:
/// createdAt desc` picks the most recent attempt as "the" payment to show.
export type AdminOrderListPayment = Pick<Payment, "id" | "provider" | "status">;
export type AdminOrderListShipment = Pick<Shipment, "id" | "status">;

export type AdminOrderSummaryRow = Order & {
  market: Market;
  user: AdminOrderCustomer | null;
  addresses: { type: OrderAddressType; fullName: string }[];
  payments: AdminOrderListPayment[];
  shipment: AdminOrderListShipment | null;
};

export type AdminOrderDetailRow = OrderWithDetails & {
  user: AdminOrderCustomer | null;
  payments: Payment[];
  shipment: (Shipment & { shippingMethod: { name: string } }) | null;
  returns: Return[];
};

const orderWithDetailsInclude = {
  items: true,
  addresses: true,
  market: true,
  statusHistory: { orderBy: { createdAt: "asc" as const } },
};

const adminOrderDetailInclude = {
  ...orderWithDetailsInclude,
  user: { select: adminUserSelect },
  payments: { orderBy: { createdAt: "asc" as const } },
  shipment: { include: { shippingMethod: { select: { name: true } } } },
  returns: { orderBy: { createdAt: "asc" as const } },
};

export interface AdminOrderFilters {
  status?: OrderStatus;
  paymentStatus?: OrderPaymentStatus;
  shipmentStatus?: ShipmentStatus;
  marketId?: string;
  userId?: string;
  orderNumber?: string;
  /// Case-insensitive substring match on order number, customer email, or
  /// customer first/last name.
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface OwnOrderFilters {
  userId: string;
  status?: OrderStatus;
  dateFrom?: Date;
  dateTo?: Date;
}

/// Same shape as checkout.repository.ts's OrderLineInput — kept as a
/// separate local type rather than importing Checkout's (Checkout owns
/// online order creation only; Orders owns its own admin create-order path,
/// see docs/modules/ORDERS.md's module boundary note at the top of
/// schema.prisma's Order model).
export interface AdminOrderLineInput {
  variantId: string;
  productId: string;
  sku: string;
  productName: string;
  variantName: string;
  unitAmount: number;
  quantity: number;
  lineTotal: number;
  currencyCode: string;
}

export interface CreateAdminOrderParams {
  userId: string | null;
  guestEmail: string | null;
  marketId: string;
  currencyCode: string;
  idempotencyKey: string;
  paymentMethod: string;
  paymentStatus: OrderPaymentStatus;
  subtotalAmount: number;
  totalAmount: number;
  lines: AdminOrderLineInput[];
  billingAddress: ShippingAddressInput;
  shippingAddress: ShippingAddressInput;
  shippingMethodId: string;
}

const listOrderBy: Prisma.OrderOrderByWithRelationInput[] = [{ createdAt: "desc" }, { id: "desc" }];

export class OrdersRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async findById(id: string): Promise<OrderWithDetails | null> {
    return this.prisma.order.findUnique({ where: { id }, include: orderWithDetailsInclude });
  }

  async listOwn(
    filters: OwnOrderFilters,
    skip: number,
    take: number,
  ): Promise<{ orders: OwnOrderListRow[]; total: number }> {
    const where: Prisma.OrderWhereInput = { userId: filters.userId };
    if (filters.status) where.status = filters.status;
    const dateRange = this.dateRangeFilter(filters.dateFrom, filters.dateTo);
    if (dateRange) where.placedAt = dateRange;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: listOrderBy,
        skip,
        take,
        include: {
          market: true,
          // Only the first item — this backs a single thumbnail per order
          // row, not a full item list (OrderDetailView already covers that).
          items: {
            take: 1,
            orderBy: { createdAt: "asc" },
            include: {
              product: {
                include: { media: { where: { variantId: null }, orderBy: { position: "asc" } } },
              },
            },
          },
        },
      }),
      this.prisma.order.count({ where }),
    ]);
    return { orders, total };
  }

  async listAdmin(
    filters: AdminOrderFilters,
    skip: number,
    take: number,
  ): Promise<{ orders: AdminOrderSummaryRow[]; total: number }> {
    const where: Prisma.OrderWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.paymentStatus) where.paymentStatus = filters.paymentStatus;
    if (filters.shipmentStatus) where.shipmentStatus = filters.shipmentStatus;
    if (filters.marketId) where.marketId = filters.marketId;
    if (filters.userId) where.userId = filters.userId;
    if (filters.orderNumber) where.orderNumber = filters.orderNumber;
    if (filters.search) {
      const contains = { contains: filters.search, mode: "insensitive" as const };
      where.OR = [
        { orderNumber: contains },
        { user: { email: contains } },
        { user: { firstName: contains } },
        { user: { lastName: contains } },
        { guestEmail: contains },
      ];
    }
    const dateRange = this.dateRangeFilter(filters.dateFrom, filters.dateTo);
    if (dateRange) where.placedAt = dateRange;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: listOrderBy,
        skip,
        take,
        include: {
          market: true,
          user: { select: adminUserSelect },
          // Guest orders have no `user` — fall back to the shipping-address
          // snapshot's fullName for display (see orders.mapper.ts#toCustomerView).
          addresses: { select: { type: true, fullName: true } },
          payments: { select: { id: true, provider: true, status: true }, orderBy: { createdAt: "desc" }, take: 1 },
          shipment: { select: { id: true, status: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);
    return { orders, total };
  }

  async findAdminDetailById(id: string): Promise<AdminOrderDetailRow | null> {
    return this.prisma.order.findUnique({ where: { id }, include: adminOrderDetailInclude });
  }

  /// Not restricted to isActive — an admin filtering historical orders by
  /// market should still be able to select a since-deactivated market.
  async findMarketByCode(code: string): Promise<Market | null> {
    return this.prisma.market.findFirst({ where: { code } });
  }

  /// Used only by the admin create-order flow — an offline order must be
  /// placed into a currently-active market, the same "closed business
  /// boundary" rule Checkout/Pricing/Inventory/Cart already apply.
  /// Duplicated per-module lookup, same established precedent as those.
  async findActiveMarketByCode(code: string): Promise<Market | null> {
    return this.prisma.market.findFirst({ where: { code, isActive: true } });
  }

  /// Used only by the admin create-order flow to resolve the customer an
  /// offline order is placed for. Direct User read (id/email/firstName/
  /// lastName only) — the same allowlisted shape already used for
  /// adminUserSelect above, never passwordHash/tokens.
  async findCustomerById(userId: string): Promise<AdminOrderCustomer | null> {
    return this.prisma.user.findUnique({ where: { id: userId }, select: adminUserSelect });
  }

  /// The admin create-order commit point (POST /admin/orders) — structurally
  /// mirrors checkout.repository.ts#convertCartAndCreateOrder but with no
  /// cart to convert/guard, `source: "OFFLINE"` set explicitly, and
  /// `paymentStatus` taken directly from the admin's input (offline orders
  /// are frequently already paid at entry) rather than always PENDING. The
  /// Payment row uses provider "MANUAL" (see payments.service.ts's
  /// requireCodPayment, extended to also accept this provider) and sets
  /// paidAt immediately if already PAID — this is the order's initial
  /// state, not a transition, so it legitimately bypasses the Payments
  /// service's own mark-paid flow.
  async createAdminOrder(params: CreateAdminOrderParams): Promise<AdminOrderDetailRow> {
    return this.prisma.$transaction(async (tx) => {
      const orderNumber = await generateOrderNumber(tx);

      const order = await tx.order.create({
        data: {
          orderNumber,
          userId: params.userId,
          guestEmail: params.guestEmail,
          marketId: params.marketId,
          currencyCode: params.currencyCode,
          paymentMethod: params.paymentMethod,
          paymentStatus: params.paymentStatus,
          source: "OFFLINE",
          subtotalAmount: params.subtotalAmount,
          totalAmount: params.totalAmount,
          idempotencyKey: params.idempotencyKey,
          items: {
            create: params.lines.map((line) => ({
              variantId: line.variantId,
              productId: line.productId,
              sku: line.sku,
              productName: line.productName,
              variantName: line.variantName,
              unitAmount: line.unitAmount,
              quantity: line.quantity,
              lineTotal: line.lineTotal,
              currencyCode: line.currencyCode,
            })),
          },
          addresses: {
            create: [
              { type: "BILLING", ...params.billingAddress },
              { type: "SHIPPING", ...params.shippingAddress },
            ],
          },
        },
      });

      await tx.payment.create({
        data: {
          orderId: order.id,
          provider: "MANUAL",
          method: params.paymentMethod,
          status: params.paymentStatus,
          amount: params.totalAmount,
          currencyCode: params.currencyCode,
          idempotencyKey: `payment:${params.idempotencyKey}`,
          paidAt: params.paymentStatus === "PAID" ? new Date() : null,
        },
      });

      await tx.shipment.create({
        data: {
          orderId: order.id,
          shippingMethodId: params.shippingMethodId,
          status: "PENDING",
        },
      });

      return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: adminOrderDetailInclude });
    });
  }

  /// One transaction: a guarded UPDATE settles which concurrent request
  /// "wins" this transition (WHERE status = expectedCurrentStatus, same
  /// pattern as CheckoutRepository.convertCartAndCreateOrder's cart-status
  /// guard), then appends the OrderStatusHistory row. Returns `null` on 0
  /// rows — the caller (orders.service.ts) treats that as a conflict; no
  /// inventory side effect has happened yet at that point, so nothing needs
  /// compensating.
  async transitionStatus(params: {
    orderId: string;
    expectedCurrentStatus: OrderStatus;
    newStatus: OrderStatus;
    changedByUserId: string;
    reason?: string;
  }): Promise<OrderWithDetails | null> {
    return this.prisma.$transaction(async (tx) => {
      const guarded = await tx.$queryRaw<{ id: string }[]>`
        UPDATE orders SET status = ${params.newStatus}::"OrderStatus", "updatedAt" = now()
        WHERE id = ${params.orderId}::uuid AND status = ${params.expectedCurrentStatus}::"OrderStatus"
        RETURNING id
      `;
      if (guarded.length === 0) return null;

      await tx.orderStatusHistory.create({
        data: {
          orderId: params.orderId,
          previousStatus: params.expectedCurrentStatus,
          newStatus: params.newStatus,
          changedByUserId: params.changedByUserId,
          reason: params.reason,
        },
      });

      return tx.order.findUniqueOrThrow({ where: { id: params.orderId }, include: orderWithDetailsInclude });
    });
  }

  /// Payments' sole write path to Order.paymentStatus — OrdersService.updateStatus
  /// never touches this column, so there's no cross-domain race to guard
  /// against with an expectedCurrentStatus (unlike transitionStatus above).
  /// The race that matters (which Payment attempt "wins") is already
  /// resolved by Payment.status's own guarded update and the partial unique
  /// index on payments(orderId) WHERE status IN ('AUTHORIZED','PAID').
  async updatePaymentStatus(orderId: string, newPaymentStatus: OrderPaymentStatus): Promise<OrderWithDetails | null> {
    const guarded = await this.prisma.$queryRaw<{ id: string }[]>`
      UPDATE orders SET "paymentStatus" = ${newPaymentStatus}::"OrderPaymentStatus", "updatedAt" = now()
      WHERE id = ${orderId}::uuid
      RETURNING id
    `;
    if (guarded.length === 0) return null;
    return this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: orderWithDetailsInclude });
  }

  /// Shipping's sole write path to Order.shipmentStatus (Phase 4M) — the
  /// exact same unpermissioned-passthrough shape as updatePaymentStatus
  /// above, for the same reason: OrdersService.updateStatus never touches
  /// this column, so there's no cross-domain race to guard with an
  /// expectedCurrentStatus. The race that matters (which shipment-status
  /// write "wins") is already resolved by Shipment.status's own guarded
  /// update, and a Shipment is one-to-one with an Order (orderId @unique),
  /// so there's no multi-shipment race to worry about either.
  async updateShipmentStatus(orderId: string, newShipmentStatus: ShipmentStatus): Promise<OrderWithDetails | null> {
    const guarded = await this.prisma.$queryRaw<{ id: string }[]>`
      UPDATE orders SET "shipmentStatus" = ${newShipmentStatus}::"ShipmentStatus", "updatedAt" = now()
      WHERE id = ${orderId}::uuid
      RETURNING id
    `;
    if (guarded.length === 0) return null;
    return this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: orderWithDetailsInclude });
  }

  /// Batched per-customer order stats (Phase 6M's Customers module) — one
  /// groupBy across every id in the page, never a per-row query (same
  /// batched-read discipline as Pricing/Inventory's findByVariantIds).
  /// Grouped by currencyCode too: a customer's spend is never summed across
  /// PK/AE, since that would require an invented FX rate.
  async getStatsByUserIds(
    userIds: string[],
  ): Promise<Map<string, { orderCount: number; totalSpent: { currencyCode: string; amount: number }[] }>> {
    if (userIds.length === 0) return new Map();

    const grouped = await this.prisma.order.groupBy({
      by: ["userId", "currencyCode"],
      where: { userId: { in: userIds } },
      _count: { _all: true },
      _sum: { totalAmount: true },
    });

    const stats = new Map<string, { orderCount: number; totalSpent: { currencyCode: string; amount: number }[] }>();
    for (const row of grouped) {
      // row.userId is typed string | null because the column is nullable
      // (guest orders) — the `where: { userId: { in: userIds } }` filter
      // above means a guest order (null) can never actually appear here.
      if (row.userId === null) continue;
      const entry = stats.get(row.userId) ?? { orderCount: 0, totalSpent: [] };
      entry.orderCount += row._count._all;
      entry.totalSpent.push({ currencyCode: row.currencyCode, amount: row._sum.totalAmount ?? 0 });
      stats.set(row.userId, entry);
    }
    return stats;
  }

  /// PATCH /admin/orders/:id commit point. All address/item/total changes
  /// for one edit happen in a single transaction — unlike the inventory
  /// reservation calls that precede this (see orders.service.ts#editAdmin's
  /// own comment on why those can't be nested here).
  async applyAdminEdit(params: {
    orderId: string;
    billingAddress?: ShippingAddressInput;
    shippingAddress?: ShippingAddressInput;
    itemUpdates: { id: string; quantity?: number; unitAmount?: number }[];
    itemRemovals: string[];
    itemAdditions: AdminOrderLineInput[];
    subtotalAmount: number;
    totalAmount: number;
  }): Promise<AdminOrderDetailRow> {
    return this.prisma.$transaction(async (tx) => {
      if (params.billingAddress) {
        await tx.orderAddress.update({
          where: { orderId_type: { orderId: params.orderId, type: "BILLING" } },
          data: params.billingAddress,
        });
      }
      if (params.shippingAddress) {
        await tx.orderAddress.update({
          where: { orderId_type: { orderId: params.orderId, type: "SHIPPING" } },
          data: params.shippingAddress,
        });
      }

      for (const removal of params.itemRemovals) {
        await tx.orderItem.delete({ where: { id: removal } });
      }
      for (const update of params.itemUpdates) {
        const data: Prisma.OrderItemUpdateInput = {};
        if (update.quantity !== undefined) data.quantity = update.quantity;
        if (update.unitAmount !== undefined) data.unitAmount = update.unitAmount;
        if (update.quantity !== undefined || update.unitAmount !== undefined) {
          const current = await tx.orderItem.findUniqueOrThrow({ where: { id: update.id } });
          data.lineTotal = (update.unitAmount ?? current.unitAmount) * (update.quantity ?? current.quantity);
        }
        await tx.orderItem.update({ where: { id: update.id }, data });
      }
      if (params.itemAdditions.length > 0) {
        await tx.orderItem.createMany({
          data: params.itemAdditions.map((line) => ({
            orderId: params.orderId,
            variantId: line.variantId,
            productId: line.productId,
            sku: line.sku,
            productName: line.productName,
            variantName: line.variantName,
            unitAmount: line.unitAmount,
            quantity: line.quantity,
            lineTotal: line.lineTotal,
            currencyCode: line.currencyCode,
          })),
        });
      }

      await tx.order.update({
        where: { id: params.orderId },
        data: { subtotalAmount: params.subtotalAmount, totalAmount: params.totalAmount },
      });

      return tx.order.findUniqueOrThrow({ where: { id: params.orderId }, include: adminOrderDetailInclude });
    });
  }

  /// DELETE /admin/orders/:id commit point — only called once
  /// orderMutability.helper.ts#assertOrderIsDeletable has confirmed the
  /// order is safe to remove entirely. Payment/Shipment use onDelete:
  /// Restrict on their orderId FK, so they must be deleted explicitly
  /// before the Order row itself; OrderItem/OrderAddress(x2)/
  /// OrderStatusHistory use onDelete: Cascade and are removed automatically.
  /// Return also uses onDelete: Restrict, but the eligibility gate already
  /// guarantees none exists, so no explicit Return delete is needed here.
  async hardDelete(orderId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.deleteMany({ where: { orderId } });
      await tx.shipment.deleteMany({ where: { orderId } });
      await tx.order.delete({ where: { id: orderId } });
    });
  }

  private dateRangeFilter(from?: Date, to?: Date): Prisma.DateTimeFilter | undefined {
    if (!from && !to) return undefined;
    return { gte: from, lte: to };
  }
}
