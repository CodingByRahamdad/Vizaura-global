import { ENDPOINTS } from "@/lib/endpoints";
import { serverApiFetch } from "@/lib/api/server-fetch";
import type { AdminPriceResponse } from "@/lib/types/admin-catalog";

/**
 * Server Component-only — kept separate from pricing.ts's client-safe
 * upsertPrice, same reason as products-server.ts (next/headers can't be
 * pulled into a Client Component's bundle). GET .../prices: a caller
 * holding pricing:read gets every row (active or not) with the full admin
 * shape, same public/admin split every Pricing endpoint already has.
 */
export async function getPricesForVariantServer(productId: string, variantId: string): Promise<AdminPriceResponse[]> {
  return serverApiFetch<AdminPriceResponse[]>(ENDPOINTS.products.prices(productId, variantId));
}
