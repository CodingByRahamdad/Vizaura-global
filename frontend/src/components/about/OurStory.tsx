import { Leaf } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SafeImage } from "@/components/ui/SafeImage";
import { AboutSectionHeader } from "@/components/about/AboutSectionHeader";

const STORY_IMAGE_URL =
  "/about-us/about-1.webp";

/**
 * Plain bounded image (not OurStorySection's full-bleed text-overlay
 * pattern) — the reference keeps the heading/paragraphs on a separate plain
 * background next to it, with only a small watermark-style line on the image.
 */
export function OurStory() {
  return (
    <Section id="our-story" aria-labelledby="our-story-heading" className="scroll-mt-24 bg-surface py-12 md:py-16">
      <Container className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-14">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl">
          <SafeImage src={STORY_IMAGE_URL} alt="A young plant growing from mountain rock" className="absolute inset-0" />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          <p
            aria-hidden
            className="absolute bottom-5 left-6 font-serif text-2xl font-medium italic leading-tight text-white/90 md:text-3xl"
          >
            Pure Natural Authentic
          </p>
        </div>

        <div className="relative flex flex-col gap-4 pb-6">
          <AboutSectionHeader id="our-story-heading" eyebrow="Our Story" title="From Nature's Best, To Your Life" className="max-w-sm" />
          <p className="max-w-lg text-sm leading-relaxed text-text-secondary md:text-base">
            VIZAURA GLOBAL was born from a simple belief: nature already holds everything we need to live well. We
            travel to pristine mountain regions to source Shilajit, raw honey and botanicals in their purest form.
          </p>
          <p className="max-w-lg text-sm leading-relaxed text-text-secondary md:text-base">
            Every product is carefully tested and thoughtfully packed, so the goodness of nature reaches you exactly
            as it was meant to be.
          </p>
          <div className="mt-2">
            <p className="font-serif text-3xl font-medium italic text-forest">Vizaura Global</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-warning">
              Nature&apos;s Goodness. Always.
            </p>
          </div>
          <div aria-hidden className="pointer-events-none absolute bottom-0 right-0 hidden items-center gap-2 text-accent-green/60 sm:flex">
            <span className="h-px w-20 bg-current" />
            <Leaf className="h-6 w-6 -rotate-45" strokeWidth={1.25} />
          </div>
        </div>
      </Container>
    </Section>
  );
}
