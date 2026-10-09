import { Leaf } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SafeImage } from "@/components/ui/SafeImage";
import { AboutSectionHeader } from "@/components/about/AboutSectionHeader";

export function OurTeam() {
  return (
    <Section aria-labelledby="team-heading" className="bg-bg py-12 md:py-16">
      <Container className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-14">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl">
          <SafeImage
            src="/about-us/about-3.webp"
            alt="Members of the VIZAURA community enjoying a natural, balanced lifestyle"
            className="absolute inset-0 object-[65%_center]"
          />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          <p
            aria-hidden
            className="absolute bottom-5 left-6 font-serif text-2xl font-medium italic leading-tight text-white/90 md:text-3xl"
          >
            Better Together
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <AboutSectionHeader id="team-heading" eyebrow="Our Team" title="People Behind VIZAURA" className="max-w-sm" />
          <p className="max-w-lg text-sm leading-relaxed text-text-secondary md:text-base">
            We are a small team of sourcing specialists, wellness enthusiasts and customer-care experts, united by a
            passion for honest, natural products and the people who use them.
          </p>
          <figure className="mt-2 flex max-w-lg items-start gap-3 rounded-xl border border-accent-green/15 bg-cream px-5 py-4">
            <Leaf className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden />
            <blockquote className="font-serif text-base font-medium italic text-forest md:text-lg">
              &ldquo;Healthy people, healthy communities, a healthier planet.&rdquo;
            </blockquote>
          </figure>
        </div>
      </Container>
    </Section>
  );
}
