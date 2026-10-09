import { Container } from "@/components/ui/Container";
import { SafeImage } from "@/components/ui/SafeImage";
import { getCartHeroContent } from "@/components/cart/cartHeroContent";

/** Full-bleed banner, same static-content precedent as catalog/ShopHero.tsx. */
export function CartHero() {
  const hero = getCartHeroContent();
  const headingLines = hero.heading.split("\n");

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0">
        <SafeImage src={hero.imageUrl} alt="" className="h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-black/10" />
      </div>

      <Container className="relative z-10">
        <div className="flex min-h-[260px] flex-col justify-center gap-3 py-12 md:min-h-[320px] md:py-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-warning">
            {hero.overline}
          </p>
          <h1 className="max-w-lg font-serif text-3xl font-semibold leading-tight text-white md:text-5xl">
            {headingLines.map((line, index) => (
              <span key={index} className="block">
                {line}
              </span>
            ))}
          </h1>
          <p className="max-w-md text-sm text-white/80 md:text-base">{hero.description}</p>
        </div>
      </Container>
    </div>
  );
}
