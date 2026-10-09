import { ENDPOINTS } from "@/lib/endpoints";
import { serverApiFetch, serverApiFetchWithMeta } from "@/lib/api/server-fetch";
import type { PaginationMeta, ProductDetailResponse } from "@/lib/types/catalog";
import type { ProductAdminListResponse } from "@/lib/types/admin-catalog";
import type { ProductStatus } from "@/lib/api/admin/products";

/**
 * Server Component-only reads — kept in their own module (separate from
 * products.ts's client-safe mutations) because importing next/headers
 * (transitively, via server-fetch.ts) from a module a Client Component also
 * imports breaks the Next.js build. Never import this file from a "use
 * client" component.
 */

export interface AdminProductListParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  status?: ProductStatus;
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
 * GET /products?include=admin (products:read). `market` is never sent:
 * admin management always spans both markets at once (see
 * docs/API_CONTRACTS.md), the market distinction is display-only
 * (ProductMarketPanel / the list's per-market columns), never a row filter.
 */
export async function getAdminProductsServer(
  params: AdminProductListParams = {}
): Promise<{ items: ProductAdminListResponse[]; pagination: PaginationMeta }> {
  const query = buildQuery({
    page: params.page,
    limit: params.limit,
    search: params.search,
    category: params.category,
    status: params.status,
    include: "admin",
  });
  const { data, meta } = await serverApiFetchWithMeta<ProductAdminListResponse[]>(
    `${ENDPOINTS.products.list}${query}`
  );
  return { items: data, pagination: meta.pagination as PaginationMeta };
}

/** GET /products/:id. Sees DRAFT/ARCHIVED via products:read widening. */
export async function getAdminProductDetailServer(id: string): Promise<ProductDetailResponse> {
  return serverApiFetch<ProductDetailResponse>(ENDPOINTS.products.detail(id));
}
