export interface AboutHeroContent {
  imageUrl: string;
  imageAlt: string;
  overline: string;
  heading: string;
  description: string;
}

const ABOUT_HERO_CONTENT: AboutHeroContent = {
  imageUrl: "/Slider-images/Banner-1.webp",
  imageAlt: "",
  overline: "About Us",
  heading: "Rooted in Nature, Driven by Wellness",
  description:
    "At VIZAURA GLOBAL, we bring you the purest gifts of nature — thoughtfully sourced, carefully crafted, and made to support a healthier, more balanced life.",
};

/**
 * Sync for now — no Banner/CMS backend exists yet (same precedent as
 * shopHeroContent.ts). Keeping this as a function means a future CMS-backed
 * phase can swap the body for a real API call without touching the caller.
 */
export function getAboutHeroContent(): AboutHeroContent {
  return ABOUT_HERO_CONTENT;
}
