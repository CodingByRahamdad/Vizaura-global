import { Container } from "@/components/ui/Container";
import { SafeImage } from "@/components/ui/SafeImage";
import { getAboutHeroContent } from "@/components/about/aboutHeroContent";

/**
 * Single static banner, not a carousel — same precedent as ShopHero (no
 * slide data to cycle through, so no arrow controls: a non-functional
 * button would be a real accessibility regression).
 */
export function AboutHero() {
  const hero = getAboutHeroContent();

  return (
    <section aria-labelledby="about-hero-heading" className="relative overflow-hidden">
      <div className="absolute inset-0">
        <SafeImage
          src={hero.imageUrl}
          alt={hero.imageAlt}
          fallback={<span />}
          className="absolute inset-0 object-[70%_center]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/50 to-black/25 md:via-black/40 md:to-transparent" />
      </div>

      <Container className="relative z-10">
        <div className="flex min-h-[240px] flex-col justify-center gap-3 py-12 md:min-h-[280px] md:py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-warning">{hero.overline}</p>
          <h1
            id="about-hero-heading"
            className="max-w-md font-serif text-3xl font-semibold leading-tight text-white md:text-4xl lg:text-[2.75rem]"
          >
            {hero.heading}
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-white/85 md:text-base">{hero.description}</p>
        </div>
      </Container>
    </section>
  );
}
