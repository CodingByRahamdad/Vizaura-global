import { formatOrderMoney } from "@/lib/utils/adminOrderFormat";
import type { DashboardMarketFigures } from "@/lib/types/admin-dashboard";

interface MarketSplitPanelProps {
  markets: DashboardMarketFigures[];
}

const BAR_COLORS = ["bg-primary", "bg-warning"];

/**
 * Shows every market's own revenue/orders side by side, each in its own
 * currency — the honest replacement for the reference's single mixed-
 * currency donut (see docs/modules/ANALYTICS.md). The progress bar compares
 * ORDER COUNT share (currency-agnostic), never a revenue percentage-of-total.
 */
export function MarketSplitPanel({ markets }: MarketSplitPanelProps) {
  const totalOrders = markets.reduce((sum, m) => sum + m.orderCount, 0);

  return (
    <div className="flex flex-col gap-4">
      {markets.map((market, index) => {
        const share = totalOrders > 0 ? (market.orderCount / totalOrders) * 100 : 0;
        return (
          <div key={market.marketCode}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium text-text">
                {market.marketCode} · {market.currencyCode}
              </span>
              <span className="text-text-secondary">
                {formatOrderMoney(market.revenue, market.currencyCode)} · {market.orderCount} orders
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-bg">
              <div
                className={`h-full rounded-full ${BAR_COLORS[index % BAR_COLORS.length]}`}
                style={{ width: `${share}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-text-secondary">{share.toFixed(0)}% of order volume</p>
          </div>
        );
      })}
      <p className="text-xs text-text-secondary">
        Figures are shown per market in their own currency and are never combined into one total.
      </p>
    </div>
  );
}
