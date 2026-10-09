import { apiFetch } from "@/lib/api";
import { ENDPOINTS } from "@/lib/endpoints";
import { withAuthRetry } from "@/lib/api/withAuthRetry";
import type { WishlistView } from "@/lib/types/wishlist";

/** Wishlist is always session-sensitive — never cached, same as Cart. */
const NO_STORE = { cache: "no-store" as const };

export async function getWishlist(): Promise<WishlistView> {
  return withAuthRetry(() => apiFetch<WishlistView>(ENDPOINTS.wishlist.root, NO_STORE));
}

export async function addWishlistItem(productId: string): Promise<WishlistView> {
  return withAuthRetry(() =>
    apiFetch<WishlistView>(ENDPOINTS.wishlist.items, {
      method: "POST",
      body: JSON.stringify({ productId }),
      ...NO_STORE,
    })
  );
}

export async function removeWishlistItem(productId: string): Promise<void> {
  await withAuthRetry(() =>
    apiFetch<Record<string, never>>(ENDPOINTS.wishlist.item(productId), {
      method: "DELETE",
      ...NO_STORE,
    })
  );
}
