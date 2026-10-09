/**
 * Mirrors backend/src/modules/analytics/analytics.service.ts's DashboardData
 * verbatim. Revenue/order figures are always scoped to ONE market's own
 * stored currency — never summed across PK/AE (see docs/modules/ANALYTICS.md).
 */

export interface DashboardMarketFigures {
  marketCode: string;
  currencyCode: string;
  revenue: number;
  orderCount: number;
  averageOrderValue: number;
  /** null when the previous period had zero orders — never a fabricated percentage. */
  revenueTrendPct: number | null;
  salesOverTime: { day: string; revenue: number }[];
  topProducts: { productId: string | null; productName: string; quantitySold: number; revenue: number }[];
}

export interface DashboardLowStockItem {
  variantId: string;
  productName: string;
  sku: string;
  marketCode: string;
  onHand: number;
}

export interface DashboardRecentCustomer {
  id: string;
  name: string;
  email: string;
  orderCount: number;
  createdAt: string;
}

export interface AdminDashboardData {
  days: number;
  markets: DashboardMarketFigures[];
  orderStatusBreakdown: { status: string; count: number }[];
  lowStock: DashboardLowStockItem[];
  totalReturnedItems: number;
  productCount: number;
  customerCount: number;
  recentCustomers: DashboardRecentCustomer[];
}
