"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LayoutGrid, List } from "lucide-react";
import { ProductCard } from "@/components/catalog/ProductCard";
import { ShopFilterSidebar, DEFAULT_CLIENT_FILTERS, type ShopClientFilters } from "@/components/catalog/ShopFilterSidebar";
import { ShopPagination } from "@/components/catalog/ShopPagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/utils/cn";
import type { CategoryWithCount, NormalizedProductCard } from "@/lib/api/catalog";
import type { PaginationMeta } from "@/lib/types/catalog";

interface ShopResultsProps {
  products: NormalizedProductCard[];
  pagination: PaginationMeta;
  categoriesWithCounts: CategoryWithCount[];
  activeCategoryId?: string;
  searchTerm?: string;
}

type SortOption = "newest" | "price_asc" | "price_desc" | "rating_desc" | "name_asc";

const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: "Sort by: Newest", value: "newest" },
  { label: "Price: Low to High", value: "price_asc" },
  { label: "Price: High to Low", value: "price_desc" },
  { label: "Highest Rated", value: "rating_desc" },
  { label: "Name: A to Z", value: "name_asc" },
];

/**
 * Sort + the sidebar's price/availability/discount/rating filters are all
 * applied client-side, over just the current real page of products (not a
 * catalog-wide re-query) — the backend has no sort param and no
 * price/availability/discount/rating filter on GET /products. Real data,
 * page-scoped limitation — see the Shop Page Rebuild plan doc.
 */
function applyFilters(products: NormalizedProductCard[], filters: ShopClientFilters): NormalizedProductCard[] {
  return products.filter((product) => {
    if (product.priceAmount !== null) {
      const majorUnits = product.priceAmount / 100;
      if (majorUnits < filters.priceMin) return false;
      if (filters.priceMax !== Number.POSITIVE_INFINITY && majorUnits > filters.priceMax) return false;
    }
    if (filters.availability === "in_stock" && product.inStock !== true) return false;
    if (filters.availability === "out_of_stock" && product.inStock !== false) return false;
    if (filters.onSaleOnly && !product.isOnSale) return false;
    if (filters.minRating !== null && (product.rating === null || product.rating < filters.minRating)) return false;
    return true;
  });
}

function sortProducts(products: NormalizedProductCard[], sort: SortOption): NormalizedProductCard[] {
  const sorted = [...products];
  switch (sort) {
    case "price_asc":
      return sorted.sort((a, b) => (a.priceAmount ?? Infinity) - (b.priceAmount ?? Infinity));
    case "price_desc":
      return sorted.sort((a, b) => (b.priceAmount ?? -Infinity) - (a.priceAmount ?? -Infinity));
    case "rating_desc":
      return sorted.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
    case "name_asc":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "newest":
    default:
      return sorted;
  }
}

export function ShopResults({
  products,
  pagination,
  categoriesWithCounts,
  activeCategoryId,
  searchTerm,
}: ShopResultsProps) {
  const [filters, setFilters] = useState<ShopClientFilters>(DEFAULT_CLIENT_FILTERS);
  const [sort, setSort] = useState<SortOption>("newest");
  const [view, setView] = useState<"grid" | "list">("grid");

  const visible = useMemo(() => sortProducts(applyFilters(products, filters), sort), [products, filters, sort]);

  const rangeStart = products.length === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const rangeEnd = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <ShopFilterSidebar
        categories={categoriesWithCounts}
        activeCategoryId={activeCategoryId}
        products={products}
        filters={filters}
        onFiltersChange={setFilters}
      />

      <div className="min-w-0 flex-1">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-text-secondary">
            {products.length === 0
              ? "No products found"
              : `Showing ${rangeStart}-${rangeEnd} of ${pagination.total} products`}
          </p>
          <div className="flex items-center gap-2">
            <Select
              options={SORT_OPTIONS}
              value={sort}
              onChange={(event) => setSort(event.target.value as SortOption)}
              className="h-9 w-auto min-w-[180px] text-sm"
              aria-label="Sort products"
            />
            <div className="flex items-center overflow-hidden rounded-md border border-border">
              <button
                type="button"
                aria-label="Grid view"
                aria-pressed={view === "grid"}
                onClick={() => setView("grid")}
                className={cn(
                  "flex h-9 w-9 items-center justify-center transition-colors",
                  view === "grid" ? "bg-primary text-white" : "bg-surface text-text-secondary hover:bg-primary-light/30"
                )}
              >
                <LayoutGrid className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                aria-label="List view"
                aria-pressed={view === "list"}
                onClick={() => setView("list")}
                className={cn(
                  "flex h-9 w-9 items-center justify-center border-l border-border transition-colors",
                  view === "list" ? "bg-primary text-white" : "bg-surface text-text-secondary hover:bg-primary-light/30"
                )}
              >
                <List className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            title={searchTerm ? `No results for "${searchTerm}"` : "No products match your filters"}
            description="Try a different search or adjust your filters."
            action={
              <Link href="/products" className="text-sm font-medium text-primary hover:underline">
                View all products
              </Link>
            }
          />
        ) : (
          <div
            className={cn(
              view === "grid"
                ? "grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4"
                : "flex flex-col gap-3"
            )}
          >
            {visible.map((product) => (
              <ProductCard key={product.id} product={product} layout={view} />
            ))}
          </div>
        )}

        <ShopPagination pagination={pagination} />
      </div>
    </div>
  );
}
