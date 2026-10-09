import type { Review } from "../../generated/prisma/client.js";
import type { RatingAggregate, ReviewWithProduct } from "./reviews.repository.js";

export interface PublicReviewResponse {
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

export interface AdminReviewResponse extends PublicReviewResponse {
  userId: string | null;
  source: string;
  isPublished: boolean;
  isFeatured: boolean;
  updatedAt: string;
}

export interface RatingSummaryResponse {
  averageRating: number | null;
  reviewCount: number;
}

/// Sitewide-listing shape — public review fields plus just enough of the
/// product to display/link to it. Never exposes the full Product response.
export interface PublicReviewWithProductResponse extends PublicReviewResponse {
  product: {
    name: string;
    slug: string;
    imageUrl: string | null;
    imageAlt: string | null;
  };
}

/// Storefront-safe shape: no userId, source, isPublished/isFeatured
/// moderation flags, or updatedAt — same public/admin split convention as
/// pricing.mapper.ts's toPublicPriceResponse. isVerifiedPurchase IS safe to
/// expose — it's exactly the "Verified Purchase" badge data.
export function toPublicReviewResponse(review: Review): PublicReviewResponse {
  return {
    id: review.id,
    productId: review.productId,
    rating: review.rating,
    title: review.title,
    body: review.body,
    authorName: review.authorName,
    authorLocation: review.authorLocation,
    avatarUrl: review.avatarUrl,
    isVerifiedPurchase: review.isVerifiedPurchase,
    createdAt: review.createdAt.toISOString(),
  };
}

export function toPublicReviewWithProductResponse(review: ReviewWithProduct): PublicReviewWithProductResponse {
  const primaryImage = review.product.media[0] ?? null;
  return {
    ...toPublicReviewResponse(review),
    product: {
      name: review.product.name,
      slug: review.product.slug,
      imageUrl: primaryImage?.url ?? null,
      imageAlt: primaryImage?.altText ?? null,
    },
  };
}

/// Full admin shape — includes moderation-only fields never shown publicly.
export function toAdminReviewResponse(review: Review): AdminReviewResponse {
  return {
    ...toPublicReviewResponse(review),
    userId: review.userId,
    source: review.source,
    isPublished: review.isPublished,
    isFeatured: review.isFeatured,
    updatedAt: review.updatedAt.toISOString(),
  };
}

/// Rounded to 1 decimal for display; the raw average is never persisted,
/// same "computed at read time" convention as Inventory's `available`.
export function toRatingSummaryResponse(aggregate: RatingAggregate): RatingSummaryResponse {
  return {
    averageRating: aggregate.averageRating === null ? null : Math.round(aggregate.averageRating * 10) / 10,
    reviewCount: aggregate.reviewCount,
  };
}
