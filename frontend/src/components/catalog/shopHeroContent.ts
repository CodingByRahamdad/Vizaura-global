export interface ShopHeroContent {
  imageUrl: string;
  overline: string;
  heading: string;
  description: string;
}

const SHOP_HERO_CONTENT: ShopHeroContent = {
  imageUrl:
    "/about-us/shop.webp",
  overline: "Premium Natural Products",
  heading: "Shop Our Natural Collection",
  description: "Discover authentic, high-quality natural products for a healthier, happier you.",
};

/**
 * Sync for now — no CMS/Banner backend exists yet (same reasoning as
 * components/home/heroSlides.ts). Kept as a function so the Admin Dashboard
 * phase can swap the body for a real API call without touching the caller.
 */
export function getShopHeroContent(): ShopHeroContent {
  return SHOP_HERO_CONTENT;
}
