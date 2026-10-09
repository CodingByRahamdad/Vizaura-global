import { ENDPOINTS } from "@/lib/endpoints";
import { serverApiFetch, serverApiFetchWithMeta } from "@/lib/api/server-fetch";
import type { PaginationMeta } from "@/lib/types/catalog";
import type { AdminPromotionResponse, PromotionDisplayLayout, PromotionStatus } from "@/lib/types/promotions";

/**
 * Server Component-only reads — the client-safe mutations live in
 * promotions-mutations.ts so a "use client" component never pulls
 * next/headers into its bundle. Mirrors admin/categories.ts.
 */

export interface AdminPromotionsListParams {
  page?: number;
  limit?: number;
  status?: Lowercase<PromotionStatus>;
  displayLayout?: PromotionDisplayLayout;
}

/** GET /admin/promotions (promotions:read). */
export async function getAdminPromotionsServer(
  params: AdminPromotionsListParams = {}
): Promise<{ items: AdminPromotionResponse[]; pagination: PaginationMeta }> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.status) query.set("status", params.status);
  if (params.displayLayout) query.set("displayLayout", params.displayLayout);
  const queryString = query.toString();
  const { data, meta } = await serverApiFetchWithMeta<AdminPromotionResponse[]>(
    `${ENDPOINTS.admin.promotions}${queryString ? `?${queryString}` : ""}`
  );
  return { items: data, pagination: meta.pagination as PaginationMeta };
}

/** GET /admin/promotions/:id (promotions:read). */
export async function getAdminPromotionServer(id: string): Promise<AdminPromotionResponse> {
  return serverApiFetch<AdminPromotionResponse>(ENDPOINTS.admin.promotion(id));
}
