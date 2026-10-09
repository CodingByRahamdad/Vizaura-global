import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { ErrorState } from "@/components/ui/ErrorState";
import { ShopHero } from "@/components/catalog/ShopHero";
import { ShopResults } from "@/components/catalog/ShopResults";
import { ShopSearchForm } from "@/components/catalog/ShopSearchForm";
import { TrustBadges } from "@/components/home/TrustBadges";
import { PromoBanner } from "@/components/home/PromoBanner";
import { getCategoriesWithCounts, getProductCards, toNormalizedCard } from "@/lib/api/catalog";
import { getServerMarket } from "@/lib/market";

const PAGE_SIZE = 12;

export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const params = await searchParams;
  const page = Number(params.page) > 0 ? Number(params.page) : 1;
  const category = typeof params.category === "string" ? params.category : undefined;
  const search = typeof params.q === "string" ? params.q : undefined;
  const market = await getServerMarket();

  let listResult;
  try {
    listResult = await getProductCards({ page, limit: PAGE_SIZE, category, search, market });
  } catch {
    return (
      <Container>
        <Section>
          <ErrorState message="Couldn't load products right now." />
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
      <ShopHero />

      <Container>
        <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Breadcrumb
            items={[
              { label: "Home", href: "/" },
              activeCategory ? { label: "Shop", href: "/products" } : { label: "Shop" },
              ...(activeCategory ? [{ label: activeCategory.name }] : []),
            ]}
          />
          <ShopSearchForm />
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

      <PromoBanner />

      <TrustBadges />
    </>
  );
}
