import { Star } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { SafeImage } from "@/components/ui/SafeImage";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { getFeaturedReviews } from "@/lib/api/reviews";

interface TestimonialsProps {
  id?: string;
  limit?: number;
  overline?: string;
  heading?: string;
  /** Omit to hide the link entirely — used on the About page, which IS the destination. */
  viewAllHref?: string;
}

/**
 * Reused verbatim (same component, same getFeaturedReviews call) by both the
 * Homepage and the About page — per the "centralized review system, no
 * duplicated review data/components" requirement, the About page's
 * testimonial section is this component with different copy, not a second
 * implementation.
 */
export async function Testimonials({
  id,
  limit = 3,
  overline = "What Our Customers Say",
  heading = "Real people. Real experiences.",
  viewAllHref = "/reviews",
}: TestimonialsProps = {}) {
  let reviews: Awaited<ReturnType<typeof getFeaturedReviews>> = [];
  let loadFailed = false;

  try {
    reviews = await getFeaturedReviews(limit);
  } catch {
    loadFailed = true;
  }

  return (
    <div id={id}>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-green">{overline}</p>
          <h2 className="font-serif text-2xl font-semibold text-text">{heading}</h2>
        </div>
        {viewAllHref ? (
          <Link href={viewAllHref} className="text-sm font-medium text-primary hover:underline">
            View All Reviews
          </Link>
        ) : null}
      </div>

      {loadFailed ? (
        <ErrorState message="Couldn't load reviews right now." />
      ) : reviews.length === 0 ? (
        <EmptyState title="No reviews yet" description="Check back soon." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {reviews.map((review) => (
            <Card key={review.id} className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full">
                  <SafeImage src={review.avatarUrl} alt={review.authorName} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text">{review.authorName}</p>
                  {review.authorLocation ? (
                    <p className="text-xs text-text-secondary">{review.authorLocation}</p>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star
                    key={index}
                    className={
                      index < review.rating
                        ? "h-4 w-4 fill-warning text-warning"
                        : "h-4 w-4 text-border"
                    }
                    aria-hidden
                  />
                ))}
              </div>
              <p className="text-sm text-text-secondary">&ldquo;{review.body}&rdquo;</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
