import { Globe2, Heart, Leaf, Users } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SafeImage } from "@/components/ui/SafeImage";
import { AboutSectionHeader } from "@/components/about/AboutSectionHeader";
import { FeatureColumns, type FeatureItem } from "@/components/about/FeatureColumns";

const IMPACT_ITEMS: FeatureItem[] = [
  { icon: Leaf, title: "Natural Ingredients", description: "Pure, traceable sourcing from nature's best." },
  { icon: Users, title: "Healthier Communities", description: "Supporting local harvesters and their families." },
  { icon: Globe2, title: "A Greener Planet", description: "Mindful packaging and sustainable practices." },
  { icon: Heart, title: "Lasting Wellness", description: "Helping you build healthy habits for life." },
];

/**
 * bg-forest (not bg-footer) — this section sits directly above the global
 * footer, and needs to read as visibly lighter/greener than it so the two
 * don't visually merge into one block.
 */
export function ImpactSection() {
  return (
    <Section aria-labelledby="impact-heading" className="relative overflow-hidden bg-forest py-14 md:py-20">
      <div aria-hidden className="absolute inset-0">
        <SafeImage
          src="/about-us/about-4.webp"
          alt=""
          fallback={<span />}
          className="absolute inset-0 object-top opacity-99"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-forest via-forest/85 to-forest/60" />
      </div>

      <Container className="relative z-10 grid grid-cols-1 items-center gap-10 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] xl:gap-14">
        <div className="flex max-w-md flex-col gap-4">
          <AboutSectionHeader id="impact-heading" tone="dark" eyebrow="Our Impact" title="A Healthier Future Together" />
          <p className="text-sm leading-relaxed text-white/75 md:text-base">
            Every choice we make — from the source to your doorstep — is guided by a commitment to people,
            communities and the planet.
          </p>
        </div>

        <FeatureColumns items={IMPACT_ITEMS} tone="dark" />
      </Container>
    </Section>
  );
}
