"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Heart, Menu, ShoppingCart } from "lucide-react";
import { SearchField } from "@/components/ui/SearchField";
import { CategoryMenu } from "@/components/layout/Header/CategoryMenu";
import { MobileNav } from "@/components/layout/Header/MobileNav";
import { AccountMenu } from "@/components/layout/Header/AccountMenu";
import { MAIN_NAV_LINKS } from "@/lib/constants/nav";
import { useCartWishlist } from "@/context/CartWishlistContext";
import type { CategoryResponse } from "@/lib/types/catalog";

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white">
      {count}
    </span>
  );
}

interface MainBarProps {
  categories: CategoryResponse[];
}

export function MainBar({ categories }: MainBarProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { cartCount, wishlistCount } = useCartWishlist();
  const router = useRouter();

  return (
    <div className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-[var(--container-max)] items-center gap-4 px-5 py-4 md:px-6">
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setMobileNavOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-md hover:bg-primary-light/50 lg:hidden"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>

        <Link href="/" className="flex flex-col leading-tight">
          <span className="font-serif text-xl font-semibold text-primary-dark">
            VIZAURA GLOBAL
          </span>
          <span className="hidden text-[10px] uppercase tracking-widest text-text-secondary md:block">
            Natural · Premium · Global
          </span>
        </Link>

        <nav
          aria-label="Main navigation"
          className="ml-4 hidden items-center gap-6 whitespace-nowrap lg:flex"
        >

          {MAIN_NAV_LINKS.slice(0, 2).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-text hover:text-primary-dark"
            >
              {link.label}
            </Link>
          ))}
          <CategoryMenu categories={categories} />
          {MAIN_NAV_LINKS.slice(2).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-text hover:text-primary-dark"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex flex-1 items-center justify-end gap-1 md:flex-none">
          <SearchField
            className="hidden w-64 lg:block"
            onSubmit={(query) =>
              router.push(query ? `/products?q=${encodeURIComponent(query)}` : "/products")
            }
          />
          <AccountMenu />
          <Link
            href="/account/wishlist"
            aria-label="Wishlist"
            title="Wishlist"
            className="relative flex h-10 w-10 items-center justify-center rounded-md text-text hover:bg-primary-light/50"
          >
            <Heart className="h-5 w-5" aria-hidden />
            <CountBadge count={wishlistCount} />
          </Link>
          <Link
            href="/cart"
            aria-label="Cart"
            title="Cart"
            className="relative flex h-10 w-10 items-center justify-center rounded-md text-text hover:bg-primary-light/50"
          >
            <ShoppingCart className="h-5 w-5" aria-hidden />
            <CountBadge count={cartCount} />
          </Link>
        </div>
      </div>

      <MobileNav
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        categories={categories}
      />
    </div>
  );
}
