import { ENDPOINTS } from "@/lib/endpoints";
import { serverApiFetch } from "@/lib/api/server-fetch";
import type { ReviewResponse } from "@/lib/types/reviews";

/**
 * Server Component-only reads live here, split out of reviews.ts, so a
 * "use client" component importing the client-safe reviews.ts never
 * transitively pulls in next/headers (same precedent as
 * lib/api/admin/products-server.ts vs. lib/api/admin/products.ts).
 */

/**
 * The current visitor's own review for a product, or null if they haven't
 * reviewed it (or aren't signed in). Session-sensitive — never cached, same
 * as Wishlist's own reads (server-fetch.ts forwards the incoming request's
 * cookies). Lets ProductReviews decide between "write a review" and "edit
 * your review" without the client needing its own auth round-trip.
 */
export async function getMyReviewForProduct(productId: string): Promise<ReviewResponse | null> {
  try {
    return await serverApiFetch<ReviewResponse | null>(ENDPOINTS.reviews.mineForProduct(productId));
  } catch {
    return null;
  }
}
