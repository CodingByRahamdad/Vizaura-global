import { Star } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { WriteReviewForm } from "@/components/catalog/WriteReviewForm";
import { getProductReviews, getRatingSummary } from "@/lib/api/reviews";
import { getMyReviewForProduct } from "@/lib/api/reviews-server";
import { cn } from "@/lib/utils/cn";

interface ProductReviewsProps {
  productId: string;
}

export async function ProductReviews({ productId }: ProductReviewsProps) {
  let reviews;
  let summary;
  try {
    [reviews, summary] = await Promise.all([getProductReviews(productId), getRatingSummary(productId)]);
  } catch {
    return <ErrorState message="Couldn't load reviews right now." />;
  }
  const myReview = await getMyReviewForProduct(productId);

  return (
    <div className="flex flex-col gap-6">
      {summary.averageRating !== null ? (
        <p className="text-sm text-text-secondary">
          Average rating: <span className="font-semibold text-text">{summary.averageRating.toFixed(1)}</span> out of 5
          ({summary.reviewCount} reviews)
        </p>
      ) : null}

      {reviews.length === 0 ? (
        <EmptyState title="No reviews yet" description="Be the first to share your experience." />
      ) : (
        <div className="flex flex-col gap-4">
          {reviews.map((review) => (
            <div key={review.id} className="rounded-lg border border-border p-4">
              <div className="mb-1 flex items-center gap-2">
                <div className="flex items-center gap-0.5" aria-hidden>
                  {Array.from({ length: 5 }, (_, index) => (
                    <Star
                      key={index}
                      className={cn("h-3.5 w-3.5", index < review.rating ? "fill-warning text-warning" : "text-border")}
                    />
                  ))}
                </div>
                {review.title ? <span className="text-sm font-medium text-text">{review.title}</span> : null}
                {review.isVerifiedPurchase ? <Badge variant="success">Verified Purchase</Badge> : null}
              </div>
              <p className="mb-2 text-sm text-text-secondary">{review.body}</p>
              <p className="text-xs text-text-secondary">
                {review.authorName}
                {review.authorLocation ? `, ${review.authorLocation}` : ""} ·{" "}
                {new Date(review.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}

      <WriteReviewForm productId={productId} existingReview={myReview} />
    </div>
  );
}
