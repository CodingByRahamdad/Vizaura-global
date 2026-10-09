import { ENDPOINTS } from "@/lib/endpoints";
import { serverApiFetch, serverApiFetchWithMeta } from "@/lib/api/server-fetch";
import type { PaginationMeta } from "@/lib/types/catalog";
import type { AdminCustomerDetail, AdminCustomerSummary } from "@/lib/types/admin-customers";
import type { UserStatus } from "@/lib/types/admin-users";

export interface AdminCustomersListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: UserStatus;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

/** GET /admin/customers (customers:read) — server-side hard-scoped to roleKey="customer", never a client filter. */
export async function getAdminCustomersServer(
  params: AdminCustomersListParams = {}
): Promise<{ items: AdminCustomerSummary[]; pagination: PaginationMeta }> {
  const query = buildQuery({ ...params });
  const { data, meta } = await serverApiFetchWithMeta<AdminCustomerSummary[]>(`${ENDPOINTS.admin.customers}${query}`);
  return { items: data, pagination: meta.pagination as PaginationMeta };
}

/** GET /admin/customers/:id (customers:read). 404s if the id resolves to a non-customer account. */
export async function getAdminCustomerServer(id: string): Promise<AdminCustomerDetail> {
  return serverApiFetch<AdminCustomerDetail>(ENDPOINTS.admin.customer(id));
}
