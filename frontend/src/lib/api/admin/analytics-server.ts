import { ENDPOINTS } from "@/lib/endpoints";
import { serverApiFetch } from "@/lib/api/server-fetch";
import type { AdminDashboardData } from "@/lib/types/admin-dashboard";

/** GET /admin/analytics/dashboard (analytics:read) — the admin dashboard's sole data source. */
export async function getAdminDashboardServer(days?: number): Promise<AdminDashboardData> {
  const query = days ? `?days=${days}` : "";
  return serverApiFetch<AdminDashboardData>(`${ENDPOINTS.admin.analyticsDashboard}${query}`);
}
