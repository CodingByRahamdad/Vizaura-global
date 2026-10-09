import type { Order, OrderItem, PrismaClient, Return, ReturnItem, ReturnStatus } from "../../generated/prisma/client.js";
import { getPrismaClient } from "../../db/prismaClient.js";

export type ReturnWithItems = Return & { items: ReturnItem[] };
export type OrderWithItems = Order & { items: OrderItem[] };

const returnWithItemsInclude = { items: true };

export interface AdminReturnFilters {
  status?: ReturnStatus;
  orderId?: string;
}

const listOrderBy = [{ createdAt: "desc" as const }, { id: "desc" as const }];

export class ReturnsRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async findById(id: string): Promise<ReturnWithItems | null> {
    return this.prisma.return.findUnique({ where: { id }, include: returnWithItemsInclude });
  }

  async findByOrderId(orderId: string): Promise<ReturnWithItems[]> {
    return this.prisma.return.findMany({ where: { orderId }, include: returnWithItemsInclude, orderBy: listOrderBy });
  }

  async listAdmin(
    filters: AdminReturnFilters,
    skip: number,
    take: number,
  ): Promise<{ returns: ReturnWithItems[]; total: number }> {
    const where = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.orderId ? { orderId: filters.orderId } : {}),
    };

    const [returns, total] = await Promise.all([
      this.prisma.return.findMany({ where, include: returnWithItemsInclude, orderBy: listOrderBy, skip, take }),
      this.prisma.return.count({ where }),
    ]);
    return { returns, total };
  }

  /// Order lookup duplicated here rather than importing OrdersRepository —
  /// the same established "read the shared table directly" precedent
  /// Checkout/Payments/Shipping each already carry for cross-domain reads.
  async findOrderWithItems(orderId: string): Promise<OrderWithItems | null> {
    return this.prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  }

  /// Sum of quantities already claimed by any non-REJECTED Return, per
  /// orderItemId — enforces "returned <= ordered - previously returned"
  /// across sequential returns. Concurrent *overlapping* returns are
  /// already excluded structurally by the open-return partial unique index
  /// (see create()), so this plain read-time sum is sufficient — no row
  /// locking needed here.
  async sumReturnedQuantities(orderItemIds: string[]): Promise<Map<string, number>> {
    if (orderItemIds.length === 0) return new Map();
    const rows = await this.prisma.returnItem.findMany({
      where: { orderItemId: { in: orderItemIds }, return: { status: { not: "REJECTED" } } },
      select: { orderItemId: true, quantity: true },
    });
    const sums = new Map<string, number>();
    for (const row of rows) {
      sums.set(row.orderItemId, (sums.get(row.orderItemId) ?? 0) + row.quantity);
    }
    return sums;
  }

  /// One transaction: the Return row, then its ReturnItem rows. The
  /// `returns_orderId_open_unique` partial index (hand-added — see the
  /// migration) is the concurrency guard for "at most one open return per
  /// order" — a second, overlapping open-return attempt hits it and
  /// surfaces as a caught unique-violation (see returns.service.ts), not a
  /// race between a read and a write.
  async create(params: {
    orderId: string;
    requestedByUserId: string;
    reason?: string;
    items: { orderItemId: string; quantity: number }[];
  }): Promise<ReturnWithItems> {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.return.create({
        data: { orderId: params.orderId, requestedByUserId: params.requestedByUserId, reason: params.reason },
      });
      await tx.returnItem.createMany({
        data: params.items.map((item) => ({
          returnId: created.id,
          orderItemId: item.orderItemId,
          quantity: item.quantity,
        })),
      });
      return tx.return.findUniqueOrThrow({ where: { id: created.id }, include: returnWithItemsInclude });
    });
  }

  /// Guarded UPDATE — same template as Orders/Payments/Shipping's own
  /// transitionStatus/updateStatus. Returns null on 0 rows (a concurrent
  /// request already moved this return away from expectedCurrentStatus);
  /// the caller decides what that means (409 for the HTTP caller).
  async transitionStatus(params: {
    returnId: string;
    expectedCurrentStatus: ReturnStatus;
    newStatus: ReturnStatus;
    reviewedByUserId?: string;
    rejectionReason?: string;
    refundAmount?: number;
  }): Promise<ReturnWithItems | null> {
    const now = new Date();
    const reviewedAt = params.newStatus === "APPROVED" || params.newStatus === "REJECTED" ? now : null;
    const receivedAt = params.newStatus === "RECEIVED" ? now : null;
    const refundedAt = params.newStatus === "REFUNDED" ? now : null;

    const guarded = await this.prisma.$queryRaw<{ id: string }[]>`
      UPDATE returns SET
        status = ${params.newStatus}::"ReturnStatus",
        "reviewedByUserId" = COALESCE(${params.reviewedByUserId ?? null}::uuid, "reviewedByUserId"),
        "rejectionReason" = COALESCE(${params.rejectionReason ?? null}, "rejectionReason"),
        "refundAmount" = COALESCE(${params.refundAmount ?? null}, "refundAmount"),
        "reviewedAt" = COALESCE(${reviewedAt}::timestamp, "reviewedAt"),
        "receivedAt" = COALESCE(${receivedAt}::timestamp, "receivedAt"),
        "refundedAt" = COALESCE(${refundedAt}::timestamp, "refundedAt"),
        "updatedAt" = now()
      WHERE id = ${params.returnId}::uuid AND status = ${params.expectedCurrentStatus}::"ReturnStatus"
      RETURNING id
    `;
    if (guarded.length === 0) return null;
    return this.prisma.return.findUniqueOrThrow({ where: { id: params.returnId }, include: returnWithItemsInclude });
  }
}
