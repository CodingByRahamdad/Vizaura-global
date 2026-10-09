import type { Metadata } from "next";
import { Suspense } from "react";
import { AboutHero } from "@/components/about/AboutHero";
import { OurStory } from "@/components/about/OurStory";
import { MissionValues } from "@/components/about/MissionValues";
import { WhyChooseUs } from "@/components/about/WhyChooseUs";
import { OurTeam } from "@/components/about/OurTeam";
import { ImpactSection } from "@/components/about/ImpactSection";
import { Testimonials } from "@/components/home/Testimonials";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { ProductGridSkeleton } from "@/components/catalog/ProductGridSkeleton";

export const metadata: Metadata = {
  title: "About Us — VIZAURA GLOBAL",
  description: "Rooted in nature, driven by wellness — the story, values and people behind VIZAURA GLOBAL.",
};

export default function AboutPage() {
  return (
    <>
      <AboutHero />
      <OurStory />
      <MissionValues />
      <WhyChooseUs />
      <OurTeam />
      <ImpactSection />

      <Container>
        <Section>
          <Suspense fallback={<ProductGridSkeleton count={3} />}>
            <Testimonials
              id="testimonials"
              overline="Customer Stories"
              heading="What people are saying about us"
              viewAllHref={undefined}
            />
          </Suspense>
        </Section>
      </Container>
    </>
  );
}
