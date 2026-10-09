import { ENDPOINTS } from "@/lib/endpoints";
import { serverApiFetch, serverApiFetchWithMeta } from "@/lib/api/server-fetch";
import type { PaginationMeta } from "@/lib/types/catalog";
import type { AdminUserDetail, AdminUserSummary, RoleKey, UserStatus } from "@/lib/types/admin-users";

export interface AdminUsersListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: UserStatus;
  role?: RoleKey;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

/** GET /admin/users (users:read) — every filter is enforced by the backend. */
export async function getAdminUsersServer(
  params: AdminUsersListParams = {}
): Promise<{ items: AdminUserSummary[]; pagination: PaginationMeta }> {
  const query = buildQuery({ ...params });
  const { data, meta } = await serverApiFetchWithMeta<AdminUserSummary[]>(`${ENDPOINTS.admin.users}${query}`);
  return { items: data, pagination: meta.pagination as PaginationMeta };
}

/** GET /admin/users/:id (users:read). */
export async function getAdminUserServer(id: string): Promise<AdminUserDetail> {
  return serverApiFetch<AdminUserDetail>(ENDPOINTS.admin.user(id));
}
