import { MARKET_COOKIE_NAME, isValidMarketCode, type MarketCode } from "@/lib/constants/market";

/**
 * Client-only cookie read/write — kept in a separate file from
 * lib/market.ts because that file imports next/headers, which cannot be
 * pulled into a Client Component bundle (Next.js build error). MarketContext
 * is the only caller.
 */
export function getClientMarketCookie(): MarketCode | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${MARKET_COOKIE_NAME}=([^;]*)`));
  const value = match ? decodeURIComponent(match[1]) : null;
  return isValidMarketCode(value) ? value : null;
}

/** One year — matches "previously selected market" persisting across normal browsing. */
export function setClientMarketCookie(code: MarketCode): void {
  if (typeof document === "undefined") return;
  const maxAgeSeconds = 60 * 60 * 24 * 365;
  document.cookie = `${MARKET_COOKIE_NAME}=${encodeURIComponent(code)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
}
