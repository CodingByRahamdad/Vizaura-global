import { ENDPOINTS } from "@/lib/endpoints";
import { serverApiFetch, serverApiFetchWithMeta } from "@/lib/api/server-fetch";
import type { PaginationMeta } from "@/lib/types/catalog";
import type { AdminOrderDetail, AdminOrderSummary } from "@/lib/types/admin-orders";

/**
 * Server Component-only (imports next/headers via server-fetch) — the
 * client-safe status mutation lives in orders.ts so a "use client" component
 * never pulls this file into its bundle.
 */

export interface AdminOrdersListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  paymentStatus?: string;
  shipmentStatus?: string;
  market?: string;
  dateFrom?: string;
  dateTo?: string;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

/** GET /admin/orders (orders:read) — every filter is enforced by the backend. */
export async function getAdminOrdersServer(
  params: AdminOrdersListParams = {}
): Promise<{ items: AdminOrderSummary[]; pagination: PaginationMeta }> {
  const query = buildQuery({ ...params });
  const { data, meta } = await serverApiFetchWithMeta<AdminOrderSummary[]>(`${ENDPOINTS.admin.orders}${query}`);
  return { items: data, pagination: meta.pagination as PaginationMeta };
}

/** GET /admin/orders/:id (orders:read). */
export async function getAdminOrderServer(id: string): Promise<AdminOrderDetail> {
  return serverApiFetch<AdminOrderDetail>(ENDPOINTS.admin.order(id));
}
