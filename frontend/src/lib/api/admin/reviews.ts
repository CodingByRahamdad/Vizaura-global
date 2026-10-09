import { ENDPOINTS } from "@/lib/endpoints";
import { serverApiFetch, serverApiFetchWithMeta } from "@/lib/api/server-fetch";
import type { PaginationMeta } from "@/lib/types/catalog";
import type { AdminReviewResponse, ReviewSource } from "@/lib/types/admin-reviews";

/**
 * Server Component-only reads — the client-safe mutations live in
 * reviews-mutations.ts so a "use client" component never pulls next/headers
 * into its bundle. Mirrors admin/categories.ts exactly.
 */

export interface AdminReviewsListParams {
  page?: number;
  limit?: number;
  productId?: string;
  status?: "published" | "unpublished";
  source?: ReviewSource;
  featured?: boolean;
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

/** GET /admin/reviews (reviews:read). */
export async function getAdminReviewsServer(
  params: AdminReviewsListParams = {}
): Promise<{ items: AdminReviewResponse[]; pagination: PaginationMeta }> {
  const query = buildQuery({ ...params });
  const { data, meta } = await serverApiFetchWithMeta<AdminReviewResponse[]>(`${ENDPOINTS.admin.reviews}${query}`);
  return { items: data, pagination: meta.pagination as PaginationMeta };
}

/** GET /admin/reviews/:id (reviews:read). */
export async function getAdminReviewServer(id: string): Promise<AdminReviewResponse> {
  return serverApiFetch<AdminReviewResponse>(ENDPOINTS.admin.review(id));
}
