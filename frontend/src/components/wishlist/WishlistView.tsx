"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { ProductCard } from "@/components/catalog/ProductCard";
import { useAuth } from "@/context/AuthContext";
import { useCartWishlist } from "@/context/CartWishlistContext";
import { useMarket } from "@/context/MarketContext";
import { getVariantPrice, getVariantStock } from "@/lib/api/catalog";
import type { NormalizedProductCard } from "@/lib/api/catalog";
import { getRatingSummary } from "@/lib/api/reviews";
import type { WishlistItemView } from "@/lib/types/wishlist";

/**
 * Reuses ProductCard directly (no duplicated product-presentation markup) —
 * builds a NormalizedProductCard-shaped object per wishlist item via a live
 * per-item price/stock/rating fetch, since the Wishlist backend response is
 * deliberately price-free (market-independent by design, see
 * docs/CURRENT_TASK.md). Distinct from the catalog-listing card path
 * (getProductCards) — a wishlist is typically small and isn't paginated the
 * same way, so a per-item fetch here isn't the same N+1 concern.
 */
function formatPrice(amount: number, currencyCode: string): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currencyCode }).format(amount / 100);
}

async function toCardData(item: WishlistItemView, marketCode: string): Promise<NormalizedProductCard> {
  let priceLabel: string | null = null;
  let priceAmount: number | null = null;
  let compareAtPriceLabel: string | null = null;
  let isOnSale = false;
  let discountPercent: number | null = null;
  if (item.defaultVariantId) {
    try {
      const price = await getVariantPrice(item.productId, item.defaultVariantId, marketCode);
      priceLabel = formatPrice(price.amount, price.currencyCode);
      priceAmount = price.amount;
      isOnSale = price.isOnSale;
      if (price.compareAtAmount) {
        compareAtPriceLabel = formatPrice(price.compareAtAmount, price.currencyCode);
        discountPercent = Math.round(((price.compareAtAmount - price.amount) / price.compareAtAmount) * 100);
      }
    } catch {
      priceLabel = null;
    }
  }

  let rating: number | null = null;
  let reviewCount = 0;
  try {
    const summary = await getRatingSummary(item.productId);
    rating = summary.averageRating;
    reviewCount = summary.reviewCount;
  } catch {
    rating = null;
    reviewCount = 0;
  }

  let inStock: boolean | null = null;
  if (item.defaultVariantId) {
    try {
      const stock = await getVariantStock(item.productId, item.defaultVariantId, marketCode);
      inStock = stock.status === "IN_STOCK";
    } catch {
      inStock = null;
    }
  }

  return {
    id: item.productId,
    slug: item.slug,
    name: item.name,
    shortDescription: null,
    imageUrl: item.imageUrl,
    priceLabel,
    priceAmount,
    compareAtPriceLabel,
    isOnSale,
    discountPercent,
    defaultVariantId: item.defaultVariantId,
    rating,
    reviewCount,
    inStock,
  };
}

function MoveToCartButton({ item }: { item: WishlistItemView }) {
  const { addItem, toggleWishlist, pendingKeys } = useCartWishlist();
  const [error, setError] = useState<string | null>(null);

  if (!item.isAvailable || !item.defaultVariantId) {
    return (
      <Button size="sm" variant="outline" disabled className="w-full">
        Unavailable
      </Button>
    );
  }

  if (item.hasMultipleVariants) {
    return (
      <Button href={`/products/${item.slug}`} size="sm" variant="outline" className="w-full">
        Select Options
      </Button>
    );
  }

  const isPending = pendingKeys.has(`add:${item.defaultVariantId}`);

  async function handleClick() {
    setError(null);
    try {
      await addItem(item.defaultVariantId as string, 1);
      // "Move" — not just "add" — so the item leaves the wishlist once it's
      // actually in the cart, matching the button's own label.
      await toggleWishlist(item.productId);
    } catch {
      setError("Couldn't move this item to your cart.");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button size="sm" variant="outline" className="w-full" isLoading={isPending} onClick={() => void handleClick()}>
        Move to Cart
      </Button>
      {error ? (
        <p role="alert" className="text-xs text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function WishlistView() {
  const { status } = useAuth();
  const { wishlist, isWishlistLoading, wishlistError, refreshWishlist } = useCartWishlist();
  const { marketCode } = useMarket();
  const [cards, setCards] = useState<Record<string, NormalizedProductCard>>({});

  useEffect(() => {
    if (!wishlist) return;
    let cancelled = false;
    Promise.all(
      wishlist.items.map((item) => toCardData(item, marketCode).then((card) => [item.productId, card] as const))
    ).then((entries) => {
      if (!cancelled) setCards(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [wishlist, marketCode]);

  if (status === "unauthenticated") {
    return (
      <EmptyState
        icon={<Heart className="h-8 w-8" aria-hidden />}
        title="Sign in to view your wishlist"
        description="Your wishlist is tied to your account. Sign in to see items you've saved."
        action={<Button href="/login?redirect=%2Faccount%2Fwishlist">Sign In</Button>}
      />
    );
  }

  if (isWishlistLoading && !wishlist) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (wishlistError && !wishlist) {
    return <ErrorState message={wishlistError} onRetry={() => void refreshWishlist()} />;
  }

  if (!wishlist || wishlist.items.length === 0) {
    return (
      <EmptyState
        icon={<Heart className="h-8 w-8" aria-hidden />}
        title="Your wishlist is empty"
        description="Save products you love to find them here later."
        action={<Button href="/products">Browse Products</Button>}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {wishlistError ? (
        <p role="alert" className="rounded-md border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">
          {wishlistError}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {wishlist.items.map((item) => {
          const card = cards[item.productId];
          if (!card) return <Skeleton key={item.productId} className="h-64 w-full" />;
          return (
            <div key={item.productId} className="flex flex-col gap-2">
              <ProductCard product={card} />
              {!item.isAvailable ? (
                <p className="text-xs font-medium text-error">No longer available</p>
              ) : null}
              <MoveToCartButton item={item} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
