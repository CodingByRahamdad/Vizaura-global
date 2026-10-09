"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/api";
import { upsertMarket } from "@/lib/api/admin/products";
import { MARKETS, type MarketCode } from "@/lib/constants/market";
import type { ProductMarketAvailability } from "@/lib/types/catalog";

interface ProductMarketPanelProps {
  productId: string;
  markets: ProductMarketAvailability[];
  canUpdate: boolean;
}

/**
 * Product-level market visibility/availability (ProductMarket is keyed by
 * productId+marketId, not per-variant — see backend/prisma/schema.prisma).
 * PK and AE are two fully independent rows here; there is no derived or
 * shared state between them anywhere in this component.
 */
export function ProductMarketPanel({ productId, markets, canUpdate }: ProductMarketPanelProps) {
  const router = useRouter();
  const [state, setState] = useState<Record<MarketCode, { isAvailable: boolean; isVisible: boolean }>>(() => {
    const byCode = new Map(markets.map((m) => [m.code, m]));
    return {
      PK: { isAvailable: byCode.get("PK")?.isAvailable ?? false, isVisible: byCode.get("PK")?.isVisible ?? false },
      AE: { isAvailable: byCode.get("AE")?.isAvailable ?? false, isVisible: byCode.get("AE")?.isVisible ?? false },
    };
  });
  const [savingMarket, setSavingMarket] = useState<MarketCode | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(code: MarketCode) {
    setSavingMarket(code);
    setError(null);
    try {
      await upsertMarket(productId, code, state[code]);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : `Couldn't save ${code} availability.`);
    } finally {
      setSavingMarket(null);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {error ? <p className="col-span-full text-sm text-error">{error}</p> : null}
      {(Object.keys(MARKETS) as MarketCode[]).map((code) => (
        <div key={code} className="rounded-md border border-border p-4">
          <p className="mb-3 font-medium text-text">{MARKETS[code].label}</p>
          <label className="mb-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={state[code].isAvailable}
              disabled={!canUpdate}
              onChange={(event) => setState((s) => ({ ...s, [code]: { ...s[code], isAvailable: event.target.checked } }))}
            />
            Available for purchase
          </label>
          <label className="mb-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={state[code].isVisible}
              disabled={!canUpdate}
              onChange={(event) => setState((s) => ({ ...s, [code]: { ...s[code], isVisible: event.target.checked } }))}
            />
            Visible in storefront listings
          </label>
          {canUpdate ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => handleSave(code)} isLoading={savingMarket === code}>
              Save {code}
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
