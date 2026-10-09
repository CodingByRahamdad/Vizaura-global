import Link from "next/link";
import { ProductCard } from "@/components/catalog/ProductCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { getProductCards, toNormalizedCard } from "@/lib/api/catalog";
import { getServerMarket } from "@/lib/market";

interface FeaturedProductsProps {
  id: string;
  overline: string;
  heading: string;
  viewAllHref?: string;
  limit?: number;
  page?: number;
}

/**
 * Used twice on Home ("Top Rated Products" page 1, "Trending Now" page 2) —
 * two different real pages of the catalog, since there is still no
 * best-seller/trending signal backend-side (Product model has no such
 * field). This gives the two sections genuinely different real products
 * without fabricating a flag. Rating/review count now comes from the real
 * Reviews module (backend/src/modules/reviews).
 */
export async function FeaturedProducts({
  id,
  overline,
  heading,
  viewAllHref = "/products",
  limit = 6,
  page = 1,
}: FeaturedProductsProps) {
  const market = await getServerMarket();
  let items: Awaited<ReturnType<typeof getProductCards>>["items"] = [];
  let loadFailed = false;

  try {
    ({ items } = await getProductCards({ limit, page, market }));
  } catch {
    loadFailed = true;
  }

  const cards = loadFailed ? [] : items.map(toNormalizedCard);

  return (
    <div id={id}>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-green">
            {overline}
          </p>
          <h2 className="font-serif text-2xl font-semibold text-text">{heading}</h2>
        </div>
        <Link href={viewAllHref} className="text-sm font-medium text-primary hover:underline">
          View All
        </Link>
      </div>

      {loadFailed ? (
        <ErrorState message="Couldn't load products right now." />
      ) : cards.length === 0 ? (
        <EmptyState title="No products yet" description="Check back soon." />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {cards.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
