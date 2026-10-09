"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ChevronDown,
  LayoutDashboard,
  Package,
  FolderTree,
  ShoppingCart,
  Users,
  Globe,
  Boxes,
  Settings,
  Star,
  Megaphone,
} from "lucide-react";
import type { AdminIconName, AdminNavLink } from "@/lib/constants/admin-nav";

// Resolved here, not in admin-nav.ts: that module is imported by the
// server-rendered admin/layout.tsx, and a lucide icon component (a
// forwardRef object) can't cross the Server->Client prop boundary — only the
// string name can. See admin-nav.ts's AdminIconName comment.
const ICONS: Record<AdminIconName, typeof LayoutDashboard> = {
  LayoutDashboard,
  Package,
  FolderTree,
  ShoppingCart,
  Users,
  Globe,
  Boxes,
  Settings,
  Star,
  Megaphone,
};

interface AdminSidebarProps {
  links: AdminNavLink[];
  /** Called when a nav link is clicked — lets the mobile drawer close itself on navigation. */
  onNavigate?: () => void;
}

function autoOpenLabelFor(links: AdminNavLink[], pathname: string): string | null {
  return links.find((link) => link.children?.some((child) => pathname.startsWith(child.href)))?.label ?? null;
}

/// Client component so it can track expand/collapse state and read the
/// current path for active-link highlighting — permission filtering
/// (which links even appear in `links`) stays server-side in admin/layout.tsx,
/// unchanged. Previously this was static inline markup in admin/layout.tsx
/// with no real active state (every link got the same class regardless of
/// route) and no dropdown support at all.
export function AdminSidebar({ links, onNavigate }: AdminSidebarProps) {
  const pathname = usePathname();
  const [openLabel, setOpenLabel] = useState<string | null>(() => autoOpenLabelFor(links, pathname));

  // The layout (and this sidebar) stays mounted across client-side
  // navigations between admin pages, so the useState initializer above only
  // ever runs once on first mount. Re-deriving and setting state directly
  // during render (React's documented pattern for "adjust state when a prop
  // changes", not an effect) keeps the dropdown in sync as the route
  // actually changes, without the cascading-render effect anti-pattern.
  const [pathnameAtLastSync, setPathnameAtLastSync] = useState(pathname);
  if (pathname !== pathnameAtLastSync) {
    setPathnameAtLastSync(pathname);
    const match = autoOpenLabelFor(links, pathname);
    if (match) setOpenLabel(match);
  }

  function isActive(href: string): boolean {
    return href === "/admin/dashboard" ? pathname === href : pathname.startsWith(href);
  }

  return (
    <nav className="flex flex-col gap-1">
      {links.map((link) => {
        const Icon = ICONS[link.icon];
        const hasChildren = !!link.children && link.children.length > 0;
        const active = isActive(link.href);
        const open = openLabel === link.label;

        if (!link.isRouted) {
          return (
            <span
              key={link.label}
              className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm text-white/50"
              title="Coming in a later phase"
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {link.label}
            </span>
          );
        }

        if (hasChildren) {
          return (
            <div key={link.label}>
              <button
                type="button"
                onClick={() => setOpenLabel(open ? null : link.label)}
                aria-expanded={open}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
                  active ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/5"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="flex-1">{link.label}</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>
              {open ? (
                <div className="ml-4 mt-1 flex flex-col gap-0.5 border-l border-white/10 pl-4">
                  {link.children!.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={onNavigate}
                      className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                        pathname === child.href ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5"
                      }`}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          );
        }

        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              active ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/5"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
