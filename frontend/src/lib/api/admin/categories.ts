import { ENDPOINTS } from "@/lib/endpoints";
import { serverApiFetch, serverApiFetchWithMeta } from "@/lib/api/server-fetch";
import type { CategoryResponse, PaginationMeta } from "@/lib/types/catalog";
import type { AdminCategoryResponse } from "@/lib/types/admin-catalog";

/**
 * Server Component-only reads — the client-safe mutations live in
 * categories-mutations.ts so a "use client" component never pulls
 * next/headers into its bundle.
 */

/**
 * GET /categories?includeInactive=true. The flag is
 * only honored server-side for a caller holding categories:read (else
 * silently ignored, active-only) — super_admin already holds it (Phase 6E:
 * the only administrative role for now). Always
 * requested for the product editor's category picker so a product's
 * existing assignment to a since-deactivated category stays visible/
 * editable, never silently hidden (see docs/CURRENT_TASK.md).
 */
export async function getCategoriesForAdminServer(): Promise<CategoryResponse[]> {
  return serverApiFetch<CategoryResponse[]>(`${ENDPOINTS.categories.list}?includeInactive=true&limit=100`);
}

export interface AdminCategoriesListParams {
  page?: number;
  limit?: number;
}

/** GET /categories?include=admin&includeInactive=true (categories:read) — paginated, with all-status product/child counts. */
export async function getAdminCategoriesServer(
  params: AdminCategoriesListParams = {}
): Promise<{ items: AdminCategoryResponse[]; pagination: PaginationMeta }> {
  const query = new URLSearchParams({ include: "admin", includeInactive: "true" });
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  const { data, meta } = await serverApiFetchWithMeta<AdminCategoryResponse[]>(
    `${ENDPOINTS.categories.list}?${query.toString()}`
  );
  return { items: data, pagination: meta.pagination as PaginationMeta };
}

/** GET /categories/:id — admins (categories:read) also get inactive categories. */
export async function getCategoryForAdminServer(id: string): Promise<CategoryResponse> {
  return serverApiFetch<CategoryResponse>(ENDPOINTS.categories.detail(id));
}
