/**
 * Real, seeded market codes/currencies (backend Market table: PK, AE) — not
 * fabricated data. Single source of truth for market metadata on the
 * frontend; frontend/src/lib/constants/nav.ts's MARKET_OPTIONS derives from
 * this for backward compatibility with existing imports (Footer.tsx).
 */
export type MarketCode = "PK" | "AE";

export interface MarketInfo {
  code: MarketCode;
  label: string;
  currencyCode: string;
}

export const MARKETS: Record<MarketCode, MarketInfo> = {
  PK: { code: "PK", label: "Pakistan (PKR)", currencyCode: "PKR" },
  AE: { code: "AE", label: "UAE (AED)", currencyCode: "AED" },
};

export const MARKET_CODES = Object.keys(MARKETS) as MarketCode[];

/**
 * SSR/no-cookie fallback and every market-sensitive API function's default
 * parameter value, so a call site that hasn't been migrated to pass an
 * explicit market yet keeps working exactly as before.
 */
export const DEFAULT_MARKET_CODE: MarketCode = "PK";

/**
 * Not httpOnly — this is a UX preference, not an auth/security token. The
 * backend independently validates the market on every request regardless of
 * what this cookie says (see docs/SHILAJIT _PRD.md §6.2).
 */
export const MARKET_COOKIE_NAME = "vz_market";

export function isValidMarketCode(code: string | null | undefined): code is MarketCode {
  return !!code && Object.prototype.hasOwnProperty.call(MARKETS, code);
}
