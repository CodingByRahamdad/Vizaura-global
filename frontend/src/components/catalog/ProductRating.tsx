import { Star } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface ProductRatingProps {
  averageRating: number | null;
  reviewCount: number;
}

export function ProductRating({ averageRating, reviewCount }: ProductRatingProps) {
  if (averageRating === null || reviewCount === 0) {
    return (
      <a href="#write-review" className="text-sm text-text-secondary hover:text-primary-dark">
        No reviews yet — write the first one
      </a>
    );
  }

  const rounded = Math.round(averageRating);

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5" aria-hidden>
        {Array.from({ length: 5 }, (_, index) => (
          <Star
            key={index}
            className={cn(
              "h-4 w-4",
              index < rounded ? "fill-warning text-warning" : "text-border"
            )}
          />
        ))}
      </div>
      <span className="text-sm font-medium text-text">{averageRating.toFixed(1)}</span>
      <span className="text-sm text-text-secondary">({reviewCount} reviews)</span>
      <a href="#reviews" className="text-sm text-primary hover:text-primary-dark">
        Write a review
      </a>
    </div>
  );
}
