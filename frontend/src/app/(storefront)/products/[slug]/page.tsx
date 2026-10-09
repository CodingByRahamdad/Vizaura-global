import { notFound } from "next/navigation";
import { Leaf, FlaskConical, ShieldCheck, Globe, Truck, RotateCcw, Lock } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { ProductGallery } from "@/components/catalog/ProductGallery";
import { ProductRating } from "@/components/catalog/ProductRating";
import { ProductTabs } from "@/components/catalog/ProductTabs";
import { ProductReviews } from "@/components/catalog/ProductReviews";
import { ProductTrustSidebar } from "@/components/catalog/ProductTrustSidebar";
import { RelatedProducts } from "@/components/catalog/RelatedProducts";
import { VariantSelector } from "@/components/catalog/VariantSelector";
import { MarketSelectorStrip } from "@/components/catalog/MarketSelectorStrip";
import { ApiError } from "@/lib/api";
import { getProductBySlug, getVariantPrice, getVariantStock } from "@/lib/api/catalog";
import { getRatingSummary } from "@/lib/api/reviews";
import { getServerMarket } from "@/lib/market";

const TRUST_ROW = [
  { icon: Leaf, label: "100% Natural Ingredients" },
  { icon: FlaskConical, label: "Lab Tested & Certified" },
  { icon: ShieldCheck, label: "Pure & Authentic" },
  { icon: Globe, label: "Sustainably Sourced" },
];

const TRUST_STRIP = [
  { icon: Truck, title: "Free Shipping", description: "On orders above the market minimum" },
  { icon: RotateCcw, title: "7 Days Return", description: "Easy return policy" },
  { icon: Lock, title: "Secure Payment", description: "100% secure checkout" },
];

export default async function ProductDetailPage({ params }: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const market = await getServerMarket();

  let product;
  try {
    product = await getProductBySlug(slug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const defaultVariant = product.variants.find((v) => v.isDefault) ?? product.variants[0];

  const [initialPrice, initialStock, ratingSummary] = await Promise.all([
    defaultVariant
      ? getVariantPrice(product.id, defaultVariant.id, market).catch(() => null)
      : Promise.resolve(null),
    defaultVariant
      ? getVariantStock(product.id, defaultVariant.id, market).catch(() => null)
      : Promise.resolve(null),
    getRatingSummary(product.id).catch(() => null),
  ]);

  const primaryCategory = product.categories[0];

  return (
    <Container>
      <Section className="pt-2 pb-0 md:pt-2 md:pb-0">
        <div className="mb-[10px]">
          <Breadcrumb
            items={[
              { label: "Home", href: "/" },
              { label: "Shop", href: "/products" },
              ...(primaryCategory ? [{ label: primaryCategory.name, href: `/products?category=${primaryCategory.id}` }] : []),
              { label: product.name },
            ]}
          />
        </div>
      </Section>

      <Section className="grid grid-cols-1 gap-10 py-0 md:py-0 xl:grid-cols-[auto_1fr_240px]">
        <div className="self-start">
          <ProductGallery
            media={product.media}
            productName={product.name}
            productId={product.id}
            badge={product.badge}
          />
        </div>

        <div className="flex flex-col gap-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-green">VIZAURA GLOBAL</p>

          <h1 className="font-serif text-3xl font-semibold text-text md:text-4xl">{product.name}</h1>

          <ProductRating
            averageRating={ratingSummary?.averageRating ?? null}
            reviewCount={ratingSummary?.reviewCount ?? 0}
          />

          {product.shortDescription ? (
            <p className="text-text-secondary">{product.shortDescription}</p>
          ) : null}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {TRUST_ROW.map((item) => (
              <div key={item.label} className="flex flex-col items-center gap-1.5 text-center">
                <item.icon className="h-5 w-5 text-primary" aria-hidden />
                <span className="text-xs text-text-secondary">{item.label}</span>
              </div>
            ))}
          </div>

          {defaultVariant ? (
            <VariantSelector
              key={market}
              productId={product.id}
              options={product.options}
              variants={product.variants}
              initialVariantId={defaultVariant.id}
              initialPrice={initialPrice}
              initialStock={initialStock}
            />
          ) : (
            <p className="text-text-secondary">This product has no purchasable variants yet.</p>
          )}

          <p className="text-xs text-text-secondary">Tax included. Shipping calculated at checkout.</p>

          <div className="grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-3">
            {TRUST_STRIP.map((item) => (
              <div key={item.title} className="flex items-start gap-2">
                <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <div>
                  <p className="text-xs font-semibold text-text">{item.title}</p>
                  <p className="text-xs text-text-secondary">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <ProductTrustSidebar />
      </Section>

      <Section className="py-0">
        <MarketSelectorStrip />
      </Section>

      <Section className="flex flex-col gap-10">
        <ProductTabs
          description={product.description}
          specifications={product.specifications}
          benefits={product.benefits}
          ingredients={product.ingredients}
          certifications={product.certifications}
          storageInstructions={product.storageInstructions}
          shelfLife={product.shelfLife}
          reviews={<ProductReviews productId={product.id} />}
        />

        {primaryCategory ? (
          <RelatedProducts categoryId={primaryCategory.id} excludeProductId={product.id} market={market} />
        ) : null}
      </Section>
    </Container>
  );
}
