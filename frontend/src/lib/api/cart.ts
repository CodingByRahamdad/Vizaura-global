import { apiFetch } from "@/lib/api";
import { ENDPOINTS } from "@/lib/endpoints";
import { DEFAULT_MARKET_CODE } from "@/lib/constants/market";
import { withAuthRetry } from "@/lib/api/withAuthRetry";
import type { CartView } from "@/lib/types/cart";

/** Cart is always session-sensitive — never cached, same as auth/price/stock reads. */
const NO_STORE = { cache: "no-store" as const };

function withMarket(path: string, marketCode: string = DEFAULT_MARKET_CODE): string {
  return `${path}?market=${encodeURIComponent(marketCode)}`;
}

export async function getCart(marketCode: string = DEFAULT_MARKET_CODE): Promise<CartView> {
  return withAuthRetry(() =>
    apiFetch<CartView>(withMarket(ENDPOINTS.cart.root, marketCode), NO_STORE)
  );
}

export async function addCartItem(
  variantId: string,
  quantity = 1,
  marketCode: string = DEFAULT_MARKET_CODE
): Promise<CartView> {
  return withAuthRetry(() =>
    apiFetch<CartView>(withMarket(ENDPOINTS.cart.items, marketCode), {
      method: "POST",
      body: JSON.stringify({ variantId, quantity }),
      ...NO_STORE,
    })
  );
}

export async function updateCartItem(
  itemId: string,
  quantity: number,
  marketCode: string = DEFAULT_MARKET_CODE
): Promise<CartView> {
  return withAuthRetry(() =>
    apiFetch<CartView>(withMarket(ENDPOINTS.cart.item(itemId), marketCode), {
      method: "PATCH",
      body: JSON.stringify({ quantity }),
      ...NO_STORE,
    })
  );
}

export async function removeCartItem(
  itemId: string,
  marketCode: string = DEFAULT_MARKET_CODE
): Promise<void> {
  await withAuthRetry(() =>
    apiFetch<Record<string, never>>(withMarket(ENDPOINTS.cart.item(itemId), marketCode), {
      method: "DELETE",
      ...NO_STORE,
    })
  );
}

export async function clearCart(marketCode: string = DEFAULT_MARKET_CODE): Promise<void> {
  await withAuthRetry(() =>
    apiFetch<Record<string, never>>(withMarket(ENDPOINTS.cart.root, marketCode), {
      method: "DELETE",
      ...NO_STORE,
    })
  );
}
