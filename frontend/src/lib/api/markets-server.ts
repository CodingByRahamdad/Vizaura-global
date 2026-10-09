import { ENDPOINTS } from "@/lib/endpoints";
import { serverApiFetch } from "@/lib/api/server-fetch";
import type { AdminMarket, PublicMarket } from "@/lib/types/markets";

/** GET /markets — public, active markets only. */
export async function getMarketsServer(): Promise<PublicMarket[]> {
  return serverApiFetch<PublicMarket[]>(ENDPOINTS.markets.list);
}

/** GET /admin/markets (markets:read) — includes inactive markets. */
export async function getAdminMarketsServer(): Promise<AdminMarket[]> {
  return serverApiFetch<AdminMarket[]>(ENDPOINTS.admin.markets);
}
