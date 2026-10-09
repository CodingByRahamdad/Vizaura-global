import { Award, Headset, Leaf, Truck } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SafeImage } from "@/components/ui/SafeImage";
import { AboutSectionHeader } from "@/components/about/AboutSectionHeader";
import { FeatureColumns, type FeatureItem } from "@/components/about/FeatureColumns";

const WHY_ITEMS: FeatureItem[] = [
  { icon: Award, title: "Premium Quality", description: "Only the finest, carefully selected ingredients." },
  { icon: Leaf, title: "100% Natural", description: "No fillers or artificial chemicals — just nature." },
  { icon: Truck, title: "Fast & Secure Delivery", description: "Reliable shipping across Pakistan and the UAE." },
  { icon: Headset, title: "Dedicated Support", description: "Real people, ready to help every step of the way." },
];

/**
 * The one section whose image bleeds to the viewport's right edge instead
 * of sitting in a boxed container — `right: calc(50% - 50vw)` pushes it past
 * the Container's own edge; the section needs overflow-hidden since 50vw
 * overshoots by the scrollbar width.
 */
export function WhyChooseUs() {
  return (
    <Section aria-labelledby="why-heading" className="relative overflow-hidden bg-surface py-0">
      <Container className="relative">
        <div className="flex flex-col gap-10 py-12 md:py-16 xl:w-[62%] xl:pr-10">
          <AboutSectionHeader
            id="why-heading"
            eyebrow="Why Choose Us"
            title={
              <>
                The <span className="text-primary">VIZAURA</span> Difference
              </>
            }
          />
          <FeatureColumns items={WHY_ITEMS} align="start" />
        </div>

        <div
          className="relative mb-12 aspect-[16/10] w-full overflow-hidden rounded-xl md:mb-16
                     xl:absolute xl:inset-y-0 xl:left-[64%] xl:right-[calc(50%_-_50vw)] xl:mb-0 xl:aspect-auto xl:w-auto xl:rounded-none"
        >
          <SafeImage src="/Slider-images/Banner-3.webp" alt="Natural tinctures and dried herbs" className="absolute inset-0" />
          <div aria-hidden className="absolute inset-y-0 left-0 hidden w-3/3 bg-gradient-to-r from-surface to-transparent xl:block" />
        </div>
      </Container>
    </Section>
  );
}
