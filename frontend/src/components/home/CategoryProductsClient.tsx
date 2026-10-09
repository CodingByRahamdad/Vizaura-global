"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ProductCard } from "@/components/catalog/ProductCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  getProductCards,
  toNormalizedCard,
  type CategoryWithCount,
  type NormalizedProductCard,
} from "@/lib/api/catalog";
import { cn } from "@/lib/utils/cn";

interface CategoryProductsClientProps {
  categories: CategoryWithCount[];
  initialCategoryId: string;
  initialProducts: NormalizedProductCard[];
  initialLoadFailed: boolean;
  market: string;
  overline: string;
  heading: string;
  limit: number;
}

export function CategoryProductsClient({
  categories,
  initialCategoryId,
  initialProducts,
  initialLoadFailed,
  market,
  overline,
  heading,
  limit,
}: CategoryProductsClientProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState(initialCategoryId);
  const [products, setProducts] = useState(initialProducts);
  const [isLoading, setIsLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(initialLoadFailed);
  const abortControllerRef = useRef<AbortController | null>(null);

  async function handleSelectCategory(categoryId: string) {
    if (categoryId === selectedCategoryId) return;

    setSelectedCategoryId(categoryId);
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsLoading(true);

    try {
      const { items } = await getProductCards(
        { category: categoryId, limit, market },
        { signal: controller.signal }
      );
      if (controller.signal.aborted) return;
      setProducts(items.map(toNormalizedCard));
      setLoadFailed(false);
    } catch (error) {
      if (controller.signal.aborted || (error as Error)?.name === "AbortError") return;
      setLoadFailed(true);
      setProducts([]);
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-green">
            {overline}
          </p>
          <h2 className="font-serif text-2xl font-semibold text-text">{heading}</h2>
        </div>
        <Link
          href={`/products?category=${selectedCategoryId}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          View All
        </Link>
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
        {categories.map((category) => {
          const isActive = category.id === selectedCategoryId;
          return (
            <button
              key={category.id}
              type="button"
              aria-pressed={isActive}
              disabled={isLoading}
              onClick={() => handleSelectCategory(category.id)}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                isActive
                  ? "bg-primary text-white hover:bg-primary-dark"
                  : "border border-border bg-transparent text-text hover:bg-surface"
              )}
            >
              {category.name}
            </button>
          );
        })}
      </div>

      {loadFailed ? (
        <ErrorState
          message="Couldn't load products right now."
          onRetry={() => handleSelectCategory(selectedCategoryId)}
        />
      ) : products.length === 0 && !isLoading ? (
        <EmptyState title="No products in this category" description="Check back soon." />
      ) : (
        <div
          className={cn(
            "grid grid-cols-2 gap-4 transition-opacity sm:grid-cols-3 lg:grid-cols-6",
            isLoading && "pointer-events-none opacity-50"
          )}
        >
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
