"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LogOut, User, X } from "lucide-react";
import { MAIN_NAV_LINKS } from "@/lib/constants/nav";
import { useAuth } from "@/context/AuthContext";
import type { CategoryResponse } from "@/lib/types/catalog";

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
  categories: CategoryResponse[];
}

export function MobileNav({ open, onClose, categories }: MobileNavProps) {
  const { status, user, logout } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    onClose();
    router.push("/");
  }

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        aria-label="Close menu"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="absolute right-0 top-0 flex h-full w-80 max-w-[85vw] flex-col gap-6 overflow-y-auto bg-surface p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <span className="font-serif text-lg font-semibold text-text">Menu</span>
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-primary-light/50"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <nav aria-label="Mobile navigation" className="flex flex-col gap-1">
          {MAIN_NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={onClose}
              className="rounded-md px-2 py-2 text-sm font-medium text-text hover:bg-primary-light/40"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div>
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Categories
          </p>
          <nav aria-label="Mobile categories" className="flex flex-col gap-1">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/products?category=${category.id}`}
                onClick={onClose}
                className="rounded-md px-2 py-2 text-sm text-text hover:bg-primary-light/40"
              >
                {category.name}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-auto border-t border-border pt-4">
          {status === "authenticated" && user ? (
            <div className="flex flex-col gap-1">
              <p className="px-2 text-sm font-medium text-text">
                {user.firstName} {user.lastName}
              </p>
              <Link
                href="/account"
                onClick={onClose}
                className="rounded-md px-2 py-2 text-sm text-text hover:bg-primary-light/40"
              >
                My Account
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-error hover:bg-error/10"
              >
                <LogOut className="h-4 w-4" aria-hidden />
                Logout
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <Link
                href="/login"
                onClick={onClose}
                className="flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-text hover:bg-primary-light/40"
              >
                <User className="h-4 w-4" aria-hidden />
                Login
              </Link>
              <Link
                href="/register"
                onClick={onClose}
                className="rounded-md px-2 py-2 text-sm text-text hover:bg-primary-light/40"
              >
                Create Account
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
