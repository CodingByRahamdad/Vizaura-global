"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useAuth } from "@/context/AuthContext";
import { useCartWishlist } from "@/context/CartWishlistContext";

interface WishlistButtonProps {
  productId: string;
  className?: string;
}

/**
 * Parallel to AddToCartButton.tsx: same unauthenticated-redirect pattern,
 * same per-action pending-key convention (`wish:${productId}`). Takes a
 * bare `className` (not a size/variant prop) so it can drop into either
 * ProductCard's absolute-positioned overlay slot or Product Detail's
 * inline layout without this component guessing which.
 *
 * The button is its own positioning context for the error tooltip (a plain
 * "relative" wrapper div would fight the caller's own "absolute right-3
 * top-3" className for the position property — Tailwind's utility order
 * isn't reliably overridable by className concatenation, since cn() here
 * has no merge/dedup step). When the caller supplies absolute positioning,
 * we skip adding "relative" ourselves — "absolute" alone already anchors
 * both the button and its tooltip correctly to the caller's container.
 */
export function WishlistButton({ productId, className }: WishlistButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useAuth();
  const { toggleWishlist, wishlistProductIds, pendingKeys } = useCartWishlist();
  const [error, setError] = useState<string | null>(null);

  const isSaved = wishlistProductIds.has(productId);
  const isPending = pendingKeys.has(`wish:${productId}`);
  const callerPositionsIt = className?.includes("absolute") ?? false;

  async function handleClick() {
    if (status !== "authenticated") {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    setError(null);
    try {
      await toggleWishlist(productId);
    } catch {
      setError("Couldn't update your wishlist.");
    }
  }

  return (
    <button
      type="button"
      aria-label={isSaved ? "Remove from wishlist" : "Add to wishlist"}
      aria-pressed={isSaved}
      disabled={isPending}
      onClick={() => void handleClick()}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full bg-surface text-text-secondary shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        !callerPositionsIt && "relative",
        isSaved && "text-error",
        className
      )}
    >
      <Heart className="h-4 w-4" aria-hidden fill={isSaved ? "currentColor" : "none"} />
      {error ? (
        <span
          role="alert"
          className="absolute right-0 top-full mt-1 w-40 text-right text-xs font-normal normal-case text-error"
        >
          {error}
        </span>
      ) : null}
    </button>
  );
}
