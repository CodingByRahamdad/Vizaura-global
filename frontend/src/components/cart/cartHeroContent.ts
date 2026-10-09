export interface CartHeroContent {
  imageUrl: string;
  overline: string;
  heading: string;
  description: string;
}

const CART_HERO_CONTENT: CartHeroContent = {
  imageUrl:
    "/about-us/cart.webp",
  overline: "Your Cart",
  heading: "Good Things\nAre Worth the Wait",
  description: "Your natural wellness journey is just a step away.",
};

/**
 * Sync for now — no CMS/Banner backend exists yet, same precedent as
 * catalog/shopHeroContent.ts. Kept as a function so a future admin-managed
 * banner can swap the body for a real API call without touching the caller.
 */
export function getCartHeroContent(): CartHeroContent {
  return CART_HERO_CONTENT;
}
