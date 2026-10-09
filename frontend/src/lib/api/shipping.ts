import { apiFetch } from "@/lib/api";
import { ENDPOINTS } from "@/lib/endpoints";
import { DEFAULT_MARKET_CODE } from "@/lib/constants/market";
import type { ShippingMethodView } from "@/lib/types/shipping";

/** Public route, no auth — rates can change, never cached. */
export async function getShippingMethods(
  marketCode: string = DEFAULT_MARKET_CODE
): Promise<ShippingMethodView[]> {
  return apiFetch<ShippingMethodView[]>(
    `${ENDPOINTS.shipping.methods}?market=${encodeURIComponent(marketCode)}`,
    { cache: "no-store" }
  );
}
