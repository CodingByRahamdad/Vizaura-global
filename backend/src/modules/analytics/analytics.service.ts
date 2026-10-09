import { AnalyticsRepository } from "./analytics.repository.js";
import type { DashboardQuery } from "./analytics.validators.js";

const DEFAULT_DAYS = 30;
const LIST_LIMIT = 5;
const LOW_STOCK_THRESHOLD = 10;

export interface MarketFigures {
  marketCode: string;
  currencyCode: string;
  revenue: number;
  orderCount: number;
  averageOrderValue: number;
  /// null when the previous window had zero orders — never a fabricated
  /// divide-by-zero percentage.
  revenueTrendPct: number | null;
  salesOverTime: { day: string; revenue: number }[];
  topProducts: { productId: string | null; productName: string; quantitySold: number; revenue: number }[];
}

export interface DashboardData {
  days: number;
  markets: MarketFigures[];
  orderStatusBreakdown: { status: string; count: number }[];
  lowStock: {
    variantId: string;
    productName: string;
    sku: string;
    marketCode: string;
    onHand: number;
  }[];
  totalReturnedItems: number;
  productCount: number;
  customerCount: number;
  recentCustomers: {
    id: string;
    name: string;
    email: string;
    orderCount: number;
    createdAt: string;
  }[];
}

export class AnalyticsService {
  constructor(private readonly analyticsRepository: AnalyticsRepository = new AnalyticsRepository()) {}

  /// Assembles the whole dashboard payload from real aggregates only — see
  /// docs/modules/ANALYTICS.md for why revenue is always per-market and
  /// never summed across currencies, and why there is no "conversion rate"
  /// metric (no traffic/session analytics exists in this codebase).
  async getDashboard(query: DashboardQuery): Promise<DashboardData> {
    const days = query.days ?? DEFAULT_DAYS;
    const now = new Date();
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const previousSince = new Date(since.getTime() - days * 24 * 60 * 60 * 1000);

    const markets = await this.analyticsRepository.listActiveMarkets();

    const marketFigures = await Promise.all(
      markets.map(async (market): Promise<MarketFigures> => {
        const [current, previous, salesOverTime, topProducts] = await Promise.all([
          this.analyticsRepository.revenueWindow(market.id, since, now),
          this.analyticsRepository.revenueWindow(market.id, previousSince, since),
          this.analyticsRepository.salesOverTime(market.id, since),
          this.analyticsRepository.topProducts(market.id, since, LIST_LIMIT),
        ]);

        const revenueTrendPct =
          previous.revenue > 0 ? ((current.revenue - previous.revenue) / previous.revenue) * 100 : null;

        return {
          marketCode: market.code,
          currencyCode: market.currencyCode,
          revenue: current.revenue,
          orderCount: current.orderCount,
          averageOrderValue: current.orderCount > 0 ? Math.round(current.revenue / current.orderCount) : 0,
          revenueTrendPct,
          salesOverTime,
          topProducts,
        };
      }),
    );

    const lowStockRows = await Promise.all(
      markets.map((market) => this.analyticsRepository.lowStock(market.id, LOW_STOCK_THRESHOLD, LIST_LIMIT)),
    );
    const lowStock = lowStockRows
      .flat()
      .sort((a, b) => a.onHand - b.onHand)
      .slice(0, LIST_LIMIT)
      .map((row) => ({
        variantId: row.variant.id,
        productName: row.variant.product.name,
        sku: row.variant.sku,
        marketCode: markets.find((m) => m.id === row.marketId)?.code ?? "",
        onHand: row.onHand,
      }));

    const [orderStatusBreakdown, totalReturnedItems, productCount, customerCount, recentCustomers] =
      await Promise.all([
        this.analyticsRepository.orderStatusBreakdown(since),
        this.analyticsRepository.totalReturnedItems(),
        this.analyticsRepository.productCount(),
        this.analyticsRepository.customerCount(),
        this.analyticsRepository.recentCustomers(LIST_LIMIT),
      ]);

    return {
      days,
      markets: marketFigures,
      orderStatusBreakdown,
      lowStock,
      totalReturnedItems,
      productCount,
      customerCount,
      recentCustomers: recentCustomers.map((customer) => ({
        id: customer.id,
        name: `${customer.firstName} ${customer.lastName}`.trim(),
        email: customer.email,
        orderCount: customer.orderCount,
        createdAt: customer.createdAt.toISOString(),
      })),
    };
  }
}
