import { ENDPOINTS } from "@/lib/endpoints";
import { serverApiFetch, serverApiFetchWithMeta } from "@/lib/api/server-fetch";
import type { PaginationMeta } from "@/lib/types/catalog";
import type { AdminInventoryListResponse, AdminStockResponse } from "@/lib/types/admin-catalog";

/**
 * Server Component-only — kept separate from inventory.ts's client-safe
 * adjustStock, same reason as products-server.ts/pricing-server.ts
 * (next/headers can't be pulled into a Client Component's bundle).
 */

/**
 * Phase 6D — shows current stock in the Products editor (read only, no
 * write UI there; adjustStock below is Inventory admin's own action). A
 * caller holding inventory:read gets every market's raw
 * onHand/reserved/available.
 */
export async function getStockForVariantServer(productId: string, variantId: string): Promise<AdminStockResponse[]> {
  return serverApiFetch<AdminStockResponse[]>(ENDPOINTS.products.stockList(productId, variantId));
}

export interface AdminInventoryListParams {
  page?: number;
  limit?: number;
  search?: string;
  market?: string;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

/**
 * GET /admin/inventory (inventory:read) — a cross-catalog list, unlike the
 * per-variant stock reads elsewhere in this codebase. No public/storefront
 * equivalent exists, so unlike Products' `include=admin`, there's no
 * widening rule to reason about — the route itself is strictly gated.
 */
export async function getAdminInventoryServer(
  params: AdminInventoryListParams = {}
): Promise<{ items: AdminInventoryListResponse[]; pagination: PaginationMeta }> {
  const query = buildQuery({
    page: params.page,
    limit: params.limit,
    search: params.search,
    market: params.market,
  });
  const { data, meta } = await serverApiFetchWithMeta<AdminInventoryListResponse[]>(
    `${ENDPOINTS.admin.inventory}${query}`
  );
  return { items: data, pagination: meta.pagination as PaginationMeta };
}
