import { apiFetch } from "@/lib/api";
import { ENDPOINTS } from "@/lib/endpoints";
import { DEFAULT_MARKET_CODE } from "@/lib/constants/market";
import { withAuthRetry } from "@/lib/api/withAuthRetry";
import type { CheckoutRequest, OrderView } from "@/lib/types/checkout";

export async function submitCheckout(
  idempotencyKey: string,
  body: CheckoutRequest,
  marketCode: string = DEFAULT_MARKET_CODE
): Promise<OrderView> {
  return withAuthRetry(() =>
    apiFetch<OrderView>(
      `${ENDPOINTS.checkout.root}?market=${encodeURIComponent(marketCode)}`,
      {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(body),
        cache: "no-store",
      }
    )
  );
}
