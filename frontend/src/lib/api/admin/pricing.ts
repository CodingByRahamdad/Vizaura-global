import { apiFetch } from "@/lib/api";
import { ENDPOINTS } from "@/lib/endpoints";
import { withAuthRetry } from "@/lib/api/withAuthRetry";
import type { AdminPriceResponse } from "@/lib/types/admin-catalog";

/**
 * Client-safe mutation only — the Server Component-only read
 * (getPricesForVariantServer) lives in pricing-server.ts, split out so a
 * "use client" component (e.g. ProductVariantsPanel) importing this file
 * never transitively pulls in next/headers.
 */

export interface UpsertPriceInput {
  currencyCode?: string;
  amount: number;
  saleAmount?: number | null;
  saleStartsAt?: string | null;
  saleEndsAt?: string | null;
  isActive?: boolean;
}

/**
 * Each market's price is set independently here — there is no derived or
 * converted value between PK and AE anywhere in this call or its caller.
 */
/**
 * GET .../prices (pricing:read) — client-safe counterpart of
 * pricing-server.ts's getPricesForVariantServer, used by the Add Order
 * form (a "use client" component) to show the chosen variant's live price
 * for the order's market before the admin optionally overrides it.
 */
export async function getPricesForVariant(productId: string, variantId: string): Promise<AdminPriceResponse[]> {
  return apiFetch<AdminPriceResponse[]>(ENDPOINTS.products.prices(productId, variantId), { cache: "no-store" });
}

export async function upsertPrice(
  productId: string,
  variantId: string,
  marketCode: string,
  input: UpsertPriceInput
): Promise<AdminPriceResponse> {
  return withAuthRetry(() =>
    apiFetch<AdminPriceResponse>(ENDPOINTS.products.price(productId, variantId, marketCode), {
      method: "PUT",
      body: JSON.stringify(input),
      cache: "no-store",
    })
  );
}
