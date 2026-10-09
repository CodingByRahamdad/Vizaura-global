"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import type { CategoryResponse } from "@/lib/types/catalog";
import { cn } from "@/lib/utils/cn";

interface CategoryMenuProps {
  categories: CategoryResponse[];
}

export function CategoryMenu({ categories }: CategoryMenuProps) {
  return (
    <Dropdown
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex items-center gap-1 text-sm font-medium text-text hover:text-primary-dark"
        >
          Categories
          <ChevronDown
            aria-hidden
            className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
          />
        </button>
      )}
      panelClassName="left-0 w-56 py-2"
    >
      {({ close }) => (
        <ul role="menu">
          {categories.map((category) => (
            <li key={category.id} role="none">
              <Link
                href={`/products?category=${category.id}`}
                role="menuitem"
                onClick={close}
                className="block px-4 py-2 text-sm text-text hover:bg-primary-light/40 hover:text-primary-dark"
              >
                {category.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Dropdown>
  );
}
