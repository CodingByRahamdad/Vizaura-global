import { cookies } from "next/headers";
import {
  DEFAULT_MARKET_CODE,
  MARKET_COOKIE_NAME,
  isValidMarketCode,
  type MarketCode,
} from "@/lib/constants/market";

/**
 * Extension point for IP/geolocation-based initial market detection.
 * Deliberately a no-op stub this phase — no geo provider exists in the
 * project, and none is added here to avoid an unnecessary external
 * dependency (per product decision, Phase 6A). A future middleware.ts (none
 * exists yet) is the natural place to resolve this from a platform-provided
 * geo header and set the market cookie before first render; this function is
 * the seam it plugs into. getServerMarket() below only consults this when no
 * market cookie is present yet — a returning visitor's explicit choice
 * always wins.
 */
function resolveGeoMarket(): MarketCode | null {
  return null;
}

/**
 * Server-only market resolution, in priority order: previously-selected
 * valid cookie → geo (stub, currently always null) → PK default. Called
 * from the root layout and Server Component pages/sections. Never trusted
 * as an authorization boundary — the backend independently validates the
 * market on every request regardless of what this resolves to.
 *
 * Server-only (imports next/headers) — client code must import
 * lib/market-client.ts instead, never this file.
 */
export async function getServerMarket(): Promise<MarketCode> {
  const cookieStore = await cookies();
  const stored = cookieStore.get(MARKET_COOKIE_NAME)?.value;
  if (isValidMarketCode(stored)) return stored;

  const geoMarket = resolveGeoMarket();
  if (geoMarket) return geoMarket;

  return DEFAULT_MARKET_CODE;
}
