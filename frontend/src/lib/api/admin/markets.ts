import { apiFetch } from "@/lib/api";
import { ENDPOINTS } from "@/lib/endpoints";
import { withAuthRetry } from "@/lib/api/withAuthRetry";
import type { AdminMarket } from "@/lib/types/markets";

/**
 * PATCH /admin/markets/:id (markets:update). isActive is the only editable
 * field — code/currency/timezone are fixed business configuration, not a
 * casual admin toggle. See docs/modules/MARKETS.md.
 */
export async function updateMarketStatus(id: string, isActive: boolean): Promise<AdminMarket> {
  return withAuthRetry(() =>
    apiFetch<AdminMarket>(ENDPOINTS.admin.market(id), {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
      cache: "no-store",
    })
  );
}
