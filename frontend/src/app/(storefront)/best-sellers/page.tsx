import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { ErrorState } from "@/components/ui/ErrorState";
import { ShopResults } from "@/components/catalog/ShopResults";
import { ShopSearchForm } from "@/components/catalog/ShopSearchForm";
import { TrustBadges } from "@/components/home/TrustBadges";
import { getCategoriesWithCounts, getProductCards, toNormalizedCard } from "@/lib/api/catalog";
import { getServerMarket } from "@/lib/market";

const PAGE_SIZE = 12;

interface BestSellersPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function BestSellersPage({ searchParams }: BestSellersPageProps) {
  const params = await searchParams;
  const page = Number(params.page) > 0 ? Number(params.page) : 1;
  const category = typeof params.category === "string" ? params.category : undefined;
  const search = typeof params.q === "string" ? params.q : undefined;
  const market = await getServerMarket();

  let listResult;
  try {
    listResult = await getProductCards({
      page,
      limit: PAGE_SIZE,
      category,
      search,
      market,
      badge: "BEST_SELLER",
    });
  } catch {
    return (
      <Container>
        <Section>
          <ErrorState message="Couldn't load best sellers right now." />
        </Section>
      </Container>
    );
  }

  const { items, pagination } = listResult;
  const cards = items.map(toNormalizedCard);

  const categoriesWithCounts = await getCategoriesWithCounts(market).catch(() => []);
  const activeCategory = category ? categoriesWithCounts.find((c) => c.id === category) : undefined;

  return (
    <>
      <Container>
        <div className="flex flex-col gap-3 py-6">
          <Breadcrumb
            items={[
              { label: "Home", href: "/" },
              activeCategory ? { label: "Best Sellers", href: "/best-sellers" } : { label: "Best Sellers" },
              ...(activeCategory ? [{ label: activeCategory.name }] : []),
            ]}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="font-serif text-2xl font-semibold text-text md:text-3xl">Best Sellers</h1>
              <p className="mt-1 text-sm text-text-secondary">Our customers&apos; most-loved products.</p>
            </div>
            <ShopSearchForm />
          </div>
        </div>

        <Section className="pt-0 md:pt-0">
          <ShopResults
            products={cards}
            pagination={pagination}
            categoriesWithCounts={categoriesWithCounts}
            activeCategoryId={category}
            searchTerm={search}
          />
        </Section>
      </Container>

      <TrustBadges />
    </>
  );
}
