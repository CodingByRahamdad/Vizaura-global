export interface HeroSlide {
  id: string;
  imageUrl: string;
  overline: string;
  heading: string;
  description: string;
  primaryCta: { label: string; href: string };
  secondaryCta: { label: string; href: string };
}

const HERO_SLIDES: HeroSlide[] = [
  {
    id: "premium-natural-products",
    imageUrl: "/Slider-images/Banner-1.webp",
    overline: "Nature's Finest, For a Healthier You",
    heading: "Premium Natural Products for a Better Life",
    description:
      "Discover the power of nature with our pure Shilajit, honey, perfumes and wellness essentials.",
    primaryCta: { label: "Shop Now", href: "/products" },
    secondaryCta: { label: "Explore Best Sellers", href: "/best-sellers" },
  },
  {
    id: "raw-wild-honey",
    imageUrl: "/Slider-images/Banner-2.webp",
    overline: "Pure. Natural. Unfiltered.",
    heading: "Raw Wild Honey, Straight From the Hive",
    description: "Single-origin honey harvested at peak season, never heated, never diluted.",
    primaryCta: { label: "Shop Honey", href: "/products?category=honey" },
    secondaryCta: { label: "Our Story", href: "/about" },
  },
  {
    id: "luxury-perfumes",
    imageUrl: "/Slider-images/Banner-3.webp",
    overline: "Natural-Essence Fragrance",
    heading: "Luxury Perfumes, Crafted From Nature",
    description: "Long-lasting eau de parfum blended from pure, natural essences.",
    primaryCta: { label: "Shop Perfumes", href: "/products?category=perfumes" },
    secondaryCta: { label: "View All Products", href: "/products" },
  },
];

/**
 * Sync for now — no Banner/CMS backend exists yet to source slides from
 * (see docs). Keeping this as a function (not a bare export) means the
 * Admin Dashboard phase can swap the body for a real API call without
 * touching any caller.
 */
export function getHeroSlides(): HeroSlide[] {
  return HERO_SLIDES;
}
