"use client";

import { useMarket } from "@/context/MarketContext";
import { isValidMarketCode } from "@/lib/constants/market";

export function MarketSwitcher() {
  const { marketCode, marketOptions, setMarket } = useMarket();

  return (
    <label className="flex items-center gap-1">
      <span className="sr-only">Select market</span>
      <select
        value={marketCode}
        onChange={(e) => {
          const next = e.target.value;
          if (isValidMarketCode(next)) setMarket(next);
        }}
        className="cursor-pointer border-none bg-transparent text-xs text-white focus:outline-none"
      >
        {marketOptions.map((option) => (
          <option key={option.value} value={option.value} className="text-text">
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
