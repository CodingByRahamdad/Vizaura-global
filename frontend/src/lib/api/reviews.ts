import { apiFetch, apiFetchWithMeta } from "@/lib/api";
import { ENDPOINTS } from "@/lib/endpoints";
import type { PaginationMeta } from "@/lib/types/catalog";
import type { RatingSummaryResponse, ReviewResponse, ReviewWithProductResponse } from "@/lib/types/reviews";

const REVIEWS_REVALIDATE_SECONDS = 60;

export async function getRatingSummary(productId: string): Promise<RatingSummaryResponse> {
  return apiFetch<RatingSummaryResponse>(ENDPOINTS.reviews.summaryForProduct(productId), {
    next: { revalidate: REVIEWS_REVALIDATE_SECONDS },
  });
}

export async function getProductReviews(productId: string): Promise<ReviewResponse[]> {
  return apiFetch<ReviewResponse[]>(ENDPOINTS.reviews.forProduct(productId), {
    next: { revalidate: REVIEWS_REVALIDATE_SECONDS },
  });
}

export async function getFeaturedReviews(limit = 6): Promise<ReviewResponse[]> {
  return apiFetch<ReviewResponse[]>(`${ENDPOINTS.reviews.featured}?limit=${limit}`, {
    next: { revalidate: REVIEWS_REVALIDATE_SECONDS },
  });
}

export interface GetAllReviewsParams {
  page?: number;
  limit?: number;
}

/** GET /reviews — public, cross-product, published-only listing (storefront "All Reviews" page). */
export async function getAllReviews(
  params: GetAllReviewsParams = {}
): Promise<{ items: ReviewWithProductResponse[]; pagination: PaginationMeta }> {
  const search = new URLSearchParams();
  if (params.page !== undefined) search.set("page", String(params.page));
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  const query = search.toString();

  const { data, meta } = await apiFetchWithMeta<ReviewWithProductResponse[]>(
    `${ENDPOINTS.reviews.all}${query ? `?${query}` : ""}`,
    { next: { revalidate: REVIEWS_REVALIDATE_SECONDS } }
  );
  return { items: data, pagination: meta.pagination as PaginationMeta };
}
