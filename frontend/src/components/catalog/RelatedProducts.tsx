import { ProductCard } from "@/components/catalog/ProductCard";
import { getProductCards, toNormalizedCard } from "@/lib/api/catalog";

interface RelatedProductsProps {
  categoryId: string;
  excludeProductId: string;
  market: string;
}

export async function RelatedProducts({ categoryId, excludeProductId, market }: RelatedProductsProps) {
  let items;
  try {
    ({ items } = await getProductCards({ category: categoryId, market, limit: 5 }));
  } catch {
    return null;
  }

  const cards = items.filter((item) => item.id !== excludeProductId).slice(0, 4).map(toNormalizedCard);
  if (cards.length === 0) return null;

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="font-serif text-2xl font-semibold text-text">You May Also Like</h2>
        <p className="text-sm text-text-secondary">More products from the same category</p>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
