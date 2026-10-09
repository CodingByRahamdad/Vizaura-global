"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProductCard } from "@/components/catalog/ProductCard";
import { getProductCards, toNormalizedCard, type NormalizedProductCard } from "@/lib/api/catalog";
import { useMarket } from "@/context/MarketContext";

const RECOMMENDATION_COUNT = 6;

/**
 * No per-cart recommendation endpoint exists in the backend (catalog only
 * supports listing/filtering, confirmed during exploration). Reuses the same
 * getProductCards() call RelatedProducts.tsx makes on the product detail
 * page, just without a single category filter since a cart can span many —
 * fetches a wider page and excludes whatever is already in the cart client-
 * side, same "real data, no hardcoded products" rule either way.
 */
export function CartRecommendations({ excludeProductIds }: { excludeProductIds: string[] }) {
  const { marketCode } = useMarket();
  const [cards, setCards] = useState<NormalizedProductCard[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getProductCards({ market: marketCode, limit: RECOMMENDATION_COUNT + excludeProductIds.length })
      .then(({ items }) => {
        if (cancelled) return;
        const filtered = items
          .filter((item) => !excludeProductIds.includes(item.id))
          .slice(0, RECOMMENDATION_COUNT)
          .map(toNormalizedCard);
        setCards(filtered);
      })
      .catch(() => {
        if (!cancelled) setCards([]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketCode, excludeProductIds.join(",")]);

  if (cards !== null && cards.length === 0) return null;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-text">You Might Also Like</h2>
          <p className="text-sm text-text-secondary">
            Complete your wellness journey with these popular products.
          </p>
        </div>
        <Link href="/products" className="shrink-0 text-sm font-medium text-primary-dark hover:underline">
          View All Products →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {(cards ?? Array.from({ length: RECOMMENDATION_COUNT })).map((product, index) =>
          product ? (
            <ProductCard key={(product as NormalizedProductCard).id} product={product as NormalizedProductCard} />
          ) : (
            <div key={index} className="aspect-[3/4] animate-pulse rounded-lg bg-primary-light/30" />
          )
        )}
      </div>
    </section>
  );
}
