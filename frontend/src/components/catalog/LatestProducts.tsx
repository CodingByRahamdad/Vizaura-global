import { ProductCard } from "@/components/catalog/ProductCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { getProductCards, toNormalizedCard } from "@/lib/api/catalog";
import { getServerMarket } from "@/lib/market";

export async function LatestProducts({ limit = 8 }: { limit?: number }) {
  const market = await getServerMarket();

  let items;
  try {
    ({ items } = await getProductCards({ limit, market }));
  } catch {
    return <ErrorState message="Couldn't load products right now." />;
  }

  if (items.length === 0) {
    return <EmptyState title="No products yet" description="Check back soon." />;
  }

  const cards = items.map(toNormalizedCard);

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {cards.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
