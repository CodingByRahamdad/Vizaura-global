import { CategoryProductsClient } from "@/components/home/CategoryProductsClient";
import { getCategoriesWithCounts, getProductCards, toNormalizedCard } from "@/lib/api/catalog";
import { getServerMarket } from "@/lib/market";

interface CategoryProductsProps {
  id?: string;
  overline?: string;
  heading?: string;
  limit?: number;
}

const DEFAULT_CATEGORY_SLUG = "shilajit";

/**
 * Replaces the old "Trending Now" slot (which was just page 2 of the
 * unfiltered catalog — no real trending signal exists backend-side) with a
 * real category-driven section. Resolves the default category and its
 * initial products server-side for first paint/SEO, then hands off to a
 * client component for in-place category switching.
 */
export async function CategoryProducts({
  id = "category-products",
  overline = "Shop by Category",
  heading = "Explore Our Collection",
  limit = 6,
}: CategoryProductsProps) {
  const market = await getServerMarket();
  const categories = await getCategoriesWithCounts(market).catch(() => []);

  if (categories.length === 0) return null;

  const resolvedCategory =
    categories.find((category) => category.slug === DEFAULT_CATEGORY_SLUG) ??
    [...categories].sort((a, b) => a.position - b.position)[0];

  let initialProducts: ReturnType<typeof toNormalizedCard>[] = [];
  let initialLoadFailed = false;
  try {
    const { items } = await getProductCards({ category: resolvedCategory.id, limit, market });
    initialProducts = items.map(toNormalizedCard);
  } catch {
    initialLoadFailed = true;
  }

  return (
    <div id={id}>
      <CategoryProductsClient
        categories={categories}
        initialCategoryId={resolvedCategory.id}
        initialProducts={initialProducts}
        initialLoadFailed={initialLoadFailed}
        market={market}
        overline={overline}
        heading={heading}
        limit={limit}
      />
    </div>
  );
}
