"use client";

import { useState } from "react";
import { ClipboardList, ShoppingBag, Wallet } from "lucide-react";
import { StatCard } from "./StatCard";
import { SalesOverTimeChart } from "./SalesOverTimeChart";
import { TopProductsList } from "./TopProductsList";
import { AdminFormSection } from "@/components/admin/AdminFormSection";
import { formatOrderMoney } from "@/lib/utils/adminOrderFormat";
import type { DashboardMarketFigures } from "@/lib/types/admin-dashboard";

interface MarketScopedSectionProps {
  markets: DashboardMarketFigures[];
  days: number;
}

/**
 * The one deliberate structural deviation from the Dashboard.png reference:
 * revenue/order figures are never summed across PK/AE (that would require an
 * invented FX rate — see docs/modules/ANALYTICS.md). Instead this renders a
 * local market tab, entirely client-side, over data already fetched once by
 * the server page — switching tabs never triggers a second request.
 */
export function MarketScopedSection({ markets, days }: MarketScopedSectionProps) {
  const [activeCode, setActiveCode] = useState(markets[0]?.marketCode);
  const active = markets.find((m) => m.marketCode === activeCode) ?? markets[0];

  if (!active) {
    return <p className="text-sm text-text-secondary">No active markets configured.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="scrollbar-thin flex items-center gap-2 overflow-x-auto pb-1">
        {markets.map((market) => (
          <button
            key={market.marketCode}
            type="button"
            onClick={() => setActiveCode(market.marketCode)}
            className={`shrink-0 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
              market.marketCode === active.marketCode
                ? "border-primary bg-primary text-white"
                : "border-border bg-surface text-text-secondary hover:bg-bg"
            }`}
          >
            {market.marketCode} · {market.currencyCode}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Wallet className="h-5 w-5 text-white" aria-hidden />}
          iconClassName="bg-primary"
          label="Total Sales"
          value={formatOrderMoney(active.revenue, active.currencyCode)}
          trendPct={active.revenueTrendPct}
          trendLabel={`vs. previous ${days} days`}
        />
        <StatCard
          icon={<ShoppingBag className="h-5 w-5 text-white" aria-hidden />}
          iconClassName="bg-accent-green"
          label="Total Orders"
          value={active.orderCount.toLocaleString("en-US")}
        />
        <StatCard
          icon={<ClipboardList className="h-5 w-5 text-white" aria-hidden />}
          iconClassName="bg-warning"
          label="Average Order Value"
          value={formatOrderMoney(active.averageOrderValue, active.currencyCode)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AdminFormSection
            title="Sales Overview"
            description={`${active.marketCode} revenue over the last ${days} days`}
          >
            <SalesOverTimeChart data={active.salesOverTime} currencyCode={active.currencyCode} />
          </AdminFormSection>
        </div>
        <AdminFormSection title="Top Selling Products" description={active.marketCode}>
          <TopProductsList products={active.topProducts} currencyCode={active.currencyCode} />
        </AdminFormSection>
      </div>
    </div>
  );
}
