import Link from "next/link";
import { CategoryTile } from "@/components/catalog/CategoryTile";
import { EmptyState } from "@/components/ui/EmptyState";
import type { CategoryResponse } from "@/lib/types/catalog";

interface CategorySectionProps {
  categories: CategoryResponse[];
}

export function CategorySection({ categories }: CategorySectionProps) {
  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-green">
            Shop by Category
          </p>
          <h2 className="font-serif text-2xl font-semibold text-text">Explore Our Categories</h2>
        </div>
        <Link href="/categories" className="text-sm font-medium text-primary hover:underline">
          View All Categories
        </Link>
      </div>
      {categories.length === 0 ? (
        <EmptyState title="No categories yet" description="Check back soon." />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {categories.map((category) => (
            <CategoryTile key={category.id} category={category} />
          ))}
        </div>
      )}
    </>
  );
}
