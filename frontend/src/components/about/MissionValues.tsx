import { ArrowRight, Globe2, Heart, Leaf, ShieldCheck } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { AboutSectionHeader } from "@/components/about/AboutSectionHeader";
import { FeatureColumns, type FeatureItem } from "@/components/about/FeatureColumns";

const VALUES: FeatureItem[] = [
  { icon: Leaf, title: "Purity", description: "Sourced from pristine regions, free from harmful additives." },
  { icon: ShieldCheck, title: "Quality", description: "Lab-tested and crafted to the highest standards." },
  { icon: Heart, title: "Wellness", description: "Products that nourish body and mind, every day." },
  { icon: Globe2, title: "Sustainability", description: "Responsible sourcing that respects people and planet." },
];

export function MissionValues() {
  return (
    <Section aria-labelledby="mission-heading" className="bg-cream py-12 md:py-16">
      <Container className="grid grid-cols-1 items-center gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.85fr)] xl:gap-12">
        <div className="flex max-w-md flex-col gap-4">
          <AboutSectionHeader id="mission-heading" eyebrow="Our Mission & Values" title="What Drives Us" />
          <p className="text-sm leading-relaxed text-text-secondary md:text-base">
            Our mission is to make pure, natural wellness accessible to everyone — without compromise on quality,
            honesty or the planet we share.
          </p>
          <Button href="#our-story" size="sm" className="mt-1 w-fit rounded-full bg-forest hover:bg-primary">
            Our Story <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>

        <FeatureColumns items={VALUES} iconVariant="blob" />
      </Container>
    </Section>
  );
}
