import { apiFetch } from "@/lib/api";
import { ENDPOINTS } from "@/lib/endpoints";
import { withAuthRetry } from "@/lib/api/withAuthRetry";
import type { ReviewResponse } from "@/lib/types/reviews";

/**
 * Client-safe mutations only (browser fetch + withAuthRetry, no next/headers)
 * — the Server Component-only reads live in reviews.ts. Mirrors
 * lib/api/wishlist.ts's split exactly.
 */
const NO_STORE = { cache: "no-store" as const };

export interface SubmitReviewInput {
  rating: number;
  title?: string;
  body: string;
  captchaToken: string;
}

export interface UpdateReviewInput {
  rating?: number;
  title?: string | null;
  body?: string;
}

/** POST /products/:productId/reviews — upserts on (productId, userId), so resubmitting edits rather than erroring. */
export async function submitReview(productId: string, input: SubmitReviewInput): Promise<ReviewResponse> {
  return withAuthRetry(() =>
    apiFetch<ReviewResponse>(ENDPOINTS.reviews.forProduct(productId), {
      method: "POST",
      body: JSON.stringify(input),
      ...NO_STORE,
    })
  );
}

export async function updateReview(reviewId: string, input: UpdateReviewInput): Promise<ReviewResponse> {
  return withAuthRetry(() =>
    apiFetch<ReviewResponse>(ENDPOINTS.reviews.detail(reviewId), {
      method: "PATCH",
      body: JSON.stringify(input),
      ...NO_STORE,
    })
  );
}

export async function deleteReview(reviewId: string): Promise<void> {
  await withAuthRetry(() =>
    apiFetch<Record<string, never>>(ENDPOINTS.reviews.detail(reviewId), { method: "DELETE", ...NO_STORE })
  );
}
