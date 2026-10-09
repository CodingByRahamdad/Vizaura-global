import { Suspense } from "react";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { ProductGridSkeleton } from "@/components/catalog/ProductGridSkeleton";
import { HeroSection } from "@/components/home/HeroSection";
import { CategorySection } from "@/components/home/CategorySection";
import { FeaturedProducts } from "@/components/home/FeaturedProducts";
import { CategoryProducts } from "@/components/home/CategoryProducts";
import { TrustBadges } from "@/components/home/TrustBadges";
import { PromoBanner } from "@/components/home/PromoBanner";
import { Testimonials } from "@/components/home/Testimonials";
import { OurStorySection } from "@/components/home/OurStorySection";
import { getCategories } from "@/lib/api/catalog";

export default async function HomePage() {
  const categories = await getCategories().catch(() => []);

  return (
    <>
      <HeroSection />

      <Container>
        <Section>
          <CategorySection categories={categories} />
        </Section>
      </Container>

      <Container>
        <Section>
          <Suspense fallback={<ProductGridSkeleton count={6} />}>
            <FeaturedProducts
              id="top-rated-products"
              overline="Best Sellers"
              heading="Top Rated Products"
              limit={6}
              page={1}
            />
          </Suspense>
        </Section>
      </Container>

      <TrustBadges />

      <PromoBanner />

      <Container>
        <Section>
          <Suspense fallback={<ProductGridSkeleton count={6} />}>
            <CategoryProducts id="category-products" />
          </Suspense>
        </Section>
      </Container>

      <Container>
        <Section>
          <Suspense fallback={<ProductGridSkeleton count={3} />}>
            <Testimonials />
          </Suspense>
        </Section>
      </Container>

      <OurStorySection />
    </>
  );
}
