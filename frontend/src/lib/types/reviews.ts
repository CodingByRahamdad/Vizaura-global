/**
 * Types mirror the backend's actual response shapes verbatim
 * (backend/src/modules/reviews/reviews.mapper.ts). Do not add fields the
 * backend doesn't return.
 */

export interface ReviewResponse {
  id: string;
  productId: string;
  rating: number;
  title: string | null;
  body: string;
  authorName: string;
  authorLocation: string | null;
  avatarUrl: string | null;
  isVerifiedPurchase: boolean;
  createdAt: string;
}

export interface RatingSummaryResponse {
  averageRating: number | null;
  reviewCount: number;
}

/** Sitewide listing shape (GET /reviews) — ReviewResponse plus the product it belongs to. */
export interface ReviewWithProductResponse extends ReviewResponse {
  product: {
    name: string;
    slug: string;
    imageUrl: string | null;
    imageAlt: string | null;
  };
}
