"use client";

import { Heart, Tag, Globe2 } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { useMarket } from "@/context/MarketContext";
import type { MarketCode } from "@/lib/constants/market";

/**
 * In-page market strip (spec §18) — thin presentational wrapper over the
 * same useMarket()/setMarket() the header's MarketSwitcher already drives,
 * so switching here triggers the identical cookie-write + router.refresh()
 * flow. No new data: marketOptions comes from the same backend-driven list
 * (GET /markets) the header uses.
 */
export function MarketSelectorStrip() {
  const { marketCode, marketOptions, setMarket } = useMarket();

  return (
    <div className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-surface p-5 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-secondary">Select Market</p>
        <Select
          value={marketCode}
          onChange={(event) => setMarket(event.target.value as MarketCode)}
          options={marketOptions.map((option) => ({ label: option.label, value: option.value }))}
        />
      </div>
      <div className="flex items-center gap-3">
        <Heart className="h-5 w-5 shrink-0 text-primary" aria-hidden />
        <p className="text-sm text-text-secondary">Available in Pakistan &amp; UAE</p>
      </div>
      <div className="flex items-center gap-3">
        <Tag className="h-5 w-5 shrink-0 text-primary" aria-hidden />
        <p className="text-sm text-text-secondary">Same product, different prices</p>
      </div>
      <div className="flex items-center gap-3">
        <Globe2 className="h-5 w-5 shrink-0 text-primary" aria-hidden />
        <p className="text-sm text-text-secondary">Change market for local pricing</p>
      </div>
    </div>
  );
}
