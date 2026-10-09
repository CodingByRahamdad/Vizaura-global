import type { Market, OrderStatus, PrismaClient } from "../../generated/prisma/client.js";
import { getPrismaClient } from "../../db/prismaClient.js";

/// Read-only aggregation queries backing the admin dashboard (Phase 6H).
/// Every method is a Prisma aggregate/groupBy/count or a bounded, ordered,
/// take-limited read — never a full-table load into application memory.
/// Money stays in each market's own minor-unit currency throughout; nothing
/// here ever sums two markets' amounts together (see docs/modules/ANALYTICS.md).

const NON_REVENUE_STATUSES: OrderStatus[] = ["FAILED", "CANCELLED"];

export interface RevenueWindow {
  revenue: number;
  orderCount: number;
}

export interface DayBucket {
  day: string;
  revenue: number;
}

export interface TopProductRow {
  productId: string | null;
  productName: string;
  quantitySold: number;
  revenue: number;
}

export class AnalyticsRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async listActiveMarkets(): Promise<Market[]> {
    return this.prisma.market.findMany({ where: { isActive: true }, orderBy: { code: "asc" } });
  }

  async revenueWindow(marketId: string, from: Date, to: Date): Promise<RevenueWindow> {
    const result = await this.prisma.order.aggregate({
      _sum: { totalAmount: true },
      _count: true,
      where: { marketId, placedAt: { gte: from, lt: to }, status: { notIn: NON_REVENUE_STATUSES } },
    });
    return { revenue: result._sum.totalAmount ?? 0, orderCount: result._count };
  }

  async orderStatusBreakdown(since: Date): Promise<{ status: OrderStatus; count: number }[]> {
    const rows = await this.prisma.order.groupBy({
      by: ["status"],
      _count: true,
      where: { placedAt: { gte: since } },
    });
    return rows.map((row) => ({ status: row.status, count: row._count }));
  }

  /// Day-bucketed revenue for one market — parameterized raw SQL (no
  /// string-interpolated input), same pattern already used for guarded
  /// updates in inventory.repository.ts/payments.repository.ts. Prisma has
  /// no groupBy-by-date-truncation, hence the raw query.
  async salesOverTime(marketId: string, since: Date): Promise<DayBucket[]> {
    const rows = await this.prisma.$queryRaw<{ day: Date; revenue: bigint | null }[]>`
      SELECT date_trunc('day', "placedAt") AS day, SUM("totalAmount") AS revenue
      FROM orders
      WHERE "marketId" = ${marketId}
        AND "placedAt" >= ${since}
        AND status NOT IN ('FAILED', 'CANCELLED')
      GROUP BY day
      ORDER BY day ASC
    `;
    return rows.map((row) => ({ day: row.day.toISOString().slice(0, 10), revenue: Number(row.revenue ?? 0) }));
  }

  /// Uses OrderItem's own immutable productName snapshot — correct even for
  /// since-deleted products, no join/N+1 needed.
  async topProducts(marketId: string, since: Date, limit: number): Promise<TopProductRow[]> {
    const rows = await this.prisma.orderItem.groupBy({
      by: ["productId", "productName"],
      _sum: { quantity: true, lineTotal: true },
      where: { order: { marketId, placedAt: { gte: since }, status: { notIn: NON_REVENUE_STATUSES } } },
      orderBy: { _sum: { quantity: "desc" } },
      take: limit,
    });
    return rows.map((row) => ({
      productId: row.productId,
      productName: row.productName,
      quantitySold: row._sum.quantity ?? 0,
      revenue: row._sum.lineTotal ?? 0,
    }));
  }

  async lowStock(marketId: string, threshold: number, limit: number) {
    return this.prisma.variantStock.findMany({
      where: { marketId, onHand: { lt: threshold } },
      orderBy: { onHand: "asc" },
      take: limit,
      include: { variant: { include: { product: true } } },
    });
  }

  async customerCount(): Promise<number> {
    return this.prisma.user.count({
      where: { deletedAt: null, roles: { some: { role: { key: "customer" } } } },
    });
  }

  async productCount(): Promise<number> {
    return this.prisma.product.count({ where: { deletedAt: null } });
  }

  async totalReturnedItems(): Promise<number> {
    const result = await this.prisma.returnItem.aggregate({
      _sum: { quantity: true },
      where: { return: { status: { in: ["RECEIVED", "REFUNDED"] } } },
    });
    return result._sum.quantity ?? 0;
  }

  async recentCustomers(limit: number) {
    const customers = await this.prisma.user.findMany({
      where: { deletedAt: null, roles: { some: { role: { key: "customer" } } } },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, firstName: true, lastName: true, email: true, createdAt: true },
    });
    if (customers.length === 0) return [];

    const orderCounts = await this.prisma.order.groupBy({
      by: ["userId"],
      _count: true,
      where: { userId: { in: customers.map((c) => c.id) } },
    });
    const countByUserId = new Map(orderCounts.map((row) => [row.userId, row._count]));

    return customers.map((customer) => ({ ...customer, orderCount: countByUserId.get(customer.id) ?? 0 }));
  }
}
