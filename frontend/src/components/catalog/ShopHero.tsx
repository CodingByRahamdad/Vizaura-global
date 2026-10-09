import { Container } from "@/components/ui/Container";
import { SafeImage } from "@/components/ui/SafeImage";
import { getShopHeroContent } from "@/components/catalog/shopHeroContent";

/**
 * Single static banner, not a carousel — same precedent as PromoBanner
 * (components/home/PromoBanner.tsx) for static marketing content with no
 * backing CMS/Banner model yet.
 */
export function ShopHero() {
  const hero = getShopHeroContent();

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0">
        <SafeImage src={hero.imageUrl} alt="" className="h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/10" />
      </div>

      <Container className="relative z-10">
        <div className="flex min-h-[220px] flex-col justify-center gap-3 py-10 md:min-h-[260px] md:py-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-warning">
            {hero.overline}
          </p>
          <h1 className="max-w-lg font-serif text-3xl font-semibold text-white md:text-4xl">
            {hero.heading}
          </h1>
          <p className="max-w-md text-sm text-white/80 md:text-base">{hero.description}</p>
        </div>
      </Container>
    </div>
  );
}
