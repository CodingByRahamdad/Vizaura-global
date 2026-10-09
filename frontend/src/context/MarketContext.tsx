"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { MARKETS, isValidMarketCode, type MarketCode } from "@/lib/constants/market";
import { MARKET_OPTIONS } from "@/lib/constants/nav";
import { setClientMarketCookie } from "@/lib/market-client";

type MarketOption = { label: string; value: MarketCode };

interface MarketContextValue {
  marketCode: MarketCode;
  currency: string;
  /** Backend-driven (an admin-deactivated market is excluded) — see root layout. */
  marketOptions: MarketOption[];
  setMarket: (code: MarketCode) => void;
}

function valueFor(
  marketCode: MarketCode,
  marketOptions: MarketOption[],
  setMarket: (code: MarketCode) => void
): MarketContextValue {
  return { marketCode, currency: MARKETS[marketCode].currencyCode, marketOptions, setMarket };
}

const MarketContext = createContext<MarketContextValue>(valueFor("PK", MARKET_OPTIONS, () => {}));

/**
 * `initialMarket` is computed server-side (lib/market.ts's getServerMarket(),
 * called from the root layout) so the first client render always matches
 * what any Server Component siblings already fetched with — no
 * hydration/flash-of-wrong-market mismatch. `marketOptions` is likewise
 * fetched server-side (GET /markets) so the switcher never offers a market
 * an admin has deactivated.
 */
export function MarketProvider({
  children,
  initialMarket,
  marketOptions = MARKET_OPTIONS,
}: {
  children: ReactNode;
  initialMarket: MarketCode;
  marketOptions?: MarketOption[];
}) {
  const [marketCode, setMarketCode] = useState<MarketCode>(initialMarket);
  const router = useRouter();

  const setMarket = useCallback(
    (code: MarketCode) => {
      if (!isValidMarketCode(code) || code === marketCode) return;
      setMarketCode(code);
      setClientMarketCookie(code);
      // Server Components (product listings, homepage sections, product
      // detail) read the market cookie directly, not this context — refresh
      // so they re-fetch with the newly selected market instead of
      // continuing to show the previous one.
      router.refresh();
    },
    [marketCode, router]
  );

  return (
    <MarketContext.Provider value={valueFor(marketCode, marketOptions, setMarket)}>
      {children}
    </MarketContext.Provider>
  );
}

export function useMarket() {
  return useContext(MarketContext);
}
