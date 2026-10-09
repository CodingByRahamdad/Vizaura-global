import { apiFetch, apiFetchWithMeta } from "@/lib/api";
import { ENDPOINTS } from "@/lib/endpoints";
import { withAuthRetry } from "@/lib/api/withAuthRetry";
import type { OrderDetailView, OrderSummaryView } from "@/lib/types/orders";

interface ListOrdersParams {
  page?: number;
  limit?: number;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export async function listOrders(
  params?: ListOrdersParams
): Promise<{ data: OrderSummaryView[]; meta: Record<string, unknown> }> {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : "";

  return withAuthRetry(() =>
    apiFetchWithMeta<OrderSummaryView[]>(`${ENDPOINTS.orders.list}${suffix}`, { cache: "no-store" })
  );
}

export async function getOrder(id: string): Promise<OrderDetailView> {
  return withAuthRetry(() =>
    apiFetch<OrderDetailView>(ENDPOINTS.orders.detail(id), { cache: "no-store" })
  );
}

/**
 * Loops every page (max 100/page, the backend's hard cap) to return a
 * customer's complete order list — there is no backend aggregate/sum
 * endpoint, so dashboard metrics like Total Spent must be computed from the
 * full set client-side. Fine for realistic order volumes; would need a real
 * backend aggregate if a customer's order count grows very large.
 */
export async function listAllOrders(): Promise<{ orders: OrderSummaryView[]; total: number }> {
  const limit = 100;
  const first = await listOrders({ page: 1, limit });
  const pagination = first.meta.pagination as PaginationMeta | undefined;
  const totalPages = pagination?.totalPages ?? 1;
  const total = pagination?.total ?? first.data.length;

  let all = first.data;
  for (let page = 2; page <= totalPages; page += 1) {
    const next = await listOrders({ page, limit });
    all = all.concat(next.data);
  }
  return { orders: all, total };
}
