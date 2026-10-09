import { MARKETS, MARKET_CODES } from "@/lib/constants/market";

export interface NavLink {
  label: string;
  href: string;
}

/**
 * Rendered by MainBar.tsx as: links[0..1] (Home, Shop), then the
 * CategoryMenu dropdown, then links[2..] (Best Sellers, About, Contact) —
 * matching design-references/Homepage.png's nav order. MobileNav.tsx renders
 * this array plain (no interleave), which is fine there.
 */
export const MAIN_NAV_LINKS: NavLink[] = [
  { label: "Home", href: "/" },
  { label: "Shop", href: "/products" },
  { label: "Best Sellers", href: "/best-sellers" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export const FOOTER_LINK_GROUPS: { title: string; links: NavLink[] }[] = [
  {
    title: "Shop",
    links: [
      { label: "All Products", href: "/products" },
      { label: "Categories", href: "/categories" },
    ],
  },
  {
    title: "Customer Service",
    links: [
      { label: "Contact Us", href: "/contact" },
      { label: "FAQ", href: "/contact#faq" },
      { label: "Shipping Policy", href: "/shipping-policy" },
      { label: "Return & Refund Policy", href: "/return-policy" },
    ],
  },
  {
    title: "About Us",
    links: [
      { label: "Our Story", href: "/about" },
      { label: "Sustainability", href: "/about#sustainability" },
      { label: "Blog", href: "/blog" },
      { label: "Careers", href: "/about#careers" },
    ],
  },
];

/** Derived from lib/constants/market.ts's MARKETS — that file is the single source of truth. */
export const MARKET_OPTIONS = MARKET_CODES.map((code) => ({
  label: MARKETS[code].label,
  value: code,
}));

export const SOCIAL_LINKS: NavLink[] = [
  { label: "Facebook", href: "https://facebook.com" },
  { label: "Instagram", href: "https://instagram.com" },
  { label: "TikTok", href: "https://tiktok.com" },
  { label: "YouTube", href: "https://youtube.com" },
  { label: "Pinterest", href: "https://pinterest.com" },
];
