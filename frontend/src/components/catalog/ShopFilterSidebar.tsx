"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Filter, LayoutGrid, SlidersHorizontal, Star, Tag, Truck } from "lucide-react";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import type { CategoryWithCount, NormalizedProductCard } from "@/lib/api/catalog";

export interface ShopClientFilters {
  priceMin: number;
  priceMax: number;
  availability: "all" | "in_stock" | "out_of_stock";
  onSaleOnly: boolean;
  minRating: number | null;
}

export const DEFAULT_CLIENT_FILTERS: ShopClientFilters = {
  priceMin: 0,
  priceMax: Number.POSITIVE_INFINITY,
  availability: "all",
  onSaleOnly: false,
  minRating: null,
};

interface ShopFilterSidebarProps {
  categories: CategoryWithCount[];
  activeCategoryId?: string;
  /** The current real page of products — used to compute real (but page-scoped) counts and price bounds. */
  products: NormalizedProductCard[];
  filters: ShopClientFilters;
  onFiltersChange: (next: ShopClientFilters) => void;
}

const RATING_TIERS = [5, 4, 3, 2, 1];

function FilterGroup({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Filter;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border py-4 first:pt-0 last:border-b-0">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" aria-hidden />
        <h3 className="text-sm font-semibold text-text">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export function ShopFilterSidebar({
  categories,
  activeCategoryId,
  products,
  filters,
  onFiltersChange,
}: ShopFilterSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);

  function goToCategory(categoryId: string | undefined) {
    const params = new URLSearchParams(searchParams.toString());
    if (categoryId) params.set("category", categoryId);
    else params.delete("category");
    params.delete("page");
    router.push(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`);
  }

  // Real, but page-scoped: computed from the 12 real products already
  // fetched for the current page, not a catalog-wide aggregate (no backend
  // support for availability/discount/rating filtering — see plan doc).
  const counts = useMemo(() => {
    const inStock = products.filter((p) => p.inStock === true).length;
    const outOfStock = products.filter((p) => p.inStock === false).length;
    const onSale = products.filter((p) => p.isOnSale).length;
    const byRating = Object.fromEntries(
      RATING_TIERS.map((tier) => [tier, products.filter((p) => p.rating !== null && p.rating >= tier).length])
    ) as Record<number, number>;
    return { inStock, outOfStock, onSale, byRating };
  }, [products]);

  const priceCeiling = useMemo(() => {
    const amounts = products.map((p) => p.priceAmount).filter((a): a is number => a !== null);
    if (amounts.length === 0) return 50000;
    const maxMajorUnits = Math.max(...amounts) / 100;
    return Math.max(1000, Math.ceil(maxMajorUnits / 500) * 500);
  }, [products]);

  const effectiveMax = filters.priceMax === Number.POSITIVE_INFINITY ? priceCeiling : filters.priceMax;

  const content = (
    <>
      <FilterGroup icon={LayoutGrid} title="Categories">
        <div className="flex flex-col gap-2">
          {categories.map((category) => (
            <Checkbox
              key={category.id}
              id={`category-${category.id}`}
              label={`${category.name} (${category.productCount})`}
              checked={activeCategoryId === category.id}
              onChange={() => goToCategory(activeCategoryId === category.id ? undefined : category.id)}
            />
          ))}
        </div>
      </FilterGroup>

      <FilterGroup icon={SlidersHorizontal} title="Price Range">
        <div className="flex flex-col gap-3">
          <input
            type="range"
            min={0}
            max={priceCeiling}
            step={100}
            value={effectiveMax}
            onChange={(event) =>
              onFiltersChange({ ...filters, priceMax: Number(event.target.value) })
            }
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary"
            aria-label="Maximum price"
          />
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <span>PKR {filters.priceMin.toLocaleString()}</span>
            <span>–</span>
            <span>PKR {effectiveMax.toLocaleString()}</span>
          </div>
        </div>
      </FilterGroup>

      <FilterGroup icon={Truck} title="Availability">
        <div className="flex flex-col gap-2">
          <Checkbox
            id="availability-in-stock"
            label={`In Stock (${counts.inStock})`}
            checked={filters.availability === "in_stock"}
            onChange={() =>
              onFiltersChange({
                ...filters,
                availability: filters.availability === "in_stock" ? "all" : "in_stock",
              })
            }
          />
          <Checkbox
            id="availability-out-of-stock"
            label={`Out of Stock (${counts.outOfStock})`}
            checked={filters.availability === "out_of_stock"}
            onChange={() =>
              onFiltersChange({
                ...filters,
                availability: filters.availability === "out_of_stock" ? "all" : "out_of_stock",
              })
            }
          />
        </div>
      </FilterGroup>

      <FilterGroup icon={Tag} title="Discount">
        <Checkbox
          id="discount-on-sale"
          label={`On Sale (${counts.onSale})`}
          checked={filters.onSaleOnly}
          onChange={() => onFiltersChange({ ...filters, onSaleOnly: !filters.onSaleOnly })}
        />
      </FilterGroup>

      <FilterGroup icon={Star} title="Rating">
        <div className="flex flex-col gap-2">
          {RATING_TIERS.map((tier) => (
            <label
              key={tier}
              htmlFor={`rating-${tier}`}
              className="flex cursor-pointer items-center gap-2 text-sm text-text"
            >
              <input
                id={`rating-${tier}`}
                type="checkbox"
                checked={filters.minRating === tier}
                onChange={() =>
                  onFiltersChange({ ...filters, minRating: filters.minRating === tier ? null : tier })
                }
                className="h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/30"
              />
              <span className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={cn("h-3.5 w-3.5", i < tier ? "fill-warning text-warning" : "text-border")}
                    aria-hidden
                  />
                ))}
              </span>
              <span className="text-text-secondary">({counts.byRating[tier] ?? 0})</span>
            </label>
          ))}
        </div>
      </FilterGroup>
    </>
  );

  return (
    <aside className="w-full lg:w-64 lg:shrink-0">
      <Button
        variant="outline"
        size="sm"
        className="mb-4 w-full lg:hidden"
        onClick={() => setMobileOpen((open) => !open)}
        aria-expanded={mobileOpen}
      >
        <Filter className="h-4 w-4" aria-hidden />
        {mobileOpen ? "Hide Filters" : "Show Filters"}
      </Button>

      <div className={cn("rounded-lg border border-border bg-surface p-4", !mobileOpen && "hidden lg:block")}>
        {content}
      </div>
    </aside>
  );
}
