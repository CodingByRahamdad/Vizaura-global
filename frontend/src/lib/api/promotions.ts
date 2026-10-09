import { apiFetch } from "@/lib/api";
import { ENDPOINTS } from "@/lib/endpoints";
import type { HomepagePromotionsResponse } from "@/lib/types/promotions";

const PROMOTIONS_REVALIDATE_SECONDS = 60;

/** GET /promotions/active — public, unauthenticated, backs the homepage Promotion Section. */
export async function getActivePromotions(): Promise<HomepagePromotionsResponse> {
  return apiFetch<HomepagePromotionsResponse>(ENDPOINTS.promotions.active, {
    next: { revalidate: PROMOTIONS_REVALIDATE_SECONDS },
  });
}
